import "server-only";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getFinancePageData() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "finance:view");

  const supabase = createSupabaseServiceRoleClient();

  const [expenses, receivablesPayables, expenseCategories, paymentModes, orderPayments, orders, salaryPayments] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .limit(30),
    supabase
      .from("receivables_payables")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from("expense_categories")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("payment_modes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("order_payments")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("payment_date", { ascending: false })
      .limit(50),
    supabase
      .from("orders")
      .select("id, order_number, reference_order_id, customer_id, order_date, total_amount, amount_paid, payment_status, promised_delivery_date")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("worker_ledger")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("transaction_type", "salary_paid")
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .limit(50)
  ]);

  for (const result of [expenses, receivablesPayables, expenseCategories, paymentModes, orderPayments, orders, salaryPayments]) {
    if (result.error) {
      throw new Error(`Unable to load finance data: ${result.error.message}`);
    }
  }

  return {
    context,
    expenses: expenses.data ?? [],
    receivablesPayables: receivablesPayables.data ?? [],
    expenseCategories: expenseCategories.data ?? [],
    paymentModes: paymentModes.data ?? [],
    orderPayments: orderPayments.data ?? [],
    orders: orders.data ?? [],
    salaryPayments: salaryPayments.data ?? []
  };
}
