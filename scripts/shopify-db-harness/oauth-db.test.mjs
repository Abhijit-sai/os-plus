// Real migrations + proposed OAuth SQL, fictional data, memory-only database.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID, createHmac } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beginShopifyApproval } from "../../src/integrations/shopify/oauth.ts";
import { sealShopifyCredential } from "../../src/integrations/shopify/oauth-crypto.ts";
import { createShopifyOAuthService } from "../../src/integrations/shopify/oauth-service.ts";
import { createShopifyOAuthHandlers } from "../../src/integrations/shopify/oauth-handler.ts";
import { resolveShopifyTenantEnvironment, readShopifyTenantToken } from "../../src/integrations/shopify/tenant-credentials.ts";

const db = new PGlite(), folder = new URL("../../supabase/migrations/", import.meta.url);
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,
    public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for (const file of (await readdir(folder)).filter(f => f.endsWith(".sql")).sort())
    await db.exec((await readFile(new URL(file, folder), "utf8")).replace('create extension if not exists "pgcrypto";', ""));
  await db.exec(await readFile(new URL("../../docs/sql/20261020180000_shopify_oauth_credentials.proposed.sql", import.meta.url), "utf8"));
});
after(() => db.close());
const command = async (actor, action, input) => (await db.query(
  "select public.shopify_oauth_storage($1,$2,$3,$4::jsonb) as result",
  [actor.tenantId, actor.userId, action, JSON.stringify(input)])).rows[0].result;
async function fixture() {
  const tenantId = randomUUID(), actor = { userId: "fictional-owner", tenantId, role: "owner_admin",
    membershipUserId: "fictional-owner", membershipTenantId: tenantId, membershipStatus: "active", tenantStatus: "active" };
  await db.query("insert into tenants(id,name,slug,store_name) values($1::uuid,'Fictional','fictional-'||($1::uuid)::text,'Fictional')", [tenantId]);
  await db.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'fictional-owner','owner_admin','active')", [tenantId]);
  const env = { SHOPIFY_OAUTH_ENABLED: "true", SHOPIFY_CONNECTION_TEST_TENANT_ID: tenantId,
    VERCEL_ENV: "production", SHOPIFY_DEPLOYMENT_ENV: "production", SHOPIFY_CLIENT_ID: "fictional-app",
    SHOPIFY_CLIENT_SECRET: "fictional-secret", SHOPIFY_APPLICATION_ORIGIN: "https://osplus.example",
    SHOPIFY_CREDENTIAL_KEY_ID: "fictional-key", SHOPIFY_CREDENTIAL_ENCRYPTION_KEYS_JSON:
      JSON.stringify({ "fictional-key": Buffer.alloc(32, 19).toString("base64") }) };
  const approval = beginShopifyApproval(actor, `fixture-${tenantId}.myshopify.com`, env);
  const token = { accessToken: "fictional-access", refreshToken: "fictional-refresh",
    accessExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 7776000000).toISOString(),
    scopes: ["read_orders", "read_customers", "read_products"] };
  const packet = sealShopifyCredential(token, approval.attempt, env);
  return { actor, approval, token, packet, env };
}

