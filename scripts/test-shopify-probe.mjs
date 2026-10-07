import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { z } from "zod";
import { canonicalShopDomain } from "../src/integrations/shopify/config.ts";
import { readBoundedBody } from "../src/integrations/shopify/bounded-body.ts";
import { readShopifyProbeGraphQL } from "../src/integrations/shopify/client.ts";
import { getShopifyProbeConfig } from "../src/integrations/shopify/probe-config.ts";
import { createShopifyTokenProvider } from "../src/integrations/shopify/client-credentials.ts";
import { createShopifyConnectionTester } from "../src/integrations/shopify/connection-test.ts";
import { createShopifyProbeHandler } from "../src/integrations/shopify/probe-handler.ts";
import { readShopifyProbeActor } from "../src/integrations/shopify/probe-actor-reader.ts";
import { ShopifyIntegrationError } from "../src/integrations/shopify/errors.ts";

const tenantId = "10000000-0000-4000-8000-000000000001";
const foreignId = "20000000-0000-4000-8000-000000000002";
const actor = { userId: "user_synthetic", tenantId, role: "owner_admin", membershipUserId: "user_synthetic",
  membershipTenantId: tenantId, membershipStatus: "active", tenantStatus: "active" };
const env = { SHOPIFY_CONNECTION_TEST_ENABLED: "true", SHOPIFY_CONNECTION_TEST_TENANT_ID: tenantId,
  SHOPIFY_SYNC_ENABLED: "false", SHOPIFY_API_VERSION: "2026-10", SHOPIFY_DEPLOYMENT_ENV: "production",
  VERCEL_ENV: "production", SHOPIFY_CLIENT_ID: "synthetic-client", SHOPIFY_CLIENT_SECRET: "synthetic-secret",
  SHOPIFY_SHOP_DOMAIN: "synthetic-probe.myshopify.com", SHOPIFY_APPLICATION_ORIGIN: "https://synthetic-os-plus.example" };
const scopes = "read_orders,read_customers,read_products";
const token = { access_token: "synthetic-access-token", expires_in: 86399, scope: scopes };
const data = { shop: { id: "gid://shopify/Shop/123", myshopifyDomain: env.SHOPIFY_SHOP_DOMAIN },
  currentAppInstallation: { accessScopes: scopes.split(",").map(handle => ({ handle })) } };
const code = expected => error => error instanceof ShopifyIntegrationError && error.code === expected;
const tokenResponse = payload => new Response(JSON.stringify(payload), { status: 200 });
const graphResponse = payload => new Response(JSON.stringify(payload), { headers: { "X-Shopify-API-Version": "2026-10" } });
const request = (body = {}, options = {}) => new Request(`${env.SHOPIFY_APPLICATION_ORIGIN}/api/integrations/shopify/test-connection`, {
  method: "POST", headers: { origin: env.SHOPIFY_APPLICATION_ORIGIN, "content-type": "application/json", ...options.headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const pipeline = (transport, selectedActor = actor) => createShopifyProbeHandler({
  getActor: async () => selectedActor, testConnection: createShopifyConnectionTester(transport),
});
const noTransport = () => assert.fail("Unauthorized request must never contact Shopify");

const transportInput = { shopDomain: env.SHOPIFY_SHOP_DOMAIN, connectionEnvironment: "production",
  accessToken: token.access_token, query: "query ProbeTransport { shop { id } }",
  schema: z.object({ shop: z.object({ id: z.string().startsWith("gid://shopify/Shop/") }) }) };
const readGraph = (input, transport) => readShopifyProbeGraphQL(input, actor, transport, env);

test("canonical host allowlist rejects credential-leak and SSRF-style targets", () => {
  assert.equal(canonicalShopDomain(" SYNTHETIC-PROBE.myshopify.com "), env.SHOPIFY_SHOP_DOMAIN);
  for (const host of ["localhost", "127.0.0.1", "https://safe.myshopify.com", "safe.myshopify.com.evil.test",
    "safe.myshopify.com@evil.test", "safe.myshopify.com:443", "safe.myshopify.com/", "safe.myshopify.com.",
    "a.b.myshopify.com", "-bad.myshopify.com", "bad-.myshopify.com", "a".repeat(64) + ".myshopify.com",
    "sаfe.myshopify.com", "safe.myshopify.com\r\nX-Test: bad"]) {
    assert.throws(() => canonicalShopDomain(host), code("SHOP_DOMAIN_INVALID"));
  }
});

test("bounded reader cancels chunked overflow, releases its lock and accepts exact limits", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(Buffer.alloc(4)); controller.enqueue(Buffer.alloc(4));
  }, cancel() { cancelled = true; } });
  await assert.rejects(() => readBoundedBody(body, 7), code("BODY_TOO_LARGE"));
  assert.equal(cancelled, true); assert.equal(body.locked, false);
  assert.deepEqual(await readBoundedBody(new Response("abcd").body, 4), Buffer.from("abcd"));
  assert.equal((await readBoundedBody(null, 4)).length, 0);
  for (const limit of [0, -1, 0.5, Infinity]) {
    await assert.rejects(() => readBoundedBody(null, limit), code("CONFIGURATION_INVALID"));
  }
});

