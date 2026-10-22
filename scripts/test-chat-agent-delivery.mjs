import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
test("transport only creates a scoped private note with a provenance marker and honours dry-run at call time", async () => {
  const { ChatwootMessageClient } =
    await import("../src/integrations/chatwoot/message-client.ts");
  const saved = process.env.CHAT_DRY_RUN;
  process.env.CHAT_DRY_RUN = "false";
  let hits = 0,
    path,
    body;
  const server = createServer((req, res) => {
    hits++;
    path = req.url;
    let data = "";
    req.on("data", (b) => (data += b));
    req.on("end", () => {
      body = JSON.parse(data);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: 101,
          content: body.content,
          private: true,
          content_attributes: body.content_attributes,
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new ChatwootMessageClient({
      origin: "http://127.0.0.1:" + server.address().port,
      token: "synthetic-only",
      allowLocalMock: true,
    });
    const draftId = "65000000-0000-4000-8000-000000000001";
    assert.equal(
      (
        await client.postPrivateDraft({
          accountId: 901,
          conversationId: 10,
          draftId,
          text: "A safe synthetic draft.",
        })
      ).id,
      101,
    );
    assert.equal(path, "/api/v1/accounts/901/conversations/10/messages");
    assert.equal(body.private, true);
    assert.equal(body.message_type, "outgoing");
    assert.equal(body.content_attributes.osplus_draft_id, draftId);
    assert.equal(body.content.includes(draftId), false);
    process.env.CHAT_DRY_RUN = "true";
    await assert.rejects(
      client.postPrivateDraft({
        accountId: 901,
        conversationId: 10,
        draftId,
        text: "Never sent",
      }),
    );
    assert.equal(hits, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (saved === undefined) delete process.env.CHAT_DRY_RUN;
    else process.env.CHAT_DRY_RUN = saved;
  }
});

test("disabled agent avoids configuration reads and malformed local configuration does not undo a captured webhook", async () => {
  const { loadServerModule } =
    await import("./chat-db-harness/server-adapter.mjs");
  const saved = process.env.CHAT_AGENT_ENABLED;
  let reads = 0;
  const { processCapturedAgent } = loadServerModule(
    "src/features/chat/agent/worker.ts",
    {
      "node:crypto": {},
      zod: {},
      "@/lib/supabase/server": {},
      "../connection": {
        chatwootOrigin() {
          reads++;
          throw new Error("INVALID_PRIVATE_CONFIGURATION");
        },
      },
      "../secrets": {},
      "./mock-model": {},
      "./worker-core": {},
      "@/integrations/chatwoot/message-client": {},
    },
  );
  try {
    process.env.CHAT_AGENT_ENABLED = "false";
    await processCapturedAgent({});
    assert.equal(reads, 0);
    process.env.CHAT_AGENT_ENABLED = "true";
    await processCapturedAgent({});
    assert.equal(reads, 1);
  } finally {
    if (saved === undefined) delete process.env.CHAT_AGENT_ENABLED;
    else process.env.CHAT_AGENT_ENABLED = saved;
  }
});