test("one owner approval stores a bound encrypted credential without enabling imports or replaying the callback", async () => {
  const f = await fixture();
  const start = await command(f.actor, "begin", f.approval.attempt);
  assert.equal(start.status, "pending");
  const input = { stateHash: f.approval.attempt.stateHash };
  const attempt = await command(f.actor, "read_attempt", input);
  assert.equal(attempt.shopDomain, f.approval.attempt.shopDomain);
  const claim = await command(f.actor, "claim", input);
  assert.match(claim.claimToken, /^[a-f0-9-]{36}$/);
  await assert.rejects(command(f.actor, "claim", input), /SHOPIFY_APPROVAL_USED/);
  const racing = beginShopifyApproval(f.actor, f.approval.attempt.shopDomain, f.env);
  await assert.rejects(command(f.actor, "begin", racing.attempt), /SHOPIFY_CONFIGURATION_BUSY/);
  const saved = await command(f.actor, "complete", { ...input, claimToken: claim.claimToken,
    shopGid: "gid://shopify/Shop/987123", packet: f.packet, accessExpiresAt: f.token.accessExpiresAt,
    refreshExpiresAt: f.token.refreshExpiresAt });
  assert.equal(saved.status, "connected");
  const credential = await command(f.actor, "read_credential", { connectionId: saved.connectionId });
  assert.deepEqual(credential.packet, f.packet);
  assert.equal(credential.shopDomain, f.approval.attempt.shopDomain);
  // Public connection service remains pending until separate consent/verification.
  const workspace = (await db.query("select public.read_shopify_unified_workspace($1,$2,$3,$4) as result",
    [f.actor.tenantId, f.actor.userId, f.approval.attempt.shopDomain, f.env.SHOPIFY_CLIENT_ID])).rows[0].result;
  assert.equal(workspace.connection.status, "pending");
  assert.equal(workspace.connection.unified, false);
  await assert.rejects(command(f.actor, "complete", { ...input, claimToken: claim.claimToken,
    shopGid: "gid://shopify/Shop/987123", packet: f.packet,
    accessExpiresAt: f.token.accessExpiresAt, refreshExpiresAt: f.token.refreshExpiresAt }), /SHOPIFY_APPROVAL_USED/);
});

async function connect(f, shopGid) {
  await command(f.actor, "begin", f.approval.attempt);
  const input = { stateHash: f.approval.attempt.stateHash };
  const claim = await command(f.actor, "claim", input);
  return command(f.actor, "complete", { ...input, claimToken: claim.claimToken, shopGid, packet: f.packet,
    accessExpiresAt: f.token.accessExpiresAt, refreshExpiresAt: f.token.refreshExpiresAt });
}

test("foreign tenants, removed owners, browser roles and superseded approvals cannot read or replace credentials", async () => {
  const f = await fixture(), foreign = await fixture(), saved = await connect(f, "gid://shopify/Shop/987124");
  await assert.rejects(command(foreign.actor, "read_credential", { connectionId: saved.connectionId }), /SHOPIFY_ACCESS_DENIED/);
  await assert.rejects(command(foreign.actor, "read_attempt", { stateHash: f.approval.attempt.stateHash }), /SHOPIFY_APPROVAL_EXPIRED/);
  await assert.rejects(command(foreign.actor, "begin", { ...foreign.approval.attempt, shopDomain: f.approval.attempt.shopDomain }), /SHOPIFY_ACCESS_DENIED/);
  await command(foreign.actor, "begin", foreign.approval.attempt);
  const replacement = beginShopifyApproval(foreign.actor, foreign.approval.attempt.shopDomain, foreign.env);
  await command(foreign.actor, "begin", replacement.attempt);
  await assert.rejects(command(foreign.actor, "claim", { stateHash: foreign.approval.attempt.stateHash }), /SHOPIFY_APPROVAL_USED/);
  await db.query("delete from tenant_users where tenant_id=$1", [f.actor.tenantId]);
  await assert.rejects(command(f.actor, "read_credential", { connectionId: saved.connectionId }), /SHOPIFY_ACCESS_DENIED/);
  for (const role of ["anon", "authenticated"]) {
    const permissions = (await db.query(`select has_function_privilege($1,'public.shopify_oauth_storage(uuid,text,text,jsonb)','EXECUTE') as execute,
      has_table_privilege($1,'public.shopify_oauth_credentials','SELECT') as read`, [role])).rows[0];
    assert.deepEqual(permissions, { execute: false, read: false });
  }
});

