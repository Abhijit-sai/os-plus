"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type {
  Attendance,
  SalaryPeriod,
  Worker,
  WorkerLedger,
  WorkerLedgerTransactionType,
  Database
} from "@/types/database";

type SalaryCalculationInsert = Database["public"]["Tables"]["salary_calculations"]["Insert"];

const optionalText = z
  .preprocess((value) => (value === null || value === undefined ? "" : value), z.string())
  .transform((value) => value.trim())
  .transform((value) => (value.length ? value : null));

const ledgerTransactionTypeSchema = z.enum([
  "advance_given",
  "loan_given",
  "deduction",
  "repayment",
  "adjustment",
  "salary_paid"
]);

const createSalaryPeriodSchema = z.object({
  periodStart: z.string().min(1, "Period start is required."),
  periodEnd: z.string().min(1, "Period end is required.")
});

const generateSalarySuggestionsSchema = z.object({
  salaryPeriodId: z.string().uuid()
});

const finalizeSalaryCalculationSchema = z.object({
  salaryCalculationId: z.string().uuid(),
  finalizedPayableAmount: z.coerce.number().nonnegative("Final payable cannot be negative."),
  finalizationNote: optionalText
});

const recordSalaryPaymentSchema = z.object({
  salaryCalculationId: z.string().uuid(),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paymentDate: z.string().min(1, "Payment date is required."),
  paymentModeId: optionalText,
  description: optionalText
});

const addLedgerEntrySchema = z.object({
  workerId: z.string().uuid(),
  transactionType: ledgerTransactionTypeSchema,
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  transactionDate: z.string().min(1, "Transaction date is required."),
  linkedSalaryPeriodId: optionalText,
  description: optionalText
});

type SalaryInputBundle = {
  workers: Worker[];
  attendance: Attendance[];
  workLogs: Array<{
    worker_id: string;
    duration_minutes: number | null;
  }>;
  ledger: WorkerLedger[];
};

function salaryNoticeRedirect(message: string, type: "success" | "warning" = "warning", periodId?: string) {
  const params = new URLSearchParams({
    salaryNotice: message,
    salaryNoticeType: type
  });

  if (periodId) {
    params.set("periodId", periodId);
  }

  redirect(`/salary?${params.toString()}`);
}

async function getAuthorizedSalaryContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "salary:manage");
  return context;
}

function nextIsoDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function attendanceDayValue(attendance: Attendance) {
  if (attendance.status === "present") {
    return 1;
  }

  if (attendance.status === "half_day") {
    return 0.5;
  }

  return 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function paymentStatus(amountPaid: number, payableAmount: number) {
  if (amountPaid <= 0) {
    return "unpaid";
  }

  if (amountPaid >= payableAmount) {
    return "paid";
  }

  return "partially_paid";
}

function calculateGross(worker: Worker, attendanceDays: number, attendanceHours: number, productiveMinutes: number) {
  const productiveHours = productiveMinutes / 60;
  const effectiveHours = attendanceHours || productiveHours;

  switch (worker.wage_type) {
    case "hourly":
      return effectiveHours * worker.wage_amount;
    case "daily":
      return attendanceDays * worker.wage_amount;
    case "weekly":
      return (attendanceDays / 6) * worker.wage_amount;
    case "monthly":
      return (attendanceDays / 26) * worker.wage_amount;
    case "per_piece":
    case "hybrid":
      return 0;
    default:
      return 0;
  }
}

function buildCalculationRows(period: SalaryPeriod, inputs: SalaryInputBundle, actorId: string): SalaryCalculationInsert[] {
  return inputs.workers.map((worker) => {
    const workerAttendance = inputs.attendance.filter((record) => record.worker_id === worker.id);
    const workerLogs = inputs.workLogs.filter((record) => record.worker_id === worker.id);
    const workerLedger = inputs.ledger.filter((record) => record.worker_id === worker.id);

    const attendanceDays = workerAttendance.reduce((total, record) => total + attendanceDayValue(record), 0);
    const attendanceHours = workerAttendance.reduce((total, record) => total + (record.total_hours ?? 0), 0);
    const productiveMinutes = workerLogs.reduce((total, record) => total + (record.duration_minutes ?? 0), 0);
    const grossSuggestedAmount = roundMoney(calculateGross(worker, attendanceDays, attendanceHours, productiveMinutes));
    const advanceDeduction = roundMoney(
      workerLedger.filter((entry) => entry.transaction_type === "advance_given").reduce((total, entry) => total + entry.amount, 0)
    );
    const loanDeduction = roundMoney(
      workerLedger.filter((entry) => entry.transaction_type === "loan_given").reduce((total, entry) => total + entry.amount, 0)
    );
    const otherDeduction = roundMoney(
      workerLedger.filter((entry) => entry.transaction_type === "deduction").reduce((total, entry) => total + entry.amount, 0)
    );
    const repaymentCredit = roundMoney(
      workerLedger.filter((entry) => entry.transaction_type === "repayment").reduce((total, entry) => total + entry.amount, 0)
    );
    const manualAdjustment = roundMoney(
      workerLedger.filter((entry) => entry.transaction_type === "adjustment").reduce((total, entry) => total + entry.amount, 0)
    );
    const finalPayable = roundMoney(
      Math.max(0, grossSuggestedAmount - advanceDeduction - loanDeduction - otherDeduction + repaymentCredit + manualAdjustment)
    );

    return {
      tenant_id: period.tenant_id,
      salary_period_id: period.id,
      worker_id: worker.id,
      wage_type: worker.wage_type,
      wage_amount: worker.wage_amount,
      attendance_days: attendanceDays,
      attendance_hours: roundMoney(attendanceHours),
      productive_minutes: productiveMinutes,
      gross_suggested_amount: grossSuggestedAmount,
      advance_deduction: advanceDeduction,
      loan_deduction: loanDeduction,
      other_deduction: otherDeduction,
      repayment_credit: repaymentCredit,
      manual_adjustment: manualAdjustment,
      final_payable: finalPayable,
      amount_paid: 0,
      payment_status: "unpaid",
      notes:
        worker.wage_type === "per_piece" || worker.wage_type === "hybrid"
          ? "Per-piece and hybrid salary rules are schema-supported and need admin review in MVP."
          : null,
      created_by: actorId,
      updated_by: actorId
    };
  });
}

async function loadSalaryInputs(tenantId: string, period: SalaryPeriod): Promise<SalaryInputBundle> {
  const supabase = createSupabaseServiceRoleClient();
  const nextDay = nextIsoDate(period.period_end);

  const [workers, attendance, workLogs, ledger] = await Promise.all([
    supabase
      .from("workers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("attendance")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("attendance_date", period.period_start)
      .lte("attendance_date", period.period_end)
      .is("deleted_at", null),
    supabase
      .from("item_stage_work_logs")
      .select("worker_id, duration_minutes")
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .gte("completed_at", `${period.period_start}T00:00:00.000Z`)
      .lt("completed_at", `${nextDay}T00:00:00.000Z`)
      .is("deleted_at", null),
    supabase
      .from("worker_ledger")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("transaction_date", period.period_start)
      .lte("transaction_date", period.period_end)
      .is("deleted_at", null)
  ]);

  for (const result of [workers, attendance, workLogs, ledger]) {
    if (result.error) {
      throw new Error(`Unable to load salary inputs: ${result.error.message}`);
    }
  }

  return {
    workers: workers.data ?? [],
    attendance: attendance.data ?? [],
    workLogs: workLogs.data ?? [],
    ledger: ledger.data ?? []
  };
}

async function generateSalarySuggestions(tenantId: string, period: SalaryPeriod, actorId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const inputs = await loadSalaryInputs(tenantId, period);
  const rows = buildCalculationRows(period, inputs, actorId);

  const existing = await supabase
    .from("salary_calculations")
    .select("id, finalized_payable_amount, amount_paid")
    .eq("tenant_id", tenantId)
    .eq("salary_period_id", period.id)
    .is("deleted_at", null);

  if (existing.error) {
    throw new Error(`Unable to check existing salary suggestions: ${existing.error.message}`);
  }

  if (existing.data?.some((calculation) => calculation.finalized_payable_amount !== null || calculation.amount_paid > 0)) {
    salaryNoticeRedirect(
      "This period already has finalized or paid salary rows. Edit the existing period instead of regenerating it.",
      "warning",
      period.id
    );
  }

  if (existing.data?.length) {
    const { error } = await supabase
      .from("salary_calculations")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: actorId
      })
      .eq("tenant_id", tenantId)
      .eq("salary_period_id", period.id)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Unable to replace old salary suggestions: ${error.message}`);
    }
  }

  if (!rows.length) {
    return;
  }

  const { error } = await supabase.from("salary_calculations").insert(rows);

  if (error) {
    throw new Error(`Unable to generate salary suggestions: ${error.message}`);
  }
}

async function validateSalaryPeriod(tenantId: string, salaryPeriodId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("salary_periods")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", salaryPeriodId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate salary period: ${error.message}`);
  }

  if (!data) {
    throw new Error("Salary period does not belong to this tenant.");
  }

  return data;
}

async function validateSalaryCalculation(tenantId: string, salaryCalculationId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("salary_calculations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", salaryCalculationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate salary calculation: ${error.message}`);
  }

  if (!data) {
    throw new Error("Salary calculation does not belong to this tenant.");
  }

  return data;
}

async function validatePaymentMode(tenantId: string, paymentModeId: string | null) {
  if (!paymentModeId) {
    return null;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("payment_modes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", paymentModeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate payment mode: ${error.message}`);
  }

  if (!data) {
    throw new Error("Payment mode does not belong to this tenant.");
  }

  return data.id;
}

