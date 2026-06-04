"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { createWorkflowInstanceForOrderItem } from "@/features/production/instances";
import type { DeliveryType, OrderSource, PaymentStatus } from "@/types/database";

export type FormActionState = {
  ok: boolean;
  message: string | null;
};

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null));

const orderSourceSchema = z.enum(["walk_in", "shopify_manual", "whatsapp", "other"]);
const deliveryTypeSchema = z.enum(["store_pickup", "self_delivery", "courier"]);

const createOrderSchema = z.object({
  referenceOrderId: optionalText,
  source: orderSourceSchema,
  customerId: z.string().uuid("Select a customer from the search results before creating the order."),
  orderDate: z.string().min(1),
  promisedDeliveryDate: optionalText,
  deliveryType: deliveryTypeSchema,
  deliveryAddress: optionalText,
  notes: optionalText,
  initialPaymentAmount: z.coerce.number().min(0),
  initialPaymentModeId: optionalText,
  initialPaymentDate: optionalText,
  initialPaymentReference: optionalText,
  initialPaymentNotes: optionalText,
  items: z.array(
    z.object({
      itemTypeId: z.string().uuid(),
      customerMeasurementId: z.string().uuid().nullable(),
      standardSizeId: z.string().uuid().nullable(),
      name: z.string().trim().min(1),
      description: z.string().nullable(),
      color: z.string().nullable(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().min(0),
      discountAmount: z.number().min(0),
      workflowId: z.string().uuid(),
      expectedCompletionDate: z.string().nullable(),
      deliveryTypeOverride: deliveryTypeSchema.nullable(),
      notes: z.string().nullable()
    })
  ).min(1, "Add at least one order item.")
});

const recordOrderPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paymentModeId: optionalText,
  paymentDate: z.string().min(1, "Payment date is required."),
  referenceNumber: optionalText,
  notes: optionalText
});

const updateOrderDetailsSchema = z.object({
  orderId: z.string().uuid(),
  referenceOrderId: optionalText,
  source: orderSourceSchema,
  orderDate: z.string().min(1, "Order date is required."),
  promisedDeliveryDate: optionalText,
  deliveryType: deliveryTypeSchema,
  deliveryAddress: optionalText,
  notes: optionalText
});

const updateOrderItemSchema = z.object({
  orderItemId: z.string().uuid(),
  name: z.string().trim().min(1, "Item name is required."),
  description: optionalText,
  color: optionalText,
  expectedCompletionDate: optionalText,
  deliveryTypeOverride: deliveryTypeSchema.nullable(),
  customerMeasurementId: z.string().uuid().nullable(),
  standardSizeId: z.string().uuid().nullable(),
  notes: optionalText
});

function getActionErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function getAuthorizedOrderContext() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "orders:manage");
  return context;
}

function parseItems(formData: FormData) {
  const items = [];
  const rowIds = formData.getAll("itemRowId").map((value) => String(value));
  const itemIndexes = rowIds.length ? rowIds : Array.from({ length: 5 }).map((_, index) => String(index + 1));

  for (const index of itemIndexes) {
    const name = String(formData.get(`itemName_${index}`) ?? "").trim();
    const itemTypeId = String(formData.get(`itemTypeId_${index}`) ?? "").trim();
    const workflowId = String(formData.get(`workflowId_${index}`) ?? "").trim();

    if (!name && !itemTypeId && !workflowId) {
      continue;
    }

    const fitReference = String(formData.get(`fitReference_${index}`) ?? "").trim();
    const customerMeasurementId = fitReference.startsWith("customer:") ? fitReference.replace("customer:", "") : null;
    const standardSizeId = fitReference.startsWith("standard:") ? fitReference.replace("standard:", "") : null;

    items.push({
      itemTypeId,
      customerMeasurementId,
      standardSizeId,
      name,
      description: String(formData.get(`itemDescription_${index}`) ?? "").trim() || null,
      color: String(formData.get(`itemColor_${index}`) ?? "").trim() || null,
      quantity: Number(formData.get(`itemQuantity_${index}`) || 1),
      unitPrice: Number(formData.get(`itemUnitPrice_${index}`) || 0),
      discountAmount: Number(formData.get(`itemDiscountAmount_${index}`) || 0),
      workflowId,
      expectedCompletionDate: String(formData.get(`expectedCompletionDate_${index}`) ?? "").trim() || null,
      deliveryTypeOverride: String(formData.get(`deliveryTypeOverride_${index}`) ?? "").trim() || null,
      notes: String(formData.get(`itemNotes_${index}`) ?? "").trim() || null
    });
  }

  return items;
}

