import "server-only";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

type FinancePageDataOptions = {
  gstEndDate?: string;
  gstStartDate?: string;
};

export async function getGstReportData({
  endDate,
  startDate
}: {
  endDate: string;
  startDate: string;
}) {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "finance:view");

  const supabase = createSupabaseServiceRoleClient();

  const [orders, expenses] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, reference_order_id, customer_id, order_date, subtotal, discount_amount, gst_treatment, gst_rate, taxable_amount, gst_amount, total_amount")
      .eq("tenant_id", context.tenant.id)
      .gte("order_date", startDate)
      .lte("order_date", endDate)
      .is("deleted_at", null)
      .order("order_date", { ascending: true }),
    supabase
      .from("expenses")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .is("deleted_at", null)
      .order("expense_date", { ascending: true })
  ]);

  for (const result of [orders, expenses]) {
    if (result.error) {
      throw new Error(`Unable to load GST report data: ${result.error.message}`);
    }
  }

  const customerIds = Array.from(new Set((orders.data ?? []).map((order) => order.customer_id)));
  const customers = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("tenant_id", context.tenant.id)
        .in("id", customerIds)
        .is("deleted_at", null)
    : { data: [], error: null };

  if (customers.error) {
    throw new Error(`Unable to load GST report customers: ${customers.error.message}`);
  }

  return {
    context,
    customers: customers.data ?? [],
    endDate,
    expenses: expenses.data ?? [],
    orders: orders.data ?? [],
    startDate
  };
}

export async function getFinancePageData(options: FinancePageDataOptions = {}) {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "finance:view");

  const supabase = createSupabaseServiceRoleClient();

  const [expenses, receivablesPayables, expenseCategories, paymentModes, orderPayments, orders, salaryPayments, gstReport] = await Promise.all([
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
      .select("id, order_number, reference_order_id, customer_id, order_date, gst_treatment, gst_rate, taxable_amount, gst_amount, total_amount, amount_paid, payment_status, promised_delivery_date")
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
      .limit(50),
    options.gstStartDate && options.gstEndDate
      ? getGstReportData({
          endDate: options.gstEndDate,
          startDate: options.gstStartDate
        })
      : Promise.resolve(null)
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
    salaryPayments: salaryPayments.data ?? [],
    gstReport
  };
}
