"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { PaymentStatus, ReceivablePayableStatus, ReceivablePayableType } from "@/types/database";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const receivablePayableTypeSchema = z.enum(["receivable", "payable"]);

const createExpenseSchema = z.object({
  expenseDate: z.string().min(1, "Expense date is required."),
  categoryId: optionalText,
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  paymentModeId: optionalText,
  paidTo: optionalText,
  description: optionalText,
  receiptUrl: optionalText
});

const receivablePayableFieldsSchema = z.object({
  type: receivablePayableTypeSchema,
  partyName: z.string().trim().min(1, "Party name is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  amountSettled: z.coerce.number().min(0, "Settled amount cannot be negative."),
  dueDate: optionalText,
  settledAt: optionalText,
  description: optionalText
});

function validateSettlementAmount(value: { amount: number; amountSettled: number }, context: z.RefinementCtx) {
  if (value.amountSettled > value.amount) {
    context.addIssue({
      code: "custom",
      message: "Settled amount cannot exceed the original amount.",
      path: ["amountSettled"]
    });
  }
}

const createReceivablePayableSchema = receivablePayableFieldsSchema.superRefine(validateSettlementAmount);

const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: z.string().uuid()
});

const updateReceivablePayableSchema = receivablePayableFieldsSchema.extend({
  entryId: z.string().uuid()
}).superRefine(validateSettlementAmount);

const updateOrderPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  paymentModeId: optionalText,
  paymentDate: z.string().min(1, "Payment date is required."),
  referenceNumber: optionalText,
  notes: optionalText
});

function getDerivedDueStatus({
  amount,
  amountSettled,
  dueDate
}: {
  amount: number;
  amountSettled: number;
  dueDate: string | null;
}): ReceivablePayableStatus {
  if (amountSettled >= amount) {
    return "paid";
  }

  if (amountSettled > 0) {
    return "partially_paid";
  }

  if (dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`);

    if (due.getTime() < today.getTime()) {
      return "overdue";
    }
  }

  return "open";
}

async function getAuthorizedFinanceContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "finance:manage");
  return context;
}

async function validateOptionalTenantRecord(table: "expense_categories" | "payment_modes", tenantId: string, id: string | null) {
  if (!id) {
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from(table).select("id").eq("tenant_id", tenantId).eq("id", id).is("deleted_at", null).maybeSingle();

  if (error) {
    throw new Error(`Unable to validate selected record: ${error.message}`);
  }

  if (!data) {
    throw new Error("Selected record does not belong to this tenant.");
  }
}

function getPaymentStatus(totalAmount: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) {
    return "unpaid";
  }

  if (amountPaid >= totalAmount) {
    return "paid";
  }

  return "partially_paid";
}

async function updateOrderPaymentSummary(tenantId: string, orderId: string, totalAmount: number, actorId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("order_payments")
    .select("amount")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to total order payments: ${error.message}`);
  }

  const amountPaid = Math.min((data ?? []).reduce((total, payment) => total + payment.amount, 0), totalAmount);
  const paymentStatus = getPaymentStatus(totalAmount, amountPaid);
  const update = await supabase
    .from("orders")
    .update({
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      updated_by: actorId
    })
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  if (update.error) {
    throw new Error(`Unable to update order payment summary: ${update.error.message}`);
  }
}

