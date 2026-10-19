import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createShopifyImportPreviewReader } from '../src/integrations/shopify/import-preview.ts';

const tenantId = '10000000-0000-4000-8000-000000000001';
const actor = { userId: 'owner', tenantId, role: 'owner_admin', membershipUserId: 'owner', membershipTenantId: tenantId,
  membershipStatus: 'active', tenantStatus: 'active' };
const shop = { id: 'gid://shopify/Shop/100', myshopifyDomain: 'fictional-import.myshopify.com' };
const env = { VERCEL_ENV: 'production', SHOPIFY_DEPLOYMENT_ENV: 'production', SHOPIFY_API_VERSION: '2026-10',
  SHOPIFY_CONNECTION_SCREEN_ENABLED: 'true', SHOPIFY_PILOT_OPERATIONS_ENABLED: 'true', SHOPIFY_CONNECTION_TEST_TENANT_ID: tenantId,
  SHOPIFY_SHOP_DOMAIN: shop.myshopifyDomain, SHOPIFY_APPLICATION_ORIGIN: 'https://example.invalid',
  SHOPIFY_CLIENT_ID: 'fictional-client', SHOPIFY_CLIENT_SECRET: 'fictional-secret' };
const stamp = Date.parse('2026-10-19T12:00:00Z');
const range = { from: '2026-10-18', through: '2026-10-18' };
const order = (id, patch = {}) => ({ id: `gid://shopify/Order/${id}`, name: `#PT${id}`,
  createdAt: '2026-10-18T05:00:00Z', updatedAt: '2026-10-18T06:00:00Z', cancelledAt: null,
  displayFinancialStatus: 'PAID', currentTotalPriceSet: { shopMoney: { amount: '3902.20', currencyCode: 'INR' } }, ...patch });
const page = (nodes, next = null) => ({ nodes, pageInfo: { hasNextPage: next !== null, endCursor: next } });
function fixture(pages, { metadataShop = shop, scopes = ['read_orders', 'read_customers', 'read_products'], maxPages = 20 } = {}) {
  const calls = [];
  const transport = async (url, init) => {
    assert.equal(new URL(url).hostname, shop.myshopifyDomain);
    if (url.endsWith('/admin/oauth/access_token')) return Response.json({ access_token: 'fictional-token', expires_in: 3600, scope: 'read_orders,read_customers,read_products' });
    const request = JSON.parse(init.body); calls.push(request);
    assert.match(request.query, /^query /); assert.doesNotMatch(request.query, /customer|email|phone|shippingAddress|mutation/i);
    const data = request.query.includes('OSPlusImportScope') ? { shop: metadataShop, currentAppInstallation: { accessScopes: scopes.map(handle => ({ handle })) } }
      : { shop, orders: pages.shift() };
    return Response.json({ data }, { headers: { 'X-Shopify-API-Version': '2026-10' } });
  };
  const read = createShopifyImportPreviewReader(transport, () => stamp, maxPages);
  return { calls, run: (dates = range, selected = actor, signal = new AbortController().signal) => read(selected, shop.id, dates, signal, env) };
}

test('preview follows every page with a fixed India date query and returns only minimal source facts', async () => {
  const f = fixture([page([order(101)], 'cursor-1'), page([order(102)])]);
  const result = await f.run();
  assert.equal(result.complete, true); assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].reference, '#PT101'); assert.equal(result.rows[0].amount, '3902.20');
  assert.equal(result.rows[0].currency, 'INR'); assert.equal(result.window.timezone, 'Asia/Kolkata');
  const calls = f.calls.filter(c => c.query.includes('OSPlusImportOrders'));
  assert.deepEqual(calls.map(c => c.variables.after), [null, 'cursor-1']);
  assert.equal(calls[0].variables.search, "created_at:>='2026-10-17T18:30:00.000Z' created_at:<'2026-10-18T18:30:00.000Z'");
  assert.equal(calls[0].variables.search, calls[1].variables.search);
  assert.match(calls[0].query, /sortKey: CREATED_AT/);
  assert.doesNotMatch(JSON.stringify(result), /fictional-token|fictional-secret|accessScopes/);
});

test('zero results are a complete empty preview; cancellations and refunds remain visible', async () => {
  assert.deepEqual((await fixture([page([])]).run()).rows, []);
  const result = await fixture([page([order(101, { cancelledAt: '2026-10-18T07:00:00Z', displayFinancialStatus: 'REFUNDED' })])]).run();
  assert.equal(result.rows[0].financialStatus, 'REFUNDED'); assert.ok(result.rows[0].cancelledAt);
});

test('bounded pagination explicitly reports incomplete; it never pretends the first page is all orders', async () => {
  const result = await fixture([page([order(101)], 'more')], { maxPages: 1 }).run();
  assert.equal(result.complete, false); assert.equal(result.reason, 'NARROW_DATE_RANGE');
});

test('duplicate IDs, looping cursors, empty progressing pages and out-of-range records reject the entire preview', async () => {
  const cases = [
    [page([order(101)], 'one'), page([order(101)])],
    [page([order(101)], 'one'), page([order(102)], 'one')],
    [page([], 'one')],
    [page([order(101, { createdAt: '2026-10-18T18:30:00Z' })])],
    [page([order(101, { createdAt: '2026-10-17T18:29:59Z' })])],
    [page([order(101, { updatedAt: '2026-10-17T18:30:00Z' })])],
  ];
  for (const pages of cases) await assert.rejects(() => fixture(pages).run(), /RESPONSE_INVALID/);
});

test('scope and exact shop binding are checked before querying orders', async () => {
  for (const opts of [{ metadataShop: { ...shop, id: 'gid://shopify/Shop/200' } }, { scopes: ['read_products'] }]) {
    const f = fixture([], opts); await assert.rejects(() => f.run(), /ACCESS_DENIED/);
    assert.equal(f.calls.length, 1);
  }
  const f = fixture([]); await assert.rejects(() => f.run({ from: '2025-01-01', through: '2025-01-02' }), /ORDER_HISTORY_SCOPE_REQUIRED/);
  assert.equal(f.calls.length, 1);
});

test('manager, foreign tenant and malformed date inputs never start Shopify reads', async () => {
  for (const selected of [{ ...actor, role: 'manager' }, { ...actor, tenantId: '20000000-0000-4000-8000-000000000002' }]) {
    const f = fixture([]); await assert.rejects(() => f.run(range, selected), /ACCESS_DENIED/); assert.equal(f.calls.length, 0);
  }
  const f = fixture([]); await assert.rejects(() => f.run({ ...range, from: '2026-04-31' })); assert.equal(f.calls.length, 0);
  await assert.rejects(() => f.run(range, actor, AbortSignal.abort())); assert.equal(f.calls.length, 0);
});
