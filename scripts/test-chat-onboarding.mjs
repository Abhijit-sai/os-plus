import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { ChatwootAdminClient } from "../src/integrations/chatwoot/admin-client.ts";
import { provisionChatwootTransport } from "../src/integrations/chatwoot/onboarding.ts";
const config = {
  accountId: 12,
  name: "Synthetic assistant",
  eventsUrl: "https://app.example.invalid/events?token=synthetic",
  agentUrl: "https://app.example.invalid/agent?token=synthetic",
  inboxes: [
    { id: 4, mode: "draft" },
    { id: 5, mode: "off" },
  ],
};
async function scenario(run, loseBotResponse = false) {
  const bots = [],
    hooks = [],
    attachments = new Map(),
    receipts = new Map(),
    writes = [];
  const faults = { botReads: 0, webhookReads: 0 };
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    const input = body ? JSON.parse(body) : null;
    const failedRead = req.url.endsWith("agent_bots")
      ? "botReads"
      : "webhookReads";
    if (req.method === "GET" && faults[failedRead] > 0) {
      faults[failedRead]--;
      res.statusCode = 503;
      res.end("{}");
      return;
    }
    assert.equal(req.headers["api-access-token"], "synthetic-only");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") writes.push(req.url);
    if (req.url === "/platform/api/v1/agent_bots") {
      if (req.method === "POST") {
        bots.push({
          id: 31,
          name: input.name,
          account_id: input.account_id,
          outgoing_url: input.outgoing_url,
          access_token: "synthetic-bot-token",
        });
        if (loseBotResponse) {
          loseBotResponse = false;
          req.socket.destroy();
          return;
        }
        res.end(JSON.stringify(bots.at(-1)));
      } else res.end(JSON.stringify(bots));
    } else if (req.url === "/api/v1/accounts/12/webhooks") {
      if (req.method === "POST") hooks.push({ id: 41, ...input.webhook });
      res.end(
        JSON.stringify(
          req.method === "POST"
            ? { payload: { webhook: hooks.at(-1) } }
            : { payload: { webhooks: hooks } },
        ),
      );
    } else if (req.url.endsWith("/agent_bot")) {
      const inbox = Number(req.url.split("/").at(-2));
      res.end(
        JSON.stringify({
          agent_bot: attachments.has(inbox)
            ? { id: attachments.get(inbox) }
            : undefined,
        }),
      );
    } else if (req.url.endsWith("/set_agent_bot")) {
      attachments.set(Number(req.url.split("/").at(-2)), input.agent_bot);
      res.end();
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const client = new ChatwootAdminClient({
    origin: "http://127.0.0.1:" + server.address().port,
    token: "synthetic-only",
    allowLocalMock: true,
  });
  const store = {
    async assertWrite(stage) {
      assert.equal(receipts.get(stage), null);
    },
    async begin(stage) {
      if (receipts.has(stage))
        return { started: false, completedId: receipts.get(stage) };
      receipts.set(stage, null);
      return { started: true, completedId: null };
    },
    async complete(stage, id) {
      assert.ok(receipts.has(stage));
      receipts.set(stage, id);
    },
  };
  try {
    await run({
      client,
      store,
      bots,
      hooks,
      attachments,
      receipts,
      writes,
      faults,
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test("mock transport setup replays without duplicate bot/webhook or touching off inboxes", () =>
  scenario(async ({ client, store, bots, hooks, attachments, writes }) => {
    const result = await provisionChatwootTransport(
      config,
      client,
      client,
      store,
    );
    assert.deepEqual(result, {
      botId: 31,
      webhookId: 41,
      attachedInboxIds: [4],
    });
    await provisionChatwootTransport(config, client, client, store);
    assert.equal(bots.length, 1);
    assert.equal(hooks.length, 1);
    assert.equal(attachments.has(5), false);
    assert.equal(writes.length, 3);
  }));
test("lost creation response is reconciled by exact account and URL, with no second POST", () =>
  scenario(async ({ client, store, bots }) => {
    await assert.rejects(
      provisionChatwootTransport(config, client, client, store),
      /unavailable/,
    );
    await provisionChatwootTransport(config, client, client, store);
    assert.equal(bots.length, 1);
  }, true));
test("unknown prior outcome and conflicting inbox bot stop for reconciliation", () =>
  scenario(async ({ client, store, receipts, attachments }) => {
    receipts.set("bot", null);
    await assert.rejects(
      provisionChatwootTransport(config, client, client, store),
      /reconciliation/,
    );
    receipts.clear();
    attachments.set(4, 99);
    await assert.rejects(
      provisionChatwootTransport(config, client, client, store),
      /another bot/,
    );
    assert.equal(attachments.get(4), 99);
  }));

test("changed callback on a recorded bot refuses before creating a replacement", () =>
  scenario(async ({ client, store, writes }) => {
    await provisionChatwootTransport(config, client, client, store);
    const before = writes.length;
    await assert.rejects(
      provisionChatwootTransport(
        {
          ...config,
          existingBotId: 31,
          agentUrl: config.agentUrl + "-rotated",
        },
        client,
        client,
        store,
      ),
      /callback reconciliation/,
    );
    assert.equal(writes.length, before);
  }));
test("revocation during provider discovery prevents every external write", () =>
  scenario(async ({ client, store, writes }) => {
    const revoked = {
      ...store,
      async assertWrite() {
        throw new Error("Access revoked");
      },
    };
    await assert.rejects(
      provisionChatwootTransport(config, client, client, revoked),
      /Access revoked/,
    );
    assert.equal(writes.length, 0);
  }));
test("temporary discovery read failures recover without an ambiguous creation reservation", () =>
  scenario(async ({ client, store, receipts, faults, writes }) => {
    faults.botReads = 1;
    await assert.rejects(
      provisionChatwootTransport(config, client, client, store),
      /unavailable/,
    );
    assert.equal(receipts.has("bot"), false);
    assert.equal(writes.length, 0);
    faults.webhookReads = 1;
    await assert.rejects(
      provisionChatwootTransport(config, client, client, store),
      /unavailable/,
    );
    assert.equal(receipts.has("webhook"), false);
    await provisionChatwootTransport(config, client, client, store);
    assert.equal(writes.length, 3);
  }));
