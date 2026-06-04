"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";

type WorkerOption = {
  id: string;
  name: string;
};

type AttendanceWorkerFilterProps = {
  allWorkersHref: string;
  dashboardEndDate: string;
  dashboardStartDate: string;
  range: string;
  selectedWorkerIds: string[];
  workers: WorkerOption[];
};

export function AttendanceWorkerFilter({
  allWorkersHref,
  dashboardEndDate,
  dashboardStartDate,
  range,
  selectedWorkerIds,
  workers
}: AttendanceWorkerFilterProps) {
  const [open, setOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedWorkerSet = new Set(selectedWorkerIds);
  const label = selectedWorkerIds.length ? `${selectedWorkerIds.length} workers` : "All workers";

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={filterRef} className="relative">
      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setOpen((value) => !value)}>
        <UsersRound className="h-4 w-4" />
        <span className="max-w-[180px] truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open ? (
        <form className="absolute right-0 z-20 mt-2 w-72 rounded-[12px] border bg-background p-3 shadow-xl">
          <input type="hidden" name="view" value="overview" />
          <input type="hidden" name="range" value={range} />
          <input type="hidden" name="from" value={dashboardStartDate} />
          <input type="hidden" name="to" value={dashboardEndDate} />
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {workers.map((worker) => (
              <label key={worker.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  name="workers"
                  value={worker.id}
                  defaultChecked={selectedWorkerSet.has(worker.id)}
                  className="h-4 w-4 accent-black"
                />
                <span className="truncate">{worker.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            <Button asChild size="sm" variant={selectedWorkerIds.length ? "ghost" : "default"}>
              <Link href={allWorkersHref}>All</Link>
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
