import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { decodeShopifySourcePayment, type ShopifyPaymentDisplay } from "@/integrations/shopify/source-payment";
import { readShopifyCommercialPayment } from "@/integrations/shopify/commercial-order";
import { canonicalShopDomain } from "@/integrations/shopify/config";
import { resolveShopifyTenantEnvironment } from "@/integrations/shopify/tenant-credentials";

import { shopifyTenantEligible } from "@/integrations/shopify/tenant-rollout";

export async function getShopifyPaymentDisplay(db: SupabaseClient<Database>, tenantId: string, actorId: string,
  orderId: string, env: NodeJS.ProcessEnv = process.env): Promise<ShopifyPaymentDisplay> {
  try {
    if (env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED === "true" && shopifyTenantEligible(tenantId, env)) {
      env=await resolveShopifyTenantEnvironment(db,tenantId,actorId,AbortSignal.timeout(4000),env);
      if (!env.SHOPIFY_SHOP_DOMAIN) return { availability: "unavailable" };
      const retained = await db.rpc("read_shopify_retained_payment", {
        p_tenant_id: tenantId, p_actor_id: actorId, p_order_id: orderId,
        p_domain: canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN ?? ""), p_app_ref: env.SHOPIFY_CLIENT_ID ?? "",
      }).abortSignal(AbortSignal.timeout(4000));
      if (retained.error) return { availability: "unavailable" };
      if (retained.data) return readShopifyCommercialPayment(retained.data, { tenantId, orderId });
    }
    const { data, error } = await db.rpc("read_shopify_payment_source", {
      p_tenant_id: tenantId, p_actor_id: actorId, p_order_id: orderId,
    }).abortSignal(AbortSignal.timeout(4000));
    if (error || data === null) return { availability: "unavailable" };
    return decodeShopifySourcePayment(data, { tenantId, orderId }, env);
  }
  catch { return { availability: "unavailable" }; }
}
