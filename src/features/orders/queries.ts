import "server-only";

import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAttachmentsForEntities } from "@/features/attachments/queries";

export async function getOrdersPageData(search?: string | null) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const trimmedSearch = search?.trim();

  const [orders, customers, orderItems] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("customers")
      .select("id, name, phone")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("order_items")
      .select("id, order_id, item_status")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
  ]);

  for (const result of [orders, customers, orderItems]) {
    if (result.error) {
      throw new Error(`Unable to load orders: ${result.error.message}`);
    }
  }

  const customerById = new Map((customers.data ?? []).map((customer) => [customer.id, customer]));
  const filteredOrders = trimmedSearch
    ? (orders.data ?? []).filter((order) => {
        const customer = customerById.get(order.customer_id);
        const haystack =
          `${order.order_number} ${order.reference_order_id ?? ""} ${customer?.name ?? ""} ${customer?.phone ?? ""}`.toLowerCase();
        return haystack.includes(trimmedSearch.toLowerCase());
      })
    : orders.data ?? [];
  const orderItemIds = (orderItems.data ?? []).map((item) => item.id);
  const stageInstances = orderItemIds.length
    ? await supabase
        .from("item_stage_instances")
        .select("id, order_item_id, status")
        .eq("tenant_id", context.tenant.id)
        .in("order_item_id", orderItemIds)
        .is("deleted_at", null)
    : { data: [], error: null };

  if (stageInstances.error) {
    throw new Error(`Unable to load order progress: ${stageInstances.error.message}`);
  }

  return {
    context,
    orders: filteredOrders,
    customers: customers.data ?? [],
    orderItems: orderItems.data ?? [],
    stageInstances: stageInstances.data ?? [],
    search: trimmedSearch ?? ""
  };
}

export async function getNewOrderPageData() {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const [customers, itemTypes, workflows, paymentModes, customerMeasurements, measurementFields, standardSizes] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("item_types")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("payment_modes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("customer_measurements")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false }),
    supabase
      .from("item_type_measurement_fields")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("item_type_standard_sizes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order")
  ]);

  for (const result of [customers, itemTypes, workflows, paymentModes, customerMeasurements, measurementFields, standardSizes]) {
    if (result.error) {
      throw new Error(`Unable to load new order data: ${result.error.message}`);
    }
  }

  return {
    context,
    customers: customers.data ?? [],
    itemTypes: itemTypes.data ?? [],
    workflows: workflows.data ?? [],
    paymentModes: paymentModes.data ?? [],
    customerMeasurements: customerMeasurements.data ?? [],
    measurementFields: measurementFields.data ?? [],
    standardSizes: standardSizes.data ?? []
  };
}

