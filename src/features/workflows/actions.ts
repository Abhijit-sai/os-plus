"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const createWorkflowSchema = z.object({
  name: z.string().trim().min(2, "Workflow name is required."),
  description: optionalText,
  itemTypeId: optionalText,
  isDefault: z.boolean().default(false),
  stageIds: z.array(z.string().uuid()).min(1, "Select at least one stage.")
}).superRefine((value, context) => {
  if (value.isDefault && !value.itemTypeId) {
    context.addIssue({ code: "custom", message: "Choose an item type before making this the default workflow.", path: ["itemTypeId"] });
  }
});

const workflowStageSequenceSchema = z.object({
  workflowId: z.string().uuid(),
  stageIds: z.array(z.string().uuid()).min(1, "Select at least one stage."),
  customerStatusIds: z.array(z.string().uuid().nullable())
});

const deleteWorkflowSchema = z.object({
  workflowId: z.string().uuid()
});

const mapStageWorkgroupSchema = z.object({
  stageMasterId: z.string().uuid(),
  workgroupId: z.string().uuid()
});

const updateWorkflowSchema = z.object({
  workflowId: z.string().uuid(), name: z.string().trim().min(2, "Workflow name is required."),
  description: optionalText, itemTypeId: optionalText, isDefault: z.boolean().default(false), isActive: z.boolean().default(true)
}).superRefine((value, context) => {
  if (value.isDefault && !value.isActive) {
    context.addIssue({ code: "custom", message: "Default workflows must remain active.", path: ["isActive"] });
  }
});

async function getAuthorizedWorkflowContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "settings:manage");
  return context;
}

function getSelectedStageIds(formData: FormData) {
  const rowStageIds = Array.from({ length: 50 })
    .map((_, index) => String(formData.get(`stageId_${index + 1}`) ?? ""))
    .filter(Boolean);

  if (rowStageIds.length) {
    return rowStageIds;
  }

  return formData
    .getAll("stageIds")
    .map((value) => String(value))
    .filter(Boolean);
}

function getOptionalCustomerStatusIdsForSelectedRows(formData: FormData) {
  return Array.from({ length: 50 }).flatMap((_, index) => {
    const row = index + 1;
    const stageId = String(formData.get(`stageId_${row}`) ?? "");

    if (!stageId) {
      return [];
    }

    const customerStatusId = String(formData.get(`customerStatusId_${row}`) ?? "");
    return [customerStatusId || null];
  });
}

function assertUniqueStageSequence(stageIds: string[]) {
  const uniqueStageIds = new Set(stageIds);

  if (uniqueStageIds.size !== stageIds.length) {
    throw new Error("A workflow cannot include the same stage more than once.");
  }
}

export async function createWorkflowAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = createWorkflowSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    itemTypeId: formData.get("itemTypeId"),
    isDefault: formData.get("isDefault") === "on",
    stageIds: getSelectedStageIds(formData)
  });
  assertUniqueStageSequence(parsed.stageIds);

  const supabase = createSupabaseServiceRoleClient();
  const { data: workflowId, error } = await supabase.rpc("create_workflow_configuration", {
    p_tenant_id: context.tenant.id,
    p_name: parsed.name,
    p_description: parsed.description,
    p_item_type_id: parsed.itemTypeId,
    p_is_default: parsed.isDefault,
    p_stage_ids: parsed.stageIds,
    p_actor_id: context.membership.clerk_user_id
  });
  if (error || !workflowId) {
    const message = error?.message ?? "Workflow was not created.";
    throw new Error(
      message.includes("ITEM_TYPE_NOT_FOUND") ? "Selected item type does not belong to this tenant."
        : message.includes("STAGE_NOT_FOUND") ? "One or more selected stages are inactive or do not belong to this tenant."
          : message.includes("DEFAULT_WORKFLOW_REQUIRES_ITEM_TYPE") ? "Choose an item type before making this the default workflow."
            : `Unable to create workflow: ${message}`
    );
  }

  revalidatePath("/settings");
  revalidatePath("/settings/workflows");
  redirect(`/settings/workflows/${workflowId}`);
}

export async function addStageWorkgroupAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = mapStageWorkgroupSchema.parse({
    stageMasterId: formData.get("stageMasterId"),
    workgroupId: formData.get("workgroupId")
  });

  const supabase = createSupabaseServiceRoleClient();
  const [stage, workgroup] = await Promise.all([
    supabase
      .from("stage_master")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.stageMasterId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("workgroups")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.workgroupId)
      .is("deleted_at", null)
      .maybeSingle()
  ]);

  if (stage.error || workgroup.error) {
    throw new Error(stage.error?.message ?? workgroup.error?.message ?? "Unable to validate mapping.");
  }

  if (!stage.data || !workgroup.data) {
    throw new Error("Selected stage or workgroup does not belong to this tenant.");
  }

  const { error } = await supabase.from("stage_workgroups").insert({
    tenant_id: context.tenant.id,
    stage_master_id: parsed.stageMasterId,
    workgroup_id: parsed.workgroupId,
    created_by: context.membership.clerk_user_id
  });

  if (error && error.code !== "23505") {
    throw new Error(`Unable to map stage workgroup: ${error.message}`);
  }

  revalidatePath("/settings/workflows");
}

