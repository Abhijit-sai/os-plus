// Actual application services + real SQL in a disposable fictional PGlite DB.
// Shopify HTTP is a fixed synthetic responder; no env files/network/private rows.
import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { randomUUID,createHmac } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { snapshot } from '../fixtures/shopify-draft.mjs';
import { createShopifyApplicationService } from '../../src/integrations/shopify/application-service.ts';
import { createShopifyApplicationSource } from '../../src/integrations/shopify/application-source.ts';
import { runShopifyPilotWorker } from '../../src/integrations/shopify/application-worker.ts';
import { createShopifyApplicationIngress } from '../../src/integrations/shopify/application-ingress.ts';
import { projectImportedShopifyOrder } from '../../src/integrations/shopify/imported-order.ts';
const db=new PGlite(),folder=new URL('../../supabase/migrations/',import.meta.url);
before(async()=>{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile(new URL(file,folder),'utf8')).replace('create extension if not exists "pgcrypto";',''));
  // Locally rehearse the separately proposed permission-only follow-up too.
  // This fixture is memory-only; the proposal is not an automatic migration.
  await db.exec(await readFile(new URL('../../docs/sql/20261015170000_shopify_trigger_permission_cleanup.proposed.sql',import.meta.url),'utf8'));
});
after(()=>db.close());
const scalar=async(sql,args=[])=> (await db.query(sql,args)).rows[0]?.result;
const adapter={
  rpc(name,args){assert.match(name,/^[a-z_]+$/);const names=Object.keys(args);for(const key of names)assert.match(key,/^p_[a-z_]+$/);
    return {async abortSignal(signal){signal.throwIfAborted();try{return {data:await scalar(`SELECT public.${name}(${names.map((key,i)=>`${key}=>$${i+1}`).join(',')}) AS result`,
      Object.values(args).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v)),error:null};}catch(e){return {data:null,error:{message:e.message}};}}};},
  from(table){assert.equal(table,'shopify_connections');const filters=[],values=[];let select;
    const q={select(v){select=v;return q;},in(key,value){assert.match(key,/^[a-z_]+$/);values.push(value);filters.push(`c.${key}=ANY($${values.length})`);return q;},eq(key,value){assert.match(key,/^[a-z_]+$/);values.push(value);filters.push(`c.${key}=$${values.length}`);return q;},limit(){return q;},async abortSignal(signal){
      signal.throwIfAborted();const rows=(await db.query(`SELECT c.*,jsonb_build_object('id',t.id,'status',t.status) AS tenants FROM shopify_connections c JOIN tenants t ON t.id=c.tenant_id WHERE ${filters.join(' AND ')}`,values)).rows;
      const fields=select.split(',tenants!')[0].split(',');return {data:rows.map(row=>({...Object.fromEntries(fields.map(k=>[k,row[k] instanceof Date?row[k].toISOString():row[k]])),...(select.includes('tenants!')?{tenants:row.tenants}:{})})),error:null};}};return q;},
};
async function fixture(){
  const tenant=randomUUID(),itemType=randomUUID(),workflow=randomUUID(),stage=randomUUID(),actor={userId:'fictional-owner',tenantId:tenant,role:'owner_admin',membershipUserId:'fictional-owner',membershipTenantId:tenant,membershipStatus:'active',tenantStatus:'active'};
  await db.query(`INSERT INTO tenants(id,name,slug,store_name) VALUES($1::uuid,'Fictional application','fictional-'||($1::uuid)::text,'Fictional application')`,[tenant]);
  await db.query(`INSERT INTO tenant_users(tenant_id,clerk_user_id,role,status) VALUES($1,'fictional-owner','owner_admin','active'),($1,'fictional-manager','manager','active')`,[tenant]);
  await db.query(`INSERT INTO tenant_verticals(tenant_id,vertical_definition_id,is_enabled,enabled_at) SELECT $1,id,true,now() FROM vertical_definitions WHERE key='boutique'`,[tenant]);
  await db.query(`INSERT INTO item_types(id,tenant_id,name) VALUES($1,$2,'Fictional shirts')`,[itemType,tenant]);
  await db.query(`INSERT INTO workflows(id,tenant_id,name,item_type_id) VALUES($1,$2,'Fictional workflow',$3)`,[workflow,tenant,itemType]);
  await db.query(`INSERT INTO stage_master(id,tenant_id,name) VALUES($1,$2,'Fictional stitching')`,[stage,tenant]);
  await db.query(`INSERT INTO workflow_stages(tenant_id,workflow_id,stage_master_id,sequence_number) VALUES($1,$2,$3,1)`,[tenant,workflow,stage]);
  const source=snapshot(),stamp=new Date(Date.now()-300000).toISOString();source.order.createdAt=new Date(Date.now()-600000).toISOString();source.order.updatedAt=stamp;
  source.order.customer={id:'gid://shopify/Customer/101',firstName:'Fictional',lastName:'Buyer',email:null,phone:'+919876543210'};
  source.lines[0].variant={id:'gid://shopify/ProductVariant/21'};
  const calls=[],shop={id:'gid://shopify/Shop/101',myshopifyDomain:'synthetic-intake.myshopify.com'};
  const transport=async(url,init)=>{
    assert.equal(new URL(url).hostname,shop.myshopifyDomain);calls.push(new URL(url).pathname);
    if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'fictional-token',expires_in:3600,scope:'read_orders,read_customers,read_products'});
    assert.equal(new URL(url).pathname,'/admin/api/2026-10/graphql.json');const input=JSON.parse(init.body);let data;
    if(input.query.includes('OSPlusPilotSetup'))data={shop,currentAppInstallation:{accessScopes:['read_orders','read_customers','read_products'].map(handle=>({handle}))}};
    else if(input.query.includes('OSPlusOrderSnapshot'))data={order:{...source.order,lineItems:{nodes:source.lines,pageInfo:{hasNextPage:false,endCursor:null}}}};
    else if(input.query.includes('OSPlusOrderShipping'))data={order:{...source.order,shippingLines:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}};
    else if(input.query.includes('OSPlusCatalogueEnrichment'))data={nodes:input.variables.ids.map(()=>null)};
    else data={shop,order:source.order};
    return Response.json({data},{headers:{'X-Shopify-API-Version':'2026-10'}});
  };
  const env={VERCEL_ENV:'production',SHOPIFY_DEPLOYMENT_ENV:'production',SHOPIFY_API_VERSION:'2026-10',SHOPIFY_CONNECTION_SCREEN_ENABLED:'true',SHOPIFY_PILOT_OPERATIONS_ENABLED:'true',SHOPIFY_CONNECTION_TEST_TENANT_ID:tenant,
    SHOPIFY_SHOP_DOMAIN:shop.myshopifyDomain,SHOPIFY_APPLICATION_ORIGIN:'https://example.invalid',SHOPIFY_CLIENT_ID:'synthetic-app',SHOPIFY_CLIENT_SECRET:'fictional-secret',
    SHOPIFY_TEST_COPY_ENABLED:'true',SHOPIFY_SYNC_ENABLED:'true',SHOPIFY_HYDRATION_ENABLED:'true',SHOPIFY_DRAFT_IMPORT_ENABLED:'true',SHOPIFY_EXECUTOR_ENABLED:'true',SHOPIFY_PILOT_CREDENTIALS_ENABLED:'true',SHOPIFY_RELEASE_ENABLED:'true',
    SHOPIFY_SOURCE_KEY_ID:'fictional-test-key',SHOPIFY_SOURCE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
  const service=createShopifyApplicationService(adapter,createShopifyApplicationSource(transport),(id,signal,e)=>runShopifyPilotWorker(adapter,id,signal,e,false,transport),transport);
  const signal=new AbortController().signal,run=input=>service.execute(actor,{requestKey:randomUUID(),...input},signal,env),view=()=>service.view(actor,signal,env);
  return {tenant,itemType,workflow,actor,source,env,service,run,view,calls,signal,transport};
}
const isolated=fn=>async()=>{await db.exec('BEGIN');try{await fn(await fixture());}finally{await db.exec('ROLLBACK');}};
async function authorize(f){
  await f.run({action:'connect',cutoff:new Date(Date.now()-3600000).toISOString()});let state=await f.view();assert.equal(state.connection.status,'pending');assert.equal(state.policy,null);
  await f.run({action:'authorize_copy',connectionId:state.connection.id,expectedRevision:state.connection.revision,orderGid:f.source.order.id,retentionDays:1,reason:'Fictional permission to validate one Test order',consent:true});state=await f.view();
  return state;
}
async function copy(f){
  const state=await authorize(f);
  const queued={action:'queue_order',connectionId:state.connection.id,requestKey:randomUUID()};await f.run(queued);await f.run(queued);
  const saved=await f.run({action:'run_worker',connectionId:state.connection.id});assert.equal(saved.status,'draft');return f.view();
}
test('owner connect→one-copy→worker→map→review→release→exact recovery runs actual application and SQL',isolated(async f=>{
  let state=await copy(f);assert.equal(state.sources.length,1);assert.equal(state.sources[0].payment.status,'PAID');assert.equal(state.sources[0].payment.amounts.received,'118.00');
  assert.equal(state.sources[0].lines[0].quantity,1);assert.equal(JSON.stringify(state).includes('ciphertext'),false);assert.equal(JSON.stringify(state).includes('fictional-secret'),false);
  const scope={connectionId:state.connection.id};
  await f.run({action:'save_mapping',...scope,input:{mappingId:null,expectedRevision:0,variantGid:f.source.lines[0].variant.id,sku:f.source.lines[0].sku.trim(),classification:'production',itemTypeId:f.itemType,workflowId:f.workflow,standardSizeId:null,isActive:true,reason:'Fictional exact variant'}});
  state=await f.view();const source=state.sources[0],mapping=state.mappings[0];
  await f.run({action:'save_review',...scope,sourceOrderId:source.id,sourceRevisionId:source.revisionId,expectedVersion:0,decision:{customerId:source.customerId,deliveryType:'store_pickup',reason:'Fictional review complete',lines:[{lineGid:source.lines[0].id,mappingId:mapping.id,mappingRevision:mapping.revision}]}});
  state=await f.view();const release={action:'release',...scope,requestKey:randomUUID(),sourceOrderId:source.id,reviewId:state.sources[0].review.id};
  const first=await f.run(release);assert.equal(first.status,'released');const calls=f.calls.length;
  await f.run({action:'connection_state',...scope,expectedRevision:state.connection.revision,state:'pause'});
  assert.deepEqual(await f.run(release),{status:'released',orderId:first.orderId});assert.equal(f.calls.length,calls);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_items WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM item_stage_instances WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_payments WHERE tenant_id=$1',[f.tenant]),0);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM local_operational_orders WHERE tenant_id=$1',[f.tenant]),0);
}));
test('application rejects manager, foreign binding, authority and browser financial values before dependencies',isolated(async f=>{
  let reads=0;const denied=createShopifyApplicationService({rpc(){reads++;throw Error('unexpected');}},async()=>{throw Error('unexpected');},async()=>{throw Error('unexpected');});
  await assert.rejects(()=>denied.view({...f.actor,role:'manager'},f.signal,f.env),/ACCESS_DENIED/);
  await assert.rejects(()=>f.run({action:'connect',tenantId:randomUUID(),cutoff:new Date().toISOString()}));assert.equal(reads,0);
  const state=await copy(f);await assert.rejects(()=>f.run({action:'queue_order',connectionId:randomUUID()}),/ACCESS_DENIED/);
  await assert.rejects(()=>f.run({action:'save_review',connectionId:state.connection.id,sourceOrderId:state.sources[0].id,sourceRevisionId:state.sources[0].revisionId,expectedVersion:0,decision:{totalAmount:1}}));
}));

