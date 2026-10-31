// Offline fictional schema only. Never loads private configuration or source rows.
import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { fixtureSql } from './private-rehearsal.mjs';
const db=new PGlite({extensions:{pgcrypto}}),folder=new URL('../../supabase/migrations/',import.meta.url);
before(async()=>{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile(new URL(file,folder),'utf8')));
});
after(()=>db.close());
const result=async(sql,args=[])=> (await db.query(sql,args)).rows[0]?.result;
const isolated=fn=>async()=>{await db.exec('BEGIN');try{
  const ids=Object.fromEntries(['tenant','foreign','connection','itemType','workflow','stage'].map(k=>[k,randomUUID()]));
  await db.exec(fixtureSql(ids));const f=await result('SELECT pg_temp.fixture() AS result');await fn(f);
}finally{await db.exec('ROLLBACK');}};
const command=(f,action,input,key=randomUUID(),actor='rehearsal-owner')=>result('SELECT command_shopify_application($1,$2,$3,$4,$5,$6::jsonb) AS result',[f.tenant,f.connection,actor,key,action,JSON.stringify(input)]);
const authorize=async(f,patch={},key=randomUUID(),actor='rehearsal-owner')=>{
  const c=(await db.query('SELECT * FROM shopify_connections WHERE id=$1',[f.connection])).rows[0];
  const stamp=(await db.query('SELECT clock_timestamp() AS t')).rows[0].t.toISOString();
  return command(f,'authorize_copy',{orderGid:f.input.sourceOrderGid,expectedRevision:c.revision,retentionDays:1,reason:'Fictional authorized Test copy',consent:true,
    shopGid:c.shop_gid,domain:c.canonical_domain,keyId:'fictional-key',verifiedAt:stamp,sourceCreatedAt:f.input.sourceCreatedAt,enableRelease:true,...patch},key,actor);
};
async function reject(fn,pattern){await db.exec('SAVEPOINT rejected');await assert.rejects(fn,pattern);await db.exec('ROLLBACK TO SAVEPOINT rejected');}
test('full schema installs with service-only application commands',async()=>{
  const rows=(await db.query(`SELECT p.proname,r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND p.proname IN('command_shopify_application','read_shopify_application','recover_shopify_application_release','receive_shopify_pilot_event','observe_shopify_pilot','uninstall_shopify_pilot') AND r.rolname IN('anon','authenticated','service_role')`)).rows;
  assert.equal(rows.length,18);for(const r of rows)assert.equal(r.allowed,r.rolname==='service_role',r.proname+' '+r.rolname);
});
test('owner approves only the named order and reads its scoped configuration',isolated(async f=>{
  assert.equal((await authorize(f)).status,'authorized');
  const state=await result('SELECT read_shopify_application($1,$2,$3,$4) AS result',[f.tenant,'rehearsal-owner','synthetic-rehearsal.myshopify.com','synthetic-rehearsal']);
  assert.equal(state.connection.id,f.connection);assert.equal(state.policy.order_gid,f.input.sourceOrderGid);assert.equal(state.sources.length,1);assert.equal(state.workflows.length,1);
}));
for(const actor of ['rehearsal-manager','rehearsal-finance','rehearsal-foreign-owner','unknown'])test(`rejects ${actor} setup/read`,isolated(async f=>{
  await reject(()=>authorize(f,{},randomUUID(),actor),/SHOPIFY_ACCESS_DENIED/);
  await reject(()=>result('SELECT read_shopify_application($1,$2,$3,$4) AS result',[f.tenant,actor,'synthetic-rehearsal.myshopify.com','synthetic-rehearsal']),/SHOPIFY_ACCESS_DENIED/);
}));
test('stale or unconsented verification never creates approval',isolated(async f=>{
  for(const patch of [{consent:false},{expectedRevision:999},{verifiedAt:'2026-01-01T00:00:00Z'},{domain:'foreign.myshopify.com'},{retentionDays:8}])await reject(()=>authorize(f,patch),/SHOPIFY_ACCESS_DENIED|SHOPIFY_STALE_REVISION/);
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM shopify_pilot_policies')).rows[0].n),0);
}));
test('one-order policy rejects direct alternate intake and durably ignores other webhooks',isolated(async f=>{
  await authorize(f);
  const c=(await db.query('SELECT revision FROM shopify_connections WHERE id=$1',[f.connection])).rows[0];
  const delivery=randomUUID(),event={deliveryId:delivery,topic:'orders/updated',bodySha256:'e'.repeat(64),orderGid:'gid://shopify/Order/999999',connectionRevision:c.revision,eventId:null,triggeredAt:null};
  for(let i=0;i<2;i++)assert.equal((await result('SELECT receive_shopify_pilot_event($1,$2,$3::jsonb) AS result',[f.tenant,f.connection,JSON.stringify(event)])).status,'ignored');
  assert.equal(Number((await db.query('SELECT count(*) AS n FROM shopify_pilot_external_receipts')).rows[0].n),1);
  await reject(()=>result(`SELECT receive_shopify_event($1,$2,'synthetic-rehearsal.myshopify.com','synthetic-rehearsal','production',$3,'orders/create',$4,null,'2026-10',$5,$6,null) AS result`,[f.tenant,f.connection,c.revision,randomUUID(),event.orderGid,'a'.repeat(64)]),/SHOPIFY_COPY_APPROVAL_REQUIRED/);
}));
test('manual queue retries have one receipt and one generation',isolated(async f=>{
  await authorize(f);const key=randomUUID();const a=await command(f,'queue_order',{},key),b=await command(f,'queue_order',{},key);
  assert.deepEqual(a,b);assert.equal((await db.query('SELECT requested_generation FROM shopify_sync_jobs WHERE connection_id=$1',[f.connection])).rows[0].requested_generation,2);
}));
test('privacy note never claims fulfilment and rejects cross-request ids',isolated(async f=>{
  await reject(()=>command(f,'privacy_note',{privacyRequestId:randomUUID(),reason:'Fictional note',disposition:'under_review'}),/SHOPIFY_COMMAND_INVALID/);
}));
test('uninstall fences intake and preserves orders, policy and history; duplicate is recovered',isolated(async f=>{
  await authorize(f);const args=[f.tenant,f.connection,f.input.shopGid,randomUUID(),'a'.repeat(64)];
  for(let i=0;i<2;i++)assert.equal((await result('SELECT uninstall_shopify_pilot($1,$2,$3,$4,$5) AS result',args)).status,'disconnected');
  const c=(await db.query('SELECT * FROM shopify_connections WHERE id=$1',[f.connection])).rows[0];assert.equal(c.processing_enabled,false);assert.equal(c.intake_enabled,false);assert.equal(c.release_enabled,false);
  assert.equal((await db.query('SELECT count(*) AS n FROM orders WHERE tenant_id=$1',[f.tenant])).rows[0].n,1);
}));
test('paused pilot can reverify the same order without extending expiry or accepting another order',isolated(async f=>{
  await authorize(f);const expiry=await result('SELECT expires_at AS result FROM shopify_pilot_policies WHERE connection_id=$1',[f.connection]);
  const rev=await result('SELECT revision AS result FROM shopify_connections WHERE id=$1',[f.connection]);
  await result('SELECT set_shopify_connection_state($1,$2,$3,$4,$5,$6) AS result',[f.tenant,f.connection,'rehearsal-owner',randomUUID(),rev,'pause']);
  await reject(()=>authorize(f,{orderGid:'gid://shopify/Order/99999'}),/SHOPIFY_COPY_APPROVAL_REQUIRED/);
  await authorize(f,{retentionDays:7});assert.deepEqual(await result('SELECT expires_at AS result FROM shopify_pilot_policies WHERE connection_id=$1',[f.connection]),expiry);
  assert.equal(await result('SELECT processing_enabled AS result FROM shopify_connections WHERE id=$1',[f.connection]),true);
}));
test('revoked approval owner stops new pilot work at the database boundary',isolated(async f=>{
  await authorize(f);await db.query(`UPDATE tenant_users SET status='disabled' WHERE tenant_id=$1 AND clerk_user_id='rehearsal-owner'`,[f.tenant]);
  await reject(()=>result('SELECT shopify_pilot_policy($1,$2) AS result',[f.tenant,f.connection]),/SHOPIFY_COPY_APPROVAL_REQUIRED/);
  await reject(()=>command(f,'queue_order',{}),/SHOPIFY_ACCESS_DENIED/);
}));
test('expired source is purged in bounded repeatable batches, with business and source history preserved',isolated(async f=>{
  // Privileged fictional expired policy, not a real approval or clock change.
  await db.query(`INSERT INTO shopify_pilot_policies(tenant_id,connection_id,order_gid,authorized_by,reason,authorized_at,expires_at,key_id)
    VALUES($1,$2,$3,'rehearsal-owner','Fictional expired copy',now()-interval '2 days',now()-interval '1 day','fictional-key')`,[f.tenant,f.connection,f.input.sourceOrderGid]);
  await reject(()=>command(f,'queue_order',{}),/SHOPIFY_COPY_APPROVAL_REQUIRED/);
  for(const role of ['anon','authenticated'])await reject(()=>db.exec(`SET LOCAL ROLE ${role};SELECT purge_expired_shopify_pilot('${f.tenant}','${f.connection}')`),/permission denied/);
  await db.exec('SET LOCAL ROLE service_role');
  const first=await result('SELECT purge_expired_shopify_pilot($1,$2,null,1) AS result',[f.tenant,f.connection]);
  assert.equal(first.redactedCount,1);assert.equal(first.remainingCount,0);assert.equal(first.businessDispositionRequired,true);
  assert.equal((await result('SELECT purge_expired_shopify_pilot($1,$2,null,1) AS result',[f.tenant,f.connection])).redactedCount,0);
  assert.equal(await result('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await result('SELECT count(*)::int AS result FROM shopify_source_revisions WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await result(`SELECT sealed_source ? 'ciphertext' AS result FROM shopify_source_revisions WHERE tenant_id=$1`,[f.tenant]),false);
  await reject(()=>db.query(`UPDATE shopify_source_revisions SET source_digest=repeat('f',64) WHERE tenant_id=$1`,[f.tenant]),/permission denied|SHOPIFY_AUDIT_IMMUTABLE/);
}));
test('unexpired cleanup cannot redact or disable an active pilot',isolated(async f=>{
  await authorize(f);assert.equal((await result('SELECT purge_expired_shopify_pilot($1,$2,$3) AS result',[f.tenant,f.connection,'rehearsal-owner'])).status,'not_expired');
  assert.equal(await result(`SELECT sealed_source ? 'ciphertext' AS result FROM shopify_source_revisions WHERE tenant_id=$1`,[f.tenant]),true);
}));
