import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalShopDomain } from "./config.ts";
import { assertShopifyProbeActor, type ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { z } from "zod";
import { readBoundedBody } from "./bounded-body.ts";

export const SHOPIFY_OAUTH_CALLBACK = "/api/integrations/shopify/oauth/callback";
export const SHOPIFY_OAUTH_SCOPES = ["read_orders", "read_customers", "read_products"] as const;
export type ShopifyApprovalAttempt = {
  tenantId: string; actorId: string; shopDomain: string; appRef: string;
  stateHash: string; expiresAt: string;
};

// Rollout remains Test-only. A later approved rollout can widen this explicit
// gate; choosing a different shop must never change the current tenant.
export function getShopifyOAuthConfig(actor: ShopifyProbeActor, env: NodeJS.ProcessEnv, purpose: "owner" | "credential" = "owner") {
  if (purpose === "credential" && actor.role === "manager") {
    if (!actor.userId || actor.userId !== actor.membershipUserId || actor.tenantId !== actor.membershipTenantId ||
      !z.string().uuid().safeParse(actor.tenantId).success || actor.membershipStatus !== "active" || actor.tenantStatus !== "active")
      throw new ShopifyIntegrationError("ACCESS_DENIED");
  } else assertShopifyProbeActor(actor);
  if (env.SHOPIFY_OAUTH_ENABLED !== "true" || actor.tenantId !== env.SHOPIFY_CONNECTION_TEST_TENANT_ID)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  if (env.VERCEL_ENV !== "production" || env.SHOPIFY_DEPLOYMENT_ENV !== "production")
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  let origin: URL;
  try {
    origin = new URL(env.SHOPIFY_APPLICATION_ORIGIN ?? "");
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.port ||
      origin.pathname !== "/" || origin.search || origin.hash) throw new Error();
  } catch { throw new ShopifyIntegrationError("CONFIGURATION_INVALID"); }
  const clientId = env.SHOPIFY_CLIENT_ID ?? "", clientSecret = env.SHOPIFY_CLIENT_SECRET ?? "";
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(clientId) || !clientSecret || clientSecret.length > 4096 ||
    /[\s\x00-\x1f\x7f]/.test(clientSecret)) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return { origin: origin.origin, clientId, clientSecret };
}

export function beginShopifyApproval(actor: ShopifyProbeActor, shop: string, env: NodeJS.ProcessEnv, now = Date.now()) {
  const config = getShopifyOAuthConfig(actor, env), shopDomain = canonicalShopDomain(shop);
  const cookie = randomBytes(32).toString("base64url");
  const attempt: ShopifyApprovalAttempt = {
    tenantId: actor.tenantId, actorId: actor.userId, shopDomain, appRef: config.clientId,
    stateHash: createHash("sha256").update(cookie).digest("hex"),
    expiresAt: new Date(now + 600_000).toISOString(),
  };
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.search = new URLSearchParams({ client_id: config.clientId, scope: SHOPIFY_OAUTH_SCOPES.join(","),
    redirect_uri: config.origin + SHOPIFY_OAUTH_CALLBACK, state: cookie }).toString();
  // The caller persists only attempt; cookie is Secure/HttpOnly/SameSite=Lax.
  return { url: url.toString(), cookie, attempt };
}

export function validateShopifyApprovalCallback(actor: ShopifyProbeActor, query: URLSearchParams,
  cookie: string, attempt: ShopifyApprovalAttempt, env: NodeJS.ProcessEnv, now = Date.now()) {
  const config = getShopifyOAuthConfig(actor, env);
  const denied = () => { throw new ShopifyIntegrationError("ACCESS_DENIED"); };
  if (query.toString().length > 16_384) throw new ShopifyIntegrationError("REQUEST_INVALID");
  const entries = [...query.entries()], names = entries.map(([key]) => key);
  if (new Set(names).size !== names.length || entries.some(([key, value]) =>
    !/^[a-zA-Z0-9_]+$/.test(key) || /[\x00-\x1f\x7f]/.test(value))) denied();
  const state = query.get("state") ?? "", hmac = query.get("hmac") ?? "";
  const code = query.get("code") ?? "", shopDomain = canonicalShopDomain(query.get("shop") ?? "");
  const timestamp = query.get("timestamp") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(cookie) || !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(state)) || !/^[a-f0-9]{64}$/.test(hmac) ||
    !/^[A-Za-z0-9_-]{1,2048}$/.test(code) || !/^[0-9]{10,11}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp) * 1000) > 600_000) denied();
  const stateHash = createHash("sha256").update(state).digest("hex");
  if (attempt.tenantId !== actor.tenantId || attempt.actorId !== actor.userId ||
    attempt.shopDomain !== shopDomain || attempt.appRef !== config.clientId || attempt.stateHash !== stateHash ||
    !Number.isFinite(Date.parse(attempt.expiresAt)) || Date.parse(attempt.expiresAt) <= now ||
    Date.parse(attempt.expiresAt) > now + 600_000) denied();
  const message = entries.filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("&");
  const expected = createHmac("sha256", config.clientSecret).update(message).digest("hex");
  if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) denied();
  // DB must atomically consume this hash BEFORE exchanging the code. Validation
  // alone is not replay protection. No callback tenant/shop is an authority.
  return { code, shopDomain, stateHash };
}

