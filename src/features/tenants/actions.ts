"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTenantLogoFile, uploadTenantLogo } from "@/lib/tenant/assets";

const optionalText = z.preprocess((value) => (typeof value === "string" && value.trim() ? value : null), z.string().trim().nullable());

const optionalDate = z.preprocess((value) => (typeof value === "string" && value.trim() ? value : null), z.string().trim().nullable());

const gstTreatmentSchema = z.enum(["taxable_exclusive", "taxable_inclusive", "exempt_or_nil", "non_gst", "not_applicable"]);

function normalizeGstin(value: FormDataEntryValue | null, gstRegistered: boolean) {
  const gstin = typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : "";

  if (!gstRegistered || !gstin) {
    return null;
  }

  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    throw new Error("Add a valid GSTIN or leave GST registered off.");
  }

  return gstin;
}

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
  legalName: optionalText,
  registeredAddress: optionalText,
  gstRegistered: z.boolean().default(false),
  gstin: z.string().trim().nullable(),
  defaultSalesGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultPurchaseGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultOrderGstTreatment: gstTreatmentSchema.default("not_applicable"),
  defaultExpenseGstTreatment: gstTreatmentSchema.default("not_applicable"),
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
  legalName: optionalText,
  registeredAddress: optionalText,
  gstRegistered: z.boolean().default(false),
  gstin: z.string().trim().nullable(),
  defaultSalesGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultPurchaseGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultOrderGstTreatment: gstTreatmentSchema.default("not_applicable"),
  defaultExpenseGstTreatment: gstTreatmentSchema.default("not_applicable"),
  status: z.enum(["active", "inactive", "suspended"])
});

const billingRecordBaseSchema = z.object({
  tenantId: z.string().uuid(),
  billingPeriodStart: z.string().trim().min(1, "Billing period start is required."),
  billingPeriodEnd: z.string().trim().min(1, "Billing period end is required."),
  planName: z.string().trim().min(2, "Plan name is required."),
  amountDue: z.coerce.number().min(0, "Amount due cannot be negative."),
  amountPaid: z.coerce.number().min(0, "Amount paid cannot be negative."),
  paymentStatus: z.enum(["pending", "partially_paid", "paid", "overdue", "waived", "cancelled"]),
  paymentDate: optionalDate,
  paymentMode: optionalText,
  referenceNumber: optionalText,
  notes: optionalText
});

const billingRecordSchema = billingRecordBaseSchema.refine((value) => value.billingPeriodEnd >= value.billingPeriodStart, {
  path: ["billingPeriodEnd"],
  message: "Billing period end must be on or after the start date."
});

const updateBillingRecordSchema = billingRecordBaseSchema
  .extend({
    billingRecordId: z.string().uuid()
  })
  .refine((value) => value.billingPeriodEnd >= value.billingPeriodStart, {
    path: ["billingPeriodEnd"],
    message: "Billing period end must be on or after the start date."
  });

const billingRecordIdSchema = z.object({
  tenantId: z.string().uuid(),
  billingRecordId: z.string().uuid()
});

