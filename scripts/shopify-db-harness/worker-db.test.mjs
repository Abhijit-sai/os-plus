import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
import { testDatabase } from "./database.mjs";
import { connectionA, tenantA, tenantB, orderGid } from "../fixtures/shopify-intake.mjs";

// Synthetic single-session suite; real races are in the separate Docker suite.
const db = await testDatabase('worker');
const connectionB = "20000000-0000-4000-8000-000000000002";
const read = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const result = async (sql, values = []) => (await db.query(sql, values)).rows[0].result;
const receive = async (order = orderGid) => result(`select receive_shopify_event($1,$2,'synthetic-intake.myshopify.com',
  'synthetic-app','production',(select revision from shopify_connections where id=$2),'orders/create',$3,null,
  '2026-10',$4,$5,null) as result`, [tenantA, connectionA.id, randomUUID(), order, "a".repeat(64)]);
const claim = (patch = {}) => result("select claim_shopify_jobs($1,$2,$3,$4,$5) as result",
  Object.values({ tenant: tenantA, connection: connectionA.id, env: "production", app: "synthetic-app", limit: 10, ...patch }));
const update = (job, action = "renew", error = null, patch = {}) => result(
  "select update_shopify_job_lease($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",
  Object.values({ tenant: tenantA, connection: connectionA.id, env: "production", app: "synthetic-app",
    job: job.jobId, token: job.leaseToken, generation: job.generation, revision: job.connectionRevision, action, error, retryAfter: null, ...patch }));
const row = async job => (await db.query("select * from shopify_sync_jobs where id=$1", [job.jobId])).rows[0];
const state = (action, revision, key = randomUUID(), actor = "owner-a", tenant = tenantA, connection = connectionA.id) => result(
  "select set_shopify_connection_state($1,$2,$3,$4,$5,$6) as result", [tenant, connection, actor, key, revision, action]);
const isolated = fn => async () => { await db.exec("begin"); try { await fn(); } finally { await db.exec("rollback"); } };
before(async () => {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(read("20260517120000_foundation_tenants.sql").replace('create extension if not exists "pgcrypto";', ""));
  await db.query("insert into tenants(id,name,slug,store_name) values($1,'A','a','A'),($2,'B','b','B')", [tenantA, tenantB]);
  await db.query(`insert into tenant_users(tenant_id,clerk_user_id,role,status) values
    ($1,'owner-a','owner_admin','active'),($1,'manager-a','manager','active'),($1,'disabled-a','owner_admin','disabled'),
    ($1,'viewer-a','viewer','active'),($1,'finance-a','finance','active'),($2,'owner-b','owner_admin','active')`, [tenantA, tenantB]);
  await db.exec(read("20261008100000_shopify_intake_foundation.sql"));
  await db.query(`insert into shopify_connections(id,tenant_id,shop_gid,canonical_domain,app_ref,environment,
    status,verified_at,intake_enabled,import_created_at_cutoff) values
    ($1,$2,'gid://shopify/Shop/101','synthetic-intake.myshopify.com','synthetic-app','production','verified',now(),true,'2026-10-08'),
    ($3,$4,'gid://shopify/Shop/102','synthetic-b.myshopify.com','synthetic-app','production','verified',now(),true,'2026-10-08')`,
  [connectionA.id, tenantA, connectionB, tenantB]);
  // Upgrade populated queue, not just empty schema.
  await receive();
  await db.exec(read("20261008120000_shopify_worker_leases.sql"));
});
after(() => db.close());