export async function createExpenseAction(formData: FormData) {
  const context = await getAuthorizedFinanceContext();
  const parsed = createExpenseSchema.parse({
    expenseDate: formData.get("expenseDate"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    paymentModeId: formData.get("paymentModeId"),
    paidTo: formData.get("paidTo"),
    description: formData.get("description"),
    receiptUrl: formData.get("receiptUrl")
  });

  await validateOptionalTenantRecord("expense_categories", context.tenant.id, parsed.categoryId);
  await validateOptionalTenantRecord("payment_modes", context.tenant.id, parsed.paymentModeId);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("expenses").insert({
    tenant_id: context.tenant.id,
    expense_date: parsed.expenseDate,
    category_id: parsed.categoryId,
    amount: parsed.amount,
    payment_mode_id: parsed.paymentModeId,
    paid_to: parsed.paidTo,
    description: parsed.description,
    receipt_url: parsed.receiptUrl,
    is_recurring: false,
    created_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to create expense: ${error.message}`);
  }

  revalidatePath("/finance");
}

export async function createReceivablePayableAction(formData: FormData) {
  const context = await getAuthorizedFinanceContext();
  const parsed = createReceivablePayableSchema.parse({
    type: formData.get("type"),
    partyName: formData.get("partyName"),
    amount: formData.get("amount"),
    amountSettled: formData.get("amountSettled") || 0,
    dueDate: formData.get("dueDate"),
    settledAt: formData.get("settledAt"),
    description: formData.get("description")
  });
  const status = getDerivedDueStatus({
    amount: parsed.amount,
    amountSettled: parsed.amountSettled,
    dueDate: parsed.dueDate
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("receivables_payables").insert({
    tenant_id: context.tenant.id,
    type: parsed.type as ReceivablePayableType,
    party_name: parsed.partyName,
    amount: parsed.amount,
    amount_settled: parsed.amountSettled,
    due_date: parsed.dueDate,
    settled_at: parsed.amountSettled > 0 ? parsed.settledAt ?? new Date().toISOString().slice(0, 10) : null,
    status,
    linked_order_id: null,
    description: parsed.description,
    created_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to create receivable/payable: ${error.message}`);
  }

  revalidatePath("/finance");
}

export async function updateExpenseAction(formData: FormData) {
  const context = await getAuthorizedFinanceContext();
  const parsed = updateExpenseSchema.parse({
    expenseId: formData.get("expenseId"),
    expenseDate: formData.get("expenseDate"),
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    paymentModeId: formData.get("paymentModeId"),
    paidTo: formData.get("paidTo"),
    description: formData.get("description"),
    receiptUrl: formData.get("receiptUrl")
  });

  await validateOptionalTenantRecord("expense_categories", context.tenant.id, parsed.categoryId);
  await validateOptionalTenantRecord("payment_modes", context.tenant.id, parsed.paymentModeId);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      expense_date: parsed.expenseDate,
      category_id: parsed.categoryId,
      amount: parsed.amount,
      payment_mode_id: parsed.paymentModeId,
      paid_to: parsed.paidTo,
      description: parsed.description,
      receipt_url: parsed.receiptUrl,
      is_recurring: false
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.expenseId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to update expense: ${error.message}`);
  }

  revalidatePath("/finance");
}

export async function updateReceivablePayableAction(formData: FormData) {
  const context = await getAuthorizedFinanceContext();
  const parsed = updateReceivablePayableSchema.parse({
    entryId: formData.get("entryId"),
    type: formData.get("type"),
    partyName: formData.get("partyName"),
    amount: formData.get("amount"),
    amountSettled: formData.get("amountSettled") || 0,
    dueDate: formData.get("dueDate"),
    settledAt: formData.get("settledAt"),
    description: formData.get("description")
  });
  const status = getDerivedDueStatus({
    amount: parsed.amount,
    amountSettled: parsed.amountSettled,
    dueDate: parsed.dueDate
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("receivables_payables")
    .update({
      type: parsed.type as ReceivablePayableType,
      party_name: parsed.partyName,
      amount: parsed.amount,
      amount_settled: parsed.amountSettled,
      due_date: parsed.dueDate,
      settled_at: parsed.amountSettled > 0 ? parsed.settledAt ?? new Date().toISOString().slice(0, 10) : null,
      status,
      linked_order_id: null,
      description: parsed.description
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.entryId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to update receivable/payable: ${error.message}`);
  }

  revalidatePath("/finance");
}

export async function updateOrderPaymentAction(formData: FormData) {
  const context = await getAuthorizedFinanceContext();
  const parsed = updateOrderPaymentSchema.parse({
    paymentId: formData.get("paymentId"),
    amount: formData.get("amount"),
    paymentModeId: formData.get("paymentModeId"),
    paymentDate: formData.get("paymentDate"),
    referenceNumber: formData.get("referenceNumber"),
    notes: formData.get("notes")
  });
  const supabase = createSupabaseServiceRoleClient();
  const payment = await supabase
    .from("order_payments")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.paymentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (payment.error) {
    throw new Error(`Unable to load payment: ${payment.error.message}`);
  }

  if (!payment.data) {
    throw new Error("Payment does not belong to this tenant.");
  }

  const order = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("tenant_id", context.tenant.id)
    .eq("id", payment.data.order_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (order.error) {
    throw new Error(`Unable to load order: ${order.error.message}`);
  }

  if (!order.data) {
    throw new Error("Linked order does not belong to this tenant.");
  }

  await validateOptionalTenantRecord("payment_modes", context.tenant.id, parsed.paymentModeId);

  const otherPayments = await supabase
    .from("order_payments")
    .select("amount")
    .eq("tenant_id", context.tenant.id)
    .eq("order_id", order.data.id)
    .neq("id", payment.data.id)
    .is("deleted_at", null);

  if (otherPayments.error) {
    throw new Error(`Unable to validate payment total: ${otherPayments.error.message}`);
  }

  const otherTotal = (otherPayments.data ?? []).reduce((total, row) => total + row.amount, 0);

  if (otherTotal + parsed.amount > order.data.total_amount) {
    throw new Error(`Payment edit would exceed order total. Remaining editable amount is ${Math.max(order.data.total_amount - otherTotal, 0)}.`);
  }

  const update = await supabase
    .from("order_payments")
    .update({
      amount: parsed.amount,
      payment_mode_id: parsed.paymentModeId,
      payment_date: parsed.paymentDate,
      reference_number: parsed.referenceNumber,
      notes: parsed.notes
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.paymentId);

  if (update.error) {
    throw new Error(`Unable to update order payment: ${update.error.message}`);
  }

  await updateOrderPaymentSummary(context.tenant.id, order.data.id, order.data.total_amount, context.membership.clerk_user_id);

  revalidatePath("/finance");
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.data.id}`);
}
