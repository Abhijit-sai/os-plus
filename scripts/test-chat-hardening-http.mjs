import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { OpenRouterClient } from "../src/integrations/openrouter/client.ts";
import { ChatwootMessageClient } from "../src/integrations/chatwoot/message-client.ts";
import { TelegramClient } from "../src/integrations/telegram/client.ts";
const flags = {
  CHAT_FOUNDATION_ENABLED: "true",
  CHAT_NOTIFICATIONS_ENABLED: "true",
  CHAT_DRY_RUN: "false",
  CHAT_TELEGRAM_MOCK_ENABLED: "true",
  CHAT_TELEGRAM_LIVE_ENABLED: "false",
  CHAT_MODEL_LIVE_ENABLED: "false",
  CHAT_DRAFT_DELIVERY_ENABLED: "false",
  TELEGRAM_BOT_TOKEN: "123:synthetic_token_only",
};
const prior = Object.fromEntries(
  Object.keys(flags).map((key) => [key, process.env[key]]),
);
before(() => Object.assign(process.env, flags));
after(() => {
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
async function endpoint(fault, work) {
  const received = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({ path: req.url, body: JSON.parse(body) });
    if (fault === "socket_loss") {
      req.socket.destroy();
      return;
    }
    if (fault === "timeout") return;
    res.writeHead(fault === "unavailable" ? 503 : 200, {
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify({
        error: "PRIVATE_FAILURE_SENTINEL synthetic_token_only",
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await work("http://127.0.0.1:" + server.address().port, received);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
const modelInput = {
  model: "synthetic-model",
  provider: "synthetic-provider",
  system: "Synthetic guard",
  user: "Synthetic inquiry",
  maxTokens: 32,
  timeoutMs: 120,
  maxPrice: { prompt: 0, completion: 0, request: 0 },
};
const transports = {
  model: (origin) =>
    new OpenRouterClient({
      token: "synthetic_token_only",
      origin,
      allowLocalMock: true,
    }).complete(modelInput),
  chatwoot: (origin) =>
    new ChatwootMessageClient({
      token: "synthetic_token_only",
      origin,
      allowLocalMock: true,
    }).postPrivateDraft({
      accountId: 901,
      conversationId: 40,
      draftId: "73000000-0000-4000-8000-000000000090",
      text: "Synthetic private draft",
    }),
  telegram: (origin) =>
    new TelegramClient({ origin, allowLocalMock: true }).send({
      chatId: "123",
      text: "Synthetic staff alert",
    }),
};
for (const [transport, send] of Object.entries(transports))
  for (const fault of [
    "unavailable",
    "socket_loss",
    "invalid_receipt",
    "timeout",
  ])
    test(
      "CH10 actual loopback " + transport + "/" + fault,
      { timeout: 15000 },
      async () => {
        await endpoint(fault, async (origin, received) => {
          await assert.rejects(send(origin), (error) => {
            assert.ok(!String(error).includes("PRIVATE_FAILURE_SENTINEL"));
            assert.ok(!String(error).includes("synthetic_token_only"));
            assert.ok(!String(error).includes(origin));
            return true;
          });
          assert.equal(received.length, 1, "Ambiguous sends must not retry");
          if (transport === "chatwoot")
            assert.equal(received[0].body.private, true);
          if (transport === "model")
            assert.equal(received[0].body.provider.allow_fallbacks, false);
        });
      },
    );
test("CH10 changing dry-run flag blocks already-created adapters before any HTTP request", async () => {
  await endpoint("unavailable", async (origin, received) => {
    const chat = new ChatwootMessageClient({
      origin,
      token: "synthetic_token_only",
      allowLocalMock: true,
    });
    const telegram = new TelegramClient({ origin, allowLocalMock: true });
    process.env.CHAT_DRY_RUN = "true";
    try {
      await assert.rejects(
        chat.postPrivateDraft({
          accountId: 901,
          conversationId: 40,
          draftId: "73000000-0000-4000-8000-000000000090",
          text: "Synthetic draft",
        }),
      );
      await assert.rejects(
        telegram.send({ chatId: "123", text: "Synthetic alert" }),
      );
      assert.equal(received.length, 0);
    } finally {
      process.env.CHAT_DRY_RUN = "false";
    }
  });
});
test("CH10 live model adapter stays disabled without issuing a request", async () => {
  const live = new OpenRouterClient({ token: "synthetic_token_only" });
  const originalFetch = globalThis.fetch;
  let requests = 0;
  // This gate test must remain offline even if the production guard regresses.
  globalThis.fetch = async () => {
    requests++;
    throw new Error("External network forbidden in this offline gate test");
  };
  try {
    await assert.rejects(live.complete(modelInput), /Model call unavailable/);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
