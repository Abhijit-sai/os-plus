import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";

import {
  addWorkerLedgerEntryAction,
  correctWorkerMoneyEntryAction,
  createSalaryPeriodAction,
  reverseWorkerMoneyEntryAction,
} from "@/features/salary/actions";
import { getSalaryPageData, type SalaryPeriodSummary } from "@/features/salary/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import {
  SalaryPaidTrendChart,
  WorkerSalaryBarChart,
} from "@/components/salary/salary-charts";
import { SalaryPeriodCreateForm } from "@/components/salary/salary-workflow-forms";
import { WorkerMoneyEntryForm } from "@/components/salary/worker-money-entry-form";
import { WorkerMoneyLedger } from "@/components/salary/worker-money-ledger";
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
  SalaryPeriod,
} from "@/types/database";

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

function salaryPeriodDisplayStatus(summary: SalaryPeriodSummary) {
  if (summary.workerCount > 0 && summary.paidCount === summary.workerCount) return "Paid";
  if (summary.paid > 0) return "Partially paid";
  if (summary.workerCount > 0 && summary.finalizedCount === summary.workerCount) return "Ready to pay";
  return "Draft";
}

function periodLabel(period: SalaryPeriod) {
  return `${formatDate(period.period_start)} - ${formatDate(period.period_end)}`;
}

function salaryHref({
  end,
  group,
  periodId,
  range,
  start,
  view,
  workerId,
}: {
  end?: string;
  group?: string;
  periodId?: string;
  range?: string;
  start?: string;
  view?: string;
  workerId?: string;
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

  if (workerId) {
    params.set("workerId", workerId);
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
    workerId?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const {
    activeWorkers,
    attentionItems,
    calculations,
    context,
    ledger,
    paymentModes,
    periodSummaries,
    periods,
    range,
    recentSalaryPayments,
    revisions,
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
    resolvedSearchParams?.view === "periods"
      ? "periods"
      : resolvedSearchParams?.view === "worker-ledger" ||
          resolvedSearchParams?.view === "adjustments"
        ? "worker-ledger"
        : "overview";
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const selectedPeriod =
    periods.find((period) => period.id === resolvedSearchParams?.periodId) ??
    periodSummaries.find((periodSummary) => periodSummary.due > 0)?.period ??
    periods[0] ??
    null;
  const ledgerWorkerId = workers.some(
    (worker) => worker.id === resolvedSearchParams?.workerId,
  )
    ? resolvedSearchParams?.workerId
    : undefined;
  const visibleWorkerLedger = ledgerWorkerId
    ? ledger.filter((entry) => entry.worker_id === ledgerWorkerId)
    : ledger;

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
            variant={activeView === "worker-ledger" ? "default" : "outline"}
          >
            <Link
              href={salaryHref({
                end: range.end,
                group: salaryGroup,
                range: range.range,
                start: range.start,
                view: "worker-ledger",
              })}
            >
              Worker ledger
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
        <div className="grid gap-5">
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
                  <SalaryPeriodCreateForm
                    action={createSalaryPeriodAction}
                    activeWorkerCount={activeWorkers.length}
                    idempotencyKey={crypto.randomUUID()}
                  />
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
                {periodSummaries.map((periodSummary) => (
                  <Link
                    key={periodSummary.period.id}
                    href={`/salary/periods/${periodSummary.period.id}`}
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
                          {salaryPeriodDisplayStatus(periodSummary)} ·{" "}
                          {periodSummary.paidCount}/{periodSummary.workerCount}{" "}
                          paid
                        </p>
                      </div>
                      <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">
                        {salaryPeriodDisplayStatus(periodSummary)}
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

        </div>
      ) : null}

      {activeView === "worker-ledger" ? (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Record worker money</CardTitle>
              <CardDescription>Choose the real-world event. OS PLUS will show whether it moves cash, changes salary, or reduces an advance or loan balance.</CardDescription>
            </CardHeader>
            <CardContent>
              {canManageSalary && activeWorkers.length ? (
                <WorkerMoneyEntryForm
                  action={addWorkerLedgerEntryAction}
                  defaultDate={todayIsoDate()}
                  idempotencyKey={crypto.randomUUID()}
                  paymentModes={paymentModes}
                  workers={activeWorkers}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {canManageSalary
                    ? "Add or reactivate a worker before recording a new worker-money entry. Historical ledger rows remain visible below."
                    : "You can review worker money, but only owner/admin or finance can record it."}
                </p>
              )}
            </CardContent>
          </Card>

          <CommandBar className="justify-between">
            <form action="/salary" className="flex flex-wrap items-end gap-2">
              <input name="view" type="hidden" value="worker-ledger" />
              <div className="grid gap-1">
                <Label htmlFor="ledgerWorkerFilter" className="text-xs">Worker</Label>
                <select className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm" defaultValue={ledgerWorkerId ?? ""} id="ledgerWorkerFilter" name="workerId">
                  <option value="">All workers</option>
                  {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                </select>
              </div>
              <Button size="sm" type="submit" variant="outline">Apply</Button>
            </form>
            {ledgerWorkerId ? <Button asChild size="sm" variant="ghost"><Link href={salaryHref({ view: "worker-ledger" })}>Clear worker</Link></Button> : null}
          </CommandBar>

          <WorkerMoneyLedger
            canManage={canManageSalary}
            correctAction={correctWorkerMoneyEntryAction}
            entries={visibleWorkerLedger}
            paymentModes={paymentModes}
            reverseAction={reverseWorkerMoneyEntryAction}
            returnTo="salary"
            workers={workers}
          />
        </div>
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
