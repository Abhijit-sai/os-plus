import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import {
  completeStageAction,
  initializeItemWorkflowAction,
  startStageAction
} from "@/features/production/actions";
import { StatusBadge } from "@/components/design-system/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChangeWorkflowDialog, CorrectStageDialog } from "@/components/production/workflow-action-dialogs";
import type {
  ItemHistory,
  ItemStageInstance,
  ItemStageWorkLog,
  ItemType,
  Json,
  Order,
  OrderItem,
  StageMaster,
  StageWorkgroup,
  Worker,
  WorkerWorkgroup,
  Workgroup,
  Workflow,
  ItemWorkflowInstance,
  CustomerMeasurement
} from "@/types/database";

function jsonObject(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStatus(value: string | null) {
  return value ? value.replaceAll("_", " ") : "not set";
}

function getMeasurementEntries(measurementData: Json) {
  if (!measurementData || Array.isArray(measurementData) || typeof measurementData !== "object") {
    return [];
  }

  return Object.entries(measurementData).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

function describeHistoryEvent(
  event: ItemHistory,
  stageInstanceById: Map<string, { stage_master_id: string; sequence_number: number }>,
  stageById: Map<string, { name: string }>,
  workerById: Map<string, { name: string }>
) {
  const data = jsonObject(event.new_value_json);
  const oldData = jsonObject(event.old_value_json);
  const stageInstanceId = stringValue(data.stage_instance_id);
  const nextStageInstanceId = stringValue(data.next_stage_instance_id);
  const workerId = stringValue(data.worker_id);
  const workflowId = stringValue(data.workflow_id);
  const stageInstance = stageInstanceId ? stageInstanceById.get(stageInstanceId) : null;
  const nextStageInstance = nextStageInstanceId ? stageInstanceById.get(nextStageInstanceId) : null;
  const stageName = stageInstance ? stageById.get(stageInstance.stage_master_id)?.name : null;
  const nextStageName = nextStageInstance ? stageById.get(nextStageInstance.stage_master_id)?.name : null;
  const workerName = workerId ? workerById.get(workerId)?.name : null;

  if (event.event_type === "workflow_assigned") {
    return {
      title: "Workflow initialized",
      detail: workflowId ? "Workflow instance created for this item." : "Workflow instance created."
    };
  }

  if (event.event_type === "stage_started") {
    return {
      title: `${stageName ?? "Stage"} started`,
      detail: workerName ? `Assigned to ${workerName}.` : "Stage work started."
    };
  }

  if (event.event_type === "stage_completed") {
    return {
      title: `${stageName ?? "Stage"} completed`,
      detail: nextStageName ? `Next stage is ready: ${nextStageName}.` : "Workflow completed for this item."
    };
  }

  if (event.event_type === "stage_corrected") {
    const oldStatus = stringValue(oldData.status);
    const newStatus = stringValue(data.status);
    const oldWorkerId = stringValue(oldData.active_worker_id);
    const newWorkerId = stringValue(data.worker_id);
    const oldStartedAt = stringValue(oldData.started_at);
    const newStartedAt = stringValue(data.started_at);
    const oldCompletedAt = stringValue(oldData.completed_at);
    const newCompletedAt = stringValue(data.completed_at);
    const changes = [];

    if (oldStatus !== newStatus) {
      changes.push(`status ${formatStatus(oldStatus)} to ${formatStatus(newStatus)}`);
    }

    if (oldWorkerId !== newWorkerId && newWorkerId) {
      changes.push(`worker ${workerById.get(newWorkerId)?.name ?? "updated"}`);
    }

    if (oldStartedAt !== newStartedAt && newStartedAt) {
      changes.push(`started ${formatDateTime(newStartedAt)}`);
    }

    if (oldCompletedAt !== newCompletedAt && newCompletedAt) {
      changes.push(`completed ${formatDateTime(newCompletedAt)}`);
    }

    return {
      title: `${stageName ?? "Stage"} corrected`,
      detail: changes.length ? `Changed ${changes.join("; ")}.` : "Stage record was corrected."
    };
  }

  return {
    title: event.event_type.replaceAll("_", " "),
    detail: "Workflow event recorded."
  };
}

function StageDot({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Completed" />;
  }

  return <span className={`mt-1 h-3 w-3 rounded-full ${status === "in_progress" ? "bg-primary" : status === "ready_to_start" ? "bg-amber-500" : status === "blocked" ? "bg-destructive" : "bg-muted-foreground/30"}`} />;
}

function HistoryTimeline({
  history,
  stageInstanceById,
  stageById,
  workerById
}: {
  history: ItemHistory[];
  stageInstanceById: Map<string, { stage_master_id: string; sequence_number: number }>;
  stageById: Map<string, { name: string }>;
  workerById: Map<string, { name: string }>;
}) {
  return (
    <div className="space-y-0">
      {history.map((event) => {
        const description = describeHistoryEvent(event, stageInstanceById, stageById, workerById);

        return (
          <div key={event.id} className="grid grid-cols-[96px_24px_1fr] gap-3 text-sm">
            <div className="py-3 text-right text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
              }).format(new Date(event.created_at))}
            </div>
            <div className="relative flex justify-center">
              <span className="absolute bottom-0 top-0 w-px bg-border" />
              <span className="relative mt-4 h-3 w-3 rounded-full border bg-background ring-4 ring-background" />
            </div>
            <div className="border-b py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{description.title}</p>
                <StatusBadge value={event.event_type} />
              </div>
              <p className="mt-1 text-muted-foreground">{description.detail}</p>
              {event.notes ? <p className="mt-1 text-muted-foreground">{event.notes}</p> : null}
            </div>
          </div>
        );
      })}
      {!history.length ? <p className="text-sm text-muted-foreground">No history yet.</p> : null}
    </div>
  );
}

