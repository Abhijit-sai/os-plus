"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { calculateWorkerLedgerSalaryEffect } from "@/features/salary/worker-money";
import type {
  Attendance,
  SalaryPeriod,
  Worker,
  WorkerLedger,
  Database
} from "@/types/database";

type SalaryCalculationInsert = Database["public"]["Tables"]["salary_calculations"]["Insert"];

const optionalText = z
  .preprocess((value) => (value === null || value === undefined ? "" : value), z.string())
  .transform((value) => value.trim())
  .transform((value) => (value.length ? value : null));

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.string().uuid().nullable(),
);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");

export type WorkerMoneyActionState = {
  idempotencyKey?: string | null;
  message: string | null;
  ok: boolean;
};

export type SalaryWorkflowActionState = WorkerMoneyActionState & {
  processedCount?: number | null;
  preview?: {
    attendanceEntryCount: number;
    attendanceWorkerCount: number;
    missingAttendanceWorkerCount: number;
    suggestedPayable: number;
    workerCount: number;
    fingerprint: string;
  } | null;
  periodId?: string | null;
  workerId?: string | null;
};

const workerMoneyEntryTypeSchema = z.enum([
  "advance_given",
  "loan_given",
  "deduction",
  "repayment",
  "adjustment"
]);

const createSalaryPeriodSchema = z.object({
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  idempotencyKey: z.string().uuid(),
});

const createSalaryPeriodIntentSchema = z.enum(["preview", "create"]);
const previewFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/).optional();

const updateSalaryPeriodSchema = createSalaryPeriodSchema.extend({
  salaryPeriodId: z.string().uuid(),
});

const generateSalarySuggestionsSchema = z.object({
  salaryPeriodId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

const finalizeSalaryCalculationSchema = z.object({
  salaryCalculationId: z.string().uuid(),
  finalizedPayableAmount: z.coerce.number().nonnegative("Final payable cannot be negative."),
  finalizationNote: optionalText,
  idempotencyKey: z.string().uuid(),
});

const recordSalaryPaymentSchema = z.object({
  salaryCalculationId: z.string().uuid(),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paymentDate: isoDateSchema,
  paymentModeId: z.string().uuid("Select a payment mode."),
  idempotencyKey: z.string().uuid(),
  description: optionalText
});

const serializedRows = <T extends z.ZodTypeAny>(rowSchema: T) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      return JSON.parse(value);
    },
    z.array(rowSchema).min(1, "Select at least one worker."),
  );

const bulkFinalizeSalarySchema = z.object({
  salaryPeriodId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  rows: serializedRows(
    z.object({
      calculationId: z.string().uuid(),
      expectedUpdatedAt: z.string().datetime({ offset: true }),
      finalizedPayableAmount: z.coerce.number().nonnegative("Final payable cannot be negative."),
      finalizationNote: z.string().trim().nullable(),
    }),
  ),
});

const bulkSalaryPaymentSchema = z.object({
  salaryPeriodId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  paymentDate: isoDateSchema,
  paymentModeId: z.string().uuid("Select a payment mode."),
  description: optionalText,
  rows: serializedRows(
    z.object({
      calculationId: z.string().uuid(),
      expectedUpdatedAt: z.string().datetime({ offset: true }),
      amount: z.coerce.number().positive("Payment amount must be greater than zero."),
    }),
  ),
});

const addLedgerEntrySchema = z.object({
  workerId: z.string().uuid(),
  transactionType: workerMoneyEntryTypeSchema,
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  transactionDate: isoDateSchema,
  balanceAccount: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.enum(["advance", "loan"]).nullable(),
  ),
  paymentModeId: optionalUuid,
  idempotencyKey: z.string().uuid(),
  description: optionalText
});

const correctWorkerMoneyEntrySchema = z.object({
  entryId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  transactionDate: isoDateSchema,
  balanceAccount: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.enum(["advance", "loan"]).nullable(),
  ),
  paymentModeId: optionalUuid,
  description: optionalText,
  correctionReason: z.string().trim().min(3, "Explain why this entry is being corrected."),
  idempotencyKey: z.string().uuid(),
  returnTo: z.enum(["finance", "salary"]),
});