function parseFitReference(value: FormDataEntryValue | null) {
  const fitReference = String(value ?? "").trim();

  if (fitReference.startsWith("customer:")) {
    return {
      customerMeasurementId: fitReference.replace("customer:", "") || null,
      standardSizeId: null
    };
  }

  if (fitReference.startsWith("standard:")) {
    return {
      customerMeasurementId: null,
      standardSizeId: fitReference.replace("standard:", "") || null
    };
  }

  return {
    customerMeasurementId: null,
    standardSizeId: null
  };
}

function getPaymentStatus(totalAmount: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) {
    return "unpaid";
  }

  if (amountPaid >= totalAmount) {
    return "paid";
  }

  return "partially_paid";
}

async function validatePaymentMode(tenantId: string, paymentModeId: string | null) {
  if (!paymentModeId) {
    return;
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("payment_modes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", paymentModeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate payment mode: ${error.message}`);
  }

  if (!data) {
    throw new Error("Selected payment mode does not belong to this tenant.");
  }
}

async function getOrderPaymentTotal(tenantId: string, orderId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("order_payments")
    .select("amount")
    .eq("tenant_id", tenantId)
    .eq("order_id", orderId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to total order payments: ${error.message}`);
  }

  return (data ?? []).reduce((total, payment) => total + payment.amount, 0);
}

async function updateOrderPaymentSummary(tenantId: string, orderId: string, totalAmount: number, actorId: string) {
  const supabase = createSupabaseServiceRoleClient();
  const amountPaid = Math.min(await getOrderPaymentTotal(tenantId, orderId), totalAmount);
  const paymentStatus = getPaymentStatus(totalAmount, amountPaid);
  const { error } = await supabase
    .from("orders")
    .update({
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      updated_by: actorId
    })
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  if (error) {
    throw new Error(`Unable to update order payment summary: ${error.message}`);
  }

  return { amountPaid, paymentStatus };
}

async function revalidateOrderSurfaces(orderId: string, trackingToken?: string | null) {
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);

  if (trackingToken) {
    revalidatePath(`/track/${trackingToken}`);
  }
}

function createTrackingToken() {
  return randomBytes(24).toString("base64url");
}

