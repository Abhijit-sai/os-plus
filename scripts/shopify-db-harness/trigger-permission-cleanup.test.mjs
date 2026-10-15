// Fictional in-memory database only. No credentials, environment files or network.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { catalogueSql, differences } from './schema-catalogue.mjs';
import { fixtureSql, runtimeRpcNames } from './private-rehearsal.mjs';

const db = new PGlite();
const targets = ['guard_shopify_draft_order', 'guard_shopify_order_child',
  'guard_shopify_privacy_activation', 'guard_shopify_privacy_contact_purge',
  'guard_shopify_production_hold', 'guard_shopify_source_redaction',
  'protect_shopify_connection_binding', 'protect_shopify_draft_audit',
  'protect_shopify_intake_audit', 'touch_shopify_job_request'];
const cleanupUrl = new URL('../../docs/sql/20261015170000_shopify_trigger_permission_cleanup.proposed.sql', import.meta.url);
let cleanup, original;
const catalogue = async () => (await db.query(catalogueSql)).rows;
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE TABLE public.order_handovers(id uuid,tenant_id uuid,order_id uuid);
    CREATE TABLE public.order_handover_items(id uuid,tenant_id uuid,order_id uuid);`);
  const folder = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(folder)).filter(f => f.endsWith('.sql')).sort()) {
    await db.exec((await readFile(new URL(file, folder), 'utf8')).replace('create extension if not exists "pgcrypto";', ''));
  }
  original = await catalogue();
});
after(() => db.close());
const privileges = async () => (await db.query(`SELECT p.proname, r.rolname,
  has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
  WHERE n.nspname='public' AND p.proname=ANY($1::text[])
  AND r.rolname IN('anon','authenticated','service_role') ORDER BY p.proname,r.rolname`, [targets])).rows;

test('reproduces hosted default-privilege grants before cleanup', async () => {
  const rows = await privileges();
  assert.equal(rows.length, 30);
  assert.equal(rows.filter(r => r.allowed && r.rolname === 'service_role').length, 10);
  assert.equal(rows.filter(r => r.allowed && r.rolname !== 'service_role').length, 2);
});
test('exact proposed cleanup removes only target execution privileges; data and defaults unchanged', async () => {
  cleanup = await readFile(cleanupUrl, 'utf8');
  const defaults = async () => (await db.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows;
  const beforeDefaults = await defaults();
  const rows = async () => {
    const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
    const result = [];
    for (const { tablename } of tables) result.push((await db.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) AS hash FROM public."${tablename}" t`)).rows[0]);
    return result;
  };
  const beforeRows = await rows();
  await db.exec(cleanup);
  assert.ok((await privileges()).every(r => !r.allowed));
  const delta = differences(original, await catalogue());
  assert.deepEqual(delta.missing, []); assert.deepEqual(delta.extra, []);
  assert.equal(delta.changed.length, 12);
  assert.ok(delta.changed.every(r => r.kind === 'function_access' && targets.includes(r.name.split('(')[0])));
  assert.deepEqual(await rows(), beforeRows); assert.deepEqual(await defaults(), beforeDefaults);
  const publicGrants = (await db.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
    LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) AND a.grantee=0 AND a.privilege_type='EXECUTE'`, [targets])).rows;
  assert.deepEqual(publicGrants, []);
});
test('cleanup is idempotent and preserves eighteen runtime command permissions', async () => {
  assert.equal(typeof cleanup, 'string');
  const before = await catalogue(); await db.exec(cleanup); assert.deepEqual(await catalogue(), before);
  const rows = (await db.query(`SELECT p.proname,r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) AND r.rolname IN('anon','authenticated','service_role')`, [runtimeRpcNames])).rows;
  assert.equal(rows.length, 54); for (const r of rows) assert.equal(r.allowed, r.rolname === 'service_role');
});
test('operator read-only verification reports all ten targets with no remaining grants', async () => {
  const sql = await readFile(new URL('../../docs/sql/20261015170000_shopify_trigger_permission_cleanup.verify.sql', import.meta.url), 'utf8');
  const results = await db.exec(sql);
  const result = results.flatMap(r => r.rows).find(r => r.cleanup_verification)?.cleanup_verification;
  assert.deepEqual(result, { database: 'postgres', actor: 'postgres', read_only: 'on',
    targets_found: 10, invalid_definitions: 0, public_execute_grants: 0, api_execute_grants: 0 });
});
test('all three API roles are denied direct helper calls after cleanup', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) for (const name of targets) {
    await db.exec(`BEGIN; SET LOCAL ROLE ${role}`);
    try { await assert.rejects(db.query(`SELECT public.${name}()`), /permission denied/); }
    finally { await db.exec('ROLLBACK'); }
  }
});
test('missing target aborts rather than partially applying', async () => {
  await db.exec('ALTER FUNCTION public.touch_shopify_job_request() RENAME TO fictional_missing_target');
  try { await assert.rejects(db.exec(cleanup), /SHOPIFY_TRIGGER_CLEANUP_TARGET_MISMATCH/); }
  finally { await db.exec('ROLLBACK; ALTER FUNCTION public.fictional_missing_target() RENAME TO touch_shopify_job_request'); }
});
test('changed security-definer target aborts before any revocations', async () => {
  await db.exec('ALTER FUNCTION public.touch_shopify_job_request() SECURITY DEFINER; GRANT EXECUTE ON FUNCTION public.guard_shopify_production_hold() TO anon');
  try {
    await assert.rejects(db.exec(cleanup), /SHOPIFY_TRIGGER_CLEANUP_TARGET_MISMATCH/);
    await db.exec('ROLLBACK');
    assert.ok((await privileges()).some(r => r.proname === 'guard_shopify_production_hold' && r.rolname === 'anon' && r.allowed));
  } finally { await db.exec('ROLLBACK; ALTER FUNCTION public.touch_shopify_job_request() SECURITY INVOKER'); await db.exec(cleanup); }
});
test('inherited remaining access rolls the complete cleanup back', async () => {
  await db.exec('CREATE ROLE fictional_inherited; GRANT fictional_inherited TO authenticated; GRANT EXECUTE ON FUNCTION public.guard_shopify_production_hold() TO fictional_inherited, anon');
  try {
    await assert.rejects(db.exec(cleanup), /SHOPIFY_TRIGGER_CLEANUP_ACCESS_REMAINS/);
    await db.exec('ROLLBACK');
    assert.ok((await privileges()).some(r => r.proname === 'guard_shopify_production_hold' && r.rolname === 'anon' && r.allowed));
  } finally { await db.exec('ROLLBACK; REVOKE EXECUTE ON FUNCTION public.guard_shopify_production_hold() FROM fictional_inherited; REVOKE fictional_inherited FROM authenticated; DROP ROLE fictional_inherited'); await db.exec(cleanup); }
});
test('real import/release/audit triggers still run and held production remains blocked for service role', async () => {
  await db.exec('BEGIN');
  try {
    const ids = Object.fromEntries(['tenant', 'foreign', 'connection', 'itemType', 'workflow', 'stage'].map(k => [k, randomUUID()]));
    await db.exec(fixtureSql(ids));
    const f = (await db.query('SELECT pg_temp.fixture(true) AS result')).rows[0].result;
    await db.exec('SET LOCAL ROLE service_role');
    // Execute the real attached trigger on a released operational order.
    await db.query("UPDATE public.item_stage_instances SET status='in_progress' WHERE tenant_id=$1", [f.tenant]);
    await db.exec('RESET ROLE');
    await db.query('SELECT pg_temp.observe($1::jsonb)', [JSON.stringify(f)]);
    await db.exec('SET LOCAL ROLE service_role; SAVEPOINT held');
    await assert.rejects(db.query("UPDATE public.item_stage_instances SET status='completed' WHERE tenant_id=$1", [f.tenant]), /SHOPIFY_PRODUCTION_HELD/);
    await db.exec('ROLLBACK TO SAVEPOINT held');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM order_payments WHERE tenant_id=$1', [f.tenant])).rows[0].n, 0);
    assert.ok((await db.query('SELECT count(*)::int AS n FROM shopify_releases WHERE tenant_id=$1', [f.tenant])).rows[0].n > 0);
  } finally { await db.exec('ROLLBACK'); }
});
