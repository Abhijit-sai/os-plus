import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Search } from "lucide-react";

import {
  CapacityTrendChart,
  WorkerRegularityBarChart,
  type AttendanceSplitPoint,
  type WorkerRegularityPoint
} from "@/components/attendance/attendance-charts";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { AttendanceImportDialog } from "@/components/attendance/attendance-import-dialog";
import { AttendanceWorkerFilter } from "@/components/attendance/attendance-worker-filter";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAttendancePageData } from "@/features/attendance/queries";

const rangeOptions = [
  { value: "7d", label: "7D", days: 7 },
  { value: "14d", label: "14D", days: 14 },
  { value: "30d", label: "30D", days: 30 }
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
    timeZone: "UTC"
  }).format(parseIsoDate(value));
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(parseIsoDate(value));
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("en-IN");
}

function shiftDate(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function normalizeFilterValues(value?: string | string[]) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.flatMap((entry) => entry.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

function enumerateDates(startDate: string, endDate: string) {
  const dates: string[] = [];
  let cursor = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function attendanceDayValue(status: string | undefined) {
  if (status === "present") {
    return 1;
  }

  if (status === "half_day") {
    return 0.5;
  }

  return 0;
}

function lostCapacityValue(status: string | undefined) {
  if (!status || status === "holiday") {
    return 0;
  }

  if (status === "half_day") {
    return 0.5;
  }

  if (status === "absent" || status === "leave") {
    return 1;
  }

  return 0;
}

function statusLabel(status: string | undefined) {
  if (!status) {
    return "Unmarked";
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function heatmapCellClass(status: string | undefined) {
  if (status === "present") {
    return "bg-neutral-950 text-white";
  }

  if (status === "half_day") {
    return "bg-amber-500 text-white";
  }

  if (status === "absent") {
    return "bg-red-600 text-white";
  }

  if (status === "leave") {
    return "bg-blue-600 text-white";
  }

  if (status === "holiday") {
    return "bg-green-600 text-white";
  }

  return "bg-neutral-200 text-neutral-500";
}

function resolveOverviewRange({ from, range, to }: { from?: string; range?: string; to?: string }) {
  const today = todayIsoDate();
  const selectedRange = range === "7d" || range === "14d" || range === "30d" || range === "custom" ? range : "14d";

  if (selectedRange === "custom" && from && to && parseIsoDate(from) <= parseIsoDate(to)) {
    return {
      dashboardEndDate: to,
      dashboardStartDate: from,
      range: "custom"
    };
  }

  const option = rangeOptions.find((entry) => entry.value === selectedRange) ?? rangeOptions[1];

  return {
    dashboardEndDate: today,
    dashboardStartDate: shiftDate(today, -(option.days - 1)),
    range: option.value
  };
}

function buildHref(params: Record<string, string | string[] | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => searchParams.append(key, entry));
      return;
    }

    searchParams.set(key, value);
  });

  const query = searchParams.toString();
  return query ? `/attendance?${query}` : "/attendance";
}

function attendanceHref({
  date,
  q,
  status
}: {
  date: string;
  q?: string;
  status?: string;
}) {
  return buildHref({
    date,
    q,
    status: status && status !== "all" ? status : undefined,
    view: "mark"
  });
}

function overviewHref({
  from,
  range,
  to,
  workers
}: {
  from?: string;
  range: string;
  to?: string;
  workers?: string[];
}) {
  return buildHref({
    from,
    range,
    to,
    view: "overview",
    workers
  });
}

export default async function AttendancePage({
  searchParams
}: {
  searchParams?: Promise<{
    date?: string;
    from?: string;
    q?: string;
    range?: string;
    status?: string;
    to?: string;
    view?: string;
    workers?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeView = resolvedSearchParams?.view === "mark" ? "mark" : "overview";
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const statusFilter = resolvedSearchParams?.status ?? "all";
  const { dashboardEndDate, dashboardStartDate, range } = resolveOverviewRange({
    from: resolvedSearchParams?.from,
    range: resolvedSearchParams?.range,
    to: resolvedSearchParams?.to
  });
  const { workers, attendance, recentAttendance, selectedDate } = await getAttendancePageData({
    dashboardEndDate,
    dashboardStartDate,
    selectedDate: resolvedSearchParams?.date
  });
  const validWorkerIds = new Set(workers.map((worker) => worker.id));
  const selectedWorkerIds = normalizeFilterValues(resolvedSearchParams?.workers).filter((workerId) => validWorkerIds.has(workerId));
  const selectedWorkerSet = new Set(selectedWorkerIds);
  const overviewWorkers = selectedWorkerIds.length ? workers.filter((worker) => selectedWorkerSet.has(worker.id)) : workers;
  const attendanceByWorkerId = new Map(attendance.map((record) => [record.worker_id, record]));
  const recentByWorkerAndDate = new Map(recentAttendance.map((record) => [`${record.worker_id}:${record.attendance_date}`, record]));
  const presentCount = attendance.filter((record) => record.status === "present").length;
  const absentCount = attendance.filter((record) => record.status === "absent").length;
  const halfDayCount = attendance.filter((record) => record.status === "half_day").length;
  const leaveCount = attendance.filter((record) => record.status === "leave").length;
  const holidayCount = attendance.filter((record) => record.status === "holiday").length;
  const unmarkedCount = Math.max(workers.length - attendance.length, 0);
  const markedCount = attendance.length;
  const totalHours = attendance.reduce((sum, record) => sum + (record.total_hours ?? 0), 0);
  const searchLower = normalizeSearch(search);
  const filteredWorkers = workers.filter((worker) => {
    const record = attendanceByWorkerId.get(worker.id);
    const effectiveStatus = record?.status ?? "unmarked";
    const matchesSearch = searchLower ? normalizeSearch(`${worker.name} ${worker.phone ?? ""}`).includes(searchLower) : true;
    const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });
  const previousDate = shiftDate(selectedDate, -1);
  const nextDate = shiftDate(selectedDate, 1);
  const today = todayIsoDate();
  const dashboardDates = enumerateDates(dashboardStartDate, dashboardEndDate);
  const workerRegularityRows = overviewWorkers
    .map((worker) => {
      const workerRecords = dashboardDates.map((date) => recentByWorkerAndDate.get(`${worker.id}:${date}`)).filter(Boolean);
      const presentDays = workerRecords.reduce((total, record) => total + attendanceDayValue(record?.status), 0);
      const absentDays = workerRecords.filter((record) => record?.status === "absent").length;
      const halfDays = workerRecords.filter((record) => record?.status === "half_day").length;
      const leaveDays = workerRecords.filter((record) => record?.status === "leave").length;
      const unmarkedDays = Math.max(dashboardDates.length - workerRecords.length, 0);
      const regularity = dashboardDates.length ? Math.round((presentDays / dashboardDates.length) * 100) : 0;
      const todayRecord = dashboardDates.includes(today) ? recentByWorkerAndDate.get(`${worker.id}:${today}`) : undefined;
      const consecutiveAbsences = dashboardDates.reduce(
        (state, date) => {
          const status = recentByWorkerAndDate.get(`${worker.id}:${date}`)?.status;
          const nextCurrent = status === "absent" ? state.current + 1 : 0;

          return {
            current: nextCurrent,
            max: Math.max(state.max, nextCurrent)
          };
        },
        { current: 0, max: 0 }
      ).max;
      const flags = [
        dashboardDates.includes(today) && !todayRecord ? "Unmarked today" : null,
        consecutiveAbsences >= 2 ? "Consecutive absences" : null,
        absentDays >= 3 ? "Repeated absences" : null,
        unmarkedDays >= 3 ? "Attendance gaps" : null,
        regularity < 70 ? "Low regularity" : null,
        halfDays + leaveDays >= 4 ? "Frequent partial days" : null
      ].filter(Boolean) as string[];
      const action = !todayRecord && dashboardDates.includes(today)
        ? "Mark today"
        : consecutiveAbsences >= 2 || absentDays >= 3
          ? "Review worker"
          : unmarkedDays >= 3
            ? "Fix gaps"
            : "Watch pattern";
      const priority = [
        dashboardDates.includes(today) && !todayRecord ? 40 : 0,
        consecutiveAbsences >= 2 ? 30 : 0,
        absentDays >= 3 ? 20 : 0,
        regularity < 70 ? 10 : 0,
        unmarkedDays >= 3 ? 8 : 0,
        halfDays + leaveDays >= 4 ? 6 : 0
      ].reduce((total, value) => total + value, 0);

      return {
        action,
        worker,
        absentDays,
        consecutiveAbsences,
        flags,
        halfDays,
        leaveDays,
        presentDays,
        priority,
        regularity,
        unmarkedDays
      };
    })
    .sort((a, b) => b.priority - a.priority || a.regularity - b.regularity || a.worker.name.localeCompare(b.worker.name));
  const anomalyRows = workerRegularityRows.filter((row) => row.flags.length).slice(0, 6);
  const averageRegularity = workerRegularityRows.length
    ? Math.round(workerRegularityRows.reduce((total, row) => total + row.regularity, 0) / workerRegularityRows.length)
    : 0;
  const lowRegularityCount = workerRegularityRows.filter((row) => row.regularity < 70).length;
  const attendanceSplitData: AttendanceSplitPoint[] = dashboardDates.map((date) => {
    const recordsForDate = overviewWorkers.map((worker) => recentByWorkerAndDate.get(`${worker.id}:${date}`)).filter(Boolean);
    const available = recordsForDate.reduce((total, record) => total + attendanceDayValue(record?.status), 0);
    const lost = recordsForDate.reduce((total, record) => total + lostCapacityValue(record?.status), 0);

    return {
      absent: recordsForDate.filter((record) => record?.status === "absent").length,
      available,
      halfDay: recordsForDate.filter((record) => record?.status === "half_day").length,
      holiday: recordsForDate.filter((record) => record?.status === "holiday").length,
      label: formatChartDate(date),
      leave: recordsForDate.filter((record) => record?.status === "leave").length,
      lost,
      present: recordsForDate.filter((record) => record?.status === "present").length,
      unmarked: Math.max(overviewWorkers.length - recordsForDate.length, 0)
    };
  });
  const workerRegularityData: WorkerRegularityPoint[] = workerRegularityRows.map((row) => ({
    name: row.worker.name,
    regularity: row.regularity
  }));
  const todayOverviewRecords = overviewWorkers.map((worker) => recentByWorkerAndDate.get(`${worker.id}:${today}`)).filter(Boolean);
  const todayAvailableCapacity = todayOverviewRecords.reduce((total, record) => total + attendanceDayValue(record?.status), 0);
  const todayLostCapacity = todayOverviewRecords.reduce((total, record) => total + lostCapacityValue(record?.status), 0);
  const todayUnmarkedCapacity = dashboardDates.includes(today) ? Math.max(overviewWorkers.length - todayOverviewRecords.length, 0) : 0;
  const todayCapacityPercent = overviewWorkers.length ? Math.round((todayAvailableCapacity / overviewWorkers.length) * 100) : 0;
  const totalExpectedCells = overviewWorkers.length * dashboardDates.length;
  const totalMarkedCells = attendanceSplitData.reduce((total, point) => total + point.present + point.halfDay + point.absent + point.leave + point.holiday, 0);
  const salaryReadiness = totalExpectedCells ? Math.round((totalMarkedCells / totalExpectedCells) * 100) : 0;
  const statusOptions = [
    { value: "all", label: "All", count: workers.length },
    { value: "present", label: "Present", count: presentCount },
    { value: "absent", label: "Absent", count: absentCount },
    { value: "half_day", label: "Half day", count: halfDayCount },
    { value: "leave", label: "Leave", count: leaveCount },
    { value: "holiday", label: "Holiday", count: holidayCount },
    { value: "unmarked", label: "Unmarked", count: unmarkedCount }
  ];
  const allWorkersHref = overviewHref({
    from: dashboardStartDate,
    range,
    to: dashboardEndDate
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" description="Daily worker attendance stays separate from production work logs." />

      <CommandBar className="items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={activeView === "overview" ? "default" : "outline"}>
            <Link href={overviewHref({ from: dashboardStartDate, range, to: dashboardEndDate, workers: selectedWorkerIds })}>
              <BarChart3 className="h-4 w-4" />
              Overview
            </Link>
          </Button>
          <Button asChild size="sm" variant={activeView === "mark" ? "default" : "outline"}>
            <Link href={attendanceHref({ date: selectedDate, q: search, status: statusFilter })}>
              <CalendarDays className="h-4 w-4" />
              Mark attendance
            </Link>
          </Button>
          <AttendanceImportDialog />
        </div>
      </CommandBar>

      {activeView === "overview" ? (
        <div className="space-y-5">
          <CommandBar className="items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {rangeOptions.map((option) => (
                <Button key={option.value} asChild size="sm" variant={range === option.value ? "default" : "outline"}>
                  <Link href={overviewHref({ range: option.value, workers: selectedWorkerIds })}>{option.label}</Link>
                </Button>
              ))}
              <form className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="view" value="overview" />
                <input type="hidden" name="range" value="custom" />
                {selectedWorkerIds.map((workerId) => (
                  <input key={workerId} type="hidden" name="workers" value={workerId} />
                ))}
                <Label htmlFor="from" className="sr-only">
                  From
                </Label>
                <Input id="from" name="from" type="date" defaultValue={dashboardStartDate} className="h-9 w-[150px]" />
                <Label htmlFor="to" className="sr-only">
                  To
                </Label>
                <Input id="to" name="to" type="date" defaultValue={dashboardEndDate} className="h-9 w-[150px]" />
                <Button type="submit" size="sm" variant={range === "custom" ? "default" : "outline"}>
                  Apply range
                </Button>
              </form>
            </div>
            <AttendanceWorkerFilter
              allWorkersHref={allWorkersHref}
              dashboardEndDate={dashboardEndDate}
              dashboardStartDate={dashboardStartDate}
              range={range}
              selectedWorkerIds={selectedWorkerIds}
              workers={workers}
            />
          </CommandBar>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Today availability" value={`${todayCapacityPercent}%`} hint={`${todayAvailableCapacity}/${overviewWorkers.length} worker-days available`} />
            <MetricCard label="Capacity loss" value={todayLostCapacity} hint={`${todayUnmarkedCapacity} unmarked today`} />
            <MetricCard label="Salary readiness" value={`${salaryReadiness}%`} hint={`${totalMarkedCells}/${totalExpectedCells} range entries marked`} />
            <MetricCard label="Attention" value={anomalyRows.length} hint={`${lowRegularityCount} below 70% regularity`} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Daily capacity trend</CardTitle>
                <CardDescription>Available worker-day capacity against lost and unmarked capacity in the selected range.</CardDescription>
              </CardHeader>
              <CardContent>
                <CapacityTrendChart data={attendanceSplitData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Worker regularity</CardTitle>
                <CardDescription>Color coded by regularity: black is healthy, amber needs review, red needs attention.</CardDescription>
              </CardHeader>
              <CardContent>
                <WorkerRegularityBarChart data={workerRegularityData} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Worker attendance heatmap</CardTitle>
              <CardDescription>
                Pattern view across {formatDate(dashboardStartDate)} to {formatDate(dashboardEndDate)}. Dark is present; red needs attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[720px] space-y-2">
                <div className="grid items-center gap-2" style={{ gridTemplateColumns: `150px repeat(${dashboardDates.length}, minmax(34px, 1fr))` }}>
                  <span className="text-xs font-medium uppercase text-muted-foreground">Worker</span>
                  {dashboardDates.map((date) => (
                    <span key={date} className="text-center text-xs text-muted-foreground">
                      {formatChartDate(date)}
                    </span>
                  ))}
                </div>
                {workerRegularityRows.map((row) => (
                  <div key={row.worker.id} className="grid items-center gap-2" style={{ gridTemplateColumns: `150px repeat(${dashboardDates.length}, minmax(34px, 1fr))` }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.worker.name}</p>
                      <p className="text-xs text-muted-foreground">{row.regularity}% regular</p>
                    </div>
                    {dashboardDates.map((date) => {
                      const status = recentByWorkerAndDate.get(`${row.worker.id}:${date}`)?.status;

                      return (
                        <div
                          key={`${row.worker.id}:${date}`}
                          title={`${row.worker.name} - ${formatDate(date)} - ${statusLabel(status)}`}
                          className={`h-8 rounded-[6px] border text-center text-[10px] leading-8 ${heatmapCellClass(status)}`}
                        >
                          {status ? statusLabel(status).charAt(0) : "-"}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-neutral-950" /> Present</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-amber-500" /> Half day</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-600" /> Absent</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-600" /> Leave</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-green-600" /> Holiday</span>
                  <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-neutral-200" /> Unmarked</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attention board</CardTitle>
              <CardDescription>Ranked actions that may affect production capacity, salary readiness, or daily control.</CardDescription>
            </CardHeader>
            <CardContent>
              {anomalyRows.length ? (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {anomalyRows.map((row) => (
                    <div key={row.worker.id} className="rounded-md border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.worker.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.regularity}% regularity - {row.unmarkedDays} gaps - {row.absentDays} absent
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-950 px-2 py-1 text-xs font-medium text-white">
                          {row.action}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{row.priority >= 40 ? "Immediate review" : "Manager attention"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row.flags.map((flag) => (
                          <span key={flag} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No attendance anomalies in this range.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild variant="outline">
              <Link href={attendanceHref({ date: previousDate, q: search, status: statusFilter })}>
                <ArrowLeft className="h-4 w-4" />
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={attendanceHref({ date: today, q: search, status: statusFilter })}>
                <CalendarDays className="h-4 w-4" />
                Today
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={attendanceHref({ date: nextDate, q: search, status: statusFilter })}>
                Next
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Selected date" value={formatDate(selectedDate)} hint={`${markedCount}/${workers.length} marked`} />
            <MetricCard label="Present" value={presentCount} hint="Full-day attendance" />
            <MetricCard label="Absent" value={absentCount} hint="Not available" />
            <MetricCard label="Half day" value={halfDayCount} hint="Partial availability" />
            <MetricCard label="Unmarked" value={unmarkedCount} hint="Needs review" />
            <MetricCard label="Hours" value={totalHours.toFixed(1)} hint="Marked total" />
          </div>

          <CommandBar className="items-center justify-between">
            <form className="flex min-w-[260px] flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="view" value="mark" />
              <Label htmlFor="date" className="sr-only">
                Attendance date
              </Label>
              <Input id="date" name="date" type="date" defaultValue={selectedDate} className="h-9 w-[160px]" />
              <Label htmlFor="q" className="sr-only">
                Search workers
              </Label>
              <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" name="q" defaultValue={search} placeholder="Search workers" className="h-9 pl-9" />
              </div>
              {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
              <Button type="submit" size="sm" variant="outline">
                Apply
              </Button>
              {search || statusFilter !== "all" || resolvedSearchParams?.date ? (
                <Button asChild type="button" size="sm" variant="ghost">
                  <Link href="/attendance?view=mark">Reset</Link>
                </Button>
              ) : null}
            </form>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {statusOptions.map((option) => (
                <Button key={option.value} asChild size="sm" variant={statusFilter === option.value ? "default" : "outline"}>
                  <Link href={attendanceHref({ date: selectedDate, q: search, status: option.value })}>
                    {option.label} {option.count}
                  </Link>
                </Button>
              ))}
            </div>
          </CommandBar>

          <AttendanceSheet attendance={attendance} selectedDate={selectedDate} workers={filteredWorkers} />
        </div>
      )}
    </div>
  );
}
