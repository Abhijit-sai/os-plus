// Disposable fictional in-memory SQL only. Never loads credentials or connects.
import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { catalogueSql } from './schema-catalogue.mjs';
import { candidateTableNames,compareInstalledCandidates,inspectInstalledState,catalogueLfSql } from './post-migration-checks.mjs';

const db=new PGlite();let baseline,proposed,names;
before(async()=>{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE TABLE public.order_handovers(id uuid,tenant_id uuid,order_id uuid);
    CREATE TABLE public.order_handover_items(id uuid,tenant_id uuid,order_id uuid);`);
  const folder=new URL('../../supabase/migrations/',import.meta.url);
  const files=(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort(),content=new Map();
  for(const f of files)content.set(f,(await readFile(new URL(f,folder),'utf8')).replace('create extension if not exists "pgcrypto";',''));
  for(const f of files.filter(f=>!f.includes('_shopify_')))await db.exec(content.get(f));
  await db.exec('SET search_path=pg_catalog');baseline=(await db.query(catalogueSql)).rows;
  for(const f of files.filter(f=>f.includes('_shopify_'))){await db.exec('SET search_path=public,pg_catalog');await db.exec(content.get(f));}
  await db.exec('SET search_path=pg_catalog');proposed=(await db.query(catalogueSql)).rows;
  names=candidateTableNames(files.filter(f=>f.includes('_shopify_')).map(f=>content.get(f)));
});
after(()=>db.close());
async function readonly(fn){await db.exec('BEGIN READ ONLY');try{return await fn();}finally{await db.exec('ROLLBACK');}}

test('installed fictional package passes definition comparison and SELECT-only checkpoints',async()=>{
  assert.equal(compareInstalledCandidates(baseline,proposed,proposed).passed,true);
  const result=await readonly(()=>inspectInstalledState(db,names));
  assert.deepEqual(Object.entries(result.checks).filter(([,pass])=>!pass),[],JSON.stringify(result.sourceRpcExposure));
  assert.equal(result.tableCounts.length,26);assert.equal(result.runtimeCommandsChecked,18);
  assert.deepEqual(result.triggerGrantFindings,[
    {name:'guard_shopify_production_hold',role:'anon',trigger_only:true,security_definer:false},
    {name:'guard_shopify_production_hold',role:'authenticated',trigger_only:true,security_definer:false}]);
});
test('known broad trigger grant is invoker-only and cannot be called as an ordinary RPC',async()=>{
  for(const role of ['anon','authenticated']){
    await db.exec(`BEGIN;SET LOCAL ROLE ${role}`);
    try{await assert.rejects(db.query('SELECT public.guard_shopify_production_hold()'),/trigger functions can only be called as triggers/);}
    finally{await db.exec('ROLLBACK');}
  }
});
test('explanatory fingerprint isolates CRLF conversion but still detects SQL body changes',async()=>{
  await db.exec('BEGIN');
  try{
    const definition=n=>`CREATE OR REPLACE FUNCTION public.postflight_line_ending_fixture() RETURNS integer LANGUAGE sql AS $$\r\nSELECT ${n};\r\n$$;`;
    await db.exec(definition(1));
    const fingerprint=async sql=>(await db.query(sql)).rows.find(r=>r.kind==='function'&&r.name==='postflight_line_ending_fixture()').hash;
    const raw=await fingerprint(catalogueSql),normal=await fingerprint(catalogueLfSql);
    await db.exec(definition(1).replaceAll('\r\n','\n'));
    assert.notEqual(await fingerprint(catalogueSql),raw);assert.equal(await fingerprint(catalogueLfSql),normal);
    await db.exec(definition(2).replaceAll('\r\n','\n'));
    assert.notEqual(await fingerprint(catalogueLfSql),normal);
  }finally{await db.exec('ROLLBACK');}
});
test('missing or changed candidate definitions and unexpected overloads fail',()=>{
  const item=proposed.find(o=>o.kind==='function'&&o.name.startsWith('command_shopify_application('));
  assert.ok(item);
  assert.equal(compareInstalledCandidates(baseline,proposed,proposed.filter(o=>o!==item)).passed,false);
  assert.equal(compareInstalledCandidates(baseline,proposed,proposed.map(o=>o===item?{...o,hash:'0'.repeat(32)}:o)).passed,false);
  assert.equal(compareInstalledCandidates(baseline,proposed,[...proposed,{kind:'function',name:'command_shopify_application(text)',hash:'a'.repeat(32)}]).passed,false);
  for(const kind of ['function','function_owner','function_access'])assert.equal(
    compareInstalledCandidates(baseline,proposed,[...proposed,{kind,name:'list_operational_orders(text)'+(kind==='function_access'?'.service_role':''),hash:'a'.repeat(32)}]).passed,false);
});
test('ordinary column access is rejected even without table SELECT',async()=>{
  await db.exec('GRANT SELECT(id) ON public.shopify_connections TO authenticated');
  try{const r=await readonly(()=>inspectInstalledState(db,names));assert.equal(r.checks.ordinaryRelationAccessDenied,false);}
  finally{await db.exec('REVOKE SELECT(id) ON public.shopify_connections FROM authenticated');}
});
test('disabled handover trigger is detected',async()=>{
  await db.exec('ALTER TABLE public.order_handovers DISABLE TRIGGER aaa_shopify_handover_guard');
  try{const r=await readonly(()=>inspectInstalledState(db,names));assert.equal(r.checks.bothHandoverGuardsEnabled,false);}
  finally{await db.exec('ALTER TABLE public.order_handovers ENABLE TRIGGER aaa_shopify_handover_guard');}
});
test('wrong read-only identity fails before business aggregate queries',async()=>{
  let calls=0;
  await assert.rejects(inspectInstalledState({query:async()=>{calls++;return {rows:[{database:'postgres',actor:'postgres',readonly:'off'}]};}},names));
  assert.equal(calls,1);
});
test('launcher keeps post-migration checks on Inspect credentials and fixed runner argument',async()=>{
  const ps=await readFile(new URL('../run-shopify-private-backup.ps1',import.meta.url),'utf8');
  assert.match(ps,/\('CheckSchema','CheckPostMigration','CheckOwnership'\)\)\{'Inspect'\}/);
  assert.match(ps,/if\(\$Mode -eq 'CheckPostMigration'\)\{\$backupStart.ArgumentList.Add\('--post-migration'\)\}/);
});
