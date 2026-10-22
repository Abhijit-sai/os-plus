import { test } from "node:test";
import assert from "node:assert/strict";
test("fresh-chat mock launch is opt-in and cannot enable models or a remote Chatwoot", async () => {
  const { mockSuggestionEnvironment } =
    await import("./chat-local/mock-suggestions.mjs");
  assert.deepEqual(mockSuggestionEnvironment(false, {}), {});
  assert.throws(
    () => mockSuggestionEnvironment(true, {}),
    /owned local Chatwoot/,
  );
  assert.throws(
    () =>
      mockSuggestionEnvironment(true, {
        CHATWOOT_BASE_URL: "https://chat.example.com",
        CHATWOOT_BROWSER_ORIGIN: "http://localhost:4141",
      }),
    /owned local Chatwoot/,
  );
  const env = mockSuggestionEnvironment(true, {
    CHATWOOT_BASE_URL: "https://localhost:4444",
    CHATWOOT_BROWSER_ORIGIN: "http://localhost:4141",
    CHAT_WEBHOOK_ORIGIN: "https://osplus-bridge",
  });
  assert.equal(env.CHAT_AGENT_ENABLED, "true");
  assert.equal(env.CHAT_AGENT_MODEL_MODE, "mock");
  assert.equal(env.CHAT_DRAFT_DELIVERY_ENABLED, "true");
  assert.equal(env.CHAT_MODEL_LIVE_ENABLED, "false");
  assert.equal(env.OPENROUTER_API_KEY, "");
});
