import "server-only";

import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getProductionPageData() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const [items, orders, customers, workflows, workflowStages, workflowInstances, stageInstances, stages, workLogs, workers] = await Promise.all([
    supabase
      .from("order_items")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("orders").select("id, order_number, customer_id").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("customers").select("id, name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("workflows").select("id, name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase
      .from("workflow_stages")
      .select("id, workflow_id, stage_master_id, sequence_number, is_active")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sequence_number"),
    supabase
      .from("item_workflow_instances")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase
      .from("item_stage_instances")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase.from("stage_master").select("id, name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase
      .from("item_stage_work_logs")
      .select("id, stage_instance_id, order_item_id, worker_id, status, started_at, completed_at")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null),
    supabase
      .from("workers")
      .select("id, name")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "active")
      .is("deleted_at", null)
  ]);

  for (const result of [items, orders, customers, workflows, workflowStages, workflowInstances, stageInstances, stages, workLogs, workers]) {
    if (result.error) {
      throw new Error(`Unable to load production data: ${result.error.message}`);
    }
  }

  return {
    context,
    items: items.data ?? [],
    orders: orders.data ?? [],
    customers: customers.data ?? [],
    workflows: workflows.data ?? [],
    workflowStages: workflowStages.data ?? [],
    workflowInstances: workflowInstances.data ?? [],
    stageInstances: stageInstances.data ?? [],
    stages: stages.data ?? [],
    workLogs: workLogs.data ?? [],
    workers: workers.data ?? []
  };
}

export async function getProductionItemPageData(itemId: string) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const item = await supabase
    .from("order_items")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (item.error) {
    throw new Error(`Unable to load production item: ${item.error.message}`);
  }

  if (!item.data) {
    notFound();
  }

  const [
    order,
    workflow,
    workflows,
    itemType,
    workflowInstance,
    stageInstances,
    workflowStages,
    stages,
    workers,
    workerWorkgroups,
    stageWorkgroups,
    workgroups,
    workLogs,
    contributionRules,
    contributionCorrections,
    history,
    linkedMeasurement
  ] =
    await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("id", item.data.order_id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("workflows")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("id", item.data.workflow_id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("workflows")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("item_types")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("id", item.data.item_type_id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("item_workflow_instances")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("item_stage_instances")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .is("deleted_at", null)
        .order("sequence_number"),
      supabase
        .from("workflow_stages")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("workflow_id", item.data.workflow_id)
        .is("deleted_at", null),
      supabase.from("stage_master").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
      supabase
        .from("workers")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("worker_workgroups")
        .select("*")
        .eq("tenant_id", context.tenant.id),
      supabase
        .from("stage_workgroups")
        .select("*")
        .eq("tenant_id", context.tenant.id),
      supabase
        .from("workgroups")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("item_stage_work_logs")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("item_type_stage_contribution_rules")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("item_type_id", item.data.item_type_id)
        .eq("is_active", true)
        .is("deleted_at", null),
      supabase
        .from("item_stage_contribution_corrections")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("item_history")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .order("created_at", { ascending: false })
        .limit(20),
      item.data.customer_measurement_id
        ? supabase
            .from("customer_measurements")
            .select("*")
            .eq("tenant_id", context.tenant.id)
            .eq("id", item.data.customer_measurement_id)
            .is("deleted_at", null)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

  for (const result of [
    order,
    workflow,
    workflows,
    itemType,
    workflowInstance,
    stageInstances,
    workflowStages,
    stages,
    workers,
    workerWorkgroups,
    stageWorkgroups,
    workgroups,
    workLogs,
    contributionRules,
    contributionCorrections,
    history,
    linkedMeasurement
  ]) {
    if (result.error) {
      throw new Error(`Unable to load production item detail: ${result.error.message}`);
    }
  }

  return {
    context,
    item: item.data,
    order: order.data,
    workflow: workflow.data,
    workflows: workflows.data ?? [],
    itemType: itemType.data,
    workflowInstance: workflowInstance.data,
    stageInstances: stageInstances.data ?? [],
    workflowStages: workflowStages.data ?? [],
    stages: stages.data ?? [],
    workers: workers.data ?? [],
    workerWorkgroups: workerWorkgroups.data ?? [],
    stageWorkgroups: stageWorkgroups.data ?? [],
    workgroups: workgroups.data ?? [],
    workLogs: workLogs.data ?? [],
    contributionRules: contributionRules.data ?? [],
    contributionCorrections: contributionCorrections.data ?? [],
    canCorrectCompletedContributions: context.membership.role === "owner_admin",
    history: history.data ?? [],
    linkedMeasurement: linkedMeasurement.data
  };
}
