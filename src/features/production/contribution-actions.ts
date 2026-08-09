"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { stageContributionDatabaseErrorMessage } from "@/features/production/contributions";
import type { Json } from "@/types/database";

export type StageContributionActionState = {
  ok: boolean;
  message: string | null;
};

const initialState: StageContributionActionState = { ok: false, message: null };

const assignmentSchema = z.object({
  worker_id: z.string().uuid(),
  workgroup_id: z.string().uuid(),
  credited_units: z.number().min(0).max(100000).refine((value) => Number.isInteger(value * 10), "Units must use 0.10 increments."),
  credited_minutes: z.number().int().min(0).max(10_000_000).refine((value) => value % 10 === 0, "Time must use 10-minute increments."),
});

const contributionFormSchema = z.object({
  stageInstanceId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  assignments: z.array(assignmentSchema).min(1, "Add at least one worker.").max(100),
  notes: z.string().trim().max(2000).nullable(),
  correctionReason: z.string().trim().max(2000).nullable(),
  expectedRevision: z.coerce.number().int().min(0),
});

function optionalFormText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseContributionForm(formData: FormData) {
  let assignments: unknown;
  try {
    assignments = JSON.parse(String(formData.get("assignments") ?? "[]"));
  } catch {
    throw new Error("Worker contribution data is invalid. Review the rows and try again.");
  }

  return contributionFormSchema.parse({
    stageInstanceId: formData.get("stageInstanceId"),
    idempotencyKey: formData.get("idempotencyKey"),
    assignments,
    notes: optionalFormText(formData.get("notes")),
    correctionReason: optionalFormText(formData.get("correctionReason")),
    expectedRevision: formData.get("expectedRevision"),
  });
}

function actionErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map((issue) => issue.message).join(" ");
  return stageContributionDatabaseErrorMessage(error)
    ?? "Unable to save stage contributions. Nothing was changed; review the data and try again.";
}

async function revalidateContributionSurfaces(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  tenantId: string,
  resultData: Json,
) {
  revalidatePath("/production");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  if (!resultData || typeof resultData !== "object" || Array.isArray(resultData)) return;
  const itemId = resultData.order_item_id;
  if (typeof itemId !== "string") return;
  revalidatePath(`/production/items/${itemId}/workflow`);
  const order = await supabase
    .from("order_items")
    .select("order_id")
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .is("deleted_at", null)
    .maybeSingle();
  if (order.data?.order_id) revalidatePath(`/orders/${order.data.order_id}`);
}

type Operation = "start" | "replace" | "complete";

async function runContributionOperation(operation: Operation, formData: FormData): Promise<StageContributionActionState> {
  try {
    const context = await requireTenantContext();
    assertPermission(context.membership.role, "production:manage");
    const parsed = parseContributionForm(formData);
    const supabase = createSupabaseServiceRoleClient();
    const assignments = parsed.assignments as Json;

    if (operation === "replace" && context.membership.role !== "owner_admin") {
      const stage = await supabase
        .from("item_stage_instances")
        .select("status")
        .eq("tenant_id", context.tenant.id)
        .eq("id", parsed.stageInstanceId)
        .is("deleted_at", null)
        .maybeSingle();
      if (stage.error) throw stage.error;
      if (!stage.data) throw new Error("STAGE_NOT_FOUND");
      if (stage.data.status === "completed") throw new Error("COMPLETED_CONTRIBUTION_CORRECTION_NOT_ALLOWED");
    }

    const result = operation === "start"
      ? await supabase.rpc("start_item_stage_with_contributions", {
          p_tenant_id: context.tenant.id,
          p_stage_instance_id: parsed.stageInstanceId,
          p_assignments: assignments,
          p_notes: parsed.notes,
          p_actor_id: context.membership.clerk_user_id,
          p_idempotency_key: parsed.idempotencyKey,
        })
      : operation === "complete"
        ? await supabase.rpc("complete_item_stage_with_contributions", {
            p_tenant_id: context.tenant.id,
            p_stage_instance_id: parsed.stageInstanceId,
            p_assignments: assignments,
            p_notes: parsed.notes,
            p_correction_reason: parsed.correctionReason,
            p_actor_id: context.membership.clerk_user_id,
            p_expected_revision: parsed.expectedRevision,
            p_idempotency_key: parsed.idempotencyKey,
          })
        : await supabase.rpc("replace_item_stage_contributions", {
            p_tenant_id: context.tenant.id,
            p_stage_instance_id: parsed.stageInstanceId,
            p_assignments: assignments,
            p_correction_reason: parsed.correctionReason,
            p_actor_id: context.membership.clerk_user_id,
            p_allow_completed: context.membership.role === "owner_admin",
            p_expected_revision: parsed.expectedRevision,
            p_idempotency_key: parsed.idempotencyKey,
          });

    if (result.error) throw result.error;
    await revalidateContributionSurfaces(supabase, context.tenant.id, result.data);
    return { ok: true, message: operation === "start" ? "Stage started." : operation === "complete" ? "Stage completed." : "Contributions saved." };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error) };
  }
}

export async function startStageWithContributionsAction(
  _previousState: StageContributionActionState = initialState,
  formData: FormData,
) {
  return runContributionOperation("start", formData);
}

export async function replaceStageContributionsAction(
  _previousState: StageContributionActionState = initialState,
  formData: FormData,
) {
  return runContributionOperation("replace", formData);
}

export async function completeStageWithContributionsAction(
  _previousState: StageContributionActionState = initialState,
  formData: FormData,
) {
  return runContributionOperation("complete", formData);
}

export async function stageContributionAction(
  _previousState: StageContributionActionState = initialState,
  formData: FormData,
) {
  const parsedOperation = z.enum(["start", "replace", "complete"]).safeParse(formData.get("operation"));
  if (!parsedOperation.success) return { ok: false, message: "Choose a valid stage action and try again." };
  return runContributionOperation(parsedOperation.data, formData);
}
