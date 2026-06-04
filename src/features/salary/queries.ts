import "server-only";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { SalaryCalculation, SalaryPeriod, Worker, WorkerLedger } from "@/types/database";

export type SalaryRangeKey = "7d" | "30d" | "mtd" | "custom";
export type SalaryGroupKey = "daily" | "weekly" | "monthly";

export type SalaryTrendPoint = {
  label: string;
  paid: number;
};

export type WorkerSalaryChartPoint = {
  due: number;
  name: string;
  paid: number;
};

export type SalaryAttentionItem = {
  amount: number;
  detail: string;
  priority: number;
  title: string;
  type: "payable" | "advance" | "loan" | "unpaid_period";
};

export type WorkerSalaryHistoryRow = {
  due: number;
  lastPaymentDate: string | null;
  paid: number;
  payable: number;
  paymentCount: number;
  worker: Worker;
};

export type SalaryPeriodSummary = {
  due: number;
  finalizedCount: number;
  paid: number;
  paidCount: number;
  payable: number;
  period: SalaryPeriod;
  suggested: number;
  workerCount: number;
};

export type SalaryOverviewSummary = {
  pendingPeriods: number;
  salaryDue: number;
  salaryPaid: number;
  workersPaid: number;
};

export type SalaryPageData = Awaited<ReturnType<typeof getSalaryPageData>>;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function monthStart(date: string) {
  return `${date.slice(0, 8)}01`;
}

function formatDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatMonthLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function startOfWeek(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + mondayOffset);
  return value.toISOString().slice(0, 10);
}

function startOfMonth(date: string) {
  return `${date.slice(0, 8)}01`;
}

function resolveGroup(group?: string): SalaryGroupKey {
  return group === "weekly" || group === "monthly" ? group : "daily";
}

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function resolveRange({
  end,
  range,
  start
}: {
  end?: string;
  range?: string;
  start?: string;
}) {
  const today = todayIsoDate();
  const selectedRange: SalaryRangeKey = range === "7d" || range === "30d" || range === "mtd" || range === "custom" ? range : "30d";

  if (selectedRange === "custom" && start && end && end >= start) {
    return {
      end,
      range: selectedRange,
      start
    };
  }

  if (selectedRange === "7d") {
    return {
      end: today,
      range: selectedRange,
      start: addDays(today, -6)
    };
  }

  if (selectedRange === "mtd") {
    return {
      end: today,
      range: selectedRange,
      start: monthStart(today)
    };
  }

  return {
    end: today,
    range: selectedRange,
    start: addDays(today, -29)
  };
}

function effectivePayable(calculation: SalaryCalculation) {
  return calculation.finalized_payable_amount ?? calculation.final_payable;
}

function buildPeriodSummaries(periods: SalaryPeriod[], calculations: SalaryCalculation[]) {
  return periods.map((period): SalaryPeriodSummary => {
    const periodCalculations = calculations.filter((calculation) => calculation.salary_period_id === period.id);

    return {
      due: periodCalculations.reduce((total, calculation) => total + Math.max(0, effectivePayable(calculation) - calculation.amount_paid), 0),
      finalizedCount: periodCalculations.filter((calculation) => calculation.finalized_payable_amount !== null).length,
      paid: periodCalculations.reduce((total, calculation) => total + calculation.amount_paid, 0),
      paidCount: periodCalculations.filter((calculation) => calculation.payment_status === "paid").length,
      payable: periodCalculations.reduce((total, calculation) => total + effectivePayable(calculation), 0),
      period,
      suggested: periodCalculations.reduce((total, calculation) => total + calculation.final_payable, 0),
      workerCount: periodCalculations.length
    };
  });
}

function buildSalaryTrend(payments: WorkerLedger[], start: string, end: string, group: SalaryGroupKey): SalaryTrendPoint[] {
  if (group !== "daily") {
    const paidByGroup = payments.reduce((groups, payment) => {
      const groupDate = group === "weekly" ? startOfWeek(payment.transaction_date) : startOfMonth(payment.transaction_date);
      groups.set(groupDate, (groups.get(groupDate) ?? 0) + payment.amount);
      return groups;
    }, new Map<string, number>());

    return Array.from(paidByGroup.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, paid]) => ({
        label: group === "weekly" ? `Week of ${formatDayLabel(date)}` : formatMonthLabel(date),
        paid
      }));
  }

  const paidByDate = payments.reduce((groups, payment) => {
    groups.set(payment.transaction_date, (groups.get(payment.transaction_date) ?? 0) + payment.amount);
    return groups;
  }, new Map<string, number>());

  return enumerateDates(start, end).map((date) => ({
    label: formatDayLabel(date),
    paid: paidByDate.get(date) ?? 0
  }));
}

function buildWorkerHistory(workers: Worker[], payments: WorkerLedger[], calculations: SalaryCalculation[]): WorkerSalaryHistoryRow[] {
  return workers
    .map((worker) => {
      const workerPayments = payments.filter((payment) => payment.worker_id === worker.id);
      const workerCalculations = calculations.filter((calculation) => calculation.worker_id === worker.id);
      const payable = workerCalculations.reduce((total, calculation) => total + effectivePayable(calculation), 0);
      const paid = workerPayments.reduce((total, payment) => total + payment.amount, 0);

      return {
        due: Math.max(0, payable - workerCalculations.reduce((total, calculation) => total + calculation.amount_paid, 0)),
        lastPaymentDate: workerPayments[0]?.transaction_date ?? null,
        paid,
        payable,
        paymentCount: workerPayments.length,
        worker
      };
    })
    .sort((a, b) => b.due - a.due || b.paid - a.paid || a.worker.name.localeCompare(b.worker.name));
}

