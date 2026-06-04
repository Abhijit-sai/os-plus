import Link from "next/link";

import { WorkerLineChart, type WorkerChartPoint } from "@/components/dashboard/analytics-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardPageData } from "@/features/dashboard/queries";

type RangeKey = "7d" | "30d" | "mtd" | "ytd" | "custom";
type GroupKey = "day" | "month";

const rangeOptions: Array<{ value: RangeKey; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" }
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

function getRangeBounds(range: RangeKey, start?: string, end?: string) {
  const today = startOfToday();

  if (range === "7d") {
    return { start: addDays(today, -6), end: today };
  }

  if (range === "mtd") {
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }

  if (range === "ytd") {
    return { start: new Date(today.getFullYear(), 0, 1), end: today };
  }

  if (range === "custom" && start && end) {
    return { start: new Date(`${start}T00:00:00`), end: new Date(`${end}T00:00:00`) };
  }

  return { start: addDays(today, -29), end: today };
}

function getDaysInRange(start: Date, end: Date) {
  const days: Array<{ date: string; label: string }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push({
      date: toIsoDate(cursor),
      label: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(cursor)
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getMonthsInRange(start: Date, end: Date) {
  const months: Array<{ key: string; label: string }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    const key = toIsoDate(cursor).slice(0, 7);
    months.push({
      key,
      label: new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(cursor)
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function buildWorkersHref({
  range,
  group,
  workers,
  start,
  end
}: {
  range: RangeKey;
  group: GroupKey;
  workers: string[];
  start?: string;
  end?: string;
}) {
  const params = new URLSearchParams({ range, group });

  if (workers.length) {
    params.set("workers", workers.join(","));
  }

  if (range === "custom") {
    if (start) {
      params.set("start", start);
    }

    if (end) {
      params.set("end", end);
    }
  }

  return `/dashboard/workers?${params.toString()}`;
}

function isInRange(date: string | null, range: ReturnType<typeof getRangeBounds>) {
  if (!date) {
    return false;
  }

  const value = new Date(`${date.slice(0, 10)}T00:00:00`);
  return value >= range.start && value <= range.end;
}

function normalizeWorkerParam(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

function getWorkerValueForDate({
  logs,
  date
}: {
  logs: Array<{ started_at: string; completed_at: string | null; updated_at: string | null }>;
  date: string;
}) {
  const completedCount = logs.filter((log) => log.completed_at?.slice(0, 10) === date).length;
  const touchedCount = logs.filter((log) => {
    const touchedDates = [log.started_at?.slice(0, 10), log.updated_at?.slice(0, 10)].filter(Boolean);
    return touchedDates.includes(date) && log.completed_at?.slice(0, 10) !== date;
  }).length;

  return completedCount + touchedCount * 0.5;
}

export default async function DashboardWorkersPage({
  searchParams
}: {
  searchParams?: Promise<{ range?: string; group?: string; workers?: string | string[]; start?: string; end?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeRange = rangeOptions.some((range) => range.value === resolvedSearchParams?.range) ? (resolvedSearchParams?.range as RangeKey) : "7d";
  const activeGroup: GroupKey = resolvedSearchParams?.group === "month" ? "month" : "day";
  const customStart = resolvedSearchParams?.start;
  const customEnd = resolvedSearchParams?.end;
  const range = getRangeBounds(activeRange, customStart, customEnd);
  const data = await getDashboardPageData();
  const activeWorkers = data.workers.filter((worker) => worker.status === "active");
  const selectedWorkerIds = normalizeWorkerParam(resolvedSearchParams?.workers);
  const selectedWorkers = selectedWorkerIds.length ? activeWorkers.filter((worker) => selectedWorkerIds.includes(worker.id)) : activeWorkers.slice(0, 8);
  const selectedWorkerNames = selectedWorkers.map((worker) => worker.name);
  const rangeLogs = data.workLogs.filter((log) => isInRange(log.started_at, range) || isInRange(log.completed_at, range) || isInRange(log.updated_at, range));
  const workerChartData: WorkerChartPoint[] =
    activeGroup === "month"
      ? getMonthsInRange(range.start, range.end).map((month) => {
          const point: WorkerChartPoint = { label: month.label };

          for (const worker of selectedWorkers) {
            const workerLogs = rangeLogs.filter((log) => log.worker_id === worker.id);
            const completedCount = workerLogs.filter((log) => log.completed_at?.slice(0, 7) === month.key).length;
            const touchedCount = workerLogs.filter((log) => {
              const touchedMonths = [log.started_at?.slice(0, 7), log.updated_at?.slice(0, 7)].filter(Boolean);
              return touchedMonths.includes(month.key) && log.completed_at?.slice(0, 7) !== month.key;
            }).length;

            point[worker.name] = completedCount + touchedCount * 0.5;
          }

          return point;
        })
      : getDaysInRange(range.start, range.end).map((day) => {
          const point: WorkerChartPoint = { label: day.label };

          for (const worker of selectedWorkers) {
            point[worker.name] = getWorkerValueForDate({
              logs: rangeLogs.filter((log) => log.worker_id === worker.id),
              date: day.date
            });
          }

          return point;
        });
  const totalSignal = workerChartData.reduce(
    (total, point) =>
      total +
      selectedWorkerNames.reduce((workerTotal, worker) => {
        const value = point[worker];
        return workerTotal + (typeof value === "number" ? value : 0);
      }, 0),
    0
  );
  const completedLogs = rangeLogs.filter((log) => log.completed_at && isInRange(log.completed_at, range)).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Worker Analytics"
        description="Worker productivity signal with range, grouping, and worker selection controls."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard?tab=workers">Back to dashboard</Link>
          </Button>
        }
      />

      <CommandBar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((option) => (
            <Button key={option.value} asChild size="sm" variant={activeRange === option.value ? "default" : "outline"}>
              <Link href={buildWorkersHref({ range: option.value, group: activeGroup, workers: selectedWorkers.map((worker) => worker.id), start: customStart, end: customEnd })}>{option.label}</Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={activeGroup === "day" ? "default" : "outline"}>
            <Link href={buildWorkersHref({ range: activeRange, group: "day", workers: selectedWorkers.map((worker) => worker.id), start: customStart, end: customEnd })}>Daily</Link>
          </Button>
          <Button asChild size="sm" variant={activeGroup === "month" ? "default" : "outline"}>
            <Link href={buildWorkersHref({ range: activeRange, group: "month", workers: selectedWorkers.map((worker) => worker.id), start: customStart, end: customEnd })}>Monthly</Link>
          </Button>
        </div>
      </CommandBar>

      <form action="/dashboard/workers" className="space-y-3 rounded-[14px] border bg-background p-3 shadow-sm">
        <input type="hidden" name="range" value="custom" />
        <input type="hidden" name="group" value={activeGroup} />
        <div className="flex flex-wrap items-center gap-2">
          <Input name="start" type="date" defaultValue={customStart ?? toIsoDate(range.start)} className="h-9 w-[150px]" aria-label="Custom start date" />
          <Input name="end" type="date" defaultValue={customEnd ?? toIsoDate(range.end)} className="h-9 w-[150px]" aria-label="Custom end date" />
          <Button size="sm" type="submit" variant={activeRange === "custom" ? "default" : "outline"}>
            Apply filters
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {activeWorkers.map((worker) => (
            <label key={worker.id} className="flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="workers"
                value={worker.id}
                defaultChecked={selectedWorkers.some((selected) => selected.id === worker.id)}
                className="h-4 w-4 accent-black"
              />
              <span className="truncate">{worker.name}</span>
            </label>
          ))}
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Selected workers" value={selectedWorkers.length} />
        <MetricCard label="Productivity signal" value={totalSignal.toFixed(1)} hint={`${toIsoDate(range.start)} to ${toIsoDate(range.end)}`} />
        <MetricCard label="Completed work logs" value={completedLogs} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker Productivity</CardTitle>
          <CardDescription>
            {activeGroup === "day" ? "Daily" : "Monthly"} view. Completed stage work counts as 1. Touched but not completed work counts as 0.5.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkerLineChart data={workerChartData} workers={selectedWorkerNames} />
        </CardContent>
      </Card>
    </div>
  );
}
