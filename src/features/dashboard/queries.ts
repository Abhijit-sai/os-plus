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