export async function getOrderDetailPageData(orderId: string) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const order = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("id", orderId)
    .is("deleted_at", null)
    .maybeSingle();

  if (order.error) {
    throw new Error(`Unable to load order: ${order.error.message}`);
  }

  if (!order.data) {
    notFound();
  }

  const [customer, items, payments, itemTypes, workflows, paymentModes, customerOrders, customerMeasurements, measurementFields, standardSizes] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", order.data.customer_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("order_id", order.data.id)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("order_payments")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("order_id", order.data.id)
      .is("deleted_at", null)
      .order("payment_date", { ascending: false }),
    supabase.from("item_types").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("workflows").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase.from("payment_modes").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
    supabase
      .from("orders")
      .select("id, order_number, order_date, promised_delivery_date, total_amount, amount_paid, payment_status, order_status")
      .eq("tenant_id", context.tenant.id)
      .eq("customer_id", order.data.customer_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("customer_measurements")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("customer_id", order.data.customer_id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("item_type_measurement_fields")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("item_type_standard_sizes")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order")
  ]);

  for (const result of [customer, items, payments, itemTypes, workflows, paymentModes, customerOrders, customerMeasurements, measurementFields, standardSizes]) {
    if (result.error) {
      throw new Error(`Unable to load order detail: ${result.error.message}`);
    }
  }

  const itemIds = (items.data ?? []).map((item) => item.id);
  const orderItemAttachments = await getAttachmentsForEntities({
    tenantId: context.tenant.id,
    entityType: "order_item",
    entityIds: itemIds
  });
  const orderMessages = await supabase
    .from("communication_message_queue")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .eq("order_id", order.data.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (orderMessages.error) {
    throw new Error(`Unable to load order messages: ${orderMessages.error.message}`);
  }

  const customerOrderIds = (customerOrders.data ?? []).map((customerOrder) => customerOrder.id);
  const [workflowInstances, stageInstances, workflowStages, stageMasters, workLogs, workers, workerWorkgroups, stageWorkgroups, workgroups, contributionRules, contributionCorrections, itemHistory, customerStatuses, customerOrderItems] = itemIds.length
    ? await Promise.all([
        supabase
          .from("item_workflow_instances")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_item_id", itemIds)
          .is("deleted_at", null),
        supabase
          .from("item_stage_instances")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_item_id", itemIds)
          .is("deleted_at", null)
          .order("sequence_number"),
        supabase.from("workflow_stages").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
        supabase.from("stage_master").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
        supabase
          .from("item_stage_work_logs")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_item_id", itemIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase.from("workers").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
        supabase.from("worker_workgroups").select("*").eq("tenant_id", context.tenant.id),
        supabase.from("stage_workgroups").select("*").eq("tenant_id", context.tenant.id),
        supabase.from("workgroups").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
        supabase.from("item_type_stage_contribution_rules").select("*").eq("tenant_id", context.tenant.id).eq("is_active", true).is("deleted_at", null),
        supabase
          .from("item_stage_contribution_corrections")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_item_id", itemIds)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("item_history")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_item_id", itemIds)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase.from("customer_statuses").select("*").eq("tenant_id", context.tenant.id).is("deleted_at", null),
        customerOrderIds.length
          ? supabase
              .from("order_items")
              .select("id, order_id")
              .eq("tenant_id", context.tenant.id)
              .in("order_id", customerOrderIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [], error: null })
      ])
    : await Promise.resolve([
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ]);

  for (const result of [workflowInstances, stageInstances, workflowStages, stageMasters, workLogs, workers, workerWorkgroups, stageWorkgroups, workgroups, contributionRules, contributionCorrections, itemHistory, customerStatuses, customerOrderItems]) {
    if (result.error) {
      throw new Error(`Unable to load order production detail: ${result.error.message}`);
    }
  }

  return {
    context,
    order: order.data,
    customer: customer.data,
    items: items.data ?? [],
    payments: payments.data ?? [],
    itemTypes: itemTypes.data ?? [],
    workflows: workflows.data ?? [],
    paymentModes: paymentModes.data ?? [],
    workflowInstances: workflowInstances.data ?? [],
    stageInstances: stageInstances.data ?? [],
    workflowStages: workflowStages.data ?? [],
    stageMasters: stageMasters.data ?? [],
    workLogs: workLogs.data ?? [],
    workers: workers.data ?? [],
    workerWorkgroups: workerWorkgroups.data ?? [],
    stageWorkgroups: stageWorkgroups.data ?? [],
    workgroups: workgroups.data ?? [],
    contributionRules: contributionRules.data ?? [],
    contributionCorrections: contributionCorrections.data ?? [],
    itemHistory: itemHistory.data ?? [],
    customerStatuses: customerStatuses.data ?? [],
    customerOrders: customerOrders.data ?? [],
    customerOrderItems: customerOrderItems.data ?? [],
    customerMeasurements: customerMeasurements.data ?? [],
    measurementFields: measurementFields.data ?? [],
    orderItemAttachments,
    orderMessages: orderMessages.data ?? [],
    standardSizes: standardSizes.data ?? []
  };
}
