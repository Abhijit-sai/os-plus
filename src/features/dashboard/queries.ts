import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { assertPermission, hasPermission } from "@/lib/permissions/roles";

export async function getDashboardPageData() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "dashboard:view");
  const supabase = createSupabaseServiceRoleClient();

  const [orders, orderPayments, items, workflowInstances, stageInstances, workflows, stages, workLogs, workers, expenses, dues, attendance] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, customer_id, order_date, promised_delivery_date, total_amount, amount_paid, payment_status, order_status")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("order_date", { ascending: false })
        .limit(200),
      supabase
        .from("order_payments")
        .select("id, order_id, amount, payment_date")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("payment_date", { ascending: false })
        .limit(200),
      supabase
        .from("order_items")
        .select("id, order_id, name, workflow_id, expected_completion_date, item_status, final_price")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("item_workflow_instances")
        .select("id, order_item_id, workflow_id, status, current_stage_instance_id")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null),
      supabase
        .from("item_stage_instances")
        .select("id, workflow_instance_id, order_item_id, stage_master_id, sequence_number, status, started_at, completed_at, updated_at")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null),
      supabase
        .from("workflows")
        .select("id, name")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null),
      supabase
        .from("stage_master")
        .select("id, name")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null),
      supabase
        .from("item_stage_work_logs")
        .select("id, order_item_id, worker_id, started_at, completed_at, status, updated_at")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(500),
      supabase
        .from("workers")
        .select("id, name, status")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("name"),
      supabase
        .from("expenses")
        .select("id, amount, expense_date")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .limit(200),
      supabase
        .from("receivables_payables")
        .select("id, type, party_name, amount, amount_settled, due_date, status, linked_order_id")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from("attendance")
        .select("id, worker_id, attendance_date, status")
        .eq("tenant_id", context.tenant.id)
        .is("deleted_at", null)
        .order("attendance_date", { ascending: false })
        .limit(200)
    ]);

  for (const result of [orders, orderPayments, items, workflowInstances, stageInstances, workflows, stages, workLogs, workers, expenses, dues, attendance]) {
    if (result.error) {
      throw new Error(`Unable to load dashboard data: ${result.error.message}`);
    }
  }

  return {
    context,
    orders: orders.data ?? [],
    orderPayments: orderPayments.data ?? [],
    items: items.data ?? [],
    workflowInstances: workflowInstances.data ?? [],
    stageInstances: stageInstances.data ?? [],
    workflows: workflows.data ?? [],
    stages: stages.data ?? [],
    workLogs: workLogs.data ?? [],
    workers: workers.data ?? [],
    expenses: expenses.data ?? [],
    dues: dues.data ?? [],
    attendance: attendance.data ?? []
  };
}

async function readReportPages<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await buildQuery(offset, offset + pageSize - 1);
    if (result.error) throw new Error(`Unable to load worker contribution report: ${result.error.message}`);
    rows.push(...(result.data ?? []));
    if ((result.data ?? []).length < pageSize) break;
  }
  return { data: rows, error: null };
}

export async function getWorkerContributionReportData({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}) {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "worker_contributions:view");
  const supabase = createSupabaseServiceRoleClient();
  const canViewContributionAmounts = hasPermission(context.membership.role, "worker_contribution_amounts:view");
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const workLogsPromise = readReportPages((from, to) => canViewContributionAmounts
    ? supabase
      .from("item_stage_work_logs")
      .select("id, stage_instance_id, order_item_id, worker_id, workgroup_id, credited_units, credited_minutes, calculated_contribution_amount, completed_at")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("completed_at", `${startDate}T00:00:00.000Z`)
      .lt("completed_at", endExclusive.toISOString())
      .order("completed_at").order("id").range(from, to)
    : supabase
      .from("item_stage_work_logs")
      .select("id, stage_instance_id, order_item_id, worker_id, workgroup_id, credited_units, credited_minutes, completed_at")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("completed_at", `${startDate}T00:00:00.000Z`)
      .lt("completed_at", endExclusive.toISOString())
      .order("completed_at").order("id").range(from, to));
  const stageInstancesPromise = readReportPages((from, to) => canViewContributionAmounts
    ? supabase
      .from("item_stage_instances")
      .select("id, stage_master_id, effort_tracking_mode_snapshot, contribution_method_snapshot")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("completed_at", `${startDate}T00:00:00.000Z`)
      .lt("completed_at", endExclusive.toISOString()).order("id").range(from, to)
    : supabase
      .from("item_stage_instances")
      .select("id, stage_master_id, effort_tracking_mode_snapshot")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("completed_at", `${startDate}T00:00:00.000Z`)
      .lt("completed_at", endExclusive.toISOString()).order("id").range(from, to));

  const [workLogs, stageInstances, workers, itemTypes, stages, workgroups] = await Promise.all([
    workLogsPromise,
    stageInstancesPromise,
    readReportPages((from, to) => supabase
      .from("workers")
      .select("id, name, status")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name").order("id").range(from, to)),
    readReportPages((from, to) => supabase
      .from("item_types")
      .select("id, name")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name").order("id").range(from, to)),
    readReportPages((from, to) => supabase
      .from("stage_master")
      .select("id, name")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name").order("id").range(from, to)),
    readReportPages((from, to) => supabase
      .from("workgroups")
      .select("id, name")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name").order("id").range(from, to)),
  ]);

  const itemIds = [...new Set(workLogs.data.map((log) => log.order_item_id))];
  const orderItems: { data: Array<{ id: string; item_type_id: string }>; error: null } = { data: [], error: null };
  for (let offset = 0; offset < itemIds.length; offset += 500) {
    const result = await supabase.from("order_items").select("id, item_type_id")
      .eq("tenant_id", context.tenant.id).in("id", itemIds.slice(offset, offset + 500)).is("deleted_at", null);
    if (result.error) throw new Error(`Unable to load worker contribution report: ${result.error.message}`);
    orderItems.data.push(...(result.data ?? []));
  }

  const configuredStageIds = new Set((stageInstances.data ?? [])
    .filter((stage) => "contribution_method_snapshot" in stage && stage.contribution_method_snapshot !== null)
    .map((stage) => stage.id));
  const stageInstanceById = new Map((stageInstances.data ?? []).map((stage) => [stage.id, stage]));
  const orderItemById = new Map((orderItems.data ?? []).map((item) => [item.id, item]));

  return {
    context,
    canViewContributionAmounts,
    logs: (workLogs.data ?? []).flatMap((log) => log.completed_at ? [{
      calculatedContributionAmount: canViewContributionAmounts && "calculated_contribution_amount" in log
        ? Number(log.calculated_contribution_amount ?? 0)
        : 0,
      completedAt: log.completed_at,
      creditedMinutes: log.credited_minutes ?? 0,
      creditedUnits: Number(log.credited_units ?? 0),
      effortMode: stageInstanceById.get(log.stage_instance_id)?.effort_tracking_mode_snapshot ?? "none",
      itemTypeId: orderItemById.get(log.order_item_id)?.item_type_id ?? "unknown",
      rateConfigured: configuredStageIds.has(log.stage_instance_id),
      stageId: stageInstanceById.get(log.stage_instance_id)?.stage_master_id ?? "unknown",
      stageInstanceId: log.stage_instance_id,
      workgroupId: log.workgroup_id,
      workerId: log.worker_id,
    }] : []),
    itemTypes: itemTypes.data ?? [],
    stages: stages.data ?? [],
    workgroups: workgroups.data ?? [],
    workers: workers.data ?? [],
  };
}
