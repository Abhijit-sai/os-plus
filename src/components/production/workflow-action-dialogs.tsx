"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";

import {
  changeItemWorkflowFormAction,
  correctStageFormAction,
  type FormActionState,
} from "@/features/production/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ItemStageInstance,
  ItemStageWorkLog,
  Workflow,
} from "@/types/database";

const initialState: FormActionState = {
  ok: false,
  message: null,
};

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );
  return offsetDate.toISOString().slice(0, 16);
}

function EditStageButton() {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
      aria-label="Correct stage"
    >
      <Pencil className="h-4 w-4" />
    </span>
  );
}

function SubmitButton({
  idleLabel,
  pendingLabel,
  variant = "default",
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: "default" | "outline";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

export function ChangeWorkflowDialog({
  orderItemId,
  currentWorkflowId,
  workflows,
  hasStartedWork,
}: {
  orderItemId: string;
  currentWorkflowId: string;
  workflows: Workflow[];
  hasStartedWork: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<FormActionState>(initialState);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setState(initialState);
    }

    setOpen(nextOpen);
  }

  async function formAction(formData: FormData) {
    const nextState = await changeItemWorkflowFormAction(state, formData);
    setState(nextState);

    if (nextState.ok) {
      setOpen(false);
    }
  }

  return (
    <Dialog
      title="Change workflow"
      description="Replace this item's workflow and regenerate stages from the selected workflow."
      trigger={
        <span className="inline-flex h-9 items-center justify-center rounded-[10px] border px-3 text-sm font-medium hover:bg-accent">
          Change workflow
        </span>
      }
      open={open}
      onOpenChange={handleOpenChange}
    >
      <form action={formAction} className="space-y-4" data-unsaved-guard="true" data-preserve-dirty-on-submit="true">
        <input type="hidden" name="orderItemId" value={orderItemId} />
        {state.message ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}
        {hasStartedWork ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
            Work has already started on this item. Changing workflow will close
            the current workflow path, cancel active work logs, create a fresh
            workflow, and preserve the old activity in history.
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`changeWorkflow-${orderItemId}`}>New workflow</Label>
          <select
            id={`changeWorkflow-${orderItemId}`}
            name="workflowId"
            defaultValue=""
            className="h-10 rounded-md border bg-background px-3 text-sm"
            required
          >
            <option value="">Select workflow</option>
            {workflows.map((candidate) => (
              <option
                key={candidate.id}
                value={candidate.id}
                disabled={candidate.id === currentWorkflowId}
              >
                {candidate.name}
                {candidate.id === currentWorkflowId ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`changeWorkflowReason-${orderItemId}`}>Reason</Label>
          <Input
            id={`changeWorkflowReason-${orderItemId}`}
            name="reason"
            placeholder="Why is this workflow changing?"
            required
          />
        </div>
        <SubmitButton idleLabel="Change workflow" pendingLabel="Changing..." />
      </form>
    </Dialog>
  );
}

export function CorrectStageDialog({
  stageInstance,
  stageName,
  activeLog,
  eligibleWorkers,
}: {
  stageInstance: ItemStageInstance;
  stageName: string;
  activeLog: ItemStageWorkLog | null;
  eligibleWorkers: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<FormActionState>(initialState);
  const [status, setStatus] = React.useState(stageInstance.status);
  const needsWorker = status === "in_progress";
  const needsStartedAt = ["in_progress", "completed"].includes(status);
  const needsCompletedAt = status === "completed";

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setState(initialState);
      setStatus(stageInstance.status);
    }

    setOpen(nextOpen);
  }

  async function formAction(formData: FormData) {
    const nextState = await correctStageFormAction(state, formData);
    setState(nextState);

    if (nextState.ok) {
      setOpen(false);
    }
  }

  return (
    <Dialog
      title={`Correct ${stageName}`}
      description="Use this when the record is wrong. A correction history entry will be saved."
      trigger={<EditStageButton />}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <form
        action={formAction}
        className="grid gap-3"
        data-unsaved-guard="true"
        data-preserve-dirty-on-submit="true"
      >
        <input type="hidden" name="stageInstanceId" value={stageInstance.id} />
        {state.message ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`correction-status-${stageInstance.id}`}>
            Status
          </Label>
          <select
            id={`correction-status-${stageInstance.id}`}
            name="status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ItemStageInstance["status"])
            }
            className="h-10 rounded-md border bg-background px-3 text-sm"
            required
          >
            <option value="not_started">Not started</option>
            <option value="ready_to_start">Ready to start</option>
            <option value="in_progress">In progress</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        {["in_progress", "completed"].includes(status) ? (
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-sm font-medium">Work record</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`correction-worker-${stageInstance.id}`}>
                  Worker{needsWorker ? "" : " (optional)"}
                </Label>
                <select
                  id={`correction-worker-${stageInstance.id}`}
                  name="workerId"
                  defaultValue={activeLog?.worker_id ?? ""}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  required={needsWorker}
                >
                  <option value="">No worker</option>
                  {eligibleWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`correction-started-${stageInstance.id}`}>
                  Started time
                </Label>
                <Input
                  id={`correction-started-${stageInstance.id}`}
                  name="startedAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(
                    stageInstance.started_at ?? activeLog?.started_at ?? null,
                  )}
                  required={needsStartedAt}
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor={`correction-completed-${stageInstance.id}`}>
                  Completed time{needsCompletedAt ? "" : " (optional)"}
                </Label>
                <Input
                  id={`correction-completed-${stageInstance.id}`}
                  name="completedAt"
                  type="datetime-local"
                  defaultValue={toDateTimeLocalValue(
                    stageInstance.completed_at,
                  )}
                  required={needsCompletedAt}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="workerId" value="" />
            <input type="hidden" name="startedAt" value="" />
            <input type="hidden" name="completedAt" value="" />
          </>
        )}
        <div className="grid gap-2">
          <Label htmlFor={`correction-stage-notes-${stageInstance.id}`}>
            Stage notes
          </Label>
          <Input
            id={`correction-stage-notes-${stageInstance.id}`}
            name="stageNotes"
            defaultValue={stageInstance.notes ?? ""}
            placeholder="Optional note visible on this stage"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`correction-reason-${stageInstance.id}`}>
            Correction reason
          </Label>
          <Input
            id={`correction-reason-${stageInstance.id}`}
            name="correctionReason"
            placeholder="What was wrong in the original record?"
            required
          />
        </div>
        <SubmitButton idleLabel="Save correction" pendingLabel="Saving..." />
      </form>
    </Dialog>
  );
}
