import "server-only";

import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import { getAttachmentsForEntities } from "@/features/attachments/queries";
import type { Customer, CustomerMeasurement, Order, OrderItem, OrderPayment } from "@/types/database";

export type CustomerListRow = {
  activeOrders: number;
  customer: Customer;
  lastOrderDate: string | null;
  measurementCount: number;
  orderCount: number;
  pendingAmount: number;
  totalBooked: number;
};

export type CustomerOrderHistoryRow = {
  amountPaid: number;
  itemCount: number;
  order: Order;
  pendingAmount: number;
  totalAmount: number;
};

export type CustomerDetailSummary = {
  activeOrders: number;
  defaultMeasurements: number;
  measurementCount: number;
  pendingAmount: number;
  totalBooked: number;
  totalPaid: number;
  totalOrders: number;
};

export async function getCustomersPageData(search?: string | null) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const trimmedSearch = search?.trim();

  let customersQuery = supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (trimmedSearch) {
    customersQuery = customersQuery.or(`name.ilike.%${trimmedSearch}%,phone.ilike.%${trimmedSearch}%`);
  }

  const [customers, measurements] = await Promise.all([
    customersQuery.limit(50),
    supabase
      .from("customer_measurements")
      .select("id, customer_id")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
  ]);

  for (const result of [customers, measurements]) {
    if (result.error) {
      throw new Error(`Unable to load customers: ${result.error.message}`);
    }
  }

  const customerRows = customers.data ?? [];
  const customerIds = customerRows.map((customer) => customer.id);
  const orders = customerIds.length
    ? await supabase
        .from("orders")
        .select("id, customer_id, order_date, total_amount, amount_paid, order_status")
        .eq("tenant_id", context.tenant.id)
        .in("customer_id", customerIds)
        .is("deleted_at", null)
        .order("order_date", { ascending: false })
    : { data: [], error: null };

  if (orders.error) {
    throw new Error(`Unable to load customer order summaries: ${orders.error.message}`);
  }

  const measurementCountByCustomer = (measurements.data ?? []).reduce((groups, measurement) => {
    groups.set(measurement.customer_id, (groups.get(measurement.customer_id) ?? 0) + 1);
    return groups;
  }, new Map<string, number>());
  const ordersByCustomer = (orders.data ?? []).reduce((groups, order) => {
    const rows = groups.get(order.customer_id) ?? [];
    rows.push(order);
    groups.set(order.customer_id, rows);
    return groups;
  }, new Map<string, Array<Pick<Order, "amount_paid" | "customer_id" | "id" | "order_date" | "order_status" | "total_amount">>>());
  const customerListRows = customerRows.map((customer): CustomerListRow => {
    const customerOrders = ordersByCustomer.get(customer.id) ?? [];

    return {
      activeOrders: customerOrders.filter((order) => !["completed", "delivered", "cancelled"].includes(order.order_status)).length,
      customer,
      lastOrderDate: customerOrders[0]?.order_date ?? null,
      measurementCount: measurementCountByCustomer.get(customer.id) ?? 0,
      orderCount: customerOrders.length,
      pendingAmount: customerOrders.reduce((total, order) => total + Math.max(0, order.total_amount - order.amount_paid), 0),
      totalBooked: customerOrders.reduce((total, order) => total + order.total_amount, 0)
    };
  });

  return {
    context,
    customerRows: customerListRows,
    customers: customerRows,
    measurements: measurements.data ?? [],
    search: trimmedSearch ?? ""
  };
}

export async function getCustomerPhoneSuggestions(phone?: string | null) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();
  const normalizedPhone = phone?.trim();

  if (!normalizedPhone || normalizedPhone.length < 3) {
    return {
      context,
      suggestions: [],
      phone: normalizedPhone ?? ""
    };
  }

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .is("deleted_at", null)
    .ilike("phone", `%${normalizedPhone}%`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    throw new Error(`Unable to load phone suggestions: ${error.message}`);
  }

  return {
    context,
    suggestions: data ?? [],
    phone: normalizedPhone
  };
}

