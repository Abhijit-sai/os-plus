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
import { readShopifyWorkerContext } from '../../src/integrations/shopify/worker-context.ts';
import { createShopifyQueueStore } from '../../src/integrations/shopify/queue-store.ts';
import { createShopifyDraftStore } from '../../src/integrations/shopify/draft-store.ts';
import { createShopifyOrderHydrator } from '../../src/integrations/shopify/order-hydration.ts';
import { createShopifyPilotCredentialReader } from '../../src/integrations/shopify/pilot-credentials.ts';
import { readShopifyCommercialDetails } from '../../src/integrations/shopify/commercial-order.ts';
import { createShopifyManagerService } from '../../src/integrations/shopify/manager-service.ts';
import { createShopifyUnifiedService } from '../../src/integrations/shopify/unified-service.ts';
import { runShopifyUnifiedWorker } from '../../src/integrations/shopify/unified-worker.ts';
import { beginShopifyApproval } from '../../src/integrations/shopify/oauth.ts';
import { sealShopifyCredential } from '../../src/integrations/shopify/oauth-crypto.ts';
const db=new PGlite(),folder=new URL('../../supabase/migrations/',import.meta.url);
before(async()=>{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;`);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile(new URL(file,folder),'utf8')).replace('create extension if not exists "pgcrypto";',''));
  // Locally rehearse the separately proposed permission-only follow-up too.
  // This fixture is memory-only; the proposal is not an automatic migration.
  await db.exec(await readFile(new URL('../../docs/sql/20261015170000_shopify_trigger_permission_cleanup.proposed.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../docs/sql/20261020180000_shopify_oauth_credentials.proposed.sql',import.meta.url),'utf8'));
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
    SHOPIFY_SCHEDULED_WORKER_ENABLED:'true',SHOPIFY_WORKER_SECRET:'fictional_012345678901234567890123456789',
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

async function retainedCopy(f){
  const state=await authorize(f),connection=state.connection.id;
  await scalar('SELECT public.approve_shopify_business_retention($1,$2,$3,true) AS result',[f.tenant,connection,f.actor.userId]);
  await f.run({action:'queue_order',connectionId:connection});
  const binding={tenantId:f.tenant,connectionId:connection,appRef:f.env.SHOPIFY_CLIENT_ID,environment:'production'};
  const context=await readShopifyWorkerContext(adapter,binding,f.signal),[lease]=await createShopifyQueueStore(adapter).claim(binding,1,f.signal);
  const token=await createShopifyPilotCredentialReader(f.transport)(context,f.signal,f.env);
  const source=await createShopifyOrderHydrator(f.transport)(context,lease,token.accessToken,f.signal,f.env);
  assert.equal(source.status,'complete');
  const result=await createShopifyDraftStore(adapter,{retainBusinessDetails:true}).importSnapshot(source.snapshot,context,lease,f.signal,f.env);
  return {connection,context,lease,source,result};
}

test('date range service previews, skips manual references, imports an older authorized order and appears in ordinary Orders',isolated(async f=>{
  await authorize(f);Object.assign(f.env,{SHOPIFY_UNIFIED_ORDERS_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true'});
  // Manual owner actions must not depend on an external scheduler or its secret.
  delete f.env.SHOPIFY_SCHEDULED_WORKER_ENABLED;delete f.env.SHOPIFY_WORKER_SECRET;
  f.source.order.createdAt=new Date(Date.now()-3*86400000).toISOString();
  const customer=randomUUID();await db.query("INSERT INTO customers(id,tenant_id,name) VALUES($1,$2,'Existing fictional buyer')",[customer,f.tenant]);
  await db.query("INSERT INTO orders(tenant_id,customer_id,order_number,tracking_token,reference_order_id) VALUES($1,$2,'EXISTING','existing-test-ref',' #manual-1 ')",[f.tenant,customer]);
  const shop={id:'gid://shopify/Shop/101',myshopifyDomain:f.env.SHOPIFY_SHOP_DOMAIN};
  const row={id:f.source.order.id,name:f.source.order.name,createdAt:f.source.order.createdAt,updatedAt:f.source.order.updatedAt,cancelledAt:null,
    displayFinancialStatus:'PAID',currentTotalPriceSet:{shopMoney:{amount:'118.00',currencyCode:'INR'}}};
  const transport=async(url,init)=>{
    if(url.endsWith('/graphql.json')){const input=JSON.parse(init.body);
      if(input.query.includes('OSPlusImportScope'))return Response.json({data:{shop,currentAppInstallation:{accessScopes:[{handle:'read_orders'}]}}},{headers:{'X-Shopify-API-Version':'2026-10'}});
      if(input.query.includes('OSPlusImportOrders'))return Response.json({data:{shop,orders:{nodes:[row,{...row,id:'gid://shopify/Order/999',name:'MANUAL-1'}],pageInfo:{hasNextPage:false,endCursor:null}}}},{headers:{'X-Shopify-API-Version':'2026-10'}});
    }return f.transport(url,init);
  };
  const checkedAdapter={...adapter,rpc(name,args){return {async abortSignal(signal){const result=await adapter.rpc(name,args).abortSignal(signal);assert.equal(result.error,null,`${name}: ${result.error?.message}`);
    // PostgREST serializes timestamp-returning RPCs; PGlite returns Date objects.
    if(result.data instanceof Date)result.data=result.data.toISOString();return result;}};}};
  const service=createShopifyUnifiedService(checkedAdapter,transport),run=command=>service.execute(f.actor,{requestKey:randomUUID(),
    ...(['enable','import','process'].includes(command.action)?{manualCleanupAcknowledged:true}:{}),...command},f.signal,f.env);
  await assert.rejects(()=>service.execute(f.actor,{action:'enable',requestKey:randomUUID(),consent:true},f.signal,f.env),/MANUAL_CLEANUP_REQUIRED/);
  await run({action:'enable',consent:true});assert.equal((await service.view(f.actor,f.signal,f.env)).connection.automatic,false);
  assert.equal((await service.view(f.actor,f.signal,f.env)).workerConfigured,false);
  const beforeAutomatic=f.calls.length;
  await assert.rejects(()=>run({action:'automatic',enabled:true}),/WEBHOOK_SETUP_REQUIRED/);
  assert.equal(f.calls.length,beforeAutomatic,'automatic enable must fail before Shopify calls');
  const day=new Date(Date.parse(f.source.order.createdAt)+330*60000).toISOString().slice(0,10);
  const preview=(await run({action:'preview',from:day,through:day})).preview;
  assert.equal(preview.rows[0].status,'new');assert.equal(preview.rows[1].status,'reference_match');
  const command={action:'import',previewId:preview.previewId,requestKey:randomUUID()};
  const queued=await run(command);assert.deepEqual(queued.receipt.rows.map(x=>x.status),['queued','reference_match']);
  assert.deepEqual((await run(command)).receipt,queued.receipt);
  const result=await run({action:'process'});assert.equal(result.status,'success');
  assert.equal(result.view.connection.pending,0,JSON.stringify(result));
  const connection=result.view.connection.id;
  const imported=await scalar('SELECT reference_order_id AS result FROM orders WHERE tenant_id=$1 AND source=\'shopify\'',[f.tenant]);
  assert.equal(imported,row.name);
  const list=await scalar(`SELECT jsonb_agg(o.order_number) AS result FROM list_shopify_commercial_orders($1,$2,$3,$4) o`,[f.tenant,f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID]);
  assert.equal(list.length,2);
  const again=(await run({action:'preview',from:day,through:day})).preview;
  assert.equal(again.rows[0].status,'already_imported');
  assert.deepEqual((await run({action:'import',previewId:again.previewId})).receipt.rows.map(x=>x.status),['already_imported','reference_match']);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),2);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_commercial_details WHERE tenant_id=$1',[f.tenant]),1);
  await db.exec('SAVEPOINT unapproved_source');
  await assert.rejects(()=>scalar(`SELECT receive_shopify_event($1,$2,$3,$4,'production',(SELECT revision FROM shopify_connections WHERE id=$2),'orders/updated',$5,null,'2026-10','gid://shopify/Order/777',$6,clock_timestamp()) AS result`,
    [f.tenant,connection,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,randomUUID(),'a'.repeat(64)]),/SHOPIFY_COPY_APPROVAL_REQUIRED/);
  await db.exec('ROLLBACK TO SAVEPOINT unapproved_source');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_sync_jobs WHERE tenant_id=$1',[f.tenant]),1);
  // Follow the same imported order through the actual manager service, not a
  // separately seeded retained draft. Only Shopify HTTP remains synthetic.
  const orderId=await scalar("SELECT id AS result FROM orders WHERE tenant_id=$1 AND source='shopify'",[f.tenant]);
  const manager={...f.actor,userId:'fictional-manager',membershipUserId:'fictional-manager',role:'manager'};
  const managerService=createShopifyManagerService(checkedAdapter,transport),draft=await managerService.view(manager,orderId,f.signal,f.env);
  const customerId=await scalar('SELECT customer_id AS result FROM orders WHERE id=$1',[orderId]);
  const choices={customerId,deliveryType:'store_pickup',promisedDeliveryDate:null,note:'Manual import test',
    lines:[{lineGid:f.source.lines[0].id,itemTypeId:f.itemType,workflowId:f.workflow,standardSizeId:null,expectedCompletionDate:null}]};
  const saved=await managerService.save(manager,{orderId,sourceRevisionId:draft.sourceRevisionId,expectedVersion:0,requestKey:randomUUID(),choices},f.signal,f.env);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_items WHERE tenant_id=$1',[f.tenant]),0);
  const completion={orderId,connectionId:connection,setupId:saved.setupId,requestKey:randomUUID()};
  const completed=await managerService.complete(manager,completion,f.signal,f.env);
  assert.equal(completed.status,'setup_complete');
  assert.deepEqual(await managerService.complete(manager,completion,f.signal,f.env),completed);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM item_workflow_instances WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_payments WHERE tenant_id=$1',[f.tenant]),0);
  const cleanup=await run({action:'cleanup'});assert.match(cleanup.message,/Removed 0 expired/);
  // Historical raw payload in the disposable fixture only: exercise the real
  // owner action and expiry RPC, without altering any live observation clock.
  await db.query(`INSERT INTO shopify_source_revisions SELECT (jsonb_populate_record(null::shopify_source_revisions,
    to_jsonb(r)||jsonb_build_object('id',gen_random_uuid(),'generation',1000,
      'observed_at',clock_timestamp()-interval '25 hours'))).*
    FROM shopify_source_revisions r WHERE r.tenant_id=$1 AND r.generation=1`,[f.tenant]);
  assert.match((await run({action:'cleanup'})).message,/Removed 1 expired/);
  assert.match((await run({action:'cleanup'})).message,/Removed 0 expired/);
  assert.equal(await scalar("SELECT count(*)::int AS result FROM shopify_source_revisions WHERE tenant_id=$1 AND sealed_source ? 'ciphertext'",[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_commercial_details WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),2);
  for(const changedActor of [{...f.actor,role:'manager'},{...f.actor,tenantId:randomUUID()}])
    await assert.rejects(()=>service.execute(changedActor,{action:'cleanup',requestKey:randomUUID()},f.signal,f.env),/ACCESS_DENIED/);
}));

test('a different Shopify buyer name sharing an existing phone still creates a retained draft without renaming the customer',isolated(async f=>{
  const existing=randomUUID();
  f.source.order.phone='+919876543210';
  await db.query("INSERT INTO customers(id,tenant_id,name,phone,normalized_phone_e164) VALUES($1,$2,'Existing family member','9876543210','+919876543210')",[existing,f.tenant]);
  const {result,context,lease,source}=await retainedCopy(f);
  assert.equal(result.status,'draft');
  assert.equal(result.customerId,existing);
  assert.equal(result.customerResolution,'reused');
  assert.equal(await scalar('SELECT name AS result FROM customers WHERE id=$1',[existing]),'Existing family member');
  const retained=await scalar('SELECT public.read_shopify_retained_order($1,$2,$3,$4,$5) AS result',
    [f.tenant,f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  assert.equal(retained.details.customer.name,'Fictional Buyer','source buyer identity remains visible separately');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_payments WHERE tenant_id=$1',[f.tenant]),0);
  const retry=await createShopifyDraftStore(adapter,{retainBusinessDetails:true}).recoverCommittedSnapshot(source.snapshot,context,lease,f.signal,f.env);
  assert.equal(retry.orderId,result.orderId);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM customers WHERE tenant_id=$1',[f.tenant]),1);
}));

test('upgrading an existing pilot refreshes the same order into retained details without duplication',isolated(async f=>{
  const old=await copy(f),original=old.sources[0].orderId;
  Object.assign(f.env,{SHOPIFY_UNIFIED_ORDERS_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true'});
  const rpcDb={...adapter,rpc(name,args){return {async abortSignal(signal){const result=await adapter.rpc(name,args).abortSignal(signal);
    assert.equal(result.error,null,result.error?.message);if(result.data instanceof Date)result.data=result.data.toISOString();return result;}};}};
  const service=createShopifyUnifiedService(rpcDb,f.transport),command={action:'enable',consent:true,requestKey:randomUUID()};
  await service.execute(f.actor,command,f.signal,f.env);await service.execute(f.actor,command,f.signal,f.env);
  assert.equal((await service.view(f.actor,f.signal,f.env)).connection.pending,1);
  await service.execute(f.actor,{action:'process',requestKey:randomUUID()},f.signal,f.env);
  assert.equal((await service.view(f.actor,f.signal,f.env)).connection.pending,0);
  const retained=await scalar('SELECT read_shopify_retained_order($1,$2,$3,$4,$5) AS result',
    [f.tenant,f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,original]);
  assert.equal(retained.orderId,original);assert.equal(retained.details.sourceNumber,f.source.order.name);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
}));

test('OAuth connection drives manual preview and import from its own shop despite a different global shop setting',isolated(async f=>{
  await f.run({action:'connect',cutoff:new Date(Date.now()-3600000).toISOString()});
  Object.assign(f.env,{SHOPIFY_UNIFIED_ORDERS_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true',
    SHOPIFY_OAUTH_ENABLED:'true',SHOPIFY_SCHEDULED_WORKER_ENABLED:'false',SHOPIFY_CREDENTIAL_KEY_ID:'fictional',
    SHOPIFY_CREDENTIAL_ENCRYPTION_KEYS_JSON:JSON.stringify({fictional:Buffer.alloc(32,17).toString('base64')})});
  const domain=f.env.SHOPIFY_SHOP_DOMAIN,approval=beginShopifyApproval(f.actor,domain,f.env);
  const storage=(action,input)=>scalar('SELECT shopify_oauth_storage($1,$2,$3,$4::jsonb) AS result',[f.tenant,f.actor.userId,action,JSON.stringify(input)]);
  await storage('begin',approval.attempt);
  const claim=await storage('claim',{stateHash:approval.attempt.stateHash});
  const token={accessToken:'oauth-only-token',refreshToken:'fictional-refresh',accessExpiresAt:new Date(Date.now()+3600000).toISOString(),
    refreshExpiresAt:new Date(Date.now()+86400000).toISOString(),scopes:['read_orders','read_products','read_customers']};
  await storage('complete',{stateHash:approval.attempt.stateHash,claimToken:claim.claimToken,shopGid:'gid://shopify/Shop/101',
    packet:sealShopifyCredential(token,approval.attempt,f.env),accessExpiresAt:token.accessExpiresAt,refreshExpiresAt:token.refreshExpiresAt});
  f.env.SHOPIFY_SHOP_DOMAIN='wrong-global.myshopify.com';
  const shop={id:'gid://shopify/Shop/101',myshopifyDomain:domain};
  const transport=async(url,init)=>{
    assert.equal(new URL(url).hostname,domain);assert.ok(!url.endsWith('/admin/oauth/access_token'),'must use saved OAuth credential');
    assert.equal(init.headers['X-Shopify-Access-Token'],'oauth-only-token');
    const query=JSON.parse(init.body).query;let data;
    if(query.includes('OSPlusApproval')||query.includes('OSPlusImportScope')||query.includes('OSPlusPilotSetup'))
      data={shop,currentAppInstallation:{accessScopes:token.scopes.map(handle=>({handle}))},orders:{nodes:[]}};
    else if(query.includes('OSPlusImportOrders'))data={shop,orders:{nodes:[{id:f.source.order.id,name:f.source.order.name,
      createdAt:f.source.order.createdAt,updatedAt:f.source.order.updatedAt,cancelledAt:null,displayFinancialStatus:'PAID',
      currentTotalPriceSet:{shopMoney:{amount:'118.00',currencyCode:'INR'}}}],pageInfo:{hasNextPage:false,endCursor:null}}};
    if(data)return Response.json({data},{headers:{'X-Shopify-API-Version':'2026-10'}});
    return f.transport(url,init);
  };
  const rpcDb={...adapter,rpc(name,args){return {async abortSignal(signal){const result=await adapter.rpc(name,args).abortSignal(signal);
    if(result.data instanceof Date)result.data=result.data.toISOString();return result;}};}};
  const service=createShopifyUnifiedService(rpcDb,transport),run=command=>service.execute(f.actor,{requestKey:randomUUID(),manualCleanupAcknowledged:true,...command},f.signal,f.env);
  const initial=await service.view(f.actor,f.signal,f.env);assert.equal(initial.connection.status,'pending');
  await run({action:'enable',consent:true});
  const range={from:new Date(Date.parse(f.source.order.createdAt)+330*60000).toISOString().slice(0,10),
    through:new Date(Date.now()+330*60000).toISOString().slice(0,10)};
  const preview=await service.execute(f.actor,{action:'preview',requestKey:randomUUID(),...range},f.signal,f.env);
  assert.equal(preview.preview.rows[0].status,'new');
  await run({action:'import',previewId:preview.preview.previewId});
  await run({action:'process'});
  const repeat=await service.execute(f.actor,{action:'preview',requestKey:randomUUID(),...range},f.signal,f.env);
  assert.equal(repeat.preview.rows[0].status,'already_imported');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'draft');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_payments WHERE tenant_id=$1',[f.tenant]),0);
  assert.equal((await service.view(f.actor,f.signal,f.env)).connection.automatic,false);
  const orderId=await scalar('SELECT id AS result FROM orders WHERE tenant_id=$1',[f.tenant]);
  const manager={...f.actor,userId:'fictional-manager',membershipUserId:'fictional-manager',role:'manager'};
  const drafts=createShopifyManagerService(rpcDb,transport),draft=await drafts.view(manager,orderId,f.signal,f.env);
  assert.ok(draft);
  const choices={customerId:draft.customerId,deliveryType:'store_pickup',promisedDeliveryDate:null,note:'Fictional OAuth manager setup',
    lines:[{lineGid:f.source.lines[0].id,itemTypeId:f.itemType,workflowId:null,standardSizeId:null,expectedCompletionDate:null}]};
  const partial=await drafts.save(manager,{orderId,sourceRevisionId:draft.sourceRevisionId,expectedVersion:0,requestKey:randomUUID(),choices},f.signal,f.env);
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'draft');
  choices.lines[0].workflowId=f.workflow;
  const ready=await drafts.save(manager,{orderId,sourceRevisionId:draft.sourceRevisionId,expectedVersion:partial.version,
    requestKey:randomUUID(),choices},f.signal,f.env);
  const complete={orderId,connectionId:draft.connectionId,setupId:ready.setupId,requestKey:randomUUID()};
  const completed=await drafts.complete(manager,complete,f.signal,f.env);
  assert.equal(completed.status,'setup_complete');
  assert.deepEqual(await drafts.complete(manager,complete,f.signal,f.env),completed);
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'confirmed');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM item_workflow_instances WHERE tenant_id=$1',[f.tenant]),1);
}));

test('date-range commit rejects stale, foreign and expired previews and skips incoming reference clashes',isolated(async f=>{
  const state=await authorize(f),c=state.connection.id;
  const args=[f.tenant,c,f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID];
  await scalar('SELECT enable_shopify_unified_imports($1,$2,$3,$4,$5,$6,$7,true) AS result',[...args,randomUUID(),state.connection.revision]);
  const row={orderGid:f.source.order.id,reference:'#SAME',createdAt:f.source.order.createdAt,updatedAt:f.source.order.updatedAt,amount:'118.00',currency:'INR',financialStatus:'PAID',cancelledAt:null,status:'new',orderIds:[],incomingReferenceConflict:false};
  const save=rows=>scalar('SELECT save_shopify_import_preview($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) AS result',
    [...args,randomUUID(),new Date(Date.now()-86400000).toISOString(),new Date().toISOString(),JSON.stringify(rows)]);
  const preview=await save([row]),commit=(id=preview.previewId,actor=f.actor.userId)=>scalar('SELECT commit_shopify_import_preview($1,$2,$3,$4,$5,$6,$7) AS result',
    [f.tenant,c,actor,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,id,randomUUID()]);
  async function denied(fn,pattern){await db.exec('SAVEPOINT negative_preview');await assert.rejects(fn,pattern);await db.exec('ROLLBACK TO SAVEPOINT negative_preview');}
  await denied(()=>commit(randomUUID()),/SHOPIFY_STALE_REVISION/);
  await denied(()=>commit(preview.previewId,'fictional-manager'),/SHOPIFY_ACCESS_DENIED/);
  await db.exec('SAVEPOINT changed_connection');
  await db.query('UPDATE shopify_connections SET processing_enabled=false WHERE id=$1',[c]);
  await assert.rejects(()=>commit(),/SHOPIFY_STALE_REVISION/);await db.exec('ROLLBACK TO SAVEPOINT changed_connection');
  const expired=randomUUID();
  await db.query(`INSERT INTO shopify_import_previews(id,tenant_id,connection_id,actor_id,request_key,connection_revision,window_start,window_end,rows,expires_at)
    SELECT $1,tenant_id,connection_id,actor_id,$2,connection_revision,window_start,window_end,rows,clock_timestamp()-interval '1 second'
    FROM shopify_import_previews WHERE id=$3`,[expired,randomUUID(),preview.previewId]);
  await denied(()=>commit(expired),/SHOPIFY_STALE_REVISION/);
  const clash=await save([row,{...row,orderGid:'gid://shopify/Order/999',reference:' same '}]);
  assert.deepEqual((await commit(clash.previewId)).rows.map(x=>x.status),['conflict','conflict']);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_sync_jobs WHERE tenant_id=$1',[f.tenant]),0);
  for(const role of ['anon','authenticated'])assert.equal(await scalar("SELECT has_function_privilege($1,'public.commit_shopify_import_preview(uuid,uuid,text,text,text,uuid,uuid)','EXECUTE') AS result",[role]),false);
}));

test('unified webhook setup upgrades only its pilot subscriptions and automatically imports two orders once',isolated(async f=>{
  await authorize(f);Object.assign(f.env,{SHOPIFY_UNIFIED_ORDERS_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true',SHOPIFY_INTAKE_ENABLED:'true'});
  const tasks=[],subscriptions=['ORDERS_CREATE','ORDERS_UPDATED','ORDERS_CANCELLED'].map((topic,i)=>({id:`gid://shopify/WebhookSubscription/${i+1}`,topic,
    uri:'https://example.invalid/api/integrations/shopify/orders-webhook',filter:`id:${f.source.order.id.split('/').at(-1)}`,format:'JSON',
    includeFields:['id','admin_graphql_api_id','updated_at'],apiVersion:{handle:'2026-10'}}));let mutations=0;
  const rpcDb={...adapter,rpc(name,args){return {async abortSignal(signal){const result=await adapter.rpc(name,args).abortSignal(signal);
    if(result.data instanceof Date)result.data=result.data.toISOString();return result;}};}};
  const transport=async(url,init)=>{
    if(url.endsWith('/graphql.json')){const input=JSON.parse(init.body);let data;
      if(input.query.includes('OSPlusUnifiedWebhooks'))data={shop:{id:'gid://shopify/Shop/101',myshopifyDomain:f.env.SHOPIFY_SHOP_DOMAIN},
        currentAppInstallation:{app:{apiKey:f.env.SHOPIFY_CLIENT_ID,webhookApiVersion:'2026-10'}},webhookSubscriptions:{nodes:subscriptions,pageInfo:{hasNextPage:false,endCursor:null}}};
      if(input.query.includes('OSPlusUpdateTestWebhook')){const row=subscriptions.find(s=>s.id===input.variables.id);assert.ok(row);mutations++;Object.assign(row,input.variables.subscription);
        data={webhookSubscriptionUpdate:{webhookSubscription:row,userErrors:[]}};}
      if(data)return Response.json({data},{headers:{'X-Shopify-API-Version':'2026-10'}});
    }return f.transport(url,init);
  };
  const service=createShopifyUnifiedService(rpcDb,transport),run=command=>service.execute(f.actor,{requestKey:randomUUID(),...command},f.signal,f.env);
  await run({action:'enable',consent:true});
  await run({action:'automatic',enabled:true});assert.equal(mutations,3);assert.ok(subscriptions.every(s=>s.filter===''));
  await run({action:'automatic',enabled:true});assert.equal(mutations,3,'repeated setup does not mutate matching subscriptions');
  const ingress=createShopifyApplicationIngress(rpcDb,{schedule:task=>tasks.push(task),run:(db,id,signal,env)=>runShopifyUnifiedWorker(db,id,signal,env,transport)});
  const request=(delivery=randomUUID())=>{const body=JSON.stringify({admin_graphql_api_id:f.source.order.id});return new Request('https://example.invalid/api/integrations/shopify/orders-webhook',{method:'POST',body,headers:{
    'content-type':'application/json','x-shopify-shop-domain':f.env.SHOPIFY_SHOP_DOMAIN,'x-shopify-topic':'orders/create','x-shopify-api-version':'2026-10',
    'x-shopify-webhook-id':delivery,'x-shopify-hmac-sha256':createHmac('sha256',f.env.SHOPIFY_CLIENT_SECRET).update(body).digest('base64')}});};
  const delivery=randomUUID();assert.equal((await ingress.orders(request(delivery),f.env)).status,200);await tasks.shift()();
  assert.equal((await ingress.orders(request(delivery),f.env)).status,200);await tasks.shift()();
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  f.source.order.id='gid://shopify/Order/9007199254740994';f.source.order.legacyResourceId='9007199254740994';f.source.order.name='#SECOND';
  assert.equal((await ingress.orders(request(),f.env)).status,200);await tasks.shift()();
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),2,
    JSON.stringify((await db.query('SELECT order_gid,last_error_code,attempts,requested_generation,completed_generation FROM shopify_sync_jobs WHERE tenant_id=$1',[f.tenant])).rows));
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_commercial_details WHERE tenant_id=$1',[f.tenant]),2);
  await run({action:'automatic',enabled:false});f.source.order.id='gid://shopify/Order/9007199254740995';
  assert.equal((await ingress.orders(request(),f.env)).status,200);assert.equal(tasks.length,0);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),2);
  for(const table of ['order_items','order_payments','shopify_variant_mappings'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0);
}));

