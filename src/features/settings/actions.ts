"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTenantLogoFile, uploadTenantLogo } from "@/lib/tenant/assets";
import { requireTenantContext } from "@/lib/tenant/context";
import { normalizeItemTypeIcon } from "@/features/settings/item-type-icon";
import {
  defaultCustomerStatuses,
  defaultExpenseCategories,
  defaultItemTypes,
  defaultPaymentModes,
  defaultStages,
  defaultWorkgroups
} from "@/features/settings/defaults";
import type { Json } from "@/types/database";
import type {
  ContributionAllocationBasis,
  ItemStageContributionMethod,
} from "@/types/database";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const nameSchema = z.string().trim().min(2, "Name is required.");

const optionalProfileText = z.preprocess((value) => (typeof value === "string" && value.trim() ? value : null), z.string().trim().nullable());

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

const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Business name is required."),
  storeName: z.string().trim().min(2, "Store name is required."),
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color such as #2563eb."),
  legalName: optionalProfileText,
  registeredAddress: optionalProfileText,
  gstRegistered: z.boolean().default(false),
  gstin: z.string().trim().nullable(),
  defaultSalesGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultPurchaseGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultOrderGstTreatment: z.enum(["taxable_exclusive", "taxable_inclusive", "exempt_or_nil", "non_gst", "not_applicable"]).default("not_applicable"),
  defaultExpenseGstTreatment: z.enum(["taxable_exclusive", "taxable_inclusive", "exempt_or_nil", "non_gst", "not_applicable"]).default("not_applicable")
});

const itemTypeSchema = z.object({
  name: nameSchema,
  description: optionalText,
  icon: z.object({
    kind: z.unknown(),
    emoji: z.unknown(),
    name: z.unknown(),
    color: z.unknown(),
  }).transform((value, context) => {
    try {
      return normalizeItemTypeIcon(value);
    } catch (error) {
      context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Choose a valid item icon." });
      return z.NEVER;
    }
  }),
  defaultSlaDays: z.coerce.number().int().min(0).optional()
});

const textMasterSchema = z.object({
  name: nameSchema,
  description: optionalText
});

const stageEffortModeSchema = z.enum(["none", "units", "hours", "hybrid"]);
const contributionRuleSelectionSchema = z.enum([
  "none",
  "per_unit",
  "per_hour",
  "percentage_units",
  "percentage_hours",
]);

const customerStatusSchema = z.object({
  name: nameSchema,
  description: optionalText,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isFinalStatus: z.boolean().default(false)
});

const locationTypeSchema = z.enum(["store", "workshop", "warehouse", "office", "other"]);

const tenantLocationSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(32),
  name: nameSchema,
  locationType: locationTypeSchema.default("store"),
  addressLine1: optionalText,
  addressLine2: optionalText,
  area: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code.")
    .default("IN")
});

const tenantLocationIdSchema = z.object({
  locationId: z.string().uuid()
});

const teamSchema = z.object({
  name: nameSchema,
  code: z.string().trim().min(1, "Code is required.").max(32),
  description: optionalText,
  locationId: optionalText
});

const teamIdSchema = z.object({
  teamId: z.string().uuid()
});

const teamMemberSchema = z.object({
  teamId: z.string().uuid(),
  tenantUserId: z.string().uuid()
});

const measurementFieldSchema = z.object({
  itemTypeId: z.string().uuid(),
  fieldKey: z.string().trim().min(1, "Field key is required."),
  fieldLabel: z.string().trim().min(1, "Field label is required."),
  unit: optionalText,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isRequired: z.boolean().default(false),
  helpText: optionalText
});

const updateMeasurementFieldSchema = measurementFieldSchema.extend({
  fieldId: z.string().uuid(),
  isActive: z.boolean().default(true)
});

const measurementFieldIdSchema = z.object({
  fieldId: z.string().uuid()
});

const standardSizeSchema = z.object({
  itemTypeId: z.string().uuid(),
  sizeLabel: z.string().trim().min(1, "Size name is required."),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  measurementData: z.record(z.string().min(1), z.string())
});

const updateStandardSizeSchema = standardSizeSchema.extend({
  standardSizeId: z.string().uuid()
});

const standardSizeIdSchema = z.object({
  standardSizeId: z.string().uuid()
});

const activeFlagSchema = z.object({ isActive: z.boolean().default(true) });

async function getAuthorizedSettingsContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "settings:manage");
  return context;
}

function getOptionalNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return value;
}

function isUniqueConstraintError(error: { code?: string; message: string }) {
  return error.code === "23505" || error.message.toLowerCase().includes("duplicate key value");
}

export async function updateBusinessProfileAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const gstRegistered = formData.get("gstRegistered") === "on";
  const parsed = businessProfileSchema.parse({
    name: formData.get("name"),
    storeName: formData.get("storeName"),
    brandColor: formData.get("brandColor"),
    legalName: formData.get("legalName"),
    registeredAddress: formData.get("registeredAddress"),
    gstRegistered,
    gstin: normalizeGstin(formData.get("gstin"), gstRegistered),
    defaultSalesGstRate: formData.get("defaultSalesGstRate") || 0,
    defaultPurchaseGstRate: formData.get("defaultPurchaseGstRate") || 0,
    defaultOrderGstTreatment: formData.get("defaultOrderGstTreatment") || "not_applicable",
    defaultExpenseGstTreatment: formData.get("defaultExpenseGstTreatment") || "not_applicable"
  });
  const logoFile = getTenantLogoFile(formData);
  const logoUrl = logoFile ? await uploadTenantLogo({ file: logoFile, slug: context.tenant.slug }) : context.tenant.logo_url;

  const supabase = createSupabaseServiceRoleClient();
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
      default_expense_gst_treatment: parsed.defaultExpenseGstTreatment
    })
    .eq("id", context.tenant.id);

  if (error) {
    throw new Error(`Unable to update business profile: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/business-profile");
}

export async function seedConfigurationDefaultsAction() {
  const context = await getAuthorizedSettingsContext();
  const supabase = createSupabaseServiceRoleClient();
  const auditUserId = context.membership.clerk_user_id;

  const [
    existingCustomerStatuses,
    existingItemTypes,
    existingStages,
    existingWorkgroups,
    existingPaymentModes,
    existingExpenseCategories
  ] = await Promise.all([
    supabase.from("customer_statuses").select("name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("item_types").select("name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("stage_master").select("name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("workgroups").select("name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("payment_modes").select("name").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("expense_categories").select("name").eq("tenant_id", context.tenant.id).is("deleted_at", null)
  ]);

  for (const result of [
    existingCustomerStatuses,
    existingItemTypes,
    existingStages,
    existingWorkgroups,
    existingPaymentModes,
    existingExpenseCategories
  ]) {
    if (result.error) {
      throw new Error(`Unable to inspect existing configuration: ${result.error.message}`);
    }
  }

  const names = (rows: Array<{ name: string }> | null) => new Set((rows ?? []).map((row) => row.name.toLowerCase()));
  const customerStatusNames = names(existingCustomerStatuses.data);
  const itemTypeNames = names(existingItemTypes.data);
  const stageNames = names(existingStages.data);
  const workgroupNames = names(existingWorkgroups.data);
  const paymentModeNames = names(existingPaymentModes.data);
  const expenseCategoryNames = names(existingExpenseCategories.data);

  const customerStatusRows = defaultCustomerStatuses
    .filter((status) => !customerStatusNames.has(status.name.toLowerCase()))
    .map((status) => ({
      tenant_id: context.tenant.id,
      name: status.name,
      sort_order: status.sort_order,
      is_final_status: status.is_final_status,
      created_by: auditUserId,
      updated_by: auditUserId
    }));
  const itemTypeRows = defaultItemTypes
    .filter((name) => !itemTypeNames.has(name.toLowerCase()))
    .map((name) => ({ tenant_id: context.tenant.id, name, created_by: auditUserId, updated_by: auditUserId }));
  const stageRows = defaultStages
    .filter((name) => !stageNames.has(name.toLowerCase()))
    .map((name) => ({ tenant_id: context.tenant.id, name, created_by: auditUserId, updated_by: auditUserId }));
  const workgroupRows = defaultWorkgroups
    .filter((name) => !workgroupNames.has(name.toLowerCase()))
    .map((name) => ({ tenant_id: context.tenant.id, name, created_by: auditUserId, updated_by: auditUserId }));
  const paymentModeRows = defaultPaymentModes
    .filter((name) => !paymentModeNames.has(name.toLowerCase()))
    .map((name) => ({ tenant_id: context.tenant.id, name, created_by: auditUserId, updated_by: auditUserId }));
  const expenseCategoryRows = defaultExpenseCategories
    .filter((name) => !expenseCategoryNames.has(name.toLowerCase()))
    .map((name) => ({
      tenant_id: context.tenant.id,
      name,
      is_default: true,
      created_by: auditUserId,
      updated_by: auditUserId
    }));

  const inserts = await Promise.all([
    customerStatusRows.length ? supabase.from("customer_statuses").insert(customerStatusRows) : Promise.resolve({ error: null }),
    itemTypeRows.length ? supabase.from("item_types").insert(itemTypeRows) : Promise.resolve({ error: null }),
    stageRows.length ? supabase.from("stage_master").insert(stageRows) : Promise.resolve({ error: null }),
    workgroupRows.length ? supabase.from("workgroups").insert(workgroupRows) : Promise.resolve({ error: null }),
    paymentModeRows.length ? supabase.from("payment_modes").insert(paymentModeRows) : Promise.resolve({ error: null }),
    expenseCategoryRows.length ? supabase.from("expense_categories").insert(expenseCategoryRows) : Promise.resolve({ error: null })
  ]);

  const failed = inserts.find((result) => result.error);

  if (failed?.error) {
    throw new Error(`Unable to seed defaults: ${failed.error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/item-types");
  revalidatePath("/settings/stages");
  revalidatePath("/settings/customer-statuses");
  revalidatePath("/settings/workgroups");
  revalidatePath("/settings/payment-modes");
  revalidatePath("/settings/expense-categories");
}

export async function createItemTypeAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = itemTypeSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    icon: {
      kind: formData.get("iconKind"),
      emoji: formData.get("iconEmoji"),
      name: formData.get("iconName"),
      color: formData.get("iconColor"),
    },
    defaultSlaDays: getOptionalNumber(formData.get("defaultSlaDays"))
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("item_types").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
    icon_kind: parsed.icon.kind,
    icon_emoji: parsed.icon.emoji,
    icon_name: parsed.icon.name,
    icon_color: parsed.icon.color,
    default_sla_days: parsed.defaultSlaDays ?? null,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings");
      revalidatePath("/settings/item-types");
      return;
    }

    throw new Error(`Unable to create item type: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/item-types");
}

export async function createStageAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = textMasterSchema.extend({ effortTrackingMode: stageEffortModeSchema }).parse({
    name: formData.get("name"),
    description: formData.get("description"),
    effortTrackingMode: formData.get("effortTrackingMode") || "none",
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("stage_master").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
    effort_tracking_mode: parsed.effortTrackingMode,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings");
      revalidatePath("/settings/stages");
      return;
    }

    throw new Error(`Unable to create stage: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/stages");
}

export async function createCustomerStatusAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = customerStatusSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder") || 0,
    isFinalStatus: formData.get("isFinalStatus") === "on"
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("customer_statuses").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
    sort_order: parsed.sortOrder,
    is_final_status: parsed.isFinalStatus,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings");
      revalidatePath("/settings/customer-statuses");
      return;
    }

    throw new Error(`Unable to create customer status: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/customer-statuses");
}

export async function createWorkgroupAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = textMasterSchema.parse({
    name: formData.get("name"),
    description: formData.get("description")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("workgroups").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings");
      revalidatePath("/settings/workgroups");
      return;
    }

    throw new Error(`Unable to create workgroup: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/workgroups");
}

