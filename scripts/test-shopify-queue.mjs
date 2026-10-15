import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopifyQueueStore } from "../src/integrations/shopify/queue-store.ts";
import { tenantA, tenantB, connectionA, orderGid } from "./fixtures/shopify-intake.mjs";

const binding = { tenantId: tenantA, connectionId: connectionA.id, environment: "production", appRef: "synthetic-app" };
const lease = { jobId: "30000000-0000-4000-8000-000000000001", tenantId: tenantA, connectionId: connectionA.id,
  orderGid, generation: 1, connectionRevision: 2, leaseToken: "40000000-0000-4000-8000-000000000001",
  leaseExpiresAt: "2026-10-08T12:00:00Z" };
const signal = new AbortController().signal;
function fake(response) {
  const calls = [];
  const store = createShopifyQueueStore({ rpc(name, args) {
    calls.push({ name, args }); return { abortSignal(actual) { assert.equal(actual, signal); return Promise.resolve(response); } };
  } });
  return { store, calls };
}
test("claim sends exact trusted tenant/environment/app and preserves string GID/fence", async () => {
  const { store, calls } = fake({ data: [lease], error: null });
  assert.deepEqual(await store.claim(binding, 10, signal), [lease]);
  assert.deepEqual(calls, [{ name: "claim_shopify_jobs", args: { p_tenant_id: tenantA, p_connection_id: connectionA.id,
    p_environment: "production", p_app_ref: "synthetic-app", p_limit: 10 } }]);
});
test("claim rejects foreign, duplicate, unsafe and unexpected rows without raw error disclosure", async () => {
  for (const data of [[{ ...lease, tenantId: tenantB }], [lease, lease], [{ ...lease, generation: Number.MAX_SAFE_INTEGER + 1 }],
    [{ ...lease, orderGid: 9007199254740993 }], [{ ...lease, extraPrivatePayload: 'private' }], null]) {
    await assert.rejects(() => fake({ data, error: null }).store.claim(binding, 10, signal), error => error.code === "RESPONSE_INVALID");
  }
  await assert.rejects(() => fake({ data: null, error: { message: "private secret" } }).store.claim(binding, 10, signal), error =>
    error.code === "UPSTREAM_UNAVAILABLE" && !JSON.stringify(error).includes("private secret"));
  const { store, calls } = fake({ data: [], error: null });
  for (const limit of [0,11,1.5,NaN]) await assert.rejects(() => store.claim(binding, limit, signal));
  assert.equal(calls.length, 0);
});
test("renew/fail carries whole lease fence, safe code and bounded Retry-After; false means lost lease", async () => {
  const { store, calls } = fake({ data: false, error: null });
  assert.equal(await store.update(binding, lease, "fail", "THROTTLED", 1800, signal), false);
  assert.deepEqual(calls[0], { name: "update_shopify_job_lease", args: { p_tenant_id: tenantA, p_connection_id: connectionA.id,
    p_environment: "production", p_app_ref: "synthetic-app", p_job_id: lease.jobId, p_lease_token: lease.leaseToken,
    p_generation: 1, p_connection_revision: 2, p_action: "fail", p_error_code: "THROTTLED", p_retry_after_seconds: 1800 } });
  assert.equal(await fake({ data: true, error: null }).store.update(binding, lease, "renew", null, null, signal), true);
  await assert.rejects(() => fake({ data: 'true', error: null }).store.update(binding, lease, "renew", null, null, signal), error => error.code === "RESPONSE_INVALID");
});
test("foreign lease, private error text, invalid renewal/failure and retry delay rejected before RPC", async () => {
  const { store, calls } = fake({ data: true, error: null });
  for (const args of [[{ ...lease, tenantId: tenantB }, "renew", null, null], [lease,"fail","private response",null],
    [lease,"renew","TRANSIENT",null], [lease,"fail",null,null], [lease,"fail","TRANSIENT",1],
    [lease,"fail","THROTTLED",86401], [lease,"renew",null,60]]) {
    await assert.rejects(() => store.update(binding,...args,signal), error => error.code === "ACCESS_DENIED");
  }
  assert.equal(calls.length, 0);
});
