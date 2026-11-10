"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SortableStages } from "@/components/settings/sortable-stages";
import { Button } from "@/components/ui/button";

type StageRow = { key: string; stageId: string; customerStatusId: string };
type Option = { id: string; name: string };
const selectClass =
  "min-h-11 w-full rounded-md border bg-background px-3 text-sm";

export function WorkflowSequenceFields({
  initialRows,
  stages,
  statuses,
}: {
  initialRows: StageRow[];
  stages: Option[];
  statuses: Option[];
}) {
  const blank = { key: "blank", stageId: "", customerStatusId: "" };
  const [rows, setRows] = useState(initialRows.length ? initialRows : [blank]);

  function update(key: string, fields: Partial<StageRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );
  }

  return (
    <>
      <SortableStages
        rows={rows}
        onChange={setRows}
        renderRow={(row, index) => (
          <div className="flex items-center gap-1">
            <div className="grid flex-1 gap-2 md:grid-cols-2">
              <select
                aria-label={`Stage ${index + 1}`}
                name={`stageId_${index + 1}`}
                className={selectClass}
                required
                value={row.stageId}
                onChange={(event) =>
                  update(row.key, { stageId: event.target.value })
                }
              >
                <option value="">Choose a stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Stage ${index + 1} customer status`}
                name={`customerStatusId_${index + 1}`}
                className={selectClass}
                value={row.customerStatusId}
                onChange={(event) =>
                  update(row.key, { customerStatusId: event.target.value })
                }
              >
                <option value="">No customer status</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={rows.length === 1}
              aria-label={`Remove stage ${index + 1}`}
              onClick={() =>
                setRows(rows.filter((entry) => entry.key !== row.key))
              }
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      />
      <Button
        type="button"
        variant="outline"
        disabled={rows.length >= 50}
        onClick={() =>
          setRows([...rows, { ...blank, key: crypto.randomUUID() }])
        }
      >
        Add stage
      </Button>
    </>
  );
}
