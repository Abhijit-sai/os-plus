import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ChatwootAdminClient } from "../src/integrations/chatwoot/admin-client.ts";
test("mapped website inbox read is scoped and strips signing keys/provider scripts", async () => {
  let response = {
    id: 20,
    channel_type: "Channel::WebWidget",
    name: "Website",
    website_token: "synthetic_public_token_123",
    pre_chat_form_enabled: true,
    hmac_token: "PRIVATE_SIGNING_KEY",
    web_widget_script: "EVIL_PROVIDER_SCRIPT",
    api_key: "PRIVATE_API_KEY",
  };
  const calls = [];
  const server = createServer((req, res) => {
    calls.push(req.url);
    assert.equal(req.headers["api-access-token"], "synthetic-account-token");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(response));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new ChatwootAdminClient({
      origin: "http://127.0.0.1:" + server.address().port,
      token: "synthetic-account-token",
      allowLocalMock: true,
    });
    const value = await client.websiteInbox(12, 20);
    assert.deepEqual(value, {
      id: 20,
      name: "Website",
      websiteToken: "synthetic_public_token_123",
      preChatEnabled: true,
    });
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE|EVIL/);
    response = { ...response, id: 21 };
    await assert.rejects(client.websiteInbox(12, 20));
    response = { ...response, id: 20, channel_type: "Channel::Whatsapp" };
    await assert.rejects(client.websiteInbox(12, 20));
    assert.deepEqual(calls, Array(3).fill("/api/v1/accounts/12/inboxes/20"));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
