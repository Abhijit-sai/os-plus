import Link from "next/link";

import { WorkerLineChart, type WorkerChartPoint } from "@/components/dashboard/analytics-charts";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  aggregateWorkerContributions,
  buildWeeklyContributionTrend,
  type WorkerContributionMetric,
} from "@/features/dashboard/worker-contributions";
import { getWorkerContributionReportData } from "@/features/dashboard/queries";

type RangeKey = "8w" | "30d" | "mtd" | "ytd" | "custom";

const rangeOptions: Array<{ label: string; value: RangeKey }> = [
  { label: "8W", value: "8w" },
  { label: "30D", value: "30d" },
  { label: "MTD", value: "mtd" },
  { label: "YTD", value: "ytd" },
  { label: "Custom", value: "custom" },
];

const metricOptions: Array<{ label: string; value: WorkerContributionMetric }> = [
  { label: "Contribution value", value: "contribution" },
  { label: "Credited units", value: "units" },
  { label: "Man-hours", value: "hours" },
  { label: "Completed stages", value: "stages" },
];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function getRangeBounds(range: RangeKey, start?: string, end?: string) {
  const today = startOfToday();
  if (range === "8w") return { end: today, start: addDays(today, -55) };
  if (range === "30d") return { end: today, start: addDays(today, -29) };
  if (range === "mtd") return { end: today, start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) };
  if (range === "ytd") return { end: today, start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)) };
  if (range === "custom" && start && end) {
    const customStart = new Date(`${start}T00:00:00.000Z`);
    const customEnd = new Date(`${end}T00:00:00.000Z`);
    if (Number.isFinite(customStart.getTime()) && Number.isFinite(customEnd.getTime()) && customStart <= customEnd) {
      return { end: customEnd, start: customStart };
    }
  }
  return { end: today, start: addDays(today, -55) };
}

function normalizeWorkerParam(value: string | string[] | undefined) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

function metricValue(summary: ReturnType<typeof aggregateWorkerContributions>[number], metric: WorkerContributionMetric) {
  if (metric === "contribution") return summary.contributionAmount;
  if (metric === "units") return summary.creditedUnits;
  if (metric === "hours") return summary.creditedMinutes / 60;
  return summary.completedStages;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 2, style: "currency" }).format(value);
}

function formatMetric(value: number, metric: WorkerContributionMetric) {
  if (metric === "contribution") return formatMoney(value);
  if (metric === "hours") return `${value.toFixed(1)}h`;
  if (metric === "units") return value.toFixed(1);
  return String(value);
}

