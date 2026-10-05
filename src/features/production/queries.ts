import "server-only";

import { z } from "zod";
import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { ItemHistory, ItemStageInstance, ItemStageWorkLog } from "@/types/database";

const productionFiltersSchema = z.object({
  itemTypeIds: z.array(z.string().uuid()).max(100),
  workflowIds: z.array(z.string().uuid()).max(100)
});
const impossibleId = "00000000-0000-0000-0000-000000000000";

export async function getProductionPageData(filters: { itemTypeIds: string[]; workflowIds: string[] }) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const parsedFilters = productionFiltersSchema.safeParse(filters);
  let itemsQuery = supabase.from("order_items").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null);

  if (!parsedFilters.success) {
    itemsQuery = itemsQuery.eq("id", impossibleId);
  } else {
    if (parsedFilters.data.itemTypeIds.length) itemsQuery = itemsQuery.in("item_type_id", parsedFilters.data.itemTypeIds);
    if (parsedFilters.data.workflowIds.length) itemsQuery = itemsQuery.in("workflow_id", parsedFilters.data.workflowIds);
  }

  itemsQuery = itemsQuery.order("created_at", { ascending: false }).limit(100);

  // Resolve relationships from the displayed items, not an implicitly capped
  // tenant-wide directory. Every lookup remains inside the current tenant.
  const items = await itemsQuery;
  if (items.error) throw new Error(`Unable to load production data: ${items.error.message}`);
  const orderIds = [...new Set((items.data ?? []).map((item) => item.order_id))];
  const orders = orderIds.length
    ? await supabase.from("orders").select("id, order_number, customer_id").eq("tenant_id", context.tenant.id).in("id", orderIds).is("deleted_at", null)
    : { data: [], error: null };
  if (orders.error) throw new Error(`Unable to load production data: ${orders.error.message}`);
  const customerIds = [...new Set((orders.data ?? []).map((order) => order.customer_id))];

  const [customers, itemTypes, workflows, workflowStages, workflowInstances, stageInstances, stages, workLogs, workers] = await Promise.all([
    customerIds.length
      ? supabase.from("customers").select("id, name").eq("tenant_id", context.tenant.id).in("id", customerIds).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("item_types").select("id, name, icon_emoji, icon_kind, icon_name, icon_color").eq("tenant_id", context.tenant.id).is("deleted_at", null).order("name"),
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

  for (const result of [items, orders, customers, itemTypes, workflows, workflowStages, workflowInstances, stageInstances, stages, workLogs, workers]) {
    if (result.error) {
      throw new Error(`Unable to load production data: ${result.error.message}`);
    }
  }

  return {
    context,
    items: items.data ?? [],
    orders: orders.data ?? [],
    customers: customers.data ?? [],
    itemTypes: itemTypes.data ?? [],
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
  const canViewContributionAmounts = context.membership.role === "owner_admin";

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

  const stageInstancesPromise = canViewContributionAmounts
    ? supabase.from("item_stage_instances").select("*").eq("tenant_id", context.tenant.id).eq("order_item_id", item.data.id).is("deleted_at", null).order("sequence_number")
    : supabase.from("item_stage_instances")
      .select("id, tenant_id, workflow_instance_id, order_item_id, workflow_stage_id, stage_master_id, sequence_number, status, planned_start_at, planned_end_at, started_at, completed_at, customer_status_id, notes, effort_tracking_mode_snapshot, contribution_revision, created_at, updated_at, created_by, updated_by, deleted_at")
      .eq("tenant_id", context.tenant.id).eq("order_item_id", item.data.id).is("deleted_at", null).order("sequence_number");
  const workLogsPromise = canViewContributionAmounts
    ? supabase.from("item_stage_work_logs").select("*").eq("tenant_id", context.tenant.id).eq("order_item_id", item.data.id).is("deleted_at", null).order("created_at", { ascending: false })
    : supabase.from("item_stage_work_logs")
      .select("id, tenant_id, stage_instance_id, order_item_id, worker_id, workgroup_id, started_at, paused_at, resumed_at, completed_at, duration_minutes, credited_units, credited_minutes, status, notes, created_by, created_at, updated_at, updated_by, deleted_at")
      .eq("tenant_id", context.tenant.id).eq("order_item_id", item.data.id).is("deleted_at", null).order("created_at", { ascending: false });
  const contributionRulesPromise = canViewContributionAmounts
    ? supabase.from("item_type_stage_contribution_rules").select("*").eq("tenant_id", context.tenant.id).eq("item_type_id", item.data.item_type_id).eq("is_active", true).is("deleted_at", null)
    : Promise.resolve({ data: [], error: null });
  const historyPromise = canViewContributionAmounts
    ? supabase.from("item_history").select("*").eq("tenant_id", context.tenant.id).eq("order_item_id", item.data.id).order("created_at", { ascending: false }).limit(20)
    : supabase.from("item_history").select("id, tenant_id, order_item_id, event_type, notes, created_by, created_at").eq("tenant_id", context.tenant.id).eq("order_item_id", item.data.id).order("created_at", { ascending: false }).limit(20);

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
      stageInstancesPromise,
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
      workLogsPromise,
      contributionRulesPromise,
      supabase
        .from("item_stage_contribution_corrections")
        .select("id, tenant_id, stage_instance_id, order_item_id, reason, created_by, created_at")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      historyPromise,
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
    stageInstances: canViewContributionAmounts ? (stageInstances.data ?? []) as ItemStageInstance[] : (stageInstances.data ?? []).map((stage): ItemStageInstance => ({
      ...stage,
      contribution_rule_id_snapshot: null,
      contribution_method_snapshot: null,
      contribution_rate_snapshot: null,
      contribution_allocation_basis_snapshot: null,
      contribution_item_value_snapshot: null,
      contribution_pool_snapshot: null,
    })),
    workflowStages: workflowStages.data ?? [],
    stages: stages.data ?? [],
    workers: workers.data ?? [],
    workerWorkgroups: workerWorkgroups.data ?? [],
    stageWorkgroups: stageWorkgroups.data ?? [],
    workgroups: workgroups.data ?? [],
    workLogs: canViewContributionAmounts ? (workLogs.data ?? []) as ItemStageWorkLog[] : (workLogs.data ?? []).map((log): ItemStageWorkLog => ({ ...log, calculated_contribution_amount: 0 })),
    contributionRules: contributionRules.data ?? [],
    contributionCorrections: contributionCorrections.data ?? [],
    canCorrectCompletedContributions: canViewContributionAmounts,
    canViewContributionAmounts,
    history: canViewContributionAmounts ? (history.data ?? []) as ItemHistory[] : (history.data ?? []).map((event): ItemHistory => ({ ...event, new_value_json: null, old_value_json: null })),
    linkedMeasurement: linkedMeasurement.data
  };
}