test('imported order is readable without mapping, review, release or production rows',isolated(async f=>{
  f.env.SHOPIFY_RELEASE_ENABLED='false';
  const state=await copy(f),id=state.sources[0].orderId;
  const read=actor=>scalar('SELECT public.read_shopify_imported_orders($1,$2,$3,$4,$5,$6) AS result',
    [f.tenant,actor,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,id,null]);
  const rows=await read('fictional-owner');
  assert.equal(rows.length,1);assert.equal(rows[0].orderId,id);
  const projected=projectImportedShopifyOrder(rows[0],f.tenant,f.env);
  assert.equal(projected.availability,'available');assert.equal(projected.lines.length,1);
  assert.equal(projected.sourceNumber,f.source.order.name);assert.equal(projected.payment.amounts.received,'118.00');
  assert.ok(!JSON.stringify(projected).includes('sealedSource'));
  assert.equal((await read('fictional-manager')).length,1);
  assert.deepEqual(await read('foreign-actor'),[]);
  for(const table of ['shopify_variant_mappings','shopify_draft_reviews','shopify_releases','order_items','item_stage_instances','order_payments','local_operational_orders','operational_orders'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0,table);
}));

test('signed webhook creates a readable order automatically; duplicate and unrelated events cannot duplicate or fan out',isolated(async f=>{
  f.env.SHOPIFY_RELEASE_ENABLED='false';f.env.SHOPIFY_INTAKE_ENABLED='true';f.env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED='true';
  const state=await authorize(f),tasks=[];
  const ingress=createShopifyApplicationIngress(adapter,{schedule:task=>tasks.push(task),
    run:(db,id,signal,env)=>runShopifyPilotWorker(db,id,signal,env,false,f.transport)});
  const delivery=randomUUID();
  const request=(gid=f.source.order.id,signatureSecret=f.env.SHOPIFY_CLIENT_SECRET,deliveryId=delivery)=>{
    const body=JSON.stringify({admin_graphql_api_id:gid});
    return new Request('https://example.invalid/api/integrations/shopify/orders-webhook',{method:'POST',body,headers:{
      'content-type':'application/json','x-shopify-shop-domain':f.env.SHOPIFY_SHOP_DOMAIN,'x-shopify-topic':'orders/create',
      'x-shopify-api-version':'2026-10','x-shopify-webhook-id':deliveryId,
      'x-shopify-hmac-sha256':createHmac('sha256',signatureSecret).update(body).digest('base64')}});
  };
  assert.equal((await ingress.orders(request(),f.env)).status,200);
  assert.equal(tasks.length,1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),0,'ack only after durable queue, before async copy');
  await tasks.shift()();
  const rows=await scalar('SELECT public.read_shopify_imported_orders($1,$2,$3,$4) AS result',[f.tenant,'fictional-owner',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID]);
  assert.equal(rows.length,1);assert.equal(projectImportedShopifyOrder(rows[0],f.tenant,f.env).payment.status,'PAID');
  assert.equal((await ingress.orders(request(),f.env)).status,200);await tasks.shift()();
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal((await ingress.orders(request('gid://shopify/Order/999'),f.env)).status,200);assert.equal(tasks.length,0);
  assert.equal((await ingress.orders(request(f.source.order.id,'wrong',randomUUID()),f.env)).status,401);assert.equal(tasks.length,0);
  for(const table of ['shopify_variant_mappings','shopify_draft_reviews','shopify_releases','order_items','order_payments'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0,table);
  assert.equal((await f.view()).connection.id,state.connection.id);
}));

test('imported-order read fails closed across roles, tenants, binding, retention and ordinary SQL roles',isolated(async f=>{
  const state=await copy(f),id=state.sources[0].orderId;
  const read=(tenant=f.tenant,actor='fictional-owner',domain=f.env.SHOPIFY_SHOP_DOMAIN,search=null)=>scalar(
    'SELECT public.read_shopify_imported_orders($1,$2,$3,$4,$5,$6) AS result',[tenant,actor,domain,f.env.SHOPIFY_CLIENT_ID,id,search]);
  for(const role of ['finance','viewer']){
    await db.query('INSERT INTO tenant_users(tenant_id,clerk_user_id,role,status) VALUES($1,$2,$3,\'active\')',[f.tenant,role,role]);
    assert.deepEqual(await read(f.tenant,role),[]);
  }
  assert.deepEqual(await read(randomUUID()),[]);assert.deepEqual(await read(f.tenant,'fictional-owner','foreign.myshopify.com'),[]);
  assert.deepEqual(await read(f.tenant,'fictional-owner',f.env.SHOPIFY_SHOP_DOMAIN,'%'),[],'search metacharacters are literal');
  await db.query("UPDATE tenant_users SET status='disabled' WHERE tenant_id=$1 AND clerk_user_id='fictional-manager'",[f.tenant]);
  assert.deepEqual(await read(f.tenant,'fictional-manager'),[]);
  const [row]=await read();
  assert.equal(projectImportedShopifyOrder(row,f.tenant,f.env,Date.parse(row.expiresAt)).availability,'expired');
  assert.throws(()=>projectImportedShopifyOrder(row,randomUUID(),f.env),/ACCESS_DENIED/);
  for(const role of ['anon','authenticated'])assert.equal(await scalar("SELECT has_function_privilege($1,'public.read_shopify_imported_orders(uuid,text,text,text,uuid,text)','EXECUTE') AS result",[role]),false);
  await db.query("UPDATE tenants SET status='suspended' WHERE id=$1",[f.tenant]);assert.deepEqual(await read(),[]);
}));

test('owner webhook setup→signed delivery→automatic worker creates one order without mapping or release',isolated(async f=>{
  Object.assign(f.env,{SHOPIFY_INTAKE_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true',SHOPIFY_RELEASE_ENABLED:'false'});
  const state=await authorize(f),rows=[],tasks=[];
  const ingress=createShopifyApplicationIngress(adapter,{schedule:task=>tasks.push(task),run:(db,id,signal,env)=>runShopifyPilotWorker(db,id,signal,env,false,f.transport)});
  const transport=async(url,init)=>{
    if(url==='https://example.invalid/api/integrations/shopify/orders-webhook')return ingress.orders(new Request(url,init),f.env);
    if(url.endsWith('/graphql.json')){
      const input=JSON.parse(init.body);let data;
      if(input.query.includes('OSPlusPilotWebhooks'))data={shop:{id:'gid://shopify/Shop/101',myshopifyDomain:f.env.SHOPIFY_SHOP_DOMAIN},
        currentAppInstallation:{app:{apiKey:f.env.SHOPIFY_CLIENT_ID,webhookApiVersion:'2026-10'}},webhookSubscriptions:{nodes:rows,pageInfo:{hasNextPage:false,endCursor:null}}};
      if(input.query.includes('OSPlusCreatePilotWebhook')){
        assert.equal(input.variables.subscription.filter,`id:${f.source.order.id.split('/').at(-1)}`);
        const row={...input.variables.subscription,topic:input.variables.topic,id:`gid://shopify/WebhookSubscription/${rows.length+1}`,apiVersion:{handle:'2026-10'}};rows.push(row);
        data={webhookSubscriptionCreate:{webhookSubscription:row,userErrors:[]}};
      }
      if(data)return Response.json({data},{headers:{'X-Shopify-API-Version':'2026-10'}});
    }
    return f.transport(url,init);
  };
  const service=createShopifyApplicationService(adapter,createShopifyApplicationSource(transport),async()=>assert.fail('test must not manually run worker'),transport);
  const command=action=>({action,requestKey:randomUUID(),connectionId:state.connection.id});
  const run=(input,actor=f.actor)=>service.execute(actor,input,f.signal,f.env);
  await assert.rejects(()=>run(command('register_webhooks'),{...f.actor,role:'manager'}),/ACCESS_DENIED/);assert.equal(rows.length,0);
  await assert.rejects(()=>run(command('test_webhook')),/WEBHOOK_SETUP_REQUIRED/);assert.equal(tasks.length,0);
  assert.equal((await run(command('register_webhooks'))).created,3);
  assert.equal((await run(command('register_webhooks'))).created,0);
  const delivery=command('test_webhook');assert.equal((await run(delivery)).status,'webhook_test_received');assert.equal(tasks.length,2);
  while(tasks.length)await tasks.shift()();
  assert.equal((await f.view()).sources.length,1);
  await run(delivery);while(tasks.length)await tasks.shift()();
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  for(const table of ['shopify_variant_mappings','shopify_draft_reviews','shopify_releases','order_items','order_payments'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0,table);
  const latest=await f.view();assert.equal(latest.jobs[0].requested,latest.jobs[0].completed);assert.equal(latest.sources[0].payment.status,'PAID');
  await db.query("UPDATE tenant_users SET status='disabled' WHERE tenant_id=$1 AND clerk_user_id='fictional-owner'",[f.tenant]);
  await assert.rejects(()=>run(command('register_webhooks')),/ACCESS_DENIED/);assert.equal(rows.length,3);
}));