test("token rotation is leased once, stale writers cannot overwrite reconnect, and unknown outcomes require reconnect", async () => {
  const f = await fixture(), saved = await connect(f, "gid://shopify/Shop/987125");
  const identity = { connectionId: saved.connectionId };
  const credential = await command(f.actor, "read_credential", identity);
  const request = { ...identity, revision: credential.revision };
  const claim = await command(f.actor, "claim_refresh", request);
  assert.match(claim.lease, /^[a-f0-9-]{36}$/);
  await assert.rejects(command(f.actor, "claim_refresh", request), /SHOPIFY_REFRESH_BUSY/);
  assert.equal((await command(f.actor, "read_credential", identity)).refreshPending, true);
  await assert.rejects(command(f.actor, "finish_refresh", { ...request, lease: randomUUID(), packet: f.packet,
    accessExpiresAt: f.token.accessExpiresAt, refreshExpiresAt: f.token.refreshExpiresAt }), /SHOPIFY_STALE_REVISION/);
  await command(f.actor, "finish_refresh", { ...request, lease: claim.lease, packet: f.packet,
    accessExpiresAt: f.token.accessExpiresAt, refreshExpiresAt: f.token.refreshExpiresAt });
  assert.equal((await command(f.actor, "read_credential", identity)).refreshPending, false);
  const next = await command(f.actor, "claim_refresh", { ...identity, revision: credential.revision + 1 });
  await db.query("update shopify_oauth_credentials set refresh_started_at=clock_timestamp()-interval '2 minutes' where connection_id=$1", [saved.connectionId]);
  await assert.rejects(command(f.actor, "claim_refresh", { ...identity, revision: credential.revision + 1 }), /SHOPIFY_AUTH_REQUIRED/);
  f.approval = beginShopifyApproval(f.actor, f.approval.attempt.shopDomain, f.env);
  await connect(f, "gid://shopify/Shop/987125");
  await assert.rejects(command(f.actor, "finish_refresh", { ...identity, revision: credential.revision + 1,
    lease: next.lease, packet: f.packet, accessExpiresAt: f.token.accessExpiresAt,
    refreshExpiresAt: f.token.refreshExpiresAt }), /SHOPIFY_STALE_REVISION/);
});

test("an approval opened before renewal cannot exchange its code while renewal is active", async () => {
  const f = await fixture(), saved = await connect(f, "gid://shopify/Shop/987127");
  f.approval = beginShopifyApproval(f.actor, f.approval.attempt.shopDomain, f.env);
  await command(f.actor, "begin", f.approval.attempt);
  const identity = { connectionId: saved.connectionId };
  const credential = await command(f.actor, "read_credential", identity);
  const request = { ...identity, revision: credential.revision };
  const renewal = await command(f.actor, "claim_refresh", request);
  const approvalInput = { stateHash: f.approval.attempt.stateHash };
  await assert.rejects(command(f.actor, "claim", approvalInput), /SHOPIFY_CONFIGURATION_BUSY/);
  await command(f.actor, "finish_refresh", { ...request, lease: renewal.lease, packet: f.packet,
    accessExpiresAt: f.token.accessExpiresAt, refreshExpiresAt: f.token.refreshExpiresAt });
  const claim = await command(f.actor, "claim", approvalInput);
  assert.match(claim.claimToken, /^[a-f0-9-]{36}$/);
});