export function ItemWorkflowPanel({
  item,
  order,
  workflow,
  workflows,
  itemType,
  workflowInstance,
  stageInstances,
  stages,
  workers,
  workerWorkgroups,
  stageWorkgroups,
  workgroups,
  workLogs,
  history,
  linkedMeasurement,
  variant = "page"
}: {
  item: OrderItem;
  order: Order | null;
  workflow: Workflow | null;
  workflows: Workflow[];
  itemType: ItemType | null;
  workflowInstance: ItemWorkflowInstance | null;
  stageInstances: ItemStageInstance[];
  stages: StageMaster[];
  workers: Worker[];
  workerWorkgroups: WorkerWorkgroup[];
  stageWorkgroups: StageWorkgroup[];
  workgroups: Workgroup[];
  workLogs: ItemStageWorkLog[];
  history: ItemHistory[];
  linkedMeasurement?: CustomerMeasurement | null;
  variant?: "page" | "pane";
}) {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const stageInstanceById = new Map(stageInstances.map((stageInstance) => [stageInstance.id, stageInstance]));
  const workgroupById = new Map(workgroups.map((workgroup) => [workgroup.id, workgroup]));
  const activeLogsByStageId = new Map(workLogs.filter((log) => log.status === "in_progress").map((log) => [log.stage_instance_id, log]));
  const workerWorkgroupIdsByWorkerId = new Map<string, Set<string>>();

  workerWorkgroups.forEach((mapping) => {
    const existing = workerWorkgroupIdsByWorkerId.get(mapping.worker_id) ?? new Set<string>();
    existing.add(mapping.workgroup_id);
    workerWorkgroupIdsByWorkerId.set(mapping.worker_id, existing);
  });

  const activeStage = stageInstances.find((stage) => ["ready_to_start", "in_progress", "paused", "blocked"].includes(stage.status));
  const completedStageCount = stageInstances.filter((stage) => stage.status === "completed").length;
  const progress = stageInstances.length ? Math.round((completedStageCount / stageInstances.length) * 100) : 0;
  const hasStartedWork =
    workflowInstance?.status !== "not_started" ||
    stageInstances.some((stage) => Boolean(stage.started_at) || !["not_started", "ready_to_start"].includes(stage.status)) ||
    Boolean(workLogs.length);
  const linkedMeasurementEntries = linkedMeasurement ? getMeasurementEntries(linkedMeasurement.measurement_data_json) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className={variant === "pane" ? "text-lg font-semibold leading-tight" : "text-2xl font-semibold tracking-tight"}>{item.name}</h2>
          <p className="text-sm text-muted-foreground">
            {order?.order_number ?? "Unknown order"} · {itemType?.name ?? "Unknown type"} · {workflow?.name ?? "Unknown workflow"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workflows.length > 1 ? (
            <ChangeWorkflowDialog orderItemId={item.id} currentWorkflowId={item.workflow_id} workflows={workflows} hasStartedWork={hasStartedWork} />
          ) : null}
          {variant === "pane" ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/production/items/${item.id}/workflow`} className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Open full page
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!workflowInstance ? (
        <Card>
          <CardHeader>
            <CardTitle>Initialize workflow</CardTitle>
            <CardDescription>This item was created before workflow execution instances existed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={initializeItemWorkflowAction}>
              <input type="hidden" name="orderItemId" value={item.id} />
              <Button type="submit">Create workflow instance</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Item status</p>
          <div className="mt-2"><StatusBadge value={item.item_status} /></div>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Active stage</p>
          <p className="mt-2 text-sm font-medium">{activeStage ? stageById.get(activeStage.stage_master_id)?.name ?? "Unknown stage" : "None"}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Progress</p>
          <p className="mt-2 text-sm font-medium">{completedStageCount}/{stageInstances.length} stages · {progress}%</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Measurement reference</CardTitle>
          <CardDescription>Saved customer measurements attached to this production item.</CardDescription>
        </CardHeader>
        <CardContent>
          {linkedMeasurement ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{linkedMeasurement.reference_name ?? itemType?.name ?? "Customer measurement"}</p>
                  <p className="text-sm text-muted-foreground">
                    Updated {formatDateTime(linkedMeasurement.updated_at)}
                    {linkedMeasurement.notes ? ` · ${linkedMeasurement.notes}` : ""}
                  </p>
                </div>
                {linkedMeasurement.is_default ? <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">default</span> : null}
              </div>
              {linkedMeasurementEntries.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {linkedMeasurementEntries.map(([key, value]) => (
                    <div key={key} className="rounded-md bg-muted px-3 py-2 text-sm">
                      <span className="font-medium">{key}</span>
                      <span className="text-muted-foreground">: {value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No measurement fields saved.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No measurements available for this item.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <input id={`workflow-tab-${item.id}`} name={`workflow-tabs-${item.id}`} type="radio" className="peer/workflow sr-only" defaultChecked />
        <input id={`history-tab-${item.id}`} name={`workflow-tabs-${item.id}`} type="radio" className="peer/history sr-only" />
        <label
          htmlFor={`workflow-tab-${item.id}`}
          className="inline-flex cursor-pointer rounded-l-md border border-r-0 bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground peer-checked/workflow:bg-foreground peer-checked/workflow:text-background"
        >
          Workflow
        </label>
        <label
          htmlFor={`history-tab-${item.id}`}
          className="inline-flex cursor-pointer rounded-r-md border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground peer-checked/history:bg-foreground peer-checked/history:text-background"
        >
          History
        </label>

        <div className="hidden peer-checked/workflow:block">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Stages</CardTitle>
            <CardDescription>Move the item through stages or correct the operational record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stageInstances.map((stageInstance) => {
              const stage = stageById.get(stageInstance.stage_master_id);
              const activeLog = activeLogsByStageId.get(stageInstance.id);
              const allowedWorkgroupIds = stageWorkgroups.filter((mapping) => mapping.stage_master_id === stageInstance.stage_master_id).map((mapping) => mapping.workgroup_id);
              const allowedWorkgroupIdSet = new Set(allowedWorkgroupIds);
              const eligibleWorkers = workers.filter((worker) => {
                const workerWorkgroupIds = workerWorkgroupIdsByWorkerId.get(worker.id);
                return workerWorkgroupIds ? Array.from(workerWorkgroupIds).some((workgroupId) => allowedWorkgroupIdSet.has(workgroupId)) : false;
              });
              const allowedWorkgroupNames = allowedWorkgroupIds.map((workgroupId) => workgroupById.get(workgroupId)?.name).filter(Boolean).join(", ");

              return (
                <div key={stageInstance.id} className="rounded-md border p-3">
                  <div className="flex gap-3">
                    <StageDot status={stageInstance.status} />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                        <div>
                          <div className="space-y-1">
                            <p className="font-medium">{stageInstance.sequence_number}. {stage?.name ?? "Unknown stage"}</p>
                            <div><StatusBadge value={stageInstance.status} /></div>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Started {formatDateTime(stageInstance.started_at)} · Completed {formatDateTime(stageInstance.completed_at)}
                            {activeLog ? ` · ${workerById.get(activeLog.worker_id)?.name ?? "Worker"} active` : ""}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          {stageInstance.status === "in_progress" ? (
                            <form action={completeStageAction} className="flex flex-col gap-2 sm:flex-row">
                              <input type="hidden" name="stageInstanceId" value={stageInstance.id} />
                              <Input name="notes" placeholder="Completion notes" />
                              <Button type="submit" size="sm">Complete</Button>
                            </form>
                          ) : null}
                          <CorrectStageDialog
                            stageInstance={stageInstance}
                            stageName={stage?.name ?? "stage"}
                            activeLog={activeLog ?? null}
                            eligibleWorkers={eligibleWorkers}
                          />
                        </div>
                      </div>

                      {stageInstance.status === "ready_to_start" ? (
                        eligibleWorkers.length ? (
                          <form action={startStageAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                            <input type="hidden" name="stageInstanceId" value={stageInstance.id} />
                            <div className="grid gap-2">
                              <Label htmlFor={`worker-${stageInstance.id}`}>Worker</Label>
                              <select id={`worker-${stageInstance.id}`} name="workerId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
                                <option value="">Select worker</option>
                                {eligibleWorkers.map((worker) => (
                                  <option key={worker.id} value={worker.id}>{worker.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`notes-${stageInstance.id}`}>Notes</Label>
                              <Input id={`notes-${stageInstance.id}`} name="notes" placeholder="Optional" />
                            </div>
                            <Button type="submit">Start</Button>
                          </form>
                        ) : (
                          <div className="rounded-md border p-3 text-sm text-muted-foreground">
                            {allowedWorkgroupIds.length
                              ? `No active workers are mapped to this stage's allowed workgroups: ${allowedWorkgroupNames}.`
                              : "No allowed workgroups are configured for this stage."}
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {!stageInstances.length ? <p className="text-sm text-muted-foreground">No stage instances yet.</p> : null}
          </CardContent>
        </Card>
        </div>

        <div className="hidden peer-checked/history:block">
        <Card>
          <CardHeader>
            <CardTitle>Recent History</CardTitle>
            <CardDescription>Timeline of major workflow events for this item.</CardDescription>
          </CardHeader>
          <CardContent>
            <HistoryTimeline history={history} stageInstanceById={stageInstanceById} stageById={stageById} workerById={workerById} />
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
