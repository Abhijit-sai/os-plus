import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { createShopifyApplicationIngress } from '../src/integrations/shopify/application-ingress.ts';
const tenant='10000000-0000-4000-8000-000000000001',connection='20000000-0000-4000-8000-000000000001';
const env={VERCEL_ENV:'production',SHOPIFY_DEPLOYMENT_ENV:'production',SHOPIFY_API_VERSION:'2026-10',SHOPIFY_CONNECTION_TEST_TENANT_ID:tenant,
  SHOPIFY_SHOP_DOMAIN:'synthetic-pilot.myshopify.com',SHOPIFY_CLIENT_ID:'synthetic-app',SHOPIFY_CLIENT_SECRET:'synthetic-secret',SHOPIFY_WORKER_SECRET:'fictional_012345678901234567890123456789',
  SHOPIFY_SCHEDULED_WORKER_ENABLED:'true',SHOPIFY_PILOT_OPERATIONS_ENABLED:'true',SHOPIFY_TEST_COPY_ENABLED:'true',SHOPIFY_SYNC_ENABLED:'true',
  SHOPIFY_HYDRATION_ENABLED:'true',SHOPIFY_DRAFT_IMPORT_ENABLED:'true',SHOPIFY_EXECUTOR_ENABLED:'true',SHOPIFY_PILOT_CREDENTIALS_ENABLED:'true'};
function fixture(expired=true){
  const calls=[];
  const db={from(table){calls.push(table);const q={select(){return q;},eq(){return q;},limit(){return q;},async abortSignal(){return {data:[{id:connection}],error:null};}};return q;},
    rpc(name){calls.push(name);return {async abortSignal(){return {data:name==='purge_expired_shopify_pilot'?{status:expired?'expired_source_purge':'not_expired'}:0,error:null};}};}};
  return {calls,ingress:createShopifyApplicationIngress(db)};
}
const request=(body='{}',authorization=`Bearer ${env.SHOPIFY_WORKER_SECRET}`)=>new Request('https://example.invalid/api/integrations/shopify/worker',{
  method:'POST',headers:{'Content-Type':'application/json',authorization},body});
test('worker deployment and pilot gates precede every service read/write',async()=>{
  for(const patch of [{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{SHOPIFY_DEPLOYMENT_ENV:'development'},{SHOPIFY_API_VERSION:'latest'},
    {SHOPIFY_PILOT_OPERATIONS_ENABLED:'false'},{SHOPIFY_TEST_COPY_ENABLED:'false'},{SHOPIFY_CONNECTION_TEST_TENANT_ID:'bad'}]){
    const f=fixture();const response=await f.ingress.worker(request(),{...env,...patch});assert.equal(response.status,503);assert.deepEqual(f.calls,[],JSON.stringify(patch));
  }
});
test('expired-source cleanup does not skip the independent privacy-contact TTL',async()=>{
  const f=fixture();const response=await f.ingress.worker(request(),env);assert.equal(response.status,200);
  assert.deepEqual(f.calls,['shopify_connections','purge_expired_shopify_pilot','purge_shopify_privacy_contacts']);
});

test('unified raw and privacy cleanup still run when order synchronization is switched off',async()=>{
  const f=fixture();const response=await f.ingress.worker(request(),{...env,SHOPIFY_UNIFIED_ORDERS_ENABLED:'true',SHOPIFY_SYNC_ENABLED:'false'});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'raw_cleanup_checked'});
  assert.deepEqual(f.calls,['shopify_connections','purge_expired_shopify_raw','purge_shopify_privacy_contacts']);
});
test('worker rejects missing secret, bad authorization and browser-selected authority without DB calls',async()=>{
  for(const [body,auth,settings] of [['{}','bad',env],['{}',`Bearer ${env.SHOPIFY_WORKER_SECRET}`,{...env,SHOPIFY_WORKER_SECRET:''}],['{"tenantId":"foreign"}',`Bearer ${env.SHOPIFY_WORKER_SECRET}`,env]]){
    const f=fixture();const response=await f.ingress.worker(request(body,auth),settings);assert.ok(response.status>=400);assert.deepEqual(f.calls,[]);
  }
});
test('uninstall verifies raw HMAC before any binding lookup',async()=>{
  const f=fixture(),body='{"id":101,"myshopify_domain":"synthetic-pilot.myshopify.com"}';
  const req=new Request('https://example.invalid/api/integrations/shopify/uninstall-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-shopify-hmac-sha256':createHmac('sha256','wrong').update(body).digest('base64')},body});
  assert.equal((await f.ingress.uninstall(req,{...env,SHOPIFY_UNINSTALL_ENABLED:'true'})).status,401);assert.deepEqual(f.calls,[]);
});

test('automatic background work is scheduled only after accepted durable receipt and retries safely',async()=>{
  for(const status of ['accepted','duplicate','ignored','conflict']){
    const tasks=[],calls=[];
    const db={from(){const q={select(){return q;},eq(){return q;},in(){return q;},limit(){return q;},async abortSignal(){return {data:[{
      id:connection,tenant_id:tenant,shop_gid:'gid://shopify/Shop/101',canonical_domain:env.SHOPIFY_SHOP_DOMAIN,app_ref:env.SHOPIFY_CLIENT_ID,
      environment:'production',api_version:'2026-10',status:'verified',intake_enabled:true,verified_at:new Date().toISOString(),revision:2}],error:null};}};return q;},
      rpc(){calls.push('committed');return {async abortSignal(){return {data:{status,receiptId:connection},error:null};}};}};
    const ingress=createShopifyApplicationIngress(db,{schedule:task=>{assert.deepEqual(calls,['committed']);tasks.push(task);},run:async()=>{calls.push('worker');return {status:'no_job'};}});
    const body=JSON.stringify({admin_graphql_api_id:'gid://shopify/Order/101'});
    const req=()=>new Request('https://example.invalid/webhook',{method:'POST',body,headers:{'content-type':'application/json',
      'x-shopify-shop-domain':env.SHOPIFY_SHOP_DOMAIN,'x-shopify-topic':'orders/create','x-shopify-api-version':'2026-10','x-shopify-webhook-id':connection,
      'x-shopify-hmac-sha256':createHmac('sha256',env.SHOPIFY_CLIENT_SECRET).update(body).digest('base64')}});
    const settings={...env,SHOPIFY_INTAKE_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true'};
    assert.equal((await ingress.orders(req(),settings)).status,status==='conflict'?409:200);
    assert.equal(tasks.length,['accepted','duplicate'].includes(status)?1:0);
    if(tasks.length){await tasks.shift()();assert.deepEqual(calls,['committed','worker']);}
    calls.length=0;
    await ingress.orders(req(),{...settings,SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'false'});assert.equal(tasks.length,0);
  }
});
