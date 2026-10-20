import assert from 'node:assert/strict';
import { createHash,randomBytes,randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { projectImportedShopifyOrder,projectImportedShopifyOrderSafely,importedShopifyOrdersVisible,withShopifyImageReferences } from '../src/integrations/shopify/imported-order.ts';
import { projectShopifyCommercialDetails } from '../src/integrations/shopify/commercial-order.ts';
import { safeShopifyImageUrl } from '../src/integrations/shopify/image-reference.ts';
import { readShopifyDraftPreviews } from '../src/integrations/shopify/imported-previews.ts';
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
test('display includes only allowlisted image links; durable commercial data stays unchanged',()=>{
  const source=snapshot();
  source.lines[0].image={id:null,url:'https://cdn.shopify.com/s/files/1/fictional.png',altText:'Fictional garment'};
  const dto=projectImportedShopifyOrder(row(source),context.tenantId,env,now);
  assert.equal(dto.lines[0].image.url,source.lines[0].image.url);
  assert.equal(dto.lines[0].image.provenance,'order');
  assert.equal(projectShopifyCommercialDetails(source).lines[0].image,undefined);
  const retained={...dto,lines:dto.lines.map(({image,...line})=>line)};
  assert.equal(withShopifyImageReferences(retained,dto).lines[0].image.url,source.lines[0].image.url);
  assert.equal(withShopifyImageReferences(retained,{...dto,id:randomUUID()}).lines[0].image,undefined);
  assert.equal(withShopifyImageReferences(retained,{...dto,updatedAt:'2026-01-01T00:00:00Z'}).lines[0].image,undefined);
  assert.equal(withShopifyImageReferences(retained,{...dto,availability:'expired'}).lines[0].image,undefined);
  assert.equal(projectImportedShopifyOrder({...row(source),expiresAt:new Date(now).toISOString()},context.tenantId,env,now).lines,undefined);
});
test('image reference guard rejects arbitrary hosts, schemes, credentials and fragments',()=>{
  for(const url of ['javascript:alert(1)','data:image/svg+xml,x','http://cdn.shopify.com/x','https://cdn.shopify.com.evil.test/x',
    'https://user:password@cdn.shopify.com/x','https://cdn.shopify.com:8080/x','https://cdn.shopify.com/x#secret','/local-image','https://127.0.0.1/x'])
    assert.equal(safeShopifyImageUrl(url),null,url);
  assert.equal(safeShopifyImageUrl('https://cdn.shopify.com/s/files/1/test.png?v=1'),'https://cdn.shopify.com/s/files/1/test.png?v=1');
});
test('date-range preview enrichment uses exact tenant/source/revision and expires without affecting the order',async()=>{
  const source=snapshot();source.lines[0].image={id:null,url:'https://cdn.shopify.com/s/files/1/fictional.png',altText:null};
  const stored=row(source),revision=randomUUID(),sourceId=randomUUID();
  const projected=projectImportedShopifyOrder(stored,context.tenantId,env,now);
  const retained={...projected,lines:projected.lines.map(({image,...line})=>line)};
  const view={tenantId:context.tenantId,orderId:stored.orderId,sourceOrderId:sourceId,sourceRevisionId:revision,
    connectionId:context.connectionId,shopGid:context.shopGid,sourceDigest:stored.sourceDigest,sourceOrderGid:stored.sourceOrderGid,sourceUpdatedAt:stored.sourceUpdatedAt.replace('Z','+00:00')};
  const calls=[];
  function db({expired=false,redacted=false,failed=false}={}){
    return {from(table){
      const filters=[];
      const query={select(){return query;},eq(key,value){filters.push([key,value]);return query;},gt(key,value){filters.push([key,value]);return query;},
        abortSignal(){return query;},maybeSingle(){calls.push({table,filters});if(failed)throw Error('Synthetic timeout');
          return Promise.resolve({error:null,data:table==='shopify_commercial_details'?(expired?null:{raw_expires_at:stored.expiresAt}):{
            source_digest:stored.sourceDigest,source_updated_at:stored.sourceUpdatedAt,observed_at:stored.observedAt,
            completeness:'complete',sealed_source:redacted?null:stored.sealedSource}});}};
      return query;
    }};
  }
  const signal=AbortSignal.timeout(5000);
  const result=await readShopifyDraftPreviews(db(),retained,view,signal,env,()=>now);
  assert.equal(result.lines[0].image.url,source.lines[0].image.url);
  assert.equal(calls.length,2);
  for(const call of calls){assert.ok(call.filters.some(([key,value])=>key==='tenant_id'&&value===context.tenantId));
    assert.ok(call.filters.some(([key,value])=>key==='source_order_id'&&value===sourceId));}
  assert.ok(calls[0].filters.some(([key,value])=>key==='revision_id'&&value===revision));
  assert.ok(calls[1].filters.some(([key,value])=>key==='id'&&value===revision));
  assert.ok(calls[1].filters.some(([key,value])=>key==='source_digest'&&value===stored.sourceDigest));
  calls.length=0;
  assert.deepEqual(await readShopifyDraftPreviews(db({expired:true}),retained,view,signal,env,()=>now),retained);
  assert.equal(calls.length,1,'expired records never fetch ciphertext');
  for(const mode of [{redacted:true},{failed:true}]){
    assert.deepEqual(await readShopifyDraftPreviews(db(mode),retained,view,signal,env,()=>now),retained);
  }
  assert.deepEqual(await readShopifyDraftPreviews(db(),retained,view,signal,{},()=>now),retained,'missing key does not break editing');
  calls.length=0;
  assert.deepEqual(await readShopifyDraftPreviews(db(),retained,{...view,orderId:randomUUID()},signal,env,()=>now),retained);
  assert.equal(calls.length,0);
  let tick=0;
  assert.deepEqual(await readShopifyDraftPreviews(db(),retained,view,signal,env,()=>tick++===0?now:now+86400001),retained,'expiry during reads is respected');
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
