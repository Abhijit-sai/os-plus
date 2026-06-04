import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getWorkflowConfigurationPageData() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const [workflows, stages, itemTypes, customerStatuses, workgroups, stageWorkgroups] = await Promise.all([
    supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("stage_master")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("item_types")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("customer_statuses")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("workgroups")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("stage_workgroups").select("*").eq("tenant_id", context.tenant.id)
  ]);

  for (const result of [workflows, stages, itemTypes, customerStatuses, workgroups, stageWorkgroups]) {
    if (result.error) {
      throw new Error(`Unable to load workflow configuration: ${result.error.message}`);
    }
  }

  return {
    context,
    workflows: workflows.data ?? [],
    stages: stages.data ?? [],
    itemTypes: itemTypes.data ?? [],
    customerStatuses: customerStatuses.data ?? [],
    workgroups: workgroups.data ?? [],
    stageWorkgroups: stageWorkgroups.data ?? []
  };
}

export async function getWorkflowDetailPageData(workflowId: string) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const [workflow, workflowStages, stages, customerStatuses, itemTypes] = await Promise.all([
    supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", workflowId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("workflow_stages")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("workflow_id", workflowId)
      .is("deleted_at", null)
      .order("sequence_number"),
    supabase.from("stage_master").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("customer_statuses").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("sort_order"),
    supabase.from("item_types").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("name")
  ]);

  for (const result of [workflow, workflowStages, stages, customerStatuses, itemTypes]) {
    if (result.error) {
      throw new Error(`Unable to load workflow detail: ${result.error.message}`);
    }
  }

  return {
    context,
    workflow: workflow.data,
    workflowStages: workflowStages.data ?? [],
    stages: stages.data ?? [],
    customerStatuses: customerStatuses.data ?? [],
    itemTypes: itemTypes.data ?? []
  };
}
