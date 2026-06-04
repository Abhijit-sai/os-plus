"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createWorkflowInstanceForOrderItem } from "@/features/production/instances";
import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { ItemStageInstance, ItemStatus, Json, OrderStatus } from "@/types/database";

export type FormActionState = {
  ok: boolean;
  message: string | null;
};

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const initializeWorkflowSchema = z.object({
  orderItemId: z.string().uuid()
});

const startStageSchema = z.object({
  stageInstanceId: z.string().uuid(),
  workerId: z.string().uuid(),
  notes: optionalText
});

const completeStageSchema = z.object({
  stageInstanceId: z.string().uuid(),
  notes: optionalText
});

const changeWorkflowSchema = z.object({
  orderItemId: z.string().uuid(),
  workflowId: z.string().uuid(),
  reason: z.string().trim().min(1, "Reason is required when changing workflow.")
});

const correctionStatusSchema = z.enum([
  "not_started",
  "ready_to_start",
  "in_progress",
  "paused",
  "completed",
  "skipped",
  "blocked"
]);

const stageCorrectionSchema = z
  .object({
    stageInstanceId: z.string().uuid(),
    status: correctionStatusSchema,
    workerId: optionalText,
    startedAt: optionalText,
    completedAt: optionalText,
    stageNotes: optionalText,
    correctionReason: z.string().trim().min(1, "Correction reason is required.")
  })
  .superRefine((value, context) => {
    if (["in_progress", "completed"].includes(value.status) && !value.startedAt) {
      context.addIssue({
        code: "custom",
        message: "Started time is required for an in-progress or completed stage.",
        path: ["startedAt"]
      });
    }

    if (value.status === "in_progress" && !value.workerId) {
      context.addIssue({
        code: "custom",
        message: "Worker is required for an in-progress stage.",
        path: ["workerId"]
      });
    }

    if (value.status === "completed" && !value.completedAt) {
      context.addIssue({
        code: "custom",
        message: "Completed time is required for a completed stage.",
        path: ["completedAt"]
      });
    }

    if (value.startedAt && value.completedAt && new Date(value.completedAt) < new Date(value.startedAt)) {
      context.addIssue({
        code: "custom",
        message: "Completed time cannot be before started time.",
        path: ["completedAt"]
      });
    }
  });

function getActionErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function getAuthorizedProductionContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "production:manage");
  return context;
}

function toIsoDateTime(value: string | null) {
  return value ? new Date(value).toISOString() : null;
}

function getDurationMinutes(startedAt: string | null, completedAt: string | null) {
  if (!startedAt || !completedAt) {
    return null;
  }

  return Math.max(Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000), 0);
}

function isDeliveryLabel(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "";
  return normalized.includes("deliver") || normalized.includes("handoff");
}

