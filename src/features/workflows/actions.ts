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

  const { data: validStages, error: validStagesError } = await supabase
    .from("stage_master")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .in("id", parsed.stageIds)
    .is("deleted_at", null);

  if (validStagesError) {
    throw new Error(`Unable to validate workflow stages: ${validStagesError.message}`);
  }

  if ((validStages ?? []).length !== parsed.stageIds.length) {
    throw new Error("One or more selected stages do not belong to this tenant.");
  }

  if (parsed.itemTypeId) {
    const { data: itemType, error: itemTypeError } = await supabase
      .from("item_types")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.itemTypeId)
      .is("deleted_at", null)
      .maybeSingle();

    if (itemTypeError) {
      throw new Error(`Unable to validate item type: ${itemTypeError.message}`);
    }

    if (!itemType) {
      throw new Error("Selected item type does not belong to this tenant.");
    }
  }

  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .insert({
      tenant_id: context.tenant.id,
      name: parsed.name,
      description: parsed.description,
      item_type_id: parsed.itemTypeId,
      is_default: parsed.isDefault,
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    })
    .select("*")
    .single();

  if (workflowError) {
    throw new Error(`Unable to create workflow: ${workflowError.message}`);
  }

  const { error: stagesError } = await supabase.from("workflow_stages").insert(
    parsed.stageIds.map((stageId, index) => ({
      tenant_id: context.tenant.id,
      workflow_id: workflow.id,
      stage_master_id: stageId,
      sequence_number: index + 1,
      is_mandatory: true,
      allows_multiple_workers: true,
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    }))
  );

  if (stagesError) {
    throw new Error(`Workflow created, but stages failed: ${stagesError.message}`);
  }

  if (parsed.itemTypeId && parsed.isDefault) {
    const { error: itemTypeUpdateError } = await supabase
      .from("item_types")
      .update({
        default_workflow_id: workflow.id,
        updated_by: context.membership.clerk_user_id
      })
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.itemTypeId);

    if (itemTypeUpdateError) {
      throw new Error(`Workflow created, but item type default mapping failed: ${itemTypeUpdateError.message}`);
    }
  }

  revalidatePath("/settings");
  revalidatePath("/settings/workflows");
  redirect(`/settings/workflows/${workflow.id}`);
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

export async function replaceWorkflowStagesAction(formData: FormData) {
  const context = await getAuthorizedWorkflowContext();
  const parsed = workflowStageSequenceSchema.parse({
    workflowId: formData.get("workflowId"),
    stageIds: getSelectedStageIds(formData),
    customerStatusIds: getOptionalCustomerStatusIdsForSelectedRows(formData)
  });
  assertUniqueStageSequence(parsed.stageIds);

  const supabase = createSupabaseServiceRoleClient();
  const { data: workflow, error: workflowError } = await supabase
    .from("workflows")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.workflowId)
    .is("deleted_at", null)
    .maybeSingle();

  if (workflowError) {
    throw new Error(`Unable to validate workflow: ${workflowError.message}`);
  }

  if (!workflow) {
    throw new Error("Workflow does not belong to this tenant.");
  }

  const { data: validStages, error: validStagesError } = await supabase
    .from("stage_master")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .in("id", parsed.stageIds)
    .is("deleted_at", null);

  if (validStagesError) {
    throw new Error(`Unable to validate stages: ${validStagesError.message}`);
  }

  if ((validStages ?? []).length !== parsed.stageIds.length) {
    throw new Error("One or more selected stages do not belong to this tenant.");
  }

  const selectedCustomerStatusIds = Array.from(
    new Set(parsed.customerStatusIds.filter((value): value is string => Boolean(value)))
  );
  if (selectedCustomerStatusIds.length) {
    const { data: validStatuses, error: validStatusesError } = await supabase
      .from("customer_statuses")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .in("id", selectedCustomerStatusIds)
      .is("deleted_at", null);

    if (validStatusesError) {
      throw new Error(`Unable to validate customer statuses: ${validStatusesError.message}`);
    }

    if ((validStatuses ?? []).length !== selectedCustomerStatusIds.length) {
      throw new Error("One or more selected customer statuses do not belong to this tenant.");
    }
  }

  const { error: softDeleteError } = await supabase
    .from("workflow_stages")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("workflow_id", parsed.workflowId)
    .is("deleted_at", null);

  if (softDeleteError) {
    throw new Error(`Unable to replace workflow stages: ${softDeleteError.message}`);
  }

  const { error: insertError } = await supabase.from("workflow_stages").insert(
    parsed.stageIds.map((stageId, index) => ({
      tenant_id: context.tenant.id,
      workflow_id: parsed.workflowId,
      stage_master_id: stageId,
      sequence_number: index + 1,
      is_mandatory: true,
      allows_multiple_workers: true,
      customer_status_id: parsed.customerStatusIds[index] ?? null,
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    }))
  );

  if (insertError) {
    throw new Error(`Unable to save workflow stages: ${insertError.message}`);
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
