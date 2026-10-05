import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import Link from "next/link";

import { WorkerLineChart, type WorkerChartPoint } from "@/components/dashboard/analytics-charts";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  aggregateContributionCategories,
  aggregateWorkerContributions,
  buildWeeklyContributionTrend,
  filterWorkerContributionLogs,
  normalizeContributionFilterIds as normalizeWorkers,
  type WorkerContributionMetric,
} from "@/features/dashboard/worker-contributions";
import { getWorkerContributionReportData } from "@/features/dashboard/queries";

type RangeKey = "8w" | "30d" | "mtd" | "ytd" | "custom";
type SortKey = "highest" | "lowest" | "name";
type ReportSearchParams = {
  end?: string;
  itemType?: string | string[];
  metric?: string;
  range?: string;
  sort?: string;
  stage?: string | string[];
  start?: string;
  workers?: string | string[];
  workgroup?: string | string[];
};

const rangeOptions: Array<{ label: string; value: RangeKey }> = [
  { label: "8W", value: "8w" }, { label: "30D", value: "30d" },
  { label: "MTD", value: "mtd" }, { label: "YTD", value: "ytd" },
  { label: "Custom", value: "custom" },
];

const allMetricOptions: Array<{ label: string; value: WorkerContributionMetric }> = [
  { label: "Contribution value", value: "contribution" },
  { label: "Credited units", value: "units" },
  { label: "Credited hours", value: "hours" },
  { label: "Completed stages", value: "stages" },
];

