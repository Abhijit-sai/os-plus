import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { state, verifyContainer, connect } from "./common.mjs";
import { fixtures } from "./seed.mjs";
import { localNotificationEnvironment } from "./mock-notifications.mjs";
import { decryptChatSecret } from "../../src/features/chat/secrets.ts";
const label = process.argv[2];
if (!["CH7 local owner", "CH7 local staff"].includes(label))
  throw new Error(
    "Choose an explicit synthetic CH7 local owner/staff destination.",
  );
const s = await state();
await verifyContainer(s, "db");
await verifyContainer(s, "rest");
const db = await connect(s);
const prior = {
  keys: process.env.CHAT_SECRETS_KEYS,
  version: process.env.CHAT_SECRETS_ACTIVE_VERSION,
};
try {
  process.env.CHAT_SECRETS_KEYS = JSON.stringify({ v1: s.chatKey });
  process.env.CHAT_SECRETS_ACTIVE_VERSION = "v1";
  const rows = (
    await db.query(
      "select * from chat_notification_targets where tenant_id=$1 and label=$2",
      [fixtures.A, label],
    )
  ).rows;
  assert.equal(rows.length, 1);
  const target = rows[0];
  assert.equal(target.is_active, false);
  assert.ok(target.link_code_enc);
  const code = decryptChatSecret(target.link_code_enc, {
    tenantId: fixtures.A,
    workspaceId: target.id,
    purpose: "notification_link",
  });
  const env = localNotificationEnvironment(s, true),
    group = label.endsWith("staff");
  const update = {
    update_id: Date.now(),
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: group ? -12345672 : 12345671,
        type: group ? "supergroup" : "private",
      },
      from: { id: 12345671, is_bot: false },
      text: "/start " + code,
    },
  };
  const post = () =>
    fetch("http://127.0.0.1:4131/api/chat/webhooks/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": env.TELEGRAM_WEBHOOK_SECRET,
      },
      body: JSON.stringify(update),
    });
  assert.equal((await post()).status, 200);
  let linked;
  for (let i = 0; i < 30; i++) {
    linked = (
      await db.query(
        "select version,linked_at,is_active,link_code_hash from chat_notification_targets where tenant_id=$1 and id=$2",
        [fixtures.A, target.id],
      )
    ).rows[0];
    if (linked.linked_at) break;
    await delay(100);
  }
  assert.ok(linked.linked_at);
  assert.equal(linked.is_active, false);
  assert.equal(linked.link_code_hash, null);
  assert.equal((await post()).status, 200);
  await delay(300);
  assert.equal(
    (
      await db.query(
        "select version from chat_notification_targets where tenant_id=$1 and id=$2",
        [fixtures.A, target.id],
      )
    ).rows[0].version,
    linked.version,
  );
  console.log(
    JSON.stringify({
      label,
      syntheticWebhookClaim: "PASS",
      linked: true,
      active: false,
      replay: "no change",
      realTelegramCalls: 0,
    }),
  );
} finally {
  await db.end();
  if (prior.keys === undefined) delete process.env.CHAT_SECRETS_KEYS;
  else process.env.CHAT_SECRETS_KEYS = prior.keys;
  if (prior.version === undefined)
    delete process.env.CHAT_SECRETS_ACTIVE_VERSION;
  else process.env.CHAT_SECRETS_ACTIVE_VERSION = prior.version;
}
