import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Json, OrderItem } from "@/types/database";

export async function createWorkflowInstanceForOrderItem(
  orderItem: Pick<OrderItem, "id" | "tenant_id" | "workflow_id">,
  createdBy: string
) {
  const supabase = createSupabaseServiceRoleClient();

  const existing = await supabase
    .from("item_workflow_instances")
    .select("id")
    .eq("tenant_id", orderItem.tenant_id)
    .eq("order_item_id", orderItem.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Unable to check workflow instance: ${existing.error.message}`);
  }

  if (existing.data) {
    return existing.data.id;
  }

  const workflowStages = await supabase
    .from("workflow_stages")
    .select("*")
    .eq("tenant_id", orderItem.tenant_id)
    .eq("workflow_id", orderItem.workflow_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sequence_number");

  if (workflowStages.error) {
    throw new Error(`Unable to load workflow stages: ${workflowStages.error.message}`);
  }

  if (!workflowStages.data?.length) {
    throw new Error("Selected workflow has no configured stages.");
  }

  const workflowInstance = await supabase
    .from("item_workflow_instances")
    .insert({
      tenant_id: orderItem.tenant_id,
      order_item_id: orderItem.id,
      workflow_id: orderItem.workflow_id,
      status: "not_started",
      created_by: createdBy,
      updated_by: createdBy
    })
    .select("id")
    .single();

  if (workflowInstance.error) {
    throw new Error(`Unable to create workflow instance: ${workflowInstance.error.message}`);
  }

  const stageInstances = await supabase
    .from("item_stage_instances")
    .insert(
      workflowStages.data.map((stage, index) => ({
        tenant_id: orderItem.tenant_id,
        workflow_instance_id: workflowInstance.data.id,
        order_item_id: orderItem.id,
        workflow_stage_id: stage.id,
        stage_master_id: stage.stage_master_id,
        sequence_number: stage.sequence_number,
        status: index === 0 ? "ready_to_start" : "not_started",
        customer_status_id: stage.customer_status_id,
        created_by: createdBy,
        updated_by: createdBy
      }))
    )
    .select("id, sequence_number")
    .order("sequence_number");

  if (stageInstances.error) {
    throw new Error(`Unable to create stage instances: ${stageInstances.error.message}`);
  }

  const firstStage = stageInstances.data?.[0];

  if (firstStage) {
    const workflowUpdate = await supabase
      .from("item_workflow_instances")
      .update({
        current_stage_instance_id: firstStage.id,
        updated_by: createdBy
      })
      .eq("tenant_id", orderItem.tenant_id)
      .eq("id", workflowInstance.data.id);

    if (workflowUpdate.error) {
      throw new Error(`Unable to set current stage: ${workflowUpdate.error.message}`);
    }
  }

  const history = await supabase.from("item_history").insert({
    tenant_id: orderItem.tenant_id,
    order_item_id: orderItem.id,
    event_type: "workflow_assigned",
    new_value_json: {
      workflow_id: orderItem.workflow_id,
      workflow_instance_id: workflowInstance.data.id
    } as Json,
    notes: "Workflow instance generated from configured workflow.",
    created_by: createdBy
  });

  if (history.error) {
    throw new Error(`Unable to write item history: ${history.error.message}`);
  }

  return workflowInstance.data.id;
}
