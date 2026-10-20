import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { testDatabase } from "./database.mjs";
import { createShopifyIntakeHandler } from "../../src/integrations/shopify/intake-handler.ts";
import { connectionA, tenantA, tenantB, intakeEnv, orderGid, deliveryRequest } from "../fixtures/shopify-intake.mjs";

// Memory default; optional owned loopback Docker database via guarded adapter.
const db = await testDatabase('intake');
const migration = readFileSync(new URL("../../supabase/migrations/20261008100000_shopify_intake_foundation.sql", import.meta.url), "utf8");
const foundation = readFileSync(new URL("../../supabase/migrations/20260517120000_foundation_tenants.sql", import.meta.url), "utf8")
  .replace('create extension if not exists "pgcrypto";', ""); // gen_random_uuid is built into PostgreSQL.
const connectionB = "20000000-0000-4000-8000-000000000002";
const sql = `select public.receive_shopify_event($1::uuid,$2::uuid,$3,$4,$5,$6::bigint,$7,$8::uuid,$9::uuid,$10,$11,$12,$13::timestamptz) as result`;
async function binding() {
  const row = (await db.query("select * from shopify_connections where id=$1", [connectionA.id])).rows[0];
  // PostgREST returns timestamp strings; PGlite's JS client uses Date objects.
  return { ...row, verified_at: row.verified_at.toISOString() };
}
async function receive(patch = {}) {
  const row = await binding();
  const input = { tenant: tenantA, connection: row.id, domain: row.canonical_domain, app: row.app_ref,
    environment: row.environment, revision: row.revision, topic: "orders/create", delivery: randomUUID(),
    event: null, version: "2026-10", order: orderGid, hash: "a".repeat(64), triggered: null, ...patch };
  return (await db.query(sql, Object.values(input))).rows[0].result;
}
const count = async table => Number((await db.query(`select count(*) as count from ${table}`)).rows[0].count);
before(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(foundation);
  // Populated existing tenant rows precede the additive migration.
  await db.query("insert into tenants (id,name,slug,store_name) values ($1,'Synthetic A','synthetic-a','Synthetic A'),($2,'Synthetic B','synthetic-b','Synthetic B')", [tenantA, tenantB]);
  await db.exec(migration);
  await db.query(`insert into shopify_connections
    (id,tenant_id,shop_gid,canonical_domain,app_ref,environment,status,verified_at,intake_enabled,import_created_at_cutoff)
    values ($1,$2,'gid://shopify/Shop/101','synthetic-intake.myshopify.com','synthetic-app','production','verified',now(),true,'2026-10-08'),
           ($3,$4,'gid://shopify/Shop/102','synthetic-b.myshopify.com','synthetic-app','production','verified',now(),true,'2026-10-08')`,
  [connectionA.id, tenantA, connectionB, tenantB]);
});
after(async () => db.close());

