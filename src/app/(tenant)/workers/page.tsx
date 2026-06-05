import Link from "next/link";
import { ArrowUpRight, Phone, Search, UserRound, X } from "lucide-react";

import { createWorkerAction } from "@/features/workers/actions";
import { getWorkersPageData } from "@/features/workers/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/design-system/status-badge";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Workgroup } from "@/types/database";

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
  q,
  status,
  workgroup,
}: {
  q?: string;
  status?: string;
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

  const query = params.toString();
  return query ? `/workers?${query}` : "/workers";
}

function AddWorkerForm({ workgroups }: { workgroups: Workgroup[] }) {
  return (
    <form
      action={createWorkerAction}
      className="space-y-4"
      data-unsaved-guard="true"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="Ravi Kumar" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" placeholder="Optional" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="joiningDate">Joining date</Label>
        <Input id="joiningDate" name="joiningDate" type="date" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="primaryWorkgroupId">Primary workgroup</Label>
        <select
          id="primaryWorkgroupId"
          name="primaryWorkgroupId"
          className="h-10 rounded-md border bg-background px-3 text-sm"
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
          <Label htmlFor="wageType">Wage type</Label>
          <select
            id="wageType"
            name="wageType"
            defaultValue="monthly"
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
          <Label htmlFor="wageAmount">Wage amount</Label>
          <Input
            id="wageAmount"
            name="wageAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
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
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Optional" />
      </div>
      <Button type="submit">Add worker</Button>
    </form>
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
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const search = resolvedSearchParams?.q?.trim() ?? "";
  const statusFilter = resolvedSearchParams?.status ?? "all";
  const workgroupFilter = resolvedSearchParams?.workgroup ?? "all";
  const selectedWorkerId = resolvedSearchParams?.workerId;
  const {
    workers,
    workgroups,
    workerWorkgroups,
    attendance,
    workLogs,
    ledger,
    today,
  } = await getWorkersPageData();
  const workgroupById = new Map(
    workgroups.map((workgroup) => [workgroup.id, workgroup]),
  );
  const attendanceByWorkerId = new Map(
    attendance.map((record) => [record.worker_id, record]),
  );
  const workgroupsByWorkerId = new Map<string, string[]>();
  const workLogsByWorkerId = new Map<string, typeof workLogs>();
  const ledgerByWorkerId = new Map<string, typeof ledger>();

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

  ledger.forEach((entry) => {
    const existing = ledgerByWorkerId.get(entry.worker_id) ?? [];
    existing.push(entry);
    ledgerByWorkerId.set(entry.worker_id, existing);
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
  const advanceExposure = ledger.reduce((total, entry) => {
    if (
      ["advance_given", "loan_given", "deduction"].includes(
        entry.transaction_type,
      )
    ) {
      return total + entry.amount;
    }

    if (entry.transaction_type === "repayment") {
      return total - entry.amount;
    }

    return total;
  }, 0);
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
  const hrefForWorker = (workerId: string) => {
    const params = new URLSearchParams();

    if (search) {
      params.set("q", search);
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (workgroupFilter !== "all") {
      params.set("workgroup", workgroupFilter);
    }

    params.set("workerId", workerId);
    return `/workers?${params.toString()}`;
  };
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
        actions={
          <Dialog
            title="Add worker"
            description="Set wage basics and workgroup access for production assignment."
            trigger={<span className={buttonVariants()}>Add worker</span>}
          >
            <AddWorkerForm workgroups={workgroups} />
          </Dialog>
        }
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
        <MetricCard
          label="Advances/loans"
          value={formatMoney(Math.max(advanceExposure, 0))}
          hint="Ledger signal"
        />
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
              const workerLedger = ledgerByWorkerId.get(worker.id) ?? [];
              const activeLogCount = workerWorkLogs.filter(
                (log) => log.status === "in_progress",
              ).length;
              const ledgerSignal = workerLedger
                .slice(0, 12)
                .reduce((total, entry) => {
                  if (
                    ["advance_given", "loan_given", "deduction"].includes(
                      entry.transaction_type,
                    )
                  ) {
                    return total + entry.amount;
                  }

                  if (entry.transaction_type === "repayment") {
                    return total - entry.amount;
                  }

                  return total;
                }, 0);

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
              const workerLedger =
                ledgerByWorkerId.get(selectedWorker.id) ?? [];

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
                      <CardTitle>Worker setup</CardTitle>
                      <CardDescription>
                        Assignment and salary configuration.
                      </CardDescription>
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

                    <Card>
                      <CardHeader>
                        <CardTitle>Recent ledger</CardTitle>
                        <CardDescription>
                          Advances, loans, deductions, repayments, and salary
                          payments.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {workerLedger.slice(0, 6).map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border p-3 text-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium">
                                {formatMoney(entry.amount)}
                              </p>
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
                      </CardContent>
                    </Card>
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
