// Fictional in-memory schema only. No source environment, credentials or network.
import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fixtureSql,runtimeRpcNames } from './private-rehearsal.mjs';
const db=new PGlite(),folder=new URL('../../supabase/migrations/',import.meta.url);
const repairs=['20261014130000_shopify_runtime_rpc_permissions.sql','20261014131000_shopify_handover_guards.sql'];
before(async()=>{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  const files=(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files.filter(f=>!repairs.includes(f)))await db.exec((await readFile(new URL(file,folder),'utf8')).replace('create extension if not exists "pgcrypto";',''));
  await db.exec(`CREATE TABLE public.order_handovers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),order_id uuid NOT NULL REFERENCES orders(id),
    handover_number text NOT NULL,handover_type delivery_type NOT NULL,handed_over_at timestamptz NOT NULL,balance_acknowledged boolean NOT NULL,recipient_name text,status text NOT NULL DEFAULT 'active',internal_notes text,deleted_at timestamptz);
    CREATE TABLE public.order_handover_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,order_id uuid NOT NULL,
      handover_id uuid NOT NULL REFERENCES order_handovers(id),order_item_id uuid NOT NULL REFERENCES order_items(id),quantity numeric NOT NULL DEFAULT 1,deleted_at timestamptz);
    GRANT ALL ON public.order_handovers,public.order_handover_items TO service_role;
    GRANT EXECUTE ON FUNCTION create_work_unit_runtime(uuid,uuid,text,uuid,text,text,text,text,numeric,text,numeric,numeric,gst_treatment,numeric,uuid,text,uuid,text) TO PUBLIC,anon,authenticated;`);
  for(const file of repairs)if(files.includes(file))await db.exec(await readFile(new URL(file,folder),'utf8'));
});
after(async()=>db.close());
const isolated=fn=>async()=>{await db.exec('BEGIN');try{
  const ids=Object.fromEntries(['tenant','foreign','connection','itemType','workflow','stage'].map(k=>[k,randomUUID()]));
  await db.exec(fixtureSql(ids));await fn(ids);
}finally{await db.exec('ROLLBACK');}};
const result=async(sql,args=[])=> (await db.query(sql,args)).rows[0]?.result;
const fixture=release=>result('SELECT pg_temp.fixture($1) AS result',[release]);
const handover=(f)=>db.query(`INSERT INTO order_handovers(tenant_id,order_id,handover_number,handover_type,handed_over_at,balance_acknowledged,recipient_name)
  VALUES($1,$2,'FICTIONAL-1','store_pickup',now(),true,'Fictional recipient') RETURNING id`,[f.tenant,f.saved.orderId]);