async function findOverlappingSalaryPeriod(tenantId: string, periodStart: string, periodEnd: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("salary_periods")
    .select("id, period_start, period_end")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .lte("period_start", periodEnd)
    .gte("period_end", periodStart)
    .limit(1);

  if (error) {
    throw new Error(`Unable to check salary period overlap: ${error.message}`);
  }

  return data?.[0] ?? null;
}

async function refreshSalaryPeriodStatus(tenantId: string, salaryPeriodId: string, actorId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("salary_calculations")
    .select("finalized_payable_amount, amount_paid, final_payable")
    .eq("tenant_id", tenantId)
    .eq("salary_period_id", salaryPeriodId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to refresh salary period status: ${error.message}`);
  }

  if (!data?.length) {
    return;
  }

  const allFinalized = data.every((calculation) => calculation.finalized_payable_amount !== null);
  const allPaid = data.every((calculation) => {
    const payable = calculation.finalized_payable_amount ?? calculation.final_payable;
    return calculation.amount_paid >= payable;
  });
  const nextStatus = allPaid ? "paid" : allFinalized ? "finalized" : "draft";

  const { error: updateError } = await supabase
    .from("salary_periods")
    .update({
      status: nextStatus,
      updated_by: actorId
    })
    .eq("tenant_id", tenantId)
    .eq("id", salaryPeriodId)
    .is("deleted_at", null);

  if (updateError) {
    throw new Error(`Unable to update salary period status: ${updateError.message}`);
  }
}

export async function createSalaryPeriodAction(formData: FormData) {
  const context = await getAuthorizedSalaryContext();
  const parsed = createSalaryPeriodSchema.parse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd")
  });

  if (parsed.periodEnd < parsed.periodStart) {
    salaryNoticeRedirect("Salary period end date cannot be before the start date.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const overlappingPeriod = await findOverlappingSalaryPeriod(context.tenant.id, parsed.periodStart, parsed.periodEnd);

  if (overlappingPeriod) {
    salaryNoticeRedirect(
      "This date range overlaps an existing salary period. Open that period or choose a different range.",
      "warning",
      overlappingPeriod.id
    );
  }

  const { data: period, error } = await supabase
    .from("salary_periods")
    .insert({
      tenant_id: context.tenant.id,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      status: "draft",
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Unable to create salary period: ${error.message}`);
  }

  await generateSalarySuggestions(context.tenant.id, period, context.membership.clerk_user_id);
  revalidatePath("/salary");
  salaryNoticeRedirect("Salary period created. Review the worker suggestions when you are ready.", "success", period.id);
}

export async function generateSalarySuggestionsAction(formData: FormData) {
  const context = await getAuthorizedSalaryContext();
  const parsed = generateSalarySuggestionsSchema.parse({
    salaryPeriodId: formData.get("salaryPeriodId")
  });
  const period = await validateSalaryPeriod(context.tenant.id, parsed.salaryPeriodId);

  if (period.status !== "draft") {
    throw new Error("Only draft salary periods can be regenerated.");
  }

  await generateSalarySuggestions(context.tenant.id, period, context.membership.clerk_user_id);
  revalidatePath("/salary");
}

