"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getTenantMembershipOptions,
  requireTenantContext,
  selectedTenantCookieName
} from "@/lib/tenant/context";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
);

const tenantUserSchema = z.object({
  displayName: optionalText,
  email: z
    .string()
    .trim()
    .email("Add a valid email address.")
    .transform((value) => value.toLowerCase()),
  role: z.enum(["owner_admin", "manager", "finance", "viewer"]),
  status: z.enum(["active", "disabled"]).default("active")
});

const updateTenantUserSchema = tenantUserSchema.extend({
  tenantUserId: z.string().uuid()
});

const selectTenantSchema = z.object({
  tenantId: z.string().uuid()
});

async function getAuthorizedTenantUsersContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "tenant_users:manage");
  return context;
}

async function ensureNotRemovingLastOwnerAdmin({
  nextRole,
  nextStatus,
  tenantId,
  tenantUserId
}: {
  nextRole: string;
  nextStatus: string;
  tenantId: string;
  tenantUserId: string;
}) {
  if (nextRole === "owner_admin" && nextStatus === "active") {
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { count, error } = await supabase
    .from("tenant_users")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "owner_admin")
    .eq("status", "active")
    .neq("id", tenantUserId);

  if (error) {
    throw new Error(`Unable to validate owner admins: ${error.message}`);
  }

  if (!count) {
    throw new Error("Keep at least one active owner/admin for this tenant.");
  }
}

export async function selectTenantAction(formData: FormData) {
  const parsed = selectTenantSchema.parse({
    tenantId: formData.get("tenantId")
  });
  const options = await getTenantMembershipOptions();
  const selected = options.find((option) => option.tenant.id === parsed.tenantId);

  if (!selected) {
    throw new Error("You do not have access to this tenant.");
  }

  (await cookies()).set(selectedTenantCookieName, selected.tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  redirect("/dashboard");
}

export async function createTenantUserAction(formData: FormData) {
  const context = await getAuthorizedTenantUsersContext();
  const parsed = tenantUserSchema.parse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    role: formData.get("role"),
    status: formData.get("status") ?? "active"
  });
  const supabase = createSupabaseServiceRoleClient();
  const actor = context.membership.clerk_user_id ?? context.membership.email;
  const { error } = await supabase.from("tenant_users").insert({
    tenant_id: context.tenant.id,
    clerk_user_id: null,
    display_name: parsed.displayName,
    email: parsed.email,
    role: parsed.role,
    status: parsed.status,
    invited_by: actor,
    updated_by: actor
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("This email is already mapped to this tenant.");
    }

    throw new Error(`Unable to add tenant user: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/users");
}

export async function updateTenantUserAction(formData: FormData) {
  const context = await getAuthorizedTenantUsersContext();
  const parsed = updateTenantUserSchema.parse({
    tenantUserId: formData.get("tenantUserId"),
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    role: formData.get("role"),
    status: formData.get("status") ?? "active"
  });

  await ensureNotRemovingLastOwnerAdmin({
    tenantId: context.tenant.id,
    tenantUserId: parsed.tenantUserId,
    nextRole: parsed.role,
    nextStatus: parsed.status
  });

  const supabase = createSupabaseServiceRoleClient();
  const actor = context.membership.clerk_user_id ?? context.membership.email;
  const { error } = await supabase
    .from("tenant_users")
    .update({
      display_name: parsed.displayName,
      email: parsed.email,
      role: parsed.role,
      status: parsed.status,
      updated_by: actor
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.tenantUserId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("This email is already mapped to this tenant.");
    }

    throw new Error(`Unable to update tenant user: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/users");
}