const reverseWorkerMoneyEntrySchema = z.object({
  entryId: z.string().uuid(),
  correctionReason: z.string().trim().min(3, "Explain why this entry is being reversed."),
  returnTo: z.enum(["finance", "salary"]),
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

async function getAuthorizedSalaryContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "workers:view");
  assertPermission(context.membership.role, "salary:view");
  assertPermission(context.membership.role, "salary:manage");
  return context;
}

function workerMoneyErrorMessage(message: string) {
  if (message.includes("SALARY_BULK_STALE_ROW")) return "A selected worker changed after this period was opened. Refresh the period and review the latest values before saving.";
  if (message.includes("SALARY_BULK_DUPLICATE_CALCULATION")) return "A worker was selected more than once. Refresh the period and try again.";
  if (message.includes("SALARY_BULK_ROWS_EMPTY")) return "Select at least one worker.";
  if (message.includes("WORKER_MONEY_IDEMPOTENCY_CONFLICT")) return "This retry no longer matches the original worker-money request. Refresh and submit the edited change again.";
  if (message.includes("WORKER_MONEY_PAYMENT_MODE_REQUIRED")) return "Select a payment mode for this cash movement.";
  if (message.includes("WORKER_MONEY_PAYMENT_MODE_INVALID")) return "The selected payment mode is unavailable for this business.";
  if (message.includes("WORKER_MONEY_BALANCE_ACCOUNT_REQUIRED")) return "Choose whether this reduces the advance or loan balance.";
  if (message.includes("WORKER_MONEY_BALANCE_EXCEEDED")) return "This amount is greater than the selected worker balance.";
  if (message.includes("WORKER_MONEY_SALARY_OVERPAY")) return "This payment is higher than the remaining finalized salary due.";
  if (message.includes("WORKER_MONEY_SALARY_NOT_FINALIZED")) return "Finalize this worker's salary before recording payment.";
  if (message.includes("WORKER_MONEY_SALARY_CALCULATION_INVALID")) return "The salary calculation is unavailable for this worker and period.";
  if (message.includes("WORKER_MONEY_WORKER_INVALID")) return "The worker is unavailable or belongs to another business.";
  if (message.includes("WORKER_MONEY_ENTRY_INVALID")) return "This ledger entry is unavailable, already corrected, or belongs to another business.";
  return "Unable to save this worker-money change. Review the fields and try again.";
}

function workerMoneyActionError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Review the entered worker-money details.";
  }

  return workerMoneyErrorMessage(
    error instanceof Error && error.message.trim()
      ? error.message
      : "Unable to save this worker-money change. Review the fields and try again.",
  );
}

function salaryWorkflowErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Review the salary details and try again.";
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("SALARY_PERIOD_OVERLAP")) {
    return "This date range overlaps an existing salary period. Open that period or choose a different range.";
  }
  if (message.includes("SALARY_PERIOD_RANGE_INVALID")) {
    return "Salary period end date cannot be before the start date.";
  }
  if (message.includes("SALARY_PERIOD_NOT_DRAFT") || message.includes("SALARY_PERIOD_HAS_DECISIONS")) {
    return "This period already has finalized or paid salary rows. Edit the existing decisions instead of regenerating them.";
  }
  if (message.includes("SALARY_PAYABLE_BELOW_PAID")) {
    return "Final payable cannot be lower than the amount already paid. Correct or reverse the payment first.";
  }
  if (message.includes("SALARY_FINALIZATION_NOTE_REQUIRED")) {
    return "Add a decision note when the final payable differs from the system suggestion.";
  }
  if (message.includes("SALARY_CALCULATIONS_WORKER_INVALID")) {
    return "A worker changed while suggestions were being prepared. Refresh and regenerate the period.";
  }
  if (message.includes("SALARY_CALCULATIONS_INCOMPLETE")) {
    return "The active worker list changed while suggestions were being prepared. Refresh and try again.";
  }
  if (message.includes("SALARY_WORKFLOW_IDEMPOTENCY_CONFLICT")) {
    return "This saved request no longer matches the current salary change. Refresh and try again.";
  }
  if (message.includes("SALARY_CALCULATIONS_EMPTY")) {
    return "Add or reactivate at least one worker before creating a salary period.";
  }
  if (message.includes("SALARY_BULK_STALE_ROW")) {
    return "A selected worker changed after this period was opened. Refresh the period and review the latest values before saving.";
  }
  if (message.includes("SALARY_BULK_DUPLICATE_CALCULATION")) {
    return "A worker was selected more than once. Refresh the period and try again.";
  }
  if (message.includes("SALARY_BULK_ROWS_EMPTY")) {
    return "Select at least one worker.";
  }

  return "Unable to save the salary change. Review the details and try again.";
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