test("GraphQL HTTP, rate limit and redirect failures never expose upstream bodies", async () => {
  for (const [status, expected] of [[401, "AUTHENTICATION_REQUIRED"], [402, "SHOP_INACTIVE"], [403, "ACCESS_DENIED"],
    [423, "SHOP_INACTIVE"], [429, "THROTTLED"], [503, "UPSTREAM_UNAVAILABLE"], [302, "UPSTREAM_REJECTED"], [400, "UPSTREAM_REJECTED"]]) {
    await assert.rejects(() => readGraph(transportInput, async () => new Response("private synthetic-secret", {
      status, headers: { "Retry-After": "12" },
    })), error => {
      assert.ok(code(expected)(error)); assert.doesNotMatch(String(error), /private|synthetic-secret/);
      if (status === 429) assert.equal(error.retryAfterSeconds, 12);
      return true;
    });
  }
});

test("GraphQL malformed or partial results fail closed with bounded error classification", async () => {
  for (const [extension, expected] of [["ACCESS_DENIED", "ACCESS_DENIED"], ["SHOP_INACTIVE", "SHOP_INACTIVE"],
    ["THROTTLED", "THROTTLED"], ["INTERNAL_SERVER_ERROR", "UPSTREAM_UNAVAILABLE"],
    ["MAX_COST_EXCEEDED", "UPSTREAM_REJECTED"], [undefined, "GRAPHQL_INCOMPLETE"]]) {
    await assert.rejects(() => readGraph(transportInput, async () => graphResponse({ data,
      errors: [{ message: "private details", extensions: { code: extension } }],
      extensions: { cost: { requestedQueryCost: 100, throttleStatus: { currentlyAvailable: 0, restoreRate: 25 } } },
    })), error => {
      assert.ok(code(expected)(error)); assert.doesNotMatch(String(error), /private details/);
      if (extension === "THROTTLED") assert.equal(error.retryAfterSeconds, 4);
      return true;
    });
  }
  for (const payload of [{ data: null }, { data: { shop: {} } }, { errors: "bad" }, []]) {
    await assert.rejects(() => readGraph(transportInput, async () => graphResponse(payload)), code("RESPONSE_INVALID"));
  }
});

test("GraphQL timeout aborts stalled headers with no automatic retry", async () => {
  let attempts = 0;
  await assert.rejects(() => readGraph({ ...transportInput, timeoutMs: 10 }, async (_url, options) => {
    attempts++;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("private timeout")), { once: true }));
  }), code("UPSTREAM_UNAVAILABLE"));
  assert.equal(attempts, 1);
});

