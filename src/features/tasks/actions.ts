"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createUserCommandContext } from "@/core/command-context/server";
import { normalizeIdempotencyKey } from "@/core/idempotency/types";
import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { assertTenantVertical } from "@/features/verticals/queries";
import type { Json, TaskPriority, TaskSubjectType, TaskType } from "@/types/database";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
);

const taskTypeSchema = z.enum([
  "PICKUP",
  "VERIFY_INTAKE",
  "RECEIVE_MANIFEST",
  "INVESTIGATE_VARIANCE",
  "PROCESS_WORK_UNIT",
  "DELIVERY",
  "COLLECT_PAYMENT",
  "RECONCILE_PAYMENT",
  "GENERAL"
]);

const taskPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const taskSubjectTypeSchema = z.enum([
  "pickup_request",
  "handling_unit",
  "manifest",
  "work_unit",
  "order",
  "invoice",
  "payment",
  "delivery",
  "collection_batch",
  "general"
]);

const createTaskSchema = z.object({
  taskType: taskTypeSchema.default("GENERAL"),
  title: z.string().trim().min(2, "Task title is required."),
  description: optionalText,
  subjectType: taskSubjectTypeSchema.default("general"),
  subjectId: optionalText,
  assignedUserId: optionalText,
  assignedTeamId: optionalText,
  priority: taskPrioritySchema.default("NORMAL"),
  dueAt: optionalText,
  idempotencyKey: optionalText
});

const taskIdSchema = z.object({
  taskId: z.string().uuid(),
  notes: optionalText,
  idempotencyKey: optionalText
});

const assignTaskSchema = taskIdSchema.extend({
  assignedUserId: optionalText,
  assignedTeamId: optionalText
});

function parseCommandResult(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Command returned an invalid result.");
  }

  return value;
}

async function getAuthorizedTaskContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "tasks:manage");
  await assertTenantVertical(context, "laundry");
  return context;
}

function toIsoDateTime(value: string | null) {
  return value ? new Date(value).toISOString() : null;
}

export async function createTaskAction(formData: FormData) {
  const context = await getAuthorizedTaskContext();
  const parsed = createTaskSchema.parse({
    taskType: formData.get("taskType") || "GENERAL",
    title: formData.get("title"),
    description: formData.get("description"),
    subjectType: formData.get("subjectType") || "general",
    subjectId: formData.get("subjectId"),
    assignedUserId: formData.get("assignedUserId"),
    assignedTeamId: formData.get("assignedTeamId"),
    priority: formData.get("priority") || "NORMAL",
    dueAt: formData.get("dueAt"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc("create_task_command", {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_task_type: parsed.taskType as TaskType,
    p_title: parsed.title,
    p_description: parsed.description,
    p_subject_type: parsed.subjectType as TaskSubjectType,
    p_subject_id: parsed.subjectId ?? crypto.randomUUID(),
    p_assigned_user_id: parsed.assignedUserId,
    p_assigned_team_id: parsed.assignedTeamId,
    p_priority: parsed.priority as TaskPriority,
    p_due_at: toIsoDateTime(parsed.dueAt),
    p_source_event_id: null
  });

  if (result.error) {
    throw new Error(`Unable to create task: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/tasks");
}

export async function assignTaskAction(formData: FormData) {
  const context = await getAuthorizedTaskContext();
  const parsed = assignTaskSchema.parse({
    taskId: formData.get("taskId"),
    assignedUserId: formData.get("assignedUserId"),
    assignedTeamId: formData.get("assignedTeamId"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc("assign_task_command", {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_task_id: parsed.taskId,
    p_assigned_user_id: parsed.assignedUserId,
    p_assigned_team_id: parsed.assignedTeamId,
    p_notes: parsed.notes
  });

  if (result.error) {
    throw new Error(`Unable to assign task: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/tasks");
}

export async function startTaskAction(formData: FormData) {
  await runSimpleTaskCommand("start_task_command", "Unable to start task", formData);
}

export async function completeTaskAction(formData: FormData) {
  await runSimpleTaskCommand("complete_task_command", "Unable to complete task", formData);
}

export async function cancelTaskAction(formData: FormData) {
  await runSimpleTaskCommand("cancel_task_command", "Unable to cancel task", formData);
}

async function runSimpleTaskCommand(
  commandName: "start_task_command" | "complete_task_command" | "cancel_task_command",
  errorMessage: string,
  formData: FormData
) {
  const context = await getAuthorizedTaskContext();
  const parsed = taskIdSchema.parse({
    taskId: formData.get("taskId"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc(commandName, {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_task_id: parsed.taskId,
    p_notes: parsed.notes
  });

  if (result.error) {
    throw new Error(`${errorMessage}: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/tasks");
}
