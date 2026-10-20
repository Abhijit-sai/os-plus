import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeShopifyReference, buildShopifyImportWindow, classifyShopifyImport } from '../src/integrations/shopify/import-plan.ts';

const now = Date.parse('2026-10-19T12:00:00Z');
const tenant = '10000000-0000-4000-8000-000000000001';
const otherTenant = '20000000-0000-4000-8000-000000000002';
const shop = 'gid://shopify/Shop/100';
const gid = 'gid://shopify/Order/101';
const input = { tenantId: tenant, shopGid: shop, orderGid: gid, reference: '#PT2324' };
const local = (patch = {}) => ({ id: '30000000-0000-4000-8000-000000000003', tenantId: tenant,
  reference: 'PT2324', source: 'walk_in', deleted: false, shopGid: null, orderGid: null, ...patch });

test('references preserve punctuation, zeros and prefixes; only ASCII case, space and one # are normalized', () => {
  for (const value of ['PT2324', ' pt2324 ', '#PT2324', ' # PT2324 ']) assert.equal(normalizeShopifyReference(value), 'pt2324');
  for (const value of ['PT-2324', 'PT02324', '2324', 'PT 2324', '##PT2324']) assert.notEqual(normalizeShopifyReference(value), 'pt2324');
  assert.equal(normalizeShopifyReference('ÄPT'), 'Äpt', 'SQL parity must not depend on locale case folding');
  for (const value of [null, '', '  ', '#', '#   ']) assert.equal(normalizeShopifyReference(value), null);
  for (const value of ['x\ny', 'x\ty', 'x'.repeat(257)]) assert.throws(() => normalizeShopifyReference(value));
});

test('India dates are inclusive days, translated to exclusive UTC end', () => {
  const result = buildShopifyImportWindow({ from: '2026-10-17', through: '2026-10-18' }, now);
  assert.deepEqual(result, { from: '2026-10-17', through: '2026-10-18', timezone: 'Asia/Kolkata',
    start: '2026-10-16T18:30:00.000Z', endExclusive: '2026-10-18T18:30:00.000Z' });
  assert.equal(buildShopifyImportWindow({ from: '2024-02-29', through: '2024-02-29' }, Date.parse('2024-03-01T12:00:00Z')).endExclusive, '2024-02-29T18:30:00.000Z');
});

test('reject malformed/rollover dates, reverse ranges, future days and oversized ranges', () => {
  for (const from of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '26-10-18', '2026-10-18T00:00:00Z', '2026-10-18 OR id:1'])
    assert.throws(() => buildShopifyImportWindow({ from, through: '2026-10-18' }, now));
  for (const range of [{ from: '2026-10-18', through: '2026-10-17' }, { from: '2026-10-20', through: '2026-10-20' },
    { from: '2026-09-01', through: '2026-10-18' }, { from: '2026-08-01', through: '2026-08-02' }])
    assert.throws(() => buildShopifyImportWindow(range, now));
  assert.throws(() => buildShopifyImportWindow({ from: '2026-10-18', through: '2026-10-18' }, NaN));
  assert.throws(() => buildShopifyImportWindow({ from: '2026-10-18', through: '2026-10-18', tenantId: tenant }, now));
});

test('older orders require read_all_orders and a bounded date window', () => {
  const range = { from: '2025-01-01', through: '2025-01-02' };
  assert.throws(() => buildShopifyImportWindow(range, now), /ORDER_HISTORY_SCOPE_REQUIRED/);
  assert.equal(buildShopifyImportWindow(range, now, true).from, range.from);
});

test('today ends at the preview observation time, not future midnight', () => {
  assert.equal(buildShopifyImportWindow({ from: '2026-10-19', through: '2026-10-19' }, now).endExclusive, new Date(now).toISOString());
});

test('new order, existing immutable identity and matching manual Reference are different outcomes', () => {
  assert.deepEqual(classifyShopifyImport(input, []), { status: 'new', orderIds: [] });
  assert.deepEqual(classifyShopifyImport(input, [local()]), { status: 'reference_match', orderIds: [local().id] });
  assert.equal(classifyShopifyImport(input, [local({ shopGid: shop, orderGid: gid, reference: 'OLD-REFERENCE' })]).status, 'already_imported');
});

test('never compare references across tenants or confuse different Shopify stores', () => {
  assert.equal(classifyShopifyImport(input, [local({ tenantId: otherTenant })]).status, 'new');
  assert.equal(classifyShopifyImport(input, [local({ shopGid: 'gid://shopify/Shop/200', orderGid: gid })]).status, 'conflict');
  assert.equal(classifyShopifyImport(input, [local({ shopGid: shop, orderGid: 'gid://shopify/Order/202' })]).status, 'conflict');
});

test('deleted matches and ambiguous manual References are conflicts, never new imports', () => {
  assert.equal(classifyShopifyImport(input, [local({ deleted: true })]).status, 'conflict');
  assert.equal(classifyShopifyImport(input, [local(), local({ id: '40000000-0000-4000-8000-000000000004' })]).status, 'conflict');
  assert.equal(classifyShopifyImport(input, [local({ deleted: true, shopGid: shop, orderGid: gid })]).status, 'conflict');
});

test('known source identity wins over a changed reference; it must never create a second order', () => {
  const result = classifyShopifyImport(input, [local(), local({ id: '40000000-0000-4000-8000-000000000004', shopGid: shop, orderGid: gid })]);
  assert.equal(result.status, 'already_imported');
  assert.deepEqual(result.orderIds, ['40000000-0000-4000-8000-000000000004']);
});

test('missing references and corrupt bindings fail closed', () => {
  assert.equal(classifyShopifyImport({ ...input, reference: null }, []).status, 'conflict');
  assert.equal(classifyShopifyImport(input, [local({ shopGid: shop })]).status, 'conflict');
  assert.equal(classifyShopifyImport(input, [local({ source: 'shopify' })]).status, 'conflict');
  assert.throws(() => classifyShopifyImport({ ...input, tenantId: 'bad-id' }, []));
  assert.throws(() => classifyShopifyImport(input, [local({ deleted: 'false' })]));
});