test('actual manager service saves, checks fresh Shopify, completes and recovers without another source read',isolated(async f=>{
  const {connection,result}=await retainedCopy(f);f.env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED='true';
  const actor={...f.actor,userId:'fictional-manager',membershipUserId:'fictional-manager',role:'manager'};
  const service=createShopifyManagerService(adapter,f.transport);
  const state=await service.view(actor,result.orderId,f.signal,f.env);
  const choices={customerId:result.customerId,deliveryType:'store_pickup',promisedDeliveryDate:null,note:'Team choices',
    lines:[{lineGid:f.source.lines[0].id,itemTypeId:f.itemType,workflowId:f.workflow,standardSizeId:null,expectedCompletionDate:null}]};
  const command={orderId:result.orderId,sourceRevisionId:state.sourceRevisionId,expectedVersion:0,requestKey:randomUUID(),choices};
  const saved=await service.save(actor,command,f.signal,f.env);assert.deepEqual(await service.save(actor,command,f.signal,f.env),saved);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_items WHERE tenant_id=$1',[f.tenant]),0);
  const complete={orderId:result.orderId,connectionId:connection,setupId:saved.setupId,requestKey:randomUUID()};
  const original=f.source.order.updatedAt;f.source.order.updatedAt=new Date().toISOString();
  await assert.rejects(()=>service.complete(actor,complete,f.signal,f.env),/SOURCE_CHANGED/);f.source.order.updatedAt=original;
  const first=await service.complete(actor,complete,f.signal,f.env);assert.equal(first.status,'setup_complete');
  const calls=f.calls.length;assert.deepEqual(await service.complete(actor,complete,f.signal,f.env),first);assert.equal(f.calls.length,calls);
  assert.equal(await service.view(actor,result.orderId,f.signal,f.env),null);
  for(const table of ['orders','order_items','item_workflow_instances','shopify_releases'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),1);
  for(const table of ['order_payments','shopify_variant_mappings'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0);
  await assert.rejects(()=>service.complete({...actor,role:'viewer'},complete,f.signal,f.env),/ACCESS_DENIED/);
  await assert.rejects(()=>service.complete(actor,{...complete,p_verified_at:new Date().toISOString()},f.signal,f.env),/unrecognized_keys/);
}));

test('manager dropdown search pages beyond initial options with literal search and current membership checks',isolated(async f=>{
  const {result}=await retainedCopy(f);f.env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED='true';
  await db.query(`INSERT INTO customers(tenant_id,name) SELECT $1,'Search fixture '||lpad(i::text,3,'0') FROM generate_series(1,105) i`,[f.tenant]);
  const service=createShopifyManagerService(adapter,f.transport),actor={...f.actor,userId:'fictional-manager',membershipUserId:'fictional-manager',role:'manager'};
  const find=(search,offset=0)=>service.search(actor,{orderId:result.orderId,kind:'customers',search,offset},f.signal,f.env);
  const a=await find('Search fixture'),b=await find('Search fixture',50),c=await find('Search fixture',100);
  assert.equal(a.rows.length,50);assert.equal(b.rows.length,50);assert.equal(c.rows.length,5);assert.equal(c.hasMore,false);
  assert.equal(new Set([...a.rows,...b.rows,...c.rows].map(x=>x.id)).size,105);assert.equal((await find('%')).rows.length,0);
  await db.query("UPDATE tenant_users SET status='disabled' WHERE tenant_id=$1 AND clerk_user_id='fictional-manager'",[f.tenant]);
  await assert.rejects(()=>find('Search fixture'),/ACCESS_DENIED/);
}));

test('manager partial draft save is exact-retry safe, version fenced and has no mapping/production/payment side effects',isolated(async f=>{
  const {connection,result}=await retainedCopy(f);
  const revision=await scalar('SELECT id AS result FROM shopify_source_revisions WHERE tenant_id=$1',[f.tenant]);
  const choices={customerId:null,deliveryType:null,promisedDeliveryDate:null,note:'Finish setup later',
    lines:[{lineGid:f.source.lines[0].id,itemTypeId:null,workflowId:null,standardSizeId:null,expectedCompletionDate:null}]};
  const request=randomUUID();
  const save=(patch={})=>scalar('SELECT public.save_shopify_manager_draft_setup($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) AS result',
    [patch.tenant??f.tenant,connection,patch.domain??f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,patch.actor??'fictional-manager',
      patch.order??result.orderId,patch.revision??revision,patch.version??0,patch.request??request,JSON.stringify(patch.choices??choices)]);
  const denied=async(fn,pattern)=>{await db.exec('SAVEPOINT setup_denied');await assert.rejects(fn,pattern);await db.exec('ROLLBACK TO SAVEPOINT setup_denied');};
  await denied(()=>save({actor:'foreign-actor'}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>save({tenant:randomUUID()}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>save({order:randomUUID()}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>save({domain:'foreign.myshopify.com'}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>save({revision:randomUUID()}),/SHOPIFY_STALE_REVISION/);
  await denied(()=>save({choices:{...choices,total:1}}),/SHOPIFY_COMMAND_INVALID/);
  await denied(()=>save({choices:{...choices,customerId:randomUUID()}}),/SHOPIFY_CUSTOMER_INVALID/);
  await denied(()=>save({choices:{...choices,lines:[{...choices.lines[0],itemTypeId:randomUUID()}]}}),/SHOPIFY_CONFIGURATION_INVALID/);
  await denied(()=>save({choices:{...choices,lines:[{...choices.lines[0],quantity:4}]}}),/SHOPIFY_COMMAND_INVALID/);
  await denied(()=>save({choices:{...choices,lines:[{...choices.lines[0],lineGid:'gid://shopify/LineItem/999'}]}}),/SHOPIFY_COMMAND_INVALID/);
  await denied(()=>save({choices:{...choices,promisedDeliveryDate:'2026-02-30'}}),/date\/time field value out of range/);
  await db.exec('SET LOCAL ROLE service_role');
  const first=await save();assert.equal(first.version,1);assert.deepEqual(await save(),first);
  await db.exec('RESET ROLE');
  await denied(()=>save({choices:{...choices,note:'Changed retry'}}),/SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await denied(()=>save({actor:f.actor.userId}),/SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await denied(()=>save({request:randomUUID()}),/SHOPIFY_STALE_REVISION/);
  const full={...choices,customerId:result.customerId,deliveryType:'store_pickup',
    lines:[{...choices.lines[0],itemTypeId:f.itemType,workflowId:f.workflow}]};
  await db.exec('SAVEPOINT inactive_config');
  await db.query('UPDATE workflows SET is_active=false WHERE tenant_id=$1 AND id=$2',[f.tenant,f.workflow]);
  await assert.rejects(()=>save({choices:full,request:randomUUID(),version:1}),/SHOPIFY_CONFIGURATION_INVALID/);
  await db.exec('ROLLBACK TO SAVEPOINT inactive_config');
  const second=await save({choices:full,request:randomUUID(),version:1});assert.equal(second.version,2);
  assert.deepEqual(await save(),first,'original receipt remains exact even after a later edit');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_manager_draft_setups WHERE tenant_id=$1',[f.tenant]),2);
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1 AND id=$2',[f.tenant,result.orderId]),'draft');
  for(const table of ['shopify_variant_mappings','shopify_releases','order_items','item_stage_instances','order_payments'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0,table);
  for(const role of ['anon','authenticated'])assert.equal(await scalar("SELECT has_function_privilege($1,'public.save_shopify_manager_draft_setup(uuid,uuid,text,text,text,uuid,uuid,bigint,uuid,jsonb)','EXECUTE') AS result",[role]),false);
  assert.equal(await scalar("SELECT has_table_privilege('service_role','shopify_manager_draft_setups','INSERT') AS result"),false);
}));

test('manager completes per-order setup exactly once without mappings, with fresh-source and live-configuration checks',isolated(async f=>{
  const {connection,context,result}=await retainedCopy(f);
  const revision=await scalar('SELECT id AS result FROM shopify_source_revisions WHERE tenant_id=$1',[f.tenant]);
  const choices={customerId:result.customerId,deliveryType:'store_pickup',promisedDeliveryDate:null,note:'Manager setup',
    lines:[{lineGid:f.source.lines[0].id,itemTypeId:f.itemType,workflowId:f.workflow,standardSizeId:null,expectedCompletionDate:null}]};
  const setup=await scalar('SELECT public.save_shopify_manager_draft_setup($1,$2,$3,$4,$5,$6,$7,0,$8,$9::jsonb) AS result',
    [f.tenant,connection,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,'fictional-manager',result.orderId,revision,randomUUID(),JSON.stringify(choices)]);
  const setupView=await scalar('SELECT read_shopify_manager_draft_setup($1,$2,$3,$4,$5) AS result',
    [f.tenant,'fictional-manager',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  assert.equal(setupView.current,true);assert.deepEqual(setupView.choices,choices);
  assert.equal(setupView.itemTypes[0].id,f.itemType);assert.equal(setupView.workflows[0].id,f.workflow);
  assert.equal(JSON.stringify(setupView).includes('sealed_source'),false);
  const request=randomUUID();
  const complete=(patch={})=>scalar('SELECT public.complete_shopify_manager_setup($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) AS result',
    [patch.tenant??f.tenant,connection,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,patch.actor??'fictional-manager',
      result.orderId,patch.setup??setup.setupId,patch.request??request,patch.connectionRevision??context.revision,
      patch.sourceUpdatedAt??f.source.order.updatedAt,patch.verifiedAt??new Date().toISOString()]);
  const denied=async(fn,pattern)=>{await db.exec('SAVEPOINT completion_denied');await assert.rejects(fn,pattern);await db.exec('ROLLBACK TO SAVEPOINT completion_denied');};
  await denied(()=>complete({actor:'foreign-actor'}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>complete({tenant:randomUUID()}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>complete({setup:randomUUID()}),/SHOPIFY_STALE_REVISION/);
  await denied(()=>complete({connectionRevision:context.revision+1}),/SHOPIFY_STALE_REVISION/);
  await denied(()=>complete({sourceUpdatedAt:new Date().toISOString()}),/SHOPIFY_STALE_REVISION/);
  await denied(()=>complete({verifiedAt:new Date(Date.now()-180000).toISOString()}),/SHOPIFY_STALE_REVISION/);
  await denied(()=>complete({verifiedAt:new Date(Date.now()+60000).toISOString()}),/SHOPIFY_STALE_REVISION/);
  await db.exec('SAVEPOINT configuration_changed');
  await db.query('UPDATE workflow_stages SET is_active=false WHERE tenant_id=$1 AND workflow_id=$2',[f.tenant,f.workflow]);
  await assert.rejects(()=>complete(),/SHOPIFY_CONFIGURATION_INVALID/);
  await db.exec('ROLLBACK TO SAVEPOINT configuration_changed');
  for(const table of ['order_items','item_workflow_instances','item_stage_instances','shopify_release_capabilities','shopify_releases'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0,table);
  const finalStatus=randomUUID(),pickupStage=randomUUID();
  await db.query("INSERT INTO customer_statuses(id,tenant_id,name,is_final_status) VALUES($1,$2,'Fictional picked up',true)",[finalStatus,f.tenant]);
  await db.query("INSERT INTO stage_master(id,tenant_id,name,default_customer_status_id) VALUES($1,$2,'Fictional pickup',$3)",[pickupStage,f.tenant,finalStatus]);
  await db.query('INSERT INTO workflow_stages(tenant_id,workflow_id,stage_master_id,sequence_number) VALUES($1,$2,$3,2)',[f.tenant,f.workflow,pickupStage]);
  await db.exec('SET LOCAL ROLE service_role');
  const first=await complete();assert.equal(first.status,'setup_complete');assert.equal(first.itemCount,1);
  assert.deepEqual(await complete(),first);
  await db.exec('RESET ROLE');
  await denied(()=>complete({request:randomUUID()}),/SHOPIFY_DRAFT_LOCKED/);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM operational_orders WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM local_operational_orders WHERE tenant_id=$1',[f.tenant]),0);
  assert.equal(await scalar('SELECT delivery_type AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'store_pickup');
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'confirmed');
  assert.equal(await scalar('SELECT held AS result FROM shopify_operational_state WHERE tenant_id=$1',[f.tenant]),false);
  for(const table of ['order_items','item_workflow_instances','shopify_releases'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),1,table);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM item_stage_instances WHERE tenant_id=$1',[f.tenant]),2);
  for(const table of ['shopify_variant_mappings','shopify_draft_reviews','order_payments','shopify_release_capabilities'])
    assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0,table);
  assert.equal(await scalar('SELECT mapping_id IS NULL AND manager_setup_id=$2 AS result FROM shopify_order_item_links WHERE tenant_id=$1',[f.tenant,setup.setupId]),true);
  // Run the existing production commands through both stages and pickup. No
  // replacement workflow implementation, fake direct status update or messages.
  const worker=randomUUID(),group=randomUUID();
  await db.query("INSERT INTO workgroups(id,tenant_id,name) VALUES($1,$2,'Fictional team')",[group,f.tenant]);
  await db.query("INSERT INTO workers(id,tenant_id,name) VALUES($1,$2,'Fictional worker')",[worker,f.tenant]);
  await db.query('INSERT INTO worker_workgroups(tenant_id,worker_id,workgroup_id) VALUES($1,$2,$3)',[f.tenant,worker,group]);
  await db.query('INSERT INTO stage_workgroups(tenant_id,stage_master_id,workgroup_id) SELECT $1,id,$2 FROM stage_master WHERE tenant_id=$1',[f.tenant,group]);
  await db.query("UPDATE stage_master SET effort_tracking_mode='units' WHERE tenant_id=$1",[f.tenant]);
  const stages=(await db.query('SELECT id,status FROM item_stage_instances WHERE tenant_id=$1 ORDER BY sequence_number',[f.tenant])).rows;
  assert.deepEqual(stages.map(s=>s.status),['ready_to_start','not_started']);
  const assignments=JSON.stringify([{worker_id:worker,workgroup_id:group,credited_units:1,credited_minutes:0}]);
  for(const stage of stages){
    await db.exec('SET LOCAL ROLE service_role');
    await scalar('SELECT start_item_stage_with_contributions($1,$2,$3::jsonb,null,$4,$5) AS result',[f.tenant,stage.id,assignments,'fictional-manager',randomUUID()]);
    const version=await scalar('SELECT contribution_revision AS result FROM item_stage_instances WHERE tenant_id=$1 AND id=$2',[f.tenant,stage.id]);
    await scalar('SELECT complete_item_stage_with_contributions($1,$2,$3::jsonb,null,null,$4,$5,$6) AS result',
      [f.tenant,stage.id,assignments,'fictional-manager',version,randomUUID()]);
    await db.exec('RESET ROLE');
  }
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'delivered');
  assert.equal(await scalar('SELECT item_status AS result FROM order_items WHERE tenant_id=$1',[f.tenant]),'delivered');
  assert.equal(await scalar('SELECT status AS result FROM item_workflow_instances WHERE tenant_id=$1',[f.tenant]),'completed');
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_payments WHERE tenant_id=$1',[f.tenant]),0);
  const sourcePayment=await scalar('SELECT read_shopify_retained_payment($1,$2,$3,$4,$5) AS result',
    [f.tenant,'fictional-manager',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  assert.equal(sourcePayment.payment.status,'PAID');assert.equal(sourcePayment.payment.amounts.received,'118.00');
  assert.equal(sourcePayment.payment.productionHeld,false);assert.equal(JSON.stringify(sourcePayment).includes('customer'),false);
  assert.deepEqual(await complete(),first,'retry after delivery cannot recreate workflow');
  const originalReference=f.source.order.name;
  f.source.order.updatedAt=new Date(Date.now()-1000).toISOString();
  f.source.order.cancelledAt=f.source.order.updatedAt;f.source.order.name='#CHANGED-SOURCE-REFERENCE';
  await f.run({action:'queue_order',connectionId:connection});
  const binding={tenantId:f.tenant,connectionId:connection,appRef:f.env.SHOPIFY_CLIENT_ID,environment:'production'};
  const freshContext=await readShopifyWorkerContext(adapter,binding,f.signal),[lease]=await createShopifyQueueStore(adapter).claim(binding,1,f.signal);
  const token=await createShopifyPilotCredentialReader(f.transport)(freshContext,f.signal,f.env);
  const updated=await createShopifyOrderHydrator(f.transport)(freshContext,lease,token.accessToken,f.signal,f.env);
  assert.equal(updated.status,'complete');
  const observation=await createShopifyDraftStore(adapter,{retainBusinessDetails:true}).importSnapshot(updated.snapshot,freshContext,lease,f.signal,f.env);
  assert.equal(observation.status,'observed');assert.equal(observation.orderId,result.orderId);
  assert.equal(await scalar('SELECT reference_order_id AS result FROM orders WHERE tenant_id=$1',[f.tenant]),originalReference);
  assert.equal(await scalar('SELECT order_status AS result FROM orders WHERE tenant_id=$1',[f.tenant]),'delivered','source cancellation cannot overwrite completed team work');
  assert.equal(await scalar('SELECT held AS result FROM shopify_operational_state WHERE tenant_id=$1',[f.tenant]),true);
  const changedPayment=await scalar('SELECT read_shopify_retained_payment($1,$2,$3,$4,$5) AS result',
    [f.tenant,'fictional-manager',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  assert.equal(changedPayment.payment.productionHeld,true);
  const business=await scalar('SELECT read_shopify_retained_business_order($1,$2,$3,$4,$5) AS result',
    [f.tenant,'fictional-manager',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  assert.equal(business.details.sourceNumber,'#CHANGED-SOURCE-REFERENCE');assert.equal(business.details.payment.productionHeld,true);
  assert.equal(business.details.lines[0].title,f.source.lines[0].title);
  assert.equal(await scalar('SELECT read_shopify_retained_business_order($1,$2,$3,$4,$5) AS result',
    [f.tenant,'foreign-actor',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]),null);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM orders WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_items WHERE tenant_id=$1',[f.tenant]),1);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM order_payments WHERE tenant_id=$1',[f.tenant]),0);
}));

test('opt-in retained import atomically stores normalized business details; raw redaction leaves them readable',isolated(async f=>{
  const state=await authorize(f),connection=state.connection.id;
  await db.exec('SAVEPOINT denied');
  await assert.rejects(()=>scalar('SELECT public.approve_shopify_business_retention($1,$2,$3,true) AS result',[f.tenant,connection,'fictional-manager']),/SHOPIFY_ACCESS_DENIED/);
  await db.exec('ROLLBACK TO SAVEPOINT denied');
  await scalar('SELECT public.approve_shopify_business_retention($1,$2,$3,true) AS result',[f.tenant,connection,f.actor.userId]);
  await f.run({action:'queue_order',connectionId:connection});
  const binding={tenantId:f.tenant,connectionId:connection,appRef:f.env.SHOPIFY_CLIENT_ID,environment:'production'};
  const context=await readShopifyWorkerContext(adapter,binding,f.signal);
  const [lease]=await createShopifyQueueStore(adapter).claim(binding,1,f.signal);
  const token=await createShopifyPilotCredentialReader(f.transport)(context,f.signal,f.env);
  const source=await createShopifyOrderHydrator(f.transport)(context,lease,token.accessToken,f.signal,f.env);
  assert.equal(source.status,'complete');
  let retainedPayload;
  const retainedDb={rpc(name,args){return {async abortSignal(signal){const r=await adapter.rpc(name,args).abortSignal(signal);
    retainedPayload=args.p_input;
    assert.equal(r.error,null,r.error?.message);return r;}};}};
  const store=createShopifyDraftStore(retainedDb,{retainBusinessDetails:true});
  const result=await store.importSnapshot(source.snapshot,context,lease,f.signal,f.env);
  assert.equal(await scalar('SELECT reference_order_id AS result FROM orders WHERE tenant_id=$1 AND id=$2',[f.tenant,result.orderId]),source.snapshot.order.name);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_reference_capabilities'),0,'private capability is removed before commit');
  await db.exec('SAVEPOINT manual_duplicate');
  await assert.rejects(()=>db.query(`INSERT INTO orders(tenant_id,customer_id,order_number,tracking_token,reference_order_id)
    VALUES($1,$2,'MANUAL-DUPLICATE','manual-duplicate',$3)`,[f.tenant,result.customerId,source.snapshot.order.name]),/SHOPIFY_REFERENCE_CONFLICT/);
  await db.exec('ROLLBACK TO SAVEPOINT manual_duplicate');
  await db.exec('SAVEPOINT direct_reference');
  await assert.rejects(()=>db.query("UPDATE orders SET reference_order_id='unapproved' WHERE tenant_id=$1 AND id=$2",[f.tenant,result.orderId]),/SHOPIFY_DRAFT_LOCKED/);
  await db.exec('ROLLBACK TO SAVEPOINT direct_reference');
  const read=(actor=f.actor.userId)=>scalar('SELECT public.read_shopify_retained_order($1,$2,$3,$4,$5) AS result',
    [f.tenant,actor,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  const first=await read();
  assert.equal(readShopifyCommercialDetails(first,{tenantId:f.tenant,orderId:result.orderId}).payment.amounts.received,'118.00');
  assert.deepEqual(await read('fictional-manager'),first);assert.equal(await read('foreign-owner'),null);
  await db.exec('SAVEPOINT unified_list');
  const manual=randomUUID();
  await db.query(`INSERT INTO orders(id,tenant_id,customer_id,order_number,tracking_token,reference_order_id,created_at)
    VALUES($1,$2,$3,'MANUAL-NEWER','manual-newer','LOCAL-ONLY',now()+interval '1 minute')`,[manual,f.tenant,result.customerId]);
  const list=(patch={})=>scalar(`SELECT coalesce(jsonb_agg(o.id),'[]'::jsonb) AS result FROM public.list_shopify_commercial_orders(
    $1,$2,$3,$4,p_search=>$5,p_status=>$6,p_payment=>$7,p_view=>$8,p_limit=>$9,p_offset=>$10) o`,
    [f.tenant,patch.actor??f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,patch.search??null,patch.status??null,patch.payment??null,patch.view??'all',patch.limit??50,patch.offset??0]);
  assert.deepEqual(await list(),[manual,result.orderId],'one shared ordered result, not two independently capped lists');
  assert.deepEqual(await list({limit:1}),[manual]);assert.deepEqual(await list({limit:1,offset:1}),[result.orderId]);
  assert.deepEqual(await list({status:'draft',limit:1}),[result.orderId],'filter before limit');
  assert.deepEqual(await list({search:source.snapshot.order.name}),[result.orderId]);assert.deepEqual(await list({search:'%'}),[]);
  assert.deepEqual(await list({payment:'paid'}),[result.orderId],'Shopify payment facts, not the inert local payment_status field');
  assert.deepEqual(await list({view:'unpaid'}),[manual],'local collection view excludes Shopify-managed balances');
  assert.deepEqual(await list({actor:'fictional-manager'}),[manual,result.orderId]);assert.deepEqual(await list({actor:'foreign-owner'}),[]);
  const summary=await scalar('SELECT public.read_shopify_commercial_summaries($1,$2,$3,$4,$5::uuid[]) AS result',
    [f.tenant,f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,[result.orderId]]);
  assert.equal(summary[0].total,'118.00');assert.equal(summary[0].itemCount,1);
  assert.equal(JSON.stringify(summary).includes('shippingAddress'),false);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM local_operational_orders WHERE tenant_id=$1',[f.tenant]),1);
  await db.exec('ROLLBACK TO SAVEPOINT unified_list');
  assert.equal(await scalar('SELECT extract(epoch from d.raw_expires_at-r.observed_at)::int AS result FROM shopify_commercial_details d JOIN shopify_source_revisions r ON r.id=d.revision_id WHERE d.tenant_id=$1',[f.tenant]),86400);
  assert.deepEqual(await store.recoverCommittedSnapshot(source.snapshot,context,lease,f.signal,f.env),result);
  assert.equal(await scalar('SELECT count(*)::int AS result FROM shopify_commercial_details WHERE tenant_id=$1',[f.tenant]),1);
  // Changed business facts cannot be substituted into an exact committed
  // receipt, and recovery is not an alternate write path.
  await db.exec('SAVEPOINT altered_receipt');
  const altered=structuredClone(retainedPayload);altered.commercialDetails.note='Different retry facts';
  await assert.rejects(()=>scalar('SELECT public.import_shopify_retained_draft($1::jsonb,true) AS result',[JSON.stringify(altered)]),/SHOPIFY_IDEMPOTENCY_CONFLICT/);
  await db.exec('ROLLBACK TO SAVEPOINT altered_receipt');
  for(const role of ['anon','authenticated']){
    for(const name of ['shopify_commercial_details','shopify_business_retention_policies'])
      assert.equal(await scalar("SELECT has_table_privilege($1,$2,'SELECT') AS result",[role,name]),false);
    assert.equal(await scalar("SELECT has_function_privilege($1,'public.import_shopify_retained_draft(jsonb,boolean)','EXECUTE') AS result",[role]),false);
  }
  assert.equal(await scalar("SELECT has_table_privilege('service_role','public.shopify_commercial_details','INSERT') AS result"),false);
  const privacy=await scalar('SELECT public.receive_shopify_privacy($1::jsonb) AS result',[JSON.stringify({tenantId:f.tenant,connectionId:connection,
    shopGid:context.shopGid,shopDomain:context.shopDomain,appRef:context.appRef,environment:'production',topic:'customers/redact',deliveryId:randomUUID(),
    bodySha256:'c'.repeat(64),customerGid:f.source.order.customer.id,orderGids:[f.source.order.id],sealedContact:{}})]);
  await scalar('SELECT public.redact_shopify_source($1,$2,$3,$4,$5,100) AS result',[f.tenant,connection,f.actor.userId,privacy.requestId,randomUUID()]);
  assert.equal(await scalar("SELECT count(*)::int AS result FROM shopify_source_revisions WHERE tenant_id=$1 AND sealed_source ? 'ciphertext'",[f.tenant]),0);
  assert.deepEqual(await read(),first,'normalized details do not depend on raw payload or active import flags');
  const durablePayment=await scalar('SELECT read_shopify_retained_payment($1,$2,$3,$4,$5) AS result',
    [f.tenant,'fictional-manager',f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,result.orderId]);
  assert.equal(durablePayment.payment.amounts.received,'118.00','raw redaction does not erase source payment facts');
  for(const table of ['orders','customers'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),1);
  for(const table of ['order_items','order_payments','shopify_variant_mappings','shopify_releases'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0);
}));

test('one-day cleanup is bounded, opt-in and store-scoped; partial payloads expire without deleting business rows',isolated(async f=>{
  const state=await copy(f),connection=state.connection.id;
  const purge=(patch={})=>scalar('SELECT public.purge_expired_shopify_raw($1,$2,$3,$4,$5) AS result',
    [patch.tenant??f.tenant,connection,patch.domain??f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,patch.limit??1]);
  const denied=async(fn,pattern)=>{await db.exec('SAVEPOINT cleanup_denied');await assert.rejects(fn,pattern);await db.exec('ROLLBACK TO SAVEPOINT cleanup_denied');};
  await denied(()=>purge(),/SHOPIFY_ACCESS_DENIED/);
  await scalar('SELECT public.approve_shopify_business_retention($1,$2,$3,true) AS result',[f.tenant,connection,f.actor.userId]);
  assert.deepEqual(await purge(),{redactedCount:0,hasMore:false});
  // Only the fictional in-memory fixture seeds historical observations. No
  // clock override, disabled guard or backwards timestamp is exposed by the RPC.
  for(const [generation,completeness] of [[100,'complete'],[101,'partial']]){
    await db.query(`INSERT INTO shopify_source_revisions SELECT (jsonb_populate_record(null::shopify_source_revisions,
      to_jsonb(r)||jsonb_build_object('id',gen_random_uuid(),'generation',$2::int,'completeness',$3::text,
        'observed_at',clock_timestamp()-interval '25 hours'))).*
      FROM shopify_source_revisions r WHERE r.tenant_id=$1 AND r.generation=1`,[f.tenant,generation,completeness]);
  }
  await denied(()=>purge({tenant:randomUUID()}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>purge({domain:'another-shop.myshopify.com'}),/SHOPIFY_ACCESS_DENIED/);
  await denied(()=>purge({limit:101}),/SHOPIFY_COMMAND_INVALID/);
  await denied(()=>db.query(`UPDATE shopify_source_revisions SET sealed_source=jsonb_build_object('redactedByRetentionPolicy',$2::text)
    WHERE tenant_id=$1 AND generation=1`,[f.tenant,connection]),/SHOPIFY_AUDIT_IMMUTABLE/);
  const beforeRows=await scalar(`SELECT jsonb_build_object('orders',(SELECT jsonb_agg(o) FROM orders o WHERE tenant_id=$1),
    'customers',(SELECT jsonb_agg(c) FROM customers c WHERE tenant_id=$1),'connection',(SELECT to_jsonb(c) FROM shopify_connections c WHERE id=$2)) AS result`,[f.tenant,connection]);
  // Execute as the real application role, not fixture superuser. Browser roles
  // have no access, and no general source-revision UPDATE is being granted.
  await db.exec('SET LOCAL ROLE service_role');
  assert.deepEqual(await purge(),{redactedCount:1,hasMore:true});
  assert.deepEqual(await purge(),{redactedCount:1,hasMore:false});
  assert.deepEqual(await purge(),{redactedCount:0,hasMore:false});
  await db.exec('RESET ROLE');
  const afterRows=await scalar(`SELECT jsonb_build_object('orders',(SELECT jsonb_agg(o) FROM orders o WHERE tenant_id=$1),
    'customers',(SELECT jsonb_agg(c) FROM customers c WHERE tenant_id=$1),'connection',(SELECT to_jsonb(c) FROM shopify_connections c WHERE id=$2)) AS result`,[f.tenant,connection]);
  assert.deepEqual(afterRows,beforeRows,'business records and all activation flags unchanged');
  assert.equal(await scalar("SELECT count(*)::int AS result FROM shopify_source_revisions WHERE tenant_id=$1 AND sealed_source ? 'ciphertext'",[f.tenant]),1,'unexpired raw source preserved');
  assert.equal(await scalar("SELECT count(*)::int AS result FROM shopify_source_revisions WHERE tenant_id=$1 AND completeness='partial' AND sealed_source ? 'redactedByRetentionPolicy'",[f.tenant]),1);
  assert.equal(await scalar("SELECT count(*)::int AS result FROM shopify_application_audit WHERE tenant_id=$1 AND action='raw_retention_cleanup'",[f.tenant]),2,'idempotent empty run does not add noise');
  for(const role of ['anon','authenticated'])assert.equal(await scalar("SELECT has_function_privilege($1,'public.purge_expired_shopify_raw(uuid,uuid,text,text,integer)','EXECUTE') AS result",[role]),false);
}));

test('manual Reference created after preview stops retained import before any order/customer/source mutation',isolated(async f=>{
  const state=await authorize(f),connection=state.connection.id;
  await scalar('SELECT public.approve_shopify_business_retention($1,$2,$3,true) AS result',[f.tenant,connection,f.actor.userId]);
  const preview=await scalar('SELECT public.preview_shopify_order_matches($1,$2,$3,$4,$5,$6,$7::jsonb) AS result',
    [f.tenant,connection,f.actor.userId,f.env.SHOPIFY_SHOP_DOMAIN,f.env.SHOPIFY_CLIENT_ID,'gid://shopify/Shop/101',
      JSON.stringify([{orderGid:f.source.order.id,reference:f.source.order.name}])]);
  assert.equal(preview[0].status,'new');
  const customer=randomUUID();
  await db.query("INSERT INTO customers(id,tenant_id,name) VALUES($1,$2,'Fictional manual customer')",[customer,f.tenant]);
  await db.query(`INSERT INTO orders(tenant_id,customer_id,order_number,tracking_token,reference_order_id)
    VALUES($1,$2,'MANUAL-EXISTING','manual-existing',$3)`,[f.tenant,customer,f.source.order.name]);
  await f.run({action:'queue_order',connectionId:connection});
  const binding={tenantId:f.tenant,connectionId:connection,appRef:f.env.SHOPIFY_CLIENT_ID,environment:'production'};
  const context=await readShopifyWorkerContext(adapter,binding,f.signal),[lease]=await createShopifyQueueStore(adapter).claim(binding,1,f.signal);
  const token=await createShopifyPilotCredentialReader(f.transport)(context,f.signal,f.env);
  const source=await createShopifyOrderHydrator(f.transport)(context,lease,token.accessToken,f.signal,f.env);
  assert.equal(source.status,'complete');
  await db.exec('SAVEPOINT collision');
  await assert.rejects(()=>createShopifyDraftStore(adapter,{retainBusinessDetails:true}).importSnapshot(source.snapshot,context,lease,f.signal,f.env),/REFERENCE_MATCH_REQUIRED/);
  await db.exec('ROLLBACK TO SAVEPOINT collision');
  for(const table of ['orders','customers'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),1);
  for(const table of ['shopify_source_orders','shopify_source_revisions','shopify_commercial_details'])assert.equal(await scalar(`SELECT count(*)::int AS result FROM ${table} WHERE tenant_id=$1`,[f.tenant]),0);
}));
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