function toIsoDate(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
function startOfToday() { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); }
function getRangeBounds(range: RangeKey, start?: string, end?: string) {
  const today = startOfToday();
  if (range === "8w") return { end: today, start: addDays(today, -55) };
  if (range === "30d") return { end: today, start: addDays(today, -29) };
  if (range === "mtd") return { end: today, start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) };
  if (range === "ytd") return { end: today, start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)) };
  if (range === "custom" && start && end) {
    const customStart = new Date(`${start}T00:00:00.000Z`); const customEnd = new Date(`${end}T00:00:00.000Z`);
    if (Number.isFinite(customStart.getTime()) && Number.isFinite(customEnd.getTime()) && customStart <= customEnd) return { end: customEnd, start: customStart };
  }
  return { end: today, start: addDays(today, -55) };
}
function metricValue(summary: ReturnType<typeof aggregateWorkerContributions>[number], metric: WorkerContributionMetric) {
  if (metric === "contribution") return summary.contributionAmount;
  if (metric === "units") return summary.creditedUnits;
  if (metric === "hours") return summary.creditedMinutes / 60;
  return summary.completedStages;
}
function formatMoney(value: number) { return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 2, style: "currency" }).format(value); }
function formatMetric(value: number, metric: WorkerContributionMetric) {
  if (metric === "contribution") return formatMoney(value);
  if (metric === "hours") return `${value.toFixed(1)}h`;
  if (metric === "units") return value.toFixed(1);
  return String(value);
}
function formatWeek(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00.000Z`)); }
function effortLabel(mode: "none" | "units" | "hours" | "hybrid") {
  return mode === "none" ? "Assignment only" : mode === "units" ? "Credited units" : mode === "hours" ? "Credited hours" : "Units and hours";
}
function buildWorkersHref(args: {
  basePath: string; end?: string; itemType?: string | string[]; metric: WorkerContributionMetric; range: RangeKey;
  sort: SortKey; stage?: string | string[]; start?: string; workers: string[]; workgroup?: string | string[];
}) {
  const params = new URLSearchParams({ metric: args.metric, range: args.range, sort: args.sort });
  if (args.workers.length) params.set("workers", args.workers.join(","));
  if (args.itemType) params.set("itemType", normalizeWorkers(args.itemType).join(","));
  if (args.stage) params.set("stage", normalizeWorkers(args.stage).join(","));
  if (args.workgroup) params.set("workgroup", normalizeWorkers(args.workgroup).join(","));
  if (args.range === "custom") { if (args.start) params.set("start", args.start); if (args.end) params.set("end", args.end); }
  return `${args.basePath}?${params.toString()}`;
}

export async function WorkerContributionsReportPage({ backHref, backLabel, basePath, searchParams }: {
  backHref: string; backLabel: string; basePath: string; searchParams?: Promise<ReportSearchParams>;
}) {
  const resolved = await searchParams;
  const activeRange = rangeOptions.some((option) => option.value === resolved?.range) ? resolved?.range as RangeKey : "8w";
  const range = getRangeBounds(activeRange, resolved?.start, resolved?.end);
  const startDate = toIsoDate(range.start); const endDate = toIsoDate(range.end);
  const data = await getWorkerContributionReportData({ endDate, startDate });
  const activeSort: SortKey = ["highest", "lowest", "name"].includes(resolved?.sort ?? "") ? resolved?.sort as SortKey : "highest";
  const workerById = new Map(data.workers.map((worker) => [worker.id, worker]));
  const itemTypeById = new Map(data.itemTypes.map((itemType) => [itemType.id, itemType]));
  const stageById = new Map(data.stages.map((stage) => [stage.id, stage]));
  const selectedItemType = normalizeWorkers(resolved?.itemType);
  const selectedStage = normalizeWorkers(resolved?.stage);
  const selectedWorkgroup = normalizeWorkers(resolved?.workgroup);
  const requestedWorkerIds = normalizeWorkers(resolved?.workers);
  const validRequestedWorkerIds = requestedWorkerIds.filter((workerId) => workerById.has(workerId));
  const invalid = (ids: string[], options: { id: string }[]) => ids.some((id) => id !== "__none__" && !options.some((entry) => entry.id === id));
  const hasInvalidFilter = invalid(selectedItemType, data.itemTypes) || invalid(selectedStage, data.stages)
    || invalid(selectedWorkgroup, data.workgroups) || invalid(requestedWorkerIds, data.workers);
  const filteredLogs = hasInvalidFilter ? [] : filterWorkerContributionLogs(data.logs, {
    itemTypeIds: selectedItemType,
    stageIds: selectedStage,
    workerIds: requestedWorkerIds,
    workgroupIds: selectedWorkgroup,
  });
  const availableModes = new Set(filteredLogs.map((log) => log.effortMode));
  const metricOptions = allMetricOptions.filter((option) => {
    if (option.value === "contribution") return data.canViewContributionAmounts && [...availableModes].some((mode) => mode !== "none");
    if (option.value === "units") return availableModes.has("units") || availableModes.has("hybrid");
    if (option.value === "hours") return availableModes.has("hours") || availableModes.has("hybrid");
    return true;
  });
  const defaultMetric: WorkerContributionMetric = metricOptions.find((option) => option.value === (data.canViewContributionAmounts ? "contribution" : "units"))?.value
    ?? metricOptions.find((option) => option.value === "hours")?.value
    ?? "stages";
  const activeMetric = metricOptions.some((option) => option.value === resolved?.metric) ? resolved?.metric as WorkerContributionMetric : defaultMetric;
  const summaries = aggregateWorkerContributions(filteredLogs);
  const rankedSummaries = [...summaries].sort((first, second) => {
    if (activeSort === "name") return (workerById.get(first.workerId)?.name ?? "").localeCompare(workerById.get(second.workerId)?.name ?? "");
    const delta = metricValue(second, activeMetric) - metricValue(first, activeMetric);
    return (activeSort === "lowest" ? -delta : delta) || (workerById.get(first.workerId)?.name ?? "").localeCompare(workerById.get(second.workerId)?.name ?? "");
  });
  const selectedWorkerIds = validRequestedWorkerIds.length ? validRequestedWorkerIds : rankedSummaries.slice(0, 5).map((summary) => summary.workerId);
  const trendWorkerIds = selectedWorkerIds.slice(0, 5);
  const weeklyTrend = buildWeeklyContributionTrend(filteredLogs, trendWorkerIds, activeMetric);
  const weeklyChartData: WorkerChartPoint[] = weeklyTrend.map((point) => ({ label: formatWeek(point.weekStart), ...Object.fromEntries(trendWorkerIds.map((workerId) => [workerId, point.values[workerId] ?? 0])) }));
  const categorySummaries = aggregateContributionCategories(filteredLogs).sort((first, second) =>
    (itemTypeById.get(first.itemTypeId)?.name ?? "").localeCompare(itemTypeById.get(second.itemTypeId)?.name ?? "")
    || (stageById.get(first.stageId)?.name ?? "").localeCompare(stageById.get(second.stageId)?.name ?? ""));
  const totalContribution = summaries.reduce((sum, entry) => sum + entry.contributionAmount, 0);
  const totalUnits = summaries.reduce((sum, entry) => sum + entry.creditedUnits, 0);
  const totalMinutes = summaries.reduce((sum, entry) => sum + entry.creditedMinutes, 0);
  const totalStages = new Set(filteredLogs.map((log) => log.stageInstanceId)).size;
  const rateApplicableLogs = filteredLogs.filter((log) => log.effortMode !== "none");
  const pricedAssignments = rateApplicableLogs.filter((log) => log.rateConfigured).length;
  const configurationCoverage = rateApplicableLogs.length ? Math.round((pricedAssignments / rateApplicableLogs.length) * 100) : 100;
  const currentMetricLabel = metricOptions.find((option) => option.value === activeMetric)?.label ?? "Credited units";
  const hrefArgs = { basePath, end: resolved?.end, itemType: selectedItemType, metric: activeMetric, range: activeRange, sort: activeSort, stage: selectedStage, start: resolved?.start, workers: requestedWorkerIds, workgroup: selectedWorkgroup };

  return <div className="space-y-5">
    <PageHeader title="Worker Contributions" description={data.canViewContributionAmounts
      ? "Compare completed work by item category, stage, worker, units, hours, and contribution value."
      : "Compare completed work by item category, stage, worker, units, and hours."}
      actions={<Button asChild variant="outline"><Link href={backHref}>{backLabel}</Link></Button>} />

    <CommandBar className="justify-between">
      <div className="flex flex-wrap items-center gap-2">{rangeOptions.map((option) => <Button asChild key={option.value} size="sm" variant={activeRange === option.value ? "default" : "outline"}><Link href={buildWorkersHref({ ...hrefArgs, range: option.value })}>{option.label}</Link></Button>)}</div>
      <p className="text-xs text-muted-foreground">{startDate} to {endDate}</p>
    </CommandBar>

    <form key={JSON.stringify(resolved)} action={basePath} className="space-y-3 rounded-xl border bg-background p-4">
      <input name="range" type="hidden" value="custom" /><input name="metric" type="hidden" value={activeMetric} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MultiSelectFilter label="Item categories" name="itemType" options={data.itemTypes} selected={selectedItemType} />
        <MultiSelectFilter label="Work stages" name="stage" options={data.stages} selected={selectedStage} />
        <MultiSelectFilter label="Workgroups" name="workgroup" options={data.workgroups} selected={selectedWorkgroup} />
        <MultiSelectFilter label="Workers" name="workers" options={data.workers.map((worker) => ({ id: worker.id, name: worker.name + (worker.status !== "active" ? " (inactive)" : "") }))} selected={requestedWorkerIds} />
      </div>
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="grid gap-1 text-xs text-muted-foreground">From<Input defaultValue={startDate} name="start" type="date" required /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">To<Input defaultValue={endDate} name="end" type="date" required /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">Sort workers<select className="h-10 rounded-md border bg-background px-3 text-sm text-foreground" defaultValue={activeSort} name="sort"><option value="highest">Highest first</option><option value="lowest">Lowest first</option><option value="name">Name</option></select></label>
        <div className="flex items-center gap-2"><Button type="submit">Apply filters</Button><Button asChild variant="ghost"><Link href={basePath}>Reset</Link></Button></div>
      </div>
    </form>
    {hasInvalidFilter ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">One or more filters are invalid or unavailable for this business. No contribution data is shown.</div> : null}

    <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-background xl:grid-cols-5">
      {data.canViewContributionAmounts && availableModes.size && [...availableModes].some((mode) => mode !== "none") ? <div className="p-4"><p className="text-xs text-muted-foreground">Contribution value</p><p className="mt-1 font-semibold">{formatMoney(totalContribution)}</p></div> : null}
      {availableModes.has("units") || availableModes.has("hybrid") ? <div className="border-t p-4 sm:border-l sm:border-t-0"><p className="text-xs text-muted-foreground">Credited units</p><p className="mt-1 font-semibold">{totalUnits.toFixed(1)}</p></div> : null}
      {availableModes.has("hours") || availableModes.has("hybrid") ? <div className="border-t p-4 xl:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Credited hours</p><p className="mt-1 font-semibold">{(totalMinutes / 60).toFixed(1)}h</p></div> : null}
      <div className="border-t p-4 sm:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Completed stages</p><p className="mt-1 font-semibold">{totalStages}</p></div>
      {data.canViewContributionAmounts && rateApplicableLogs.length ? <div className="border-t p-4 sm:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Rate coverage</p><p className="mt-1 font-semibold">{configurationCoverage}%</p><p className="mt-1 text-xs text-muted-foreground">{pricedAssignments}/{rateApplicableLogs.length} rate-applicable assignments</p></div> : null}
    </div>

    <section className="overflow-hidden rounded-xl border bg-background" aria-labelledby="category-overview">
      <div className="p-4"><h3 id="category-overview" className="font-semibold">By item category</h3><p className="mt-1 text-sm text-muted-foreground">Open a category for its stages. Choose a stage to compare its workers.</p></div>
      {[...new Set(categorySummaries.map((summary) => summary.itemTypeId))].map((itemTypeId) => {
        const rows = categorySummaries.filter((summary) => summary.itemTypeId === itemTypeId);
        return <details key={itemTypeId} className="group border-t" open={selectedItemType.length === 1}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
            <span className="font-medium">{itemTypeById.get(itemTypeId)?.name ?? "Unknown category"}</span>
            <span className="flex items-center gap-4 text-sm text-muted-foreground">{rows.length} stage groups<span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span></span>
          </summary>
          <div className="divide-y border-t bg-muted/10 px-4">
            {rows.map((summary) => <div key={`${summary.stageId}:${summary.effortMode}`} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div><Link className="inline-flex min-h-10 items-center gap-2 text-sm font-medium underline-offset-4 hover:underline" href={buildWorkersHref({ ...hrefArgs, itemType: [itemTypeId], stage: [summary.stageId] })}>{stageById.get(summary.stageId)?.name ?? "Unknown stage"}<span aria-hidden="true">↗</span></Link><p className="text-xs text-muted-foreground">{effortLabel(summary.effortMode)} · {summary.workerCount} workers · {summary.completedStages} completions</p></div>
              <div className="flex flex-wrap items-center gap-4 text-sm tabular-nums">
                {summary.effortMode === "units" || summary.effortMode === "hybrid" ? <span>{summary.creditedUnits.toFixed(1)} units</span> : null}
                {summary.effortMode === "hours" || summary.effortMode === "hybrid" ? <span>{(summary.creditedMinutes / 60).toFixed(1)}h</span> : null}
                {data.canViewContributionAmounts && summary.effortMode !== "none" ? <span className="font-medium">{formatMoney(summary.contributionAmount)}</span> : null}
              </div>
            </div>)}
          </div>
        </details>;
      })}
      {!categorySummaries.length ? <p className="px-4 pb-4 text-sm text-muted-foreground">No completed work matches these filters. Try a wider date range or select more workers.</p> : null}
    </section>

    <Card><CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Worker comparison</CardTitle><CardDescription>Rank workers inside the selected category, stage, and workgroup.</CardDescription></div><div className="flex flex-wrap gap-2">{metricOptions.map((option) => <Button asChild key={option.value} size="sm" variant={activeMetric === option.value ? "default" : "outline"}><Link href={buildWorkersHref({ ...hrefArgs, metric: option.value })}>{option.label}</Link></Button>)}</div></CardHeader>
      <CardContent className="p-0"><div className="divide-y md:hidden">{rankedSummaries.map((summary, index) => <div className="space-y-2 p-4" key={summary.workerId}><div className="flex items-center justify-between gap-3"><p className="font-medium">{index + 1}. {workerById.get(summary.workerId)?.name ?? "Unknown worker"}</p><p className="font-semibold">{formatMetric(metricValue(summary, activeMetric), activeMetric)}</p></div><div className="flex flex-wrap gap-3 text-xs text-muted-foreground">{activeMetric !== "units" && (availableModes.has("units") || availableModes.has("hybrid")) ? <span>{summary.creditedUnits.toFixed(1)} units</span> : null}{activeMetric !== "hours" && (availableModes.has("hours") || availableModes.has("hybrid")) ? <span>{(summary.creditedMinutes / 60).toFixed(1)}h</span> : null}{activeMetric !== "stages" ? <span>{summary.completedStages} stages</span> : null}</div></div>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[560px] text-sm"><thead className="border-y bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Worker</th><th className="px-4 py-3">{currentMetricLabel}</th>{activeMetric !== "units" && (availableModes.has("units") || availableModes.has("hybrid")) ? <th className="px-4 py-3">Units</th> : null}{activeMetric !== "hours" && (availableModes.has("hours") || availableModes.has("hybrid")) ? <th className="px-4 py-3">Hours</th> : null}{activeMetric !== "stages" ? <th className="px-4 py-3">Stages</th> : null}</tr></thead><tbody className="divide-y">{rankedSummaries.map((summary, index) => <tr key={summary.workerId}><td className="px-4 py-3 text-muted-foreground">{index + 1}</td><td className="px-4 py-3 font-medium">{workerById.get(summary.workerId)?.name ?? "Unknown worker"}</td><td className="px-4 py-3 font-semibold">{formatMetric(metricValue(summary, activeMetric), activeMetric)}</td>{activeMetric !== "units" && (availableModes.has("units") || availableModes.has("hybrid")) ? <td className="px-4 py-3">{summary.creditedUnits.toFixed(1)}</td> : null}{activeMetric !== "hours" && (availableModes.has("hours") || availableModes.has("hybrid")) ? <td className="px-4 py-3">{(summary.creditedMinutes / 60).toFixed(1)}h</td> : null}{activeMetric !== "stages" ? <td className="px-4 py-3">{summary.completedStages}</td> : null}</tr>)}</tbody></table></div>
        {!rankedSummaries.length ? <p className="p-6 text-sm text-muted-foreground">No completed worker contributions in this range.</p> : null}</CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Weekly worker trend</CardTitle><CardDescription>{currentMetricLabel} by completion week for up to five workers matching the report filters.</CardDescription></CardHeader><CardContent><WorkerLineChart data={weeklyChartData} valueKind={activeMetric === "contribution" ? "money" : activeMetric === "hours" ? "hours" : activeMetric === "units" ? "units" : "count"} workers={trendWorkerIds.map((workerId) => ({ key: workerId, label: workerById.get(workerId)?.name ?? "Unknown worker" }))} /></CardContent></Card>
  </div>;
}

export default async function DashboardWorkersPage(props: { searchParams?: Promise<ReportSearchParams> }) {
  return WorkerContributionsReportPage({ backHref: "/dashboard?tab=workers", backLabel: "Back to dashboard", basePath: "/dashboard/workers", searchParams: props.searchParams });
}
