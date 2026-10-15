import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { decodeShopifySourcePayment, type ShopifyPaymentDisplay } from "@/integrations/shopify/source-payment";

export async function getShopifyPaymentDisplay(db: SupabaseClient<Database>, tenantId: string, actorId: string,
  orderId: string, env: NodeJS.ProcessEnv = process.env): Promise<ShopifyPaymentDisplay> {
  try {
    const { data, error } = await db.rpc("read_shopify_payment_source", {
      p_tenant_id: tenantId, p_actor_id: actorId, p_order_id: orderId,
    }).abortSignal(AbortSignal.timeout(4000));
    if (error || data === null) return { availability: "unavailable" };
    return decodeShopifySourcePayment(data, { tenantId, orderId }, env);
  }
  catch { return { availability: "unavailable" }; }
}
