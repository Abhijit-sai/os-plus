import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getShopifyConnectionScreen, isShopifyConnectionScreenEnabled } from '../src/integrations/shopify/connection-screen.ts';
import { checkShopifyAccess } from '../src/integrations/shopify/access-check-client.ts';

const tenantId='10000000-0000-4000-8000-000000000001', foreign='20000000-0000-4000-8000-000000000002';
const actor={userId:'user_synthetic',tenantId,role:'owner_admin',membershipUserId:'user_synthetic',
  membershipTenantId:tenantId,membershipStatus:'active',tenantStatus:'active'};
const env={SHOPIFY_CONNECTION_SCREEN_ENABLED:'true',SHOPIFY_CONNECTION_TEST_ENABLED:'true',
  SHOPIFY_CONNECTION_TEST_TENANT_ID:tenantId,SHOPIFY_CLIENT_ID:'synthetic-app',SHOPIFY_CLIENT_SECRET:'private-synthetic',
  SHOPIFY_SHOP_DOMAIN:'synthetic-shop.myshopify.com',SHOPIFY_SYNC_ENABLED:'false',SHOPIFY_API_VERSION:'2026-10',
  SHOPIFY_DEPLOYMENT_ENV:'production',VERCEL_ENV:'production'};
const row={tenant_id:tenantId,canonical_domain:env.SHOPIFY_SHOP_DOMAIN,status:'pending',revision:1,
  intake_enabled:false,processing_enabled:false,draft_import_enabled:false,release_enabled:false};
function database(data=[],error=null){
  const calls=[];
  const chain={select(value){calls.push(['select',value]);return chain;},eq(...value){calls.push(['eq',...value]);return chain;},
    limit(value){calls.push(['limit',value]);return chain;},abortSignal(signal){calls.push(['signal',signal]);return Promise.resolve({data,error});}};
  return {calls,from(name){calls.push(['from',name]);return chain;}};
}
test('screen gate and owner authorization fail before connection reads for foreign/nonowner/disabled scopes',async()=>{
  assert.equal(isShopifyConnectionScreenEnabled(tenantId,env),true);
  assert.equal(isShopifyConnectionScreenEnabled(foreign,env),false);
  assert.equal(isShopifyConnectionScreenEnabled(tenantId,{...env,SHOPIFY_CONNECTION_SCREEN_ENABLED:'false'}),false);
  for(const patch of [{role:'manager'},{role:'finance'},{role:'viewer'},{membershipStatus:'disabled'},
    {tenantStatus:'suspended'},{membershipTenantId:foreign},{membershipUserId:'foreign-user'}]){
    const db=database();await assert.rejects(()=>getShopifyConnectionScreen(db,{...actor,...patch},env),/ACCESS_DENIED/);
    assert.equal(db.calls.length,0);
  }
  const db=database();await assert.rejects(()=>getShopifyConnectionScreen(db,actor,{...env,SHOPIFY_CONNECTION_TEST_TENANT_ID:foreign}),/ACCESS_DENIED/);
  assert.equal(db.calls.length,0);
});
test('missing setup/schema and failures are truthful recoverable states with no private DB error text',async()=>{
  const config=database();assert.equal((await getShopifyConnectionScreen(config,actor,{...env,SHOPIFY_CLIENT_SECRET:''})).availability,'configuration_pending');
  assert.equal(config.calls.length,0);
  for(const code of ['PGRST205','42P01','42703','PGRST204']){
    const state=await getShopifyConnectionScreen(database(null,{code,message:'private DB URL private-synthetic'}),actor,env);
    assert.equal(state.availability,'database_pending');assert.equal(state.canCheckAccess,true);
    assert.doesNotMatch(JSON.stringify(state),/private|secret|token/i);
  }
  const state=await getShopifyConnectionScreen(database(null,{code:'unknown',message:'private'}),actor,env);
  assert.equal(state.availability,'unavailable');assert.equal(state.connection,null);
});
test('connection projection binds current tenant/app/domain/environment and never reports import readiness',async()=>{
  const db=database([row]),state=await getShopifyConnectionScreen(db,actor,env);
  assert.equal(state.availability,'available');assert.equal(state.connection.status,'pending');
  for(const pair of [['tenant_id',tenantId],['app_ref','synthetic-app'],['canonical_domain',env.SHOPIFY_SHOP_DOMAIN],['environment','production']])
    assert.ok(db.calls.some(call=>call[0]==='eq'&&call[1]===pair[0]&&call[2]===pair[1]));
  assert.ok(db.calls.find(call=>call[0]==='signal')[1] instanceof AbortSignal);
  assert.equal((await getShopifyConnectionScreen(database(),actor,env)).availability,'not_connected');
  for(const rows of [[row,row],[{...row,tenant_id:foreign}],[{...row,canonical_domain:'foreign.myshopify.com'}],[{...row,revision:0}]])
    assert.equal((await getShopifyConnectionScreen(database(rows),actor,env)).availability,'unavailable');
  assert.doesNotMatch(JSON.stringify(state),/private-synthetic|synthetic-app/);
});
const result={status:'verified',tenantId,shopDomain:env.SHOPIFY_SHOP_DOMAIN,apiVersion:'2026-10',verifiedAt:'2026-10-14T12:00:00Z',
  requiredScopesVerified:true,importsEnabled:false,messagingEnabled:false,protectedCustomerFieldsVerified:false};
