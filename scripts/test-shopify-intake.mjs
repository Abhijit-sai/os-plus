import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { createShopifyIntakeHandler } from "../src/integrations/shopify/intake-handler.ts";
import { createShopifyIntakeStore } from "../src/integrations/shopify/intake-store.ts";
import { connectionA, intakeEnv, orderGid, tenantB, deliveryRequest } from "./fixtures/shopify-intake.mjs";

const never = async () => assert.fail("Rejected input must not reach persistence");
const accepted = { status: "accepted", receiptId: randomUUID() };
const handler = (patch = {}, timeout = 4000) => createShopifyIntakeHandler({
  findConnection: async () => connectionA, receive: async () => accepted, ...patch,
}, timeout);
const assertError = async (response, status, error) => {
  assert.equal(response.status, status); assert.deepEqual(await response.json(), { error });
};

test("intake defaults off; local/preview/malformed configuration cannot access the database", async () => {
  const blocked = handler({ findConnection: never, receive: never });
  await assertError(await blocked(deliveryRequest(), {}), 503, "INTAKE_DISABLED");
  for (const patch of [{ SHOPIFY_INTAKE_ENABLED: "false" }, { SHOPIFY_INTAKE_ENABLED: "TRUE" }]) {
    await assertError(await blocked(deliveryRequest(), { ...intakeEnv, ...patch }), 503, "INTAKE_DISABLED");
  }
  for (const patch of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: undefined }, { VERCEL_ENV: "development" },
    { SHOPIFY_DEPLOYMENT_ENV: "preview" }, { SHOPIFY_API_VERSION: "2026-07" },
    { SHOPIFY_CLIENT_ID: "" }, { SHOPIFY_CLIENT_ID: "bad\n" }, { SHOPIFY_CLIENT_SECRET: "" }, { SHOPIFY_CLIENT_SECRET: "bad\n" }]) {
    await assertError(await blocked(deliveryRequest(), { ...intakeEnv, ...patch }), 503, "CONFIGURATION_INVALID");
  }
});

test("HMAC checks exact raw bytes before connection lookup or JSON interpretation", async () => {
  const blocked = handler({ findConnection: never });
  for (const signature of ["", "bad", "A".repeat(44), "A".repeat(43) + "=", "!".repeat(43) + "="]) {
    await assertError(await blocked(deliveryRequest("not-json", { headers: {
      "x-shopify-hmac-sha256": signature,
    } }), intakeEnv), 401, "ACCESS_DENIED");
  }
  const signed = deliveryRequest();
  const altered = deliveryRequest(` ${JSON.stringify({ admin_graphql_api_id: orderGid })}`, { headers: {
    "x-shopify-hmac-sha256": signed.headers.get("x-shopify-hmac-sha256"),
  } });
  await assertError(await blocked(altered, intakeEnv), 401, "ACCESS_DENIED");
});

