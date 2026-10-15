import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ShopifyOperationalSummary = { orderId: string; held: boolean; reasons: string[] };

// Only sanitized operational reasons. No source payload, PII, credentials,
// external payment facts or contribution amounts reach manager-facing props.
export async function getShopifyOperationalSummaries(
  db: SupabaseClient<Database>, tenantId: string, orderIds: string[],
): Promise<ShopifyOperationalSummary[]> {
  if (!orderIds.length) return [];
  const { data, error } = await db.from("shopify_operational_summaries")
    .select("order_id, held, reasons").eq("tenant_id", tenantId).in("order_id", [...new Set(orderIds)]);
  if (error) throw new Error("Unable to load Shopify production holds. Please retry.");
  return (data ?? []).map(row => ({ orderId: row.order_id, held: row.held,
    reasons: Array.isArray(row.reasons) ? row.reasons.filter((reason): reason is string => typeof reason === "string" && /^[A-Z_]+$/.test(reason)) : [],
  }));
}