async function reject(fn,pattern){await db.exec('SAVEPOINT rejection');await assert.rejects(fn,pattern);await db.exec('ROLLBACK TO SAVEPOINT rejection');}
const hold=f=>result('SELECT pg_temp.observe($1::jsonb) AS result',[JSON.stringify(f)]);
test('service role can hand over a released unheld Shopify order',isolated(async()=>{
  const f=await fixture(true);await db.exec('SET LOCAL ROLE service_role');assert.equal((await handover(f)).rows.length,1);
}));
for(const held of [false,true])test(`service role cannot insert ${held?'held':'draft'} Shopify handover`,isolated(async()=>{
  const f=await fixture(held);if(held)await hold(f);await db.exec('SET LOCAL ROLE service_role');
  await reject(()=>handover(f),/SHOPIFY_DRAFT_LOCKED|SHOPIFY_PRODUCTION_HELD/);
}));
for(const op of ['insert','update','delete'])test(`held Shopify handover ${op} cannot bypass item/header guards`,isolated(async()=>{
  const f=await fixture(true),h=(await handover(f)).rows[0].id;
  const item=(await db.query('SELECT id FROM order_items WHERE tenant_id=$1 LIMIT 1',[f.tenant])).rows[0].id;
  const add=()=>db.query('INSERT INTO order_handover_items(tenant_id,order_id,handover_id,order_item_id) VALUES($1,$2,$3,$4)',[f.tenant,f.saved.orderId,h,item]);
  if(op!=='insert')await add();await hold(f);await db.exec('SET LOCAL ROLE service_role');
  await reject(()=>op==='insert'?add():db.query(op==='update'?'UPDATE order_handover_items SET quantity=2 WHERE handover_id=$1':'DELETE FROM order_handover_items WHERE handover_id=$1',[h]),
    /SHOPIFY_PRODUCTION_HELD|SHOPIFY_HISTORY_PROTECTED/);
  await reject(()=>db.query('UPDATE order_handovers SET status=\'reversed\' WHERE id=$1',[h]),/SHOPIFY_PRODUCTION_HELD/);
}));
test('unheld Shopify dispatch history cannot be hard or soft deleted',isolated(async()=>{
  const f=await fixture(true),h=(await handover(f)).rows[0].id;await db.exec('SET LOCAL ROLE service_role');
  await reject(()=>db.query('DELETE FROM order_handovers WHERE id=$1',[h]),/SHOPIFY_HISTORY_PROTECTED/);
  await reject(()=>db.query('UPDATE order_handovers SET deleted_at=now() WHERE id=$1',[h]),/SHOPIFY_HISTORY_PROTECTED/);
}));
test('foreign tenant header repointing is rejected',isolated(async()=>{
  const f=await fixture(true),h=(await handover(f)).rows[0].id;await hold(f);await db.exec('SET LOCAL ROLE service_role');
  await reject(()=>db.query('UPDATE order_handovers SET tenant_id=$1 WHERE id=$2',[f.foreign,h]),/SHOPIFY_ACCESS_DENIED|SHOPIFY_PRODUCTION_HELD|SHOPIFY_HISTORY_PROTECTED/);
  assert.equal((await db.query('SELECT tenant_id FROM order_handovers WHERE id=$1',[h])).rows[0].tenant_id,f.tenant);
}));
test('all eighteen commands deny ordinary execution and retain service access',async()=>{
  const rows=(await db.query(`SELECT p.proname,r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) AND r.rolname IN('anon','authenticated','service_role')`,[runtimeRpcNames])).rows;
  assert.equal(rows.length,54);for(const row of rows)assert.equal(row.allowed,row.rolname==='service_role',row.proname+' '+row.rolname);
});
test('local order handovers retain header/item CRUD',isolated(async(ids)=>{
  const f=await fixture(true),order=randomUUID();
  await db.query(`INSERT INTO orders(id,tenant_id,customer_id,order_number,tracking_token) VALUES($1::uuid,$2,$3,'FICTIONAL-LOCAL','local-'||($1::uuid)::text)`,[order,f.tenant,f.saved.customerId]);
  const item=(await db.query(`INSERT INTO order_items(tenant_id,order_id,item_type_id,name,workflow_id) VALUES($1,$2,$3,'Fictional local item',$4) RETURNING id`,[f.tenant,order,ids.itemType,f.workflow])).rows[0].id;
  await db.exec('SET LOCAL ROLE service_role');const h=(await handover({...f,saved:{orderId:order}})).rows[0].id;
  await db.query('UPDATE order_handovers SET internal_notes=\'Fictional local note\' WHERE id=$1',[h]);
  await db.query('INSERT INTO order_handover_items(tenant_id,order_id,handover_id,order_item_id) VALUES($1,$2,$3,$4)',[f.tenant,order,h,item]);
  await db.query('UPDATE order_handover_items SET quantity=2 WHERE handover_id=$1',[h]);
  await db.query('DELETE FROM order_handover_items WHERE handover_id=$1',[h]);
  await db.query('DELETE FROM order_handovers WHERE id=$1',[h]);
}));
test('Shopify handover identity cannot move to a different local order',isolated(async()=>{
  const f=await fixture(true),h=(await handover(f)).rows[0].id,order=randomUUID();
  await db.query(`INSERT INTO orders(id,tenant_id,customer_id,order_number,tracking_token) VALUES($1::uuid,$2,$3,'FICTIONAL-LOCAL','local-'||($1::uuid)::text)`,[order,f.tenant,f.saved.customerId]);
  await db.exec('SET LOCAL ROLE service_role');await reject(()=>db.query('UPDATE order_handovers SET order_id=$1 WHERE id=$2',[order,h]),/SHOPIFY_HISTORY_PROTECTED/);
}));
for(const forged of ['header','item'])test(`claiming a local order cannot disguise a held Shopify ${forged}`,isolated(async(ids)=>{
  const f=await fixture(true),originalHeader=(await handover(f)).rows[0].id;
  const originalItem=(await db.query('SELECT id FROM order_items WHERE tenant_id=$1 LIMIT 1',[f.tenant])).rows[0].id;
  const order=randomUUID();await db.query(`INSERT INTO orders(id,tenant_id,customer_id,order_number,tracking_token)
    VALUES($1::uuid,$2,$3,'FICTIONAL-LOCAL',($1::uuid)::text)`,[order,f.tenant,f.saved.customerId]);
  const item=(await db.query(`INSERT INTO order_items(tenant_id,order_id,item_type_id,name,workflow_id) VALUES($1,$2,$3,'Fictional local item',$4) RETURNING id`,[f.tenant,order,ids.itemType,f.workflow])).rows[0].id;
  const header=(await handover({...f,saved:{orderId:order}})).rows[0].id;
  await hold(f);await db.exec('SET LOCAL ROLE service_role');
  await reject(()=>db.query('INSERT INTO order_handover_items(tenant_id,order_id,handover_id,order_item_id) VALUES($1,$2,$3,$4)',
    [f.tenant,order,forged==='header'?originalHeader:header,forged==='item'?originalItem:item]),/SHOPIFY_ACCESS_DENIED/);
}));
for(const role of ['service_role','anon','authenticated'])test(`${role} V2 mutation keeps the trusted server boundary`,isolated(async()=>{
  const f=await fixture(false),order=randomUUID();
  await db.query(`INSERT INTO orders(id,tenant_id,customer_id,order_number,tracking_token,runtime_model,vertical_key)
    VALUES($1::uuid,$2,$3,'FICTIONAL-V2',($1::uuid)::text,'work_unit_v2','boutique')`,[order,f.tenant,f.saved.customerId]);
  await db.exec('SET LOCAL ROLE '+role);
  const call=()=>db.query(`SELECT create_work_unit_runtime(p_tenant_id=>$1,p_order_id=>$2,p_vertical_key=>'boutique',p_workflow_id=>$3,
    p_display_code=>'FICTIONAL',p_line_name=>'Fictional work',p_actor=>'untrusted-fictional-actor')`,[f.tenant,order,f.workflow]);
  if(role==='service_role')assert.equal((await call()).rows.length,1);else await reject(call,/permission denied/);
}));
