"use client";

import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { stageContributionAction, type StageContributionActionState } from "@/features/production/contribution-actions";
import { calculateStageContributions } from "@/features/production/contributions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ItemStageInstance,
  ItemStageWorkLog,
  ItemTypeStageContributionRule,
  StageEffortTrackingMode,
  Worker,
  WorkerWorkgroup,
  Workgroup,
} from "@/types/database";

type Row = {
  key: string;
  workerId: string;
  workgroupId: string;
  creditedUnits: string;
  creditedMinutes: number;
};

const emptyState: StageContributionActionState = { ok: false, message: null };

function newRow(defaultUnits = 0): Row {
  return { key: crypto.randomUUID(), workerId: "", workgroupId: "", creditedUnits: String(defaultUnits), creditedMinutes: 0 };
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

function elapsedMinutes(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) return null;
  const elapsed = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60_000);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : null;
}

function formatRuleSummary(stage: ItemStageInstance) {
  if (!stage.contribution_method_snapshot || stage.contribution_rate_snapshot === null) return "Rate not configured";
  if (stage.contribution_method_snapshot === "per_unit") return `${formatMoney(stage.contribution_rate_snapshot)} per unit`;
  if (stage.contribution_method_snapshot === "per_hour") return `${formatMoney(stage.contribution_rate_snapshot)} per hour`;
  return `${stage.contribution_rate_snapshot}% pool · allocated by ${stage.contribution_allocation_basis_snapshot ?? "units"}`;
}

function stageRule(
  stage: ItemStageInstance,
  configuredRule: ItemTypeStageContributionRule | null,
) {
  if (stage.status === "ready_to_start") {
    return configuredRule
      ? {
          allocationBasis: configuredRule.percentage_allocation_basis ?? (configuredRule.calculation_method === "per_hour" ? "hours" : "units"),
          itemValue: 0,
          method: configuredRule.calculation_method,
          rateValue: configuredRule.rate_value,
        }
      : null;
  }
  return stage.contribution_method_snapshot && stage.contribution_rate_snapshot !== null
    ? {
        allocationBasis: stage.contribution_allocation_basis_snapshot ?? (stage.contribution_method_snapshot === "per_hour" ? "hours" : "units"),
        itemValue: stage.contribution_item_value_snapshot ?? 0,
        method: stage.contribution_method_snapshot,
        rateValue: stage.contribution_rate_snapshot,
      }
    : null;
}