test("migration is additive on populated tenants and new connections default disabled", async () => {
  assert.equal(await count("tenants"), 2);
  const defaults = await db.query(`select column_name,column_default from information_schema.columns
    where table_name='shopify_connections' and column_name in ('status','intake_enabled')`);
  assert.ok(defaults.rows.some(row => row.column_name === "intake_enabled" && row.column_default === "false"));
  assert.ok(defaults.rows.some(row => row.column_name === "status" && row.column_default.includes("pending")));
});
test("app-reference constraint accepts the full 256-character contract and rejects 257/invalid characters", async () => {
  const insert = `insert into shopify_connections(tenant_id,shop_gid,canonical_domain,app_ref,environment,import_created_at_cutoff)
    values($1,'gid://shopify/Shop/999','synthetic-development.myshopify.com',$2,'development','2026-10-08')`;
  await db.exec("begin;");
  try { await db.query(insert, [tenantA, "a".repeat(256)]); }
  finally { await db.exec("rollback;"); }
  for (const value of ["a".repeat(257), "", "bad app", "bad\n", "bad/host"]) {
    await assert.rejects(() => db.query(insert, [tenantA, value]), /check constraint/);
  }
});
test("first event commits receipt plus job; repeated lost-response retry returns same receipt and generation", async () => {
  const delivery = randomUUID(); const beforeJobs = await count("shopify_sync_jobs");
  const accepted = await receive({ delivery });
  assert.equal(accepted.status, "accepted"); assert.equal(await count("shopify_sync_jobs"), beforeJobs + 1);
  const repeated = await receive({ delivery });
  assert.deepEqual(repeated, { ...accepted, status: "duplicate" });
  assert.equal((await db.query("select requested_generation from shopify_sync_jobs where connection_id=$1 and order_gid=$2", [connectionA.id, orderGid])).rows[0].requested_generation, 1);
});
test("different topics/delivery IDs for one source order coalesce without losing requested updates", async () => {
  const before = Number((await db.query("select requested_generation from shopify_sync_jobs where connection_id=$1 and order_gid=$2", [connectionA.id, orderGid])).rows[0].requested_generation);
  // PGlite serializes queries: this exercises repeated/coalesced requests, NOT multi-session locks.
  const deliveries = Array.from({ length: 12 }, () => randomUUID());
  const result = await Promise.all(deliveries.map((delivery, index) => receive({ delivery,
    topic: index % 2 ? "orders/updated" : "orders/cancelled" })));
  assert.ok(result.every(row => row.status === "accepted"));
  assert.equal((await db.query("select requested_generation from shopify_sync_jobs where connection_id=$1 and order_gid=$2", [connectionA.id, orderGid])).rows[0].requested_generation, before + 12);
  assert.equal(await count("shopify_sync_jobs"), 1);
});
test("same delivery with changed content is durably quarantined without overwriting or enqueueing", async () => {
  const delivery = randomUUID(); const accepted = await receive({ delivery });
  const beforeGeneration = (await db.query("select requested_generation from shopify_sync_jobs where connection_id=$1", [connectionA.id])).rows[0].requested_generation;
  const conflict = await receive({ delivery, hash: "b".repeat(64) });
  assert.deepEqual(conflict, { status: "conflict", receiptId: accepted.receiptId });
  assert.deepEqual(await receive({ delivery, hash: "b".repeat(64) }), conflict);
  assert.equal(await count("shopify_webhook_conflicts"), 1);
  assert.equal((await db.query("select body_sha256 from shopify_webhook_receipts where id=$1", [accepted.receiptId])).rows[0].body_sha256, "a".repeat(64));
  assert.equal((await db.query("select requested_generation from shopify_sync_jobs where connection_id=$1", [connectionA.id])).rows[0].requested_generation, beforeGeneration);
  assert.equal((await receive({ delivery, topic: "orders/updated" })).status, "conflict");
});
test("tenant/domain/app/environment/revision forgery and malformed envelope create no receipt/job", async () => {
  const beforeReceipts = await count("shopify_webhook_receipts");
  for (const patch of [{ tenant: tenantB }, { connection: connectionB }, { domain: "foreign.myshopify.com" },
    { app: "foreign-app" }, { environment: "development" }, { revision: 999 }, { topic: "refunds/create" },
    { hash: "not-hash" }, { version: "2026-07" }, { order: "gid://shopify/Customer/123" }, { topic: null }]) {
    await assert.rejects(() => receive(patch), /SHOPIFY_CONNECTION_UNAVAILABLE|SHOPIFY_ENVELOPE_INVALID/);
  }
  assert.equal(await count("shopify_webhook_receipts"), beforeReceipts);
});
test("same source order/delivery in a distinct verified store stays isolated in its own tenant", async () => {
  const result = await receive({ tenant: tenantB, connection: connectionB, domain: "synthetic-b.myshopify.com", revision: 1 });
  assert.equal(result.status, "accepted");
  const rows = (await db.query("select tenant_id,connection_id from shopify_sync_jobs order by tenant_id")).rows;
  assert.deepEqual(rows, [{ tenant_id: tenantA, connection_id: connectionA.id }, { tenant_id: tenantB, connection_id: connectionB }]);
});
test("composite tenant foreign keys forbid cross-tenant receipt/job/conflict rows", async () => {
  await assert.rejects(() => db.query(`insert into shopify_sync_jobs(tenant_id,connection_id,order_gid) values($1,$2,'gid://shopify/Order/900')`,
    [tenantB, connectionA.id]), /shopify_jobs_connection_fk/);
  await assert.rejects(() => db.query(`insert into shopify_webhook_receipts(tenant_id,connection_id,delivery_id,topic,api_version,order_gid,body_sha256)
    values($1,$2,$3,'orders/create','2026-10','gid://shopify/Order/900',$4)`, [tenantB, connectionA.id, randomUUID(), "a".repeat(64)]), /shopify_receipts_connection_fk/);
  const receiptId = (await receive()).receiptId;
  await assert.rejects(() => db.query(`insert into shopify_webhook_conflicts(tenant_id,receipt_id,incoming_body_sha256,incoming_topic,incoming_order_gid,incoming_api_version)
    values($1,$2,$3,'orders/create','gid://shopify/Order/900','2026-10')`, [tenantB, receiptId, "a".repeat(64)]), /shopify_conflicts_receipt_fk/);
});
test("a job insertion failure rolls back the new receipt, allowing a clean retry", async () => {
  const delivery = randomUUID(); const order = "gid://shopify/Order/999";
  await db.exec(`create function fail_synthetic_job() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_JOB_FAILURE'; end $$;
    create trigger fail_synthetic_job before insert on shopify_sync_jobs for each row execute function fail_synthetic_job();`);
  try { await assert.rejects(() => receive({ delivery, order }), /SYNTHETIC_JOB_FAILURE/); }
  finally { await db.exec("drop trigger fail_synthetic_job on shopify_sync_jobs; drop function fail_synthetic_job();"); }
  assert.equal((await db.query("select count(*) as n from shopify_webhook_receipts where delivery_id=$1", [delivery])).rows[0].n, 0);
  assert.equal((await receive({ delivery, order })).status, "accepted");
});
test("paused intake retains requests; disabled/disconnected/inactive tenant cannot create new ones", async () => {
  await db.query("update shopify_connections set status='paused' where id=$1", [connectionA.id]);
  assert.equal((await receive()).status, "accepted");
  await db.query("update shopify_connections set intake_enabled=false where id=$1", [connectionA.id]);
  const old = (await db.query("select delivery_id from shopify_webhook_receipts where connection_id=$1 limit 1", [connectionA.id])).rows[0].delivery_id;
  assert.equal((await receive({ delivery: old })).status, "duplicate");
  await assert.rejects(() => receive(), /SHOPIFY_CONNECTION_UNAVAILABLE/);
  await db.query("update shopify_connections set status='disconnected' where id=$1", [connectionA.id]);
  await assert.rejects(() => receive(), /SHOPIFY_CONNECTION_UNAVAILABLE/);
  await db.query("update shopify_connections set status='verified',intake_enabled=true where id=$1", [connectionA.id]);
  await db.query("update tenants set status='suspended' where id=$1", [tenantA]);
  try { await assert.rejects(() => receive(), /SHOPIFY_TENANT_INACTIVE/); }
  finally { await db.query("update tenants set status='active' where id=$1", [tenantA]); }
});
test("store/tenant/cutoff binding and audit records cannot be rewritten; no Test/Production fanout", async () => {
  for (const [field, value] of [["tenant_id", tenantB], ["shop_gid", "gid://shopify/Shop/999"],
    ["environment", "development"], ["app_ref", "foreign-app"], ["import_created_at_cutoff", "2026-10-09"]]) {
    await assert.rejects(() => db.query(`update shopify_connections set ${field}=$1 where id=$2`, [value, connectionA.id]), /SHOPIFY_BINDING_IMMUTABLE/);
  }
  await assert.rejects(() => db.query(`insert into shopify_connections(tenant_id,shop_gid,canonical_domain,app_ref,environment,import_created_at_cutoff)
    values($1,'gid://shopify/Shop/101','synthetic-duplicate.myshopify.com','synthetic-app','production','2026-10-08')`, [tenantB]), /duplicate key/);
  await assert.rejects(() => db.query("update shopify_webhook_receipts set body_sha256=$1", ["c".repeat(64)]), /SHOPIFY_RECEIPT_IMMUTABLE/);
  await assert.rejects(() => db.exec("delete from shopify_webhook_receipts"), /SHOPIFY_RECEIPT_IMMUTABLE/);
  await assert.rejects(() => db.exec("delete from shopify_webhook_conflicts"), /SHOPIFY_RECEIPT_IMMUTABLE/);
});
test("ordinary clients lack table/RPC privileges; RLS still denies reads if a grant is accidentally added", async () => {
  for (const role of ["anon", "authenticated"]) {
    const result = await db.query(`select has_function_privilege($1,
      'public.receive_shopify_event(uuid,uuid,text,text,text,bigint,text,uuid,uuid,text,text,text,timestamptz)','execute') as allowed`, [role]);
    assert.equal(result.rows[0].allowed, false);
    for (const table of ["shopify_connections", "shopify_webhook_receipts", "shopify_sync_jobs", "shopify_webhook_conflicts"]) {
      assert.equal((await db.query("select has_table_privilege($1,$2,'select') as allowed", [role, table])).rows[0].allowed, false);
    }
  }
  assert.equal((await db.query("select has_table_privilege('service_role','shopify_webhook_receipts','update') as allowed")).rows[0].allowed, false);
  await db.exec("begin; grant select on shopify_connections,shopify_webhook_receipts to authenticated; set local role authenticated;");
  try {
    assert.equal(await count("shopify_connections"), 0); assert.equal(await count("shopify_webhook_receipts"), 0);
  } finally { await db.exec("rollback;"); }
});
test("real HTTP handler plus real PostgreSQL receipt command returns 200 only after receipt/job persistence", async () => {
  const actual = createShopifyIntakeHandler({ findConnection: binding, receive: async (connection, envelope) => {
    return receive({ tenant: connection.tenant_id, connection: connection.id, revision: connection.revision,
      delivery: envelope.deliveryId, event: envelope.eventId, topic: envelope.topic, version: envelope.apiVersion,
      order: envelope.orderGid, hash: envelope.bodySha256, triggered: envelope.triggeredAt });
  } });
  const delivery = randomUUID(); const req = () => deliveryRequest(undefined, { headers: { "x-shopify-webhook-id": delivery } });
  assert.equal((await actual(req(), intakeEnv)).status, 200);
  const result = await actual(req(), intakeEnv); assert.deepEqual(await result.json(), { status: "received" });
  assert.equal((await db.query("select count(*) as n from shopify_webhook_receipts where delivery_id=$1", [delivery])).rows[0].n, 1);
});
