"use client";

import { useMemo, useState } from "react";
import { Clock, RotateCcw } from "lucide-react";

import { markAttendanceSheetAction } from "@/features/attendance/actions";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Attendance, AttendanceStatus, Worker } from "@/types/database";

const attendanceStatuses: Array<{ value: AttendanceStatus | "unmarked"; label: string }> = [
  { value: "unmarked", label: "Unmarked" },
  { value: "present", label: "Present" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "Leave" },
  { value: "holiday", label: "Holiday" }
];

type RowState = {
  checkInTime: string;
  checkOutTime: string;
  hours: string;
  isManualHours: boolean;
  notes: string;
  status: AttendanceStatus | "unmarked";
};

function calculateHours(checkInTime: string, checkOutTime: string) {
  if (!checkInTime || !checkOutTime) {
    return "";
  }

  const [inHour, inMinute] = checkInTime.split(":").map(Number);
  const [outHour, outMinute] = checkOutTime.split(":").map(Number);
  const startMinutes = inHour * 60 + inMinute;
  let endMinutes = outHour * 60 + outMinute;

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return String(Math.round(((endMinutes - startMinutes) / 60) * 100) / 100);
}

function defaultHoursForStatus(status: AttendanceStatus | "unmarked") {
  if (status === "present") {
    return "8";
  }

  if (status === "half_day") {
    return "4";
  }

  if (status === "unmarked") {
    return "";
  }

  return "0";
}

function buildInitialRows(workers: Worker[], attendanceByWorkerId: Map<string, Attendance>) {
  return Object.fromEntries(
    workers.map((worker) => {
      const record = attendanceByWorkerId.get(worker.id);
      const status = record?.status ?? "unmarked";

      return [
        worker.id,
        {
          checkInTime: record?.check_in_time ?? "",
          checkOutTime: record?.check_out_time ?? "",
          hours: record?.total_hours === null || record?.total_hours === undefined ? defaultHoursForStatus(status) : String(record.total_hours),
          isManualHours: Boolean(record?.total_hours),
          notes: record?.notes ?? "",
          status
        }
      ];
    })
  ) as Record<string, RowState>;
}