test("populated migration leaves processing off; commands/tables service-only", isolated(async () => {
  assert.deepEqual(await claim(), []);
  assert.equal((await db.query("select requested_generation,completed_generation from shopify_sync_jobs")).rows[0].requested_generation, 1);
  for (const role of ["anon", "authenticated"]) {
    for (const name of ["register_shopify_connection(uuid,text,uuid,text,text,text,text,timestamp with time zone)",
      "set_shopify_connection_state(uuid,uuid,text,uuid,bigint,text)","claim_shopify_jobs(uuid,uuid,text,text,integer)",
      "update_shopify_job_lease(uuid,uuid,text,text,uuid,uuid,bigint,bigint,text,text,integer)"]) {
      assert.equal((await db.query("select has_function_privilege($1,$2,'execute') as result", [role, `public.${name}`])).rows[0].result, false);
    }
    assert.equal((await db.query("select has_table_privilege($1,'shopify_connection_audit','select') as result", [role])).rows[0].result, false);
  }
  for (const privilege of ["insert", "update", "delete"]) {
    assert.equal((await db.query("select has_table_privilege('service_role','shopify_connections',$1) as result", [privilege])).rows[0].result, false);
    assert.equal((await db.query("select has_table_privilege('service_role','shopify_sync_jobs',$1) as result", [privilege])).rows[0].result, false);
  }
}));

test("owner reserves disabled pending binding; replay is same ID/audit; conflicting or foreign reuse denied", isolated(async () => {
  // Different environment avoids existing immutable store binding; synthetic only.
  const key = randomUUID();
  const args = [tenantA, "owner-a", key, "gid://shopify/Shop/103", "synthetic-c.myshopify.com", "synthetic-app", "development", "2026-10-08T00:00:00Z"];
  const sql = "select register_shopify_connection($1,$2,$3,$4,$5,$6,$7,$8) as result";
  const first = await result(sql, args);
  assert.equal(first.status, "pending"); assert.deepEqual(await result(sql, args), first);
  const stored = (await db.query("select * from shopify_connections where id=$1", [first.connectionId])).rows[0];
  assert.equal(stored.processing_enabled, false); assert.equal(stored.intake_enabled, false); assert.equal(stored.verified_at, null);
  await db.exec("set local timezone='Asia/Kolkata'");
  assert.deepEqual(await result(sql, args.map((value,index) => index === 7 ? '2026-10-08T00:00:00Z' : value)), first);
  assert.equal((await db.query("select count(*) as n from shopify_connection_audit where request_key=$1", [key])).rows[0].n, 1);
  for (const actor of ["manager-a", "finance-a", "viewer-a", "disabled-a", "owner-b", "no-user"]) {
    // SQL error aborts explicit transaction; use savepoints for rejection paths.
    await db.exec("savepoint rejection");
    await assert.rejects(() => result(sql, args.map((value, index) => index === 1 ? actor : value)), /SHOPIFY_ACCESS_DENIED/);
    await db.exec("rollback to savepoint rejection");
  }
  await db.exec("savepoint rejection");
  await assert.rejects(() => result(sql, args.map((value, index) => index === 4 ? "changed.myshopify.com" : value)), /SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await db.exec("rollback to savepoint rejection");
}));

test("bounded claims capture generation/revision; overlapping ticks never reuse a live lease", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  for (let i = 1; i <= 12; i++) await receive(`gid://shopify/Order/${i}`);
  const jobs = await claim(); assert.equal(jobs.length, 10);
  assert.equal(new Set(jobs.map(job => job.leaseToken)).size, 10);
  const next = await claim(); assert.equal(next.length, 3); assert.deepEqual(await claim(), []);
  assert.equal(jobs[0].generation, 1); assert.equal(jobs[0].connectionRevision, 2);
  assert.equal((await row(jobs[0])).attempts, 1);
  assert.ok(await update(jobs[0]));
}));

test("tenant/environment/app, paused/disabled and inactive tenant fences cannot claim or renew", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  const [job] = await claim();
  for (const patch of [{ tenant: tenantB }, { connection: connectionB }, { env: "development" }, { app: "other-app" }]) {
    assert.deepEqual(await claim(patch), []); assert.equal(await update(job, "renew", null, patch), false);
  }
  await db.query("update tenants set status='suspended' where id=$1", [tenantA]);
  assert.deepEqual(await claim(), []); assert.equal(await update(job), false);
  await db.query("update tenants set status='active' where id=$1", [tenantA]);
  const paused = await state("pause", job.connectionRevision);
  assert.equal(paused.status, "paused"); assert.deepEqual(await claim(), []); assert.equal(await update(job), false);
  const resumed = await state("resume", paused.revision);
  assert.equal(resumed.status, "verified"); assert.deepEqual(await claim(), []); // resume never silently enables
}));

