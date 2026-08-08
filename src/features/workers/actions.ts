"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { WorkerWageType } from "@/types/database";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const wageTypeSchema = z.enum(["hourly", "daily", "weekly", "monthly", "per_piece", "hybrid"]);

const createWorkerSchema = z.object({
  name: z.string().trim().min(2, "Worker name is required."),
  phone: optionalText,
  joiningDate: optionalText,
  primaryWorkgroupId: optionalText,
  wageType: wageTypeSchema,
  wageAmount: z.coerce.number().min(0),
  notes: optionalText,
  workgroupIds: z.array(z.string().uuid())
});

const updateWorkerSchema = createWorkerSchema.extend({
  workerId: z.string().uuid(),
  status: z.enum(["active", "inactive"])
});

async function getAuthorizedWorkerContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "settings:manage");
  return context;
}

function getSelectedWorkgroupIds(formData: FormData) {
  return formData
    .getAll("workgroupIds")
    .map((value) => String(value))
    .filter(Boolean);
}

export async function createWorkerAction(formData: FormData) {
  const context = await getAuthorizedWorkerContext();
  const parsed = createWorkerSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    joiningDate: formData.get("joiningDate"),
    primaryWorkgroupId: formData.get("primaryWorkgroupId"),
    wageType: formData.get("wageType") || "monthly",
    wageAmount: formData.get("wageAmount") || 0,
    notes: formData.get("notes"),
    workgroupIds: getSelectedWorkgroupIds(formData)
  });

  const supabase = createSupabaseServiceRoleClient();
  const allWorkgroupIds = Array.from(
    new Set([parsed.primaryWorkgroupId, ...parsed.workgroupIds].filter((value): value is string => Boolean(value)))
  );

  if (allWorkgroupIds.length) {
    const { data: validWorkgroups, error: validWorkgroupsError } = await supabase
      .from("workgroups")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .in("id", allWorkgroupIds)
      .is("deleted_at", null);

    if (validWorkgroupsError) {
      throw new Error(`Unable to validate workgroups: ${validWorkgroupsError.message}`);
    }

    if ((validWorkgroups ?? []).length !== allWorkgroupIds.length) {
      throw new Error("One or more selected workgroups do not belong to this tenant.");
    }
  }

  const { data: worker, error: workerError } = await supabase
    .from("workers")
    .insert({
      tenant_id: context.tenant.id,
      name: parsed.name,
      phone: parsed.phone,
      joining_date: parsed.joiningDate,
      primary_workgroup_id: parsed.primaryWorkgroupId,
      wage_type: parsed.wageType as WorkerWageType,
      wage_amount: parsed.wageAmount,
      notes: parsed.notes,
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    })
    .select("*")
    .single();

  if (workerError) {
    throw new Error(`Unable to create worker: ${workerError.message}`);
  }

  if (allWorkgroupIds.length) {
    const { error: membershipError } = await supabase.from("worker_workgroups").insert(
      allWorkgroupIds.map((workgroupId) => ({
        tenant_id: context.tenant.id,
        worker_id: worker.id,
        workgroup_id: workgroupId,
        created_by: context.membership.clerk_user_id
      }))
    );

    if (membershipError) {
      throw new Error(`Worker created, but workgroup mapping failed: ${membershipError.message}`);
    }
  }

  revalidatePath("/workers");
  revalidatePath("/settings/workgroups");
}

export async function updateWorkerAction(formData: FormData) {
  const context = await getAuthorizedWorkerContext();
  const parsed = updateWorkerSchema.parse({
    workerId: formData.get("workerId"), name: formData.get("name"), phone: formData.get("phone"),
    joiningDate: formData.get("joiningDate"), status: formData.get("status"), primaryWorkgroupId: formData.get("primaryWorkgroupId"),
    wageType: formData.get("wageType") || "monthly", wageAmount: formData.get("wageAmount") || 0,
    notes: formData.get("notes"), workgroupIds: getSelectedWorkgroupIds(formData)
  });
  const workgroupIds = Array.from(new Set([parsed.primaryWorkgroupId, ...parsed.workgroupIds].filter((value): value is string => Boolean(value))));
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("update_worker_configuration", {
    p_tenant_id: context.tenant.id, p_worker_id: parsed.workerId, p_name: parsed.name, p_phone: parsed.phone,
    p_joining_date: parsed.joiningDate, p_status: parsed.status, p_primary_workgroup_id: parsed.primaryWorkgroupId,
    p_wage_type: parsed.wageType as WorkerWageType, p_wage_amount: parsed.wageAmount, p_notes: parsed.notes,
    p_workgroup_ids: workgroupIds, p_actor_id: context.membership.clerk_user_id
  });
  if (error) throw new Error(error.message.includes("WORKGROUP_NOT_FOUND") ? "One or more selected workgroups are unavailable." : error.message.includes("WORKER_NOT_FOUND") ? "Worker does not belong to this tenant." : `Unable to update worker: ${error.message}`);
  revalidatePath("/workers"); revalidatePath("/attendance"); revalidatePath("/salary"); revalidatePath("/settings/workgroups");
}