const secret = z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/);
export const shopifyOAuthTokenSchema = z.object({
  accessToken: secret, refreshToken: secret,
  accessExpiresAt: z.string().datetime(), refreshExpiresAt: z.string().datetime(),
  scopes: z.array(z.string().min(1).max(128)).max(512),
}).strict();
export type ShopifyOAuthToken = z.infer<typeof shopifyOAuthTokenSchema>;

// Server-only primitive. Callers authorize tenant/connection and hold a durable
// one-use attempt or refresh lease before using it. Never retry a code exchange
// or token rotation automatically after an ambiguous network result.
export async function exchangeShopifyApprovalToken(shop: string, grant: { code: string } | { refreshToken: string },
  env: NodeJS.ProcessEnv, signal: AbortSignal, transport: typeof fetch = fetch, now = Date.now): Promise<ShopifyOAuthToken> {
  const shopDomain = canonicalShopDomain(shop), started = now();
  const clientId = env.SHOPIFY_CLIENT_ID ?? "", clientSecret = env.SHOPIFY_CLIENT_SECRET ?? "";
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(clientId) || !secret.safeParse(clientSecret).success)
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  const code = "code" in grant ? grant.code : null;
  const value = code ?? ("refreshToken" in grant ? grant.refreshToken : "");
  if (!secret.safeParse(value).success) throw new ShopifyIntegrationError("REQUEST_INVALID");
  const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(10000)]);
  let rejectAbort=()=>{};
  const aborted=new Promise<never>((_,reject)=>{
    rejectAbort=()=>reject(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE"));
    requestSignal.addEventListener("abort",rejectAbort,{once:true});
  });
  try {
    if(requestSignal.aborted)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
    const response = await Promise.race([transport(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST", redirect: "error", cache: "no-store",
      signal: requestSignal,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret,
        ...(code ? { code, expiring: "1" } : { grant_type: "refresh_token", refresh_token: value }) }),
    }),aborted]);
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      throw new ShopifyIntegrationError([400, 401, 403].includes(response.status) ? "AUTHENTICATION_REQUIRED" :
        response.status === 429 ? "THROTTLED" : "UPSTREAM_UNAVAILABLE");
    }
    const bytes = await readBoundedBody(response.body, 32768, requestSignal);
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new ShopifyIntegrationError("RESPONSE_INVALID"); }
    const parsed = z.object({ access_token: secret, refresh_token: secret, scope: z.string().max(8192),
      expires_in: z.number().int().min(61).max(86400),
      refresh_token_expires_in: z.number().int().min(61).max(7776000) }).safeParse(raw);
    if (!parsed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
    const data = parsed.data, scopes = [...new Set(data.scope.split(/[,\s]+/).filter(Boolean))];
    if (SHOPIFY_OAUTH_SCOPES.some(scope => !scopes.includes(scope) && !scopes.includes(scope.replace("read_", "write_"))))
      throw new ShopifyIntegrationError("ACCESS_DENIED");
    const accessExpires = started + data.expires_in * 1000, refreshExpires = started + data.refresh_token_expires_in * 1000;
    if (Math.min(accessExpires, refreshExpires) <= now() + 60000)
      throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
    return shopifyOAuthTokenSchema.parse({ accessToken: data.access_token, refreshToken: data.refresh_token,
      accessExpiresAt: new Date(accessExpires).toISOString(), refreshExpiresAt: new Date(refreshExpires).toISOString(), scopes });
  } catch (error) {
    if (error instanceof ShopifyIntegrationError) throw error;
    throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
  } finally { requestSignal.removeEventListener("abort",rejectAbort); }
}
