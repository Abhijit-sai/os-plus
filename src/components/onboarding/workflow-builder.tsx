"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { saveSetupWorkflow } from "@/features/onboarding/actions";
import { starterStages } from "@/features/onboarding/model";
import {
  initialResult,
  selectClass,
  SetupFeedback,
} from "@/components/onboarding/setup-forms";
import { SortableStages } from "@/components/settings/sortable-stages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NamedRecord = { id: string; name: string };
type Stage = NamedRecord & { groups: NamedRecord[] };
type DraftStage = {
  key: string;
  stageId: string;
  name: string;
  workgroupId: string;
};

export function SetupWorkflowBuilder({
  tenantId,
  garment,
  stages,
  groups,
  firstWorkflow,
}: {
  tenantId: string;
  garment: NamedRecord;
  stages: Stage[];
  groups: NamedRecord[];
  firstWorkflow: boolean;
}) {
  const [result, submit, pending] = useActionState(
    saveSetupWorkflow.bind(null, tenantId),
    initialResult,
  );
  const suggestedGroup =
    groups.find((group) => group.name.toLowerCase() === "production")?.id ??
    (groups.length === 1 ? groups[0].id : "");
  function newStage(key: string, name = ""): DraftStage {
    const existing = stages.find(
      (stage) => stage.name.toLowerCase() === name.toLowerCase(),
    );
    return {
      key,
      stageId: existing?.id ?? "",
      name,
      workgroupId: suggestedGroup,
    };
  }
  const [name, setName] = useState(
    firstWorkflow ? `${garment.name} · Standard`.slice(0, 65) : "",
  );
  const [makeDefault, setMakeDefault] = useState(firstWorkflow);
  const [rows, setRows] = useState(() =>
    starterStages.map((name, index) => newStage(`starter-${index}`, name)),
  );
  const [mode, setMode] = useState<"starter" | "custom">("starter");
  const hasUnassigned = rows.some((row) => !row.stageId && !row.workgroupId);

  function update(key: string, fields: Partial<DraftStage>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );
  }

  return (
    <form action={submit} className="space-y-4" data-unsaved-guard="true">
      <input type="hidden" name="garmentId" value={garment.id} />
      <input
        type="hidden"
        name="stages"
        value={JSON.stringify(
          rows.map((row) =>
            row.stageId
              ? { stageId: row.stageId }
              : { name: row.name, workgroupId: row.workgroupId },
          ),
        )}
      />
      <div
        className="flex flex-wrap gap-2"
        aria-label="Workflow starting point"
      >
        <Button
          type="button"
          variant="outline"
          aria-pressed={mode === "starter"}
          className="aria-pressed:bg-emerald-50"
          onClick={() => {
            if (
              mode === "starter" ||
              !window.confirm(
                "Replace the current draft stages with the starter workflow?",
              )
            )
              return;
            setRows(
              starterStages.map((name, index) =>
                newStage(`starter-${index}`, name),
              ),
            );
            setMode("starter");
          }}
        >
          Five-stage starter
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-pressed={mode === "custom"}
          className="aria-pressed:bg-emerald-50"
          onClick={() => {
            if (
              mode === "custom" ||
              !window.confirm(
                "Replace the current draft stages with a blank workflow?",
              )
            )
              return;
            setRows([newStage("blank")]);
            setMode("custom");
          }}
        >
          Start from scratch
        </Button>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Workflow name
        <Input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Express alterations"
          required
          minLength={2}
          maxLength={65}
        />
      </label>
      <div>
        <h3 className="font-medium">Production stages</h3>
        <p className="text-sm text-muted-foreground">
          Stages run top to bottom. Drag the handle or use the arrows to
          reorder.
        </p>
      </div>
      <SortableStages
        rows={rows}
        onChange={setRows}
        renderRow={(row, index) => {
          const stage = stages.find((entry) => entry.id === row.stageId);
          return (
            <div className="flex items-start gap-1">
              <div className="grid flex-1 gap-2">
                <select
                  aria-label={`Stage ${index + 1} source`}
                  value={row.stageId}
                  className={selectClass}
                  onChange={(event) =>
                    update(row.key, { stageId: event.target.value })
                  }
                >
                  <option value="">Create a new stage</option>
                  {stages.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                {stage ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    {stage.groups.length
                      ? stage.groups.map((group) => group.name).join(", ")
                      : "No workgroup assigned. Add one in Workflow settings."}
                  </p>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    <Input
                      aria-label={`Stage ${index + 1} name`}
                      value={row.name}
                      onChange={(event) =>
                        update(row.key, { name: event.target.value })
                      }
                      placeholder="Stage name"
                      required
                      minLength={2}
                      maxLength={65}
                    />
                    <select
                      aria-label={`Stage ${index + 1} workgroup`}
                      value={row.workgroupId}
                      onChange={(event) =>
                        update(row.key, { workgroupId: event.target.value })
                      }
                      className={selectClass}
                      required
                    >
                      <option value="">Choose workgroup</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove stage ${index + 1}`}
                disabled={rows.length === 1}
                onClick={() =>
                  setRows(rows.filter((entry) => entry.key !== row.key))
                }
              >
                <X className="size-4" />
              </Button>
            </div>
          );
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={rows.length >= 50}
        onClick={() => setRows([...rows, newStage(crypto.randomUUID())])}
      >
        <Plus className="mr-1 size-4" /> Add stage
      </Button>
      {hasUnassigned ? (
        <p className="text-sm text-amber-800">
          {groups.length
            ? "Choose a workgroup for each new stage before saving."
            : "Add a workgroup in Employee teams before saving a new stage."}
        </p>
      ) : null}
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="makeDefault"
          checked={makeDefault}
          onChange={(event) => setMakeDefault(event.target.checked)}
        />
        Use as the default workflow for {garment.name}
      </label>
      <Button disabled={pending || hasUnassigned}>
        {pending ? "Saving…" : "Save workflow"}
      </Button>
      <SetupFeedback result={result} />
    </form>
  );
}
