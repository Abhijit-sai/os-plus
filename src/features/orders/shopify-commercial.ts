import "server-only";
import { z } from "zod";
import { canonicalShopDomain } from "@/integrations/shopify/config";
import { importedShopifyOrdersVisible } from "@/integrations/shopify/imported-order";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveShopifyTenantEnvironment } from "@/integrations/shopify/tenant-credentials";

// The rollout remains Test-only. Other tenants retain their existing query.
export async function shopifyCommercialReadScope(tenantId: string, role: string, actorId: string, env: NodeJS.ProcessEnv = process.env) {
  if (!importedShopifyOrdersVisible(tenantId, role, env)) return null;
  if(env.SHOPIFY_OAUTH_ENABLED==="true")
    env=await resolveShopifyTenantEnvironment(createSupabaseServiceRoleClient(),tenantId,actorId,AbortSignal.timeout(5000),env);
  return { p_tenant_id: tenantId, p_actor_id: actorId,
    p_domain: canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN ?? ""),
    p_app_ref: z.string().min(1).max(256).parse(env.SHOPIFY_CLIENT_ID) };
}

export const shopifyCommercialSummarySchema = z.array(z.object({
  orderId: z.string().uuid(), reference: z.string().max(256), customerName: z.string().max(513),
  customerPhone: z.string().nullable(), currency: z.string().regex(/^[A-Z]{3}$/), paymentLabel: z.string(),
  total: z.string().regex(/^-?\d+(\.\d{1,6})?$/), received: z.string().regex(/^-?\d+(\.\d{1,6})?$/),
  itemCount: z.number().int().nonnegative().max(1000),
}).strict()).max(50);
