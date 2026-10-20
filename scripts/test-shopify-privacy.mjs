import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { parseShopifyPrivacyPayload, createShopifyPrivacyHandler } from '../src/integrations/shopify/privacy-handler.ts';
import { sealShopifySource, openShopifySource } from '../src/integrations/shopify/source-crypto.ts';
import { context, env, lease, now } from './fixtures/shopify-draft.mjs';
import { createShopifyDraftStore } from '../src/integrations/shopify/draft-store.ts';

const settings = { ...env, SHOPIFY_PRIVACY_ENABLED: 'true', SHOPIFY_DRAFT_IMPORT_ENABLED: 'true',
  SHOPIFY_CLIENT_ID: 'synthetic-app', SHOPIFY_CLIENT_SECRET: 'synthetic-secret',
  SHOPIFY_SOURCE_KEY_ID: 'v1', SHOPIFY_SOURCE_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') };
const body = '{"shop_id":101,"shop_domain":"synthetic-intake.myshopify.com","customer":{"id":9007199254740993,"email":"fictional@example.test"},"orders_to_redact":[9007199254740995]}';
const binding = { tenantId: context.tenantId, connectionId: context.connectionId, shopGid: context.shopGid,
  shopDomain: context.shopDomain, appRef: context.appRef, environment: 'production', verifiedAt: '2026-10-08T00:00:00Z' };
function request(text = body, signature, topic = 'customers/redact') {
  return new Request('https://example.test/privacy', { method: 'POST', headers: {
    'content-type': 'application/json', 'x-shopify-shop-domain': context.shopDomain,
    'x-shopify-topic': topic, 'x-shopify-webhook-id': randomUUID(),
    'x-shopify-hmac-sha256': signature ?? createHmac('sha256', settings.SHOPIFY_CLIENT_SECRET).update(text).digest('base64'),
  }, body: text });
}
test('privacy ID parsing preserves integers above 2^53 and rejects decimals/exponents/negative IDs', () => {
  assert.equal(parseShopifyPrivacyPayload(body).customer.id, '9007199254740993');
  assert.equal(parseShopifyPrivacyPayload(body).orders_to_redact[0], '9007199254740995');
  for (const value of ['1.5', '1e3', '-1']) assert.throws(() => parseShopifyPrivacyPayload(body.replace('9007199254740993', value)), /REQUEST_INVALID/);
  assert.equal(parseShopifyPrivacyPayload(body.replace('fictional@example.test', '1e3@example.test')).customer.email, '1e3@example.test');
});
test('privacy acknowledgement follows persistence, encrypts contact and works with order flags disabled', async () => {
  const calls = [];
  const handler = createShopifyPrivacyHandler({ findConnection: async () => binding, receive: async (input) => {
    calls.push(input); return { status: 'received', requestId: randomUUID() };
  } });
  const response = await handler(request(), { ...settings, SHOPIFY_INTAKE_ENABLED: 'false', SHOPIFY_SYNC_ENABLED: 'false' });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  const input = calls[0];
  assert.equal(input.customerGid, 'gid://shopify/Customer/9007199254740993');
  assert.deepEqual(input.orderGids, ['gid://shopify/Order/9007199254740995']);
  assert.equal(JSON.stringify(input).includes('fictional@example'), false);
  const contact = openShopifySource(input.sealedContact, JSON.stringify(['shopify-privacy', input.tenantId, input.connectionId, input.deliveryId, input.bodySha256]), settings);
  assert.equal(JSON.parse(contact).email, 'fictional@example.test');
  assert.equal(JSON.stringify(await response.json()).includes('fictional'), false);
});
test('invalid HMAC never looks up a connection; wrong store/preview/failed persistence cannot acknowledge', async () => {
  let lookups = 0, writes = 0;
  const handler = createShopifyPrivacyHandler({ findConnection: async () => { lookups++; return binding; },
    receive: async () => { writes++; throw new Error('PRIVATE secret and payload'); } });
  assert.equal((await handler(request(body, 'x'.repeat(44)), settings)).status, 401);
  assert.equal(lookups, 0);
  assert.equal((await handler(request(), { ...settings, VERCEL_ENV: 'preview' })).status, 503);
  assert.equal(lookups, 0);
  assert.equal((await handler(request(body.replace('101', '102')), settings)).status, 401);
  assert.equal(writes, 0);
  const response = await handler(request(), settings);
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('PRIVATE'), false);
});
test('ignoring-abort dependency is bounded by the total deadline', async () => {
  const handler = createShopifyPrivacyHandler({ findConnection: () => new Promise(() => {}), receive: async () => assert.fail('no write') }, 20);
  const started = Date.now();
  assert.equal((await handler(request(), settings)).status, 503);
  assert.ok(Date.now() - started < 300);
});
test('source keyring rotates writes while old versions decrypt; missing/wrong keys and AAD fail safely', () => {
  const oldPacket = sealShopifySource('fictional private source', 'tenant/order', settings);
  const rotated = { ...settings, SHOPIFY_SOURCE_KEY_ID: 'v2', SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON: JSON.stringify({ v1: settings.SHOPIFY_SOURCE_ENCRYPTION_KEY, v2: Buffer.alloc(32, 3).toString('base64') }) };
  assert.equal(openShopifySource(oldPacket, 'tenant/order', rotated), 'fictional private source');
  assert.equal(sealShopifySource('new', 'tenant/order', rotated).keyId, 'v2');
  assert.throws(() => openShopifySource(oldPacket, 'foreign/order', rotated), /RESPONSE_INVALID/);
  assert.throws(() => openShopifySource(oldPacket, 'tenant/order', { ...rotated, SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON: JSON.stringify({ v2: Buffer.alloc(32, 3).toString('base64') }) }), /CONFIGURATION_INVALID/);
  assert.throws(() => sealShopifySource('x', 'y', { ...rotated, SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON: '{' }), /CONFIGURATION_INVALID/);
});
test('real partial adapter sends no customer/line/address data and supports original-intent read-only recovery', async () => {
  const calls = [];
  const receipt = { status: 'draft', orderId: randomUUID(), sourceRevisionId: randomUUID(), tenantId: context.tenantId,
    customerId: null, customerResolution: 'review', reasons: ['INCOMPLETE_SOURCE'], releaseEligible: false };
  const store = createShopifyDraftStore({ rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => ({ data: receipt, error: null }) }; } });
  const partial = { status: 'review', completeness: 'partial', reason: 'LINE_LIMIT', envelope: { id: lease.orderGid, createdAt: '2026-10-08T01:00:00Z', updatedAt: '2026-10-08T02:00:00Z' } };
  const observed = new Date(now).toISOString();
  await store.importPartialEnvelope(partial, context, lease, new AbortController().signal, observed, settings, now);
  assert.deepEqual(calls[0].args.p_input.lines, []);
  assert.deepEqual(calls[0].args.p_input.addresses, []);
  assert.equal(calls[0].args.p_input.sourceCurrency, 'XXX');
  assert.equal(calls[0].args.p_input.customer.shopifyCustomerGid, null);
  await store.recoverPartialEnvelope(partial, context, lease, new AbortController().signal, observed, settings, now + 900000);
  assert.equal(calls[1].name, 'recover_shopify_draft');
  assert.equal(calls[1].args.p_input.sourceDigest, calls[0].args.p_input.sourceDigest);
  await assert.rejects(() => store.importPartialEnvelope(partial, context, lease, new AbortController().signal, observed, settings, now + 900000), /ACCESS_DENIED/);
  assert.equal(calls.length, 2);
});