export async function createTenantLocationAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = tenantLocationSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    locationType: formData.get("locationType") || "store",
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2"),
    area: formData.get("area"),
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode"),
    countryCode: formData.get("countryCode") || "IN"
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("tenant_locations").insert({
    tenant_id: context.tenant.id,
    code: parsed.code,
    name: parsed.name,
    location_type: parsed.locationType,
    address_line_1: parsed.addressLine1,
    address_line_2: parsed.addressLine2,
    area: parsed.area,
    city: parsed.city,
    state: parsed.state,
    postal_code: parsed.postalCode,
    country_code: parsed.countryCode,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("A location with this code already exists.");
    }

    throw new Error(`Unable to create location: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/locations");
}

export async function archiveTenantLocationAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = tenantLocationIdSchema.parse({
    locationId: formData.get("locationId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("tenant_locations")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.locationId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive location: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/locations");
  revalidatePath("/settings/teams");
}

async function validateLocationForSettings(tenantId: string, locationId: string | null) {
  if (!locationId) {
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", locationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate location: ${error.message}`);
  }

  if (!data) {
    throw new Error("Location does not belong to this tenant.");
  }
}

async function validateTeamForSettings(tenantId: string, teamId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", teamId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate team: ${error.message}`);
  }

  if (!data) {
    throw new Error("Team does not belong to this tenant.");
  }
}

