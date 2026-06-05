"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTenantLogoFile, uploadTenantLogo } from "@/lib/tenant/assets";
import { requireTenantContext } from "@/lib/tenant/context";
import {
  defaultCustomerStatuses,
  defaultExpenseCategories,
  defaultItemTypes,
  defaultPaymentModes,
  defaultStages,
  defaultWorkgroups
} from "@/features/settings/defaults";
import type { Json } from "@/types/database";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const nameSchema = z.string().trim().min(2, "Name is required.");

const optionalProfileText = z.preprocess((value) => (typeof value === "string" && value.trim() ? value : null), z.string().trim().nullable());

const gstinSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null),
  z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Add a valid GSTIN or leave it blank.")
    .nullable()
);

const businessProfileSchema = z.object({
  name: z.string().trim().min(2, "Business name is required."),
  storeName: z.string().trim().min(2, "Store name is required."),
  brandColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color such as #2563eb."),
  legalName: optionalProfileText,
  registeredAddress: optionalProfileText,
  gstRegistered: z.boolean().default(false),
  gstin: gstinSchema,
  defaultSalesGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultPurchaseGstRate: z.coerce.number().min(0).max(100).default(0),
  defaultOrderGstTreatment: z.enum(["taxable_exclusive", "taxable_inclusive", "exempt_or_nil", "non_gst", "not_applicable"]).default("not_applicable"),
  defaultExpenseGstTreatment: z.enum(["taxable_exclusive", "taxable_inclusive", "exempt_or_nil", "non_gst", "not_applicable"]).default("not_applicable")
});

const itemTypeSchema = z.object({
  name: nameSchema,
  description: optionalText,
  defaultSlaDays: z.coerce.number().int().min(0).optional()
});

const textMasterSchema = z.object({
  name: nameSchema,
  description: optionalText
});

const customerStatusSchema = z.object({
  name: nameSchema,
  description: optionalText,
  sortOrder: z.coerce.number().int().min(0).default(0),
  isFinalStatus: z.boolean().default(false)
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
  const parsed = businessProfileSchema.parse({
    name: formData.get("name"),
    storeName: formData.get("storeName"),
    brandColor: formData.get("brandColor"),
    legalName: formData.get("legalName"),
    registeredAddress: formData.get("registeredAddress"),
    gstRegistered: formData.get("gstRegistered") === "on",
    gstin: formData.get("gstin"),
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
    defaultSlaDays: getOptionalNumber(formData.get("defaultSlaDays"))
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("item_types").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
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
  const parsed = textMasterSchema.parse({
    name: formData.get("name"),
    description: formData.get("description")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("stage_master").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    description: parsed.description,
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
  const { error } = await supabase
    .from("item_type_measurement_fields")
    .update({
      item_type_id: parsed.itemTypeId,
      field_key: fieldKey,
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
    .is("deleted_at", null);

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This field key already exists for the selected item type.");
    }

    throw new Error(`Unable to update measurement field: ${error.message}`);
  }

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
  const { error } = await supabase
    .from("item_type_standard_sizes")
    .update({
      item_type_id: parsed.itemTypeId,
      size_label: parsed.sizeLabel,
      measurement_data_json: parsed.measurementData as Json,
      sort_order: parsed.sortOrder,
      is_active: parsed.isActive,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.standardSizeId)
    .is("deleted_at", null);

  if (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("This size name already exists for the selected item type.");
    }

    throw new Error(`Unable to update standard size: ${error.message}`);
  }

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
