import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import {
  encryptChatSecret,
  decryptChatSecret,
} from "../src/features/chat/secrets.ts";
const context = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  workspaceId: "10000000-0000-4000-8000-000000000002",
  purpose: "account_token",
};
test("secrets round-trip with random nonces and authenticate their tenant, workspace and purpose", () => {
  process.env.CHAT_SECRETS_ACTIVE_VERSION = "v1";
  process.env.CHAT_SECRETS_KEYS = JSON.stringify({
    v1: randomBytes(32).toString("base64"),
  });
  const first = encryptChatSecret("synthetic-token", context);
  const second = encryptChatSecret("synthetic-token", context);
  assert.notEqual(first, second);
  assert.ok(!first.includes("synthetic-token"));
  assert.equal(decryptChatSecret(first, context), "synthetic-token");
  for (const wrong of [
    { tenantId: "10000000-0000-4000-8000-000000000003" },
    { workspaceId: "10000000-0000-4000-8000-000000000003" },
    { purpose: "bot_token" },
  ]) {
    assert.throws(
      () => decryptChatSecret(first, { ...context, ...wrong }),
      /Chat secret unavailable/,
    );
  }
});

test("rotation preserves old envelopes until revocation and rejects tampering without leaking errors", () => {
  const oldKey = randomBytes(32).toString("base64"),
    newKey = randomBytes(32).toString("base64");
  process.env.CHAT_SECRETS_KEYS = JSON.stringify({ v1: oldKey });
  process.env.CHAT_SECRETS_ACTIVE_VERSION = "v1";
  const oldEnvelope = encryptChatSecret("private-value", context);
  process.env.CHAT_SECRETS_KEYS = JSON.stringify({ v1: oldKey, v2: newKey });
  process.env.CHAT_SECRETS_ACTIVE_VERSION = "v2";
  const next = encryptChatSecret("private-value", context);
  assert.match(next, /^gcm1\.v2\./);
  assert.equal(decryptChatSecret(oldEnvelope, context), "private-value");
  const parts = next.split(".");
  const bytes = Buffer.from(parts[4], "base64url");
  bytes[0] ^= 1;
  parts[4] = bytes.toString("base64url");
  for (const malformed of [
    parts.join("."),
    next.replace(".v2.", ".v99."),
    "invalid",
    next + ".extra",
  ]) {
    assert.throws(() => decryptChatSecret(malformed, context), {
      message: "Chat secret unavailable.",
    });
  }
  process.env.CHAT_SECRETS_KEYS = JSON.stringify({ v2: newKey });
  assert.throws(() => decryptChatSecret(oldEnvelope, context), {
    message: "Chat secret unavailable.",
  });
  delete process.env.CHAT_SECRETS_KEYS;
  assert.throws(() => encryptChatSecret("private-value", context), {
    message: "Chat secret unavailable.",
  });
});
