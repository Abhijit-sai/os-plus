import { test } from "node:test";
import assert from "node:assert/strict";
test("pre-chat numbers are explicit international unverified claims, never identity keys", async () => {
  const { websitePhoneClaim } =
    await import("../src/features/chat/website/rules.ts");
  assert.deepEqual(websitePhoneClaim("+91 90000 00001"), {
    value: "+919000000001",
    verified: false,
  });
  for (const value of [
    "9000000001",
    "not a phone",
    "+123",
    "+91<script>9000000001",
    null,
    "",
  ]) {
    assert.equal(websitePhoneClaim(value), null);
  }
});

test("widget code contains only public embed material and rejects unsafe origins or script input", async () => {
  const { websiteWidgetSnippet } =
    await import("../src/features/chat/website/rules.ts");
  const snippet = websiteWidgetSnippet({
    origin: "https://chat.example.invalid",
    websiteToken: "synthetic_public_token_123",
  });
  assert.match(snippet, /chatwootSDK.run/);
  assert.match(snippet, /packs\/js\/sdk.js/);
  assert.match(snippet, /synthetic_public_token_123/);
  assert.doesNotMatch(snippet, /api.access.token|hmac|accountId|tenantId/i);
  for (const origin of [
    "http://chat.example.invalid",
    "https://evil.invalid/path",
    "https://a:b@chat.invalid",
    "https://chat.invalid?token=x",
  ]) {
    assert.throws(() =>
      websiteWidgetSnippet({
        origin,
        websiteToken: "synthetic_public_token_123",
      }),
    );
  }
  assert.throws(() =>
    websiteWidgetSnippet({
      origin: "https://chat.example.invalid",
      websiteToken: "</script><script>alert(1)</script>",
    }),
  );
  assert.match(
    websiteWidgetSnippet({
      origin: "http://localhost:4141",
      websiteToken: "synthetic_public_token_123",
      allowLocal: true,
    }),
    /localhost:4141/,
  );
  assert.throws(() =>
    websiteWidgetSnippet({
      origin: "http://localhost:4141",
      websiteToken: "synthetic_public_token_123",
    }),
  );
});
