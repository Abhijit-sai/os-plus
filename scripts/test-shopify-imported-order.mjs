import assert from 'node:assert/strict';
import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { projectImportedShopifyOrder,projectImportedShopifyOrderSafely,importedShopifyOrdersVisible } from '../src/integrations/shopify/imported-order.ts';
import { sealShopifySource } from '../src/integrations/shopify/source-crypto.ts';
import { snapshot,context,now } from './fixtures/shopify-draft.mjs';
const env={SHOPIFY_SOURCE_KEY_ID:'synthetic-imported-key',SHOPIFY_SOURCE_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
function row(source=snapshot()){
  const plaintext=JSON.stringify({kind:'shopify_draft_input',schemaVersion:1,tenantId:context.tenantId,connectionId:context.connectionId,
    shopGid:context.shopGid,sourceOrderGid:source.order.id,sourceSnapshot:source});
  const sourceDigest=createHash('sha256').update(plaintext).digest('hex');
  return {tenantId:context.tenantId,orderId:randomUUID(),number:'ORD-SYNTHETIC',connectionId:context.connectionId,shopGid:context.shopGid,
    sourceOrderGid:source.order.id,sourceDigest,sourceUpdatedAt:source.order.updatedAt,observedAt:source.observedAt,
    completeness:'complete',expiresAt:new Date(now+86400000).toISOString(),
    sealedSource:sealShopifySource(plaintext,JSON.stringify([context.tenantId,context.connectionId,context.shopGid,source.order.id,sourceDigest]),env)};
}
test('full source fields are projected without a mapping or release and preserve exact quantities/money',()=>{
  const source=snapshot();source.lines[0].quantity=3;source.lines[0].currentQuantity=2;
  source.lines[0].originalUnitPriceSet.shopMoney.amount='999999999999999999.001';
  source.lines[0].priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount='180.00';
  source.lines[0].variant=null;source.lines[0].sku=null;
  source.order.shippingAddress={firstName:'Fictional',lastName:'Buyer',phone:null,address1:'Fictional address',address2:null,city:'Test',province:null,countryCodeV2:'IN',zip:'000000'};
  source.order.cancelledAt=source.order.updatedAt;
  const dto=projectImportedShopifyOrder(row(source),context.tenantId,env,now);
  assert.equal(dto.customer.name,'Fictional Buyer');assert.equal(dto.shippingAddress.address1,'Fictional address');
  assert.equal(dto.lines[0].quantity,3);assert.equal(dto.lines[0].currentQuantity,2);assert.equal(dto.lines[0].unitPrice,'999999999999999999.001');
  assert.equal(dto.lines[0].currentLineSubtotal,'180.00');assert.equal(dto.lines[0].discountedUnitPrice,undefined);
  assert.equal(dto.cancelledAt,source.order.updatedAt);assert.equal(dto.payment.amounts.total,'118.00');
  for(const forbidden of ['sealedSource','sourceSnapshot','encryption','connectionId','mappingId','reviewId'])assert.ok(!JSON.stringify(dto).includes(forbidden));
});

test('one unavailable encryption key does not hide other orders or bypass tenant validation',()=>{
  const stored=row();
  const dto=projectImportedShopifyOrderSafely(stored,context.tenantId,{},now);
  assert.equal(dto.availability,'unavailable');assert.equal(dto.lines,undefined);assert.equal(dto.customer,undefined);
  assert.equal(projectImportedShopifyOrderSafely(stored,context.tenantId,env,now).availability,'available');
  assert.throws(()=>projectImportedShopifyOrderSafely(stored,randomUUID(),env,now),/ACCESS_DENIED/);
});
test('expiry partial redaction and corrupt/foreign packets never leak source',()=>{
  const stored=row();
  for(const [patch,status] of [[{expiresAt:new Date(now).toISOString()},'expired'],[{completeness:'partial'},'partial'],[{sealedSource:null},'unavailable']]){
    const dto=projectImportedShopifyOrder({...stored,...patch},context.tenantId,env,now);
    assert.equal(dto.availability,status);assert.equal(dto.customer,undefined);assert.equal(dto.lines,undefined);
  }
  assert.throws(()=>projectImportedShopifyOrder(stored,randomUUID(),env,now),/ACCESS_DENIED/);
  assert.throws(()=>projectImportedShopifyOrder({...stored,sourceDigest:'0'.repeat(64)},context.tenantId,env,now));
  assert.throws(()=>projectImportedShopifyOrder({...stored,observedAt:new Date(now+1).toISOString()},context.tenantId,env,now),/ACCESS_DENIED/);
});
test('only enabled Test owner and manager may enter imported-reader path',()=>{
  const settings={SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true',SHOPIFY_CONNECTION_TEST_TENANT_ID:context.tenantId};
  for(const role of ['owner_admin','manager'])assert.equal(importedShopifyOrdersVisible(context.tenantId,role,settings),true);
  for(const role of ['finance','viewer','super_admin',''])assert.equal(importedShopifyOrdersVisible(context.tenantId,role,settings),false);
  assert.equal(importedShopifyOrdersVisible(randomUUID(),'owner_admin',settings),false);
  assert.equal(importedShopifyOrdersVisible(context.tenantId,'owner_admin',{...settings,SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'false'}),false);
});
