import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { beginShopifyApproval, validateShopifyApprovalCallback, exchangeShopifyApprovalToken } from "../src/integrations/shopify/oauth.ts";
import { sealShopifyCredential, openShopifyCredential } from "../src/integrations/shopify/oauth-crypto.ts";

const actor = { userId: "fictional-owner", tenantId: "10000000-0000-4000-8000-000000000001",
  role: "owner_admin", membershipUserId: "fictional-owner",
  membershipTenantId: "10000000-0000-4000-8000-000000000001", membershipStatus: "active", tenantStatus: "active" };
const env = { SHOPIFY_OAUTH_ENABLED: "true", SHOPIFY_CONNECTION_TEST_TENANT_ID: actor.tenantId,
  VERCEL_ENV: "production", SHOPIFY_DEPLOYMENT_ENV: "production",
  SHOPIFY_CLIENT_ID: "fictional-app", SHOPIFY_CLIENT_SECRET: "fictional-secret",
  SHOPIFY_APPLICATION_ORIGIN: "https://osplus.example" };

test("owner approval is bound to the selected tenant and canonical shop, not the global pilot shop", () => {
  const approval = beginShopifyApproval(actor, " DIFFERENT.myshopify.com ", env, 1_800_000_000_000);
  const url = new URL(approval.url);
  assert.equal(url.origin, "https://different.myshopify.com");
  assert.equal(url.pathname, "/admin/oauth/authorize");
  assert.equal(url.searchParams.get("redirect_uri"), "https://osplus.example/api/integrations/shopify/oauth/callback");
  assert.equal(url.searchParams.get("scope"), "read_orders,read_customers,read_products");
  assert.equal(approval.attempt.tenantId, actor.tenantId);
  assert.equal(approval.attempt.actorId, actor.userId);
  assert.equal(approval.attempt.shopDomain, "different.myshopify.com");
  assert.equal(approval.attempt.expiresAt, "2027-01-15T08:10:00.000Z");
  assert.match(approval.cookie, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(approval.attempt.stateHash, approval.cookie);
  assert.equal(url.searchParams.get("state"), approval.cookie);
  assert.ok(!JSON.stringify(approval).includes(env.SHOPIFY_CLIENT_SECRET));
  assert.notEqual(beginShopifyApproval(actor, "different.myshopify.com", env).cookie, approval.cookie);
});

test("encrypted credentials cannot be transplanted across tenants, shops or apps and use a separate key ring", () => {
  const binding = { tenantId: actor.tenantId, shopDomain: "different.myshopify.com", appRef: env.SHOPIFY_CLIENT_ID };
  const keys = { SHOPIFY_CREDENTIAL_KEY_ID: "test-v1", SHOPIFY_CREDENTIAL_ENCRYPTION_KEYS_JSON:
    JSON.stringify({ "test-v1": Buffer.alloc(32, 19).toString("base64") }) };
  const token = { accessToken: "fictional-access", refreshToken: "fictional-refresh",
    accessExpiresAt: "2027-01-15T09:00:00.000Z", refreshExpiresAt: "2027-04-15T08:00:00.000Z",
    scopes: ["read_orders", "read_customers", "read_products"] };
  const packet = sealShopifyCredential(token, binding, keys);
  assert.ok(!JSON.stringify(packet).includes("fictional"));
  assert.deepEqual(openShopifyCredential(packet, binding, keys), token);
  for (const other of [{ ...binding, tenantId: "20000000-0000-4000-8000-000000000002" },
    { ...binding, shopDomain: "other.myshopify.com" }, { ...binding, appRef: "other-app" }]) {
    assert.throws(() => openShopifyCredential(packet, other, keys), /RESPONSE_INVALID/);
  }
  assert.throws(() => openShopifyCredential(packet, binding, {
    SHOPIFY_SOURCE_KEY_ID: "test-v1", SHOPIFY_SOURCE_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString("base64"),
  }), /CONFIGURATION_INVALID/);
});

test("offline exchange requests expiring credentials and bounds source errors without exposing secrets", async () => {
  const payload = { access_token: "fictional-access", refresh_token: "fictional-refresh",
    expires_in: 3600, refresh_token_expires_in: 7776000, scope: "read_orders,read_customers,read_products" };
  const now = 1_800_000_000_000;
  const result = await exchangeShopifyApprovalToken("different.myshopify.com", { code: "fictional-code" },
    env, new AbortController().signal, async (url, init) => {
      assert.equal(url, "https://different.myshopify.com/admin/oauth/access_token");
      assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
      assert.equal(init.body.get("expiring"), "1"); assert.equal(init.body.get("code"), "fictional-code");
      return Response.json(payload);
    }, () => now);
  assert.equal(result.accessToken, payload.access_token);
  assert.equal(result.accessExpiresAt, new Date(now + 3600000).toISOString());
  assert.equal(result.refreshExpiresAt, new Date(now + 7776000000).toISOString());
  for (const response of [
    Response.json({ ...payload, scope: "read_products" }),
    Response.json({ ...payload, refresh_token: undefined }),
    Response.json({ ...payload, expires_in: 20 }),
    new Response("SECRET-UPSTREAM-BODY", { status: 401 }),
    new Response("x".repeat(33000)),
  ]) {
    await assert.rejects(() => exchangeShopifyApprovalToken("different.myshopify.com", { code: "fictional-code" },
      env, new AbortController().signal, async () => response, () => now),
    error => !error.message.includes("SECRET") && /RESPONSE_INVALID|ACCESS_DENIED|AUTHENTICATION_REQUIRED|BODY_TOO_LARGE/.test(error.message));
  }
  await exchangeShopifyApprovalToken("different.myshopify.com", { refreshToken: payload.refresh_token }, env,
    new AbortController().signal, async (_url, init) => {
      assert.equal(init.body.get("grant_type"), "refresh_token");
      assert.equal(init.body.get("refresh_token"), payload.refresh_token);
      assert.equal(init.body.has("code"), false);
      return Response.json(payload);
    }, () => now);
});

function signed(approval, overrides = {}) {
  const params = new URLSearchParams({ code: "fictional-code", shop: approval.attempt.shopDomain,
    state: approval.cookie, timestamp: "1800000000", ...overrides });
  const message = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => `${k}=${v}`).join("&");
  params.set("hmac", createHmac("sha256", env.SHOPIFY_CLIENT_SECRET).update(message).digest("hex"));
  return params;
}