export function AttendanceSheet({
  attendance,
  selectedDate,
  workers
}: {
  attendance: Attendance[];
  selectedDate: string;
  workers: Worker[];
}) {
  const attendanceByWorkerId = useMemo(() => new Map(attendance.map((record) => [record.worker_id, record])), [attendance]);
  const [rows, setRows] = useState(() => buildInitialRows(workers, attendanceByWorkerId));

  const updateRow = (workerId: string, patch: Partial<RowState>) => {
    setRows((current) => ({
      ...current,
      [workerId]: {
        ...current[workerId],
        ...patch
      }
    }));
  };

  const setStatus = (workerId: string, status: AttendanceStatus | "unmarked") => {
    const current = rows[workerId];
    const calculatedHours = calculateHours(current.checkInTime, current.checkOutTime);

    updateRow(workerId, {
      status,
      hours: current.isManualHours ? current.hours : calculatedHours || defaultHoursForStatus(status)
    });
  };

  const setTime = (workerId: string, key: "checkInTime" | "checkOutTime", value: string) => {
    const current = rows[workerId];
    const next = { ...current, [key]: value };

    updateRow(workerId, {
      [key]: value,
      hours: current.isManualHours ? current.hours : calculateHours(next.checkInTime, next.checkOutTime) || current.hours
    });
  };

  const markAll = (status: AttendanceStatus) => {
    setRows((current) =>
      Object.fromEntries(
        workers.map((worker) => {
          const row = current[worker.id];
          const calculatedHours = calculateHours(row.checkInTime, row.checkOutTime);

          return [
            worker.id,
            {
              ...row,
              hours: row.isManualHours ? row.hours : calculatedHours || defaultHoursForStatus(status),
              status
            }
          ];
        })
      )
    );
  };

  const markUnmarkedPresent = () => {
    setRows((current) =>
      Object.fromEntries(
        workers.map((worker) => {
          const row = current[worker.id];

          if (row.status !== "unmarked") {
            return [worker.id, row];
          }

          return [
            worker.id,
            {
              ...row,
              hours: defaultHoursForStatus("present"),
              isManualHours: false,
              status: "present"
            }
          ];
        })
      )
    );
  };

  const resetDraft = () => setRows(buildInitialRows(workers, attendanceByWorkerId));

  return (
    <form action={markAttendanceSheetAction} className="space-y-3">
      <input type="hidden" name="attendanceDate" value={selectedDate} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-card p-3 shadow-sm">
        <div>
          <p className="text-sm font-medium">Draft day sheet</p>
          <p className="text-xs text-muted-foreground">Set status first. Time is optional; hours can be calculated or entered directly.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => markAll("present")}>
            Mark all present
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={markUnmarkedPresent}>
            Mark unmarked present
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={resetDraft}>
            <RotateCcw className="h-4 w-4" />
            Reset draft
          </Button>
          <Button type="submit" size="sm">
            Save attendance sheet
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border bg-card shadow-sm">
        <div className="grid gap-3 border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground xl:grid-cols-[1.1fr_150px_120px_120px_115px_1fr]">
          <span>Worker</span>
          <span>Status</span>
          <span>Time in</span>
          <span>Time out</span>
          <span>Hours</span>
          <span>Notes</span>
        </div>
        <div className="divide-y">
          {workers.map((worker) => {
            const row = rows[worker.id];
            const savedRecord = attendanceByWorkerId.get(worker.id);

            return (
              <div
                key={worker.id}
                className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/40 xl:grid-cols-[1.1fr_150px_120px_120px_115px_1fr] xl:items-center"
              >
                <input type="hidden" name="workerIds" value={worker.id} />
                <input type="hidden" name={`status_${worker.id}`} value={row.status} />
                <input type="hidden" name={`checkInTime_${worker.id}`} value={row.checkInTime} />
                <input type="hidden" name={`checkOutTime_${worker.id}`} value={row.checkOutTime} />
                <input type="hidden" name={`totalHours_${worker.id}`} value={row.hours} />
                <input type="hidden" name={`notes_${worker.id}`} value={row.notes} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{worker.name}</p>
                    <StatusBadge value={savedRecord?.status ?? "unmarked"} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">Saved status shown beside name</p>
                </div>
                <div>
                  <Label htmlFor={`status-${worker.id}`} className="sr-only">
                    Status
                  </Label>
                  <select
                    id={`status-${worker.id}`}
                    value={row.status}
                    onChange={(event) => setStatus(worker.id, event.target.value as AttendanceStatus | "unmarked")}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {attendanceStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor={`check-in-${worker.id}`} className="sr-only">
                    Time in
                  </Label>
                  <Input
                    id={`check-in-${worker.id}`}
                    type="time"
                    value={row.checkInTime}
                    onChange={(event) => setTime(worker.id, "checkInTime", event.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor={`check-out-${worker.id}`} className="sr-only">
                    Time out
                  </Label>
                  <Input
                    id={`check-out-${worker.id}`}
                    type="time"
                    value={row.checkOutTime}
                    onChange={(event) => setTime(worker.id, "checkOutTime", event.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor={`hours-${worker.id}`} className="sr-only">
                    Hours
                  </Label>
                  <div className="relative">
                    <Input
                      id={`hours-${worker.id}`}
                      type="number"
                      min="0"
                      step="0.25"
                      value={row.hours}
                      onChange={(event) => updateRow(worker.id, { hours: event.target.value, isManualHours: true })}
                      className="h-9 pr-8"
                    />
                    <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`notes-${worker.id}`} className="sr-only">
                    Notes
                  </Label>
                  <Input
                    id={`notes-${worker.id}`}
                    value={row.notes}
                    onChange={(event) => updateRow(worker.id, { notes: event.target.value })}
                    placeholder="Optional note"
                    className="h-9"
                  />
                </div>
              </div>
            );
          })}
          {!workers.length ? (
            <div className="p-8 text-center">
              <p className="font-medium">No workers found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try changing the search or attendance filter.</p>
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
