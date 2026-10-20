import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getShopifyApplicationConfig,isShopifyApplicationVisible } from '../src/integrations/shopify/application-config.ts';
const tenant='10000000-0000-4000-8000-000000000001';
const actor={userId:'fictional-owner',tenantId:tenant,role:'owner_admin',membershipUserId:'fictional-owner',
  membershipTenantId:tenant,membershipStatus:'active',tenantStatus:'active'};
const env={VERCEL_ENV:'production',SHOPIFY_DEPLOYMENT_ENV:'production',SHOPIFY_API_VERSION:'2026-10',
  SHOPIFY_CONNECTION_SCREEN_ENABLED:'true',SHOPIFY_PILOT_OPERATIONS_ENABLED:'true',SHOPIFY_CONNECTION_TEST_TENANT_ID:tenant,
  SHOPIFY_SHOP_DOMAIN:'fictional-pilot.myshopify.com',SHOPIFY_APPLICATION_ORIGIN:'https://example.invalid',
  SHOPIFY_CLIENT_ID:'fictional-app',SHOPIFY_CLIENT_SECRET:'fictional-private'};
test('pilot app authenticates current owner and exact configured Test tenant before returning scope',()=>{
  assert.equal(getShopifyApplicationConfig(actor,env).tenantId,tenant);
  for(const patch of [{role:'manager'},{role:'finance'},{tenantStatus:'suspended'},{membershipStatus:'disabled'},
    {membershipUserId:'foreign'},{membershipTenantId:'20000000-0000-4000-8000-000000000002'},
    {tenantId:'20000000-0000-4000-8000-000000000002',membershipTenantId:'20000000-0000-4000-8000-000000000002'}])
    assert.throws(()=>getShopifyApplicationConfig({...actor,...patch},env));
});
test('workspace visibility never enables writes and operational configuration fails closed',()=>{
  assert.equal(isShopifyApplicationVisible(tenant,env),true);assert.equal(isShopifyApplicationVisible(tenant,{}),false);
  for(const patch of [{SHOPIFY_PILOT_OPERATIONS_ENABLED:'false'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},
    {SHOPIFY_API_VERSION:'latest'},{SHOPIFY_SHOP_DOMAIN:'evil.invalid'},{SHOPIFY_APPLICATION_ORIGIN:'http://example.invalid'},
    {SHOPIFY_APPLICATION_ORIGIN:'https://example.invalid/path'},{SHOPIFY_CLIENT_SECRET:''},{SHOPIFY_CLIENT_ID:'bad app'}])
    assert.throws(()=>getShopifyApplicationConfig(actor,{...env,...patch}));
  assert.equal(getShopifyApplicationConfig(actor,env).messagingEnabled,false);
  assert.equal(getShopifyApplicationConfig(actor,env).sourceWritesEnabled,false);
});
