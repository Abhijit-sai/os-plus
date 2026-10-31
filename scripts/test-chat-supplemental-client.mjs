import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  approvedImage,
  ChatwootSupplementalClient,
} from "../src/integrations/chatwoot/supplemental-client.ts";
test("approved image transport bounds bytes/MIME/origin, uses multipart once, and rechecks approval after asset fetch", async () => {
  const saved = { ...process.env },
    png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
      "base64",
    );
  let posts = 0,
    fail = false;
  const server = createServer(async (req, res) => {
    if (req.url === "/price.png") {
      res.setHeader("Content-Type", "image/png");
      return res.end(png);
    }
    if (req.url === "/bad.png") {
      res.setHeader("Content-Type", "image/png");
      return res.end("not a png");
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "http://127.0.0.1:1/private" });
      return res.end();
    }
    if (req.url === "/large") {
      res.setHeader("Content-Type", "image/png");
      return res.end(Buffer.alloc(5_000_001));
    }
    let body = Buffer.alloc(0);
    for await (const b of req) body = Buffer.concat([body, b]);
    posts++;
    assert.match(
      req.headers["content-type"],
      /multipart\/form-data; boundary=/,
    );
    assert.match(body.toString(), /name="attachments\[\]"/);
    assert.ok(body.includes(png));
    if (fail) {
      res.writeHead(500);
      return res.end("{}");
    }
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: 900,
        conversation_id: 10,
        private: false,
        content: "Synthetic price list.",
        content_attributes: {
          osplus_public_outbox_id: "70000000-0000-4000-8000-000000000001",
        },
        attachments: [{ file_type: "image" }],
      }),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    Object.assign(process.env, {
      CHAT_ACTIONS_ENABLED: "true",
      CHAT_PUBLIC_REPLY_ENABLED: "true",
      CHAT_DRY_RUN: "false",
      CHAT_AGENT_MODEL_MODE: "mock",
      CHAT_MEDIA_ORIGINS: JSON.stringify([origin]),
    });
    assert.equal(
      (await approvedImage(origin + "/price.png", true)).type,
      "image/png",
    );
    for (const path of ["/bad.png", "/redirect", "/large"])
      await assert.rejects(approvedImage(origin + path, true));
    await assert.rejects(
      approvedImage("https://foreign.example.invalid/price.png", true),
    );
    const input = {
      accountId: 901,
      conversationId: 10,
      outboxId: "70000000-0000-4000-8000-000000000001",
      kind: "price_image",
      text: "Synthetic price list.",
      assetUrl: origin + "/price.png",
    };
    const denied = new ChatwootSupplementalClient({
      origin,
      token: "synthetic",
      allowLocalMock: true,
      beforePost: async () => {
        throw new Error("Approval revoked");
      },
    });
    await assert.rejects(denied.post(input), /revoked/);
    assert.equal(posts, 0);
    const client = new ChatwootSupplementalClient({
      origin,
      token: "synthetic",
      allowLocalMock: true,
    });
    for (const text of [
      "correlation_id leaked",
      "understanding_json leaked",
      "decision_json leaked",
      "stack trace leaked",
      "70000000-0000-4000-8000-000000000001",
    ]) {
      await assert.rejects(client.post({ ...input, text }));
    }
    assert.equal(posts, 0);
    assert.deepEqual(await client.post(input), { id: 900 });
    assert.equal(posts, 1);
    fail = true;
    await assert.rejects(client.post(input), /unconfirmed/);
    assert.equal(posts, 2);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
