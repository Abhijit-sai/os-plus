import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleAlert,
  LineChart,
  WalletCards,
} from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import {
  AttendanceStackedBarChart,
  SalesBarChart,
  WorkerLineChart,
  type AttendanceChartPoint,
  type SalesChartPoint,
  type WorkerChartPoint,
} from "@/components/dashboard/analytics-charts";
import { StatusBadge } from "@/components/design-system/status-badge";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { getDashboardPageData } from "@/features/dashboard/queries";

type DashboardTab =
  | "overview"
  | "sales"
  | "production"
  | "workers"
  | "finance"
  | "alerts";
type SalesMode = "count" | "amount";

const dashboardTabs: Array<{ value: DashboardTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "sales", label: "Sales" },
  { value: "production", label: "Production" },
  { value: "workers", label: "Workers" },
  { value: "finance", label: "Finance" },
  { value: "alerts", label: "Alerts" },
];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(date: string | null) {
  if (!date) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildHref(tab: DashboardTab, salesMode: SalesMode) {
  const params = new URLSearchParams({ tab, salesMode });
  return `/dashboard?${params.toString()}`;
}

function getLastDays(days: number) {
  const today = startOfToday();
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - (days - 1));
    return {
      date: toIsoDate(date),
      label: new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
      }).format(date),
    };
  });
}

function getDueBalance(entry: {
  amount: number;
  amount_settled: number | null;
}) {
  return Math.max(Number(entry.amount) - Number(entry.amount_settled ?? 0), 0);
}

function isCompletedItem(status: string) {
  return [
    "completed",
    "ready_for_pickup",
    "ready_for_dispatch",
    "dispatched",
    "delivered",
    "cancelled",
  ].includes(status);
}

function ChartPane({
  title,
  description,
  fullHref,
  children,
}: {
  title: string;
  description: string;
  fullHref: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      title={title}
      description={description}
      placement="side"
      className="max-w-6xl"
      trigger={
        <span className="inline-flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-xs font-medium hover:bg-accent">
          Drill down
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      }
    >
      <div className="space-y-4">
        {children}
        <Button asChild>
          <Link href={fullHref}>Open full page</Link>
        </Button>
      </div>
    </Dialog>
  );
}

