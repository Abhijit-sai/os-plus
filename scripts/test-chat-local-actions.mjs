import { test } from "node:test";
import assert from "node:assert/strict";
import { mockActionEnvironment } from "./chat-local/mock-actions.mjs";
test("mock actions need explicit owned transport and suggestions; defaults remain off with no automatic channel approval", () => {
  const env = {
    CHATWOOT_BASE_URL: "https://localhost:4444",
    CHATWOOT_BROWSER_ORIGIN: "http://localhost:4141",
    CHAT_WEBHOOK_ORIGIN: "https://osplus-bridge",
  };
  assert.equal(
    mockActionEnvironment(false, false, {}).CHAT_ACTIONS_ENABLED,
    "false",
  );
  assert.throws(() => mockActionEnvironment(true, false, env));
  assert.throws(() =>
    mockActionEnvironment(true, true, {
      ...env,
      CHATWOOT_BASE_URL: "https://remote.invalid",
    }),
  );
  assert.deepEqual(mockActionEnvironment(true, true, env), {
    CHAT_ACTIONS_ENABLED: "true",
    CHAT_PUBLIC_REPLY_ENABLED: "true",
    CHAT_MEDIA_ORIGINS: '["https://localhost:4444"]',
  });
});
