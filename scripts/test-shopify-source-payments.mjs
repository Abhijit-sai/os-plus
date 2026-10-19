import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { projectShopifySourcePayment, decodeShopifySourcePayment } from '../src/integrations/shopify/source-payment.ts';
import { readShopifyCommercialPayment } from '../src/integrations/shopify/commercial-order.ts';
import { canonicalShopDomain } from '../src/integrations/shopify/config.ts';
import { sealShopifySource } from '../src/integrations/shopify/source-crypto.ts';
import { snapshot, bag, context } from './fixtures/shopify-draft.mjs';
const orderId='70000000-0000-4000-8000-000000000001';
const env={SHOPIFY_SOURCE_KEY_ID:'synthetic-payment-key',SHOPIFY_SOURCE_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
function row(source=snapshot(),patch={}) {
  const plaintext=JSON.stringify({kind:'shopify_draft_input',schemaVersion:1,tenantId:context.tenantId,
    connectionId:context.connectionId,shopGid:context.shopGid,sourceOrderGid:source.order.id,sourceSnapshot:source});
  const sourceDigest=createHash('sha256').update(plaintext).digest('hex');
  return {tenantId:context.tenantId,orderId,connectionId:context.connectionId,shopGid:context.shopGid,sourceOrderGid:source.order.id,
    sourceDigest,sourceUpdatedAt:source.order.updatedAt,observedAt:source.observedAt,completeness:'complete',productionHeld:false,
    sealedSource:sealShopifySource(plaintext,JSON.stringify([context.tenantId,context.connectionId,context.shopGid,source.order.id,sourceDigest]),env),...patch};
}
test('paid and partial summaries use actual source received/refunded/outstanding, not operational merchandise',()=>{
  const source=snapshot(), paid=projectShopifySourcePayment(source);
  assert.equal(paid.amounts.total,'118.00');assert.equal(paid.amounts.received,'118.00');
  assert.equal(paid.statusLabel,'Paid');assert.equal(paid.validation,'source_consistent');
  source.order.displayFinancialStatus='PARTIALLY_PAID';source.order.totalReceivedSet=bag('40.00');
  source.order.netPaymentSet=bag('40.00');source.order.totalOutstandingSet=bag('78.00');
  const partial=projectShopifySourcePayment(source);assert.equal(partial.amounts.received,'40.00');assert.equal(partial.amounts.outstanding,'78.00');
  assert.equal(partial.validation,'source_consistent');assert.equal(Object.hasOwn(partial,'localPaymentEntries'),false);
});
test('authorization, pending, expiry and void never invent received money from status',()=>{
  for(const status of ['AUTHORIZED','PENDING','EXPIRED','VOIDED']) {
    const source=snapshot();source.order.displayFinancialStatus=status;source.order.totalReceivedSet=bag('0.00');
    source.order.netPaymentSet=bag('0.00');source.order.totalOutstandingSet=bag('118.00');
    const result=projectShopifySourcePayment(source);assert.equal(result.amounts.received,'0.00');assert.equal(result.status,status);
    assert.equal(result.validation,'source_consistent');
  }
});
test('partial payment requires positive reported receipts and remainder, while free/manual-paid facts are not invented',()=>{
  for(const [received,outstanding] of [['0.00','118.00'],['118.00','0.00'],['118.00','-1.00']]) {
    const source=snapshot();source.order.displayFinancialStatus='PARTIALLY_PAID';
    source.order.totalReceivedSet=bag(received);source.order.netPaymentSet=bag(received);source.order.totalOutstandingSet=bag(outstanding);
    const result=projectShopifySourcePayment(source);
    assert.equal(result.validation,'review');assert.ok(result.reasons.includes('PAYMENT_STATUS_CONFLICT'));
    assert.equal(result.amounts.received,received);assert.equal(result.amounts.outstanding,outstanding);
  }
  const free=snapshot();free.order.currentTotalPriceSet=bag('0.00');free.order.totalReceivedSet=bag('0.00');free.order.netPaymentSet=bag('0.00');
  assert.equal(projectShopifySourcePayment(free).validation,'source_consistent');
  const markedPaid=snapshot();markedPaid.order.totalReceivedSet=bag('0.00');markedPaid.order.netPaymentSet=bag('0.00');
  assert.equal(projectShopifySourcePayment(markedPaid).amounts.received,'0.00');
});
test('refund summaries preserve exact amounts, signed outstanding and source currency without FX',()=>{
  const source=snapshot();source.order.displayFinancialStatus='PARTIALLY_REFUNDED';
  source.order.totalRefundedSet=bag('20.00');source.order.netPaymentSet=bag('98.00');source.order.totalOutstandingSet=bag('-20.00');
  const result=projectShopifySourcePayment(source,true);assert.equal(result.amounts.refunded,'20.00');assert.equal(result.amounts.net,'98.00');
  assert.equal(result.amounts.outstanding,'-20.00');assert.equal(result.productionHeld,true);assert.equal(result.currency,'INR');
  assert.equal(result.presentmentCurrency,'USD');assert.equal(result.validation,'source_consistent');
  source.order.displayFinancialStatus='REFUNDED';source.order.totalRefundedSet=bag('118.00');source.order.netPaymentSet=bag('0.00');
  assert.equal(projectShopifySourcePayment(source).validation,'source_consistent');
});
test('inconsistent, unknown and sub-paise source facts remain explicit review data; mismatched currencies fail',()=>{
  const source=snapshot();source.order.netPaymentSet=bag('117.00');assert.ok(projectShopifySourcePayment(source).reasons.includes('PAYMENT_NET_MISMATCH'));
  source.order.displayFinancialStatus='private unknown string';assert.equal(projectShopifySourcePayment(source).statusLabel,'Status unavailable');
  assert.equal(JSON.stringify(projectShopifySourcePayment(source)).includes('private unknown string'),false);
  source.order.totalReceivedSet=bag('118.001');assert.ok(projectShopifySourcePayment(source).reasons.includes('PAYMENT_PRECISION_REVIEW'));
  source.order.totalReceivedSet.shopMoney.currencyCode='USD';assert.throws(()=>projectShopifySourcePayment(source),/RESPONSE_INVALID/);
});
test('server decoder authenticates scope, AAD, hash, envelope and clocks and exposes financial DTO only',()=>{
  const source=snapshot();source.order.email='fictional-private@example.invalid';const sealed=row(source);
  const expected={tenantId:context.tenantId,orderId};const result=decodeShopifySourcePayment(sealed,expected,env);
  assert.equal(result.amounts.total,'118.00');assert.equal(JSON.stringify(result).includes('fictional-private'),false);
  for(const patch of [{tenantId:'10000000-0000-4000-8000-000000000002'},{orderId:'70000000-0000-4000-8000-000000000002'},
    {sourceUpdatedAt:'2026-10-08T03:00:00Z'},{observedAt:'2026-10-08T13:00:00Z'},{sourceDigest:'f'.repeat(64)},
    {shopGid:'gid://shopify/Shop/102'},{completeness:'partial'},{sealedSource:{}}])
    assert.throws(()=>decodeShopifySourcePayment({...sealed,...patch},expected,env));
  assert.throws(()=>decodeShopifySourcePayment(sealed,expected,{}),/CONFIGURATION_INVALID/);
});
function loadPaymentReader(){
  const code=ts.transpileModule(readFileSync(new URL('../src/features/orders/shopify-payments.ts',import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const testModule={exports:{}};vm.runInNewContext(code,{module:testModule,exports:testModule.exports,require(name){
    if(name==='server-only')return {};if(name==='@/integrations/shopify/source-payment')return {decodeShopifySourcePayment};
    if(name==='@/integrations/shopify/commercial-order')return {readShopifyCommercialPayment};
    if(name==='@/integrations/shopify/config')return {canonicalShopDomain};throw Error(name);
  },AbortSignal});
  return testModule.exports;
}
test('source payment reader issues one scoped read and returns unavailable rather than zero or private error',async()=>{
  const testModule={exports:loadPaymentReader()};
  let calls=0;const db={rpc(name,args){calls++;assert.equal(name,'read_shopify_payment_source');assert.deepEqual(JSON.parse(JSON.stringify(args)),
    {p_tenant_id:context.tenantId,p_actor_id:'synthetic-owner',p_order_id:orderId});return {abortSignal(signal){assert.equal(signal.aborted,false);return Promise.resolve({data:row(),error:null});}};}};
  const result=await testModule.exports.getShopifyPaymentDisplay(db,context.tenantId,'synthetic-owner',orderId,env);
  assert.equal(result.availability,'available');assert.equal(calls,1);
  const unavailable=await testModule.exports.getShopifyPaymentDisplay({rpc(){return {abortSignal(){return Promise.resolve({data:null,error:{message:'private payload'}});}};}},context.tenantId,'synthetic-owner',orderId,env);
  assert.deepEqual(JSON.parse(JSON.stringify(unavailable)),{availability:'unavailable'});
  const thrown=await testModule.exports.getShopifyPaymentDisplay({rpc(){throw Error('private transport error');}},context.tenantId,'synthetic-owner',orderId,env);
  assert.deepEqual(JSON.parse(JSON.stringify(thrown)),{availability:'unavailable'});
});

test('retained Test payment reader needs no raw key and fails closed on wrong returned scope or SQL failure',async()=>{
  const {getShopifyPaymentDisplay}=loadPaymentReader();
  const settings={SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED:'true',SHOPIFY_CONNECTION_TEST_TENANT_ID:context.tenantId,
    SHOPIFY_SHOP_DOMAIN:context.shopDomain,SHOPIFY_CLIENT_ID:context.appRef};
  const payment=projectShopifySourcePayment(snapshot());let calls=0;
  const db={rpc(name,args){calls++;assert.equal(name,'read_shopify_retained_payment');
    assert.equal(args.p_domain,context.shopDomain);assert.equal(args.p_tenant_id,context.tenantId);
    return {abortSignal(){return Promise.resolve({data:{tenantId:context.tenantId,orderId,payment},error:null});}};}};
  assert.deepEqual(await getShopifyPaymentDisplay(db,context.tenantId,'synthetic-manager',orderId,settings),payment);assert.equal(calls,1);
  for(const response of [{data:{tenantId:context.tenantId,orderId:'70000000-0000-4000-8000-000000000002',payment},error:null},
    {data:null,error:{message:'private SQL details'}}]){
    const result=await getShopifyPaymentDisplay({rpc(){return {abortSignal(){return Promise.resolve(response);}};}},context.tenantId,'synthetic-manager',orderId,settings);
    assert.deepEqual(JSON.parse(JSON.stringify(result)),{availability:'unavailable'});
  }
});
