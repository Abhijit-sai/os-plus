"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SortableStages<Row extends { key: string }>({
  rows,
  onChange,
  renderRow,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  renderRow: (row: Row, index: number) => ReactNode;
}) {
  const list = useRef<HTMLOListElement>(null);
  const drag = useRef<{ index: number; pointerId: number } | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
    setAnnouncement(`Stage ${from + 1} moved to position ${to + 1}.`);
  }

  function rowUnderPointer(event: PointerEvent) {
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-sortable-stage]");
    return row && list.current?.contains(row)
      ? Number(row.dataset.sortableStage)
      : null;
  }

  return (
    <>
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <ol ref={list} className="space-y-2">
        {rows.map((row, index) => (
          <li
            key={row.key}
            data-sortable-stage={index}
            className={cn(
              "grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2 rounded-lg border bg-background p-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_5rem] sm:items-center",
              target === index && "border-emerald-700 bg-emerald-50",
            )}
          >
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span
                aria-hidden="true"
                className="inline-flex size-10 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground active:cursor-grabbing"
                onPointerDown={(event) => {
                  if (!event.isPrimary || event.button !== 0) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = { index, pointerId: event.pointerId };
                  setTarget(index);
                }}
                onPointerMove={(event) => {
                  if (drag.current?.pointerId === event.pointerId)
                    setTarget(rowUnderPointer(event));
                }}
                onPointerUp={(event) => {
                  if (drag.current?.pointerId !== event.pointerId) return;
                  const to = rowUnderPointer(event);
                  if (to !== null) move(drag.current.index, to);
                  drag.current = null;
                  setTarget(null);
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                  setTarget(null);
                }}
              >
                <GripVertical className="size-4" />
              </span>
            </div>
            <div className="min-w-0">{renderRow(row, index)}</div>
            <div className="col-start-2 flex justify-end sm:col-start-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-disabled={index === 0}
                className="aria-disabled:opacity-35"
                aria-label={`Move stage ${index + 1} up`}
                onClick={() => move(index, index - 1)}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-disabled={index === rows.length - 1}
                className="aria-disabled:opacity-35"
                aria-label={`Move stage ${index + 1} down`}
                onClick={() => move(index, index + 1)}
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
