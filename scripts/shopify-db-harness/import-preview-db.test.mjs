// Fictional, memory-only PostgreSQL-compatible checks. No hosted credentials.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { normalizeShopifyReference, classifyShopifyImport } from '../../src/integrations/shopify/import-plan.ts';
import { createShopifyImportPreviewService } from '../../src/integrations/shopify/import-preview-service.ts';

const db = new PGlite();
const folder = new URL('../../supabase/migrations/', import.meta.url);
const tenant = randomUUID(), foreign = randomUUID(), customer = randomUUID(), connection = randomUUID();
const shop = 'gid://shopify/Shop/800', orderGid = 'gid://shopify/Order/801';
const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.result;
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for (const file of (await readdir(folder)).filter(f => f.endsWith('.sql')).sort())
    await db.exec((await readFile(new URL(file, folder), 'utf8')).replace('create extension if not exists "pgcrypto";', ''));
  await db.query(`INSERT INTO tenants(id,name,slug,store_name) VALUES($1,'Fictional import','fictional-import','Fictional'),($2,'Foreign','foreign-import','Foreign')`, [tenant, foreign]);
  await db.query(`INSERT INTO tenant_users(tenant_id,clerk_user_id,role,status) VALUES($1,'owner','owner_admin','active'),($1,'manager','manager','active'),($2,'foreign-owner','owner_admin','active')`, [tenant, foreign]);
  await db.query(`INSERT INTO customers(id,tenant_id,name) VALUES($1,$2,'Fictional customer')`, [customer, tenant]);
  await db.query(`INSERT INTO shopify_connections(id,tenant_id,shop_gid,canonical_domain,app_ref,environment,status,verified_at,import_created_at_cutoff)
    VALUES($1,$2,$3,'fictional-import.myshopify.com','fictional-app','production','verified',now(),now()-interval '60 days')`, [connection, tenant, shop]);
});
after(() => db.close());
const read = (orders, patch = {}) => scalar('SELECT public.preview_shopify_order_matches($1,$2,$3,$4,$5,$6,$7::jsonb) AS result',
  [patch.tenant ?? tenant, patch.connection ?? connection, patch.actor ?? 'owner', patch.domain ?? 'fictional-import.myshopify.com',
    patch.app ?? 'fictional-app', patch.shop ?? shop, JSON.stringify(orders)]);
const isolated = fn => async () => { await db.exec('BEGIN'); try { await fn(); } finally { await db.exec('ROLLBACK'); } };
async function createOrder(reference, { source = 'walk_in', deleted = false, boundGid = null } = {}) {
  const id = randomUUID();
  await db.query(`INSERT INTO orders(id,tenant_id,customer_id,order_number,tracking_token,reference_order_id,source,order_status,financial_management,gst_treatment,deleted_at)
    VALUES($1::uuid,$2,$3,($1::uuid)::text,($1::uuid)::text,$4,$5::order_source,$6::order_status,$7,'not_applicable',case when $8 then now() end)`,
  [id, tenant, customer, reference, source, source === 'shopify' ? 'draft' : 'confirmed', source === 'shopify' ? 'external_shopify' : 'local', deleted]);
  if (boundGid) await db.query('INSERT INTO shopify_source_orders(tenant_id,connection_id,shop_gid,order_gid,order_id) VALUES($1,$2,$3,$4,$5)', [tenant, connection, shop, boundGid, id]);
  return { id, tenantId: tenant, reference, deleted, source, shopGid: boundGid ? shop : null, orderGid: boundGid };
}

test('SQL normalizer matches TypeScript, including punctuation, Unicode and blanks', async () => {
  for (const value of [null, '', '#', 'PT2324', ' # PT2324 ', 'PT-2324', 'PT02324', '##PT2324', 'ÄPT', ' PT 23 ', '\u00a0PT\u00a0'])
    assert.equal(await scalar('SELECT public.normalize_shopify_reference($1) AS result', [value]), normalizeShopifyReference(value));
});

test('real SQL preview agrees with classifier for new/manual/ambiguous/deleted/bound/corrupt matches', isolated(async () => {
  const identity = { tenantId: tenant, shopGid: shop, orderGid, reference: '#PT2324' }, candidates = [];
  const check = async () => {
    const [sql] = await read([{ orderGid, reference: identity.reference }]);
    assert.deepEqual(sql, { orderGid, ...classifyShopifyImport(identity, candidates) });
  };
  await check();
  candidates.push(await createOrder('pt2324'));
  await check();
  candidates.push(await createOrder(' #PT2324 ')); candidates.sort((a,b) => a.id.localeCompare(b.id));
  await check();
  // Immutable source identity wins over ambiguous reference strings.
  candidates.push(await createOrder('OLDER-REFERENCE', { source: 'shopify', boundGid: orderGid }));
  await check();
  const deleted = await createOrder('DELETED', { deleted: true });
  assert.equal((await read([{ orderGid: 'gid://shopify/Order/802', reference: 'deleted' }]))[0].status, 'conflict');
  const corrupt = await createOrder('UNBOUND', { source: 'shopify' });
  assert.equal((await read([{ orderGid: 'gid://shopify/Order/803', reference: 'unbound' }]))[0].status, 'conflict');
  assert.ok(deleted.id && corrupt.id);
}));