test("expiry reclaims with fresh token; stale/wrong-generation worker is fenced", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  const [old] = await claim();
  await db.query("update shopify_sync_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1", [old.jobId]);
  assert.equal(await update(old), false);
  const [current] = await claim(); assert.notEqual(current.leaseToken, old.leaseToken);
  assert.equal((await row(current)).attempts, 2);
  assert.equal(await update(old, "fail", "TRANSIENT"), false);
  assert.equal(await update(current, "renew", null, { generation: current.generation + 1 }), false);
  assert.equal(await update(current), true);
}));

test("event during lease increments requested only; next claim captures outstanding generation", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  const [job] = await claim(); await receive();
  const stored = await row(job); assert.equal(stored.requested_generation, 2); assert.equal(stored.claimed_generation, 1);
  assert.equal(stored.completed_generation, 0); assert.equal(await update(job, "fail", "TRANSIENT"), true);
  assert.deepEqual(await claim(), []); // respect retry time, including incoming events
  await db.query("update shopify_sync_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1", [job.jobId]);
  assert.equal((await claim())[0].generation, 2);
}));

test("failure persists retry ladder and exhausted/validation jobs stop without deleting receipt", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  for (const [attempt, seconds] of [[1,60],[2,300],[3,900],[4,3600]]) {
    const [job] = await claim(); assert.equal(await update(job, "fail", attempt === 2 ? "THROTTLED" : "TRANSIENT"), true);
    const stored = await row(job); assert.equal(stored.attempts, attempt); assert.equal(stored.lease_token, null);
    const delay = (stored.next_attempt_at - stored.updated_at) / 1000;
    assert.ok(delay > seconds && delay <= seconds * 1.2); // positive bounded jitter, never early
    await db.query("update shopify_sync_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1", [job.jobId]);
  }
  await db.exec("update shopify_sync_jobs set attempts=12");
  assert.deepEqual(await claim(), []);
  assert.equal((await db.query("select last_error_code from shopify_sync_jobs")).rows[0].last_error_code, "RETRY_EXHAUSTED");
  await receive(); assert.deepEqual(await claim(), []); // webhook does not revive dead letter
  assert.equal((await db.query("select count(*) as n from shopify_webhook_receipts")).rows[0].n, 2);
  await receive("gid://shopify/Order/700"); const [job] = await claim();
  assert.equal(await update(job, "fail", "VALIDATION_REQUIRED"), true); assert.ok((await row(job)).dead_lettered_at);
}));

test("24h worker-death recovery stops retrying and auth failure pauses with SYSTEM audit", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  await db.exec("update shopify_sync_jobs set first_attempt_at=clock_timestamp()-interval '25 hours'");
  assert.deepEqual(await claim(), []);
  await receive("gid://shopify/Order/701"); const [job] = await claim();
  assert.equal(await update(job, "fail", "AUTH_REQUIRED"), true); assert.deepEqual(await claim(), []);
  const audit = (await db.query("select * from shopify_connection_audit where action='auth_pause'")).rows[0];
  assert.equal(audit.actor_kind, "SYSTEM"); assert.equal(audit.actor_id, null); assert.equal(audit.reason_code, "AUTH_REQUIRED");
  assert.equal(await update(job), false);
}));

test("throttling respects bounded Retry-After without sleeping or accepting private error text", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  const [job] = await claim();
  for (const patch of [{ error: 'raw secret response' }, { retryAfter: 0 }, { retryAfter: 86401 }]) {
    await db.exec("savepoint rejection");
    await assert.rejects(() => update(job, "fail", "THROTTLED", patch), /SHOPIFY_COMMAND_INVALID/);
    await db.exec("rollback to savepoint rejection");
  }
  assert.equal(await update(job, "fail", "THROTTLED", { retryAfter: 1800 }), true);
  const stored = await row(job); assert.equal((stored.next_attempt_at - stored.updated_at)/1000, 1800);
  assert.deepEqual(await claim(), []);
}));

