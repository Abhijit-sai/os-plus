import assert from "node:assert/strict";
import { createDecipheriv, createHash } from "node:crypto";
import { test } from "node:test";
import { createShopifyDraftStore } from "../src/integrations/shopify/draft-store.ts";
import {
  snapshot,
  context,
  lease,
  env,
  now,
  address,
} from "./fixtures/shopify-draft.mjs";

const testEnv = {
  ...env,
  SHOPIFY_DRAFT_IMPORT_ENABLED: "true",
  SHOPIFY_SOURCE_KEY_ID: "synthetic-v1",
  SHOPIFY_SOURCE_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const saved = {
  status: "draft",
  orderId: "50000000-0000-4000-8000-000000000001",
  sourceRevisionId: "60000000-0000-4000-8000-000000000001",
  tenantId: context.tenantId,
  customerId: null,
  customerResolution: "review",
  reasons: ["MAPPING_REQUIRED"],
  releaseEligible: false,
};
function harness(response = saved, error = null) {
  const calls = [];
  const store = createShopifyDraftStore({
    rpc(name, args) {
      calls.push({ name, args });
      return {
        abortSignal: async (signal) => {
          assert.ok(signal instanceof AbortSignal);
          return { data: response, error };
        },
      };
    },
  });
  const run = (
    value = snapshot(),
    settings = testEnv,
    tenantContext = context,
    jobLease = lease,
    signal = new AbortController().signal,
  ) =>
    store.importSnapshot(value, tenantContext, jobLease, signal, settings, now);
  const recover = (
    value = snapshot(),
    settings = testEnv,
    tenantContext = context,
    jobLease = lease,
    time = Date.parse(lease.leaseExpiresAt) + 1,
  ) =>
    store.recoverCommittedSnapshot(
      value,
      tenantContext,
      jobLease,
      new AbortController().signal,
      settings,
      time,
    );
  return { calls, run, recover, store };
}
test("validated source is encrypted with tenant/store/order-bound AAD; public result contains no source PII or money", async () => {
  const { run, calls } = harness();
  const value = snapshot();
  value.order.shippingAddress = address();
  assert.deepEqual(await run(value), saved);
  assert.equal(calls[0].name, "import_shopify_draft");
  const payload = calls[0].args.p_input;
  const packet = payload.sealedSource;
  assert.equal(JSON.stringify(packet).includes("Synthetic address"), false);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(testEnv.SHOPIFY_SOURCE_ENCRYPTION_KEY, "base64"),
    Buffer.from(packet.iv, "base64"),
  );
  decipher.setAAD(
    Buffer.from(
      JSON.stringify([
        payload.tenantId,
        payload.connectionId,
        payload.shopGid,
        payload.sourceOrderGid,
        payload.sourceDigest,
      ]),
    ),
  );
  decipher.setAuthTag(Buffer.from(packet.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(packet.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  assert.equal(
    createHash("sha256").update(plaintext).digest("hex"),
    payload.sourceDigest,
  );
  assert.equal(
    JSON.parse(plaintext).sourceSnapshot.order.shippingAddress.address1,
    "Synthetic address",
  );
  assert.equal(JSON.parse(plaintext).lines[0].colour.value, "Blue");
  assert.equal(JSON.stringify(saved).includes("118"), false);
});
test("resealing is random but normalized intent is stable; tampered tenant AAD cannot decrypt", async () => {
  const { run, calls } = harness();
  await run();
  await run();
  const [a, b] = calls.map((x) => x.args.p_input);
  assert.equal(a.sourceDigest, b.sourceDigest);
  assert.notEqual(a.sealedSource.iv, b.sealedSource.iv);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(testEnv.SHOPIFY_SOURCE_ENCRYPTION_KEY, "base64"),
    Buffer.from(a.sealedSource.iv, "base64"),
  );
  decipher.setAAD(
    Buffer.from(
      JSON.stringify([
        "foreign-tenant",
        a.connectionId,
        a.shopGid,
        a.sourceOrderGid,
        a.sourceDigest,
      ]),
    ),
  );
  decipher.setAuthTag(Buffer.from(a.sealedSource.tag, "base64"));
  decipher.update(Buffer.from(a.sealedSource.ciphertext, "base64"));
  assert.throws(() => decipher.final());
});
test("disabled flags, absent/invalid keys, preview, foreign/stale/partial snapshots and aborted calls never write", async () => {
  const { run, calls } = harness();
  for (const patch of [
    { SHOPIFY_DRAFT_IMPORT_ENABLED: "false" },
    { SHOPIFY_SOURCE_ENCRYPTION_KEY: undefined },
    { SHOPIFY_SOURCE_KEY_ID: "../bad" },
    { SHOPIFY_SOURCE_ENCRYPTION_KEY: "bad" },
    { VERCEL_ENV: "preview" },
  ])
    await assert.rejects(() => run(snapshot(), { ...testEnv, ...patch }));
  await assert.rejects(() => run({ ...snapshot(), completeness: "partial" }));
  await assert.rejects(() =>
    run({ ...snapshot(), tenantId: "10000000-0000-4000-8000-000000000002" }),
  );
  await assert.rejects(() =>
    run({ ...snapshot(), observedAt: "2026-10-08T11:00:00Z" }),
  );
  await assert.rejects(() =>
    run(snapshot(), testEnv, context, lease, AbortSignal.abort()),
  );
  assert.equal(calls.length, 0);
});
test("DB errors and malformed/cross-tenant responses are sanitized", async () => {
  for (const response of [
    { ...saved, tenantId: "10000000-0000-4000-8000-000000000002" },
    { ...saved, rawCustomer: "private" },
    { ...saved, releaseEligible: true },
  ])
    await assert.rejects(
      () => harness(response).run(),
      (error) =>
        error.code === "RESPONSE_INVALID" && !error.message.includes("private"),
    );
  await assert.rejects(
    () => harness(null, { message: "secret customer/token" }).run(),
    (error) => error.message === "UPSTREAM_UNAVAILABLE",
  );
});
test("expired lease and stale observation can recover an exact committed receipt through a read-only command", async () => {
  const { recover, calls, store } = harness();
  const expired = Date.parse(lease.leaseExpiresAt) + 1;
  await assert.rejects(
    () =>
      store.importSnapshot(
        snapshot(),
        context,
        lease,
        new AbortController().signal,
        testEnv,
        expired,
      ),
    (error) => error.code === "ACCESS_DENIED",
  );
  assert.equal(calls.length, 0);
  assert.deepEqual(await recover(), saved);
  assert.equal(calls[0].name, "recover_shopify_draft");
  assert.equal(await harness(null).recover(), null);
  const foreign = harness();
  await assert.rejects(() =>
    foreign.recover({
      ...snapshot(),
      tenantId: "10000000-0000-4000-8000-000000000002",
    }),
  );
  assert.equal(foreign.calls.length, 0);
});