test("approval service verifies the Shopify shop, persists credentials and refreshes through the real SQL boundary", async () => {
  const f = await fixture(), signal = new AbortController().signal;
  let now = Date.now(), rotations = 0;
  const storage = async (actor, action, input) => command(actor, action, input);
  const transport = async (url, init) => {
    assert.equal(new URL(url).hostname, f.approval.attempt.shopDomain);
    if (url.endsWith("/admin/oauth/access_token")) {
      if (init.body.get("grant_type") === "refresh_token") rotations++;
      return Response.json({ access_token: "fictional-access", refresh_token: "fictional-refresh",
        expires_in: 120, refresh_token_expires_in: 7776000, scope: "read_orders,read_customers,read_products" });
    }
    assert.equal(new URL(url).pathname, "/admin/api/2026-10/graphql.json");
    assert.equal(init.headers["X-Shopify-Access-Token"], "fictional-access");
    return Response.json({ data: { shop: { id: "gid://shopify/Shop/987126", myshopifyDomain: f.approval.attempt.shopDomain },
      currentAppInstallation: { accessScopes: f.token.scopes.map(handle => ({ handle })) } } },
    { headers: { "X-Shopify-API-Version": "2026-10" } });
  };
  const service = createShopifyOAuthService(storage, transport, () => now);
  const handlers = createShopifyOAuthHandlers(async () => f.actor, service);
  const request = origin => new Request("https://osplus.example/api/integrations/shopify/oauth/start",
    { method: "POST", headers: { origin, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ shop: f.approval.attempt.shopDomain }) });
  assert.equal((await handlers.start(request("https://foreign.example"), f.env)).status, 403);
  const redirect = await handlers.start(request("https://osplus.example"), f.env);
  assert.equal(redirect.status, 303);
  assert.match(redirect.headers.get("set-cookie"), /HttpOnly.*Secure.*SameSite=Lax/);
  assert.equal(redirect.headers.get("cache-control"), "no-store");
  const started = { cookie: new URL(redirect.headers.get("location")).searchParams.get("state") };
  const params = new URLSearchParams({ shop: f.approval.attempt.shopDomain, code: "fictional-code",
    state: started.cookie, timestamp: String(Math.floor(now / 1000)) });
  const message = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join("&");
  params.set("hmac", createHmac("sha256", f.env.SHOPIFY_CLIENT_SECRET).update(message).digest("hex"));
  const callback = await handlers.callback(new Request("https://osplus.example/api/integrations/shopify/oauth/callback?" + params,
    { headers: { cookie: redirect.headers.get("set-cookie").split(";")[0] } }), f.env);
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get("location"), "https://osplus.example/settings/shopify?connection=approved");
  assert.match(callback.headers.get("set-cookie"), /Max-Age=0/);
  const workspace = (await db.query("select public.read_shopify_unified_workspace($1,$2,$3,$4) as result",
    [f.actor.tenantId, f.actor.userId, f.approval.attempt.shopDomain, f.env.SHOPIFY_CLIENT_ID])).rows[0].result;
  const connected = { connectionId: workspace.connection.id };
  assert.equal((await service.credential(f.actor, connected.connectionId, signal, f.env)).accessToken, "fictional-access");
  assert.equal(rotations, 0);
  now += 65000;
  assert.equal((await service.credential(f.actor, connected.connectionId, signal, f.env)).accessToken, "fictional-access");
  assert.equal(rotations, 1);
  const adapter = { rpc(name, args) {
    assert.equal(name, "shopify_oauth_storage");
    return { async abortSignal() {
      try { return { data: await command({ tenantId: args.p_tenant_id, userId: args.p_actor_id }, args.p_action, args.p_input), error: null }; }
      catch (error) { return { data: null, error: { message: error.message } }; }
    } };
  } };
  const baseEnv = { ...f.env, SHOPIFY_SHOP_DOMAIN: "wrong-global-shop.myshopify.com" };
  const scopedEnv = await resolveShopifyTenantEnvironment(adapter, f.actor.tenantId, f.actor.userId, signal, baseEnv);
  assert.equal(scopedEnv.SHOPIFY_SHOP_DOMAIN, f.approval.attempt.shopDomain);
  assert.equal(baseEnv.SHOPIFY_SHOP_DOMAIN, "wrong-global-shop.myshopify.com");
  assert.equal((await readShopifyTenantToken(adapter, f.actor, signal, scopedEnv, transport, () => now)).accessToken, "fictional-access");
  await assert.rejects(service.complete(f.actor, params, started.cookie, signal, f.env), /SHOPIFY_APPROVAL_USED/);
});
