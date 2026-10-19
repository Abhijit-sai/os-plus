// Real independent PostgreSQL sessions and PostgREST; owned synthetic DB only.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { readShopifyWorkerContext } from '../../src/integrations/shopify/worker-context.ts';
import {snapshot} from '../fixtures/shopify-draft.mjs';
import {projectShopifyCommercialDetails} from '../../src/integrations/shopify/commercial-order.ts';

const nonce=process.env.OSPLUS_SHOPIFY_DISPOSABLE_NONCE;
assert.match(nonce??'',/^[a-f0-9]{24}$/);
const password=process.env.OSPLUS_SHOPIFY_DISPOSABLE_PASSWORD;
assert.match(password??'',/^[a-f0-9]{48}$/);
const port=Number(process.env.OSPLUS_SHOPIFY_DISPOSABLE_PORT);
const apiPort=Number(process.env.OSPLUS_SHOPIFY_DISPOSABLE_API_PORT);
for(const value of [port,apiPort]) assert.ok(Number.isInteger(value)&&value>=1024&&value<=65535);
const jwtSecret=process.env.OSPLUS_SHOPIFY_DISPOSABLE_JWT;
assert.match(jwtSecret??'',/^[a-f0-9]{64}$/);
const database=`shopify_upgrade_${nonce}`,base=`http://127.0.0.1:${apiPort}`;
const clients=[];
let admin,a,b,blocker;
let shopId=1000;
async function connect(role){
  const client=new Client({host:'127.0.0.1',port,user:'postgres',password,database,ssl:false,
    connectionTimeoutMillis:3000,statement_timeout:10000,lock_timeout:5000});
  await client.connect();clients.push(client);
  const marker=await client.query("select shobj_description(oid,'pg_database') as marker from pg_database where datname=current_database()");
  assert.equal(marker.rows[0]?.marker,`osplus-shopify-disposable:${nonce}`);
  client.pid=(await client.query('select pg_backend_pid() as pid')).rows[0].pid;
  if(role)await client.query(`set role ${role}`); // closed, test-owned constant
  return client;
}
const query=async(client,sql,values=[]) => (await client.query(sql,values)).rows[0]?.result;
function token(role){
  const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload=Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
  return `${header}.${payload}.${createHmac('sha256',jwtSecret).update(`${header}.${payload}`).digest('base64url')}`;
}
async function http(path,role,body){
  const response=await fetch(`${base}/${path}`,{method:body?'POST':'GET',
    headers:{...(role?{authorization:`Bearer ${token(role)}`}:{ }),'content-type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});
  return {status:response.status,data:await response.json()};
}
before(async()=>{
  admin=await connect();a=await connect('service_role');b=await connect('service_role');blocker=await connect();
  for(let i=0;i<40;i++){
    try{const r=await http('tenants?select=id&limit=1','service_role');if(r.status===200)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.fail('Owned local PostgREST did not become ready');
});
after(async()=>{await Promise.all(clients.map(client=>client.end()));});

async function fixture(){
  const tenant=randomUUID(),foreignTenant=randomUUID(),connection=randomUUID(),suffix=randomUUID().replaceAll('-','');
  const domain=`fictional-${suffix}.myshopify.com`,shop=`gid://shopify/Shop/${++shopId}`;
  await admin.query("insert into tenants(id,name,slug,store_name) values($1,'Fictional Docker','docker-'||$3,'Fictional'),($2,'Fictional foreign','foreign-'||$3,'Foreign')",[tenant,foreignTenant,suffix]);
  await admin.query("insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'docker-owner','owner_admin','active'),($1,'docker-manager','manager','active'),($2,'docker-foreign','owner_admin','active')",[tenant,foreignTenant]);
  await admin.query("insert into tenant_verticals(tenant_id,vertical_definition_id,is_enabled,enabled_at) select $1,id,true,now() from vertical_definitions where key='boutique'",[tenant]);
  await admin.query(`insert into shopify_connections(id,tenant_id,shop_gid,canonical_domain,app_ref,environment,status,verified_at,intake_enabled,processing_enabled,draft_import_enabled,release_enabled,
    import_created_at_cutoff,scopes_verified_at,protected_customer_fields_verified_at,source_copy_authorized_at)
    values($1,$2,$4,$3,'synthetic-app','production','verified',now(),true,true,true,true,'2026-10-08',now(),now(),now())`,[connection,tenant,domain,shop]);
  const revision=Number((await admin.query('select revision from shopify_connections where id=$1',[connection])).rows[0].revision);
  const f={tenant,foreignTenant,connection,domain,shop,revision,order:'gid://shopify/Order/123456789'};
  f.receive=(client=a,delivery=randomUUID())=>query(client,`select receive_shopify_event($1,$2,$3,'synthetic-app','production',$4,'orders/create',$5,null,'2026-10',$6,$7,null) as result`,
    [tenant,connection,domain,revision,delivery,f.order,'a'.repeat(64)]);
  f.claim=(client=a)=>query(client,"select claim_shopify_jobs($1,$2,'production','synthetic-app',1) as result",[tenant,connection]);
  return f;
}
async function draftInput(f){
  await f.receive();const [lease]=await f.claim();assert.ok(lease);
  const now=(await admin.query('select clock_timestamp() as current')).rows[0].current.toISOString();
  return {tenantId:f.tenant,connectionId:f.connection,environment:'production',appRef:'synthetic-app',shopGid:f.shop,shopDomain:f.domain,apiVersion:'2026-10',
    jobId:lease.jobId,generation:lease.generation,leaseToken:lease.leaseToken,connectionRevision:lease.connectionRevision,sourceOrderGid:f.order,
    sourceCreatedAt:now,sourceUpdatedAt:now,observedAt:now,sourceCurrency:'INR',sourceDigest:'b'.repeat(64),meaningfulDigest:'c'.repeat(64),
    customer:{proposedName:'Fictional Docker buyer',generatedName:false,shopifyCustomerGid:'gid://shopify/Customer/11',verifiedPhoneE164:'+919000000011',
      emailSuggestion:null,unverifiedPrimaryPhone:null,phoneCountryConflict:false},reasons:['MAPPING_REQUIRED'],
    // SQL structure fixture only. Real AES-GCM/preparation is covered separately.
    sealedSource:{version:1,keyId:'synthetic',iv:'a'.repeat(16),tag:'a'.repeat(24),ciphertext:'a'.repeat(48)},
    lines:[{lineGid:'gid://shopify/LineItem/1',quantity:1,currentQuantity:1}]};
}
const persist=(client,input)=>query(client,'select import_shopify_draft($1::jsonb) as result',[JSON.stringify(input)]);
async function ready(){
  const f=await fixture();f.input=await draftInput(f);f.saved=await persist(a,f.input);
  f.itemType=randomUUID();f.workflow=randomUUID();f.stage=randomUUID();
  await admin.query("insert into item_types(id,tenant_id,name) values($1,$2,'Fictional shirt')",[f.itemType,f.tenant]);
  await admin.query("insert into stage_master(id,tenant_id,name) values($1,$2,'Fictional stitch')",[f.stage,f.tenant]);
  await admin.query("insert into workflows(id,tenant_id,name,item_type_id) values($1,$2,'Fictional workflow',$3)",[f.workflow,f.tenant,f.itemType]);
  await admin.query('insert into workflow_stages(tenant_id,workflow_id,stage_master_id,sequence_number) values($1,$2,$3,1)',[f.tenant,f.workflow,f.stage]);
  f.mappingInput={mappingId:null,expectedRevision:0,variantGid:'gid://shopify/ProductVariant/21',sku:'EXACT',classification:'production',itemTypeId:f.itemType,workflowId:f.workflow,standardSizeId:null,isActive:true,reason:'Fictional owner choice'};
  f.mapping=await query(a,'select save_shopify_mapping($1,$2,$3,$4,$5::jsonb) as result',[f.tenant,f.connection,'docker-owner',randomUUID(),JSON.stringify(f.mappingInput)]);
  f.source=(await admin.query('select id from shopify_source_orders where order_id=$1',[f.saved.orderId])).rows[0].id;
  f.decision={customerId:f.saved.customerId,deliveryType:'store_pickup',reason:'Fictional source reviewed',lines:[{lineGid:f.input.lines[0].lineGid,mappingId:f.mapping.mappingId,mappingRevision:1}]};
  f.review=(client=a,key=randomUUID(),version=0,decision=f.decision)=>query(client,'select save_shopify_draft_review($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result',
    [f.tenant,f.connection,'docker-owner',key,f.source,f.saved.sourceRevisionId,version,JSON.stringify(decision)]);
  f.proof={connectionRevision:f.input.connectionRevision,sourceDigest:f.input.sourceDigest,sourceUpdatedAt:f.input.sourceUpdatedAt,verifiedAt:(await admin.query('select clock_timestamp() as current')).rows[0].current.toISOString(),sourceCurrency:'INR',moneyValidation:'restricted_reconciliation_passed',
    lines:[{lineGid:f.input.lines[0].lineGid,variantGid:f.mappingInput.variantGid,quantity:1,name:'Fictional shirt',originalUnitMinorUnits:'100000',netMinorUnits:'90000',productionAllowed:true}]};
  f.release=(client,review,key=randomUUID())=>query(client,'select release_shopify_order($1,$2,$3,$4,$5,$6,$7::jsonb) as result',
    [f.tenant,f.connection,'docker-owner',key,f.source,review.reviewId,JSON.stringify(f.proof)]);
  return f;
}
async function counts(f){
  return (await admin.query(`select (select count(*)::int from orders where tenant_id=$1) as orders,
    (select count(*)::int from customers where tenant_id=$1) as customers,
    (select count(*)::int from order_items where tenant_id=$1) as items,
    (select count(*)::int from shopify_releases where tenant_id=$1) as releases,
    (select count(*)::int from shopify_release_capabilities where tenant_id=$1) as capabilities`,[f.tenant])).rows[0];
}
async function waitBlocked(pids){
  for(let i=0;i<100;i++){
    const rows=(await admin.query('select pid,cardinality(pg_blocking_pids(pid)) as blocked from pg_stat_activity where pid=any($1::int[])',[pids])).rows;
    if(rows.length===pids.length&&rows.every(row=>row.blocked>0))return;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.fail('Race fixture did not observe all independent sessions waiting on the lock');
}
async function race(f,callA,callB){
  await blocker.query('begin');
  let settled;
  try{
    await blocker.query('select id from shopify_connections where id=$1 for update',[f.connection]);
    settled=Promise.allSettled([callA(),callB()]);
    await waitBlocked([a.pid,b.pid]);
  }finally{await blocker.query('rollback');}
  return settled;
}
function bothSucceeded(results){
  assert.equal(results.length,2);
  for(const row of results)assert.equal(row.status,'fulfilled',row.reason?.message);
  return results.map(row=>row.value);
}

async function retainedFixture(){
  const f=await fixture();f.input=await draftInput(f);
  await query(a,'select approve_shopify_business_retention($1,$2,$3,true) as result',[f.tenant,f.connection,'docker-owner']);
  const source=snapshot();source.order.name=`#R-${randomUUID()}`;source.order.createdAt=f.input.sourceCreatedAt;source.order.updatedAt=f.input.sourceUpdatedAt;
  source.lines[0].id=f.input.lines[0].lineGid;
  f.input.completeness='complete';f.input.commercialDetails=projectShopifyCommercialDetails(source);
  f.persist=client=>query(client,'select import_shopify_retained_draft($1::jsonb) as result',[JSON.stringify(f.input)]);
  return f;
}
async function managerFixture(){
  const f=await retainedFixture();f.saved=await f.persist(a);f.itemType=randomUUID();f.workflow=randomUUID();f.stage=randomUUID();
  await admin.query("insert into item_types(id,tenant_id,name) values($1,$2,'Fictional pant')",[f.itemType,f.tenant]);
  await admin.query("insert into stage_master(id,tenant_id,name) values($1,$2,'Fictional stitch')",[f.stage,f.tenant]);
  await admin.query("insert into workflows(id,tenant_id,name,item_type_id) values($1,$2,'Pant default',$3)",[f.workflow,f.tenant,f.itemType]);
  await admin.query('insert into workflow_stages(tenant_id,workflow_id,stage_master_id,sequence_number) values($1,$2,$3,1)',[f.tenant,f.workflow,f.stage]);
  f.choices={customerId:f.saved.customerId,deliveryType:'store_pickup',promisedDeliveryDate:null,note:'Fictional manager choice',
    lines:[{lineGid:f.input.lines[0].lineGid,itemTypeId:f.itemType,workflowId:f.workflow,standardSizeId:null,expectedCompletionDate:null}]};
  f.save=(client,key=randomUUID())=>query(client,'select save_shopify_manager_draft_setup($1,$2,$3,$4,$5,$6,$7,0,$8,$9::jsonb) as result',
    [f.tenant,f.connection,f.domain,'synthetic-app','docker-manager',f.saved.orderId,f.saved.sourceRevisionId,key,JSON.stringify(f.choices)]);
  f.complete=(client,setup,key)=>query(client,'select complete_shopify_manager_setup($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,clock_timestamp()) as result',
    [f.tenant,f.connection,f.domain,'synthetic-app','docker-manager',f.saved.orderId,setup.setupId,key,f.revision,f.input.sourceUpdatedAt]);
  return f;
}
test('retained import simultaneous exact retries create one visible order and one business snapshot',async()=>{
  const f=await retainedFixture(),values=bothSucceeded(await race(f,()=>f.persist(a),()=>f.persist(b)));
  assert.deepEqual(values[0],values[1]);assert.equal((await counts(f)).orders,1);assert.equal((await counts(f)).customers,1);
  assert.equal((await admin.query('select count(*)::int as n from shopify_commercial_details where tenant_id=$1',[f.tenant])).rows[0].n,1);
});
test('retained import racing a manual Reference insert cannot produce two orders',async()=>{
  const f=await retainedFixture(),reference=f.input.commercialDetails.sourceNumber,customer=randomUUID();
  await admin.query("insert into customers(id,tenant_id,name,normalized_phone_e164) values($1,$2,'Fictional existing', '+919000000011')",[customer,f.tenant]);
  await blocker.query('begin');let results;
  try{
    await blocker.query("select pg_advisory_xact_lock(hashtextextended('shopify-reference:'||$1||':'||normalize_shopify_reference($2),0))",[f.tenant,reference]);
    results=Promise.allSettled([f.persist(a),b.query("insert into orders(tenant_id,customer_id,order_number,tracking_token,reference_order_id) values($1,$2,'MANUAL-RACE',$3,$4)",
      [f.tenant,customer,randomUUID(),reference])]);
    await waitBlocked([a.pid,b.pid]);
  }finally{await blocker.query('rollback');}
  const values=await results;assert.equal(values.filter(x=>x.status==='fulfilled').length,1);
  assert.match(values.find(x=>x.status==='rejected').reason.message,/SHOPIFY_REFERENCE_CONFLICT/);
  assert.equal((await counts(f)).orders,1);assert.equal((await counts(f)).customers,1);
});
test('manager simultaneous same setup completion recovers exactly one production workflow',async()=>{
  const f=await managerFixture(),setup=await f.save(a),key=randomUUID();
  const values=bothSucceeded(await race(f,()=>f.complete(a,setup,key),()=>f.complete(b,setup,key)));
  assert.deepEqual(values[0],values[1]);assert.equal((await counts(f)).items,1);assert.equal((await counts(f)).releases,1);
  assert.equal((await admin.query('select count(*)::int as n from item_stage_instances where tenant_id=$1',[f.tenant])).rows[0].n,1);
});
test('manager concurrent different completion intents create only one workflow',async()=>{
  const f=await managerFixture(),setup=await f.save(a);
  const values=await race(f,()=>f.complete(a,setup,randomUUID()),()=>f.complete(b,setup,randomUUID()));
  assert.equal(values.filter(x=>x.status==='fulfilled').length,1);
  assert.match(values.find(x=>x.status==='rejected').reason.message,/SHOPIFY_DRAFT_LOCKED/);assert.equal((await counts(f)).items,1);
});
test('manager simultaneous edits are optimistic-version fenced',async()=>{
  const f=await managerFixture(),values=await race(f,()=>f.save(a),()=>f.save(b));
  assert.equal(values.filter(x=>x.status==='fulfilled').length,1);
  assert.match(values.find(x=>x.status==='rejected').reason.message,/SHOPIFY_STALE_REVISION/);
  assert.equal((await counts(f)).items,0);
});
test('simultaneous date-range commits queue one generation without importing reference matches',async()=>{
  const f=await fixture();
  await query(a,'select enable_shopify_unified_imports($1,$2,$3,$4,$5,$6,$7,true) as result',[f.tenant,f.connection,'docker-owner',f.domain,'synthetic-app',randomUUID(),f.revision]);
  const end=new Date(Date.now()-1000),start=new Date(end.getTime()-86400000),created=new Date(end.getTime()-3600000).toISOString();
  const rows=[{orderGid:f.order,reference:'R-NEW',createdAt:created,updatedAt:created,amount:'100.00',currency:'INR',financialStatus:'PAID',cancelledAt:null,status:'new',orderIds:[],incomingReferenceConflict:false}];
  const preview=await query(a,'select save_shopify_import_preview($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) as result',
    [f.tenant,f.connection,'docker-owner',f.domain,'synthetic-app',randomUUID(),start.toISOString(),end.toISOString(),JSON.stringify(rows)]);
  const commit=(client,key)=>query(client,'select commit_shopify_import_preview($1,$2,$3,$4,$5,$6,$7) as result',
    [f.tenant,f.connection,'docker-owner',f.domain,'synthetic-app',preview.previewId,key]);
  const key=randomUUID(),same=bothSucceeded(await race(f,()=>commit(a,key),()=>commit(b,key)));
  assert.deepEqual(same[0],same[1]);assert.equal(same[0].rows[0].status,'queued');
  const again=bothSucceeded(await race(f,()=>commit(a,randomUUID()),()=>commit(b,randomUUID())));
  assert.ok(again.every(x=>x.rows[0].status==='already_queued'));
  assert.equal((await admin.query('select requested_generation from shopify_sync_jobs where tenant_id=$1',[f.tenant])).rows[0].requested_generation,'1');
  assert.equal((await counts(f)).orders,0);
});

test('same simultaneous webhook delivery commits one receipt and one generation',async()=>{
  const f=await fixture(),delivery=randomUUID();
  const values=bothSucceeded(await race(f,()=>f.receive(a,delivery),()=>f.receive(b,delivery)));
  assert.deepEqual(values.map(row=>row.status).sort(),['accepted','duplicate']);assert.equal(values[0].receiptId,values[1].receiptId);
  const row=(await admin.query('select requested_generation from shopify_sync_jobs where connection_id=$1',[f.connection])).rows[0];assert.equal(Number(row.requested_generation),1);
});
test('actual Supabase worker-context adapter verifies PostgREST join and rechecks pause, inactive tenant and role denial',async()=>{
  const f=await fixture();
  const dbFor=role=>createClient(base,token(role),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch(input,options){const url=new URL(typeof input==='string'?input:input.url??String(input));
      assert.equal(url.origin,base);assert.ok(url.pathname.startsWith('/rest/v1/'));
      url.pathname=url.pathname.slice('/rest/v1'.length);return fetch(url,options);}}});
  const scope={tenantId:f.tenant,connectionId:f.connection,appRef:'synthetic-app',environment:'production'};
  const read=(role='service_role',binding=scope)=>readShopifyWorkerContext(dbFor(role),binding,AbortSignal.timeout(3000));
  const context=await read();assert.equal(context.tenantId,f.tenant);assert.equal(context.connectionId,f.connection);
  assert.equal(context.shopGid,f.shop);assert.equal(context.shopDomain,f.domain);assert.equal(context.revision,f.revision);
  await assert.rejects(()=>read('authenticated'));await assert.rejects(()=>read('anon'));
  await assert.rejects(()=>read('service_role',{...scope,tenantId:f.foreignTenant}));
  await admin.query("update tenants set status='suspended' where id=$1",[f.tenant]);await assert.rejects(()=>read());
  await admin.query("update tenants set status='active' where id=$1",[f.tenant]);
  await admin.query("update shopify_connections set processing_enabled=false,status='paused' where id=$1",[f.connection]);
  await assert.rejects(()=>read());
});
test('different simultaneous events coalesce without a lost generation',async()=>{
  const f=await fixture();bothSucceeded(await race(f,()=>f.receive(a),()=>f.receive(b)));
  const rows=(await admin.query('select requested_generation from shopify_sync_jobs where connection_id=$1',[f.connection])).rows;
  assert.equal(rows.length,1);assert.equal(Number(rows[0].requested_generation),2);
});
test('overlapping independent workers cannot share a live lease and do not block a different tenant',async()=>{
  const f=await fixture(),other=await fixture();await f.receive();await other.receive();
  await a.query('begin');
  try{
    const [lease]=await f.claim(a);assert.ok(lease);assert.deepEqual(await f.claim(b),[]);
    const [foreign]=await other.claim(b);assert.ok(foreign);assert.notEqual(foreign.jobId,lease.jobId);
    await a.query('commit');assert.deepEqual(await f.claim(b),[]);
  }finally{await a.query('rollback');}
});
test('simultaneous draft persistence recovers one customer/order/revision, never duplicates',async()=>{
  const f=await fixture(),input=await draftInput(f);
  const values=bothSucceeded(await race(f,()=>persist(a,input),()=>persist(b,input)));assert.deepEqual(values[0],values[1]);
  assert.deepEqual(await counts(f),{orders:1,customers:1,items:0,releases:0,capabilities:0});
  assert.equal((await admin.query('select count(*)::int as n from shopify_source_revisions where tenant_id=$1',[f.tenant])).rows[0].n,1);
});
test('pause committed while a leased import waits fences all customer/order writes',async()=>{
  const f=await fixture(),input=await draftInput(f);await blocker.query('begin');let pending;
  try{
    await blocker.query("update shopify_connections set status='paused',processing_enabled=false where id=$1",[f.connection]);
    pending=Promise.allSettled([persist(a,input)]);await waitBlocked([a.pid]);await blocker.query('commit');
  }finally{await blocker.query('rollback');}
  const [result]=await pending;assert.equal(result.status,'rejected');assert.match(result.reason.message,/SHOPIFY_ACCESS_DENIED/);
  assert.deepEqual(await counts(f),{orders:0,customers:0,items:0,releases:0,capabilities:0});
});
test('simultaneous identical owner review retry returns one committed receipt',async()=>{
  const f=await ready(),key=randomUUID();const values=bothSucceeded(await race(f,()=>f.review(a,key),()=>f.review(b,key)));
  assert.deepEqual(values[0],values[1]);assert.equal((await admin.query('select count(*)::int as n from shopify_draft_reviews where tenant_id=$1',[f.tenant])).rows[0].n,1);
});
test('simultaneous identical owner release retry returns one result and one operational item',async()=>{
  const f=await ready(),review=await f.review(),key=randomUUID();
  const values=bothSucceeded(await race(f,()=>f.release(a,review,key),()=>f.release(b,review,key)));assert.deepEqual(values[0],values[1]);
  assert.deepEqual(await counts(f),{orders:1,customers:1,items:1,releases:1,capabilities:0});
  assert.equal((await admin.query('select count(*)::int as n from shopify_order_item_links where tenant_id=$1',[f.tenant])).rows[0].n,1);
});
test('same review key with changed concurrent intent conflicts instead of silently reusing a decision',async()=>{
  const f=await ready(),key=randomUUID();
  const values=await race(f,()=>f.review(a,key),()=>f.review(b,key,0,{...f.decision,reason:'Different owner intent'}));
  assert.equal(values.filter(row=>row.status==='fulfilled').length,1);
  const failed=values.find(row=>row.status==='rejected');assert.match(failed.reason.message,/SHOPIFY_IDEMPOTENCY_CONFLICT/);
  assert.equal((await admin.query('select count(*)::int as n from shopify_draft_reviews where tenant_id=$1',[f.tenant])).rows[0].n,1);
});
test('different simultaneous release keys cannot double-materialize one source order',async()=>{
  const f=await ready(),review=await f.review();
  const values=await race(f,()=>f.release(a,review),()=>f.release(b,review));
  assert.equal(values.filter(row=>row.status==='fulfilled').length,1);
  assert.match(values.find(row=>row.status==='rejected').reason.message,/SHOPIFY_DRAFT_LOCKED/);
  assert.deepEqual(await counts(f),{orders:1,customers:1,items:1,releases:1,capabilities:0});
});
test('manager cannot recover an owner release by racing with the same request key',async()=>{
  const f=await ready(),review=await f.review(),key=randomUUID();
  const values=await race(f,()=>f.release(a,review,key),()=>query(b,'select release_shopify_order($1,$2,$3,$4,$5,$6,$7::jsonb) as result',
    [f.tenant,f.connection,'docker-manager',key,f.source,review.reviewId,JSON.stringify(f.proof)]));
  assert.equal(values[0].status,'fulfilled');assert.equal(values[1].status,'rejected');assert.match(values[1].reason.message,/SHOPIFY_ACCESS_DENIED/);
  assert.deepEqual(await counts(f),{orders:1,customers:1,items:1,releases:1,capabilities:0});
});
test('configuration row contention fails without partial production; retry after rollback succeeds',async()=>{
  const f=await ready(),review=await f.review();await blocker.query('begin');
  try{
    await blocker.query('update workflows set is_active=false where id=$1',[f.workflow]);
    await assert.rejects(()=>f.release(a,review),/SHOPIFY_CONFIGURATION_BUSY/);
    assert.deepEqual(await counts(f),{orders:1,customers:1,items:0,releases:0,capabilities:0});
  }finally{await blocker.query('rollback');}
  assert.equal((await f.release(a,review)).status,'released');
});
test('real HTTP denies ordinary table/RPC access even with a forged owner actor; service commands enforce current tenant/role',async()=>{
  const f=await ready();const args={p_tenant_id:f.tenant,p_connection_id:f.connection,p_actor_id:'docker-owner',p_request_key:randomUUID(),p_input:f.mappingInput};
  for(const role of [undefined,'authenticated']){
    const table=await http('shopify_source_revisions?select=*',role);assert.ok([401,403,404].includes(table.status));assert.equal(Array.isArray(table.data),false);
    const rpc=await http('rpc/save_shopify_mapping',role,args);assert.ok([401,403,404].includes(rpc.status));assert.ok(!rpc.data.mappingId);
  }
  for(const patch of [{p_actor_id:'docker-manager'},{p_actor_id:'docker-foreign'},{p_tenant_id:f.foreignTenant}]){
    const denied=await http('rpc/save_shopify_mapping','service_role',{...args,...patch});assert.equal(denied.status,400);assert.equal(denied.data.message,'SHOPIFY_ACCESS_DENIED');
  }
  const command={...f.mappingInput,mappingId:f.mapping.mappingId,expectedRevision:1,reason:'Fictional HTTP update'};
  const owner=await http('rpc/save_shopify_mapping','service_role',{...args,p_input:command});assert.equal(owner.status,200);assert.equal(owner.data.revision,2);
});
test('real HTTP owner review/release materializes stages but local commercial view excludes Shopify and payments remain zero',async()=>{
  const f=await ready();
  const review=await http('rpc/save_shopify_draft_review','service_role',{p_tenant_id:f.tenant,p_connection_id:f.connection,p_actor_id:'docker-owner',p_request_key:randomUUID(),
    p_source_order_id:f.source,p_source_revision_id:f.saved.sourceRevisionId,p_expected_version:0,p_decision:f.decision});assert.equal(review.status,200);
  const args={p_tenant_id:f.tenant,p_connection_id:f.connection,p_actor_id:'docker-owner',p_request_key:randomUUID(),p_source_order_id:f.source,p_review_id:review.data.reviewId,p_input:f.proof};
  const release=await http('rpc/release_shopify_order','service_role',args);assert.equal(release.status,200);assert.equal(release.data.status,'released');
  assert.deepEqual((await http('rpc/release_shopify_order','service_role',args)).data,release.data);
  const direct=await http(`orders?id=eq.${f.saved.orderId}&select=id,total_amount,discount_amount,amount_paid,financial_management`,'service_role');
  assert.equal(direct.status,200);assert.equal(direct.data[0].total_amount,900);assert.equal(direct.data[0].discount_amount,100);assert.equal(direct.data[0].amount_paid,0);assert.equal(direct.data[0].financial_management,'external_shopify');
  const local=await http(`local_operational_orders?id=eq.${f.saved.orderId}&select=id`,'service_role');assert.equal(local.status,200);assert.deepEqual(local.data,[]);
  // Historical single-column and newer composite FKs both exist. Use the
  // explicit historic FK hint instead of testing an ambiguous relationship.
  const legacy=await http('local_operational_orders?tracking_token=eq.fictional-upgrade-token&select=id,customers!orders_customer_id_fkey(name)','service_role');
  assert.equal(legacy.status,200);assert.equal(legacy.data.length,1);assert.equal(legacy.data[0].customers.name,'Fictional legacy customer');
  const stage=(await admin.query('select status from item_stage_instances where tenant_id=$1',[f.tenant])).rows;assert.deepEqual(stage,[{status:'ready_to_start'}]);
  assert.equal((await admin.query('select count(*)::int as n from order_payments where tenant_id=$1',[f.tenant])).rows[0].n,0);
});
async function releasedProduction() {
  const f=await ready(),review=await f.review();await f.release(a,review);
  f.stageInstance=(await admin.query('select id from item_stage_instances where tenant_id=$1',[f.tenant])).rows[0].id;
  const worker=randomUUID(),group=randomUUID();
  await admin.query("insert into workgroups(id,tenant_id,name) values($1,$2,'Fictional stitchers')",[group,f.tenant]);
  await admin.query("insert into workers(id,tenant_id,name) values($1,$2,'Fictional worker')",[worker,f.tenant]);
  await admin.query('insert into worker_workgroups(tenant_id,worker_id,workgroup_id) values($1,$2,$3)',[f.tenant,worker,group]);
  await admin.query('insert into stage_workgroups(tenant_id,stage_master_id,workgroup_id) values($1,$2,$3)',[f.tenant,f.stage,group]);
  await admin.query("update stage_master set effort_tracking_mode='units' where tenant_id=$1 and id=$2",[f.tenant,f.stage]);
  f.assignments=[{worker_id:worker,workgroup_id:group,credited_units:1,credited_minutes:0}];
  f.start=(client=a,key=randomUUID())=>query(client,'select start_item_stage_with_contributions($1,$2,$3::jsonb,null,$4,$5) as result',
    [f.tenant,f.stageInstance,JSON.stringify(f.assignments),'docker-owner',key]);
  f.complete=(client=a)=>query(client,'select complete_item_stage_with_contributions($1,$2,$3::jsonb,null,null,$4,$5,$6) as result',
    [f.tenant,f.stageInstance,JSON.stringify(f.assignments),'docker-owner',1,randomUUID()]);
  return f;
}
async function observationInput(f,digest='d'.repeat(64)) {
  const input=await draftInput(f);input.sourceCreatedAt=f.input.sourceCreatedAt;input.meaningfulDigest=digest;
  input.reasons=['SOURCE_CANCELLED'];return input;
}
test('simultaneous released-source retries recover one observation and one cancellation review',async()=>{
  const f=await releasedProduction(),input=await observationInput(f);
  const outcomes=bothSucceeded(await race(f,()=>persist(a,input),()=>persist(b,input)));
  assert.deepEqual(outcomes[0],outcomes[1]);assert.equal(outcomes[0].status,'observed');
  const state=(await admin.query('select held from shopify_operational_state where tenant_id=$1 and source_order_id=$2',[f.tenant,f.source])).rows[0];assert.equal(state.held,true);
  assert.equal((await admin.query('select count(*)::int as n from shopify_change_cases where tenant_id=$1',[f.tenant])).rows[0].n,1);
  await assert.rejects(()=>f.start(),/SHOPIFY_PRODUCTION_HELD/);
});
test('source-exclusive lock makes atomic production fail without waiting or partial work; retry succeeds after unlock',async()=>{
  const f=await releasedProduction();
  await blocker.query('begin');try {
    await blocker.query('select id from shopify_source_orders where tenant_id=$1 and id=$2 for update',[f.tenant,f.source]);
    await assert.rejects(()=>f.start(),/SHOPIFY_SOURCE_BUSY/);
    const rows=(await admin.query('select status,effort_tracking_mode_snapshot from item_stage_instances where tenant_id=$1',[f.tenant])).rows;
    assert.deepEqual(rows,[{status:'ready_to_start',effort_tracking_mode_snapshot:null}]);
    assert.equal((await admin.query('select count(*)::int as n from item_stage_work_logs where tenant_id=$1',[f.tenant])).rows[0].n,0);
    assert.equal((await admin.query('select count(*)::int as n from item_stage_contribution_operations where tenant_id=$1',[f.tenant])).rows[0].n,0);
  }finally {await blocker.query('rollback');}
  await f.start();assert.equal((await admin.query('select status from item_stage_instances where tenant_id=$1',[f.tenant])).rows[0].status,'in_progress');
});
test('running atomic start precedes durable source hold; every later completion rolls back and exact owner decision retry recovers',async()=>{
  const f=await releasedProduction(),input=await observationInput(f);
  let pending;
  await a.query('begin');try {
    await f.start(a);
    pending=Promise.allSettled([persist(b,input)]);await waitBlocked([b.pid]);
  }finally {await a.query('commit');}
  const outcomes=await pending;assert.equal(outcomes[0].status,'fulfilled',outcomes[0].reason?.message);
  await assert.rejects(()=>f.complete(),/SHOPIFY_PRODUCTION_HELD/);
  const rows=(await admin.query('select status,completed_at from item_stage_work_logs where tenant_id=$1',[f.tenant])).rows;
  assert.deepEqual(rows,[{status:'in_progress',completed_at:null}]);
  const st=(await admin.query('select * from shopify_operational_state where tenant_id=$1 and source_order_id=$2',[f.tenant,f.source])).rows[0];
  const key=randomUUID(),args=[f.tenant,f.connection,'docker-owner',key,f.source,st.latest_case_id,st.latest_revision_id,st.accepted_revision_id,'keep_os_plus_continue','Reviewed fictional cancellation; keep local work'];
  const decide=client=>query(client,'select review_shopify_change($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as result',args);
  const decisions=bothSucceeded(await race(f,()=>decide(a),()=>decide(b)));assert.deepEqual(decisions[0],decisions[1]);assert.equal(decisions[0].held,false);
  await f.complete();assert.equal((await admin.query('select status from item_stage_instances where tenant_id=$1',[f.tenant])).rows[0].status,'completed');
  assert.equal((await admin.query('select count(*)::int as n from order_payments where tenant_id=$1',[f.tenant])).rows[0].n,0);
  const operational=await http(`operational_orders?tenant_id=eq.${f.tenant}&id=eq.${f.saved.orderId}&select=id`,'service_role');assert.equal(operational.status,200);assert.equal(operational.data.length,1);
  const denied=await http(`operational_orders?tenant_id=eq.${f.tenant}&select=id`,'authenticated');assert.ok([401,403].includes(denied.status));
});

const dispatchHeader=(f,client=a)=>query(client,`INSERT INTO order_handovers(tenant_id,order_id,handover_number,handover_type,handed_over_at,balance_acknowledged)
  VALUES($1,$2,$3,'store_pickup',now(),true) RETURNING id AS result`,[f.tenant,f.saved.orderId,'FICTIONAL-'+randomUUID()]);

test('Shopify dispatch source contention fails without a partial handover, then retry succeeds',async()=>{
  const f=await releasedProduction();await blocker.query('begin');try{
    await blocker.query('select id from shopify_source_orders where id=$1 for update',[f.source]);
    await assert.rejects(()=>dispatchHeader(f),/SHOPIFY_SOURCE_BUSY/);
    assert.equal((await admin.query('select count(*)::int n from order_handovers where tenant_id=$1',[f.tenant])).rows[0].n,0);
  }finally{await blocker.query('rollback');}
  assert.ok(await dispatchHeader(f));
});

test('dispatch preceding a source hold completes once; later dispatch is rejected',async()=>{
  const f=await releasedProduction(),input=await observationInput(f);let pending;
  await a.query('begin');try{
    await dispatchHeader(f);pending=Promise.allSettled([persist(b,input)]);await waitBlocked([b.pid]);
  }finally{await a.query('commit');}
  assert.equal((await pending)[0].status,'fulfilled');
  await assert.rejects(()=>dispatchHeader(f),/SHOPIFY_PRODUCTION_HELD/);
  assert.equal((await admin.query('select count(*)::int n from order_handovers where tenant_id=$1',[f.tenant])).rows[0].n,1);
});

test('stale repeatable-read dispatch cannot use a pre-cancellation snapshot',async()=>{
  const f=await releasedProduction(),input=await observationInput(f);
  await a.query('begin isolation level repeatable read');try{
    assert.equal((await a.query('select held from shopify_operational_state where source_order_id=$1',[f.source])).rows[0].held,false);
    await persist(b,input);
    await assert.rejects(()=>dispatchHeader(f),e=>e.code==='40001');
  }finally{await a.query('rollback');}
  assert.equal((await admin.query('select count(*)::int n from order_handovers where tenant_id=$1',[f.tenant])).rows[0].n,0);
  await assert.rejects(()=>dispatchHeader(f),/SHOPIFY_PRODUCTION_HELD/);
});

test('local item handover does not gain Shopify locks during a concurrent header note update',async()=>{
  const f=await releasedProduction(),order=randomUUID();
  await admin.query(`insert into orders(id,tenant_id,customer_id,order_number,tracking_token) values($1::uuid,$2,$3,'FICTIONAL-LOCAL',($1::uuid)::text)`,[order,f.tenant,f.saved.customerId]);
  const item=(await admin.query(`insert into order_items(tenant_id,order_id,item_type_id,name,workflow_id) values($1,$2,$3,'Fictional local item',$4) returning id`,
    [f.tenant,order,f.mappingInput.itemTypeId,f.mappingInput.workflowId])).rows[0].id;
  const header=await dispatchHeader({...f,saved:{orderId:order}});
  await blocker.query('begin');try{
    await blocker.query("update order_handovers set internal_notes='Fictional pending note' where id=$1",[header]);
    await a.query('insert into order_handover_items(tenant_id,order_id,handover_id,order_item_id) values($1,$2,$3,$4)',[f.tenant,order,header,item]);
  }finally{await blocker.query('rollback');}
  assert.equal((await admin.query('select count(*)::int n from order_handover_items where handover_id=$1',[header])).rows[0].n,1);
});

test('real HTTP V2 mutations deny ordinary forged actors while retaining the service command',async()=>{
  const f=await ready(),order=randomUUID();
  await admin.query(`insert into orders(id,tenant_id,customer_id,order_number,tracking_token,runtime_model,vertical_key)
    values($1::uuid,$2,$3,'FICTIONAL-V2',($1::uuid)::text,'work_unit_v2','boutique')`,[order,f.tenant,f.saved.customerId]);
  const args={p_tenant_id:f.tenant,p_order_id:order,p_vertical_key:'boutique',p_workflow_id:f.mappingInput.workflowId,
    p_display_code:'FICTIONAL',p_line_name:'Fictional work',p_actor:'untrusted-fictional-actor'};
  for(const role of ['anon','authenticated']){
    const denied=await http('rpc/create_work_unit_runtime',role,args);assert.ok([401,403].includes(denied.status));
  }
  assert.equal((await admin.query('select count(*)::int n from work_units where order_id=$1',[order])).rows[0].n,0);
  assert.equal((await http('rpc/create_work_unit_runtime','service_role',args)).status,200);
  assert.equal((await admin.query('select count(*)::int n from work_units where order_id=$1',[order])).rows[0].n,1);
});
