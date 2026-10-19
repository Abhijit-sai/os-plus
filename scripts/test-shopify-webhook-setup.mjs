import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHmac,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {registerShopifyPilotWebhooks} from '../src/integrations/shopify/webhook-registration.ts';
import {testShopifyWebhookDelivery} from '../src/integrations/shopify/webhook-test.ts';
import {readShopifyApplicationGraphQL,createShopifyApplicationWebhook} from '../src/integrations/shopify/client.ts';
const tenant='10000000-0000-4000-8000-000000000001';
const actor={userId:'fictional-owner',tenantId:tenant,role:'owner_admin',membershipUserId:'fictional-owner',membershipTenantId:tenant,membershipStatus:'active',tenantStatus:'active'};
const env={VERCEL_ENV:'production',SHOPIFY_DEPLOYMENT_ENV:'production',SHOPIFY_API_VERSION:'2026-10',SHOPIFY_CONNECTION_SCREEN_ENABLED:'true',SHOPIFY_PILOT_OPERATIONS_ENABLED:'true',SHOPIFY_CONNECTION_TEST_TENANT_ID:tenant,
  SHOPIFY_SHOP_DOMAIN:'fictional-pilot.myshopify.com',SHOPIFY_APPLICATION_ORIGIN:'https://example.invalid',SHOPIFY_CLIENT_ID:'fictional-app',SHOPIFY_CLIENT_SECRET:'fictional-secret',
  SHOPIFY_TEST_COPY_ENABLED:'true',SHOPIFY_SYNC_ENABLED:'true',SHOPIFY_HYDRATION_ENABLED:'true',SHOPIFY_DRAFT_IMPORT_ENABLED:'true',SHOPIFY_EXECUTOR_ENABLED:'true',SHOPIFY_PILOT_CREDENTIALS_ENABLED:'true',SHOPIFY_INTAKE_ENABLED:'true',SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true'};
const expected={connectionId:'20000000-0000-4000-8000-000000000001',shopGid:'gid://shopify/Shop/101',orderGid:'gid://shopify/Order/201',expiresAt:'2026-10-21T00:00:00Z'};
const now=()=>Date.parse('2026-10-19T00:00:00Z'),signal=new AbortController().signal;
function fixture(){
  const rows=[],calls=[],app={apiKey:env.SHOPIFY_CLIENT_ID,webhookApiVersion:'2026-10'},shop={id:expected.shopGid,myshopifyDomain:env.SHOPIFY_SHOP_DOMAIN};let failOnce=false;
  const transport=async(url,init)=>{
    calls.push({url,init});assert.equal(new URL(url).hostname,env.SHOPIFY_SHOP_DOMAIN);
    assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
    if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'fictional-token',expires_in:3600,scope:'read_orders,read_customers,read_products'});
    assert.equal(new URL(url).pathname,'/admin/api/2026-10/graphql.json');
    const input=JSON.parse(init.body);let data;
    if(input.query.startsWith('query '))data={shop,currentAppInstallation:{app},webhookSubscriptions:{nodes:rows,pageInfo:{hasNextPage:false,endCursor:null}}};
    else{
      assert.match(input.query,/^mutation OSPlusCreatePilotWebhook/);assert.ok(!/orderCreate|orderUpdate|customerUpdate/.test(input.query));
      const sub=input.variables.subscription;assert.equal(sub.uri,'https://example.invalid/api/integrations/shopify/orders-webhook');assert.equal(sub.filter,'id:201');
      assert.deepEqual(sub.includeFields,['id','admin_graphql_api_id','updated_at']);
      const row={...sub,id:`gid://shopify/WebhookSubscription/${rows.length+1}`,topic:input.variables.topic,apiVersion:{handle:'2026-10'}};rows.push(row);
      if(failOnce){failOnce=false;throw Error('unknown after commit');}
      data={webhookSubscriptionCreate:{webhookSubscription:row,userErrors:[]}};
    }
    return Response.json({data},{headers:{'X-Shopify-API-Version':'2026-10'}});
  };
  return {rows,calls,app,shop,transport,failNext(){failOnce=true;},run:(options={})=>registerShopifyPilotWebhooks(options.actor??actor,options.expected??expected,options.check??(async()=>expected),signal,options.env??env,options.transport??transport,now,options.createMissing??true)};
}
test('registers exactly three filtered subscriptions; repeated setup performs no mutations',async()=>{
  const f=fixture();assert.deepEqual(await f.run(),{status:'webhooks_ready',created:3,verified:3});
  assert.deepEqual(f.rows.map(r=>r.topic),['ORDERS_CREATE','ORDERS_UPDATED','ORDERS_CANCELLED']);
  assert.deepEqual(await f.run(),{status:'webhooks_ready',created:0,verified:3});assert.equal(f.rows.length,3);
});
test('partial unknown create is recovered by listing before the next attempt',async()=>{
  const f=fixture();f.failNext();await assert.rejects(()=>f.run(),/UPSTREAM_UNAVAILABLE/);assert.equal(f.rows.length,1);
  assert.deepEqual(await f.run(),{status:'webhooks_ready',created:2,verified:3});assert.equal(f.rows.length,3);
});
test('wrong actor, environment, stage, signing key and expired policy fail before any HTTP',async()=>{
  const f=fixture();
  for(const patch of [{role:'manager'},{membershipStatus:'disabled'},{tenantId:randomUUID()},{membershipUserId:'foreign'}])await assert.rejects(()=>f.run({actor:{...actor,...patch}}));
  for(const key of ['SHOPIFY_SYNC_ENABLED','SHOPIFY_TEST_COPY_ENABLED','SHOPIFY_INTAKE_ENABLED','SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED','SHOPIFY_EXECUTOR_ENABLED'])
    await assert.rejects(()=>f.run({env:{...env,[key]:'false'}}));
  for(const patch of [{VERCEL_ENV:'preview'},{SHOPIFY_CONNECTION_TEST_TENANT_ID:randomUUID()},{SHOPIFY_WEBHOOK_SIGNING_SECRET:'different'}])await assert.rejects(()=>f.run({env:{...env,...patch}}));
  const expired={...expected,expiresAt:'2020-01-01T00:00:00Z'};
  await assert.rejects(()=>f.run({expected:expired,check:async()=>expired}),/REVIEW_REQUIRED/);
  await assert.rejects(()=>f.run({check:async()=>({...expected,orderGid:'gid://shopify/Order/999'})}),/REVIEW_REQUIRED/);
  assert.equal(f.calls.length,0);
});
test('Shopify store/app/API mismatch and conflicting existing configuration are never overwritten',async()=>{
  for(const field of ['shop','app','version']){const f=fixture();if(field==='shop')f.shop.id='gid://shopify/Shop/999';if(field==='app')f.app.apiKey='foreign';if(field==='version')f.app.webhookApiVersion='2026-07';await assert.rejects(()=>f.run());assert.equal(f.rows.length,0);}
  for(const patch of [{filter:null},{uri:'https://foreign.invalid'},{includeFields:[]},{format:'XML'},{apiVersion:{handle:'2026-07'}}]){
    const f=fixture();await f.run();Object.assign(f.rows[0],patch);const original=structuredClone(f.rows);
    await assert.rejects(()=>f.run(),/WEBHOOK_CONFIGURATION_CONFLICT/);assert.deepEqual(f.rows,original);
  }
  const f=fixture();await f.run();f.rows.push({...f.rows[0],id:'gid://shopify/WebhookSubscription/99'});await assert.rejects(()=>f.run(),/WEBHOOK_CONFIGURATION_CONFLICT/);
});
test('test prerequisite never creates subscriptions; binding is refreshed before mutation',async()=>{
  const f=fixture();await assert.rejects(()=>f.run({createMissing:false}),/WEBHOOK_SETUP_REQUIRED/);assert.equal(f.rows.length,0);
  let checked=0;await assert.rejects(()=>f.run({check:async()=>{if(++checked>=3)throw Error('membership revoked');return expected;}}),/membership revoked/);assert.equal(f.rows.length,0);
});
test('generic read transport still rejects mutations; fixed writer ignores injected query and destination',async()=>{
  const base={shopDomain:env.SHOPIFY_SHOP_DOMAIN,connectionEnvironment:'production',accessToken:'fictional-token',schema:z.unknown()};
  let called=0;await assert.rejects(()=>readShopifyApplicationGraphQL({...base,query:'mutation Evil { orderDelete }'},actor,async()=>{called++;},env));assert.equal(called,0);
  const f=fixture();await createShopifyApplicationWebhook({...base,topic:'ORDERS_CREATE',orderGid:expected.orderGid,query:'mutation Evil { orderDelete }',variables:{subscription:{uri:'https://evil.invalid'}}},actor,f.transport,env);assert.equal(f.rows.length,1);
});
test('synthetic delivery signs identical replay; receipt reports neither import nor genuine delivery success',async()=>{
  const calls=[];let checks=0;const key=randomUUID();
  const result=await testShopifyWebhookDelivery(actor,expected.orderGid,key,async()=>{checks++;},signal,env,async(url,init)=>{
    assert.equal(url,'https://example.invalid/api/integrations/shopify/orders-webhook');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
    assert.equal(init.headers['X-Shopify-Hmac-Sha256'],createHmac('sha256',env.SHOPIFY_CLIENT_SECRET).update(init.body).digest('base64'));
    assert.deepEqual(JSON.parse(init.body),{admin_graphql_api_id:expected.orderGid});calls.push({body:init.body,headers:init.headers});return Response.json({status:'received'});
  },now);
  assert.equal(checks,2);assert.deepEqual(calls[0],calls[1]);assert.deepEqual(result,{status:'webhook_test_received'});
});
test('synthetic delivery stops on revoked binding, bad responses or disabled intake without leaking response',async()=>{
  let calls=0;const transport=async()=>{calls++;return Response.json({error:'fictional-private'}, {status:503});};
  await assert.rejects(()=>testShopifyWebhookDelivery(actor,expected.orderGid,randomUUID(),async()=>{throw Error('revoked');},signal,env,transport,now),/revoked/);assert.equal(calls,0);
  await assert.rejects(()=>testShopifyWebhookDelivery(actor,expected.orderGid,randomUUID(),async()=>{},signal,{...env,SHOPIFY_INTAKE_ENABLED:'false'},transport,now));assert.equal(calls,0);
  await assert.rejects(()=>testShopifyWebhookDelivery(actor,expected.orderGid,randomUUID(),async()=>{},signal,env,transport,now),e=>e.code==='WEBHOOK_SETUP_UNCONFIRMED'&&!e.message.includes('fictional-private'));assert.equal(calls,1);
});
