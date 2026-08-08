"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createUserCommandContext } from "@/core/command-context/server";
import { normalizeIdempotencyKey } from "@/core/idempotency/types";
import { assertTenantVertical } from "@/features/verticals/queries";
import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { Json, LaundryContainerType, LaundryHandlingUnitType, LaundryPickupSource, LaundryServiceQuantityUnit } from "@/types/database";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
);

const laundryPickupSourceSchema = z.enum(["whatsapp", "call", "manual", "web", "recurring", "other"]);
const laundryContainerTypeSchema = z.enum(["bag", "cover", "box", "other"]);
const laundryHandlingUnitTypeSchema = z.enum(["bag", "cover", "shoe_packet", "carpet", "curtain_bundle", "other"]);
const quantityUnitSchema = z.enum(["kg", "piece", "pair", "unit", "sq_ft", "other"]);

const createPickupSchema = z.object({
  customerId: z.string().uuid(),
  pickupAddressId: optionalText,
  requestedDate: z.string().min(1),
  requestedWindow: z.string().trim().min(1, "Requested window is required."),
  pickupSource: laundryPickupSourceSchema.default("manual"),
  assignedUserId: optionalText,
  assignedTeamId: optionalText,
  scheduledAt: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText
});

const completePickupSchema = z.object({
  pickupRequestId: z.string().uuid(),
  handlingUnitType: laundryHandlingUnitTypeSchema.default("bag"),
  currentLocationId: optionalText,
  containerAssetId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText
});

const createContainerSchema = z.object({
  containerCode: optionalText,
  containerType: laundryContainerTypeSchema.default("bag"),
  assignedCustomerId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText
});

const createServiceSchema = z.object({
  name: z.string().trim().min(1, "Service name is required."),
  code: z.string().trim().min(1, "Service code is required."),
  description: optionalText,
  defaultWorkflowId: z.string().uuid(),
  defaultSlaHours: optionalText,
  defaultQuantityUnit: quantityUnitSchema.default("unit"),
  allowsWeight: z.boolean().default(false),
  allowsPieceCount: z.boolean().default(false)
});

const createServiceLotSchema = z.object({
  handlingUnitId: z.string().uuid(),
  orderId: z.string().uuid(),
  serviceCatalogId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  quantityUnit: quantityUnitSchema.default("unit"),
  pieceCount: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().nonnegative().nullable()),
  weightKg: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().nonnegative().nullable()),
  specialInstructions: optionalText,
  displayCode: optionalText,
  idempotencyKey: optionalText
});

function parseCommandResult(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Command returned an invalid result.");
  }

  return value;
}

async function getAuthorizedLaundryContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "laundry:manage");
  await assertTenantVertical(context, "laundry");
  return context;
}

function toIsoDateTime(value: string | null) {
  return value ? new Date(value).toISOString() : null;
}

