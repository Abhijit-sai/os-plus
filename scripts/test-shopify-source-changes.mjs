import assert from 'node:assert/strict';
import { test } from 'node:test';
import { snapshot } from './fixtures/shopify-draft.mjs';
import { shopifyMeaningfulSourceDigest } from '../src/integrations/shopify/source-change.ts';

test('catalogue-only enrichment and transport clocks do not create order-edit reviews',()=>{
  const before=snapshot(), after=structuredClone(before);
  after.order.updatedAt='2026-10-08T11:00:00Z';
  after.observedAt='2026-10-08T12:01:00Z';after.generation++;
  after.lines[0].catalogue.product=null;after.lines[0].catalogue.variant=null;
  after.lines[0].warnings=['CATALOGUE_UNAVAILABLE'];
  assert.equal(shopifyMeaningfulSourceDigest(before),shopifyMeaningfulSourceDigest(after));
});
test('order quantity, buyer, money, cancellation, refund and buyer property changes differ',()=>{
  const before=snapshot(), hash=shopifyMeaningfulSourceDigest(before);
  for(const change of [
    s=>s.lines[0].quantity++,s=>s.order.email='changed-fictional@example.invalid',
    s=>s.order.currentTotalPriceSet.shopMoney.amount='100.00',
    s=>s.order.cancelledAt='2026-10-08T10:00:00Z',
    s=>s.order.totalRefundedSet.shopMoney.amount='1.00',
    s=>s.lines[0].customAttributes.push({key:'colour',value:'blue'}),
  ]) {const next=structuredClone(before);change(next);assert.notEqual(shopifyMeaningfulSourceDigest(next),hash);}
});
test('nonsemantic array order is stable, but duplicate property information is retained',()=>{
  const before=snapshot();before.order.tags.push('b','a');
  const after=structuredClone(before);after.order.tags.reverse();
  assert.equal(shopifyMeaningfulSourceDigest(before),shopifyMeaningfulSourceDigest(after));
  after.order.tags.push('a');assert.notEqual(shopifyMeaningfulSourceDigest(before),shopifyMeaningfulSourceDigest(after));
});
test('digest does not accept partial/foreign-schema source objects',()=>{
  assert.throws(()=>shopifyMeaningfulSourceDigest({completeness:'partial'}));
});
test('current variant image/reference/profile enrichment changes are not buyer order edits',()=>{
  const before=snapshot();before.order.customer={id:'gid://shopify/Customer/11',firstName:'Fictional',lastName:null,email:null,phone:null};
  const after=structuredClone(before);
  after.lines[0].image=null;after.lines[0].variant=null;after.lines[0].product=null;
  after.lines[0].sku='CURRENT-CATALOGUE-SKU';after.lines[0].name='Current catalogue name';
  after.order.customer.firstName='Current profile name';
  assert.equal(shopifyMeaningfulSourceDigest(before),shopifyMeaningfulSourceDigest(after));
});
