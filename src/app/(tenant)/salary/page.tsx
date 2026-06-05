import Link from "next/link";
import { CalendarDays, Plus, RefreshCw, WalletCards } from "lucide-react";

import {
  addWorkerLedgerEntryAction,
  createSalaryPeriodAction,
  finalizeSalaryCalculationAction,
  generateSalarySuggestionsAction,
  recordSalaryPaymentAction,
} from "@/features/salary/actions";
import { getSalaryPageData } from "@/features/salary/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import {
  SalaryPaidTrendChart,
  WorkerSalaryBarChart,
} from "@/components/salary/salary-charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasPermission } from "@/lib/permissions/roles";
import type {
  SalaryCalculation,
  SalaryPeriod,
  WorkerLedgerTransactionType,
} from "@/types/database";

const ledgerTransactionTypes: Array<{
  value: WorkerLedgerTransactionType;
  label: string;
}> = [
  { value: "advance_given", label: "Advance given" },
  { value: "loan_given", label: "Loan given" },
  { value: "deduction", label: "Deduct from salary" },
  { value: "repayment", label: "Cash repayment received" },
  { value: "adjustment", label: "Manual adjustment" },
];

const rangeOptions = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "MTD", value: "mtd" },
  { label: "Custom", value: "custom" },
];

const salaryGroupOptions = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function periodLabel(period: SalaryPeriod) {
  return `${formatDate(period.period_start)} - ${formatDate(period.period_end)}`;
}

function effectivePayable(calculation: SalaryCalculation) {
  return calculation.finalized_payable_amount ?? calculation.final_payable;
}

function calculationWarnings(calculation: SalaryCalculation) {
  const payable = effectivePayable(calculation);

  return [
    calculation.wage_type === "per_piece" || calculation.wage_type === "hybrid"
      ? "Manual wage review"
      : null,
    calculation.attendance_days === 0 && calculation.attendance_hours === 0
      ? "No attendance input"
      : null,
    calculation.final_payable === 0 && calculation.gross_suggested_amount > 0
      ? "Fully deducted"
      : null,
    calculation.amount_paid > payable ? "Paid exceeds payable" : null,
  ].filter(Boolean) as string[];
}

function salaryHref({
  end,
  group,
  periodId,
  range,
  start,
  view,
}: {
  end?: string;
  group?: string;
  periodId?: string;
  range?: string;
  start?: string;
  view?: string;
}) {
  const params = new URLSearchParams();

  if (range) {
    params.set("range", range);
  }

  if (start) {
    params.set("start", start);
  }

  if (end) {
    params.set("end", end);
  }

  if (group) {
    params.set("group", group);
  }

  if (periodId) {
    params.set("periodId", periodId);
  }

  if (view) {
    params.set("view", view);
  }

  const query = params.toString();
  return query ? `/salary?${query}` : "/salary";
}

