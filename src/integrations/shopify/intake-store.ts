import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyIntakeDependencies } from "./intake-handler.ts";
import { canonicalShopDomain } from "./config.ts";
import { shopifyIntakeConnectionSchema, shopifyIntakeEnvelopeSchema, shopifyIntakeResultSchema } from "./intake-contract.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Receive a trusted server-created service client. No browser credentials or
// tenant selection cookie is used to authorize an external Shopify event.
export function createShopifyIntakeStore(db: Pick<SupabaseClient<Database>, "from" | "rpc">): ShopifyIntakeDependencies {
  return {
    async findConnection(domain, appRef, signal) {
      const shopDomain = canonicalShopDomain(domain);
      const { data, error } = await db.from("shopify_connections")
        .select("id,tenant_id,shop_gid,canonical_domain,app_ref,environment,api_version,status,intake_enabled,verified_at,revision")
        .eq("canonical_domain", shopDomain).eq("app_ref", appRef).eq("environment", "production")
        .eq("intake_enabled", true).in("status", ["verified", "paused"]).limit(2).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      if (!data || data.length !== 1) return null;
      const result = shopifyIntakeConnectionSchema.safeParse(data[0]);
      if (!result.success || result.data.canonical_domain !== shopDomain || result.data.app_ref !== appRef) return null;
      return result.data;
    },
    async receive(connection, envelope, signal) {
      const binding = shopifyIntakeConnectionSchema.parse(connection);
      const input = shopifyIntakeEnvelopeSchema.parse(envelope);
      const { data, error } = await db.rpc("receive_shopify_event", {
        p_tenant_id: binding.tenant_id, p_connection_id: binding.id,
        p_shop_domain: binding.canonical_domain, p_app_ref: binding.app_ref,
        p_environment: binding.environment, p_expected_revision: binding.revision,
        p_topic: input.topic, p_delivery_id: input.deliveryId, p_event_id: input.eventId,
        p_api_version: input.apiVersion, p_order_gid: input.orderGid,
        p_body_sha256: input.bodySha256, p_triggered_at: input.triggeredAt,
      }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      const result = shopifyIntakeResultSchema.safeParse(data);
      if (!result.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return result.data;
    },
  };
}