export async function finalizeSalaryCalculationAction(formData: FormData) {
  const context = await getAuthorizedSalaryContext();
  const parsed = finalizeSalaryCalculationSchema.parse({
    salaryCalculationId: formData.get("salaryCalculationId"),
    finalizedPayableAmount: formData.get("finalizedPayableAmount"),
    finalizationNote: formData.get("finalizationNote")
  });
  const calculation = await validateSalaryCalculation(context.tenant.id, parsed.salaryCalculationId);
  const roundedFinalPayable = roundMoney(parsed.finalizedPayableAmount);
  const existingPaid = calculation.amount_paid ?? 0;
  const now = new Date().toISOString();
  const supabase = createSupabaseServiceRoleClient();

  const { error } = await supabase
    .from("salary_calculations")
    .update({
      finalized_payable_amount: roundedFinalPayable,
      finalized_at: now,
      finalized_by: context.membership.clerk_user_id,
      finalization_note: parsed.finalizationNote,
      payment_status: paymentStatus(existingPaid, roundedFinalPayable),
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", calculation.id)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to finalize salary: ${error.message}`);
  }

  await refreshSalaryPeriodStatus(context.tenant.id, calculation.salary_period_id, context.membership.clerk_user_id);
  revalidatePath("/salary");
}

export async function recordSalaryPaymentAction(formData: FormData) {
  const context = await getAuthorizedSalaryContext();
  const parsed = recordSalaryPaymentSchema.parse({
    salaryCalculationId: formData.get("salaryCalculationId"),
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate"),
    paymentModeId: formData.get("paymentModeId"),
    description: formData.get("description")
  });
  const calculation = await validateSalaryCalculation(context.tenant.id, parsed.salaryCalculationId);
  await validateSalaryPeriod(context.tenant.id, calculation.salary_period_id);
  const paymentModeId = await validatePaymentMode(context.tenant.id, parsed.paymentModeId);
  const roundedAmount = roundMoney(parsed.amount);
  const nextAmountPaid = roundMoney((calculation.amount_paid ?? 0) + roundedAmount);
  const payableAmount = calculation.finalized_payable_amount ?? calculation.final_payable;
  const supabase = createSupabaseServiceRoleClient();

  if (roundedAmount > Math.max(0, payableAmount - (calculation.amount_paid ?? 0))) {
    salaryNoticeRedirect(
      "This payment is higher than the salary due. Edit the payable amount first, then record the payment.",
      "warning",
      calculation.salary_period_id
    );
  }

  let duplicatePaymentQuery = supabase
    .from("worker_ledger")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("worker_id", calculation.worker_id)
    .eq("transaction_type", "salary_paid")
    .eq("amount", roundedAmount)
    .eq("transaction_date", parsed.paymentDate)
    .eq("linked_salary_period_id", calculation.salary_period_id)
    .is("deleted_at", null)
    .limit(1);

  duplicatePaymentQuery = paymentModeId
    ? duplicatePaymentQuery.eq("payment_mode_id", paymentModeId)
    : duplicatePaymentQuery.is("payment_mode_id", null);

  const duplicatePayment = await duplicatePaymentQuery;

  if (duplicatePayment.error) {
    throw new Error(`Unable to check duplicate salary payment: ${duplicatePayment.error.message}`);
  }

  if (duplicatePayment.data?.length) {
    revalidatePath("/salary");
    revalidatePath("/finance");
    salaryNoticeRedirect("This salary payment already appears to be recorded.", "success", calculation.salary_period_id);
    return;
  }

  const { error: ledgerError } = await supabase.from("worker_ledger").insert({
    tenant_id: context.tenant.id,
    worker_id: calculation.worker_id,
    transaction_type: "salary_paid",
    amount: roundedAmount,
    transaction_date: parsed.paymentDate,
    linked_salary_period_id: calculation.salary_period_id,
    payment_mode_id: paymentModeId,
    description: parsed.description,
    created_by: context.membership.clerk_user_id
  });

  if (ledgerError) {
    throw new Error(`Unable to record salary payment ledger entry: ${ledgerError.message}`);
  }

  const { error: calculationError } = await supabase
    .from("salary_calculations")
    .update({
      amount_paid: nextAmountPaid,
      payment_date: parsed.paymentDate,
      payment_mode_id: paymentModeId,
      payment_status: paymentStatus(nextAmountPaid, payableAmount),
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", calculation.id)
    .is("deleted_at", null);

  if (calculationError) {
    throw new Error(`Unable to update salary payment: ${calculationError.message}`);
  }

  await refreshSalaryPeriodStatus(context.tenant.id, calculation.salary_period_id, context.membership.clerk_user_id);
  revalidatePath("/salary");
  revalidatePath("/finance");
  salaryNoticeRedirect("Salary payment recorded and rolled into Finance.", "success", calculation.salary_period_id);
}

export async function addWorkerLedgerEntryAction(formData: FormData) {
  const context = await getAuthorizedSalaryContext();
  const parsed = addLedgerEntrySchema.parse({
    workerId: formData.get("workerId"),
    transactionType: formData.get("transactionType"),
    amount: formData.get("amount"),
    transactionDate: formData.get("transactionDate"),
    linkedSalaryPeriodId: formData.get("linkedSalaryPeriodId"),
    description: formData.get("description")
  });

  const supabase = createSupabaseServiceRoleClient();
  const worker = await supabase
    .from("workers")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.workerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (worker.error) {
    throw new Error(`Unable to validate worker: ${worker.error.message}`);
  }

  if (!worker.data) {
    throw new Error("Worker does not belong to this tenant.");
  }

  if (parsed.linkedSalaryPeriodId) {
    await validateSalaryPeriod(context.tenant.id, parsed.linkedSalaryPeriodId);
  }

  const { error } = await supabase.from("worker_ledger").insert({
    tenant_id: context.tenant.id,
    worker_id: parsed.workerId,
    transaction_type: parsed.transactionType as WorkerLedgerTransactionType,
    amount: parsed.amount,
    transaction_date: parsed.transactionDate,
    linked_salary_period_id: parsed.linkedSalaryPeriodId,
    description: parsed.description,
    created_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to add worker ledger entry: ${error.message}`);
  }

  revalidatePath("/salary");
}
