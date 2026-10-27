import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { TelegramClient } from "../src/integrations/telegram/client.ts";
test("mock Telegram sends once, checks the exact receipt and obeys call-time kill switches", async () => {
  const received = [];
  let mode = "ok";
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    received.push(JSON.parse(body));
    res.setHeader("Content-Type", "application/json");
    const sent = received.at(-1);
    res.end(
      JSON.stringify(
        mode === "oversize"
          ? { padding: "x".repeat(40000) }
          : {
              ok: true,
              result: {
                message_id: 19,
                chat: { id: mode === "wrong" ? 999 : Number(sent.chat_id) },
                text: sent.text,
              },
            },
      ),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { ...process.env };
  try {
    process.env.CHAT_FOUNDATION_ENABLED = "true";
    process.env.CHAT_NOTIFICATIONS_ENABLED = "true";
    process.env.CHAT_DRY_RUN = "false";
    process.env.CHAT_TELEGRAM_MOCK_ENABLED = "true";
    process.env.TELEGRAM_BOT_TOKEN = "12345:synthetic_only";
    const client = new TelegramClient({
      origin: "http://127.0.0.1:" + server.address().port,
      allowLocalMock: true,
    });
    assert.deepEqual(
      await client.send({ chatId: "-123", text: "Synthetic summary" }),
      { messageId: 19 },
    );
    assert.equal(received[0].parse_mode, undefined);
    assert.equal(received[0].link_preview_options.is_disabled, true);
    process.env.CHAT_NOTIFICATIONS_ENABLED = "false";
    await assert.rejects(client.send({ chatId: "-123", text: "Disabled" }));
    assert.equal(received.length, 1);
    process.env.CHAT_NOTIFICATIONS_ENABLED = "true";
    mode = "wrong";
    await assert.rejects(
      client.send({ chatId: "-123", text: "Wrong receipt" }),
      {
        message: "Telegram delivery unconfirmed. Do not resend automatically.",
      },
    );
    assert.equal(received.length, 2);
    mode = "oversize";
    await assert.rejects(client.send({ chatId: "-123", text: "Bounded" }));
    assert.equal(received.length, 3);
    await assert.rejects(
      client.send({ chatId: "-123", text: "x".repeat(4097) }),
    );
    assert.equal(received.length, 3);
    assert.throws(
      () =>
        new TelegramClient({
          origin: "https://example.invalid",
          allowLocalMock: true,
        }),
    );
    const live = new TelegramClient();
    await assert.rejects(live.send({ chatId: "123", text: "No live call" }));
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
