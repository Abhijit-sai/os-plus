import "server-only";

import { z } from "zod";
import { canonicalShopDomain, SHOPIFY_API_VERSION } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

// Construct only from authenticated Clerk identity and fresh canonical DB rows.
export type ShopifyProbeActor = {
  userId: string;
  tenantId: string;
  role: string;
  membershipUserId: string;
  membershipTenantId: string;
  membershipStatus: string;
  tenantStatus: string;
};

export function assertShopifyProbeActor(actor: ShopifyProbeActor) {
  if (!actor.userId || actor.userId !== actor.membershipUserId ||
    actor.tenantId !== actor.membershipTenantId || actor.role !== "owner_admin" ||
    actor.membershipStatus !== "active" || actor.tenantStatus !== "active" ||
    !z.string().uuid().safeParse(actor.tenantId).success) {
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  }
}

export function getShopifyProbeConfig(actor: ShopifyProbeActor, env: NodeJS.ProcessEnv = process.env) {
  assertShopifyProbeActor(actor);
  if (env.SHOPIFY_CONNECTION_TEST_ENABLED !== "true") {
    throw new ShopifyIntegrationError("CONNECTION_TEST_DISABLED");
  }
  // A production shop is never usable from a local or Preview deployment.
  // The OS PLUS Test tenant may run read-only diagnostics on the Production host.
  if (env.VERCEL_ENV !== "production" || env.SHOPIFY_DEPLOYMENT_ENV !== "production" ||
    env.SHOPIFY_SYNC_ENABLED !== "false" || env.SHOPIFY_API_VERSION !== SHOPIFY_API_VERSION ||
    !z.string().uuid().safeParse(env.SHOPIFY_CONNECTION_TEST_TENANT_ID).success) {
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  }
  if (actor.tenantId !== env.SHOPIFY_CONNECTION_TEST_TENANT_ID) {
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  }
  const shopDomain = canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN ?? "");
  const clientId = env.SHOPIFY_CLIENT_ID ?? "";
  const clientSecret = env.SHOPIFY_CLIENT_SECRET ?? "";
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(clientId) || !clientSecret ||
    clientSecret.length > 4096 || /[\s\x00-\x1f\x7f]/.test(clientSecret)) {
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  }
  return { tenantId: actor.tenantId, shopDomain, clientId, clientSecret };
}

export type ShopifyProbeConfig = ReturnType<typeof getShopifyProbeConfig>;