test("GraphQL deadline stays active while reading a stalled response body", async () => {
  await assert.rejects(() => readGraph({ ...transportInput, timeoutMs: 10 }, async (_url, options) => {
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(Buffer.from('{"data":'));
      options.signal.addEventListener("abort", () => controller.error(new Error("private body timeout")), { once: true });
    } });
    return new Response(body, { headers: { "X-Shopify-API-Version": "2026-10" } });
  }), code("UPSTREAM_UNAVAILABLE"));
});

test("token and GraphQL responses enforce actual size caps", async () => {
  const tokenHandler = pipeline(async () => tokenResponse({ ...token, extra: "x".repeat(32768) }));
  assert.equal((await tokenHandler(request(), env)).status, 413);
  await assert.rejects(() => readGraph(transportInput, async () => graphResponse({ data: "x".repeat(2 * 1024 * 1024) })), code("BODY_TOO_LARGE"));
});

test("probe transport itself checks actor, deployment, shop and query before any fetch", async () => {
  await assert.rejects(() => readShopifyProbeGraphQL(transportInput, { ...actor, role: "manager" }, noTransport, env), code("ACCESS_DENIED"));
  await assert.rejects(() => readShopifyProbeGraphQL(transportInput, actor, noTransport, { ...env, VERCEL_ENV: "preview" }), code("CONFIGURATION_INVALID"));
  await assert.rejects(() => readGraph({ ...transportInput, shopDomain: "foreign.myshopify.com" }, noTransport), code("ACCESS_DENIED"));
  for (const patch of [{ query: "mutation ChangeShop { shop { id } }" }, { accessToken: "bad\r\nheader" }, { timeoutMs: 30001 }]) {
    await assert.rejects(() => readGraph({ ...transportInput, ...patch }, noTransport), code("CONFIGURATION_INVALID"));
  }
});

