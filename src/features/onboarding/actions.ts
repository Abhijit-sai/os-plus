"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireBoutiqueOwner } from "@/features/onboarding/access";
import {
  businessTypes,
  openingDays,
  setupSteps,
} from "@/features/onboarding/model";
import {
  createItemTypeAction,
  createWorkgroupAction,
} from "@/features/settings/actions";
import { settingsDialogFailure } from "@/features/settings/dialog-feedback";
import { createWorkerAction } from "@/features/workers/actions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type SetupResult = { ok: boolean; message: string };

const name = z
  .string()
  .trim()
  .min(2, "Enter a name with at least two characters.")
  .max(65);
const uuid = z.string().uuid();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hours = z
  .object({
    days: z.array(z.enum(openingDays)).min(1).max(7),
    opens: clock,
    closes: clock,
  })
  .refine(
    (value) => value.opens < value.closes,
    "Choose a closing time after opening.",
  );
const profile = z.object({
  storeName: name,
  businessType: z.enum(businessTypes),
  description: z.string().trim().max(300),
  hours: hours.nullable(),
});

export async function saveSetupProgress(formData: FormData) {
  const context = await requireBoutiqueOwner(
    String(formData.get("tenantId") || "missing"),
  );
  const step = setupSteps.find((entry) => entry.id === formData.get("step"));
  if (!step) throw new Error("Choose an onboarding step.");
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("boutique_onboarding").upsert(
    {
      tenant_id: context.tenant.id,
      last_step: step.id,
      updated_by: context.membership.clerk_user_id,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw new Error("Unable to save your place. Try again.");
  revalidatePath("/onboarding");
  redirect(
    formData.get("exit") === "yes"
      ? "/onboarding?step=overview"
      : `/onboarding?step=${step.id}`,
  );
}

export async function saveSetupProfile(
  tenantId: string,
  _previous: SetupResult,
  formData: FormData,
): Promise<SetupResult> {
  const context = await requireBoutiqueOwner(tenantId || "missing");
  try {
    const { storeName, ...details } = profile.parse({
      storeName: formData.get("storeName"),
      businessType: formData.get("businessType"),
      description: formData.get("description"),
      hours: formData.has("setHours")
        ? {
            days: formData.getAll("days"),
            opens: formData.get("opens"),
            closes: formData.get("closes"),
          }
        : null,
    });
    const { error } = await createSupabaseServiceRoleClient().rpc(
      "save_boutique_onboarding_profile",
      {
        p_tenant_id: context.tenant.id,
        p_store_name: storeName,
        p_profile: details,
        p_actor_id: context.membership.clerk_user_id,
      },
    );
    if (error) throw new Error("Unable to save boutique details. Try again.");
  } catch (error) {
    return settingsDialogFailure(error);
  }
  revalidatePath("/onboarding");
  redirect("/onboarding?step=garments");
}

export async function addSetupRecord(
  tenantId: string,
  kind: "garment" | "workgroup" | "worker",
  _previous: SetupResult,
  formData: FormData,
): Promise<SetupResult> {
  const context = await requireBoutiqueOwner(tenantId || "missing");
  try {
    name.parse(formData.get("name"));
    let result;
    if (kind === "garment") {
      formData.set("description", "");
      result = await createItemTypeAction(formData);
    } else if (kind === "workgroup") {
      formData.set("description", "");
      result = await createWorkgroupAction(formData);
    } else if (kind === "worker") {
      const ids = z
        .array(uuid)
        .min(1, "Choose at least one workgroup.")
        .max(50)
        .parse(formData.getAll("workgroupIds"));
      const groups = [...new Set(ids)];
      const { data, error } = await createSupabaseServiceRoleClient()
        .from("workgroups")
        .select("id")
        .eq("tenant_id", context.tenant.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .in("id", groups);
      if (error || data.length !== groups.length)
        throw new Error("Choose an active workgroup in this boutique.");
      for (const field of [
        "phone",
        "joiningDate",
        "primaryWorkgroupId",
        "notes",
      ])
        formData.set(field, "");
      formData.set("wageType", "monthly");
      formData.set("wageAmount", "0");
      await createWorkerAction(formData);
    } else {
      return { ok: false, message: "Choose a setup action." };
    }
    if (result) return result;
  } catch (error) {
    return settingsDialogFailure(error);
  }
  revalidatePath("/onboarding");
  return {
    ok: true,
    message:
      kind === "garment"
        ? "Garment added."
        : kind === "worker"
          ? "Worker added."
          : "Workgroup added.",
  };
}

const flowSchema = z.object({
  garmentId: uuid,
  name,
  makeDefault: z.boolean(),
  stages: z
    .array(
      z.union([
        z.object({ stageId: uuid }),
        z.object({ name, workgroupId: uuid }),
      ]),
    )
    .min(1, "Add at least one production stage.")
    .max(50),
});

export async function saveSetupWorkflow(
  tenantId: string,
  _previous: SetupResult,
  formData: FormData,
): Promise<SetupResult> {
  const context = await requireBoutiqueOwner(tenantId || "missing");
  let garmentId: string;
  try {
    const parsed = flowSchema.parse({
      garmentId: formData.get("garmentId"),
      name: formData.get("name"),
      makeDefault: formData.get("makeDefault") === "on",
      stages: JSON.parse(String(formData.get("stages") || "[]")),
    });
    garmentId = parsed.garmentId;
    const { error } = await createSupabaseServiceRoleClient().rpc(
      "create_boutique_onboarding_workflow",
      {
        p_tenant_id: context.tenant.id,
        p_item_type_id: parsed.garmentId,
        p_name: parsed.name,
        p_is_default: parsed.makeDefault,
        p_rows: parsed.stages,
        p_actor_id: context.membership.clerk_user_id,
      },
    );
    if (error) {
      const messages: Record<string, string> = {
        ITEM_TYPE_NOT_FOUND: "Choose an active garment in this boutique.",
        STAGE_NOT_FOUND:
          "A selected stage is no longer active. Refresh and choose another stage.",
        WORKGROUP_NOT_FOUND:
          "A selected workgroup is no longer active. Return to Employee teams to check it.",
        STAGE_ALREADY_EXISTS:
          "A stage with that name already exists. Select it under Existing stage, or give your new stage a different name.",
        DUPLICATE_WORKFLOW_STAGE: "Use each stage once per workflow.",
        STAGE_NAME_REQUIRED: "Give each new stage a name.",
      };
      return {
        ok: false,
        message:
          error.code === "23505"
            ? "A workflow with this name already exists. Open the saved workflow or use a different name."
            : (messages[error.message] ??
              "Unable to save the workflow. Refresh and try again."),
      };
    }
  } catch (error) {
    if (error instanceof SyntaxError)
      return {
        ok: false,
        message: "Review the workflow stages and try again.",
      };
    return settingsDialogFailure(error);
  }
  revalidatePath("/settings");
  revalidatePath("/onboarding");
  redirect(`/onboarding?step=flows&garment=${garmentId}`);
}