export function StageContributionEditor({
  canCorrectCompleted,
  configuredRule,
  itemFinalValue,
  itemQuantity,
  logs,
  mode,
  stage,
  stageName,
  allowedWorkgroupIds,
  workerWorkgroups,
  workers,
  workgroups,
}: {
  canCorrectCompleted: boolean;
  configuredRule: ItemTypeStageContributionRule | null;
  itemFinalValue: number;
  itemQuantity: number;
  logs: ItemStageWorkLog[];
  mode: StageEffortTrackingMode;
  stage: ItemStageInstance;
  stageName: string;
  allowedWorkgroupIds: string[];
  workerWorkgroups: WorkerWorkgroup[];
  workers: Worker[];
  workgroups: Workgroup[];
}) {
  const [open, setOpen] = React.useState(false);
  const [idempotencyKey, setIdempotencyKey] = React.useState("");
  const [state, formAction, pending] = React.useActionState(async (
    previousState: StageContributionActionState,
    formData: FormData,
  ) => {
    const operation = String(formData.get("operation") ?? "");
    const nextState = await stageContributionAction(previousState, formData);
    if (nextState.ok) {
      setIdempotencyKey(crypto.randomUUID());
      if (operation === "complete") setOpen(false);
    }
    return nextState;
  }, emptyState);
  const initialRows = React.useMemo<Row[]>(() => logs.length
    ? logs.map((log) => ({
        key: `${log.worker_id}:${log.workgroup_id ?? ""}`,
        workerId: log.worker_id,
        workgroupId: log.workgroup_id ?? "",
        creditedUnits: String(log.credited_units ?? 0),
        creditedMinutes: log.credited_minutes ?? 0,
      }))
    : [], [logs]);
  const [rows, setRows] = React.useState<Row[]>(initialRows);

  const allowedSet = React.useMemo(() => new Set(allowedWorkgroupIds), [allowedWorkgroupIds]);
  const groupsByWorker = React.useMemo(() => {
    const result = new Map<string, string[]>();
    workerWorkgroups.forEach((mapping) => {
      if (!allowedSet.has(mapping.workgroup_id)) return;
      result.set(mapping.worker_id, [...(result.get(mapping.worker_id) ?? []), mapping.workgroup_id]);
    });
    return result;
  }, [allowedSet, workerWorkgroups]);
  const workerById = React.useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers]);
  const workgroupById = React.useMemo(() => new Map(workgroups.map((workgroup) => [workgroup.id, workgroup])), [workgroups]);
  const existingEffortPairs = React.useMemo(() => new Set(logs
    .filter((log) => (log.credited_units ?? 0) > 0 || (log.credited_minutes ?? 0) > 0)
    .map((log) => `${log.worker_id}:${log.workgroup_id ?? ""}`)), [logs]);
  const selectedPairs = new Set(rows.map((row) => `${row.workerId}:${row.workgroupId}`));
  const removedEffort = [...existingEffortPairs].some((pair) => !selectedPairs.has(pair));
  const effectiveRule = React.useMemo(() => {
    const rule = stageRule(stage, configuredRule);
    return rule ? { ...rule, itemValue: stage.status === "ready_to_start" ? itemFinalValue : rule.itemValue } : null;
  }, [configuredRule, itemFinalValue, stage]);
  const calculationKey = (row: Row) => row.workerId && row.workgroupId ? `${row.workerId}:${row.workgroupId}` : row.key;
  const calculation = calculateStageContributions(rows.map((row) => ({
    key: calculationKey(row),
    creditedMinutes: row.creditedMinutes,
    creditedUnits: Number(row.creditedUnits) || 0,
  })), effectiveRule);
  const amountByKey = new Map(calculation.allocations.map((allocation) => [allocation.key, allocation.amount]));
  const totalUnits = rows.reduce((sum, row) => sum + (Number(row.creditedUnits) || 0), 0);
  const totalMinutes = rows.reduce((sum, row) => sum + row.creditedMinutes, 0);
  const tracksUnits = mode === "units" || mode === "hybrid";
  const canOpen = stage.status === "ready_to_start" || stage.status === "in_progress"
    || (stage.status === "completed" && stage.effort_tracking_mode_snapshot !== null && canCorrectCompleted);
  const verb = stage.status === "ready_to_start" ? "Start stage" : stage.status === "in_progress" ? "Edit work" : "Correct contributions";
  const submitLabel = stage.status === "ready_to_start" ? "Start stage" : stage.status === "completed" ? "Save correction" : "Save contributions";
  const assignmentJson = JSON.stringify(rows.map((row) => ({
    worker_id: row.workerId,
    workgroup_id: row.workgroupId,
    credited_units: Number(row.creditedUnits) || 0,
    credited_minutes: row.creditedMinutes,
  })));

  function updateRow(key: string, patch: Partial<Row>) {
    if (state.ok) setIdempotencyKey(crypto.randomUUID());
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  function prepareChangedSubmission() {
    if (state.ok) setIdempotencyKey(crypto.randomUUID());
  }

  function openEditor() {
    setRows(initialRows.length ? initialRows : [tracksUnits ? newRow(itemQuantity) : newRow()]);
    setIdempotencyKey(crypto.randomUUID());
    setOpen(true);
  }

  function adjustUnits(row: Row, amount: number) {
    const currentUnits = Number(row.creditedUnits) || 0;
    const nextUnits = Math.round((currentUnits + amount) * 10) / 10;
    updateRow(row.key, { creditedUnits: String(Math.max(0, nextUnits)) });
  }

  const summary = logs.length ? (
    <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3 text-sm">
      {logs.map((log) => (
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center" key={log.id}>
          <span>{workerById.get(log.worker_id)?.name ?? "Unknown worker"} · {workgroupById.get(log.workgroup_id ?? "")?.name ?? "Unknown role"}</span>
          <span className="text-muted-foreground">
            {mode === "units" || mode === "hybrid" ? `${log.credited_units} units` : ""}
            {mode === "hybrid" ? " · " : ""}
            {mode === "hours" || mode === "hybrid" ? formatHours(log.credited_minutes) : ""}
            {` · ${formatMoney(log.calculated_contribution_amount)}`}
          </span>
        </div>
      ))}
      <div className="border-t pt-2 font-medium">
        {tracksUnits ? `Total credited units ${logs.reduce((sum, log) => sum + log.credited_units, 0)} / ${itemQuantity} · ` : ""}
        Total man-hours {formatHours(logs.reduce((sum, log) => sum + log.credited_minutes, 0))} · Contribution {formatMoney(logs.reduce((sum, log) => sum + log.calculated_contribution_amount, 0))}
      </div>
      {stage.status === "completed" ? (
        <div className="text-xs text-muted-foreground">
          Actual elapsed {elapsedMinutes(stage.started_at, stage.completed_at) === null ? "not recorded" : formatHours(elapsedMinutes(stage.started_at, stage.completed_at) ?? 0)}
          {` · ${formatRuleSummary(stage)}`}
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div>
      {summary}
      {canOpen ? (
        <Dialog
          className="max-w-6xl"
          description="Assign one or more eligible workers, choose the role performed, and record effort. Man-hours are summed worker effort—not elapsed stage time."
          onOpenChange={(nextOpen) => nextOpen ? openEditor() : setOpen(false)}
          open={open}
          placement="side"
          preventClose={pending}
          title={`${verb}: ${stageName}`}
          trigger={<span className={buttonVariants({ size: "sm", variant: stage.status === "ready_to_start" ? "default" : "outline" })}>{verb}</span>}
        >
          {({ close }) => (
            <form action={formAction} className="space-y-5" data-unsaved-guard="true">
              <input name="stageInstanceId" type="hidden" value={stage.id} />
              <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
              <input name="assignments" type="hidden" value={assignmentJson} />
              <input name="expectedRevision" type="hidden" value={stage.contribution_revision} />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Item quantity</p><p className="mt-1 font-semibold">{itemQuantity}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total credited units</p><p className="mt-1 font-semibold">{totalUnits}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Total man-hours</p><p className="mt-1 font-semibold">{formatHours(totalMinutes)}</p></div>
              </div>

              {!effectiveRule ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Rate not configured. Production can continue; calculated contribution will be ₹0.</div>
              ) : (
                <div className="rounded-md border p-3 text-sm">Calculated contribution pool: <strong>{formatMoney(calculation.totalAmount)}</strong>. This is analytics-only and does not affect salary, order totals, GST, payments, or finance.</div>
              )}

              <div className="space-y-3">
                {rows.map((row, index) => {
                  const workerGroupIds = groupsByWorker.get(row.workerId) ?? [];
                  const currentWorker = workerById.get(row.workerId);
                  const currentGroup = workgroupById.get(row.workgroupId);
                  return (
                    <div className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[minmax(180px,1.2fr)_minmax(160px,1fr)_minmax(140px,.7fr)_minmax(300px,1.4fr)_auto] lg:items-end" key={row.key}>
                      <div className="grid gap-2">
                        <Label htmlFor={`${stage.id}-worker-${row.key}`}>Worker {index + 1}</Label>
                        <select
                          className="h-10 rounded-md border bg-background px-3 text-sm"
                          disabled={pending}
                          id={`${stage.id}-worker-${row.key}`}
                          onChange={(event) => {
                            const eligibleGroups = groupsByWorker.get(event.target.value) ?? [];
                            updateRow(row.key, { workerId: event.target.value, workgroupId: eligibleGroups.length === 1 ? eligibleGroups[0] : "" });
                          }}
                          required
                          value={row.workerId}
                        >
                          <option value="">Select worker</option>
                          {workers.filter((worker) => worker.status === "active" && (groupsByWorker.get(worker.id)?.length ?? 0) > 0).map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                          {currentWorker && currentWorker.status !== "active" ? <option value={currentWorker.id}>{currentWorker.name} (inactive)</option> : null}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`${stage.id}-role-${row.key}`}>Performed role</Label>
                        <select className="h-10 rounded-md border bg-background px-3 text-sm" disabled={pending || !row.workerId} id={`${stage.id}-role-${row.key}`} onChange={(event) => updateRow(row.key, { workgroupId: event.target.value })} required value={row.workgroupId}>
                          <option value="">Select role</option>
                          {workerGroupIds.map((workgroupId) => <option key={workgroupId} value={workgroupId}>{workgroupById.get(workgroupId)?.name ?? "Unknown role"}</option>)}
                          {currentGroup && !workerGroupIds.includes(currentGroup.id) ? <option value={currentGroup.id}>{currentGroup.name} (historical)</option> : null}
                        </select>
                      </div>
                      {mode === "units" || mode === "hybrid" ? (
                        <div className="grid gap-2">
                          <Label htmlFor={`${stage.id}-units-${row.key}`}>Credited units</Label>
                          <Input disabled={pending} id={`${stage.id}-units-${row.key}`} min="0" onChange={(event) => updateRow(row.key, { creditedUnits: event.target.value })} step="0.1" type="number" value={row.creditedUnits} />
                          <div className="grid grid-cols-4 gap-1">
                            {[[-1, "−1"], [-0.1, "−0.1"], [0.1, "+0.1"], [1, "+1"]].map(([amount, label]) => {
                              const adjustment = Number(amount);
                              const rowUnits = Number(row.creditedUnits) || 0;
                              const exceedsItemQuantity = adjustment > 0 && totalUnits + adjustment > itemQuantity + 0.0001;
                              return (
                                <Button
                                  aria-label={`${String(label)} credited units`}
                                  disabled={pending || rowUnits + adjustment < -0.0001 || exceedsItemQuantity}
                                  key={String(label)}
                                  onClick={() => adjustUnits(row, adjustment)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  {adjustment < 0 ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                  <span className="sr-only">{String(label)}</span>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ) : <div />}
                      {mode === "hours" || mode === "hybrid" ? (
                        <div className="grid gap-2">
                          <Label>Credited time · {formatHours(row.creditedMinutes)}</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[[-60, "−1h"], [-10, "−10m"], [10, "+10m"], [60, "+1h"]].map(([amount, label]) => (
                              <Button disabled={pending || row.creditedMinutes + Number(amount) < 0} key={String(label)} onClick={() => updateRow(row.key, { creditedMinutes: Math.max(0, row.creditedMinutes + Number(amount)) })} size="sm" type="button" variant="outline">{Number(amount) < 0 ? <Minus className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}{String(label).replace(/[−+]/, "")}</Button>
                            ))}
                          </div>
                        </div>
                      ) : <div className="text-sm text-muted-foreground">Contribution {formatMoney(amountByKey.get(calculationKey(row)) ?? 0)}</div>}
                      <Button aria-label={`Remove worker ${index + 1}`} disabled={pending || rows.length === 1} onClick={() => { prepareChangedSubmission(); setRows((current) => current.filter((entry) => entry.key !== row.key)); }} size="icon" type="button" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
                      {mode === "hours" || mode === "hybrid" ? <p className="text-xs text-muted-foreground lg:col-start-4">Calculated contribution: {formatMoney(amountByKey.get(calculationKey(row)) ?? 0)}</p> : null}
                    </div>
                  );
                })}
              </div>

              <Button disabled={pending} onClick={() => { prepareChangedSubmission(); setRows((current) => [...current, newRow()]); }} type="button" variant="outline"><Plus className="mr-2 h-4 w-4" />Add worker</Button>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor={`${stage.id}-notes`}>{stage.status === "ready_to_start" ? "Stage notes" : "Notes"}</Label><Input disabled={pending} id={`${stage.id}-notes`} name="notes" onChange={prepareChangedSubmission} placeholder="Optional operational note" /></div>
                {stage.status === "completed" || removedEffort ? (
                  <div className="grid gap-2"><Label htmlFor={`${stage.id}-reason`}>Correction reason</Label><Input disabled={pending} id={`${stage.id}-reason`} minLength={3} name="correctionReason" onChange={prepareChangedSubmission} placeholder={stage.status === "completed" ? "Required for completed-stage correction" : "Required because recorded effort was removed"} required /></div>
                ) : <input name="correctionReason" type="hidden" value="" />}
              </div>

              {state.message ? <div aria-live="polite" className={`rounded-md border p-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>{state.message}</div> : null}

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background py-3 sm:flex-row sm:justify-end">
                <Button disabled={pending} onClick={close} type="button" variant="outline">Close</Button>
                <Button disabled={pending || !idempotencyKey} name="operation" pendingLabel={stage.status === "ready_to_start" ? "Starting stage..." : "Saving contributions..."} type="submit" value={stage.status === "ready_to_start" ? "start" : "replace"}>{submitLabel}</Button>
                {stage.status === "in_progress" ? (
                  <Button disabled={pending || !idempotencyKey} name="operation" pendingLabel="Completing stage..." type="submit" value="complete" variant="secondary">Complete stage</Button>
                ) : null}
              </div>
            </form>
          )}
        </Dialog>
      ) : null}
    </div>
  );
}
