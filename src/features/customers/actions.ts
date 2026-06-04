"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { CustomerGender, Json } from "@/types/database";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const genderSchema = z.enum(["female", "male", "other", "not_specified"]).nullable();

const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required."),
  phone: optionalText,
  email: optionalText.pipe(z.string().email().nullable()).or(z.null()),
  gender: genderSchema,
  address: optionalText,
  notes: optionalText
});

const createMeasurementSchema = z.object({
  customerId: z.string().uuid(),
  itemTypeId: optionalText,
  referenceName: optionalText,
  notes: optionalText,
  photoUrl: optionalText,
  isDefault: z.boolean(),
  measurementData: z.record(z.string().min(1), z.string())
});

const updateCustomerSchema = createCustomerSchema.extend({
  customerId: z.string().uuid()
});

const measurementIdSchema = z.object({
  customerId: z.string().uuid(),
  measurementId: z.string().uuid()
});

const updateMeasurementSchema = createMeasurementSchema.extend({
  measurementId: z.string().uuid()
});

async function getAuthorizedCustomerContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "customers:manage");
  return context;
}

function parseGender(value: FormDataEntryValue | null) {
  const gender = String(value ?? "").trim();
  return gender ? gender : null;
}

function parseMeasurementData(formData: FormData) {
  const keys = formData.getAll("measurementKeys").map((value) => String(value).trim());
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

async function assertRequiredMeasurementFields({
  itemTypeId,
  measurementData,
  supabase,
  tenantId
}: {
  itemTypeId: string | null;
  measurementData: Record<string, string>;
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  tenantId: string;
}) {
  if (!itemTypeId) {
    return;
  }

  const { data: requiredFields, error } = await supabase
    .from("item_type_measurement_fields")
    .select("field_key, field_label")
    .eq("tenant_id", tenantId)
    .eq("item_type_id", itemTypeId)
    .eq("is_active", true)
    .eq("is_required", true)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to validate measurement standards: ${error.message}`);
  }

  const missingFields = (requiredFields ?? []).filter((field) => !measurementData[field.field_key]?.trim());

  if (missingFields.length) {
    throw new Error(`Required measurement fields missing: ${missingFields.map((field) => field.field_label).join(", ")}.`);
  }
}

export async function createCustomerAction(formData: FormData) {
  const context = await getAuthorizedCustomerContext();
  const parsed = createCustomerSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    gender: parseGender(formData.get("gender")),
    address: formData.get("address"),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: context.tenant.id,
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      gender: parsed.gender as CustomerGender | null,
      address: parsed.address,
      notes: parsed.notes,
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Unable to create customer: ${error.message}`);
  }

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(formData: FormData) {
  const context = await getAuthorizedCustomerContext();
  const parsed = updateCustomerSchema.parse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    gender: parseGender(formData.get("gender")),
    address: formData.get("address"),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (customerError) {
    throw new Error(`Unable to validate customer: ${customerError.message}`);
  }

  if (!customer) {
    throw new Error("Customer does not belong to this tenant.");
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      gender: parsed.gender as CustomerGender | null,
      address: parsed.address,
      notes: parsed.notes,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.customerId);

  if (error) {
    throw new Error(`Unable to update customer: ${error.message}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
}

export async function createCustomerMeasurementAction(formData: FormData) {
  const context = await getAuthorizedCustomerContext();
  const parsed = createMeasurementSchema.parse({
    customerId: formData.get("customerId"),
    itemTypeId: formData.get("itemTypeId"),
    referenceName: formData.get("referenceName"),
    notes: formData.get("notes"),
    photoUrl: formData.get("photoUrl"),
    isDefault: formData.get("isDefault") === "on",
    measurementData: parseMeasurementData(formData)
  });

  const supabase = createSupabaseServiceRoleClient();
  const [customer, itemType] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.customerId)
      .is("deleted_at", null)
      .maybeSingle(),
    parsed.itemTypeId
      ? supabase
          .from("item_types")
          .select("id")
          .eq("tenant_id", context.tenant.id)
          .eq("id", parsed.itemTypeId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (customer.error) {
    throw new Error(`Unable to validate customer: ${customer.error.message}`);
  }

  if (!customer.data) {
    throw new Error("Customer does not belong to this tenant.");
  }

  if (itemType.error) {
    throw new Error(`Unable to validate item type: ${itemType.error.message}`);
  }

  if (parsed.itemTypeId && !itemType.data) {
    throw new Error("Selected item type does not belong to this tenant.");
  }

  await assertRequiredMeasurementFields({
    itemTypeId: parsed.itemTypeId,
    measurementData: parsed.measurementData,
    supabase,
    tenantId: context.tenant.id
  });

  if (parsed.isDefault) {
    await clearDefaultMeasurementForScope({
      customerId: parsed.customerId,
      itemTypeId: parsed.itemTypeId,
      supabase,
      tenantId: context.tenant.id,
      updatedBy: context.membership.clerk_user_id
    });
  }

  const { error } = await supabase.from("customer_measurements").insert({
    tenant_id: context.tenant.id,
    customer_id: parsed.customerId,
    item_type_id: parsed.itemTypeId,
    reference_name: parsed.referenceName,
    measurement_data_json: parsed.measurementData as Json,
    notes: parsed.notes,
    photo_url: parsed.photoUrl,
    is_default: parsed.isDefault,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (error) {
    throw new Error(`Unable to add measurement: ${error.message}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
}

export async function updateCustomerMeasurementAction(formData: FormData) {
  const context = await getAuthorizedCustomerContext();
  const parsed = updateMeasurementSchema.parse({
    customerId: formData.get("customerId"),
    measurementId: formData.get("measurementId"),
    itemTypeId: formData.get("itemTypeId"),
    referenceName: formData.get("referenceName"),
    notes: formData.get("notes"),
    photoUrl: formData.get("photoUrl"),
    isDefault: formData.get("isDefault") === "on",
    measurementData: parseMeasurementData(formData)
  });

  const supabase = createSupabaseServiceRoleClient();
  const [customer, itemType, measurement] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.customerId)
      .is("deleted_at", null)
      .maybeSingle(),
    parsed.itemTypeId
      ? supabase
          .from("item_types")
          .select("id")
          .eq("tenant_id", context.tenant.id)
          .eq("id", parsed.itemTypeId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("customer_measurements")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("customer_id", parsed.customerId)
      .eq("id", parsed.measurementId)
      .is("deleted_at", null)
      .maybeSingle()
  ]);

  if (customer.error) {
    throw new Error(`Unable to validate customer: ${customer.error.message}`);
  }

  if (!customer.data) {
    throw new Error("Customer does not belong to this tenant.");
  }

  if (itemType.error) {
    throw new Error(`Unable to validate item type: ${itemType.error.message}`);
  }

  if (parsed.itemTypeId && !itemType.data) {
    throw new Error("Selected item type does not belong to this tenant.");
  }

  if (measurement.error) {
    throw new Error(`Unable to validate measurement: ${measurement.error.message}`);
  }

  if (!measurement.data) {
    throw new Error("Measurement does not belong to this customer.");
  }

  await assertRequiredMeasurementFields({
    itemTypeId: parsed.itemTypeId,
    measurementData: parsed.measurementData,
    supabase,
    tenantId: context.tenant.id
  });

  if (parsed.isDefault) {
    await clearDefaultMeasurementForScope({
      customerId: parsed.customerId,
      itemTypeId: parsed.itemTypeId,
      supabase,
      tenantId: context.tenant.id,
      updatedBy: context.membership.clerk_user_id
    });
  }

  const { error } = await supabase
    .from("customer_measurements")
    .update({
      item_type_id: parsed.itemTypeId,
      reference_name: parsed.referenceName,
      measurement_data_json: parsed.measurementData as Json,
      notes: parsed.notes,
      photo_url: parsed.photoUrl,
      is_default: parsed.isDefault,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("customer_id", parsed.customerId)
    .eq("id", parsed.measurementId);

  if (error) {
    throw new Error(`Unable to update measurement: ${error.message}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
}

export async function setDefaultCustomerMeasurementAction(formData: FormData) {
  const context = await getAuthorizedCustomerContext();
  const parsed = measurementIdSchema.parse({
    customerId: formData.get("customerId"),
    measurementId: formData.get("measurementId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { data: measurement, error: measurementError } = await supabase
    .from("customer_measurements")
    .select("id, item_type_id")
    .eq("tenant_id", context.tenant.id)
    .eq("customer_id", parsed.customerId)
    .eq("id", parsed.measurementId)
    .is("deleted_at", null)
    .maybeSingle();

  if (measurementError) {
    throw new Error(`Unable to validate measurement: ${measurementError.message}`);
  }

  if (!measurement) {
    throw new Error("Measurement does not belong to this customer.");
  }

  await clearDefaultMeasurementForScope({
    customerId: parsed.customerId,
    itemTypeId: measurement.item_type_id,
    supabase,
    tenantId: context.tenant.id,
    updatedBy: context.membership.clerk_user_id
  });

  const { error } = await supabase
    .from("customer_measurements")
    .update({
      is_default: true,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("customer_id", parsed.customerId)
    .eq("id", parsed.measurementId);

  if (error) {
    throw new Error(`Unable to set default measurement: ${error.message}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
}

export async function archiveCustomerMeasurementAction(formData: FormData) {
  const context = await getAuthorizedCustomerContext();
  const parsed = measurementIdSchema.parse({
    customerId: formData.get("customerId"),
    measurementId: formData.get("measurementId")
  });
  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("customer_measurements")
    .update({
      deleted_at: new Date().toISOString(),
      is_default: false,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("customer_id", parsed.customerId)
    .eq("id", parsed.measurementId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive measurement: ${error.message}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
}

async function clearDefaultMeasurementForScope({
  customerId,
  itemTypeId,
  supabase,
  tenantId,
  updatedBy
}: {
  customerId: string;
  itemTypeId: string | null;
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
  tenantId: string;
  updatedBy: string;
}) {
  let clearDefaultQuery = supabase
    .from("customer_measurements")
    .update({
      is_default: false,
      updated_by: updatedBy
    })
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .is("deleted_at", null);

  clearDefaultQuery = itemTypeId ? clearDefaultQuery.eq("item_type_id", itemTypeId) : clearDefaultQuery.is("item_type_id", null);

  const { error } = await clearDefaultQuery;

  if (error) {
    throw new Error(`Unable to update default measurements: ${error.message}`);
  }
}
