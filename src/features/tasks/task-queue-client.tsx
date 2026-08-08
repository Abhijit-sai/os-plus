"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, CirclePlay, ClipboardPlus, Loader2, UserPlus, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionFeedback } from "@/components/ui/action-feedback-provider";
import { getOrCreateCommandKey, type PendingCommandKey } from "@/core/idempotency/client-command-key";
import { assignTaskAction, cancelTaskAction, completeTaskAction, createTaskAction, startTaskAction } from "@/features/tasks/actions";
import type { TaskQueueItem } from "@/features/tasks/queries";
import type { TaskPriority, TaskStatus, Team, TenantUser } from "@/types/database";

type AssignableUser = Pick<TenantUser, "id" | "display_name" | "email" | "role">;
type AssignableTeam = Pick<Team, "id" | "name" | "code">;
type TaskFormAction = (formData: FormData) => Promise<void>;

const priorityLabels: Record<TaskPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  CRITICAL: "Critical"
};

const statusLabels: Record<TaskStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getAssigneeLabel(item: TaskQueueItem) {
  const userLabel = item.assignedUser?.display_name ?? item.assignedUser?.email ?? null;
  const teamLabel = item.assignedTeam ? `${item.assignedTeam.name} (${item.assignedTeam.code})` : null;

  if (userLabel && teamLabel) {
    return `${userLabel} + ${teamLabel}`;
  }

  return userLabel ?? teamLabel ?? "Unassigned";
}

