import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { getShopifyApplicationConfig, getShopifyManagerConfig } from "./application-config.ts";
import { canonicalShopDomain } from "./config.ts";
import { createShopifyOAuthService } from "./oauth-service.ts";
import { createShopifyOAuthStorage } from "./oauth-store.ts";
import { createShopifyTokenProvider } from "./client-credentials.ts";
import { createShopifyPilotCredentialReader } from "./pilot-credentials.ts";
import { assertShopifyHydrationContext, type ShopifyHydrationContext } from "./hydration-contract.ts";
import { ShopifyIntegrationError } from "./errors.ts";

type Db = Pick<SupabaseClient<Database>, "rpc">;
const connectionSchema = z.object({ tenantId: z.string().uuid(), connectionId: z.string().uuid(),
  shopDomain: z.string(), appRef: z.string(), shopGid: z.string(), hasCredential: z.boolean() }).strict();
export async function readShopifyTenantConnection(db: Db, tenantId: string, actorId: string,
  signal: AbortSignal, env: NodeJS.ProcessEnv = process.env) {
  if (env.SHOPIFY_OAUTH_ENABLED !== "true") return null;
  if (tenantId !== env.SHOPIFY_CONNECTION_TEST_TENANT_ID || env.VERCEL_ENV !== "production" ||
    env.SHOPIFY_DEPLOYMENT_ENV !== "production") throw new ShopifyIntegrationError("ACCESS_DENIED");
  const result = await db.rpc("shopify_oauth_storage", { p_tenant_id: tenantId, p_actor_id: actorId,
    p_action: "read_connection", p_input: {} }).abortSignal(signal);
  if (result.error) throw new ShopifyIntegrationError("CONNECTION_UNAVAILABLE");
  if (result.data === null) return null;
  const connection = connectionSchema.parse(result.data);
  if (connection.tenantId !== tenantId || connection.appRef !== env.SHOPIFY_CLIENT_ID ||
    canonicalShopDomain(connection.shopDomain) !== connection.shopDomain)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  return connection;
}

// Request-local compatibility context for the existing import guards. Never
// mutate process.env, never derive this from browser domain/tenant fields.
export async function resolveShopifyTenantEnvironment(db: Db, tenantId: string, actorId: string,
  signal: AbortSignal, env: NodeJS.ProcessEnv = process.env): Promise<NodeJS.ProcessEnv> {
  const connection = await readShopifyTenantConnection(db, tenantId, actorId, signal, env);
  return connection ? { ...env, SHOPIFY_SHOP_DOMAIN: connection.shopDomain } : env;
}

export async function readShopifyTenantToken(db: Db, actor: ShopifyProbeActor, signal: AbortSignal,
  env: NodeJS.ProcessEnv, transport: typeof fetch = fetch, now = Date.now) {
  const connection = await readShopifyTenantConnection(db, actor.tenantId, actor.userId, signal, env);
  if (connection?.hasCredential) {
    const lease = await createShopifyOAuthService(createShopifyOAuthStorage(db), transport, now)
      .credential(actor, connection.connectionId, signal, env);
    if (!lease || lease.shopDomain !== connection.shopDomain || lease.appRef !== connection.appRef)
      throw new ShopifyIntegrationError("ACCESS_DENIED");
    return lease;
  }
  // Legacy pilot is preserved only when no OAuth credential was ever stored.
  // A corrupt, revoked, expired or unavailable OAuth record never falls back.
  const scoped = connection ? { ...env, SHOPIFY_SHOP_DOMAIN: connection.shopDomain } : env;
  const config = actor.role === "manager" ? getShopifyManagerConfig(actor, scoped) : getShopifyApplicationConfig(actor, scoped);
  const lease = await createShopifyTokenProvider(transport, now).getTokenLease(config);
  return { ...lease, tenantId: actor.tenantId, connectionId: connection?.connectionId ?? null,
    shopDomain: config.shopDomain, appRef: config.clientId };
}

export function createShopifyTenantCredentialReader(db: Db, actor: ShopifyProbeActor, transport: typeof fetch = fetch, now = Date.now) {
  const pilot = createShopifyPilotCredentialReader(transport, now);
  return async (context: ShopifyHydrationContext, signal: AbortSignal, env: NodeJS.ProcessEnv = process.env) => {
    if (env.SHOPIFY_OAUTH_ENABLED !== "true") return pilot(context, signal, env);
    assertShopifyHydrationContext(context, env);
    const lease = await readShopifyTenantToken(db, actor, signal, env, transport, now);
    if (lease.tenantId !== context.tenantId || lease.connectionId !== context.connectionId ||
      lease.shopDomain !== context.shopDomain || lease.appRef !== context.appRef)
      throw new ShopifyIntegrationError("ACCESS_DENIED");
    return { tenantId: context.tenantId, connectionId: context.connectionId, shopGid: context.shopGid,
      appRef: context.appRef, environment: context.environment, connectionRevision: context.revision,
      accessToken: lease.accessToken, expiresAt: lease.expiresAt };
  };
}
