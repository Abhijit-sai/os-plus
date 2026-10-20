import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { createShopifyOAuthHandlers } from "@/integrations/shopify/oauth-handler";
import { createShopifyOAuthService } from "@/integrations/shopify/oauth-service";
import { createShopifyOAuthStorage } from "@/integrations/shopify/oauth-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;
// Remains behind Clerk. The signed-in owner and selected tenant must match the
// stored approval; an unauthenticated callback cannot create a connection.
export async function GET(request: Request) {
  const service = createShopifyOAuthService(createShopifyOAuthStorage(createSupabaseServiceRoleClient()));
  return createShopifyOAuthHandlers(getShopifyProbeActor, service).callback(request);
}
