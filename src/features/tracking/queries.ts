import "server-only";

import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function getPublicTrackingPageData(trackingToken: string) {
  const supabase = createSupabaseServiceRoleClient();
  const trimmedToken = trackingToken.trim();

  if (!trimmedToken) {
    notFound();
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, tenant_id, order_number, order_date, promised_delivery_date, delivery_type, order_status, tracking_token, deleted_at"
    )
    .eq("tracking_token", trimmedToken)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Unable to load tracking order: ${orderError.message}`);
  }

  if (!order) {
    notFound();
  }

  const [tenant, items, customerStatuses, itemTypes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, store_name, logo_url, brand_color, status")
      .eq("id", order.tenant_id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "id, item_type_id, name, quantity, expected_completion_date, delivery_type_override, item_status, customer_status_id, final_photo_url, is_customer_visible"
      )
      .eq("tenant_id", order.tenant_id)
      .eq("order_id", order.id)
      .eq("is_customer_visible", true)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("customer_statuses")
      .select("id, name, sort_order, is_final_status")
      .eq("tenant_id", order.tenant_id)
      .is("deleted_at", null),
    supabase
      .from("item_types")
      .select("id, name")
      .eq("tenant_id", order.tenant_id)
      .is("deleted_at", null)
  ]);

  for (const result of [tenant, items, customerStatuses, itemTypes]) {
    if (result.error) {
      throw new Error(`Unable to load tracking details: ${result.error.message}`);
    }
  }

  if (!tenant.data) {
    notFound();
  }

  return {
    tenant: tenant.data,
    order,
    items: items.data ?? [],
    customerStatuses: customerStatuses.data ?? [],
    itemTypes: itemTypes.data ?? []
  };
}
