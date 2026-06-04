"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTenantLogoFile, uploadTenantLogo } from "@/lib/tenant/assets";

const createTenantSchema = z.object({
  name: z.string().trim().min(2, "Tenant name is required."),
  slug: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .replace(/-{2,}/g, "-")
        : value,
    z.string().min(2, "Slug is required.").regex(/^[a-z0-9-]+$/, "Slug can contain lowercase letters, numbers, and hyphens only.")
  ),
  storeName: z.string().trim().min(2, "Store name is required."),
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color such as #2563eb."),
  ownerEmail: z
    .string()
    .trim()
    .email("Add a valid owner email.")
    .transform((value) => value.toLowerCase())
    .optional()
});

const updateTenantSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(2, "Tenant name is required."),
  storeName: z.string().trim().min(2, "Store name is required."),
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color such as #2563eb."),
  status: z.enum(["active", "inactive", "suspended"])
});

export async function createTenantAction(formData: FormData) {
  const superAdminUserId = await requireSuperAdmin();
  const parsed = createTenantSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    storeName: formData.get("storeName"),
    brandColor: formData.get("brandColor") || "#2563eb",
    ownerEmail: formData.get("ownerEmail") || undefined
  });
  const logoFile = getTenantLogoFile(formData);
  const logoUrl = logoFile ? await uploadTenantLogo({ file: logoFile, slug: parsed.slug }) : null;

  const supabase = createSupabaseServiceRoleClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name: parsed.name,
      slug: parsed.slug,
      store_name: parsed.storeName,
      brand_color: parsed.brandColor,
      logo_url: logoUrl,
      status: "active",
      custom_domain: null,
      tracking_subdomain: null
    })
    .select("*")
    .single();

  if (tenantError) {
    throw new Error(`Unable to create tenant: ${tenantError.message}`);
  }

  if (parsed.ownerEmail) {
    const { error: membershipError } = await supabase.from("tenant_users").insert({
      tenant_id: tenant.id,
      clerk_user_id: null,
      email: parsed.ownerEmail,
      role: "owner_admin",
      status: "active",
      invited_by: superAdminUserId,
      updated_by: superAdminUserId
    });

    if (membershipError) {
      throw new Error(`Tenant created, but owner membership failed: ${membershipError.message}`);
    }
  }

  redirect(`/super-admin/tenants/${tenant.id}`);
}

export async function updateTenantAction(formData: FormData) {
  await requireSuperAdmin();
  const parsed = updateTenantSchema.parse({
    tenantId: formData.get("tenantId"),
    name: formData.get("name"),
    storeName: formData.get("storeName"),
    brandColor: formData.get("brandColor") || "#2563eb",
    status: formData.get("status")
  });
  const supabase = createSupabaseServiceRoleClient();
  const existing = await supabase.from("tenants").select("id, slug, logo_url").eq("id", parsed.tenantId).maybeSingle();

  if (existing.error) {
    throw new Error(`Unable to load tenant: ${existing.error.message}`);
  }

  if (!existing.data) {
    throw new Error("Tenant not found.");
  }

  const logoFile = getTenantLogoFile(formData);
  const logoUrl = logoFile ? await uploadTenantLogo({ file: logoFile, slug: existing.data.slug }) : existing.data.logo_url;
  const { error } = await supabase
    .from("tenants")
    .update({
      name: parsed.name,
      store_name: parsed.storeName,
      brand_color: parsed.brandColor,
      logo_url: logoUrl,
      status: parsed.status
    })
    .eq("id", parsed.tenantId);

  if (error) {
    throw new Error(`Unable to update tenant: ${error.message}`);
  }

  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${parsed.tenantId}`);
  revalidatePath("/select-tenant");
  revalidatePath("/settings");
  revalidatePath("/settings/business-profile");
}