export async function getCustomerDetailPageData(customerId: string) {
  const context = await requireTenantContext();
  const supabase = createSupabaseServiceRoleClient();

  const [customer, measurements, itemTypes, measurementFields, orders] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("id", customerId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("customer_measurements")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("item_types")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("item_type_measurement_fields")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order"),
    supabase
      .from("orders")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("order_date", { ascending: false })
      .limit(20)
  ]);

  if (customer.error) {
    throw new Error(`Unable to load customer: ${customer.error.message}`);
  }

  if (!customer.data) {
    notFound();
  }

  for (const result of [measurements, itemTypes, measurementFields, orders]) {
    if (result.error) {
      throw new Error(`Unable to load customer detail: ${result.error.message}`);
    }
  }

  const orderIds = (orders.data ?? []).map((order) => order.id);
  const [orderItems, payments] = orderIds.length
    ? await Promise.all([
        supabase
          .from("order_items")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_id", orderIds)
          .is("deleted_at", null),
        supabase
          .from("order_payments")
          .select("*")
          .eq("tenant_id", context.tenant.id)
          .in("order_id", orderIds)
          .is("deleted_at", null)
      ])
    : await Promise.resolve([
        { data: [], error: null },
        { data: [], error: null }
      ]);

  for (const result of [orderItems, payments]) {
    if (result.error) {
      throw new Error(`Unable to load customer order history: ${result.error.message}`);
    }
  }

  const itemsByOrder = (orderItems.data ?? []).reduce((groups, item: OrderItem) => {
    const rows = groups.get(item.order_id) ?? [];
    rows.push(item);
    groups.set(item.order_id, rows);
    return groups;
  }, new Map<string, OrderItem[]>());
  const paymentsByOrder = (payments.data ?? []).reduce((groups, payment: OrderPayment) => {
    const rows = groups.get(payment.order_id) ?? [];
    rows.push(payment);
    groups.set(payment.order_id, rows);
    return groups;
  }, new Map<string, OrderPayment[]>());
  const orderHistoryRows = (orders.data ?? []).map((order): CustomerOrderHistoryRow => {
    const orderPayments = paymentsByOrder.get(order.id) ?? [];
    const amountPaid = orderPayments.length ? orderPayments.reduce((total, payment) => total + payment.amount, 0) : order.amount_paid;

    return {
      amountPaid,
      itemCount: itemsByOrder.get(order.id)?.length ?? 0,
      order,
      pendingAmount: Math.max(0, order.total_amount - amountPaid),
      totalAmount: order.total_amount
    };
  });
  const detailSummary: CustomerDetailSummary = {
    activeOrders: (orders.data ?? []).filter((order) => !["completed", "delivered", "cancelled"].includes(order.order_status)).length,
    defaultMeasurements: (measurements.data ?? []).filter((measurement: CustomerMeasurement) => measurement.is_default).length,
    measurementCount: (measurements.data ?? []).length,
    pendingAmount: orderHistoryRows.reduce((total, row) => total + row.pendingAmount, 0),
    totalBooked: orderHistoryRows.reduce((total, row) => total + row.totalAmount, 0),
    totalPaid: orderHistoryRows.reduce((total, row) => total + row.amountPaid, 0),
    totalOrders: (orders.data ?? []).length
  };
  const customerAttachments = await getAttachmentsForEntities({
    tenantId: context.tenant.id,
    entityType: "customer",
    entityIds: [customer.data.id]
  });

  return {
    context,
    customerAttachments,
    customer: customer.data,
    itemTypes: itemTypes.data ?? [],
    measurementFields: measurementFields.data ?? [],
    orderHistoryRows,
    orderItems: orderItems.data ?? [],
    orders: orders.data ?? [],
    payments: payments.data ?? [],
    summary: detailSummary,
    measurements: measurements.data ?? [],
  };
}
