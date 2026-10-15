import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readShopifyWorkerContext } from '../src/integrations/shopify/worker-context.ts';
import { createShopifyPilotCredentialReader } from '../src/integrations/shopify/pilot-credentials.ts';
import { createShopifyTokenProvider } from '../src/integrations/shopify/client-credentials.ts';
import { context,env,now } from './fixtures/shopify-draft.mjs';
const scope={tenantId:context.tenantId,connectionId:context.connectionId,appRef:context.appRef,environment:'production'};
const row={id:scope.connectionId,tenant_id:scope.tenantId,shop_gid:context.shopGid,canonical_domain:context.shopDomain,
  app_ref:scope.appRef,environment:scope.environment,api_version:'2026-10',status:'verified',revision:4,
  intake_enabled:true,processing_enabled:true,draft_import_enabled:true,verified_at:'2026-10-08T00:00:00Z',
  scopes_verified_at:'2026-10-08T00:00:00Z',protected_customer_fields_verified_at:'2026-10-08T00:00:00Z',
  source_copy_authorized_at:'2026-10-08T00:00:00Z',import_created_at_cutoff:context.importCreatedAtCutoff,
  tenants:{id:scope.tenantId,status:'active'}};
function database(data=[row],error=null) {
  const calls=[];
  const chain={select(value){calls.push(['select',value]);return chain;},eq(...args){calls.push(['eq',...args]);return chain;},
    limit(value){calls.push(['limit',value]);return chain;},abortSignal(signal){calls.push(['signal',signal.aborted]);return Promise.resolve({data,error});}};
  return {calls,from(table){calls.push(['from',table]);return chain;}};
}
const signal=()=>new AbortController().signal;
const pilotEnv={...env,SHOPIFY_PILOT_CREDENTIALS_ENABLED:'true',SHOPIFY_CONNECTION_TEST_TENANT_ID:scope.tenantId,
  SHOPIFY_CLIENT_ID:scope.appRef,SHOPIFY_CLIENT_SECRET:'synthetic-private-secret',SHOPIFY_SHOP_DOMAIN:context.shopDomain};
const response=(seconds=3600)=>new Response(JSON.stringify({access_token:'synthetic-token',expires_in:seconds,scope:'read_orders,read_customers,read_products'}));

test('worker context is reconstructed from one exact scoped current DB read, not supplied/cached flags',async()=>{
  const db=database(),value=await readShopifyWorkerContext(db,scope,signal());
  assert.equal(value.revision,4);assert.equal(value.shopGid,context.shopGid);assert.equal(value.tenantStatus,'active');
  for(const [name,value] of [['tenant_id',scope.tenantId],['id',scope.connectionId],['app_ref',scope.appRef],['environment','production']])
    assert.ok(db.calls.some(call=>call[0]==='eq'&&call[1]===name&&call[2]===value));
  assert.ok(db.calls.some(call=>call[0]==='select'&&call[1].includes('!inner(id,status)')));
  assert.ok(!JSON.stringify(value).includes('synthetic-private-secret'));
});
test('missing, ambiguous, foreign, paused and unattested DB states cannot authorize hydration',async()=>{
  const foreign='10000000-0000-4000-8000-000000000002';
  for(const rows of [[],[row,row],[{...row,tenant_id:foreign}],[{...row,tenants:{id:foreign,status:'active'}}],
    [{...row,tenants:{id:scope.tenantId,status:'suspended'}}],[{...row,status:'paused'}],[{...row,processing_enabled:false}],
    [{...row,intake_enabled:false}],[{...row,draft_import_enabled:false}],[{...row,scopes_verified_at:null}],
    [{...row,protected_customer_fields_verified_at:null}],[{...row,source_copy_authorized_at:null}],
    [{...row,id:foreign}],[{...row,app_ref:'foreign-app'}],[{...row,canonical_domain:'not-a-shop.invalid'}]])
    await assert.rejects(()=>readShopifyWorkerContext(database(rows),scope,signal()));
  await assert.rejects(()=>readShopifyWorkerContext(database(null,{message:'private DB error'}),scope,signal()),/UPSTREAM_UNAVAILABLE/);
  const cancelled=new AbortController();cancelled.abort();const db=database();
  await assert.rejects(()=>readShopifyWorkerContext(db,scope,cancelled.signal),/ACCESS_DENIED/);assert.equal(db.calls.length,0);
});
test('pilot credentials require deployment/tenant/domain/app binding before transport and carry provider expiry',async()=>{
  let calls=0;const read=createShopifyPilotCredentialReader(async(url,request)=>{
    calls++;assert.equal(url,`https://${context.shopDomain}/admin/oauth/access_token`);assert.equal(request.redirect,'error');return response();
  },()=>now);
  for(const patch of [{SHOPIFY_PILOT_CREDENTIALS_ENABLED:'false'},{SHOPIFY_CONNECTION_TEST_TENANT_ID:'foreign'},
    {SHOPIFY_CLIENT_ID:'foreign-app'},{SHOPIFY_SHOP_DOMAIN:'foreign.myshopify.com'},{VERCEL_ENV:'preview'},
    {SHOPIFY_SYNC_ENABLED:'false'},{SHOPIFY_CLIENT_SECRET:''}])
    await assert.rejects(()=>read(context,signal(),{...pilotEnv,...patch}));
  assert.equal(calls,0);
  const result=await read(context,signal(),pilotEnv);
  assert.equal(calls,1);assert.equal(result.expiresAt,new Date(now+3600000).toISOString());
  assert.equal(result.connectionRevision,context.revision);assert.equal(result.tenantId,scope.tenantId);
  assert.equal(result.accessToken,'synthetic-token');assert.equal(Object.hasOwn(result,'clientSecret'),false);
});
test('expired, malformed, wrong-scope credentials fail; genuine cached lease retains original expiry',async()=>{
  for(const payload of [{access_token:'synthetic-token',expires_in:0,scope:'read_orders,read_customers,read_products'},
    {access_token:'synthetic-token',expires_in:3600,scope:'read_products'}]) {
    const read=createShopifyPilotCredentialReader(async()=>new Response(JSON.stringify(payload)),()=>now);
    await assert.rejects(()=>read(context,signal(),pilotEnv));
  }
  let clock=now,calls=0;
  const provider=createShopifyTokenProvider(async()=>{calls++;return response();},()=>clock);
  const config={tenantId:scope.tenantId,shopDomain:context.shopDomain,clientId:scope.appRef,clientSecret:'synthetic-secret'};
  const first=await provider.getTokenLease(config);clock+=10000;
  assert.deepEqual(await provider.getTokenLease(config),first);assert.equal(calls,1);
  clock=now+3600000;assert.notEqual((await provider.getTokenLease(config)).expiresAt,first.expiresAt);assert.equal(calls,2);
});
test('caller abort bounds stalled pilot token acquisition without exposing private transport errors',async()=>{
  const controller=new AbortController();
  const read=createShopifyPilotCredentialReader(()=>new Promise(()=>{}),()=>now);
  const pending=read(context,controller.signal,pilotEnv);controller.abort();
  await assert.rejects(pending,/UPSTREAM_UNAVAILABLE/);
});
