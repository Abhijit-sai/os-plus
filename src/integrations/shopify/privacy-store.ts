import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyPrivacyInput } from "./privacy-handler.ts";
import { canonicalShopDomain } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Server-created service client only. Unlike ordinary order intake, compliance
// lookup deliberately includes previously verified disconnected installations.
export function createShopifyPrivacyStore(db: Pick<SupabaseClient<Database>, "from" | "rpc">) {
  async function findConnections(domain: string, appRef: string, signal: AbortSignal) {
    const shopDomain = canonicalShopDomain(domain);
    const query = db.from("shopify_connections")
      .select("id,tenant_id,shop_gid,canonical_domain,app_ref,environment,verified_at")
      .eq("canonical_domain", shopDomain).eq("app_ref", appRef).eq("environment", "production")
      .not("verified_at", "is", null);
    const { data, error } = await query.limit(3).abortSignal(signal);
    if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    return (data ?? []).filter(row => row.verified_at !== null).map(row => ({ tenantId: row.tenant_id, connectionId: row.id, shopGid: row.shop_gid,
      shopDomain: row.canonical_domain, appRef: row.app_ref, environment: "production" as const, verifiedAt: row.verified_at! }));
  }

  return {
    findConnections,
    async receiveMany(inputs: ShopifyPrivacyInput[], signal: AbortSignal) {
      const { data, error } = await db.rpc("receive_shopify_privacy_bindings", { p_inputs: inputs }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      return data;
    },
    async receive(input: ShopifyPrivacyInput, signal: AbortSignal) {
      const { data, error } = await db.rpc("receive_shopify_privacy", { p_input: input }).abortSignal(signal);
      if (error) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      return data;
    },
  };
}