export async function createLaundryPickupRequestAction(formData: FormData) {
  const context = await getAuthorizedLaundryContext();
  const parsed = createPickupSchema.parse({
    customerId: formData.get("customerId"),
    pickupAddressId: formData.get("pickupAddressId"),
    requestedDate: formData.get("requestedDate"),
    requestedWindow: formData.get("requestedWindow"),
    pickupSource: formData.get("pickupSource") || "manual",
    assignedUserId: formData.get("assignedUserId"),
    assignedTeamId: formData.get("assignedTeamId"),
    scheduledAt: formData.get("scheduledAt"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc("create_laundry_pickup_request_command", {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_customer_id: parsed.customerId,
    p_pickup_address_id: parsed.pickupAddressId,
    p_requested_date: parsed.requestedDate,
    p_requested_window: parsed.requestedWindow,
    p_pickup_source: parsed.pickupSource as LaundryPickupSource,
    p_assigned_user_id: parsed.assignedUserId,
    p_assigned_team_id: parsed.assignedTeamId,
    p_scheduled_at: toIsoDateTime(parsed.scheduledAt),
    p_notes: parsed.notes
  });

  if (result.error) {
    throw new Error(`Unable to create pickup request: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/laundry/custody");
}

export async function completeLaundryPickupRequestAction(formData: FormData) {
  const context = await getAuthorizedLaundryContext();
  const parsed = completePickupSchema.parse({
    pickupRequestId: formData.get("pickupRequestId"),
    handlingUnitType: formData.get("handlingUnitType") || "bag",
    currentLocationId: formData.get("currentLocationId"),
    containerAssetId: formData.get("containerAssetId"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc("complete_laundry_pickup_request_command", {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_pickup_request_id: parsed.pickupRequestId,
    p_handling_unit_type: parsed.handlingUnitType as LaundryHandlingUnitType,
    p_current_location_id: parsed.currentLocationId,
    p_container_asset_id: parsed.containerAssetId,
    p_notes: parsed.notes
  });

  if (result.error) {
    throw new Error(`Unable to complete pickup request: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/laundry/custody");
}

export async function createLaundryContainerAssetAction(formData: FormData) {
  const context = await getAuthorizedLaundryContext();
  const parsed = createContainerSchema.parse({
    containerCode: formData.get("containerCode"),
    containerType: formData.get("containerType") || "bag",
    assignedCustomerId: formData.get("assignedCustomerId"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc("create_laundry_container_asset_command", {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_container_code: parsed.containerCode,
    p_container_type: parsed.containerType as LaundryContainerType,
    p_assigned_customer_id: parsed.assignedCustomerId,
    p_notes: parsed.notes
  });

  if (result.error) {
    throw new Error(`Unable to create container asset: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/laundry/custody");
}

export async function createLaundryServiceAction(formData: FormData) {
  const context = await getAuthorizedLaundryContext();
  const parsed = createServiceSchema.parse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description"),
    defaultWorkflowId: formData.get("defaultWorkflowId"),
    defaultSlaHours: formData.get("defaultSlaHours"),
    defaultQuantityUnit: formData.get("defaultQuantityUnit") || "unit",
    allowsWeight: formData.get("allowsWeight") === "on",
    allowsPieceCount: formData.get("allowsPieceCount") === "on"
  });
  const supabase = createSupabaseServiceRoleClient();
  const workflow = await supabase
    .from("workflows")
    .select("id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.defaultWorkflowId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (workflow.error) {
    throw new Error(`Unable to validate workflow: ${workflow.error.message}`);
  }

  if (!workflow.data) {
    throw new Error("Workflow not found for this tenant.");
  }

  const result = await supabase.from("laundry_service_catalog").insert({
    tenant_id: context.tenant.id,
    name: parsed.name,
    code: parsed.code,
    description: parsed.description,
    default_workflow_id: parsed.defaultWorkflowId,
    default_sla_hours: parsed.defaultSlaHours ? Number(parsed.defaultSlaHours) : null,
    default_quantity_unit: parsed.defaultQuantityUnit as LaundryServiceQuantityUnit,
    allows_weight: parsed.allowsWeight,
    allows_piece_count: parsed.allowsPieceCount,
    created_by: context.membership.clerk_user_id,
    updated_by: context.membership.clerk_user_id
  });

  if (result.error) {
    throw new Error(`Unable to create Laundry service: ${result.error.message}`);
  }

  revalidatePath("/laundry/custody");
}

export async function createLaundryServiceLotAction(formData: FormData) {
  const context = await getAuthorizedLaundryContext();
  const parsed = createServiceLotSchema.parse({
    handlingUnitId: formData.get("handlingUnitId"),
    orderId: formData.get("orderId"),
    serviceCatalogId: formData.get("serviceCatalogId"),
    quantity: formData.get("quantity") || 1,
    quantityUnit: formData.get("quantityUnit") || "unit",
    pieceCount: formData.get("pieceCount"),
    weightKg: formData.get("weightKg"),
    specialInstructions: formData.get("specialInstructions"),
    displayCode: formData.get("displayCode"),
    idempotencyKey: formData.get("idempotencyKey")
  });
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey)
  });
  const supabase = createSupabaseServiceRoleClient();
  const result = await supabase.rpc("create_laundry_service_lot_command", {
    p_tenant_id: commandContext.tenantId,
    p_actor_type: commandContext.actor.type,
    p_actor_id: commandContext.actor.id,
    p_source: commandContext.source,
    p_correlation_id: commandContext.correlationId,
    p_idempotency_key: commandContext.idempotencyKey ?? null,
    p_handling_unit_id: parsed.handlingUnitId,
    p_order_id: parsed.orderId,
    p_service_catalog_id: parsed.serviceCatalogId,
    p_quantity: parsed.quantity,
    p_quantity_unit: parsed.quantityUnit as LaundryServiceQuantityUnit,
    p_piece_count: parsed.pieceCount,
    p_weight_kg: parsed.weightKg,
    p_special_instructions: parsed.specialInstructions,
    p_display_code: parsed.displayCode
  });

  if (result.error) {
    throw new Error(`Unable to create service lot: ${result.error.message}`);
  }

  parseCommandResult(result.data);
  revalidatePath("/laundry/custody");
}