export async function removeStageWorkgroupAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = mapStageWorkgroupSchema.parse({ stageMasterId: formData.get("stageMasterId"), workgroupId: formData.get("workgroupId") });
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("stage_workgroups").delete().eq("tenant_id", context.tenant.id).eq("stage_master_id", parsed.stageMasterId).eq("workgroup_id", parsed.workgroupId).select("id").maybeSingle();
  if (error) throw new Error(`Unable to remove stage workgroup mapping: ${error.message}`);
  if (!data) throw new Error("Stage workgroup mapping does not belong to this tenant.");
  revalidatePath("/settings/workflows");
}

export async function updateWorkflowAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = updateWorkflowSchema.parse({ workflowId: formData.get("workflowId"), name: formData.get("name"), description: formData.get("description"), itemTypeId: formData.get("itemTypeId"), isDefault: formData.get("isDefault") === "on", isActive: formData.get("isActive") === "on" });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("update_workflow_configuration", { p_tenant_id: context.tenant.id, p_workflow_id: parsed.workflowId, p_name: parsed.name, p_description: parsed.description, p_item_type_id: parsed.itemTypeId, p_is_default: parsed.isDefault, p_is_active: parsed.isActive, p_actor_id: context.membership.clerk_user_id });
  if (error) throw new Error(error.message.includes("ITEM_TYPE_NOT_FOUND") ? "Selected item type is unavailable." : error.message.includes("DEFAULT_WORKFLOW_REQUIRES_ITEM_TYPE") ? "Choose an item type before making this the default workflow." : error.message.includes("DEFAULT_WORKFLOW_MUST_BE_ACTIVE") ? "Default workflows must remain active." : error.message.includes("ACTIVE_WORKFLOW_REQUIRES_ACTIVE_STAGE") ? "An active workflow must contain at least one active stage." : error.message.includes("WORKFLOW_NOT_FOUND") ? "Workflow does not belong to this tenant." : `Unable to update workflow: ${error.message}`);
  revalidatePath("/settings"); revalidatePath("/settings/workflows"); revalidatePath(`/settings/workflows/${parsed.workflowId}`);
}

export async function replaceWorkflowStagesAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = workflowStageSequenceSchema.parse({
    workflowId: formData.get("workflowId"),
    stageIds: getSelectedStageIds(formData),
    customerStatusIds: getOptionalCustomerStatusIdsForSelectedRows(formData)
  });
  assertUniqueStageSequence(parsed.stageIds);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("replace_workflow_stage_sequence", {
    p_tenant_id: context.tenant.id,
    p_workflow_id: parsed.workflowId,
    p_stage_ids: parsed.stageIds,
    p_customer_status_ids: parsed.customerStatusIds,
    p_actor_id: context.membership.clerk_user_id
  });
  if (error) {
    throw new Error(
      error.message.includes("WORKFLOW_NOT_FOUND") ? "Workflow does not belong to this tenant."
        : error.message.includes("STAGE_NOT_FOUND") ? "One or more selected stages are inactive or do not belong to this tenant."
          : error.message.includes("CUSTOMER_STATUS_NOT_FOUND") ? "One or more selected customer statuses do not belong to this tenant."
            : `Unable to save workflow stages: ${error.message}`
    );
  }

  revalidatePath("/settings/workflows");
  revalidatePath(`/settings/workflows/${parsed.workflowId}`);
}

export async function deleteWorkflowAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = deleteWorkflowSchema.parse({
    workflowId: formData.get("workflowId")
  });

  const supabase = createSupabaseServiceRoleClient();
  const now = new Date().toISOString();

  const { error: stagesError } = await supabase
    .from("workflow_stages")
    .update({
      deleted_at: now,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("workflow_id", parsed.workflowId)
    .is("deleted_at", null);

  if (stagesError) {
    throw new Error(`Unable to delete workflow stages: ${stagesError.message}`);
  }

  const { error: itemTypeError } = await supabase
    .from("item_types")
    .update({
      default_workflow_id: null,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("default_workflow_id", parsed.workflowId);

  if (itemTypeError) {
    throw new Error(`Unable to clear workflow defaults: ${itemTypeError.message}`);
  }

  const { error: workflowError } = await supabase
    .from("workflows")
    .update({
      deleted_at: now,
      is_active: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.workflowId);

  if (workflowError) {
    throw new Error(`Unable to delete workflow: ${workflowError.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/workflows");
  redirect("/settings/workflows");
}
