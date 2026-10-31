import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ChatwootPublicClient } from "../src/integrations/chatwoot/public-client.ts";
test("local public transport requires explicit flags, validates public receipt and never retries uncertain sends", async () => {
  const previous = { ...process.env };
  let calls = 0;
  const server = createServer(async (req, res) => {
    calls++;
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    assert.equal(body.private, false);
    assert.equal(body.content, "Synthetic response.");
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: 2,
        conversation_id: 4,
        private: false,
        content: body.content,
        content_attributes: body.content_attributes,
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const client = new ChatwootPublicClient({
      origin,
      token: "synthetic",
      allowLocalMock: true,
    });
    const input = {
      accountId: 1,
      conversationId: 4,
      outboxId: "70000000-0000-4000-8000-000000000001",
      text: "Synthetic response.",
    };
    await assert.rejects(client.post(input), /disabled/);
    assert.equal(calls, 0);
    Object.assign(process.env, {
      CHAT_ACTIONS_ENABLED: "true",
      CHAT_PUBLIC_REPLY_ENABLED: "true",
      CHAT_DRY_RUN: "false",
      CHAT_AGENT_MODEL_MODE: "mock",
    });
    assert.deepEqual(await client.post(input), { id: 2 });
    assert.equal(calls, 1);
    await assert.rejects(client.post({ ...input, text: "tenant_id leaked" }));
    assert.equal(calls, 1);
    assert.throws(
      () =>
        new ChatwootPublicClient({
          origin: "https://remote.example.invalid",
          token: "synthetic",
        }),
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