function buildCalculationRows(
  period: Pick<SalaryPeriod, "id" | "tenant_id">,
  inputs: SalaryInputBundle,
  actorId: string,
): SalaryCalculationInsert[] {
  return inputs.workers.map((worker) => {
    const workerAttendance = inputs.attendance.filter((record) => record.worker_id === worker.id);
    const workerLogs = inputs.workLogs.filter((record) => record.worker_id === worker.id);
    const workerLedger = inputs.ledger.filter((record) => record.worker_id === worker.id);

    const attendanceDays = workerAttendance.reduce((total, record) => total + attendanceDayValue(record), 0);
    const attendanceHours = workerAttendance.reduce((total, record) => total + (record.total_hours ?? 0), 0);
    const productiveMinutes = workerLogs.reduce((total, record) => total + (record.duration_minutes ?? 0), 0);
    const grossSuggestedAmount = roundMoney(calculateGross(worker, attendanceDays, attendanceHours, productiveMinutes));
    const advanceDeduction = roundMoney(
      workerLedger
        .filter(
          (entry) =>
            entry.transaction_type === "deduction" &&
            entry.balance_account === "advance",
        )
        .reduce((total, entry) => total + entry.amount, 0),
    );
    const loanDeduction = roundMoney(
      workerLedger
        .filter(
          (entry) =>
            entry.transaction_type === "deduction" &&
            entry.balance_account === "loan",
        )
        .reduce((total, entry) => total + entry.amount, 0),
    );
    const otherDeduction = roundMoney(
      workerLedger
        .filter(
          (entry) =>
            entry.transaction_type === "deduction" &&
            !entry.balance_account,
        )
        .reduce((total, entry) => total + entry.amount, 0),
    );
    const repaymentCredit = 0;
    const salaryEffect = calculateWorkerLedgerSalaryEffect(workerLedger);
    const manualAdjustment = salaryEffect.credit;
    const finalPayable = roundMoney(
      Math.max(0, grossSuggestedAmount + salaryEffect.net)
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

async function loadSalaryInputs(
  tenantId: string,
  period: Pick<SalaryPeriod, "period_end" | "period_start">,
): Promise<SalaryInputBundle> {
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
      .is("reversed_at", null)
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

function calculationPayload(rows: SalaryCalculationInsert[]) {
  return rows.map((row) => ({
    advance_deduction: row.advance_deduction ?? 0,
    attendance_days: row.attendance_days ?? 0,
    attendance_hours: row.attendance_hours ?? 0,
    final_payable: row.final_payable ?? 0,
    gross_suggested_amount: row.gross_suggested_amount ?? 0,
    loan_deduction: row.loan_deduction ?? 0,
    manual_adjustment: row.manual_adjustment ?? 0,
    notes: row.notes ?? null,
    other_deduction: row.other_deduction ?? 0,
    productive_minutes: row.productive_minutes ?? 0,
    repayment_credit: row.repayment_credit ?? 0,
    wage_amount: row.wage_amount ?? 0,
    wage_type: row.wage_type,
    worker_id: row.worker_id,
  }));
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

function salaryWorkflowFingerprint(value: string) {
  return createHash("md5").update(value).digest("hex");
}

async function getSalaryWorkflowResult({
  fingerprint,
  idempotencyKey,
  operationType,
  targetKey,
  tenantId,
}: {
  fingerprint: string;
  idempotencyKey: string;
  operationType: "create_period" | "update_period" | "regenerate_period" | "finalize_calculation";
  targetKey: string;
  tenantId: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("get_salary_workflow_result", {
    p_idempotency_key: idempotencyKey,
    p_operation_type: operationType,
    p_request_fingerprint: fingerprint,
    p_target_key: targetKey,
    p_tenant_id: tenantId,
  });
  if (error) throw new Error(error.message);
  return typeof data === "object" && data && !Array.isArray(data) ? data : null;
}

export async function createSalaryPeriodAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = createSalaryPeriodSchema.parse({
      periodStart: formData.get("periodStart"),
      periodEnd: formData.get("periodEnd"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    const intent = createSalaryPeriodIntentSchema.parse(formData.get("intent"));
    const submittedPreviewFingerprint = previewFingerprintSchema.parse(
      formData.get("previewFingerprint") || undefined,
    );

    if (parsed.periodEnd < parsed.periodStart) {
      return { idempotencyKey: retryKey, message: "Salary period end date cannot be before the start date.", ok: false };
    }

    if (intent === "create") {
      const priorResult = await getSalaryWorkflowResult({
        fingerprint: salaryWorkflowFingerprint(`create_period:${parsed.periodStart}:${parsed.periodEnd}`),
        idempotencyKey: parsed.idempotencyKey,
        operationType: "create_period",
        targetKey: `${parsed.periodStart}:${parsed.periodEnd}`,
        tenantId: context.tenant.id,
      });
      const priorPeriodId = priorResult ? String(priorResult.periodId ?? "") : "";
      if (z.string().uuid().safeParse(priorPeriodId).success) {
        revalidatePath("/salary");
        return { idempotencyKey: crypto.randomUUID(), message: "Salary period created. Review each worker suggestion before confirming payable amounts.", ok: true, periodId: priorPeriodId };
      }
    }

    const overlappingPeriod = await findOverlappingSalaryPeriod(
      context.tenant.id,
      parsed.periodStart,
      parsed.periodEnd,
    );
    if (overlappingPeriod) {
      return {
        idempotencyKey: retryKey,
        message: "This date range overlaps an existing salary period. Open that period or choose a different range.",
        ok: false,
        periodId: overlappingPeriod.id,
      };
    }

    const periodInput = {
      id: crypto.randomUUID(),
      period_end: parsed.periodEnd,
      period_start: parsed.periodStart,
      tenant_id: context.tenant.id,
    };
    const inputs = await loadSalaryInputs(context.tenant.id, periodInput);
    const rows = buildCalculationRows(periodInput, inputs, context.membership.clerk_user_id);
    const payload = calculationPayload(rows).sort((a, b) => a.worker_id.localeCompare(b.worker_id));
    const attendanceWorkerCount = new Set(inputs.attendance.map((record) => record.worker_id)).size;
    const preview = {
      attendanceEntryCount: inputs.attendance.length,
      attendanceWorkerCount,
      missingAttendanceWorkerCount: Math.max(0, inputs.workers.length - attendanceWorkerCount),
      suggestedPayable: roundMoney(rows.reduce((total, row) => total + (row.final_payable ?? 0), 0)),
      workerCount: rows.length,
      fingerprint: "",
    };
    const previewFingerprint = createHash("sha256")
      .update(JSON.stringify({
        attendance: inputs.attendance
          .map((record) => ({
            attendanceDate: record.attendance_date,
            status: record.status,
            totalHours: record.total_hours ?? 0,
            workerId: record.worker_id,
          }))
          .sort((a, b) => a.workerId.localeCompare(b.workerId) || a.attendanceDate.localeCompare(b.attendanceDate) || a.status.localeCompare(b.status)),
        periodEnd: parsed.periodEnd,
        periodStart: parsed.periodStart,
        rows: payload,
        summary: {
          attendanceEntryCount: preview.attendanceEntryCount,
          attendanceWorkerCount: preview.attendanceWorkerCount,
          missingAttendanceWorkerCount: preview.missingAttendanceWorkerCount,
          suggestedPayable: preview.suggestedPayable,
          workerCount: preview.workerCount,
        },
      }))
      .digest("hex");
    preview.fingerprint = previewFingerprint;
    if (intent === "preview") {
      return {
        idempotencyKey: retryKey,
        message: "Preview ready. Review the coverage summary, then confirm creation.",
        ok: true,
        preview,
      };
    }
    if (!submittedPreviewFingerprint || submittedPreviewFingerprint !== previewFingerprint) {
      return {
        idempotencyKey: retryKey,
        message: "Salary inputs changed after the preview. Review the refreshed coverage and confirm again.",
        ok: false,
        preview,
      };
    }
    const supabase = createSupabaseServiceRoleClient();
    const { data, error } = await supabase.rpc("create_salary_period_with_calculations", {
      p_actor_id: context.membership.clerk_user_id,
      p_calculations: payload,
      p_idempotency_key: parsed.idempotencyKey,
      p_period_end: parsed.periodEnd,
      p_period_start: parsed.periodStart,
      p_tenant_id: context.tenant.id,
    });
    if (error) throw new Error(error.message);

    const periodId = typeof data === "object" && data && !Array.isArray(data)
      ? String(data.periodId ?? "")
      : "";
    if (!z.string().uuid().safeParse(periodId).success) {
      throw new Error("Salary period was created, but its result could not be confirmed.");
    }

    revalidatePath("/salary");
    return {
      idempotencyKey: crypto.randomUUID(),
      message: "Salary period created. Review each worker suggestion before confirming payable amounts.",
      ok: true,
      periodId,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: salaryWorkflowErrorMessage(error), ok: false };
  }
}

export async function generateSalarySuggestionsAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = generateSalarySuggestionsSchema.parse({
      salaryPeriodId: formData.get("salaryPeriodId"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    const priorResult = await getSalaryWorkflowResult({
      fingerprint: salaryWorkflowFingerprint(`regenerate_period:${parsed.salaryPeriodId}`),
      idempotencyKey: parsed.idempotencyKey,
      operationType: "regenerate_period",
      targetKey: parsed.salaryPeriodId,
      tenantId: context.tenant.id,
    });
    if (priorResult) {
      revalidatePath("/salary");
      return { idempotencyKey: crypto.randomUUID(), message: "Draft suggestions regenerated from the latest attendance and worker-money entries.", ok: true, periodId: parsed.salaryPeriodId };
    }
    const period = await validateSalaryPeriod(context.tenant.id, parsed.salaryPeriodId);
    const inputs = await loadSalaryInputs(context.tenant.id, period);
    const rows = buildCalculationRows(period, inputs, context.membership.clerk_user_id);
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("regenerate_salary_period_calculations", {
      p_actor_id: context.membership.clerk_user_id,
      p_calculations: calculationPayload(rows),
      p_idempotency_key: parsed.idempotencyKey,
      p_salary_period_id: period.id,
      p_tenant_id: context.tenant.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    return {
      idempotencyKey: crypto.randomUUID(),
      message: "Draft suggestions regenerated from the latest attendance and worker-money entries.",
      ok: true,
      periodId: period.id,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: salaryWorkflowErrorMessage(error), ok: false };
  }
}

export async function updateSalaryPeriodAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = updateSalaryPeriodSchema.parse({
      salaryPeriodId: formData.get("salaryPeriodId"),
      periodStart: formData.get("periodStart"),
      periodEnd: formData.get("periodEnd"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    if (parsed.periodEnd < parsed.periodStart) {
      return { idempotencyKey: retryKey, message: "Salary period end date cannot be before the start date.", ok: false };
    }

    const priorResult = await getSalaryWorkflowResult({
      fingerprint: salaryWorkflowFingerprint(`update_period:${parsed.salaryPeriodId}:${parsed.periodStart}:${parsed.periodEnd}`),
      idempotencyKey: parsed.idempotencyKey,
      operationType: "update_period",
      targetKey: parsed.salaryPeriodId,
      tenantId: context.tenant.id,
    });
    if (priorResult) {
      revalidatePath("/salary");
      return { idempotencyKey: crypto.randomUUID(), message: "Period dates and draft suggestions updated together.", ok: true, periodId: parsed.salaryPeriodId };
    }

    const period = await validateSalaryPeriod(context.tenant.id, parsed.salaryPeriodId);
    const proposedPeriod = {
      id: period.id,
      period_end: parsed.periodEnd,
      period_start: parsed.periodStart,
      tenant_id: context.tenant.id,
    };
    const inputs = await loadSalaryInputs(context.tenant.id, proposedPeriod);
    const rows = buildCalculationRows(proposedPeriod, inputs, context.membership.clerk_user_id);
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("update_salary_period_with_calculations", {
      p_actor_id: context.membership.clerk_user_id,
      p_calculations: calculationPayload(rows),
      p_idempotency_key: parsed.idempotencyKey,
      p_period_end: parsed.periodEnd,
      p_period_start: parsed.periodStart,
      p_salary_period_id: period.id,
      p_tenant_id: context.tenant.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    return {
      idempotencyKey: crypto.randomUUID(),
      message: "Period dates and draft suggestions updated together.",
      ok: true,
      periodId: period.id,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: salaryWorkflowErrorMessage(error), ok: false };
  }
}

export async function finalizeSalaryCalculationAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = finalizeSalaryCalculationSchema.parse({
      salaryCalculationId: formData.get("salaryCalculationId"),
      finalizedPayableAmount: formData.get("finalizedPayableAmount"),
      finalizationNote: formData.get("finalizationNote"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    const finalizedAmount = roundMoney(parsed.finalizedPayableAmount);
    const priorResult = await getSalaryWorkflowResult({
      fingerprint: salaryWorkflowFingerprint(`finalize_calculation:${parsed.salaryCalculationId}:${finalizedAmount}:${parsed.finalizationNote ?? ""}`),
      idempotencyKey: parsed.idempotencyKey,
      operationType: "finalize_calculation",
      targetKey: parsed.salaryCalculationId,
      tenantId: context.tenant.id,
    });
    if (priorResult) {
      revalidatePath("/salary");
      return {
        idempotencyKey: crypto.randomUUID(),
        message: "Payable saved. Payment recording is now available for this worker.",
        ok: true,
        periodId: String(priorResult.periodId ?? ""),
        workerId: String(priorResult.workerId ?? ""),
      };
    }
    const calculation = await validateSalaryCalculation(context.tenant.id, parsed.salaryCalculationId);
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("finalize_salary_calculation", {
      p_actor_id: context.membership.clerk_user_id,
      p_finalization_note: parsed.finalizationNote,
      p_finalized_payable_amount: finalizedAmount,
      p_idempotency_key: parsed.idempotencyKey,
      p_salary_calculation_id: calculation.id,
      p_tenant_id: context.tenant.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    return {
      idempotencyKey: crypto.randomUUID(),
      message: "Payable saved. Payment recording is now available for this worker.",
      ok: true,
      periodId: calculation.salary_period_id,
      workerId: calculation.worker_id,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: salaryWorkflowErrorMessage(error), ok: false };
  }
}

export async function recordSalaryPaymentAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = recordSalaryPaymentSchema.parse({
      salaryCalculationId: formData.get("salaryCalculationId"),
      amount: formData.get("amount"),
      paymentDate: formData.get("paymentDate"),
      paymentModeId: formData.get("paymentModeId"),
      idempotencyKey: formData.get("idempotencyKey"),
      description: formData.get("description"),
    });
    const calculation = await validateSalaryCalculation(context.tenant.id, parsed.salaryCalculationId);
    await validateSalaryPeriod(context.tenant.id, calculation.salary_period_id);
    if (calculation.finalized_payable_amount === null) {
      return {
        idempotencyKey: retryKey,
        message: "Save this worker's payable amount before recording payment.",
        ok: false,
        periodId: calculation.salary_period_id,
        workerId: calculation.worker_id,
      };
    }

    const paymentModeId = await validatePaymentMode(context.tenant.id, parsed.paymentModeId);
    const roundedAmount = roundMoney(parsed.amount);
    const outstanding = Math.max(0, calculation.finalized_payable_amount - (calculation.amount_paid ?? 0));
    if (roundedAmount > outstanding) {
      return {
        idempotencyKey: retryKey,
        message: "This payment is higher than the remaining finalized salary due.",
        ok: false,
        periodId: calculation.salary_period_id,
        workerId: calculation.worker_id,
      };
    }

    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("record_worker_money_entry", {
      p_actor_id: context.membership.clerk_user_id,
      p_amount: roundedAmount,
      p_balance_account: null,
      p_description: parsed.description,
      p_idempotency_key: parsed.idempotencyKey,
      p_linked_salary_period_id: calculation.salary_period_id,
      p_payment_mode_id: paymentModeId,
      p_tenant_id: context.tenant.id,
      p_transaction_date: parsed.paymentDate,
      p_transaction_type: "salary_paid",
      p_worker_id: calculation.worker_id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    revalidatePath("/finance");
    revalidatePath("/workers");
    return {
      idempotencyKey: crypto.randomUUID(),
      message: "Payment recorded. Salary, Worker details, and Finance have been refreshed.",
      ok: true,
      periodId: calculation.salary_period_id,
      workerId: calculation.worker_id,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: workerMoneyActionError(error), ok: false };
  }
}

export async function finalizeSalaryCalculationsBulkAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = bulkFinalizeSalarySchema.parse({
      salaryPeriodId: formData.get("salaryPeriodId"),
      idempotencyKey: formData.get("idempotencyKey"),
      rows: formData.get("rows"),
    });
    await validateSalaryPeriod(context.tenant.id, parsed.salaryPeriodId);

    const rows = parsed.rows.map((row) => ({
      calculationId: row.calculationId,
      expectedUpdatedAt: row.expectedUpdatedAt,
      finalizationNote: row.finalizationNote?.trim() || null,
      finalizedPayableAmount: roundMoney(row.finalizedPayableAmount),
    }));
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("finalize_salary_calculations_bulk", {
      p_actor_id: context.membership.clerk_user_id,
      p_idempotency_key: parsed.idempotencyKey,
      p_rows: rows,
      p_salary_period_id: parsed.salaryPeriodId,
      p_tenant_id: context.tenant.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    revalidatePath(`/salary/periods/${parsed.salaryPeriodId}`);
    return {
      idempotencyKey: crypto.randomUUID(),
      message: `${rows.length} ${rows.length === 1 ? "payable" : "payables"} finalized.`,
      ok: true,
      periodId: parsed.salaryPeriodId,
      processedCount: rows.length,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: salaryWorkflowErrorMessage(error), ok: false };
  }
}

export async function recordSalaryPaymentsBulkAction(
  previousState: SalaryWorkflowActionState,
  formData: FormData,
): Promise<SalaryWorkflowActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;

  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = bulkSalaryPaymentSchema.parse({
      salaryPeriodId: formData.get("salaryPeriodId"),
      idempotencyKey: formData.get("idempotencyKey"),
      paymentDate: formData.get("paymentDate"),
      paymentModeId: formData.get("paymentModeId"),
      description: formData.get("description"),
      rows: formData.get("rows"),
    });
    const period = await validateSalaryPeriod(context.tenant.id, parsed.salaryPeriodId);
    const paymentModeId = await validatePaymentMode(context.tenant.id, parsed.paymentModeId);
    if (!paymentModeId) throw new Error("WORKER_MONEY_PAYMENT_MODE_REQUIRED");

    const rows = parsed.rows.map((row) => ({
      amount: roundMoney(row.amount),
      calculationId: row.calculationId,
      expectedUpdatedAt: row.expectedUpdatedAt,
    }));
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("record_salary_payments_bulk", {
      p_actor_id: context.membership.clerk_user_id,
      p_description: parsed.description ?? `Salary paid for ${period.period_start} to ${period.period_end}`,
      p_idempotency_key: parsed.idempotencyKey,
      p_payment_date: parsed.paymentDate,
      p_payment_mode_id: paymentModeId,
      p_rows: rows,
      p_salary_period_id: parsed.salaryPeriodId,
      p_tenant_id: context.tenant.id,
    });
    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    revalidatePath(`/salary/periods/${parsed.salaryPeriodId}`);
    revalidatePath("/finance");
    revalidatePath("/workers");
    return {
      idempotencyKey: crypto.randomUUID(),
      message: `${rows.length} ${rows.length === 1 ? "payment" : "payments"} recorded. Salary, Worker details, and Finance have been refreshed.`,
      ok: true,
      periodId: parsed.salaryPeriodId,
      processedCount: rows.length,
    };
  } catch (error) {
    return { idempotencyKey: retryKey, message: workerMoneyActionError(error), ok: false };
  }
}

export async function addWorkerLedgerEntryAction(
  previousState: WorkerMoneyActionState,
  formData: FormData,
): Promise<WorkerMoneyActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;
  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = addLedgerEntrySchema.parse({
      workerId: formData.get("workerId"),
      transactionType: formData.get("transactionType"),
      amount: formData.get("amount"),
      transactionDate: formData.get("transactionDate"),
      balanceAccount: formData.get("balanceAccount"),
      paymentModeId: formData.get("paymentModeId"),
      idempotencyKey: formData.get("idempotencyKey"),
      description: formData.get("description")
    });

    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("record_worker_money_entry", {
      p_actor_id: context.membership.clerk_user_id,
      p_amount: roundMoney(parsed.amount),
      p_balance_account: parsed.balanceAccount,
      p_description: parsed.description,
      p_idempotency_key: parsed.idempotencyKey,
      p_linked_salary_period_id: null,
      p_payment_mode_id: parsed.paymentModeId,
      p_tenant_id: context.tenant.id,
      p_transaction_date: parsed.transactionDate,
      p_transaction_type: parsed.transactionType,
      p_worker_id: parsed.workerId,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    revalidatePath("/finance");
    revalidatePath("/workers");
    return { idempotencyKey: crypto.randomUUID(), message: "Worker ledger entry recorded.", ok: true };
  } catch (error) {
    return { idempotencyKey: retryKey, message: workerMoneyActionError(error), ok: false };
  }
}

export async function correctWorkerMoneyEntryAction(
  previousState: WorkerMoneyActionState,
  formData: FormData,
): Promise<WorkerMoneyActionState> {
  const submittedKey = formData.get("idempotencyKey");
  const retryKey = typeof submittedKey === "string" ? submittedKey : previousState.idempotencyKey;
  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = correctWorkerMoneyEntrySchema.parse({
      entryId: formData.get("entryId"),
      amount: formData.get("amount"),
      transactionDate: formData.get("transactionDate"),
      balanceAccount: formData.get("balanceAccount"),
      paymentModeId: formData.get("paymentModeId"),
      description: formData.get("description"),
      correctionReason: formData.get("correctionReason"),
      idempotencyKey: formData.get("idempotencyKey"),
      returnTo: formData.get("returnTo"),
    });
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("correct_worker_money_entry", {
      p_actor_id: context.membership.clerk_user_id,
      p_amount: roundMoney(parsed.amount),
      p_balance_account: parsed.balanceAccount,
      p_description: parsed.description,
      p_entry_id: parsed.entryId,
      p_idempotency_key: parsed.idempotencyKey,
      p_payment_mode_id: parsed.paymentModeId,
      p_reason: parsed.correctionReason,
      p_tenant_id: context.tenant.id,
      p_transaction_date: parsed.transactionDate,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    revalidatePath("/finance");
    revalidatePath("/workers");
    return { idempotencyKey: crypto.randomUUID(), message: "Worker ledger correction saved with its audit history.", ok: true };
  } catch (error) {
    return { idempotencyKey: retryKey, message: workerMoneyActionError(error), ok: false };
  }
}

export async function reverseWorkerMoneyEntryAction(
  _previousState: WorkerMoneyActionState,
  formData: FormData,
): Promise<WorkerMoneyActionState> {
  try {
    const context = await getAuthorizedSalaryContext();
    const parsed = reverseWorkerMoneyEntrySchema.parse({
      entryId: formData.get("entryId"),
      correctionReason: formData.get("correctionReason"),
      returnTo: formData.get("returnTo"),
    });
    const supabase = createSupabaseServiceRoleClient();
    const { error } = await supabase.rpc("reverse_worker_money_entry", {
      p_actor_id: context.membership.clerk_user_id,
      p_entry_id: parsed.entryId,
      p_reason: parsed.correctionReason,
      p_tenant_id: context.tenant.id,
    });

    if (error) throw new Error(error.message);

    revalidatePath("/salary");
    revalidatePath("/finance");
    revalidatePath("/workers");
    return { message: "Worker ledger entry reversed. Its history is preserved.", ok: true };
  } catch (error) {
    return { message: workerMoneyActionError(error), ok: false };
  }
}
