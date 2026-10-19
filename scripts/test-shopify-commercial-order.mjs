import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { snapshot, context } from './fixtures/shopify-draft.mjs';
import { projectShopifyCommercialDetails, readShopifyCommercialDetails, readShopifyCommercialPayment } from '../src/integrations/shopify/commercial-order.ts';

test('retained normalized business DTO is independent of raw ciphertext, source expiry and encryption keys', () => {
  const source = snapshot(), details = projectShopifyCommercialDetails(source), orderId = randomUUID();
  const stored = JSON.parse(JSON.stringify({ schemaVersion: 1, tenantId: context.tenantId, orderId,
    number: 'ORD-FICTIONAL', sourceOrderGid: source.order.id, details }));
  const result = readShopifyCommercialDetails(stored, { tenantId: context.tenantId, orderId });
  assert.equal(result.payment.amounts.total, '118.00');
  assert.equal(result.lines[0].quantity, 1); assert.equal(result.sourceNumber, source.order.name);
  assert.equal(result.note, source.order.note);
  for (const key of ['sourceSnapshot', 'sealedSource', 'ciphertext', 'leaseToken', 'accessToken', 'jobId', 'connectionRevision', 'expiresAt'])
    assert.ok(!JSON.stringify(result).includes(key), key);
  assert.throws(() => readShopifyCommercialDetails(stored, { tenantId: randomUUID(), orderId }), /ACCESS_DENIED/);
  assert.throws(() => readShopifyCommercialDetails(stored, { tenantId: context.tenantId, orderId: randomUUID() }), /ACCESS_DENIED/);
  assert.throws(() => readShopifyCommercialDetails({ ...stored, details: { ...details, raw: source } }, { tenantId: context.tenantId, orderId }));
});

test('missing variants and source decimals survive normalization without fabricating production or receipts', () => {
  const source = snapshot(); source.lines[0].variant = null;
  source.lines[0].originalUnitPriceSet.shopMoney.amount = '999999999999999999.123456';
  const details = projectShopifyCommercialDetails(source);
  assert.equal(details.lines[0].unitPrice, '999999999999999999.123456');
  assert.equal(details.customer.name, 'Shopify guest');
  for (const key of ['workflowId', 'itemTypeId', 'mappingId', 'receiptId', 'amountPaid']) assert.ok(!JSON.stringify(details).includes(key));
});

test('durable payment decoder checks tenant and order without requiring raw decryption',()=>{
  const orderId=randomUUID(),payment=projectShopifyCommercialDetails(snapshot()).payment;
  const stored={tenantId:context.tenantId,orderId,payment};
  assert.deepEqual(readShopifyCommercialPayment(stored,{tenantId:context.tenantId,orderId}),payment);
  assert.throws(()=>readShopifyCommercialPayment(stored,{tenantId:randomUUID(),orderId}),/ACCESS_DENIED/);
  assert.throws(()=>readShopifyCommercialPayment({...stored,payment:{...payment,raw:'forged'}},{tenantId:context.tenantId,orderId}));
});