for (const topic of ["orders/create", "orders/updated", "orders/cancelled"]) {
  test(`${topic} persists only IDs/hash; payload tenant/PII/numeric id cannot determine authority`, async () => {
    let saved;
    const response = await handler({ receive: async (binding, envelope) => {
      assert.equal(binding.tenant_id, connectionA.tenant_id); saved = envelope; return accepted;
    } })(deliveryRequest({ admin_graphql_api_id: orderGid, tenant_id: tenantB,
      id: 9007199254740993, customer: { name: "synthetic-private-name", phone: "synthetic-private-phone" } }, {
      headers: { "x-shopify-topic": topic },
    }), intakeEnv);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: "received" });
    assert.equal(saved.orderGid, orderGid); assert.equal(saved.topic, topic);
    assert.deepEqual(Object.keys(saved).sort(), ["apiVersion", "bodySha256", "deliveryId", "eventId", "orderGid", "topic", "triggeredAt"]);
    assert.doesNotMatch(JSON.stringify(saved), /synthetic-private|tenant_id|customer/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
}

test("malformed metadata, unsupported topics and precision-unsafe numeric-only IDs do not persist", async () => {
  const blocked = handler({ findConnection: never });
  for (const payload of ["not-json", [], {}, { id: 9007199254740993 },
    { admin_graphql_api_id: "gid://shopify/Customer/123" }, { admin_graphql_api_id: "gid://shopify/Order/0" }]) {
    await assertError(await blocked(deliveryRequest(payload), intakeEnv), 400, "REQUEST_INVALID");
  }
  for (const headers of [{ "x-shopify-topic": "refunds/create" }, { "x-shopify-topic": "orders/delete" },
    { "x-shopify-webhook-id": "" }, { "x-shopify-api-version": "2026-07" },
    { "x-shopify-event-id": "not-uuid" }, { "x-shopify-triggered-at": "yesterday" },
    { "content-encoding": "gzip" }, { "content-type": "text/plain" }]) {
    await assertError(await blocked(deliveryRequest(undefined, { headers }), intakeEnv), 400, "REQUEST_INVALID");
  }
  await assertError(await blocked(deliveryRequest(undefined, { headers: {
    "x-shopify-shop-domain": "safe.myshopify.com.evil.example",
  } }), intakeEnv), 400, "SHOP_DOMAIN_INVALID");
});

test("actual byte bound cancels oversized streams without touching persistence", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(Buffer.alloc(2 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; } });
  const req = deliveryRequest();
  const oversized = new Request(req.url, { method: "POST", headers: req.headers, body: stream, duplex: "half" });
  await assertError(await handler({ findConnection: never })(oversized, intakeEnv), 413, "BODY_TOO_LARGE");
  assert.equal(cancelled, true); assert.equal(stream.locked, false);
});
test("oversized stream with stalled cancellation still returns a bounded failure", async () => {
  let release; let response;
  const cancellation = new Promise(resolve => { release = resolve; });
  const stream = new ReadableStream({ start(c) { c.enqueue(Buffer.alloc(2 * 1024 * 1024 + 1)); },
    cancel() { return cancellation; } });
  const req = deliveryRequest();
  const oversized = new Request(req.url, { method: "POST", headers: req.headers, body: stream, duplex: "half" });
  const running = handler({ findConnection: never }, 10)(oversized, intakeEnv).then(result => { response = result; return result; });
  await new Promise(resolve => setTimeout(resolve, 100));
  try {
    assert.ok(response, "Cancellation cleanup must not hold the HTTP failure past its deadline");
    await assertError(response, 413, "BODY_TOO_LARGE");
    assert.equal(stream.locked, false);
  } finally {
    release(); await running;
  }
});

test("unknown/inactive/foreign-app/foreign-domain/unverified connections cannot enqueue", async () => {
  for (const connection of [null, { ...connectionA, tenant_id: "not-uuid" },
    { ...connectionA, environment: "development" }, { ...connectionA, status: "disconnected" },
    { ...connectionA, intake_enabled: false }, { ...connectionA, verified_at: null },
    { ...connectionA, app_ref: "foreign-app" }, { ...connectionA, canonical_domain: "foreign.myshopify.com" }]) {
    await assertError(await handler({ findConnection: async () => connection, receive: never })(deliveryRequest(), intakeEnv),
      503, "CONNECTION_UNAVAILABLE");
  }
});

test("acknowledgement waits for durable commit; failed commit never acknowledges success", async () => {
  let commit; let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const committed = new Promise(resolve => { commit = resolve; });
  let settled = false;
  const result = handler({ receive: async () => { entered(); return committed; } })(deliveryRequest(), intakeEnv)
    .then(response => { settled = true; return response; });
  await waiting; assert.equal(settled, false);
  commit(accepted); assert.equal((await result).status, 200);
  const failure = await handler({ receive: async () => { throw new Error("synthetic-private-db-error"); } })(deliveryRequest(), intakeEnv);
  await assertError(failure, 503, "UPSTREAM_UNAVAILABLE");
});

test("duplicate is acknowledged without exposing IDs; conflicting delivery is not acknowledged", async () => {
  assert.deepEqual(await (await handler({ receive: async () => ({ ...accepted, status: "duplicate" }) })(deliveryRequest(), intakeEnv)).json(),
    { status: "received" });
  await assertError(await handler({ receive: async () => ({ ...accepted, status: "conflict" }) })(deliveryRequest(), intakeEnv),
    409, "DELIVERY_CONFLICT");
});

test("bounded deadline cancels a stalled raw body and aborts database work", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const req = deliveryRequest();
  const slowBody = new Request(req.url, { method: "POST", headers: req.headers, body: stream, duplex: "half" });
  await assertError(await handler({ findConnection: never }, 10)(slowBody, intakeEnv), 503, "UPSTREAM_UNAVAILABLE");
  assert.equal(cancelled, true); assert.equal(stream.locked, false);
  for (const stage of ["findConnection", "receive"]) {
    let signal;
    const stalled = async (...args) => { signal = args.at(-1); return new Promise(() => undefined); };
    await assertError(await handler({ [stage]: stalled }, 10)(deliveryRequest(), intakeEnv), 503, "UPSTREAM_UNAVAILABLE");
    assert.equal(signal.aborted, true);
  }
});

