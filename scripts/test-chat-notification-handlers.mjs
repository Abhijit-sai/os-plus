import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { handleTelegramLink } from "../src/features/chat/notifications/handlers.ts";
import { decryptChatSecret } from "../src/features/chat/secrets.ts";
test("Telegram authenticates before parsing and resolves tenant only from issued code before deferred claim", async () => {
  const saved = { ...process.env };
  const secret = "s".repeat(40);
  const pending = [];
  const calls = [];
  const tenantId = "10000000-0000-4000-8000-000000000001",
    id = "10000000-0000-4000-8000-000000000002";
  try {
    Object.assign(process.env, {
      CHAT_FOUNDATION_ENABLED: "true",
      CHAT_NOTIFICATIONS_ENABLED: "true",
      TELEGRAM_WEBHOOK_SECRET: secret,
      CHAT_SECRETS_ACTIVE_VERSION: "v1",
      CHAT_SECRETS_KEYS: JSON.stringify({
        v1: randomBytes(32).toString("base64"),
      }),
    });
    const deps = {
      after: (fn) => pending.push(fn),
      resolve: async (hash) => {
        calls.push(hash);
        return { tenantId, id };
      },
      claim: async (ctx, input) => {
        calls.push({ ctx, input });
        return { claimed: true };
      },
    };
    const url = "http://localhost/api/chat/webhooks/telegram";
    const request = (body, key = secret) =>
      new Request(url, {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": key },
        body,
      });
    assert.equal(
      (await handleTelegramLink(request("not json", "wrong"), deps)).status,
      404,
    );
    assert.equal(calls.length, 0);
    assert.equal(
      (await handleTelegramLink(request("x".repeat(65537)), deps)).status,
      400,
    );
    const code = "b".repeat(43);
    const update = {
      update_id: 15,
      tenantId: "attacker",
      message: {
        message_id: 9,
        date: 1793000000,
        chat: { id: 123, type: "private" },
        from: { id: 123, is_bot: false },
        text: "/start " + code,
      },
    };
    assert.equal(
      (await handleTelegramLink(request(JSON.stringify(update)), deps)).status,
      200,
    );
    assert.equal(calls.length, 0);
    assert.equal(pending.length, 1);
    await pending.shift()();
    assert.match(calls[0], /^[a-f0-9]{64}$/);
    assert.equal(calls[1].ctx.tenantId, tenantId);
    assert.equal(calls[1].ctx.actor.id, "telegram");
    assert.equal(
      decryptChatSecret(calls[1].input.recipientEnc, {
        tenantId,
        workspaceId: id,
        purpose: "notification_recipient",
      }),
      '{"chatId":"123","senderId":"123"}',
    );
    assert.ok(!JSON.stringify(calls).includes(code));
    process.env.CHAT_NOTIFICATIONS_ENABLED = "false";
    assert.equal(
      (await handleTelegramLink(request(JSON.stringify(update)), deps)).status,
      404,
    );
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("notification cron accepts only its dedicated bearer and schedules work without claiming it succeeded", async () => {
  const { handleNotificationCron } =
    await import("../src/features/chat/notifications/handlers.ts");
  const saved = { ...process.env },
    pending = [];
  let ticks = 0,
    failures = 0;
  try {
    Object.assign(process.env, {
      CHAT_FOUNDATION_ENABLED: "true",
      CHAT_NOTIFICATIONS_ENABLED: "true",
      CHAT_NOTIFICATIONS_CRON_ENABLED: "true",
      CHAT_NOTIFICATIONS_CRON_SECRET: "c".repeat(40),
    });
    const deps = {
      after: (fn) => pending.push(fn),
      tick: async () => {
        ticks++;
        throw new Error("private provider URL");
      },
      platformFailure: async () => {
        failures++;
      },
    };
    const req = (body = "{}", token = "c".repeat(40)) =>
      new Request("http://localhost/api/chat/cron/hourly", {
        method: "POST",
        headers: { authorization: "Bearer " + token },
        body,
      });
    assert.equal(
      (await handleNotificationCron(req("{}", "wrong"), deps)).status,
      404,
    );
    assert.equal(
      (await handleNotificationCron(req('{"tenantId":"injected"}'), deps))
        .status,
      400,
    );
    const response = await handleNotificationCron(req(), deps);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true });
    assert.equal(ticks, 0);
    await pending.shift()();
    assert.equal(ticks, 1);
    assert.equal(failures, 1);
    process.env.CHAT_NOTIFICATIONS_CRON_ENABLED = "false";
    assert.equal((await handleNotificationCron(req(), deps)).status, 404);
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("a paused notification transport leaves durable sources unclaimed, even when setup is available", async () => {
  const { loadServerModule } =
      await import("./chat-db-harness/server-adapter.mjs"),
    { z } = await import("zod");
  let calls = 0;
  const forbidden = () => {
    calls++;
    throw new Error("Paused transport touched storage or delivery");
  };
  const engine = loadServerModule("src/features/chat/notifications/engine.ts", {
    zod: { z },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: forbidden },
    "@/integrations/telegram/client": {
      TelegramClient: class {
        constructor() {
          forbidden();
        }
      },
    },
    "./worker": { runNotificationBatch: forbidden },
    "./platform-worker": { runPlatformAlert: forbidden },
    "./flags": { notificationsEnabled: () => true },
  });
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      CHAT_DRY_RUN: "false",
      CHAT_TELEGRAM_MOCK_ENABLED: "false",
      CHAT_TELEGRAM_LIVE_ENABLED: "false",
      CHAT_PLATFORM_ALERTS_ENABLED: "true",
    });
    await engine.notifyTenant("10000000-0000-4000-8000-000000000001");
    await engine.notificationTick();
    await engine.notifyPlatformFailure("10000000-0000-4000-8000-000000000001");
    assert.equal(calls, 0);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