test('actual client protocol calls existing same-origin endpoint with no tenant/shop/credentials in request',async()=>{
  const controller=new AbortController();
  const checked=await checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,controller.signal,async(url,request)=>{
    assert.equal(url,'/api/integrations/shopify/test-connection');assert.equal(request.method,'POST');
    assert.equal(request.body,'{}');assert.equal(request.credentials,'same-origin');assert.equal(request.signal,controller.signal);
    return Response.json({...result,unexpectedPrivate:'private-synthetic'});
  });
  assert.equal(checked.kind,'success');assert.doesNotMatch(JSON.stringify(checked),/private-synthetic/);
  for(const bad of [{...result,tenantId:foreign},{...result,shopDomain:'foreign.myshopify.com'},
    {...result,importsEnabled:true},{...result,protectedCustomerFieldsVerified:true},{...result,status:'pending'}])
    assert.equal((await checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,controller.signal,async()=>Response.json(bad))).kind,'error');
});
test('client errors are safe, role-aware and never display upstream text',async()=>{
  for(const [status,body,message] of [[401,{error:'AUTHENTICATION_REQUIRED'},'Sign in'],[403,{error:'ACCESS_DENIED'},'owner/admin'],
    [503,{error:'CONFIGURATION_INVALID'},'configuration'],[503,{error:'arbitrary-private-value'},'could not'],
    [503,{error:'toString'},'could not'],[503,{error:'constructor'},'could not'],[503,{error:'__proto__'},'could not'],
    [200,{private:'secret'},'could not']]){
    const checked=await checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,new AbortController().signal,async()=>Response.json(body,{status}));
    assert.equal(checked.kind,'error');assert.ok(checked.message.includes(message));assert.doesNotMatch(checked.message,/arbitrary|secret|private-value/);
  }
  const checked=await checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,new AbortController().signal,async()=>{throw Error('private token')});
  assert.equal(checked.kind,'error');assert.doesNotMatch(checked.message,/token/);
});
test('pre-aborted and stalled checks are bounded; response overflow is rejected without displaying private text',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  assert.equal((await checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,controller.signal,async()=>{calls++;})).kind,'error');
  assert.equal(calls,0);
  const stalled=new AbortController();
  const pending=checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,stalled.signal,()=>new Promise(()=>{}));stalled.abort();
  assert.equal((await pending).kind,'error');
  const large=await checkShopifyAccess(tenantId,env.SHOPIFY_SHOP_DOMAIN,new AbortController().signal,
    async()=>Response.json({...result,private:'x'.repeat(10000)}));
  assert.equal(large.kind,'error');assert.doesNotMatch(large.message,/xxxx/);
});