test("callback requires matching owner, tenant, cookie, shop, signature and an unexpired attempt", () => {
  const now = 1_800_000_000_000, approval = beginShopifyApproval(actor, "different.myshopify.com", env, now);
  const run = (params = signed(approval), cookie = approval.cookie, attempt = approval.attempt,
    who = actor, at = now) => validateShopifyApprovalCallback(who, params, cookie, attempt, env, at);
  assert.deepEqual(run(), { code: "fictional-code", shopDomain: approval.attempt.shopDomain,
    stateHash: approval.attempt.stateHash });
  for (const input of [
    () => run(signed(approval, { shop: "foreign.myshopify.com" })),
    () => run(signed(approval, { timestamp: "1799990000" })),
    () => run(signed(approval, { state: "a".repeat(43) })),
    () => run(signed(approval), "a".repeat(43)),
    () => run(signed(approval), approval.cookie, { ...approval.attempt, actorId: "different-owner" }),
    () => run(signed(approval), approval.cookie, approval.attempt, { ...actor, role: "manager" }),
    () => run(signed(approval), approval.cookie, approval.attempt, actor, now + 600_001),
    () => { const q = signed(approval); q.set("code", "tampered"); return run(q); },
    () => { const q = signed(approval); q.append("shop", "foreign.myshopify.com"); return run(q); },
  ]) assert.throws(input, /ACCESS_DENIED|REQUEST_INVALID/);
  const foreign = { ...actor, tenantId: "20000000-0000-4000-8000-000000000002",
    membershipTenantId: "20000000-0000-4000-8000-000000000002" };
  assert.throws(() => beginShopifyApproval(foreign, "different.myshopify.com", env), /ACCESS_DENIED/);
});

test("aborted OAuth exchange is bounded even when the transport ignores cancellation", {timeout:1000}, async () => {
  const controller = new AbortController();
  const pending = exchangeShopifyApprovalToken("different.myshopify.com", { code: "fictional-code" },
    env, controller.signal, () => new Promise(() => {}));
  controller.abort();
  await assert.rejects(pending, /UPSTREAM_UNAVAILABLE/);
});
