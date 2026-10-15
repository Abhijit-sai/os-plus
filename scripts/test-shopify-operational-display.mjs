import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localOrderReceivable, matchesLocalPayment } from '../src/features/orders/financial-display.ts';
import { deliveryDayOffset } from '../src/features/orders/delivery-date.ts';
test('delivery date labels use the same Kolkata day before and after midnight as SQL filtering',()=>{
  assert.equal(deliveryDayOffset('2026-10-09',new Date('2026-10-08T18:29:59Z')),1);
  assert.equal(deliveryDayOffset('2026-10-09',new Date('2026-10-08T18:30:00Z')),0);
  assert.equal(deliveryDayOffset('2026-10-08',new Date('2026-10-08T18:30:00Z')),-1);
  assert.equal(deliveryDayOffset('2026-10-12',new Date('2026-10-08T18:30:00Z')),3);
  assert.equal(deliveryDayOffset(null),null);assert.equal(deliveryDayOffset('not-a-date'),null);
});
test('Shopify accepted merchandise cannot become a local receivable or unpaid filter match',()=>{
  const imported={source:'shopify',total_amount:4500,amount_paid:0,payment_status:'unpaid'};
  assert.equal(localOrderReceivable(imported),0);
  assert.equal(matchesLocalPayment(imported,'unpaid'),false);
  assert.equal(matchesLocalPayment(imported,'all'),true);
});
test('local receivable and payment filters remain unchanged',()=>{
  const local={source:'manual',total_amount:4500,amount_paid:1000,payment_status:'partially_paid'};
  assert.equal(localOrderReceivable(local),3500);assert.equal(matchesLocalPayment(local,'partially_paid'),true);
  assert.equal(matchesLocalPayment(local,'unpaid'),false);
  assert.equal(localOrderReceivable({...local,amount_paid:5000}),0);
});