function AnalyticsCard({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="mt-1">{description}</CardDescription>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; salesMode?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = dashboardTabs.some(
    (tab) => tab.value === resolvedSearchParams?.tab,
  )
    ? (resolvedSearchParams?.tab as DashboardTab)
    : "overview";
  const salesMode: SalesMode =
    resolvedSearchParams?.salesMode === "count" ? "count" : "amount";
  const data = await getDashboardPageData();
  const today = startOfToday();
  const todayIso = toIsoDate(today);
  const dueSoonIso = toIsoDate(addDays(today, 2));
  const salesDays = getLastDays(14);
  const workerDays = getLastDays(7);
  const attendanceDays = getLastDays(7);
  const orderById = new Map(data.orders.map((order) => [order.id, order]));
  const workflowById = new Map(
    data.workflows.map((workflow) => [workflow.id, workflow]),
  );
  const stageById = new Map(data.stages.map((stage) => [stage.id, stage]));
  const workerById = new Map(data.workers.map((worker) => [worker.id, worker]));
  const currentStageByItemId = new Map(
    data.workflowInstances
      .map(
        (instance) =>
          [
            instance.order_item_id,
            data.stageInstances.find(
              (stage) => stage.id === instance.current_stage_instance_id,
            ),
          ] as const,
      )
      .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
        Boolean(entry[1]),
      ),
  );

  const salesChartData: SalesChartPoint[] = salesDays.map((day) => {
    const dayOrders = data.orders.filter(
      (order) => order.order_date === day.date,
    );
    const dayPayments = data.orderPayments.filter(
      (payment) => payment.payment_date === day.date,
    );

    return {
      label: day.label,
      count: dayOrders.length,
      amount: dayOrders.reduce(
        (total, order) => total + Number(order.total_amount),
        0,
      ),
      collected: dayPayments.reduce(
        (total, payment) => total + Number(payment.amount),
        0,
      ),
    };
  });

  const workerNames = data.workers
    .filter((worker) => worker.status === "active")
    .slice(0, 8)
    .map((worker) => worker.name);
  const workerChartData: WorkerChartPoint[] = workerDays.map((day) => {
    const point: WorkerChartPoint = { label: day.label };

    for (const worker of data.workers.filter((entry) =>
      workerNames.includes(entry.name),
    )) {
      const logs = data.workLogs.filter((log) => log.worker_id === worker.id);
      const completedCount = logs.filter(
        (log) => log.completed_at?.slice(0, 10) === day.date,
      ).length;
      const touchedCount = logs.filter((log) => {
        const touchedDates = [
          log.started_at?.slice(0, 10),
          log.updated_at?.slice(0, 10),
        ].filter(Boolean);
        return (
          touchedDates.includes(day.date) &&
          log.completed_at?.slice(0, 10) !== day.date
        );
      }).length;

      point[worker.name] = completedCount + touchedCount * 0.5;
    }

    return point;
  });
  const activeWorkerCount = data.workers.filter(
    (worker) => worker.status === "active",
  ).length;
  const attendanceChartData: AttendanceChartPoint[] = attendanceDays.map(
    (day) => {
      const dayAttendance = data.attendance.filter(
        (entry) => entry.attendance_date === day.date,
      );
      const markedCount = new Set(dayAttendance.map((entry) => entry.worker_id))
        .size;

      return {
        absent: dayAttendance.filter((entry) => entry.status === "absent")
          .length,
        half_day: dayAttendance.filter((entry) => entry.status === "half_day")
          .length,
        label: day.label,
        leave: dayAttendance.filter((entry) => entry.status === "leave").length,
        present: dayAttendance.filter((entry) => entry.status === "present")
          .length,
        unmarked: Math.max(activeWorkerCount - markedCount, 0),
      };
    },
  );

  const todayCollections = data.orderPayments
    .filter((payment) => payment.payment_date === todayIso)
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const todayExpenses = data.expenses
    .filter((expense) => expense.expense_date === todayIso)
    .reduce((total, expense) => total + Number(expense.amount), 0);
  const activeOrders = data.orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.order_status),
  );
  const openOrderReceivables = data.orders.reduce(
    (total, order) =>
      total +
      Math.max(Number(order.total_amount) - Number(order.amount_paid), 0),
    0,
  );
  const activeDues = data.dues.filter(
    (entry) =>
      entry.status !== "cancelled" &&
      !(entry.type === "receivable" && entry.linked_order_id),
  );
  const manualReceivables = activeDues.filter(
    (entry) => entry.type === "receivable",
  );
  const manualPayables = activeDues.filter((entry) => entry.type === "payable");
  const openManualReceivables = manualReceivables.reduce(
    (total, entry) => total + getDueBalance(entry),
    0,
  );
  const openManualPayables = manualPayables.reduce(
    (total, entry) => total + getDueBalance(entry),
    0,
  );
  const overdueDues = activeDues.filter(
    (entry) =>
      entry.due_date && entry.due_date < todayIso && getDueBalance(entry) > 0,
  );
  const upcomingDues = activeDues.filter(
    (entry) =>
      entry.due_date &&
      entry.due_date >= todayIso &&
      entry.due_date <= dueSoonIso &&
      getDueBalance(entry) > 0,
  );
  const deliveredOrDoneStatuses = [
    "completed",
    "ready_for_pickup",
    "ready_for_dispatch",
    "dispatched",
    "delivered",
    "cancelled",
  ];
  const dueSoonItems = data.items.filter(
    (item) =>
      item.expected_completion_date &&
      item.expected_completion_date >= todayIso &&
      item.expected_completion_date <= dueSoonIso &&
      !isCompletedItem(item.item_status),
  );
  const delayedItems = data.items.filter(
    (item) =>
      item.expected_completion_date &&
      item.expected_completion_date < todayIso &&
      !isCompletedItem(item.item_status),
  );
  const blockedItems = data.items.filter(
    (item) => item.item_status === "blocked",
  );
  const staleReadyItems = data.items.filter(
    (item) => currentStageByItemId.get(item.id)?.status === "ready_to_start",
  );
  const staleInProgressItems = data.items.filter(
    (item) => currentStageByItemId.get(item.id)?.status === "in_progress",
  );
  const readyHandoffItems = data.items.filter((item) =>
    ["ready_for_pickup", "ready_for_dispatch", "dispatched"].includes(
      item.item_status,
    ),
  );
  const riskItems = [
    ...delayedItems,
    ...blockedItems,
    ...staleReadyItems,
    ...staleInProgressItems,
    ...dueSoonItems,
  ]
    .filter(
      (item, index, rows) =>
        rows.findIndex((row) => row.id === item.id) === index,
    )
    .slice(0, 12);
  const attendanceToday = data.attendance.filter(
    (entry) => entry.attendance_date === todayIso,
  );
  const attendanceMarkedWorkerIds = new Set(
    attendanceToday.map((entry) => entry.worker_id),
  );
  const attendanceNotMarked = data.workers.filter(
    (worker) =>
      worker.status === "active" && !attendanceMarkedWorkerIds.has(worker.id),
  );
  const attendanceAlerts = attendanceToday.filter((entry) =>
    ["absent", "half_day", "leave"].includes(entry.status),
  );
  const attentionItems = [
    ...delayedItems
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        label: "Delayed item",
        title: item.name,
        status: item.item_status,
        href: `/production/items/${item.id}/workflow`,
      })),
    ...blockedItems
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        label: "Blocked item",
        title: item.name,
        status: item.item_status,
        href: `/production/items/${item.id}/workflow`,
      })),
    ...readyHandoffItems
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        label: "Ready handoff",
        title: item.name,
        status: item.item_status,
        href: `/production/items/${item.id}/workflow`,
      })),
    ...overdueDues
      .slice(0, 4)
      .map((entry) => ({
        id: entry.id,
        label:
          entry.type === "receivable"
            ? "Overdue receivable"
            : "Overdue payable",
        title: entry.party_name,
        status: "overdue",
        href: "/finance?tab=dashboard",
      })),
  ].slice(0, 10);

  const showSales = activeTab === "overview" || activeTab === "sales";
  const showProduction =
    activeTab === "overview" ||
    activeTab === "production" ||
    activeTab === "alerts";
  const showWorkers = activeTab === "overview" || activeTab === "workers";
  const showFinance =
    activeTab === "overview" ||
    activeTab === "finance" ||
    activeTab === "alerts";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description={`${data.context.tenant.store_name} business command center: sales, production control, worker productivity, finance pressure, and alerts.`}
      />

      <CommandBar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {dashboardTabs.map((tab) => (
            <Button
              key={tab.value}
              asChild
              size="sm"
              variant={activeTab === tab.value ? "default" : "outline"}
            >
              <Link href={buildHref(tab.value, salesMode)}>{tab.label}</Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant={salesMode === "amount" ? "default" : "outline"}
          >
            <Link href={buildHref(activeTab, "amount")}>Amount</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={salesMode === "count" ? "default" : "outline"}
          >
            <Link href={buildHref(activeTab, "count")}>Count</Link>
          </Button>
        </div>
      </CommandBar>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Active orders"
          value={activeOrders.length}
          hint="Not delivered or cancelled"
        />
        <MetricCard
          label="Delayed items"
          value={delayedItems.length}
          hint="Past expected date"
        />
        <MetricCard
          label="Ready handoff"
          value={readyHandoffItems.length}
          hint="Pickup, dispatch, delivery"
        />
        <MetricCard
          label="Today cash"
          value={formatMoney(todayCollections - todayExpenses)}
          hint={`${formatMoney(todayCollections)} in, ${formatMoney(todayExpenses)} out`}
        />
        <MetricCard
          label="Receivables"
          value={formatMoney(openOrderReceivables + openManualReceivables)}
          hint="Order + manual balances"
        />
        <MetricCard
          label="Payables"
          value={formatMoney(openManualPayables)}
          hint={`${manualPayables.length} manual records`}
        />
      </div>

      {showSales ? (
        <AnalyticsCard
          title="Sales"
          description="Daily booked order value or order count for the past 14 days."
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          action={
            <ChartPane
              title="Sales drilldown"
              description="Booked order value, order count, and collections by day."
              fullHref="/dashboard/sales"
            >
              <SalesBarChart data={salesChartData} mode={salesMode} />
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Booked"
                  value={formatMoney(
                    salesChartData.reduce(
                      (total, row) => total + row.amount,
                      0,
                    ),
                  )}
                />
                <MetricCard
                  label="Orders"
                  value={salesChartData.reduce(
                    (total, row) => total + row.count,
                    0,
                  )}
                />
                <MetricCard
                  label="Collected"
                  value={formatMoney(
                    salesChartData.reduce(
                      (total, row) => total + row.collected,
                      0,
                    ),
                  )}
                />
              </div>
            </ChartPane>
          }
        >
          <SalesBarChart data={salesChartData} mode={salesMode} />
        </AnalyticsCard>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {showWorkers ? (
          <AnalyticsCard
            title="Worker Productivity"
            description="MVP unit signal: completed stages count as 1, touched work counts as 0.5."
            icon={<LineChart className="h-4 w-4 text-muted-foreground" />}
            action={
              <ChartPane
                title="Worker productivity drilldown"
                description="Past 7 days across active workers. Full view will add worker checkboxes and custom grouping."
                fullHref="/dashboard/workers"
              >
                <WorkerLineChart data={workerChartData} workers={workerNames} />
              </ChartPane>
            }
          >
            <WorkerLineChart data={workerChartData} workers={workerNames} />
          </AnalyticsCard>
        ) : null}

        {showWorkers ? (
          <AnalyticsCard
            title="Attendance"
            description="Past 7 days attendance split across active workers."
            icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
            action={
              <ChartPane
                title="Attendance drilldown"
                description="Daily presence, absence, leave, half-day, and unmarked signals."
                fullHref="/attendance"
              >
                <AttendanceStackedBarChart data={attendanceChartData} />
              </ChartPane>
            }
          >
            <AttendanceStackedBarChart data={attendanceChartData} />
          </AnalyticsCard>
        ) : null}

        {showFinance ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Finance Pressure</CardTitle>
              </div>
              <CardDescription>
                Cash today, open dues, and upcoming/overdue obligations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Open receivables"
                  value={formatMoney(
                    openOrderReceivables + openManualReceivables,
                  )}
                />
                <MetricCard
                  label="Open payables"
                  value={formatMoney(openManualPayables)}
                />
              </div>
              {[...overdueDues, ...upcomingDues].slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{entry.party_name}</p>
                      <StatusBadge
                        value={
                          entry.due_date && entry.due_date < todayIso
                            ? "overdue"
                            : "due soon"
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.type} · Due {formatDate(entry.due_date)}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatMoney(getDueBalance(entry))}
                  </p>
                </div>
              ))}
              {!overdueDues.length && !upcomingDues.length ? (
                <p className="text-sm text-muted-foreground">
                  No urgent dues in the next 2 days.
                </p>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href="/finance">Open finance</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {showProduction ? (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Stale / At-Risk Items
                </CardTitle>
              </div>
              <CardDescription>
                Delayed, blocked, due-soon, ready-to-start, and in-progress
                items needing control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {riskItems.map((item) => {
                const order = orderById.get(item.order_id);
                const stage = currentStageByItemId.get(item.id);
                const stageName = stage
                  ? stageById.get(stage.stage_master_id)?.name
                  : null;
                const workflowName = workflowById.get(item.workflow_id)?.name;

                return (
                  <div
                    key={item.id}
                    className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-[1fr_120px] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{item.name}</p>
                        <StatusBadge value={item.item_status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {order?.order_number ?? "Order"} ·{" "}
                        {workflowName ?? "Workflow"} ·{" "}
                        {stageName ?? "No current stage"} · Due{" "}
                        {formatDate(item.expected_completion_date)}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/production/items/${item.id}/workflow`}>
                        Workflow
                      </Link>
                    </Button>
                  </div>
                );
              })}
              {!riskItems.length ? (
                <p className="text-sm text-muted-foreground">
                  No stale or at-risk items in the current queue.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Attention Queue</CardTitle>
              </div>
              <CardDescription>
                Top items that need owner or manager attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {attentionItems.map((item) => (
                <div
                  key={`${item.label}-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{item.title}</p>
                      <StatusBadge value={item.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={item.href}>Open</Link>
                  </Button>
                </div>
              ))}
              {attendanceNotMarked.length ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="font-medium">Attendance not marked</p>
                  <p className="mt-1 text-muted-foreground">
                    {attendanceNotMarked.length} active worker record needs
                    attendance today.
                  </p>
                </div>
              ) : null}
              {attendanceAlerts.length ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium">Attendance alerts</p>
                  <p className="mt-1 text-muted-foreground">
                    {attendanceAlerts.length} absence, leave, or half-day record
                    today.
                  </p>
                </div>
              ) : null}
              {!attentionItems.length &&
              !attendanceNotMarked.length &&
              !attendanceAlerts.length ? (
                <p className="text-sm text-muted-foreground">
                  No urgent alerts right now.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Dashboard analytics are tenant-scoped and operational. Sales uses booked
        order value, cash uses actual payments/expenses, and productivity is an
        MVP signal separate from salary finalization.
      </p>
    </div>
  );
}