export default async function SalaryPage({
  searchParams,
}: {
  searchParams?: Promise<{
    end?: string;
    group?: string;
    periodId?: string;
    range?: string;
    salaryNotice?: string;
    salaryNoticeType?: string;
    start?: string;
    view?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const {
    attentionItems,
    calculations,
    context,
    ledger,
    paymentModes,
    periodSummaries,
    periods,
    range,
    recentSalaryPayments,
    salaryGroup,
    summary,
    trend,
    workerHistoryRows,
    workerSalaryChart,
    workers,
  } = await getSalaryPageData({
    end: resolvedSearchParams?.end,
    group: resolvedSearchParams?.group,
    range: resolvedSearchParams?.range,
    start: resolvedSearchParams?.start,
  });
  const canManageSalary = hasPermission(
    context.membership.role,
    "salary:manage",
  );
  const activeView =
    resolvedSearchParams?.view === "periods" ||
    resolvedSearchParams?.view === "adjustments"
      ? resolvedSearchParams.view
      : "overview";
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const selectedPeriod =
    periods.find((period) => period.id === resolvedSearchParams?.periodId) ??
    periodSummaries.find((periodSummary) => periodSummary.due > 0)?.period ??
    periods[0] ??
    null;
  const selectedPeriodSummary = selectedPeriod
    ? (periodSummaries.find(
        (periodSummary) => periodSummary.period.id === selectedPeriod.id,
      ) ?? null)
    : null;
  const selectedCalculations = selectedPeriod
    ? calculations
        .filter(
          (calculation) => calculation.salary_period_id === selectedPeriod.id,
        )
        .map((calculation) => ({
          calculation,
          warnings: calculationWarnings(calculation),
          worker: workerById.get(calculation.worker_id),
        }))
        .sort(
          (a, b) =>
            Math.max(
              0,
              effectivePayable(b.calculation) - b.calculation.amount_paid,
            ) -
            Math.max(
              0,
              effectivePayable(a.calculation) - a.calculation.amount_paid,
            ),
        )
    : [];
  const selectedLedger = selectedPeriod
    ? ledger.filter(
        (entry) => entry.linked_salary_period_id === selectedPeriod.id,
      )
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Salary"
        description="Track salary paid, dues, and worker payment history. Add salary through guided periods."
      />

      {resolvedSearchParams?.salaryNotice ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            resolvedSearchParams.salaryNoticeType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {resolvedSearchParams.salaryNotice}
        </div>
      ) : null}

      <CommandBar className="items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant={activeView === "overview" ? "default" : "outline"}
          >
            <Link
              href={salaryHref({
                end: range.end,
                group: salaryGroup,
                periodId: selectedPeriod?.id,
                range: range.range,
                start: range.start,
                view: "overview",
              })}
            >
              Overview
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={activeView === "periods" ? "default" : "outline"}
          >
            <Link
              href={salaryHref({
                end: range.end,
                group: salaryGroup,
                periodId: selectedPeriod?.id,
                range: range.range,
                start: range.start,
                view: "periods",
              })}
            >
              Periods
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={activeView === "adjustments" ? "default" : "outline"}
          >
            <Link
              href={salaryHref({
                end: range.end,
                group: salaryGroup,
                range: range.range,
                start: range.start,
                view: "adjustments",
              })}
            >
              Adjustments
            </Link>
          </Button>
        </div>
        {canManageSalary ? (
          <Button asChild size="sm">
            <Link
              href={salaryHref({
                end: range.end,
                group: salaryGroup,
                periodId: selectedPeriod?.id,
                range: range.range,
                start: range.start,
                view: "periods",
              })}
            >
              <Plus className="h-4 w-4" />
              Add salary period
            </Link>
          </Button>
        ) : null}
      </CommandBar>

      {activeView === "overview" ? (
        <>
          <CommandBar className="items-center justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {rangeOptions.map((option) => (
                  <Button
                    key={option.value}
                    asChild
                    size="sm"
                    variant={
                      range.range === option.value ? "default" : "outline"
                    }
                  >
                    <Link
                      href={salaryHref({
                        group: salaryGroup,
                        periodId: selectedPeriod?.id,
                        range: option.value,
                        view: activeView,
                      })}
                    >
                      {option.label}
                    </Link>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {salaryGroupOptions.map((option) => (
                  <Button
                    key={option.value}
                    asChild
                    size="sm"
                    variant={
                      salaryGroup === option.value ? "default" : "outline"
                    }
                  >
                    <Link
                      href={salaryHref({
                        end: range.end,
                        group: option.value,
                        periodId: selectedPeriod?.id,
                        range: range.range,
                        start: range.start,
                        view: activeView,
                      })}
                    >
                      {option.label}
                    </Link>
                  </Button>
                ))}
              </div>
              <form className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="view" value={activeView} />
                <input type="hidden" name="range" value="custom" />
                <input type="hidden" name="group" value={salaryGroup} />
                {selectedPeriod ? (
                  <input
                    type="hidden"
                    name="periodId"
                    value={selectedPeriod.id}
                  />
                ) : null}
                <Input
                  name="start"
                  type="date"
                  defaultValue={range.start}
                  className="h-9 w-[150px]"
                />
                <Input
                  name="end"
                  type="date"
                  defaultValue={range.end}
                  className="h-9 w-[150px]"
                />
                <Button type="submit" size="sm" variant="outline">
                  Apply
                </Button>
              </form>
            </div>
          </CommandBar>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Paid in range"
              value={formatMoney(summary.salaryPaid)}
              hint={`${formatDate(range.start)} - ${formatDate(range.end)}`}
            />
            <MetricCard
              label="Salary due"
              value={formatMoney(summary.salaryDue)}
              hint="Across open periods"
            />
            <MetricCard
              label="Workers paid"
              value={summary.workersPaid}
              hint="In selected range"
            />
            <MetricCard
              label="Pending periods"
              value={summary.pendingPeriods}
              hint="Need review or payment"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Salary paid trend</CardTitle>
                <CardDescription>
                  Actual salary payments grouped by {salaryGroup} view.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SalaryPaidTrendChart data={trend} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Worker salary view</CardTitle>
                <CardDescription>
                  Worker-wise paid and pending salary in the selected range.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WorkerSalaryBarChart data={workerSalaryChart} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attention board</CardTitle>
                <CardDescription>
                  Payables, open advances, loans, and unpaid periods that need a
                  decision.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {attentionItems.map((item) => (
                  <div
                    key={`${item.type}-${item.title}-${item.amount}`}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={
                            item.type === "payable" ||
                            item.type === "unpaid_period"
                              ? "font-semibold text-destructive"
                              : "font-semibold"
                          }
                        >
                          {formatMoney(item.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatStatus(item.type)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {!attentionItems.length ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing needs attention right now.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent salary payments</CardTitle>
                <CardDescription>
                  Latest salary cash-out entries that also roll into Finance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentSalaryPayments.map((payment) => {
                  const worker = workerById.get(payment.worker_id);
                  const mode = payment.payment_mode_id
                    ? paymentModes.find(
                        (paymentMode) =>
                          paymentMode.id === payment.payment_mode_id,
                      )?.name
                    : null;

                  return (
                    <div
                      key={payment.id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {worker?.name ?? "Unknown worker"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(payment.transaction_date)} ·{" "}
                            {mode ?? "No mode"}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatMoney(payment.amount)}
                        </p>
                      </div>
                      {payment.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.description}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {!recentSalaryPayments.length ? (
                  <p className="text-sm text-muted-foreground">
                    No salary payments recorded yet.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Worker payment history</CardTitle>
              <CardDescription>
                Who has been paid in the selected range and who still has salary
                due.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 border-y px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
                <span>Worker</span>
                <span>Paid in range</span>
                <span>Open payable</span>
                <span>Last payment</span>
                <span>Payments</span>
              </div>
              <div className="divide-y">
                {workerHistoryRows.map((row) => (
                  <div
                    key={row.worker.id}
                    className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.worker.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatStatus(row.worker.wage_type)} ·{" "}
                        {formatMoney(row.worker.wage_amount)}
                      </p>
                    </div>
                    <p className="font-medium">{formatMoney(row.paid)}</p>
                    <p
                      className={
                        row.due > 0
                          ? "font-medium text-destructive"
                          : "font-medium"
                      }
                    >
                      {formatMoney(row.due)}
                    </p>
                    <p className="text-muted-foreground">
                      {row.lastPaymentDate
                        ? formatDate(row.lastPaymentDate)
                        : "No payment"}
                    </p>
                    <p className="text-muted-foreground">{row.paymentCount}</p>
                  </div>
                ))}
                {!workerHistoryRows.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No active workers found.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {activeView === "periods" ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            <Card id="add-salary-period">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Add salary period
                </CardTitle>
                <CardDescription>
                  Choose a clean date range. Overlapping periods are blocked
                  before anything is created.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canManageSalary ? (
                  <form
                    action={createSalaryPeriodAction}
                    className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    data-unsaved-guard="true"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="periodStart">Start</Label>
                      <Input
                        id="periodStart"
                        name="periodStart"
                        type="date"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="periodEnd">End</Label>
                      <Input
                        id="periodEnd"
                        name="periodEnd"
                        type="date"
                        required
                      />
                    </div>
                    <Button type="submit">
                      <Plus className="h-4 w-4" />
                      Create
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You can view salary history, but only salary managers can
                    create periods.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Salary periods</CardTitle>
                <CardDescription>
                  Open a period when you are ready to review or record payments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {periodSummaries.slice(0, 8).map((periodSummary) => (
                  <Link
                    key={periodSummary.period.id}
                    href={salaryHref({
                      end: range.end,
                      periodId: periodSummary.period.id,
                      range: range.range,
                      start: range.start,
                      view: "periods",
                    })}
                    className={`block rounded-md border p-3 text-sm transition hover:bg-muted/50 ${
                      selectedPeriod?.id === periodSummary.period.id
                        ? "border-neutral-950 bg-muted/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {periodLabel(periodSummary.period)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatStatus(periodSummary.period.status)} ·{" "}
                          {periodSummary.paidCount}/{periodSummary.workerCount}{" "}
                          paid
                        </p>
                      </div>
                      <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">
                        {formatStatus(periodSummary.period.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Payable</p>
                        <p className="font-medium">
                          {formatMoney(periodSummary.payable)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Paid</p>
                        <p className="font-medium">
                          {formatMoney(periodSummary.paid)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Due</p>
                        <p className="font-medium">
                          {formatMoney(periodSummary.due)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
                {!periodSummaries.length ? (
                  <p className="text-sm text-muted-foreground">
                    No salary periods yet. Create one when attendance for a
                    period is ready.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Period workspace</CardTitle>
                  <CardDescription>
                    {selectedPeriod
                      ? `${periodLabel(selectedPeriod)} · focused review and payment`
                      : "Create a salary period to start."}
                  </CardDescription>
                </div>
                {canManageSalary && selectedPeriod?.status === "draft" ? (
                  <form action={generateSalarySuggestionsAction}>
                    <input
                      type="hidden"
                      name="salaryPeriodId"
                      value={selectedPeriod.id}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  </form>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedPeriod && selectedPeriodSummary ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <MiniStat
                      label="Suggested"
                      value={formatMoney(selectedPeriodSummary.suggested)}
                    />
                    <MiniStat
                      label="Payable"
                      value={formatMoney(selectedPeriodSummary.payable)}
                    />
                    <MiniStat
                      label="Paid"
                      value={formatMoney(selectedPeriodSummary.paid)}
                    />
                    <MiniStat
                      label="Due"
                      value={formatMoney(selectedPeriodSummary.due)}
                    />
                  </div>
                  <div className="space-y-3">
                    {selectedCalculations.map(
                      ({ calculation, warnings, worker }) => {
                        const payable = effectivePayable(calculation);
                        const due = Math.max(
                          0,
                          payable - calculation.amount_paid,
                        );
                        const workerLedger = selectedLedger.filter(
                          (entry) => entry.worker_id === calculation.worker_id,
                        );

                        return (
                          <details
                            key={calculation.id}
                            className="rounded-md border"
                          >
                            <summary className="grid cursor-pointer gap-3 px-4 py-3 text-sm marker:text-muted-foreground md:grid-cols-[1.2fr_1fr_1fr_1fr_120px] md:items-center">
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {worker?.name ?? "Unknown worker"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatStatus(calculation.wage_type)} ·{" "}
                                  {formatMoney(calculation.wage_amount)}
                                </span>
                              </span>
                              <span>
                                <span className="block font-medium">
                                  {formatMoney(calculation.final_payable)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Suggested
                                </span>
                              </span>
                              <span>
                                <span className="block font-medium">
                                  {formatMoney(payable)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Final
                                </span>
                              </span>
                              <span>
                                <span
                                  className={
                                    due > 0
                                      ? "block font-medium text-destructive"
                                      : "block font-medium"
                                  }
                                >
                                  {formatMoney(due)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Due
                                </span>
                              </span>
                              <span className="rounded-full bg-neutral-950 px-2 py-1 text-center text-xs text-white">
                                {formatStatus(calculation.payment_status)}
                              </span>
                            </summary>
                            <div className="border-t bg-muted/20 p-4">
                              <div className="grid gap-3 text-sm md:grid-cols-3">
                                <MiniStat
                                  label="Attendance"
                                  value={`${formatNumber(calculation.attendance_days)} days`}
                                  hint={`${formatNumber(calculation.attendance_hours)} hours`}
                                />
                                <MiniStat
                                  label="Production"
                                  value={`${formatNumber(calculation.productive_minutes / 60)} hrs`}
                                  hint="Separate from attendance"
                                />
                                <MiniStat
                                  label="Ledger impact"
                                  value={formatMoney(
                                    calculation.repayment_credit +
                                      calculation.manual_adjustment -
                                      calculation.advance_deduction -
                                      calculation.loan_deduction -
                                      calculation.other_deduction,
                                  )}
                                  hint={
                                    warnings.length
                                      ? warnings.join(", ")
                                      : "No review signal"
                                  }
                                />
                              </div>
                              {canManageSalary ? (
                                <div className="mt-4 space-y-3">
                                  <div className="rounded-md border bg-background p-3">
                                    <div className="mb-3">
                                      <p className="text-sm font-medium">
                                        1. Confirm payable
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Edit the final payable amount for this
                                        worker in this period. The suggested
                                        amount remains visible for reference.
                                      </p>
                                    </div>
                                    <form
                                      action={finalizeSalaryCalculationAction}
                                      className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-end"
                                      data-unsaved-guard="true"
                                    >
                                      <input
                                        type="hidden"
                                        name="salaryCalculationId"
                                        value={calculation.id}
                                      />
                                      <div className="grid gap-1">
                                        <Label
                                          htmlFor={`finalizedPayableAmount-${calculation.id}`}
                                          className="text-xs"
                                        >
                                          Payable amount
                                        </Label>
                                        <Input
                                          id={`finalizedPayableAmount-${calculation.id}`}
                                          name="finalizedPayableAmount"
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          defaultValue={payable}
                                          required
                                        />
                                      </div>
                                      <div className="grid gap-1">
                                        <Label
                                          htmlFor={`finalizationNote-${calculation.id}`}
                                          className="text-xs"
                                        >
                                          Edit note
                                        </Label>
                                        <Input
                                          id={`finalizationNote-${calculation.id}`}
                                          name="finalizationNote"
                                          defaultValue={
                                            calculation.finalization_note ?? ""
                                          }
                                          placeholder="Optional reason"
                                        />
                                      </div>
                                      <Button type="submit" size="sm">
                                        Save payable
                                      </Button>
                                    </form>
                                  </div>

                                  <div className="rounded-md border bg-background p-3">
                                    <div className="mb-3">
                                      <p className="text-sm font-medium">
                                        2. Record payment
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Record money actually paid. The amount
                                        defaults to the current due and will
                                        roll up to Finance as Salary expense.
                                      </p>
                                    </div>
                                    <form
                                      action={recordSalaryPaymentAction}
                                      className="grid gap-2 sm:grid-cols-[140px_150px_1fr_auto] sm:items-end"
                                      data-unsaved-guard="true"
                                    >
                                      <input
                                        type="hidden"
                                        name="salaryCalculationId"
                                        value={calculation.id}
                                      />
                                      <div className="grid gap-1">
                                        <Label
                                          htmlFor={`paymentAmount-${calculation.id}`}
                                          className="text-xs"
                                        >
                                          Payment amount
                                        </Label>
                                        <Input
                                          id={`paymentAmount-${calculation.id}`}
                                          name="amount"
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          defaultValue={due}
                                          required
                                        />
                                      </div>
                                      <div className="grid gap-1">
                                        <Label
                                          htmlFor={`paymentDate-${calculation.id}`}
                                          className="text-xs"
                                        >
                                          Date
                                        </Label>
                                        <Input
                                          id={`paymentDate-${calculation.id}`}
                                          name="paymentDate"
                                          type="date"
                                          defaultValue={todayIsoDate()}
                                          required
                                        />
                                      </div>
                                      <div className="grid gap-1">
                                        <Label
                                          htmlFor={`paymentModeId-${calculation.id}`}
                                          className="text-xs"
                                        >
                                          Mode
                                        </Label>
                                        <select
                                          id={`paymentModeId-${calculation.id}`}
                                          name="paymentModeId"
                                          className="h-10 rounded-md border bg-background px-3 text-sm"
                                        >
                                          <option value="">No mode</option>
                                          {paymentModes.map((mode) => (
                                            <option
                                              key={mode.id}
                                              value={mode.id}
                                            >
                                              {mode.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <input
                                        type="hidden"
                                        name="description"
                                        value={`Salary paid for ${periodLabel(selectedPeriod)}`}
                                      />
                                      <Button
                                        type="submit"
                                        size="sm"
                                        variant="outline"
                                        disabled={due <= 0}
                                      >
                                        Record payment
                                      </Button>
                                    </form>
                                  </div>
                                </div>
                              ) : null}
                              <div className="mt-4 space-y-2">
                                {workerLedger.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      {formatStatus(entry.transaction_type)} ·{" "}
                                      {formatDate(entry.transaction_date)}
                                    </span>
                                    <span className="font-medium">
                                      {formatMoney(entry.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </details>
                        );
                      },
                    )}
                    {!selectedCalculations.length ? (
                      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        No worker suggestions in this period yet.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No salary period selected.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeView === "adjustments" && canManageSalary ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="h-4 w-4" />
              Other worker ledger adjustment
            </CardTitle>
            <CardDescription>
              Use this for advances, loans, deductions, repayments, or
              adjustments. Salary payments should be recorded from a period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={addWorkerLedgerEntryAction}
              className="grid gap-3 md:grid-cols-[1fr_1fr_140px_150px_1fr_auto] md:items-end"
              data-unsaved-guard="true"
            >
              <div className="grid gap-2">
                <Label htmlFor="workerId">Worker</Label>
                <select
                  id="workerId"
                  name="workerId"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  required
                >
                  <option value="">Select worker</option>
                  {workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transactionType">Type</Label>
                <select
                  id="transactionType"
                  name="transactionType"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  required
                >
                  {ledgerTransactionTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transactionDate">Date</Label>
                <Input
                  id="transactionDate"
                  name="transactionDate"
                  type="date"
                  defaultValue={todayIsoDate()}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Note</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Optional note"
                />
              </div>
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MiniStat({
  hint,
  label,
  value,
}: {
  hint?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
