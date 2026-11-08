import { z } from "zod";
import { SHOPIFY_API_VERSION } from "./config.ts";

export function shopifyTenantLinkingEnabled(env: NodeJS.ProcessEnv) {
  return env.SHOPIFY_TENANT_LINKING_ENABLED === "true" &&
    env.SHOPIFY_CONNECTION_SCREEN_ENABLED === "true" && env.SHOPIFY_OAUTH_ENABLED === "true" &&
    env.SHOPIFY_UNIFIED_ORDERS_ENABLED === "true" && env.VERCEL_ENV === "production" &&
    env.SHOPIFY_DEPLOYMENT_ENV === "production" && env.SHOPIFY_API_VERSION === SHOPIFY_API_VERSION;
}

export function shopifyTenantEligible(tenantId: string, env: NodeJS.ProcessEnv) {
  const pilot = env.SHOPIFY_TENANT_LINKING_PILOT_TENANT_ID;
  return z.string().uuid().safeParse(tenantId).success &&
    (tenantId === env.SHOPIFY_CONNECTION_TEST_TENANT_ID ||
      shopifyTenantLinkingEnabled(env) && (!pilot || tenantId === pilot));
}

// Only the server's actor-scoped connection lookup creates this environment.
const verifiedDomains = new WeakMap<NodeJS.ProcessEnv, { tenantId: string; shopDomain: string }>();

export function withShopifyTenantDomain(env: NodeJS.ProcessEnv, tenantId: string, shopDomain: string) {
  const scoped = { ...env, SHOPIFY_SHOP_DOMAIN: shopDomain };
  verifiedDomains.set(scoped, { tenantId, shopDomain });
  return scoped;
}

export function hasShopifyTenantDomain(env: NodeJS.ProcessEnv, tenantId: string) {
  const binding = verifiedDomains.get(env);
  return binding?.tenantId === tenantId && binding.shopDomain === env.SHOPIFY_SHOP_DOMAIN;
}