test("real handler/token/GraphQL path verifies only metadata and never returns secrets or customer data", async () => {
  const calls = [];
  const handler = pipeline(async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    if (url.endsWith("/access_token")) {
      assert.equal(options.body.get("grant_type"), "client_credentials");
      assert.equal(options.body.get("client_secret"), env.SHOPIFY_CLIENT_SECRET);
      return tokenResponse({ ...token, unexpected_secret: "must-not-be-returned" });
    }
    assert.equal(url, `https://${env.SHOPIFY_SHOP_DOMAIN}/admin/api/2026-10/graphql.json`);
    assert.equal(options.headers["X-Shopify-Access-Token"], token.access_token);
    const query = JSON.parse(options.body).query;
    assert.match(query, /^query OSPlusConnectionProbe/);
    assert.doesNotMatch(query, /customers\s*\(|orders\s*\(|mutation|email|phone|address/);
    return graphResponse({ data });
  });
  const response = await handler(request(), env);
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
  const body = await response.json();
  assert.equal(body.status, "verified"); assert.equal(body.tenantId, tenantId);
  assert.equal(body.apiVersion, "2026-10"); assert.equal(body.importsEnabled, false);
  assert.equal(body.messagingEnabled, false); assert.equal(body.protectedCustomerFieldsVerified, false);
  assert.doesNotMatch(JSON.stringify(body), /synthetic-secret|synthetic-access-token|must-not-be-returned|gid:/);
  assert.equal(calls.length, 2);
});

for (const role of ["manager", "finance", "viewer", "super_admin"]) test(`role ${role} cannot probe`, async () => {
  assert.equal((await pipeline(noTransport, { ...actor, role })(request(), env)).status, 403);
});
for (const patch of [{ tenantId: foreignId, membershipTenantId: foreignId }, { membershipTenantId: foreignId },
  { membershipUserId: "user_foreign" }, { membershipStatus: "inactive" }, { tenantStatus: "suspended" }]) {
  test(`actor boundary rejects ${JSON.stringify(patch)}`, async () => {
    assert.equal((await pipeline(noTransport, { ...actor, ...patch })(request(), env)).status, 403);
  });
}
test("anonymous actor rejected before token use", async () => {
  assert.equal((await pipeline(noTransport, null)(request(), env)).status, 401);
});

for (const patch of [{ SHOPIFY_CONNECTION_TEST_ENABLED: "false" }, { SHOPIFY_SYNC_ENABLED: "true" },
  { VERCEL_ENV: "preview" }, { VERCEL_ENV: "development" }, { SHOPIFY_DEPLOYMENT_ENV: "preview" },
  { SHOPIFY_API_VERSION: "2026-07" }, { SHOPIFY_CONNECTION_TEST_TENANT_ID: "" },
  { SHOPIFY_SHOP_DOMAIN: "safe.myshopify.com.evil.example" }, { SHOPIFY_CLIENT_SECRET: "" }]) {
  test(`configuration blocks outbound requests ${JSON.stringify(patch)}`, async () => {
    assert.equal((await pipeline(noTransport)(request(), { ...env, ...patch })).status, 503);
  });
}
for (const body of [{ tenantId: foreignId }, { shopDomain: "evil.example" }, { query: "mutation" },
  { accessToken: "attacker" }, [], "not json", "x".repeat(1025)]) {
  test(`untrusted request input rejected ${JSON.stringify(body).slice(0, 90)}`, async () => {
    const response = await pipeline(noTransport)(request(body), env);
    assert.ok([400, 413].includes(response.status));
  });
}
test("cross-site, missing Origin, content-type and GET are rejected", async () => {
  const handler = pipeline(noTransport);
  for (const headers of [{ origin: "https://evil.example" }, { origin: "null" },
    { "sec-fetch-site": "cross-site" }, { "content-type": "text/plain" }]) {
    assert.ok([400, 403].includes((await handler(request({}, { headers }), env)).status));
  }
  const missing = request(); missing.headers.delete("origin");
  assert.equal((await handler(missing, env)).status, 403);
  assert.equal((await handler(new Request(env.SHOPIFY_APPLICATION_ORIGIN), env)).status, 405);
});

test("memory token cache single-flights requests, renews before expiry, and isolates tenant/credential changes", async () => {
  let clock = 0; let calls = 0;
  const provider = createShopifyTokenProvider(async () => { calls++; return tokenResponse(token); }, () => clock);
  const config = getShopifyProbeConfig(actor, env);
  await Promise.all(Array.from({ length: 10 }, () => provider.getToken(config)));
  assert.equal(calls, 1);
  clock = 86300 * 1000; await provider.getToken(config); assert.equal(calls, 1);
  clock = 86340 * 1000; await provider.getToken(config); assert.equal(calls, 2);
  await provider.getToken({ ...config, clientSecret: "synthetic-rotated" }); assert.equal(calls, 3);
  await provider.getToken({ ...config, tenantId: foreignId }); assert.equal(calls, 4);
  provider.invalidate(); await provider.getToken(config); assert.equal(calls, 5);
});
test("failed synchronous token transport does not poison the cache, and errors never expose secrets", async () => {
  let failed = true;
  const provider = createShopifyTokenProvider(() => {
    if (failed) throw new Error("synthetic-secret synthetic-access-token");
    return Promise.resolve(tokenResponse(token));
  });
  const config = getShopifyProbeConfig(actor, env);
  await assert.rejects(() => provider.getToken(config), code("UPSTREAM_UNAVAILABLE"));
  failed = false; assert.equal(await provider.getToken(config), token.access_token);
});
for (const payload of [{ ...token, expires_in: 0 }, { ...token, expires_in: 86401 },
  { ...token, expires_in: "86399" }, { ...token, access_token: "bad\r\nheader" },
  { ...token, scope: "read_products" }]) {
  test(`malformed/missing-scope tokens fail closed ${JSON.stringify(payload)}`, async () => {
    const handler = pipeline(async () => tokenResponse(payload));
    const response = await handler(request(), env);
    assert.ok([403, 503].includes(response.status));
    assert.doesNotMatch(await response.text(), /synthetic-secret|synthetic-access-token/);
  });
}
test("401 invalidates cached token; next attempt reacquires, not an unbounded retry", async () => {
  let tokens = 0; let graphs = 0;
  const handler = pipeline(async url => {
    if (url.endsWith("/access_token")) { tokens++; return tokenResponse(token); }
    graphs++; return graphs === 1 ? new Response("secret detail", { status: 401 }) : graphResponse({ data });
  });
  assert.equal((await handler(request(), env)).status, 503);
  assert.equal((await handler(request(), env)).status, 200);
  assert.equal(tokens, 2); assert.equal(graphs, 2);
});
test("shop identity, scopes, partial errors and response version are independently checked", async () => {
  const scenarios = [
    () => graphResponse({ data: { ...data, shop: { ...data.shop, myshopifyDomain: "foreign.myshopify.com" } } }),
    () => graphResponse({ data: { ...data, currentAppInstallation: { accessScopes: [{ handle: "read_products" }] } } }),
    () => graphResponse({ data, errors: [{ message: "private error synthetic-secret" }] }),
    () => new Response(JSON.stringify({ data }), { headers: { "X-Shopify-API-Version": "2026-07" } }),
  ];
  for (const scenario of scenarios) {
    const handler = pipeline(async url => url.endsWith("/access_token") ? tokenResponse(token) : scenario());
    const response = await handler(request(), env);
    assert.notEqual(response.status, 200);
    assert.doesNotMatch(await response.text(), /synthetic-secret|private error/);
  }
});

function database(members, tenant = { id: tenantId, status: "active" }, error = null) {
  const filters = [];
  const db = { from(table) {
    assert.ok(["tenants", "tenant_users"].includes(table));
    const query = { select(fields) { filters.push([table, "select", fields]); return query; },
      eq(field, value) { filters.push([table, field, value]); return query; },
      async limit(value) { assert.equal(value, 2); return { data: members, error }; },
      async maybeSingle() { return { data: tenant, error }; } };
    return query;
  } };
  return { db, filters };
}
test("actual actor resolver uses current tenant/user/active filters and performs no writes", async () => {
  const member = { tenant_id: tenantId, clerk_user_id: actor.userId, role: "owner_admin", status: "active" };
  const { db, filters } = database([member]);
  assert.deepEqual(await readShopifyProbeActor(actor.userId, tenantId, db), actor);
  for (const filter of [["tenant_users", "tenant_id", tenantId], ["tenant_users", "clerk_user_id", actor.userId],
    ["tenant_users", "status", "active"], ["tenants", "id", tenantId], ["tenants", "status", "active"]]) {
    assert.ok(filters.some(actual => JSON.stringify(actual) === JSON.stringify(filter)));
  }
  for (const members of [[], [member, member]]) {
    assert.equal(await readShopifyProbeActor(actor.userId, tenantId, database(members).db), null);
  }
  assert.equal(await readShopifyProbeActor(actor.userId, tenantId, database([member], null).db), null);
  assert.equal(await readShopifyProbeActor(actor.userId, tenantId, database([member], undefined, { message: "private DB error" }).db), null);
  const { db: untouched, filters: noReads } = database([member]);
  assert.equal(await readShopifyProbeActor(null, tenantId, untouched), null);
  assert.equal(await readShopifyProbeActor(actor.userId, "bad-id", untouched), null);
  assert.equal(noReads.length, 0);
});
test("real route is protected, wires actual handler, and slice has no business-write/messaging operations", () => {
  const route = readFileSync(new URL("../src/app/api/integrations/shopify/test-connection/route.ts", import.meta.url), "utf8");
  assert.match(route, /getActor: getShopifyProbeActor/); assert.match(route, /testConnection: createShopifyConnectionTester/);
  assert.match(route, /export async function POST/); assert.doesNotMatch(route, /export.*GET/);
  const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(proxy, /shopify|\/api\/\(\.\*\)/);
  for (const name of ["probe-actor.ts", "probe-actor-reader.ts", "probe-handler.ts", "connection-test.ts"]) {
    const source = readFileSync(new URL(`../src/integrations/shopify/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\.(insert|update|upsert|delete|rpc)\s*\(|sendWhatsApp|sendSms|enqueue/);
  }
});