function formatWeek(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00.000Z`));
}

function buildWorkersHref({
  basePath,
  end,
  metric,
  range,
  start,
  workers,
}: {
  basePath: string;
  end?: string;
  metric: WorkerContributionMetric;
  range: RangeKey;
  start?: string;
  workers: string[];
}) {
  const params = new URLSearchParams({ metric, range });
  if (workers.length) params.set("workers", workers.join(","));
  if (range === "custom") {
    if (start) params.set("start", start);
    if (end) params.set("end", end);
  }
  return `${basePath}?${params.toString()}`;
}

export async function WorkerContributionsReportPage({
  backHref,
  backLabel,
  basePath,
  searchParams,
}: {
  backHref: string;
  backLabel: string;
  basePath: string;
  searchParams?: Promise<{ end?: string; metric?: string; range?: string; start?: string; workers?: string | string[] }>;
}) {
  const resolved = await searchParams;
  const activeRange = rangeOptions.some((option) => option.value === resolved?.range) ? resolved?.range as RangeKey : "8w";
  const activeMetric = metricOptions.some((option) => option.value === resolved?.metric) ? resolved?.metric as WorkerContributionMetric : "contribution";
  const range = getRangeBounds(activeRange, resolved?.start, resolved?.end);
  const startDate = toIsoDate(range.start);
  const endDate = toIsoDate(range.end);
  const data = await getWorkerContributionReportData({ endDate, startDate });
  const workerById = new Map(data.workers.map((worker) => [worker.id, worker]));
  const summaries = aggregateWorkerContributions(data.logs);
  const rankedSummaries = [...summaries].sort((first, second) =>
    metricValue(second, activeMetric) - metricValue(first, activeMetric)
      || (workerById.get(first.workerId)?.name ?? "").localeCompare(workerById.get(second.workerId)?.name ?? ""));
  const requestedWorkerIds = normalizeWorkerParam(resolved?.workers).filter((workerId) => workerById.has(workerId));
  const selectedWorkerIds = requestedWorkerIds.length
    ? requestedWorkerIds
    : rankedSummaries.slice(0, 5).map((summary) => summary.workerId);
  const selectedWorkerSeries = selectedWorkerIds.map((workerId) => ({
    key: workerId,
    label: workerById.get(workerId)?.name ?? "Unknown worker",
  }));
  const weeklyTrend = buildWeeklyContributionTrend(data.logs, selectedWorkerIds, activeMetric);
  const weeklyChartData: WorkerChartPoint[] = weeklyTrend.map((point) => ({
    label: formatWeek(point.weekStart),
    ...Object.fromEntries(selectedWorkerIds.map((workerId) => [workerId, point.values[workerId] ?? 0])),
  }));
  const totalContribution = summaries.reduce((sum, summary) => sum + summary.contributionAmount, 0);
  const totalUnits = summaries.reduce((sum, summary) => sum + summary.creditedUnits, 0);
  const totalMinutes = summaries.reduce((sum, summary) => sum + summary.creditedMinutes, 0);
  const pricedAssignments = summaries.reduce((sum, summary) => sum + summary.pricedAssignments, 0);
  const totalAssignments = summaries.reduce((sum, summary) => sum + summary.totalAssignments, 0);
  const coverage = totalAssignments ? Math.round((pricedAssignments / totalAssignments) * 100) : 0;
  const currentMetricLabel = metricOptions.find((option) => option.value === activeMetric)?.label ?? "Contribution value";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Worker Contributions"
        description="Completed production credit by worker. These values support comparison and do not calculate salary."
        actions={<Button asChild variant="outline"><Link href={backHref}>{backLabel}</Link></Button>}
      />

      <CommandBar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((option) => (
            <Button asChild key={option.value} size="sm" variant={activeRange === option.value ? "default" : "outline"}>
              <Link href={buildWorkersHref({ basePath, end: resolved?.end, metric: activeMetric, range: option.value, start: resolved?.start, workers: selectedWorkerIds })}>{option.label}</Link>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{startDate} to {endDate}</p>
      </CommandBar>

      <form action={basePath} className="space-y-3 rounded-[14px] border bg-background p-3 shadow-sm">
        <input name="range" type="hidden" value="custom" />
        <input name="metric" type="hidden" value={activeMetric} />
        <div className="flex flex-wrap items-center gap-2">
          <Input aria-label="Custom start date" className="h-9 w-[150px]" defaultValue={resolved?.start ?? startDate} name="start" type="date" />
          <Input aria-label="Custom end date" className="h-9 w-[150px]" defaultValue={resolved?.end ?? endDate} name="end" type="date" />
          <Button size="sm" type="submit" variant={activeRange === "custom" ? "default" : "outline"}>Apply filters</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {data.workers.map((worker) => (
            <label className="flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm" key={worker.id}>
              <input className="h-4 w-4 accent-black" defaultChecked={selectedWorkerIds.includes(worker.id)} name="workers" type="checkbox" value={worker.id} />
              <span className="truncate">{worker.name}{worker.status !== "active" ? " (inactive)" : ""}</span>
            </label>
          ))}
        </div>
      </form>

      <div className="grid overflow-hidden rounded-[14px] border bg-background sm:grid-cols-2 xl:grid-cols-4">
        <div className="p-4"><p className="text-xs text-muted-foreground">Contribution value</p><p className="mt-1 font-semibold">{formatMoney(totalContribution)}</p></div>
        <div className="border-t p-4 sm:border-l sm:border-t-0"><p className="text-xs text-muted-foreground">Credited units</p><p className="mt-1 font-semibold">{totalUnits.toFixed(1)}</p></div>
        <div className="border-t p-4 xl:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Man-hours</p><p className="mt-1 font-semibold">{(totalMinutes / 60).toFixed(1)}h</p></div>
        <div className="border-t p-4 sm:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Configuration coverage</p><p className="mt-1 font-semibold">{coverage}%</p><p className="mt-1 text-xs text-muted-foreground">{pricedAssignments}/{totalAssignments} completed assignments priced</p></div>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Contribution leaderboard</CardTitle>
            <CardDescription>Rank workers using one comparable measure at a time. Zero values can indicate a missing garment-stage rule.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {metricOptions.map((option) => (
              <Button asChild key={option.value} size="sm" variant={activeMetric === option.value ? "default" : "outline"}>
                <Link href={buildWorkersHref({ basePath, end: resolved?.end, metric: option.value, range: activeRange, start: resolved?.start, workers: selectedWorkerIds })}>{option.label}</Link>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Worker</th><th className="px-4 py-3">{currentMetricLabel}</th><th className="px-4 py-3">Units</th><th className="px-4 py-3">Man-hours</th><th className="px-4 py-3">Stages</th><th className="px-4 py-3">Coverage</th></tr>
            </thead>
            <tbody className="divide-y">
              {rankedSummaries.map((summary, index) => (
                <tr key={summary.workerId}>
                  <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{workerById.get(summary.workerId)?.name ?? "Unknown worker"}</td>
                  <td className="px-4 py-3 font-semibold">{formatMetric(metricValue(summary, activeMetric), activeMetric)}</td>
                  <td className="px-4 py-3">{summary.creditedUnits.toFixed(1)}</td>
                  <td className="px-4 py-3">{(summary.creditedMinutes / 60).toFixed(1)}h</td>
                  <td className="px-4 py-3">{summary.completedStages}</td>
                  <td className="px-4 py-3">{summary.pricedAssignments}/{summary.totalAssignments}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rankedSummaries.length ? <p className="p-6 text-sm text-muted-foreground">No completed worker contributions in this range. New feature-era completions will appear here.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly contribution trend</CardTitle>
          <CardDescription>{currentMetricLabel} by completion week for the selected workers. Corrections update the original completion week.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkerLineChart
            data={weeklyChartData}
            valueKind={activeMetric === "contribution" ? "money" : activeMetric === "hours" ? "hours" : activeMetric === "units" ? "units" : "count"}
            workers={selectedWorkerSeries}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function DashboardWorkersPage(props: {
  searchParams?: Promise<{ end?: string; metric?: string; range?: string; start?: string; workers?: string | string[] }>;
}) {
  return WorkerContributionsReportPage({
    backHref: "/dashboard?tab=workers",
    backLabel: "Back to dashboard",
    basePath: "/dashboard/workers",
    searchParams: props.searchParams,
  });
}