test('preview uses current tenant/store/owner checks, and returns no foreign order IDs', isolated(async () => {
  const inputs = [{ orderGid, reference: 'PT2324' }];
  for (const patch of [{ actor: 'manager' }, { actor: 'foreign-owner' }, { tenant: foreign }, { connection: randomUUID() },
    { domain: 'foreign.myshopify.com' }, { app: 'foreign-app' }, { shop: 'gid://shopify/Shop/999' }]) {
    await db.exec('SAVEPOINT denied');
    await assert.rejects(() => read(inputs, patch), /SHOPIFY_ACCESS_DENIED/);
    await db.exec('ROLLBACK TO SAVEPOINT denied');
  }
  await db.query("UPDATE tenant_users SET status='disabled' WHERE tenant_id=$1 AND clerk_user_id='owner'", [tenant]);
  await assert.rejects(() => read(inputs), /SHOPIFY_ACCESS_DENIED/);
}));

test('preview rejects forged keys, duplicates, invalid references and oversized batches', async () => {
  for (const input of [null, {}, [{ orderGid, reference: 'PT1', tenantId: foreign }], [{ orderGid, reference: 123 }],
    [{ orderGid, reference: 'x\ny' }], [{ orderGid, reference: 'x'.repeat(257) }], [{ orderGid: 'bad', reference: 'PT1' }],
    [{ orderGid, reference: 'PT1' }, { orderGid, reference: 'PT2' }], Array.from({length:101},(_,i)=>({orderGid:`gid://shopify/Order/${i+1}`,reference:`PT${i}`}))])
    await assert.rejects(() => read(input), /SHOPIFY_COMMAND_INVALID/);
  assert.deepEqual(await read([]), []);
  assert.equal((await read([{ orderGid, reference: null }]))[0].status, 'conflict');
});

test('new DB functions expose only the owner-checked read wrapper to service_role', async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const fn of ['normalize_shopify_reference(text)', 'match_shopify_order_reference(uuid,text,text,text)'])
      assert.equal(await scalar('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS result', [role, `public.${fn}`]), false);
    assert.equal(await scalar('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS result',
      [role, 'public.preview_shopify_order_matches(uuid,uuid,text,text,text,text,jsonb)']), role === 'service_role');
  }
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders'), 0, 'all test mutations rolled back');
});

test('preview coordinator rechecks live SQL authorization, batches all rows and flags incoming reference clashes', isolated(async () => {
  const calls = [], actor = { userId: 'owner', tenantId: tenant, role: 'owner_admin', membershipUserId: 'owner',
    membershipTenantId: tenant, membershipStatus: 'active', tenantStatus: 'active' };
  const env = { VERCEL_ENV: 'production', SHOPIFY_DEPLOYMENT_ENV: 'production', SHOPIFY_API_VERSION: '2026-10',
    SHOPIFY_CONNECTION_SCREEN_ENABLED: 'true', SHOPIFY_PILOT_OPERATIONS_ENABLED: 'true', SHOPIFY_CONNECTION_TEST_TENANT_ID: tenant,
    SHOPIFY_SHOP_DOMAIN: 'fictional-import.myshopify.com', SHOPIFY_APPLICATION_ORIGIN: 'https://example.invalid',
    SHOPIFY_CLIENT_ID: 'fictional-app', SHOPIFY_CLIENT_SECRET: 'fictional-secret' };
  const adapter = { rpc(name, args) { assert.equal(name, 'preview_shopify_order_matches'); calls.push(args.p_orders.length);
    return { async abortSignal(signal) { signal.throwIfAborted(); try {
      return { data: await read(args.p_orders, { tenant: args.p_tenant_id, connection: args.p_connection_id, actor: args.p_actor_id,
        domain: args.p_domain, app: args.p_app_ref, shop: args.p_shop_gid }), error: null };
    } catch (e) { return { data: null, error: { message: e.message } }; } } }; } };
  const rows = Array.from({ length: 103 }, (_, i) => ({ orderGid: `gid://shopify/Order/${9000+i}`, reference: i < 2 ? '#SAME' : `PT${i}`,
    createdAt: '2026-10-18T01:00:00Z', updatedAt: '2026-10-18T01:00:00Z', cancelledAt: null, financialStatus: 'PAID', amount: '10.00', currency: 'INR' }));
  let sourceReads = 0;
  const source = async () => { sourceReads++; return { rows, window: {}, complete: true, reason: null, observedAt: '2026-10-19T00:00:00Z' }; };
  const run = () => createShopifyImportPreviewService(adapter, source)(actor, { connectionId: connection, shopGid: shop }, {}, new AbortController().signal, env);
  const result = await run();
  assert.deepEqual(calls, [0, 100, 3]); assert.equal(result.rows.length, 103);
  assert.deepEqual(result.counts, { new: 101, already_imported: 0, reference_match: 0, conflict: 2 });
  assert.equal(result.rows[0].incomingReferenceConflict, true);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders'), 0, 'preview is read-only');
  await db.query("UPDATE tenant_users SET status='disabled' WHERE tenant_id=$1 AND clerk_user_id='owner'", [tenant]);
  await assert.rejects(run, /ACCESS_DENIED/); assert.equal(sourceReads, 1, 'revoked membership must prevent Shopify read');
}));