test("owner state changes are stale-safe/replayable; manager or cross-tenant decisions denied", isolated(async () => {
  const key = randomUUID(); const changed = await state("pause", 1, key);
  assert.deepEqual(await state("pause", 1, key), changed);
  await db.exec("savepoint rejection"); await assert.rejects(() => state("resume", 1), /SHOPIFY_STALE_REVISION/);
  await db.exec("rollback to savepoint rejection");
  for (const actor of ["manager-a","finance-a","viewer-a","disabled-a","owner-b"]) {
    await db.exec("savepoint rejection"); await assert.rejects(() => state("resume", changed.revision, randomUUID(), actor), /SHOPIFY_ACCESS_DENIED/);
    await db.exec("rollback to savepoint rejection");
  }
  await db.exec("savepoint rejection"); await assert.rejects(() => state("resume", changed.revision, randomUUID(), "owner-b", tenantB), /SHOPIFY_ACCESS_DENIED/);
  await db.exec("rollback to savepoint rejection");
  const disconnected = await state("disconnect", changed.revision);
  assert.equal(disconnected.status, "disconnected");
  assert.equal((await db.query("select count(*) as n from shopify_sync_jobs")).rows[0].n, 1);
  await db.exec("savepoint rejection"); await assert.rejects(() => db.exec("delete from shopify_connection_audit"), /SHOPIFY_RECEIPT_IMMUTABLE/);
  await db.exec("rollback to savepoint rejection");
}));

test("audit failure rolls back state change, preserving revision for safe retry", isolated(async () => {
  await db.exec(`create function reject_synthetic_audit() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_AUDIT_FAILURE'; end $$;
    create trigger reject_synthetic_audit before insert on shopify_connection_audit for each row execute function reject_synthetic_audit();`);
  await db.exec("savepoint rejection"); await assert.rejects(() => state("pause", 1), /SYNTHETIC_AUDIT_FAILURE/);
  await db.exec("rollback to savepoint rejection");
  assert.equal((await db.query("select revision from shopify_connections where id=$1", [connectionA.id])).rows[0].revision, 1);
  await db.exec("drop trigger reject_synthetic_audit on shopify_connection_audit; drop function reject_synthetic_audit()");
  assert.equal((await state("pause", 1)).status, "paused");
}));

test("incoming generation updates queue timestamp", isolated(async () => {
  await db.exec("update shopify_sync_jobs set updated_at='2000-01-01'");
  await receive();
  const queued = (await db.query("select updated_at from shopify_sync_jobs")).rows[0];
  assert.ok(queued.updated_at > new Date('2026-10-01'));
}));
test("renewal cannot extend beyond retry lifetime", isolated(async () => {
  await db.query("update shopify_connections set processing_enabled=true where id=$1", [connectionA.id]);
  const [job] = await claim();
  await db.query("update shopify_sync_jobs set first_attempt_at=clock_timestamp()-interval '25 hours' where id=$1", [job.jobId]);
  assert.equal(await update(job), false);
  const stopped = await row(job); assert.ok(stopped.dead_lettered_at);
  assert.equal(stopped.lease_token, null); assert.equal(stopped.last_error_code, 'RETRY_EXHAUSTED');
}));

test("unexpired auth/scope failure still pauses connection after job lifetime exhaustion", isolated(async () => {
  for (const code of ['AUTH_REQUIRED','SCOPE_REQUIRED']) {
    await db.query("update shopify_connections set status='verified',processing_enabled=true where id=$1", [connectionA.id]);
    await receive(`gid://shopify/Order/${code === 'AUTH_REQUIRED' ? '702' : '703'}`);
    const jobs = await claim(); const job = jobs.at(-1);
    await db.query("update shopify_sync_jobs set first_attempt_at=clock_timestamp()-interval '25 hours' where id=$1", [job.jobId]);
    assert.equal(await update(job, "fail", code), true);
    assert.ok((await row(job)).dead_lettered_at);
    const connection = (await db.query("select status,processing_enabled from shopify_connections where id=$1", [connectionA.id])).rows[0];
    assert.equal(connection.status, 'paused'); assert.equal(connection.processing_enabled, false);
    assert.equal((await db.query("select count(*) as n from shopify_connection_audit where reason_code=$1", [code])).rows[0].n, 1);
  }
}));
