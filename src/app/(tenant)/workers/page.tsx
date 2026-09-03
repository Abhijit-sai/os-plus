import Link from "next/link";
import { ArrowUpRight, Phone, Search, UserRound, X } from "lucide-react";

import { createWorkerAction, updateWorkerAction } from "@/features/workers/actions";
import { getWorkersPageData } from "@/features/workers/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/design-system/status-badge";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { AutoCloseActionDialog } from "@/components/ui/auto-close-action-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Worker, Workgroup } from "@/types/database";

const wageTypes = [
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "per_piece", label: "Per piece" },
  { value: "hybrid", label: "Hybrid" },
];

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("en-IN");
}

function workerFilterHref({
  moneyPage,
  q,
  status,
  workerId,
  workgroup,
}: {
  moneyPage?: number;
  q?: string;
  status?: string;
  workerId?: string;
  workgroup?: string;
}) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (workgroup && workgroup !== "all") {
    params.set("workgroup", workgroup);
  }

  if (workerId) {
    params.set("workerId", workerId);
  }

  if (moneyPage && moneyPage > 1) {
    params.set("moneyPage", String(moneyPage));
  }

  const query = params.toString();
  return query ? `/workers?${query}` : "/workers";
}

function WorkerForm({ selectedWorkgroupIds = [], worker, workgroups }: { selectedWorkgroupIds?: string[]; worker?: Worker; workgroups: Workgroup[] }) {
  const suffix = worker ? `-${worker.id}` : "";
  return (
    <>
      {worker ? <input type="hidden" name="workerId" value={worker.id} /> : null}
      <div className="grid gap-2">
        <Label htmlFor={`name${suffix}`}>Name</Label>
        <Input id={`name${suffix}`} name="name" defaultValue={worker?.name ?? ""} placeholder="Ravi Kumar" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`phone${suffix}`}>Phone</Label>
        <Input id={`phone${suffix}`} name="phone" defaultValue={worker?.phone ?? ""} placeholder="Optional" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`joiningDate${suffix}`}>Joining date</Label>
        <Input id={`joiningDate${suffix}`} name="joiningDate" type="date" defaultValue={worker?.joining_date ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`primaryWorkgroupId${suffix}`}>Primary workgroup</Label>
        <select
          id={`primaryWorkgroupId${suffix}`}
          name="primaryWorkgroupId"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          defaultValue={worker?.primary_workgroup_id ?? ""}
        >
          <option value="">No primary workgroup</option>
          {workgroups.map((workgroup) => (
            <option key={workgroup.id} value={workgroup.id}>
              {workgroup.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`wageType${suffix}`}>Wage type</Label>
          <select
            id={`wageType${suffix}`}
            name="wageType"
            defaultValue={worker?.wage_type ?? "monthly"}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            {wageTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`wageAmount${suffix}`}>Wage amount</Label>
          <Input
            id={`wageAmount${suffix}`}
            name="wageAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={worker?.wage_amount ?? 0}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Additional workgroups</p>
        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
          {workgroups.map((workgroup) => (
            <label
              key={workgroup.id}
              className="flex items-center gap-2 text-sm"
            >
              <input
                name="workgroupIds"
                type="checkbox"
                value={workgroup.id}
                defaultChecked={selectedWorkgroupIds.includes(workgroup.id) || worker?.primary_workgroup_id === workgroup.id}
                className="h-4 w-4 accent-black"
              />
              {workgroup.name}
            </label>
          ))}
          {!workgroups.length ? (
            <p className="text-sm text-muted-foreground">
              Add workgroups before assigning workers.
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`notes${suffix}`}>Notes</Label>
        <Input id={`notes${suffix}`} name="notes" defaultValue={worker?.notes ?? ""} placeholder="Optional" />
      </div>
      {worker ? <div className="grid gap-2"><Label htmlFor={`status${suffix}`}>Status</Label><select id={`status${suffix}`} name="status" defaultValue={worker.status} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="active">Active</option><option value="inactive">Inactive</option></select></div> : null}
      <Button pendingLabel={worker ? "Saving worker…" : "Adding worker…"} type="submit">{worker ? "Save worker" : "Add worker"}</Button>
    </>
  );
}

export default async function WorkersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    workgroup?: string;
    workerId?: string;
    moneyPage?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const statusFilter = resolvedSearchParams?.status ?? "all";
  const workgroupFilter = resolvedSearchParams?.workgroup ?? "all";
  const requestedMoneyPage = Number(resolvedSearchParams?.moneyPage ?? "1");
  const {
    canManageWorkers,
    canViewSalary,
    workers,
    workgroups,
    workerWorkgroups,
    attendance,
    workLogs,
    ledger,
    ledgerCount,
    selectedWorkerId,
    today,
    workerMoneyPage,
    workerMoneyPageSize,
    workerMoneySummaries,
  } = await getWorkersPageData({
    workerId: resolvedSearchParams?.workerId,
    workerMoneyPage: requestedMoneyPage,
  });
  const workgroupById = new Map(
    workgroups.map((workgroup) => [workgroup.id, workgroup]),
  );
  const attendanceByWorkerId = new Map(
    attendance.map((record) => [record.worker_id, record]),
  );
  const workgroupsByWorkerId = new Map<string, string[]>();
  const workLogsByWorkerId = new Map<string, typeof workLogs>();
  const moneySummaryByWorkerId = new Map(
    workerMoneySummaries.map((summary) => [summary.worker_id, summary]),
  );

  workerWorkgroups.forEach((mapping) => {
    const existing = workgroupsByWorkerId.get(mapping.worker_id) ?? [];
    existing.push(mapping.workgroup_id);
    workgroupsByWorkerId.set(mapping.worker_id, existing);
  });

  workLogs.forEach((log) => {
    const existing = workLogsByWorkerId.get(log.worker_id) ?? [];
    existing.push(log);
    workLogsByWorkerId.set(log.worker_id, existing);
  });

  const activeWorkers = workers.filter((worker) => worker.status === "active");
  const inactiveWorkers = workers.filter(
    (worker) => worker.status === "inactive",
  );
  const missingWageWorkers = workers.filter(
    (worker) => worker.wage_amount <= 0,
  );
  const missingWorkgroupWorkers = workers.filter((worker) => {
    const mappedWorkgroups = workgroupsByWorkerId.get(worker.id) ?? [];
    return !worker.primary_workgroup_id && mappedWorkgroups.length === 0;
  });
  const presentToday = attendance.filter(
    (record) => record.status === "present",
  ).length;
  const activeWorkLogs = workLogs.filter((log) => log.status === "in_progress");
  const advanceExposure = workerMoneySummaries.reduce(
    (total, summary) =>
      total + Number(summary.advance_balance) + Number(summary.loan_balance),
    0,
  );
  const searchLower = normalizeSearch(search);
  const filteredWorkers = workers.filter((worker) => {
    const mappedWorkgroupIds = workgroupsByWorkerId.get(worker.id) ?? [];
    const mappedWorkgroupNames = mappedWorkgroupIds.map(
      (id) => workgroupById.get(id)?.name ?? "",
    );
    const primaryWorkgroup = worker.primary_workgroup_id
      ? (workgroupById.get(worker.primary_workgroup_id)?.name ?? "")
      : "";
    const matchesSearch = searchLower
      ? normalizeSearch(
          `${worker.name} ${worker.phone ?? ""} ${primaryWorkgroup} ${mappedWorkgroupNames.join(" ")} ${worker.wage_type}`,
        ).includes(searchLower)
      : true;
    const matchesStatus =
      statusFilter === "all" || worker.status === statusFilter;
    const matchesWorkgroup =
      workgroupFilter === "all" ||
      [worker.primary_workgroup_id, ...mappedWorkgroupIds].includes(
        workgroupFilter,
      );

    return matchesSearch && matchesStatus && matchesWorkgroup;
  });
  const selectedWorker = selectedWorkerId
    ? workers.find((worker) => worker.id === selectedWorkerId)
    : null;
  const hrefForWorker = (workerId: string) =>
    workerFilterHref({
      q: search,
      status: statusFilter,
      workerId,
      workgroup: workgroupFilter,
    });
  const closePaneHref = workerFilterHref({
    q: search,
    status: statusFilter,
    workgroup: workgroupFilter,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Workers"
        description="Operational workers are not login users. Managers log attendance and production work on their behalf."
        actions={canManageWorkers ? (
          <AutoCloseActionDialog
            action={createWorkerAction}
            title="Add worker"
            description="Set wage basics and workgroup access for production assignment."
            successMessage="Worker added."
            trigger={<span className={buttonVariants()}>Add worker</span>}
          >
            <WorkerForm workgroups={workgroups} />
          </AutoCloseActionDialog>
        ) : undefined}
      />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Active workers"
          value={activeWorkers.length}
          hint={`${inactiveWorkers.length} inactive`}
        />
        <MetricCard
          label="Present today"
          value={presentToday}
          hint={`${Math.max(activeWorkers.length - attendance.length, 0)} unmarked`}
        />
        <MetricCard
          label="Working now"
          value={activeWorkLogs.length}
          hint="Active production logs"
        />
        <MetricCard
          label="Workgroups"
          value={workgroups.length}
          hint={`${missingWorkgroupWorkers.length} need mapping`}
        />
        <MetricCard
          label="Wage gaps"
          value={missingWageWorkers.length}
          hint="Zero wage amount"
        />
        {canViewSalary ? (
          <MetricCard
            label="Advances/loans"
            value={formatMoney(Math.max(advanceExposure, 0))}
            hint="Current outstanding balance"
          />
        ) : null}
      </div>

      <CommandBar className="items-center justify-between">
        <form className="flex min-w-[260px] flex-1 flex-wrap items-center gap-2">
          <Label htmlFor="q" className="sr-only">
            Search workers
          </Label>
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              name="q"
              defaultValue={search}
              placeholder="Search workers"
              className="h-9 pl-9"
            />
          </div>
          {statusFilter !== "all" ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          {workgroupFilter !== "all" ? (
            <input type="hidden" name="workgroup" value={workgroupFilter} />
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
          {search || statusFilter !== "all" || workgroupFilter !== "all" ? (
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href="/workers">Reset</Link>
            </Button>
          ) : null}
        </form>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ].map((option) => (
            <Button
              key={option.value}
              asChild
              size="sm"
              variant={statusFilter === option.value ? "default" : "outline"}
            >
              <Link
                href={workerFilterHref({
                  q: search,
                  status: option.value,
                  workgroup: workgroupFilter,
                })}
              >
                {option.label}
              </Link>
            </Button>
          ))}
          <select
            aria-label="Filter by workgroup"
            defaultValue={workgroupFilter}
            className="h-9 rounded-md border bg-background px-3 text-sm"
            onChange={undefined}
            name="workgroup"
            form="worker-workgroup-filter"
          >
            <option value="all">All workgroups</option>
            {workgroups.map((workgroup) => (
              <option key={workgroup.id} value={workgroup.id}>
                {workgroup.name}
              </option>
            ))}
          </select>
          <form id="worker-workgroup-filter" className="hidden">
            {search ? <input type="hidden" name="q" value={search} /> : null}
            {statusFilter !== "all" ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
          </form>
          <Button
            type="submit"
            form="worker-workgroup-filter"
            size="sm"
            variant="outline"
          >
            Filter
          </Button>
        </div>
      </CommandBar>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Worker operations</CardTitle>
          <CardDescription>
            Directory, wage setup, attendance state, active production, and
            ledger signals.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid gap-3 border-y px-4 py-3 text-xs font-medium uppercase text-muted-foreground lg:grid-cols-[1.2fr_1fr_0.85fr_0.75fr_0.75fr_0.85fr_44px]">
            <span>Worker</span>
            <span>Workgroup</span>
            <span>Wage</span>
            <span>Attendance</span>
            <span>Active work</span>
            <span>Ledger</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y">
            {filteredWorkers.map((worker) => {
              const mappedWorkgroupIds =
                workgroupsByWorkerId.get(worker.id) ?? [];
              const mappedWorkgroupNames = mappedWorkgroupIds
                .map((id) => workgroupById.get(id)?.name)
                .filter(Boolean);
              const primaryWorkgroup = worker.primary_workgroup_id
                ? workgroupById.get(worker.primary_workgroup_id)?.name
                : null;
              const workerAttendance = attendanceByWorkerId.get(worker.id);
              const workerWorkLogs = workLogsByWorkerId.get(worker.id) ?? [];
              const activeLogCount = workerWorkLogs.filter(
                (log) => log.status === "in_progress",
              ).length;
              const moneySummary = moneySummaryByWorkerId.get(worker.id);
              const ledgerSignal = moneySummary
                ? Number(moneySummary.advance_balance) + Number(moneySummary.loan_balance)
                : 0;

              return (
                <Link
                  key={worker.id}
                  href={hrefForWorker(worker.id)}
                  className="grid gap-3 px-4 py-4 text-sm transition-colors hover:bg-muted/40 lg:grid-cols-[1.2fr_1fr_0.85fr_0.75fr_0.75fr_0.85fr_44px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="truncate font-medium">{worker.name}</p>
                      <StatusBadge value={worker.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {worker.phone ? (
                        <>
                          <Phone className="mr-1 inline h-3 w-3" />
                          {worker.phone}
                        </>
                      ) : (
                        "No phone"
                      )}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {primaryWorkgroup ?? "No primary group"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {mappedWorkgroupNames.length
                        ? mappedWorkgroupNames.join(", ")
                        : "No mapped workgroups"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">
                      {formatMoney(worker.wage_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {worker.wage_type.replace("_", " ")}
                    </p>
                  </div>
                  <StatusBadge value={workerAttendance?.status ?? "unmarked"} />
                  <p className="text-muted-foreground">
                    {activeLogCount} active
                  </p>
                  <p
                    className={
                      ledgerSignal > 0 ? "font-medium" : "text-muted-foreground"
                    }
                  >
                    {formatMoney(Math.max(ledgerSignal, 0))}
                  </p>
                  <div className="hidden justify-end lg:flex">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
          {!filteredWorkers.length ? (
            <div className="p-8 text-center">
              <p className="font-medium">No workers found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try changing the search, status, or workgroup filter.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selectedWorker ? (
        <div className="fixed inset-0 z-50 flex justify-end p-4">
          <Link
            href={closePaneHref}
            aria-label="Close worker pane"
            className="absolute inset-0 cursor-default bg-black/30"
          />
          <div className="relative z-10 h-full w-full max-w-3xl overflow-y-auto rounded-[14px] border bg-background p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold leading-tight">
                  {selectedWorker.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Worker profile and operating signals.
                </p>
              </div>
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close"
              >
                <Link href={closePaneHref}>
                  <X className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            {(() => {
              const mappedWorkgroupIds =
                workgroupsByWorkerId.get(selectedWorker.id) ?? [];
              const mappedWorkgroupNames = mappedWorkgroupIds
                .map((id) => workgroupById.get(id)?.name)
                .filter(Boolean);
              const primaryWorkgroup = selectedWorker.primary_workgroup_id
                ? workgroupById.get(selectedWorker.primary_workgroup_id)?.name
                : null;
              const workerAttendance = attendanceByWorkerId.get(
                selectedWorker.id,
              );
              const workerWorkLogs =
                workLogsByWorkerId.get(selectedWorker.id) ?? [];
              const workerLedger = ledger;
              const workerMoneySummary = moneySummaryByWorkerId.get(selectedWorker.id);
              const advanceBalance = Number(workerMoneySummary?.advance_balance ?? 0);
              const loanBalance = Number(workerMoneySummary?.loan_balance ?? 0);
              const salaryPaid = Number(workerMoneySummary?.salary_paid ?? 0);
              const totalMoneyPages = Math.max(
                1,
                Math.ceil(ledgerCount / workerMoneyPageSize),
              );
              const moneyPageHref = (page: number) =>
                workerFilterHref({
                  moneyPage: page,
                  q: search,
                  status: statusFilter,
                  workerId: selectedWorker.id,
                  workgroup: workgroupFilter,
                });

              return (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Status"
                      value={<StatusBadge value={selectedWorker.status} />}
                      hint={selectedWorker.phone ?? "No phone"}
                    />
                    <MetricCard
                      label="Today"
                      value={
                        <StatusBadge
                          value={workerAttendance?.status ?? "unmarked"}
                        />
                      }
                      hint={today}
                    />
                    <MetricCard
                      label="Active work"
                      value={
                        workerWorkLogs.filter(
                          (log) => log.status === "in_progress",
                        ).length
                      }
                      hint="Open work logs"
                    />
                  </div>

                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3"><div><CardTitle>Worker setup</CardTitle><CardDescription>Assignment and salary configuration.</CardDescription></div>{canManageWorkers ? <AutoCloseActionDialog action={updateWorkerAction} title="Edit worker" description="Updates preserve attendance, work logs, salary, and ledger history." successMessage="Worker saved." trigger={<span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">Edit worker</span>}><WorkerForm worker={selectedWorker} workgroups={workgroups} selectedWorkgroupIds={mappedWorkgroupIds} /></AutoCloseActionDialog> : null}</div>
                    </CardHeader>
                    <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="font-medium">Primary workgroup</p>
                        <p className="text-muted-foreground">
                          {primaryWorkgroup ?? "No primary workgroup"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Wage</p>
                        <p className="text-muted-foreground">
                          {formatMoney(selectedWorker.wage_amount)} ·{" "}
                          {selectedWorker.wage_type.replace("_", " ")}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Joining date</p>
                        <p className="text-muted-foreground">
                          {formatDate(selectedWorker.joining_date)}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Workgroups</p>
                        <p className="text-muted-foreground">
                          {mappedWorkgroupNames.length
                            ? mappedWorkgroupNames.join(", ")
                            : "No mapped workgroups"}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="font-medium">Notes</p>
                        <p className="text-muted-foreground">
                          {selectedWorker.notes ?? "No notes"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent work logs</CardTitle>
                        <CardDescription>
                          Production work remains separate from attendance.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {workerWorkLogs.slice(0, 6).map((log) => (
                          <div
                            key={log.id}
                            className="rounded-md border p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <StatusBadge value={log.status} />
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(log.started_at)}
                              </p>
                            </div>
                            <p className="mt-2 text-muted-foreground">
                              {log.duration_minutes
                                ? `${log.duration_minutes} minutes`
                                : "Duration not finalized"}
                            </p>
                            {log.notes ? (
                              <p className="text-muted-foreground">
                                {log.notes}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        {!workerWorkLogs.length ? (
                          <p className="text-sm text-muted-foreground">
                            No recent work logs.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>

                    {canViewSalary ? <Card>
                      <CardHeader>
                        <CardTitle>Worker money</CardTitle>
                        <CardDescription>
                          Current balances and complete history, shown {workerMoneyPageSize} entries at a time.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Advance</p><p className="font-medium">{formatMoney(advanceBalance)}</p></div>
                          <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Loan</p><p className="font-medium">{formatMoney(loanBalance)}</p></div>
                          <div className="rounded-md bg-muted/50 p-2"><p className="text-xs text-muted-foreground">Salary paid</p><p className="font-medium">{formatMoney(salaryPaid)}</p></div>
                        </div>
                        {workerLedger.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium">
                                {formatMoney(entry.amount)}
                              </p>
                              {entry.reversed_at ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Reversed</span> : null}
                              <p className="text-xs text-muted-foreground">
                                {formatDate(entry.transaction_date)}
                              </p>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {entry.transaction_type.replaceAll("_", " ")}
                            </p>
                            {entry.description ? (
                              <p className="text-muted-foreground">
                                {entry.description}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        {!workerLedger.length ? (
                          <p className="text-sm text-muted-foreground">
                            No ledger entries.
                          </p>
                        ) : null}
                        {ledgerCount > workerMoneyPageSize ? (
                          <div className="flex items-center justify-between gap-3 border-t pt-3">
                            <p className="text-xs text-muted-foreground">
                              Page {workerMoneyPage} of {totalMoneyPages} · {ledgerCount} entries
                            </p>
                            <div className="flex gap-2">
                              <Button asChild={workerMoneyPage > 1} disabled={workerMoneyPage <= 1} size="sm" variant="outline">
                                {workerMoneyPage > 1 ? <Link href={moneyPageHref(workerMoneyPage - 1)}>Previous</Link> : <span>Previous</span>}
                              </Button>
                              <Button asChild={workerMoneyPage < totalMoneyPages} disabled={workerMoneyPage >= totalMoneyPages} size="sm" variant="outline">
                                {workerMoneyPage < totalMoneyPages ? <Link href={moneyPageHref(workerMoneyPage + 1)}>Next</Link> : <span>Next</span>}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card> : null}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