function buildWorkerSalaryChart(rows: WorkerSalaryHistoryRow[]): WorkerSalaryChartPoint[] {
  return rows
    .filter((row) => row.paid > 0 || row.due > 0)
    .slice(0, 10)
    .map((row) => ({
      due: row.due,
      name: row.worker.name,
      paid: row.paid
    }));
}

function buildAttentionItems({
  periodSummaries,
  workerHistoryRows,
  ledger
}: {
  ledger: WorkerLedger[];
  periodSummaries: SalaryPeriodSummary[];
  workerHistoryRows: WorkerSalaryHistoryRow[];
}): SalaryAttentionItem[] {
  const ledgerByWorker = ledger.reduce((groups, entry) => {
    const rows = groups.get(entry.worker_id) ?? [];
    rows.push(entry);
    groups.set(entry.worker_id, rows);
    return groups;
  }, new Map<string, WorkerLedger[]>());

  const advanceLoanItems = workerHistoryRows.flatMap((row) => {
    const workerLedger = ledgerByWorker.get(row.worker.id) ?? [];
    const advances = workerLedger.filter((entry) => entry.transaction_type === "advance_given").reduce((total, entry) => total + entry.amount, 0);
    const loans = workerLedger.filter((entry) => entry.transaction_type === "loan_given").reduce((total, entry) => total + entry.amount, 0);
    const deductions = workerLedger.filter((entry) => entry.transaction_type === "deduction" || entry.transaction_type === "repayment").reduce((total, entry) => total + entry.amount, 0);
    const outstanding = Math.max(0, advances + loans - deductions);

    if (!outstanding) {
      return [];
    }

    return [
      {
        amount: outstanding,
        detail: "Advance/loan balance should be adjusted through deduction or repayment entries.",
        priority: outstanding,
        title: row.worker.name,
        type: advances >= loans ? "advance" : "loan"
      } satisfies SalaryAttentionItem
    ];
  });

  const payableItems = workerHistoryRows
    .filter((row) => row.due > 0)
    .map((row) => ({
      amount: row.due,
      detail: "Worker has salary payable pending across open periods.",
      priority: row.due,
      title: row.worker.name,
      type: "payable" as const
    }));

  const periodItems = periodSummaries
    .filter((summary) => summary.due > 0)
    .map((summary) => ({
      amount: summary.due,
      detail: `${summary.paidCount}/${summary.workerCount} workers paid for this period.`,
      priority: summary.due + 1,
      title: `${summary.period.period_start} to ${summary.period.period_end}`,
      type: "unpaid_period" as const
    }));

  return [...periodItems, ...payableItems, ...advanceLoanItems].sort((a, b) => b.priority - a.priority).slice(0, 8);
}

export async function getSalaryPageData({
  end,
  group,
  range,
  start
}: {
  end?: string;
  group?: string;
  range?: string;
  start?: string;
} = {}) {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "salary:view");

  const resolvedRange = resolveRange({ end, range, start });
  const resolvedGroup = resolveGroup(group);
  const supabase = createSupabaseServiceRoleClient();

  const [workers, periods, calculations, ledger, paymentModes] = await Promise.all([
    supabase
      .from("workers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("salary_periods")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("period_start", { ascending: false })
      .limit(24),
    supabase
      .from("salary_calculations")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("worker_ledger")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .limit(250),
    supabase
      .from("payment_modes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
  ]);

  for (const result of [workers, periods, calculations, ledger, paymentModes]) {
    if (result.error) {
      throw new Error(`Unable to load salary data: ${result.error.message}`);
    }
  }

  const salaryPayments = (ledger.data ?? []).filter((entry) => entry.transaction_type === "salary_paid");
  const rangeSalaryPayments = salaryPayments.filter(
    (entry) => entry.transaction_date >= resolvedRange.start && entry.transaction_date <= resolvedRange.end
  );
  const periodSummaries = buildPeriodSummaries(periods.data ?? [], calculations.data ?? []);
  const pendingPeriodSummaries = periodSummaries.filter((summary) => summary.due > 0 || summary.period.status !== "paid");
  const salaryDue = periodSummaries.reduce((total, summary) => total + summary.due, 0);
  const salaryPaid = rangeSalaryPayments.reduce((total, payment) => total + payment.amount, 0);
  const workerHistoryRows = buildWorkerHistory(workers.data ?? [], rangeSalaryPayments, calculations.data ?? []);
  const workerSalaryChart = buildWorkerSalaryChart(workerHistoryRows);

  return {
    attentionItems: buildAttentionItems({
      ledger: ledger.data ?? [],
      periodSummaries,
      workerHistoryRows
    }),
    calculations: calculations.data ?? [],
    context,
    ledger: ledger.data ?? [],
    paymentModes: paymentModes.data ?? [],
    periodSummaries,
    periods: periods.data ?? [],
    range: resolvedRange,
    salaryGroup: resolvedGroup,
    recentSalaryPayments: salaryPayments.slice(0, 8),
    salaryPayments,
    summary: {
      pendingPeriods: pendingPeriodSummaries.length,
      salaryDue,
      salaryPaid,
      workersPaid: new Set(rangeSalaryPayments.map((payment) => payment.worker_id)).size
    } satisfies SalaryOverviewSummary,
    trend: buildSalaryTrend(rangeSalaryPayments, resolvedRange.start, resolvedRange.end, resolvedGroup),
    workerSalaryChart,
    workerHistoryRows,
    workers: workers.data ?? []
  };
}
