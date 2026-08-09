import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getDashboardPageData() {
  const context = await requireTenantContext();
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

export async function getWorkerContributionReportData({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  const [workLogs, stageInstances, workers] = await Promise.all([
    supabase
      .from("item_stage_work_logs")
      .select("id, stage_instance_id, worker_id, credited_units, credited_minutes, calculated_contribution_amount, completed_at")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("completed_at", `${startDate}T00:00:00.000Z`)
      .lt("completed_at", endExclusive.toISOString())
      .order("completed_at"),
    supabase
      .from("item_stage_instances")
      .select("id, contribution_method_snapshot")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .gte("completed_at", `${startDate}T00:00:00.000Z`)
      .lt("completed_at", endExclusive.toISOString()),
    supabase
      .from("workers")
      .select("id, name, status")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
  ]);

  for (const result of [workLogs, stageInstances, workers]) {
    if (result.error) throw new Error(`Unable to load worker contribution report: ${result.error.message}`);
  }

  const configuredStageIds = new Set((stageInstances.data ?? [])
    .filter((stage) => stage.contribution_method_snapshot !== null)
    .map((stage) => stage.id));

  return {
    context,
    logs: (workLogs.data ?? []).flatMap((log) => log.completed_at ? [{
      calculatedContributionAmount: Number(log.calculated_contribution_amount ?? 0),
      completedAt: log.completed_at,
      creditedMinutes: log.credited_minutes ?? 0,
      creditedUnits: Number(log.credited_units ?? 0),
      rateConfigured: configuredStageIds.has(log.stage_instance_id),
      stageInstanceId: log.stage_instance_id,
      workerId: log.worker_id,
    }] : []),
    workers: workers.data ?? [],
  };
}