async function getCompletedWorkflowItemStatus(
  tenantId: string,
  stage: ItemStageInstance,
  fallbackStatus: ItemStatus = "completed"
): Promise<ItemStatus> {
  const supabase = createSupabaseServiceRoleClient();
  const [stageMaster, customerStatus] = await Promise.all([
    supabase
      .from("stage_master")
      .select("name")
      .eq("tenant_id", tenantId)
      .eq("id", stage.stage_master_id)
      .is("deleted_at", null)
      .maybeSingle(),
    stage.customer_status_id
      ? supabase
          .from("customer_statuses")
          .select("name")
          .eq("tenant_id", tenantId)
          .eq("id", stage.customer_status_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (stageMaster.error) {
    throw new Error(`Unable to resolve final stage: ${stageMaster.error.message}`);
  }

  if (customerStatus.error) {
    throw new Error(`Unable to resolve final customer status: ${customerStatus.error.message}`);
  }

  return isDeliveryLabel(stageMaster.data?.name) || isDeliveryLabel(customerStatus.data?.name) ? "delivered" : fallbackStatus;
}

async function syncOrderFulfillmentStatus(tenantId: string, orderItemId: string, actorId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const item = await supabase
    .from("order_items")
    .select("order_id")
    .eq("tenant_id", tenantId)
    .eq("id", orderItemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (item.error) {
    throw new Error(`Unable to load order item for order sync: ${item.error.message}`);
  }

  if (!item.data) {
    return;
  }

  const order = await supabase
    .from("orders")
    .select("id, tracking_token")
    .eq("tenant_id", tenantId)
    .eq("id", item.data.order_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (order.error) {
    throw new Error(`Unable to load order for fulfillment sync: ${order.error.message}`);
  }

  const items = await supabase
    .from("order_items")
    .select("item_status")
    .eq("tenant_id", tenantId)
    .eq("order_id", item.data.order_id)
    .is("deleted_at", null);

  if (items.error) {
    throw new Error(`Unable to load order items for order sync: ${items.error.message}`);
  }

  const itemStatuses = (items.data ?? []).map((row) => row.item_status);
  const nextOrderStatus: OrderStatus = itemStatuses.every((status) => status === "delivered")
    ? "delivered"
    : itemStatuses.some((status) => status === "delivered")
      ? "partially_delivered"
      : itemStatuses.some((status) => status !== "not_started")
        ? "in_progress"
        : "confirmed";
  const update = await supabase
    .from("orders")
    .update({
      order_status: nextOrderStatus,
      updated_by: actorId
    })
    .eq("tenant_id", tenantId)
    .eq("id", item.data.order_id)
    .neq("order_status", "cancelled");

  if (update.error) {
    throw new Error(`Unable to sync order fulfillment status: ${update.error.message}`);
  }

  revalidatePath(`/orders/${item.data.order_id}`);
  if (order.data?.tracking_token) {
    revalidatePath(`/track/${order.data.tracking_token}`);
  }
}

export async function initializeItemWorkflowAction(formData: FormData) {
  const context = await getAuthorizedProductionContext();
  const parsed = initializeWorkflowSchema.parse({
    orderItemId: formData.get("orderItemId")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { data: item, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderItemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load item: ${error.message}`);
  }

  if (!item) {
    throw new Error("Order item does not belong to this tenant.");
  }

  await createWorkflowInstanceForOrderItem(item, context.membership.clerk_user_id);
  revalidatePath("/production");
  revalidatePath(`/production/items/${item.id}/workflow`);
}

export async function changeItemWorkflowAction(formData: FormData) {
  const context = await getAuthorizedProductionContext();
  const parsed = changeWorkflowSchema.parse({
    orderItemId: formData.get("orderItemId"),
    workflowId: formData.get("workflowId"),
    reason: formData.get("reason")
  });
  const supabase = createSupabaseServiceRoleClient();
  const [item, newWorkflow, activeWorkflowInstance] = await Promise.all([
    supabase
      .from("order_items")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.orderItemId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("workflows")
      .select("id, name")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.workflowId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("item_workflow_instances")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("order_item_id", parsed.orderItemId)
      .is("deleted_at", null)
      .maybeSingle()
  ]);

  if (item.error) {
    throw new Error(`Unable to load order item: ${item.error.message}`);
  }

  if (!item.data) {
    throw new Error("Order item does not belong to this tenant.");
  }

  if (newWorkflow.error) {
    throw new Error(`Unable to load workflow: ${newWorkflow.error.message}`);
  }

  if (!newWorkflow.data) {
    throw new Error("Selected workflow does not belong to this tenant or is inactive.");
  }

  if (item.data.workflow_id === parsed.workflowId) {
    throw new Error("Selected workflow is already assigned to this item.");
  }

  if (activeWorkflowInstance.error) {
    throw new Error(`Unable to load active workflow instance: ${activeWorkflowInstance.error.message}`);
  }

  const now = new Date().toISOString();
  const oldWorkflowId = item.data.workflow_id;
  let hadStartedWork = false;

  if (activeWorkflowInstance.data) {
    const [stageInstances, activeLogs] = await Promise.all([
      supabase
        .from("item_stage_instances")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("workflow_instance_id", activeWorkflowInstance.data.id)
        .is("deleted_at", null),
      supabase
        .from("item_stage_work_logs")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .is("deleted_at", null)
    ]);

    if (stageInstances.error) {
      throw new Error(`Unable to load existing stage instances: ${stageInstances.error.message}`);
    }

    if (activeLogs.error) {
      throw new Error(`Unable to load existing work logs: ${activeLogs.error.message}`);
    }

    hadStartedWork =
      activeWorkflowInstance.data.status !== "not_started" ||
      (stageInstances.data ?? []).some((stage) => Boolean(stage.started_at) || !["not_started", "ready_to_start"].includes(stage.status)) ||
      Boolean(activeLogs.data?.length);

    const [cancelLogs, closeStages, closeWorkflow] = await Promise.all([
      supabase
        .from("item_stage_work_logs")
        .update({
          status: "cancelled",
          notes: parsed.reason
        })
        .eq("tenant_id", context.tenant.id)
        .eq("order_item_id", item.data.id)
        .eq("status", "in_progress")
        .is("deleted_at", null),
      supabase
        .from("item_stage_instances")
        .update({
          deleted_at: now,
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("workflow_instance_id", activeWorkflowInstance.data.id)
        .is("deleted_at", null),
      supabase
        .from("item_workflow_instances")
        .update({
          status: "cancelled",
          current_stage_instance_id: null,
          deleted_at: now,
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", activeWorkflowInstance.data.id)
    ]);

    for (const result of [cancelLogs, closeStages, closeWorkflow]) {
      if (result.error) {
        throw new Error(`Unable to close previous workflow: ${result.error.message}`);
      }
    }
  }

  const itemUpdate = await supabase
    .from("order_items")
    .update({
      workflow_id: parsed.workflowId,
      item_status: "not_started",
      customer_status_id: null,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", item.data.id);

  if (itemUpdate.error) {
    throw new Error(`Unable to update item workflow: ${itemUpdate.error.message}`);
  }

  await createWorkflowInstanceForOrderItem(
    {
      id: item.data.id,
      tenant_id: context.tenant.id,
      workflow_id: parsed.workflowId
    },
    context.membership.clerk_user_id
  );

  const history = await supabase.from("item_history").insert({
    tenant_id: context.tenant.id,
    order_item_id: item.data.id,
    event_type: "workflow_changed",
    old_value_json: {
      workflow_id: oldWorkflowId,
      workflow_instance_id: activeWorkflowInstance.data?.id ?? null
    } as Json,
    new_value_json: {
      workflow_id: parsed.workflowId,
      had_started_work: hadStartedWork
    } as Json,
    notes: parsed.reason,
    created_by: context.membership.clerk_user_id
  });

  if (history.error) {
    throw new Error(`Unable to write workflow change history: ${history.error.message}`);
  }

  await syncOrderFulfillmentStatus(context.tenant.id, item.data.id, context.membership.clerk_user_id);

  revalidatePath("/production");
  revalidatePath("/orders");
  revalidatePath(`/orders/${item.data.order_id}`);
  revalidatePath(`/production/items/${item.data.id}/workflow`);
}

export async function changeItemWorkflowFormAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    await changeItemWorkflowAction(formData);
    return { ok: true, message: null };
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error)
    };
  }
}

export async function startStageAction(formData: FormData) {
  const context = await getAuthorizedProductionContext();
  const parsed = startStageSchema.parse({
    stageInstanceId: formData.get("stageInstanceId"),
    workerId: formData.get("workerId"),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const [stageInstance, worker] = await Promise.all([
    supabase
      .from("item_stage_instances")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.stageInstanceId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("workers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.workerId)
      .eq("status", "active")
      .is("deleted_at", null)
      .maybeSingle()
  ]);

  if (stageInstance.error) {
    throw new Error(`Unable to load stage: ${stageInstance.error.message}`);
  }

  if (!stageInstance.data) {
    throw new Error("Stage instance does not belong to this tenant.");
  }

  if (stageInstance.data.status !== "ready_to_start") {
    throw new Error("Only a ready stage can be started.");
  }

  if (worker.error) {
    throw new Error(`Unable to load worker: ${worker.error.message}`);
  }

  if (!worker.data) {
    throw new Error("Worker does not belong to this tenant or is inactive.");
  }

  const [allowedWorkgroups, workerWorkgroups] = await Promise.all([
    supabase
      .from("stage_workgroups")
      .select("workgroup_id")
      .eq("tenant_id", context.tenant.id)
      .eq("stage_master_id", stageInstance.data.stage_master_id),
    supabase
      .from("worker_workgroups")
      .select("workgroup_id")
      .eq("tenant_id", context.tenant.id)
      .eq("worker_id", parsed.workerId)
  ]);

  if (allowedWorkgroups.error) {
    throw new Error(`Unable to validate allowed workgroups: ${allowedWorkgroups.error.message}`);
  }

  if (workerWorkgroups.error) {
    throw new Error(`Unable to validate worker workgroups: ${workerWorkgroups.error.message}`);
  }

  const allowedIds = new Set((allowedWorkgroups.data ?? []).map((mapping) => mapping.workgroup_id));
  const workerIds = (workerWorkgroups.data ?? []).map((mapping) => mapping.workgroup_id);
  const matchingWorkgroupId = workerIds.find((workgroupId) => allowedIds.has(workgroupId));

  if (!allowedIds.size) {
    throw new Error("This stage has no allowed workgroups configured.");
  }

  if (!matchingWorkgroupId) {
    throw new Error("Selected worker is not mapped to an allowed workgroup for this stage.");
  }

  const now = new Date().toISOString();
  const [stageUpdate, workflowUpdate, itemUpdate, workLog, history] = await Promise.all([
    supabase
      .from("item_stage_instances")
      .update({
        status: "in_progress",
        started_at: now,
        notes: parsed.notes,
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", stageInstance.data.id),
    supabase
      .from("item_workflow_instances")
      .update({
        status: "in_progress",
        started_at: now,
        current_stage_instance_id: stageInstance.data.id,
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", stageInstance.data.workflow_instance_id),
    supabase
      .from("order_items")
      .update({
        item_status: "in_production",
        customer_status_id: stageInstance.data.customer_status_id,
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", stageInstance.data.order_item_id),
    supabase.from("item_stage_work_logs").insert({
      tenant_id: context.tenant.id,
      stage_instance_id: stageInstance.data.id,
      order_item_id: stageInstance.data.order_item_id,
      worker_id: parsed.workerId,
      workgroup_id: matchingWorkgroupId,
      started_at: now,
      status: "in_progress",
      notes: parsed.notes,
      created_by: context.membership.clerk_user_id
    }),
    supabase.from("item_history").insert({
      tenant_id: context.tenant.id,
      order_item_id: stageInstance.data.order_item_id,
      event_type: "stage_started",
      new_value_json: {
        stage_instance_id: stageInstance.data.id,
        worker_id: parsed.workerId
      } as Json,
      notes: parsed.notes,
      created_by: context.membership.clerk_user_id
    })
  ]);

  for (const result of [stageUpdate, workflowUpdate, itemUpdate, workLog, history]) {
    if (result.error) {
      throw new Error(`Unable to start stage: ${result.error.message}`);
    }
  }

  await syncOrderFulfillmentStatus(context.tenant.id, stageInstance.data.order_item_id, context.membership.clerk_user_id);

  revalidatePath("/production");
  revalidatePath("/orders");
  revalidatePath(`/production/items/${stageInstance.data.order_item_id}/workflow`);
}

export async function completeStageAction(formData: FormData) {
  const context = await getAuthorizedProductionContext();
  const parsed = completeStageSchema.parse({
    stageInstanceId: formData.get("stageInstanceId"),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const stageInstance = await supabase
    .from("item_stage_instances")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.stageInstanceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (stageInstance.error) {
    throw new Error(`Unable to load stage: ${stageInstance.error.message}`);
  }

  if (!stageInstance.data) {
    throw new Error("Stage instance does not belong to this tenant.");
  }

  if (stageInstance.data.status !== "in_progress") {
    throw new Error("Only an in-progress stage can be completed.");
  }

  const currentStage = stageInstance.data;
  const [activeLogs, allStages] = await Promise.all([
    supabase
      .from("item_stage_work_logs")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("stage_instance_id", currentStage.id)
      .eq("status", "in_progress")
      .is("deleted_at", null),
    supabase
      .from("item_stage_instances")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("workflow_instance_id", currentStage.workflow_instance_id)
      .is("deleted_at", null)
      .order("sequence_number")
  ]);

  if (activeLogs.error) {
    throw new Error(`Unable to load active work logs: ${activeLogs.error.message}`);
  }

  if (allStages.error) {
    throw new Error(`Unable to load workflow stages: ${allStages.error.message}`);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const nextStage = (allStages.data ?? []).find((stage) => stage.sequence_number > currentStage.sequence_number);

  for (const log of activeLogs.data ?? []) {
    const startedAt = new Date(log.started_at);
    const durationMinutes = Math.max(Math.round((now.getTime() - startedAt.getTime()) / 60000), 0);
    const logUpdate = await supabase
      .from("item_stage_work_logs")
      .update({
        status: "completed",
        completed_at: nowIso,
        duration_minutes: durationMinutes
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", log.id);

    if (logUpdate.error) {
      throw new Error(`Unable to complete work log: ${logUpdate.error.message}`);
    }
  }

  const stageUpdate = await supabase
    .from("item_stage_instances")
    .update({
      status: "completed",
      completed_at: nowIso,
      notes: parsed.notes ?? currentStage.notes,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", currentStage.id);

  if (stageUpdate.error) {
    throw new Error(`Unable to complete stage: ${stageUpdate.error.message}`);
  }

  if (nextStage) {
    const [nextStageUpdate, workflowUpdate, itemUpdate] = await Promise.all([
      supabase
        .from("item_stage_instances")
        .update({
          status: "ready_to_start",
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", nextStage.id),
      supabase
        .from("item_workflow_instances")
        .update({
          current_stage_instance_id: nextStage.id,
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", currentStage.workflow_instance_id),
      supabase
        .from("order_items")
        .update({
          customer_status_id: nextStage.customer_status_id,
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", currentStage.order_item_id)
    ]);

    for (const result of [nextStageUpdate, workflowUpdate, itemUpdate]) {
      if (result.error) {
        throw new Error(`Unable to move to next stage: ${result.error.message}`);
      }
    }
  } else {
    const completedItemStatus = await getCompletedWorkflowItemStatus(context.tenant.id, currentStage);
    const [workflowUpdate, itemUpdate] = await Promise.all([
      supabase
        .from("item_workflow_instances")
        .update({
          status: "completed",
          completed_at: nowIso,
          current_stage_instance_id: null,
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", currentStage.workflow_instance_id),
      supabase
        .from("order_items")
        .update({
          item_status: completedItemStatus,
          customer_status_id: stageInstance.data.customer_status_id,
          updated_by: context.membership.clerk_user_id
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", currentStage.order_item_id)
    ]);

    for (const result of [workflowUpdate, itemUpdate]) {
      if (result.error) {
        throw new Error(`Unable to complete workflow: ${result.error.message}`);
      }
    }
  }

  const history = await supabase.from("item_history").insert({
    tenant_id: context.tenant.id,
    order_item_id: currentStage.order_item_id,
    event_type: "stage_completed",
    new_value_json: {
      stage_instance_id: currentStage.id,
      next_stage_instance_id: nextStage?.id ?? null
    } as Json,
    notes: parsed.notes,
    created_by: context.membership.clerk_user_id
  });

  if (history.error) {
    throw new Error(`Unable to write item history: ${history.error.message}`);
  }

  await syncOrderFulfillmentStatus(context.tenant.id, currentStage.order_item_id, context.membership.clerk_user_id);

  revalidatePath("/production");
  revalidatePath("/orders");
  revalidatePath(`/production/items/${currentStage.order_item_id}/workflow`);
}

export async function correctStageAction(formData: FormData) {
  const context = await getAuthorizedProductionContext();
  const parsed = stageCorrectionSchema.parse({
    stageInstanceId: formData.get("stageInstanceId"),
    status: formData.get("status"),
    workerId: formData.get("workerId"),
    startedAt: formData.get("startedAt"),
    completedAt: formData.get("completedAt"),
    stageNotes: formData.get("stageNotes"),
    correctionReason: formData.get("correctionReason")
  });
  const supabase = createSupabaseServiceRoleClient();
  const stageInstance = await supabase
    .from("item_stage_instances")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.stageInstanceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (stageInstance.error) {
    throw new Error(`Unable to load stage: ${stageInstance.error.message}`);
  }

  if (!stageInstance.data) {
    throw new Error("Stage instance does not belong to this tenant.");
  }

  const currentStage = stageInstance.data;
  let matchingWorkgroupId: string | null = null;

  if (parsed.workerId) {
    const [worker, allowedWorkgroups, workerWorkgroups] = await Promise.all([
      supabase
        .from("workers")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("id", parsed.workerId)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("stage_workgroups")
        .select("workgroup_id")
        .eq("tenant_id", context.tenant.id)
        .eq("stage_master_id", currentStage.stage_master_id),
      supabase
        .from("worker_workgroups")
        .select("workgroup_id")
        .eq("tenant_id", context.tenant.id)
        .eq("worker_id", parsed.workerId)
    ]);

    if (worker.error) {
      throw new Error(`Unable to load worker: ${worker.error.message}`);
    }

    if (!worker.data) {
      throw new Error("Worker does not belong to this tenant or is inactive.");
    }

    if (allowedWorkgroups.error) {
      throw new Error(`Unable to validate allowed workgroups: ${allowedWorkgroups.error.message}`);
    }

    if (workerWorkgroups.error) {
      throw new Error(`Unable to validate worker workgroups: ${workerWorkgroups.error.message}`);
    }

    const allowedIds = new Set((allowedWorkgroups.data ?? []).map((mapping) => mapping.workgroup_id));
    const workerIds = (workerWorkgroups.data ?? []).map((mapping) => mapping.workgroup_id);
    matchingWorkgroupId = workerIds.find((workgroupId) => allowedIds.has(workgroupId)) ?? null;

    if (!allowedIds.size) {
      throw new Error("This stage has no allowed workgroups configured.");
    }

    if (!matchingWorkgroupId) {
      throw new Error("Selected worker is not mapped to an allowed workgroup for this stage.");
    }
  }

  const startedAt = toIsoDateTime(parsed.startedAt);
  const completedAt = toIsoDateTime(parsed.completedAt);
  const stageUpdate = await supabase
    .from("item_stage_instances")
    .update({
      status: parsed.status,
      started_at: ["in_progress", "paused", "completed"].includes(parsed.status) ? startedAt : null,
      completed_at: parsed.status === "completed" ? completedAt : null,
      notes: parsed.stageNotes,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", currentStage.id);

  if (stageUpdate.error) {
    throw new Error(`Unable to correct stage: ${stageUpdate.error.message}`);
  }

  const activeLogs = await supabase
    .from("item_stage_work_logs")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("stage_instance_id", currentStage.id)
    .eq("status", "in_progress")
    .is("deleted_at", null);

  if (activeLogs.error) {
    throw new Error(`Unable to load active work logs: ${activeLogs.error.message}`);
  }

  const activeLog = activeLogs.data?.[0] ?? null;
  const durationMinutes = getDurationMinutes(startedAt, completedAt);

  if (parsed.status === "in_progress" && parsed.workerId && matchingWorkgroupId && startedAt) {
    const logResult = activeLog
      ? await supabase
          .from("item_stage_work_logs")
          .update({
            worker_id: parsed.workerId,
            workgroup_id: matchingWorkgroupId,
            started_at: startedAt,
            completed_at: null,
            duration_minutes: null,
            notes: parsed.stageNotes
          })
          .eq("tenant_id", context.tenant.id)
          .eq("id", activeLog.id)
      : await supabase.from("item_stage_work_logs").insert({
          tenant_id: context.tenant.id,
          stage_instance_id: currentStage.id,
          order_item_id: currentStage.order_item_id,
          worker_id: parsed.workerId,
          workgroup_id: matchingWorkgroupId,
          started_at: startedAt,
          status: "in_progress",
          notes: parsed.stageNotes,
          created_by: context.membership.clerk_user_id
        });

    if (logResult.error) {
      throw new Error(`Unable to correct work log: ${logResult.error.message}`);
    }
  }

  if (parsed.status === "completed") {
    if (activeLog) {
      const logUpdate = await supabase
        .from("item_stage_work_logs")
        .update({
          status: "completed",
          completed_at: completedAt,
          duration_minutes: durationMinutes,
          notes: parsed.stageNotes ?? activeLog.notes
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", activeLog.id);

      if (logUpdate.error) {
        throw new Error(`Unable to complete corrected work log: ${logUpdate.error.message}`);
      }
    } else if (parsed.workerId && matchingWorkgroupId && startedAt && completedAt) {
      const logInsert = await supabase.from("item_stage_work_logs").insert({
        tenant_id: context.tenant.id,
        stage_instance_id: currentStage.id,
        order_item_id: currentStage.order_item_id,
        worker_id: parsed.workerId,
        workgroup_id: matchingWorkgroupId,
        started_at: startedAt,
        completed_at: completedAt,
        duration_minutes: durationMinutes,
        status: "completed",
        notes: parsed.stageNotes,
        created_by: context.membership.clerk_user_id
      });

      if (logInsert.error) {
        throw new Error(`Unable to insert corrected work log: ${logInsert.error.message}`);
      }
    }
  }

  if (!["in_progress", "completed"].includes(parsed.status)) {
    for (const log of activeLogs.data ?? []) {
      const logUpdate = await supabase
        .from("item_stage_work_logs")
        .update({
          status: parsed.status === "paused" ? "paused" : "cancelled",
          notes: parsed.stageNotes ?? log.notes
        })
        .eq("tenant_id", context.tenant.id)
        .eq("id", log.id);

      if (logUpdate.error) {
        throw new Error(`Unable to close active work log: ${logUpdate.error.message}`);
      }
    }
  }

  const allStages = await supabase
    .from("item_stage_instances")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("workflow_instance_id", currentStage.workflow_instance_id)
    .is("deleted_at", null)
    .order("sequence_number");

  if (allStages.error) {
    throw new Error(`Unable to reload workflow stages: ${allStages.error.message}`);
  }

  const stages = allStages.data ?? [];
  const nextStageAfterCorrected = stages.find((stage) => stage.sequence_number > currentStage.sequence_number && stage.status === "not_started");

  if (["completed", "skipped"].includes(parsed.status) && nextStageAfterCorrected) {
    const nextStageUpdate = await supabase
      .from("item_stage_instances")
      .update({
        status: "ready_to_start",
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", nextStageAfterCorrected.id);

    if (nextStageUpdate.error) {
      throw new Error(`Unable to move corrected workflow forward: ${nextStageUpdate.error.message}`);
    }

    nextStageAfterCorrected.status = "ready_to_start";
  }

  const currentWorkflowStage =
    stages.find((stage) => ["in_progress", "paused", "blocked"].includes(stage.status)) ??
    stages.find((stage) => stage.status === "ready_to_start") ??
    null;
  const workflowCompleted = stages.length > 0 && stages.every((stage) => ["completed", "skipped"].includes(stage.status));
  const workflowStatus = workflowCompleted ? "completed" : currentWorkflowStage ? "in_progress" : "not_started";
  const correctedItemStatus = workflowCompleted
    ? await getCompletedWorkflowItemStatus(context.tenant.id, stages.at(-1) ?? currentStage)
    : workflowStatus === "in_progress"
      ? "in_production"
      : "not_started";
  const [workflowUpdate, itemUpdate, history] = await Promise.all([
    supabase
      .from("item_workflow_instances")
      .update({
        status: workflowStatus,
        current_stage_instance_id: workflowCompleted ? null : currentWorkflowStage?.id ?? null,
        completed_at: workflowCompleted ? completedAt ?? new Date().toISOString() : null,
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", currentStage.workflow_instance_id),
    supabase
      .from("order_items")
      .update({
        item_status: correctedItemStatus,
        customer_status_id: currentWorkflowStage?.customer_status_id ?? currentStage.customer_status_id,
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", currentStage.order_item_id),
    supabase.from("item_history").insert({
      tenant_id: context.tenant.id,
      order_item_id: currentStage.order_item_id,
      event_type: "stage_corrected",
      old_value_json: {
        stage_instance_id: currentStage.id,
        status: currentStage.status,
        started_at: currentStage.started_at,
        completed_at: currentStage.completed_at,
        notes: currentStage.notes,
        active_worker_id: activeLog?.worker_id ?? null
      } as Json,
      new_value_json: {
        stage_instance_id: currentStage.id,
        status: parsed.status,
        worker_id: parsed.workerId,
        started_at: startedAt,
        completed_at: completedAt,
        notes: parsed.stageNotes,
        correction_reason: parsed.correctionReason
      } as Json,
      notes: parsed.correctionReason,
      created_by: context.membership.clerk_user_id
    })
  ]);

  for (const result of [workflowUpdate, itemUpdate, history]) {
    if (result.error) {
      throw new Error(`Unable to finalize stage correction: ${result.error.message}`);
    }
  }

  await syncOrderFulfillmentStatus(context.tenant.id, currentStage.order_item_id, context.membership.clerk_user_id);

  revalidatePath("/production");
  revalidatePath("/orders");
  revalidatePath(`/production/items/${currentStage.order_item_id}/workflow`);
}

export async function correctStageFormAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    await correctStageAction(formData);
    return { ok: true, message: null };
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error)
    };
  }
}