test("caller abort is honored and invalid deadlines/methods fail closed", async () => {
  const controller = new AbortController(); controller.abort();
  await assertError(await handler({ findConnection: never })(deliveryRequest(undefined, { signal: controller.signal }), intakeEnv),
    503, "UPSTREAM_UNAVAILABLE");
  for (const timeout of [0, -1, 4001, Infinity]) assert.throws(() => handler({}, timeout));
  await assertError(await handler()(new Request("https://synthetic-osplus.example"), intakeEnv), 405, "METHOD_NOT_ALLOWED");
});

test("unexpected persistence output/errors never expose private data or print logs", async t => {
  const logs = [];
  for (const name of ["log", "warn", "error"]) t.mock.method(console, name, (...args) => logs.push(args));
  for (const patch of [{ findConnection: async () => { throw new Error("synthetic-private-secret"); } },
    { receive: async () => ({ status: "order-created", secret: "synthetic-private-secret" }) }]) {
    await assertError(await handler(patch)(deliveryRequest(), intakeEnv), 503, "UPSTREAM_UNAVAILABLE");
  }
  assert.deepEqual(logs, []);
});

function fakeDb(rows = [connectionA], result = accepted, failure = null) {
  const calls = [];
  const query = {
    select(value) { calls.push(["select", value]); return query; },
    eq(key, value) { calls.push(["eq", key, value]); return query; },
    in(key, value) { calls.push(["in", key, value]); return query; },
    limit(value) { calls.push(["limit", value]); return query; },
    async abortSignal(signal) { calls.push(["abort", signal]); return { data: rows, error: failure }; },
  };
  return { calls, db: {
    from(table) { calls.push(["from", table]); return query; },
    rpc(name, args) { calls.push(["rpc", name, args]); return {
      async abortSignal(signal) { calls.push(["abort", signal]); return { data: result, error: failure }; },
    }; },
  } };
}
test("real Supabase store selects only the exact app/domain/environment, fails ambiguity, and uses atomic RPC", async () => {
  const { calls, db } = fakeDb();
  const signal = new AbortController().signal; const store = createShopifyIntakeStore(db);
  const binding = await store.findConnection(connectionA.canonical_domain, connectionA.app_ref, signal);
  assert.deepEqual(binding, connectionA);
  for (const filter of [["eq", "canonical_domain", connectionA.canonical_domain], ["eq", "app_ref", connectionA.app_ref],
    ["eq", "environment", "production"], ["eq", "intake_enabled", true], ["limit", 2]]) {
    assert.ok(calls.some(value => JSON.stringify(value) === JSON.stringify(filter)));
  }
  const envelope = { topic: "orders/create", deliveryId: randomUUID(), eventId: null, triggeredAt: null,
    apiVersion: "2026-10", bodySha256: "a".repeat(64), orderGid };
  assert.deepEqual(await store.receive(binding, envelope, signal), accepted);
  const [, name, args] = calls.find(value => value[0] === "rpc");
  assert.equal(name, "receive_shopify_event"); assert.equal(args.p_tenant_id, connectionA.tenant_id);
  assert.equal(args.p_connection_id, connectionA.id); assert.equal(args.p_expected_revision, 1);
  assert.equal(args.p_order_gid, orderGid); assert.equal(args.p_environment, "production");
  for (const rows of [[], [connectionA, connectionA], [{ ...connectionA, tenant_id: "bad" }]]) {
    assert.equal(await createShopifyIntakeStore(fakeDb(rows).db).findConnection(connectionA.canonical_domain, connectionA.app_ref, signal), null);
  }
  await assert.rejects(() => createShopifyIntakeStore(fakeDb(null, null, { message: "synthetic-private" }).db)
    .findConnection(connectionA.canonical_domain, connectionA.app_ref, signal), error => !String(error).includes("synthetic-private"));
});

test("foundation remains ID-only and application exposes only exact authenticated ingress exceptions", async () => {
  assert.equal(existsSync(new URL("../src/app/api/integrations/shopify/webhooks/route.ts", import.meta.url)), false);
  const {assertShopifyProxyBoundary}=await import('./fixtures/shopify-proxy-contract.mjs');await assertShopifyProxyBoundary();
  for (const file of ["intake-handler.ts", "intake-store.ts"]) {
    assert.doesNotMatch(readFileSync(new URL(`../src/integrations/shopify/${file}`, import.meta.url), "utf8"),
      /sendWhatsApp|sendSms|order_payments|create_order|release_shopify_order/);
  }
});