export async function createOrderAction(formData: FormData) {
  const context = await getAuthorizedOrderContext();
  const parsed = createOrderSchema.parse({
    referenceOrderId: formData.get("referenceOrderId"),
    source: formData.get("source") || "walk_in",
    customerId: formData.get("customerId"),
    orderDate: formData.get("orderDate"),
    promisedDeliveryDate: formData.get("promisedDeliveryDate"),
    deliveryType: formData.get("deliveryType") || "store_pickup",
    deliveryAddress: formData.get("deliveryAddress"),
    notes: formData.get("notes"),
    initialPaymentAmount: formData.get("initialPaymentAmount") || 0,
    initialPaymentModeId: formData.get("initialPaymentModeId"),
    initialPaymentDate: formData.get("initialPaymentDate"),
    initialPaymentReference: formData.get("initialPaymentReference"),
    initialPaymentNotes: formData.get("initialPaymentNotes"),
    items: parseItems(formData)
  });

  const supabase = createSupabaseServiceRoleClient();
  const itemTypeIds = Array.from(new Set(parsed.items.map((item) => item.itemTypeId)));
  const workflowIds = Array.from(new Set(parsed.items.map((item) => item.workflowId)));
  const measurementIds = Array.from(
    new Set(parsed.items.map((item) => item.customerMeasurementId).filter((measurementId): measurementId is string => Boolean(measurementId)))
  );
  const standardSizeIds = Array.from(
    new Set(parsed.items.map((item) => item.standardSizeId).filter((standardSizeId): standardSizeId is string => Boolean(standardSizeId)))
  );

  const [customer, itemTypes, workflows, paymentMode] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.customerId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("item_types")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .in("id", itemTypeIds)
      .is("deleted_at", null),
    supabase
      .from("workflows")
      .select("id")
      .eq("tenant_id", context.tenant.id)
      .in("id", workflowIds)
      .is("deleted_at", null),
    parsed.initialPaymentModeId
      ? supabase
          .from("payment_modes")
          .select("id")
          .eq("tenant_id", context.tenant.id)
          .eq("id", parsed.initialPaymentModeId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (customer.error) {
    throw new Error(`Unable to validate customer: ${customer.error.message}`);
  }

  if (!customer.data) {
    throw new Error("Selected customer does not belong to this tenant.");
  }

  if (itemTypes.error) {
    throw new Error(`Unable to validate item types: ${itemTypes.error.message}`);
  }

  if ((itemTypes.data ?? []).length !== itemTypeIds.length) {
    throw new Error("One or more selected item types do not belong to this tenant.");
  }

  if (workflows.error) {
    throw new Error(`Unable to validate workflows: ${workflows.error.message}`);
  }

  if ((workflows.data ?? []).length !== workflowIds.length) {
    throw new Error("One or more selected workflows do not belong to this tenant.");
  }

  if (paymentMode.error) {
    throw new Error(`Unable to validate payment mode: ${paymentMode.error.message}`);
  }

  if (parsed.initialPaymentModeId && !paymentMode.data) {
    throw new Error("Selected payment mode does not belong to this tenant.");
  }

  if (measurementIds.length) {
    const { data: measurements, error: measurementError } = await supabase
      .from("customer_measurements")
      .select("id, customer_id, item_type_id")
      .eq("tenant_id", context.tenant.id)
      .in("id", measurementIds)
      .is("deleted_at", null);

    if (measurementError) {
      throw new Error(`Unable to validate measurements: ${measurementError.message}`);
    }

    if ((measurements ?? []).length !== measurementIds.length) {
      throw new Error("One or more selected measurements do not belong to this tenant.");
    }

    const measurementById = new Map((measurements ?? []).map((measurement) => [measurement.id, measurement]));

    for (const item of parsed.items) {
      if (!item.customerMeasurementId) {
        continue;
      }

      const measurement = measurementById.get(item.customerMeasurementId);

      if (!measurement || measurement.customer_id !== parsed.customerId) {
        throw new Error("Selected measurement does not belong to this customer.");
      }

      if (measurement.item_type_id && measurement.item_type_id !== item.itemTypeId) {
        throw new Error("Selected measurement does not match the item type.");
      }
    }
  }

  if (standardSizeIds.length) {
    const { data: standardSizes, error: standardSizeError } = await supabase
      .from("item_type_standard_sizes")
      .select("id, item_type_id")
      .eq("tenant_id", context.tenant.id)
      .in("id", standardSizeIds)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (standardSizeError) {
      throw new Error(`Unable to validate standard sizes: ${standardSizeError.message}`);
    }

    if ((standardSizes ?? []).length !== standardSizeIds.length) {
      throw new Error("One or more selected standard sizes do not belong to this tenant.");
    }

    const standardSizeById = new Map((standardSizes ?? []).map((standardSize) => [standardSize.id, standardSize]));

    for (const item of parsed.items) {
      if (!item.standardSizeId) {
        continue;
      }

      const standardSize = standardSizeById.get(item.standardSizeId);

      if (!standardSize || standardSize.item_type_id !== item.itemTypeId) {
        throw new Error("Selected standard size does not match the item type.");
      }
    }
  }

  const subtotal = parsed.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = parsed.items.reduce((sum, item) => sum + item.discountAmount, 0);
  const totalAmount = Math.max(subtotal - discountAmount, 0);
  const amountPaid = Math.min(parsed.initialPaymentAmount, totalAmount);
  const paymentStatus = getPaymentStatus(totalAmount, amountPaid);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      tenant_id: context.tenant.id,
      reference_order_id: parsed.referenceOrderId,
      source: parsed.source as OrderSource,
      customer_id: parsed.customerId,
      order_date: parsed.orderDate,
      promised_delivery_date: parsed.promisedDeliveryDate,
      delivery_type: parsed.deliveryType as DeliveryType,
      delivery_address: parsed.deliveryAddress,
      subtotal,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      notes: parsed.notes,
      tracking_token: createTrackingToken(),
      created_by: context.membership.clerk_user_id,
      updated_by: context.membership.clerk_user_id
    })
    .select("id")
    .single();

  if (orderError) {
    throw new Error(`Unable to create order: ${orderError.message}`);
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .insert(
      parsed.items.map((item) => ({
        tenant_id: context.tenant.id,
        order_id: order.id,
        item_type_id: item.itemTypeId,
        customer_measurement_id: item.customerMeasurementId,
        standard_size_id: item.standardSizeId,
        name: item.name,
        description: item.description,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount,
        final_price: Math.max(item.quantity * item.unitPrice - item.discountAmount, 0),
        workflow_id: item.workflowId,
        expected_completion_date: item.expectedCompletionDate,
        delivery_type_override: item.deliveryTypeOverride as DeliveryType | null,
        notes: item.notes,
        created_by: context.membership.clerk_user_id,
        updated_by: context.membership.clerk_user_id
      }))
    )
    .select("*");

  if (itemsError) {
    throw new Error(`Order created, but item creation failed: ${itemsError.message}`);
  }

  for (const orderItem of orderItems ?? []) {
    await createWorkflowInstanceForOrderItem(orderItem, context.membership.clerk_user_id);
  }

  if (amountPaid > 0) {
    const { error: paymentError } = await supabase.from("order_payments").insert({
      tenant_id: context.tenant.id,
      order_id: order.id,
      amount: amountPaid,
      payment_mode_id: parsed.initialPaymentModeId,
      payment_date: parsed.initialPaymentDate ?? parsed.orderDate,
      reference_number: parsed.initialPaymentReference,
      notes: parsed.initialPaymentNotes,
      created_by: context.membership.clerk_user_id
    });

    if (paymentError) {
      throw new Error(`Order created, but payment creation failed: ${paymentError.message}`);
    }
  }

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function updateOrderDetailsAction(formData: FormData) {
  const context = await getAuthorizedOrderContext();
  const parsed = updateOrderDetailsSchema.parse({
    orderId: formData.get("orderId"),
    referenceOrderId: formData.get("referenceOrderId"),
    source: formData.get("source") || "walk_in",
    orderDate: formData.get("orderDate"),
    promisedDeliveryDate: formData.get("promisedDeliveryDate"),
    deliveryType: formData.get("deliveryType") || "store_pickup",
    deliveryAddress: formData.get("deliveryAddress"),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, tracking_token")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Unable to validate order: ${orderError.message}`);
  }

  if (!order) {
    throw new Error("Order does not belong to this tenant.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      reference_order_id: parsed.referenceOrderId,
      source: parsed.source as OrderSource,
      order_date: parsed.orderDate,
      promised_delivery_date: parsed.promisedDeliveryDate,
      delivery_type: parsed.deliveryType as DeliveryType,
      delivery_address: parsed.deliveryAddress,
      notes: parsed.notes,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderId);

  if (error) {
    throw new Error(`Unable to update order details: ${error.message}`);
  }

  await revalidateOrderSurfaces(order.id, order.tracking_token);
}

export async function updateOrderItemAction(formData: FormData) {
  const context = await getAuthorizedOrderContext();
  const deliveryOverrideValue = String(formData.get("deliveryTypeOverride") ?? "").trim() || null;
  const fitReference = parseFitReference(formData.get("fitReference"));
  const parsed = updateOrderItemSchema.parse({
    orderItemId: formData.get("orderItemId"),
    name: formData.get("name"),
    description: formData.get("description"),
    color: formData.get("color"),
    expectedCompletionDate: formData.get("expectedCompletionDate"),
    deliveryTypeOverride: deliveryOverrideValue,
    customerMeasurementId: fitReference.customerMeasurementId,
    standardSizeId: fitReference.standardSizeId,
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .select("id, order_id, item_type_id")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderItemId)
    .is("deleted_at", null)
    .maybeSingle();

  if (itemError) {
    throw new Error(`Unable to validate order item: ${itemError.message}`);
  }

  if (!item) {
    throw new Error("Order item does not belong to this tenant.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, customer_id, tracking_token")
    .eq("tenant_id", context.tenant.id)
    .eq("id", item.order_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Unable to validate order: ${orderError.message}`);
  }

  if (!order) {
    throw new Error("Order does not belong to this tenant.");
  }

  if (parsed.customerMeasurementId) {
    const { data: measurement, error: measurementError } = await supabase
      .from("customer_measurements")
      .select("id, customer_id, item_type_id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.customerMeasurementId)
      .is("deleted_at", null)
      .maybeSingle();

    if (measurementError) {
      throw new Error(`Unable to validate measurement: ${measurementError.message}`);
    }

    if (!measurement || measurement.customer_id !== order.customer_id) {
      throw new Error("Selected measurement does not belong to this order customer.");
    }

    if (measurement.item_type_id && measurement.item_type_id !== item.item_type_id) {
      throw new Error("Selected measurement does not match this item type.");
    }
  }

  if (parsed.standardSizeId) {
    const { data: standardSize, error: standardSizeError } = await supabase
      .from("item_type_standard_sizes")
      .select("id, item_type_id")
      .eq("tenant_id", context.tenant.id)
      .eq("id", parsed.standardSizeId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (standardSizeError) {
      throw new Error(`Unable to validate standard size: ${standardSizeError.message}`);
    }

    if (!standardSize) {
      throw new Error("Selected standard size does not belong to this tenant.");
    }

    if (standardSize.item_type_id !== item.item_type_id) {
      throw new Error("Selected standard size does not match this item type.");
    }
  }

  const { error } = await supabase
    .from("order_items")
    .update({
      name: parsed.name,
      description: parsed.description,
      color: parsed.color,
      expected_completion_date: parsed.expectedCompletionDate,
      delivery_type_override: parsed.deliveryTypeOverride as DeliveryType | null,
      customer_measurement_id: parsed.customerMeasurementId,
      standard_size_id: parsed.standardSizeId,
      notes: parsed.notes,
      updated_by: context.membership.clerk_user_id
    })
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderItemId);

  if (error) {
    throw new Error(`Unable to update order item: ${error.message}`);
  }

  await revalidateOrderSurfaces(order.id, order.tracking_token);
  revalidatePath(`/production/items/${item.id}/workflow`);
}

export async function recordOrderPaymentAction(formData: FormData) {
  const context = await getAuthorizedOrderContext();
  const parsed = recordOrderPaymentSchema.parse({
    orderId: formData.get("orderId"),
    amount: formData.get("amount"),
    paymentModeId: formData.get("paymentModeId"),
    paymentDate: formData.get("paymentDate"),
    referenceNumber: formData.get("referenceNumber"),
    notes: formData.get("notes")
  });

  const supabase = createSupabaseServiceRoleClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, total_amount")
    .eq("tenant_id", context.tenant.id)
    .eq("id", parsed.orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Unable to validate order: ${orderError.message}`);
  }

  if (!order) {
    throw new Error("Order does not belong to this tenant.");
  }

  await validatePaymentMode(context.tenant.id, parsed.paymentModeId);

  const currentPaid = await getOrderPaymentTotal(context.tenant.id, order.id);
  const outstanding = Math.max(order.total_amount - currentPaid, 0);

  if (outstanding <= 0) {
    throw new Error("This order is already fully paid.");
  }

  if (parsed.amount > outstanding) {
    throw new Error(`Payment cannot exceed outstanding amount of ${outstanding}.`);
  }

  const { error: paymentError } = await supabase.from("order_payments").insert({
    tenant_id: context.tenant.id,
    order_id: order.id,
    amount: parsed.amount,
    payment_mode_id: parsed.paymentModeId,
    payment_date: parsed.paymentDate,
    reference_number: parsed.referenceNumber,
    notes: parsed.notes,
    created_by: context.membership.clerk_user_id
  });

  if (paymentError) {
    throw new Error(`Unable to record order payment: ${paymentError.message}`);
  }

  await updateOrderPaymentSummary(context.tenant.id, order.id, order.total_amount, context.membership.clerk_user_id);

  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/finance");
}

export async function recordOrderPaymentFormAction(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    await recordOrderPaymentAction(formData);
    return { ok: true, message: null };
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error)
    };
  }
}