export function TaskQueueClient({
  items,
  assignableUsers,
  assignableTeams
}: {
  items: TaskQueueItem[];
  assignableUsers: AssignableUser[];
  assignableTeams: AssignableTeam[];
}) {
  const router = useRouter();
  const actionFeedback = useActionFeedback();
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingCommandRef = useRef<string | null>(null);
  const pendingKeysRef = useRef(new Map<string, PendingCommandKey>());

  async function submitCommand(form: HTMLFormElement, action: TaskFormAction, commandName: string, idempotencyPrefix: string, resetOnSuccess = false) {
    if (pendingCommandRef.current) {
      return;
    }

    const formData = new FormData(form);
    formData.set("idempotencyKey", getOrCreateCommandKey(pendingKeysRef.current, commandName, idempotencyPrefix, formData));
    pendingCommandRef.current = commandName;
    setPendingCommand(commandName);
    setErrorMessage(null);
    actionFeedback?.startAction("task-command", "Updating task...");

    try {
      await action(formData);
      pendingKeysRef.current.delete(commandName);
      if (resetOnSuccess) {
        form.reset();
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Task command failed.");
    } finally {
      actionFeedback?.finishAction("task-command");
      pendingCommandRef.current = null;
      setPendingCommand(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-busy={pendingCommand !== null}>
      {pendingCommand ? (
        <div className="sticky top-2 z-40 flex items-center justify-center gap-2 rounded-md border bg-background/95 px-4 py-3 text-sm font-medium shadow-sm backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Updating task queue…
        </div>
      ) : null}
      <div>
        <p className="text-sm font-medium text-muted-foreground">Operations</p>
        <h2 className="text-2xl font-semibold tracking-normal">Task queue</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create task</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage ? <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p> : null}
          <form
            className="grid gap-4 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCommand(event.currentTarget, createTaskAction, "create-task", "create-task", true);
            }}
          >
            <input type="hidden" name="subjectType" value="general" />
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Verify intake for morning batch" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskType">Type</Label>
              <select id="taskType" name="taskType" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="GENERAL">General</option>
                <option value="PROCESS_WORK_UNIT">Process work unit</option>
                <option value="VERIFY_INTAKE">Verify intake</option>
                <option value="DELIVERY">Delivery</option>
                <option value="COLLECT_PAYMENT">Collect payment</option>
                <option value="INVESTIGATE_VARIANCE">Investigate variance</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="NORMAL">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional note" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedUserId">User</Label>
              <select id="assignedUserId" name="assignedUserId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">No user</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name ?? user.email ?? user.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedTeamId">Team</Label>
              <select id="assignedTeamId" name="assignedTeamId" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">No team</option>
                {assignableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueAt">Due</Label>
              <Input id="dueAt" name="dueAt" type="datetime-local" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full gap-2" disabled={pendingCommand !== null}>
                {pendingCommand === "create-task" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}
                {pendingCommand === "create-task" ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {items.length ? (
          items.map((item) => (
            <Card key={item.task.id}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_360px]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border px-2 py-1 text-xs font-medium">{statusLabels[item.task.status]}</span>
                    <span className="rounded-md border px-2 py-1 text-xs font-medium">{priorityLabels[item.task.priority]}</span>
                    <span className="text-xs text-muted-foreground">{item.task.task_type.replaceAll("_", " ")}</span>
                  </div>
                  <div>
                    <h3 className="break-words text-base font-semibold">{item.task.title}</h3>
                    {item.task.description ? <p className="mt-1 break-words text-sm text-muted-foreground">{item.task.description}</p> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getAssigneeLabel(item)} · {formatDateTime(item.task.due_at)}
                  </p>
                </div>

                <div className="grid gap-2">
                  <form
                    className="grid grid-cols-[1fr_1fr_auto] gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitCommand(event.currentTarget, assignTaskAction, `assign-task-${item.task.id}`, `assign-task-${item.task.id}`);
                    }}
                  >
                    <input type="hidden" name="taskId" value={item.task.id} />
                    <select name="assignedUserId" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" defaultValue={item.task.assigned_user_id ?? ""}>
                      <option value="">No user</option>
                      {assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.display_name ?? user.email ?? user.role}
                        </option>
                      ))}
                    </select>
                    <select name="assignedTeamId" className="h-9 min-w-0 rounded-md border bg-background px-2 text-sm" defaultValue={item.task.assigned_team_id ?? ""}>
                      <option value="">No team</option>
                      {assignableTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="outline" size="sm" className="gap-2" disabled={pendingCommand !== null}>
                      {pendingCommand === `assign-task-${item.task.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      {pendingCommand === `assign-task-${item.task.id}` ? "Assigning…" : "Assign"}
                    </Button>
                  </form>
                  <div className="grid grid-cols-3 gap-2">
                    <TaskCommandButton
                      action={startTaskAction}
                      taskId={item.task.id}
                      commandName={`start-task-${item.task.id}`}
                      idempotencyPrefix={`start-task-${item.task.id}`}
                      disabled={["IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(item.task.status)}
                      pendingCommand={pendingCommand}
                      onSubmit={submitCommand}
                    >
                      <CirclePlay className="h-4 w-4" />
                      Start
                    </TaskCommandButton>
                    <TaskCommandButton
                      action={completeTaskAction}
                      taskId={item.task.id}
                      commandName={`complete-task-${item.task.id}`}
                      idempotencyPrefix={`complete-task-${item.task.id}`}
                      disabled={["COMPLETED", "CANCELLED"].includes(item.task.status)}
                      pendingCommand={pendingCommand}
                      onSubmit={submitCommand}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete
                    </TaskCommandButton>
                    <TaskCommandButton
                      action={cancelTaskAction}
                      taskId={item.task.id}
                      commandName={`cancel-task-${item.task.id}`}
                      idempotencyPrefix={`cancel-task-${item.task.id}`}
                      disabled={["COMPLETED", "CANCELLED"].includes(item.task.status)}
                      pendingCommand={pendingCommand}
                      onSubmit={submitCommand}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </TaskCommandButton>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No tasks yet.</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TaskCommandButton({
  action,
  taskId,
  commandName,
  idempotencyPrefix,
  disabled,
  pendingCommand,
  onSubmit,
  children
}: {
  action: TaskFormAction;
  taskId: string;
  commandName: string;
  idempotencyPrefix: string;
  disabled?: boolean;
  pendingCommand: string | null;
  onSubmit: (form: HTMLFormElement, action: TaskFormAction, commandName: string, idempotencyPrefix: string) => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event.currentTarget, action, commandName, idempotencyPrefix);
      }}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <Button type="submit" variant="outline" size="sm" className="w-full gap-2" disabled={disabled || pendingCommand !== null}>
        {pendingCommand === commandName ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
        {pendingCommand === commandName ? "Updating…" : null}
      </Button>
    </form>
  );
}