export async function createTenantAction(formData: FormData) {
  const superAdminUserId = await requireSuperAdmin();
  const gstRegistered = formData.get("gstRegistered") === "on";
  const parsed = createTenantSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    storeName: formData.get("storeName"),
    brandColor: formData.get("brandColor") || "#2563eb",
    legalName: formData.get("legalName"),
    registeredAddress: formData.get("registeredAddress"),
    gstRegistered,
    gstin: normalizeGstin(formData.get("gstin"), gstRegistered),
    defaultSalesGstRate: formData.get("defaultSalesGstRate") || 0,
    defaultPurchaseGstRate: formData.get("defaultPurchaseGstRate") || 0,
    defaultOrderGstTreatment: formData.get("defaultOrderGstTreatment") || "not_applicable",
    defaultExpenseGstTreatment: formData.get("defaultExpenseGstTreatment") || "not_applicable",
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
      legal_name: parsed.legalName,
      registered_address: parsed.registeredAddress,
      gst_registered: parsed.gstRegistered,
      gstin: parsed.gstin,
      default_sales_gst_rate: parsed.defaultSalesGstRate,
      default_purchase_gst_rate: parsed.defaultPurchaseGstRate,
      default_order_gst_treatment: parsed.defaultOrderGstTreatment,
      default_expense_gst_treatment: parsed.defaultExpenseGstTreatment,
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
  const gstRegistered = formData.get("gstRegistered") === "on";
  const parsed = updateTenantSchema.parse({
    tenantId: formData.get("tenantId"),
    name: formData.get("name"),
    storeName: formData.get("storeName"),
    brandColor: formData.get("brandColor") || "#2563eb",
    legalName: formData.get("legalName"),
    registeredAddress: formData.get("registeredAddress"),
    gstRegistered,
    gstin: normalizeGstin(formData.get("gstin"), gstRegistered),
    defaultSalesGstRate: formData.get("defaultSalesGstRate") || 0,
    defaultPurchaseGstRate: formData.get("defaultPurchaseGstRate") || 0,
    defaultOrderGstTreatment: formData.get("defaultOrderGstTreatment") || "not_applicable",
    defaultExpenseGstTreatment: formData.get("defaultExpenseGstTreatment") || "not_applicable",
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
      legal_name: parsed.legalName,
      registered_address: parsed.registeredAddress,
      gst_registered: parsed.gstRegistered,
      gstin: parsed.gstin,
      default_sales_gst_rate: parsed.defaultSalesGstRate,
      default_purchase_gst_rate: parsed.defaultPurchaseGstRate,
      default_order_gst_treatment: parsed.defaultOrderGstTreatment,
      default_expense_gst_treatment: parsed.defaultExpenseGstTreatment,
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

export async function createTenantBillingRecordAction(formData: FormData) {
  const superAdminUserId = await requireSuperAdmin();
  const parsed = billingRecordSchema.parse({
    tenantId: formData.get("tenantId"),
    billingPeriodStart: formData.get("billingPeriodStart"),
    billingPeriodEnd: formData.get("billingPeriodEnd"),
    planName: formData.get("planName"),
    amountDue: formData.get("amountDue") || 0,
    amountPaid: formData.get("amountPaid") || 0,
    paymentStatus: formData.get("paymentStatus"),
    paymentDate: formData.get("paymentDate"),
    paymentMode: formData.get("paymentMode"),
    referenceNumber: formData.get("referenceNumber"),
    notes: formData.get("notes")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tenant_billing_records").insert({
    tenant_id: parsed.tenantId,
    billing_period_start: parsed.billingPeriodStart,
    billing_period_end: parsed.billingPeriodEnd,
    plan_name: parsed.planName,
    amount_due: parsed.amountDue,
    amount_paid: parsed.amountPaid,
    payment_status: parsed.paymentStatus,
    payment_date: parsed.paymentDate,
    payment_mode: parsed.paymentMode,
    reference_number: parsed.referenceNumber,
    notes: parsed.notes,
    created_by: superAdminUserId,
    updated_by: superAdminUserId,
    deleted_at: null
  });

  if (error) {
    throw new Error(`Unable to add tenant billing record: ${error.message}`);
  }

  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${parsed.tenantId}`);
}

export async function updateTenantBillingRecordAction(formData: FormData) {
  const superAdminUserId = await requireSuperAdmin();
  const parsed = updateBillingRecordSchema.parse({
    tenantId: formData.get("tenantId"),
    billingRecordId: formData.get("billingRecordId"),
    billingPeriodStart: formData.get("billingPeriodStart"),
    billingPeriodEnd: formData.get("billingPeriodEnd"),
    planName: formData.get("planName"),
    amountDue: formData.get("amountDue") || 0,
    amountPaid: formData.get("amountPaid") || 0,
    paymentStatus: formData.get("paymentStatus"),
    paymentDate: formData.get("paymentDate"),
    paymentMode: formData.get("paymentMode"),
    referenceNumber: formData.get("referenceNumber"),
    notes: formData.get("notes")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("tenant_billing_records")
    .update({
      billing_period_start: parsed.billingPeriodStart,
      billing_period_end: parsed.billingPeriodEnd,
      plan_name: parsed.planName,
      amount_due: parsed.amountDue,
      amount_paid: parsed.amountPaid,
      payment_status: parsed.paymentStatus,
      payment_date: parsed.paymentDate,
      payment_mode: parsed.paymentMode,
      reference_number: parsed.referenceNumber,
      notes: parsed.notes,
      updated_by: superAdminUserId
    })
    .eq("tenant_id", parsed.tenantId)
    .eq("id", parsed.billingRecordId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to update tenant billing record: ${error.message}`);
  }

  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${parsed.tenantId}`);
}

export async function cancelTenantBillingRecordAction(formData: FormData) {
  const superAdminUserId = await requireSuperAdmin();
  const parsed = billingRecordIdSchema.parse({
    tenantId: formData.get("tenantId"),
    billingRecordId: formData.get("billingRecordId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("tenant_billing_records")
    .update({
      payment_status: "cancelled",
      deleted_at: new Date().toISOString(),
      updated_by: superAdminUserId
    })
    .eq("tenant_id", parsed.tenantId)
    .eq("id", parsed.billingRecordId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to cancel tenant billing record: ${error.message}`);
  }

  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${parsed.tenantId}`);
}
