import { NextResponse } from "next/server";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/context";
import type { Json } from "@/types/database";

const quickCreateMeasurementSchema = z.object({
  customerId: z.string().uuid(),
  itemTypeId: z.string().uuid().nullable(),
  referenceName: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
  isDefault: z.boolean(),
  measurementData: z.record(z.string().min(1), z.string().trim().min(1))
});

function cleanOptionalText(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

async function clearDefaultMeasurementForScope({
  customerId,
  itemTypeId,
  tenantId,
  updatedBy
}: {
  customerId: string;
  itemTypeId: string | null;
  tenantId: string;
  updatedBy: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  let query = supabase
    .from("customer_measurements")
    .update({
      is_default: false,
      updated_by: updatedBy
    })
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .is("deleted_at", null);

  query = itemTypeId ? query.eq("item_type_id", itemTypeId) : query.is("item_type_id", null);

  const { error } = await query;

  if (error) {
    throw new Error(`Unable to update default measurements: ${error.message}`);
  }
}

async function assertRequiredMeasurementFields({
  itemTypeId,
  measurementData,
  tenantId
}: {
  itemTypeId: string | null;
  measurementData: Record<string, string>;
  tenantId: string;
}) {
  if (!itemTypeId) {
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
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

export async function POST(request: Request) {
  const context = await getTenantContext();

  if (!context) {
    return NextResponse.json({ error: "Tenant context is required." }, { status: 401 });
  }

  try {
    assertPermission(context.membership.role, "customers:manage");
    const body = await request.json();
    const parsed = quickCreateMeasurementSchema.parse(body);
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
      return NextResponse.json({ error: "Customer does not belong to this tenant." }, { status: 404 });
    }

    if (itemType.error) {
      throw new Error(`Unable to validate item type: ${itemType.error.message}`);
    }

    if (parsed.itemTypeId && !itemType.data) {
      return NextResponse.json({ error: "Item type does not belong to this tenant." }, { status: 404 });
    }

    await assertRequiredMeasurementFields({
      itemTypeId: parsed.itemTypeId,
      measurementData: parsed.measurementData,
      tenantId: context.tenant.id
    });

    if (parsed.isDefault) {
      await clearDefaultMeasurementForScope({
        customerId: parsed.customerId,
        itemTypeId: parsed.itemTypeId,
        tenantId: context.tenant.id,
        updatedBy: context.membership.clerk_user_id
      });
    }

    const { data: measurement, error } = await supabase
      .from("customer_measurements")
      .insert({
        tenant_id: context.tenant.id,
        customer_id: parsed.customerId,
        item_type_id: parsed.itemTypeId,
        reference_name: cleanOptionalText(parsed.referenceName),
        measurement_data_json: parsed.measurementData as Json,
        notes: cleanOptionalText(parsed.notes),
        is_default: parsed.isDefault,
        created_by: context.membership.clerk_user_id,
        updated_by: context.membership.clerk_user_id
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Unable to add measurement: ${error.message}`);
    }

    return NextResponse.json({ measurement });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map((issue) => issue.message).join(" ") }, { status: 400 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Something went wrong." }, { status: 400 });
  }
}
