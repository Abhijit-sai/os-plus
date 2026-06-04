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
