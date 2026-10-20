import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.ts";
import type { ShopifyOAuthStorage } from "./oauth-service.ts";
import { ShopifyIntegrationError, type ShopifyErrorCode } from "./errors.ts";

export function createShopifyOAuthStorage(db: Pick<SupabaseClient<Database>, "rpc">): ShopifyOAuthStorage {
  return async (actor, action, input, signal) => {
    // Input originates only from the typed service. This conversion is solely
    // the Supabase Json boundary; the SQL validates its values again.
    const payload: Json = JSON.parse(JSON.stringify(input));
    const result = await db.rpc("shopify_oauth_storage", { p_tenant_id: actor.tenantId, p_actor_id: actor.userId,
      p_action: action, p_input: payload }).abortSignal(signal);
    if (result.error) {
      const codes: Record<string, ShopifyErrorCode> = {
        SHOPIFY_ACCESS_DENIED: "ACCESS_DENIED", SHOPIFY_COMMAND_INVALID: "REQUEST_INVALID",
        SHOPIFY_APPROVAL_EXPIRED: "AUTHENTICATION_REQUIRED", SHOPIFY_APPROVAL_USED: "AUTHENTICATION_REQUIRED",
        SHOPIFY_AUTH_REQUIRED: "AUTHENTICATION_REQUIRED", SHOPIFY_REFRESH_BUSY: "CONFIGURATION_BUSY",
        SHOPIFY_STALE_REVISION: "STALE_REVISION", SHOPIFY_BINDING_IMMUTABLE: "REVIEW_REQUIRED",
        SHOPIFY_CONFIGURATION_BUSY: "CONFIGURATION_BUSY",
      };
      throw new ShopifyIntegrationError(codes[result.error.message] ?? "UPSTREAM_UNAVAILABLE");
    }
    return result.data;
  };
}
