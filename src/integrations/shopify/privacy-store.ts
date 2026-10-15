import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyPrivacyInput } from "./privacy-handler.ts";
import { canonicalShopDomain } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Server-created service client only. Unlike ordinary order intake, compliance
// lookup deliberately includes previously verified disconnected installations.
export function createShopifyPrivacyStore(db: Pick<SupabaseClient<Database>, "from" | "rpc">) {
  return {
    async findConnection(domain: string, appRef: string, signal: AbortSignal) {
      const shopDomain = canonicalShopDomain(domain);
      const { data, error } = await db.from("shopify_connections")
        .select("id,tenant_id,shop_gid,canonical_domain,app_ref,environment,verified_at")
        .eq("canonical_domain", shopDomain).eq("app_ref", appRef).eq("environment", "production")
        .not("verified_at", "is", null).limit(2).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      if (!data || data.length !== 1 || !data[0].verified_at) return null;
      const row = data[0];
      return { tenantId: row.tenant_id, connectionId: row.id, shopGid: row.shop_gid,
        shopDomain: row.canonical_domain, appRef: row.app_ref, environment: "production" as const, verifiedAt: row.verified_at! };
    },
    async receive(input: ShopifyPrivacyInput, signal: AbortSignal) {
      const { data, error } = await db.rpc("receive_shopify_privacy", { p_input: input }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      return data;
    },
  };
}
