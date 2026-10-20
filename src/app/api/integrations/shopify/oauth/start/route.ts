import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { createShopifyOAuthHandlers } from "@/integrations/shopify/oauth-handler";
import { createShopifyOAuthService } from "@/integrations/shopify/oauth-service";
import { createShopifyOAuthStorage } from "@/integrations/shopify/oauth-store";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const service = createShopifyOAuthService(createShopifyOAuthStorage(createSupabaseServiceRoleClient()));
  return createShopifyOAuthHandlers(getShopifyProbeActor, service).start(request);
}