async function validateTenantUserForSettings(tenantId: string, tenantUserId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("tenant_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", tenantUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate tenant user: ${error.message}`);
  }

  if (!data) {
    throw new Error("Tenant user does not belong to this tenant.");
  }
}

export async function createTeamAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = teamSchema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description"),
    locationId: formData.get("locationId")
  });

  await validateLocationForSettings(context.tenant.id, parsed.locationId);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("teams").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    code: parsed.code,
    description: parsed.description,
    location_id: parsed.locationId,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("A team with this code already exists.");
    }

    throw new Error(`Unable to create team: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/teams");
}

export async function archiveTeamAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = teamIdSchema.parse({
    teamId: formData.get("teamId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("teams")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.teamId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive team: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/teams");
}

export async function addTeamMemberAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = teamMemberSchema.parse({
    teamId: formData.get("teamId"),
    tenantUserId: formData.get("tenantUserId")
  });

  await Promise.all([
    validateTeamForSettings(context.tenant.id, parsed.teamId),
    validateTenantUserForSettings(context.tenant.id, parsed.tenantUserId)
  ]);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("team_members").insert({
    tenant_id: context.tenant.id,
    team_id: parsed.teamId,
    tenant_user_id: parsed.tenantUserId,
    created_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings/teams");
      return;
    }

    throw new Error(`Unable to add team member: ${error.message}`);
  }

  revalidatePath("/settings/teams");
}

export async function removeTeamMemberAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = teamMemberSchema.parse({
    teamId: formData.get("teamId"),
    tenantUserId: formData.get("tenantUserId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("team_members")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("tenant_id", context.tenant.id)
    .eq("team_id", parsed.teamId)
    .eq("tenant_user_id", parsed.tenantUserId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to remove team member: ${error.message}`);
  }

  revalidatePath("/settings/teams");
}

export async function createPaymentModeAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = textMasterSchema.parse({
    name: formData.get("name"),
    description: formData.get("description")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("payment_modes").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings");
      revalidatePath("/settings/payment-modes");
      return;
    }

    throw new Error(`Unable to create payment mode: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/payment-modes");
}

export async function createExpenseCategoryAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = z.object({ name: nameSchema }).parse({
    name: formData.get("name")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("expense_categories").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    is_default: false,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      revalidatePath("/settings");
      revalidatePath("/settings/expense-categories");
      return;
    }

    throw new Error(`Unable to create expense category: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/expense-categories");
}

function normalizeFieldKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseStandardSizeMeasurementData(formData: FormData) {
  const keys = formData.getAll("measurementKeys").map((value) => normalizeFieldKey(String(value)));
  const values = formData.getAll("measurementValues").map((value) => String(value).trim());
  const data: Record<string, string> = {};

  keys.forEach((key, index) => {
    const value = values[index] ?? "";

    if (key && value) {
      data[key] = value;
    }
  });

  return data;
}

async function validateItemTypeForSettings(tenantId: string, itemTypeId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("item_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", itemTypeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate item type: ${error.message}`);
  }

  if (!data) {
    throw new Error("Item type does not belong to this tenant.");
  }
}

async function validateMeasurementKeysForItemType({
  itemTypeId,
  measurementData,
  tenantId
}: {
  itemTypeId: string;
  measurementData: Record<string, string>;
  tenantId: string;
}) {
  const keys = Object.keys(measurementData);

  if (!keys.length) {
    throw new Error("Add at least one dimension value for this size.");
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: fields, error } = await supabase
    .from("item_type_measurement_fields")
    .select("field_key")
    .eq("tenant_id", tenantId)
    .eq("item_type_id", itemTypeId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to validate measurement fields: ${error.message}`);
  }

  const allowedKeys = new Set((fields ?? []).map((field) => field.field_key));
  const invalidKeys = keys.filter((key) => !allowedKeys.has(key));

  if (invalidKeys.length) {
    throw new Error(`These dimensions are not active standards for the selected item type: ${invalidKeys.join(", ")}.`);
  }
}

export async function createMeasurementFieldAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = measurementFieldSchema.parse({
    itemTypeId: formData.get("itemTypeId"),
    fieldKey: formData.get("fieldKey"),
    fieldLabel: formData.get("fieldLabel"),
    unit: formData.get("unit"),
    sortOrder: formData.get("sortOrder") || 0,
    isRequired: formData.get("isRequired") === "on",
    helpText: formData.get("helpText")
  });
  const fieldKey = normalizeFieldKey(parsed.fieldKey);

  if (!fieldKey) {
    throw new Error("Field key must include at least one letter or number.");
  }

  await validateItemTypeForSettings(context.tenant.id, parsed.itemTypeId);

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("item_type_measurement_fields").insert({
    tenant_id: context.tenant.id,
    item_type_id: parsed.itemTypeId,
    field_key: fieldKey,
    field_label: parsed.fieldLabel,
    unit: parsed.unit,
    sort_order: parsed.sortOrder,
    is_required: parsed.isRequired,
    help_text: parsed.helpText,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This field key already exists for the selected item type.");
    }

    throw new Error(`Unable to create measurement field: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/measurement-standards");
}

export async function updateMeasurementFieldAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = updateMeasurementFieldSchema.parse({
    fieldId: formData.get("fieldId"),
    itemTypeId: formData.get("itemTypeId"),
    fieldKey: formData.get("fieldKey"),
    fieldLabel: formData.get("fieldLabel"),
    unit: formData.get("unit"),
    sortOrder: formData.get("sortOrder") || 0,
    isRequired: formData.get("isRequired") === "on",
    isActive: formData.get("isActive") === "on",
    helpText: formData.get("helpText")
  });
  const fieldKey = normalizeFieldKey(parsed.fieldKey);

  if (!fieldKey) {
    throw new Error("Field key must include at least one letter or number.");
  }

  await validateItemTypeForSettings(context.tenant.id, parsed.itemTypeId);

  const supabase = createSupabaseServiceRoleClient();
  const existing = await supabase
    .from("item_type_measurement_fields")
    .select("id, item_type_id, field_key")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.fieldId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing.error) throw new Error(`Unable to load measurement field: ${existing.error.message}`);
  if (!existing.data) throw new Error("Measurement field does not belong to this tenant.");
  if (existing.data.item_type_id !== parsed.itemTypeId || existing.data.field_key !== fieldKey) {
    throw new Error("MEASUREMENT_FIELD_IDENTITY_IMMUTABLE: Field key and item type cannot change after creation. Create a new field instead.");
  }

  const { data, error } = await supabase
    .from("item_type_measurement_fields")
    .update({
      field_label: parsed.fieldLabel,
      unit: parsed.unit,
      sort_order: parsed.sortOrder,
      is_required: parsed.isRequired,
      is_active: parsed.isActive,
      help_text: parsed.helpText,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.fieldId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This field key already exists for the selected item type.");
    }

    throw new Error(`Unable to update measurement field: ${error.message}`);
  }
  if (!data) throw new Error("Measurement field does not belong to this tenant.");

  revalidatePath("/settings");
  revalidatePath("/settings/measurement-standards");
}

export async function archiveMeasurementFieldAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = measurementFieldIdSchema.parse({
    fieldId: formData.get("fieldId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("item_type_measurement_fields")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.fieldId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive measurement field: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/measurement-standards");
}

export async function createStandardSizeAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = standardSizeSchema.parse({
    itemTypeId: formData.get("itemTypeId"),
    sizeLabel: formData.get("sizeLabel"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: true,
    measurementData: parseStandardSizeMeasurementData(formData)
  });

  await validateItemTypeForSettings(context.tenant.id, parsed.itemTypeId);
  await validateMeasurementKeysForItemType({
    itemTypeId: parsed.itemTypeId,
    measurementData: parsed.measurementData,
    tenantId: context.tenant.id
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("item_type_standard_sizes").insert({
    tenant_id: context.tenant.id,
    item_type_id: parsed.itemTypeId,
    size_label: parsed.sizeLabel,
    measurement_data_json: parsed.measurementData as Json,
    sort_order: parsed.sortOrder,
    is_active: true,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This size name already exists for the selected item type.");
    }

    throw new Error(`Unable to create standard size: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/measurement-standards");
}

export async function updateStandardSizeAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = updateStandardSizeSchema.parse({
    standardSizeId: formData.get("standardSizeId"),
    itemTypeId: formData.get("itemTypeId"),
    sizeLabel: formData.get("sizeLabel"),
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
    measurementData: parseStandardSizeMeasurementData(formData)
  });

  await validateItemTypeForSettings(context.tenant.id, parsed.itemTypeId);
  await validateMeasurementKeysForItemType({
    itemTypeId: parsed.itemTypeId,
    measurementData: parsed.measurementData,
    tenantId: context.tenant.id
  });

  const supabase = createSupabaseServiceRoleClient();
  const existing = await supabase
    .from("item_type_standard_sizes")
    .select("id, item_type_id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.standardSizeId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing.error) throw new Error(`Unable to load standard size: ${existing.error.message}`);
  if (!existing.data) throw new Error("Standard size does not belong to this tenant.");
  if (existing.data.item_type_id !== parsed.itemTypeId) {
    throw new Error("STANDARD_SIZE_ITEM_TYPE_IMMUTABLE: Item type cannot change after a standard size is created. Create a new size instead.");
  }

  const { data, error } = await supabase
    .from("item_type_standard_sizes")
    .update({
      size_label: parsed.sizeLabel,
      measurement_data_json: parsed.measurementData as Json,
      sort_order: parsed.sortOrder,
      is_active: parsed.isActive,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.standardSizeId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This size name already exists for the selected item type.");
    }

    throw new Error(`Unable to update standard size: ${error.message}`);
  }
  if (!data) throw new Error("Standard size does not belong to this tenant.");

  revalidatePath("/settings");
  revalidatePath("/settings/measurement-standards");
}

export async function archiveStandardSizeAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = standardSizeIdSchema.parse({
    standardSizeId: formData.get("standardSizeId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("item_type_standard_sizes")
    .update({
      deleted_at: new Date().toISOString(),
      is_active: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.standardSizeId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive standard size: ${error.message}`);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/measurement-standards");
}

export async function updateItemTypeAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = itemTypeSchema.extend({ itemTypeId: z.string().uuid() }).merge(activeFlagSchema).parse({
    itemTypeId: formData.get("itemTypeId"), name: formData.get("name"), description: formData.get("description"),
    icon: {
      kind: formData.get("iconKind"),
      emoji: formData.get("iconEmoji"),
      name: formData.get("iconName"),
      color: formData.get("iconColor"),
    },
    defaultSlaDays: getOptionalNumber(formData.get("defaultSlaDays")), isActive: formData.get("isActive") === "on"
  });
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("item_types").update({ name: parsed.name, description: parsed.description, icon_kind: parsed.icon.kind, icon_emoji: parsed.icon.emoji, icon_name: parsed.icon.name, icon_color: parsed.icon.color, default_sla_days: parsed.defaultSlaDays ?? null, is_active: parsed.isActive, updated_by: context.membership.clerk_user_id }).eq("tenant_id", context.tenant.id).eq("id", parsed.itemTypeId).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new Error(isUniqueConstraintError(error) ? "An item type with this name already exists." : `Unable to update item type: ${error.message}`);
  if (!data) throw new Error("Item type does not belong to this tenant.");
  revalidatePath("/settings"); revalidatePath("/settings/item-types"); revalidatePath("/settings/measurement-standards");
}

async function updateTextMaster(formData: FormData, kind: "workgroup" | "paymentMode") {
  const context = await getAuthorizedSettingsContext();
  const idField = kind === "workgroup" ? "workgroupId" : "paymentModeId";
  const parsed = textMasterSchema.extend({ recordId: z.string().uuid() }).merge(activeFlagSchema).parse({ recordId: formData.get(idField), name: formData.get("name"), description: formData.get("description"), isActive: formData.get("isActive") === "on" });
  const update = { name: parsed.name, description: parsed.description, is_active: parsed.isActive, updated_by: context.membership.clerk_user_id };
  const supabase = createSupabaseServiceRoleClient();
  const result = kind === "workgroup"
    ? await supabase.from("workgroups").update(update).eq("tenant_id", context.tenant.id).eq("id", parsed.recordId).is("deleted_at", null).select("id").maybeSingle()
    : await supabase.from("payment_modes").update(update).eq("tenant_id", context.tenant.id).eq("id", parsed.recordId).is("deleted_at", null).select("id").maybeSingle();
  if (result.error) throw new Error(isUniqueConstraintError(result.error) ? "A record with this name already exists." : `Unable to update configuration: ${result.error.message}`);
  if (!result.data) throw new Error("Configuration record does not belong to this tenant.");
  revalidatePath("/settings"); revalidatePath(kind === "workgroup" ? "/settings/workgroups" : "/settings/payment-modes");
}

export async function updateStageAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = textMasterSchema.extend({ stageId: z.string().uuid(), effortTrackingMode: stageEffortModeSchema }).merge(activeFlagSchema).parse({
    stageId: formData.get("stageId"), name: formData.get("name"), description: formData.get("description"), isActive: formData.get("isActive") === "on",
    effortTrackingMode: formData.get("effortTrackingMode") || "none",
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("update_stage_configuration_with_effort", {
    p_tenant_id: context.tenant.id,
    p_stage_id: parsed.stageId,
    p_name: parsed.name,
    p_description: parsed.description,
    p_is_active: parsed.isActive,
    p_effort_tracking_mode: parsed.effortTrackingMode,
    p_actor_id: context.membership.clerk_user_id
  });
  if (error) {
    throw new Error(
      isUniqueConstraintError(error) ? "A stage with this name already exists."
        : error.message.includes("STAGE_REQUIRED_BY_ACTIVE_WORKFLOW") ? "This stage is the last active stage in an active workflow. Replace that workflow sequence before deactivating it."
          : error.message.includes("STAGE_EFFORT_MODE_HAS_INCOMPATIBLE_RULES") ? "Update this stage's item-type contribution rules before changing its effort mode."
          : error.message.includes("STAGE_NOT_FOUND") ? "Stage does not belong to this tenant."
            : `Unable to update stage: ${error.message}`
    );
  }
  revalidatePath("/settings"); revalidatePath("/settings/stages"); revalidatePath("/settings/workflows");
}

export async function updateItemTypeStageContributionRuleAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = z.object({
    itemTypeId: z.string().uuid(),
    stageId: z.string().uuid(),
    ruleSelection: contributionRuleSelectionSchema,
    rateValue: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value : null),
      z.coerce.number().positive().max(1000000).nullable(),
    ),
  }).superRefine((value, issueContext) => {
    if (value.ruleSelection !== "none" && value.rateValue === null) {
      issueContext.addIssue({ code: "custom", message: "Add a contribution rate.", path: ["rateValue"] });
    }
    if (value.ruleSelection.startsWith("percentage") && value.rateValue !== null && value.rateValue > 100) {
      issueContext.addIssue({ code: "custom", message: "Percentage cannot exceed 100.", path: ["rateValue"] });
    }
  }).parse({
    itemTypeId: formData.get("itemTypeId"),
    stageId: formData.get("stageId"),
    ruleSelection: formData.get("ruleSelection") || "none",
    rateValue: formData.get("rateValue"),
  });
  const method: ItemStageContributionMethod | null = parsed.ruleSelection === "none"
    ? null
    : parsed.ruleSelection === "per_unit" || parsed.ruleSelection === "per_hour"
      ? parsed.ruleSelection
      : "percentage";
  const allocationBasis: ContributionAllocationBasis | null = parsed.ruleSelection.endsWith("units") || parsed.ruleSelection === "per_unit"
    ? "units"
    : parsed.ruleSelection.endsWith("hours") || parsed.ruleSelection === "per_hour"
      ? "hours"
      : null;
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.rpc("upsert_item_type_stage_contribution_rule", {
    p_tenant_id: context.tenant.id,
    p_item_type_id: parsed.itemTypeId,
    p_stage_id: parsed.stageId,
    p_calculation_method: method,
    p_rate_value: method ? parsed.rateValue : null,
    p_percentage_allocation_basis: method ? allocationBasis : null,
    p_actor_id: context.membership.clerk_user_id,
  });
  if (error) {
    throw new Error(
      error.message.includes("ITEM_TYPE_NOT_FOUND") ? "Item type does not belong to this tenant or is inactive."
        : error.message.includes("STAGE_NOT_FOUND") ? "Stage does not belong to this tenant or is inactive."
          : error.message.includes("RULE_INCOMPATIBLE_WITH_STAGE_EFFORT_MODE") ? "This calculation does not match the stage effort mode. Update the stage or choose a compatible rule."
            : error.message.includes("INVALID_CONTRIBUTION_RATE") ? "Add a valid positive rate; percentages cannot exceed 100."
              : `Unable to save contribution rule: ${error.message}`,
    );
  }
  revalidatePath("/settings");
  revalidatePath("/settings/item-types");
  revalidatePath(`/settings/item-types/${parsed.itemTypeId}/contributions`);
  revalidatePath("/production");
}
export async function updateWorkgroupAction(formData: FormData) { await updateTextMaster(formData, "workgroup"); }
export async function updatePaymentModeAction(formData: FormData) { await updateTextMaster(formData, "paymentMode"); }

export async function updateCustomerStatusAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = customerStatusSchema.extend({ customerStatusId: z.string().uuid() }).merge(activeFlagSchema).parse({ customerStatusId: formData.get("customerStatusId"), name: formData.get("name"), description: formData.get("description"), sortOrder: formData.get("sortOrder") || 0, isFinalStatus: formData.get("isFinalStatus") === "on", isActive: formData.get("isActive") === "on" });
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("customer_statuses").update({ name: parsed.name, description: parsed.description, sort_order: parsed.sortOrder, is_final_status: parsed.isFinalStatus, is_active: parsed.isActive, updated_by: context.membership.clerk_user_id }).eq("tenant_id", context.tenant.id).eq("id", parsed.customerStatusId).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new Error(isUniqueConstraintError(error) ? "A customer status with this name already exists." : `Unable to update customer status: ${error.message}`);
  if (!data) throw new Error("Customer status does not belong to this tenant.");
  revalidatePath("/settings"); revalidatePath("/settings/customer-statuses");
}

export async function updateExpenseCategoryAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = z.object({ expenseCategoryId: z.string().uuid(), name: nameSchema }).merge(activeFlagSchema).parse({ expenseCategoryId: formData.get("expenseCategoryId"), name: formData.get("name"), isActive: formData.get("isActive") === "on" });
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("expense_categories").update({ name: parsed.name, is_active: parsed.isActive, updated_by: context.membership.clerk_user_id }).eq("tenant_id", context.tenant.id).eq("id", parsed.expenseCategoryId).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new Error(isUniqueConstraintError(error) ? "An expense category with this name already exists." : `Unable to update expense category: ${error.message}`);
  if (!data) throw new Error("Expense category does not belong to this tenant.");
  revalidatePath("/settings"); revalidatePath("/settings/expense-categories"); revalidatePath("/finance");
}

export async function updateTenantLocationAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = tenantLocationSchema.extend({ locationId: z.string().uuid() }).merge(activeFlagSchema).parse({ locationId: formData.get("locationId"), code: formData.get("code"), name: formData.get("name"), locationType: formData.get("locationType") || "store", addressLine1: formData.get("addressLine1"), addressLine2: formData.get("addressLine2"), area: formData.get("area"), city: formData.get("city"), state: formData.get("state"), postalCode: formData.get("postalCode"), countryCode: formData.get("countryCode") || "IN", isActive: formData.get("isActive") === "on" });
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("tenant_locations").update({ code: parsed.code, name: parsed.name, location_type: parsed.locationType, address_line_1: parsed.addressLine1, address_line_2: parsed.addressLine2, area: parsed.area, city: parsed.city, state: parsed.state, postal_code: parsed.postalCode, country_code: parsed.countryCode, is_active: parsed.isActive, updated_by: context.membership.clerk_user_id }).eq("tenant_id", context.tenant.id).eq("id", parsed.locationId).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new Error(isUniqueConstraintError(error) ? "A location with this code already exists." : `Unable to update location: ${error.message}`);
  if (!data) throw new Error("Location does not belong to this tenant.");
  revalidatePath("/settings"); revalidatePath("/settings/locations"); revalidatePath("/settings/teams");
}

export async function updateTeamAction(formData: FormData) {
  const context = await getAuthorizedSettingsContext();
  const parsed = teamSchema.extend({ teamId: z.string().uuid() }).merge(activeFlagSchema).parse({ teamId: formData.get("teamId"), name: formData.get("name"), code: formData.get("code"), description: formData.get("description"), locationId: formData.get("locationId"), isActive: formData.get("isActive") === "on" });
  await validateLocationForSettings(context.tenant.id, parsed.locationId);
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.from("teams").update({ name: parsed.name, code: parsed.code, description: parsed.description, location_id: parsed.locationId, is_active: parsed.isActive, updated_by: context.membership.clerk_user_id }).eq("tenant_id", context.tenant.id).eq("id", parsed.teamId).is("deleted_at", null).select("id").maybeSingle();
  if (error) throw new Error(isUniqueConstraintError(error) ? "A team with this code already exists." : `Unable to update team: ${error.message}`);
  if (!data) throw new Error("Team does not belong to this tenant.");
  revalidatePath("/settings"); revalidatePath("/settings/teams");
}
