import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
import { voiceFixture } from "./chat-db-harness/voice-fixture.mjs";
let local, a, b;
before(
  async () => {
    local = await startChatDatabase();
    a = await voiceFixture(local.db, 0);
    b = await voiceFixture(local.db, 1);
  },
  { timeout: 120000 },
);
after(async () => {
  await local?.stop();
});
function event(f, n = 100, phone = "+919000000001") {
  return {
    workspaceId: f.scope.workspaceId,
    secretHash: f.scope.secretHash,
    channelId: f.scope.channelId,
    identity: {
      displayName: "Synthetic website visitor",
      sourceId: "visitor-" + n,
      websitePhoneClaimE164: phone,
    },
    message: {
      messageId: n,
      accountId: f === a ? 901 : 902,
      inboxId: 20,
      conversationId: n + 1000,
      contactId: n + 2000,
      status: "open",
      channelKind: "website",
      author: "customer",
      private: false,
      content: "Synthetic website question",
      contentType: "text",
      createdAt: new Date().toISOString(),
      staffUserId: null,
      attachments: [],
    },
  };
}
const capture = (f, input, db = local.db) =>
  db
    .query("select chat_capture($1::jsonb,'events',$2::jsonb) result", [
      f.context,
      input,
    ])
    .then((r) => r.rows[0].result);
const read = (f, contact, role = "owner_admin") =>
  local.db
    .query("select chat_crm_read($1::jsonb,'contact',$2::jsonb) result", [
      {
        tenantId: f.tenantId,
        actor: { type: "USER", id: "voice-" + role },
        source: "OS_PLUS_UI",
        correlationId: "website-test",
      },
      { id: contact },
    ])
    .then((r) => r.rows[0].result);
test("website pre-chat claim is retained unverified without creating a possession identity or customer", async () => {
  const saved = await capture(a, event(a));
  const contact = (
    await local.db.query(
      "select contact_id from chat_conversations where tenant_id=$1 and id=$2",
      [a.tenantId, saved.conversationId],
    )
  ).rows[0].contact_id;
  const page = await read(a, contact);
  assert.deepEqual(page.details.phoneClaims, [
    { value: "+919000000001", verified: false, source: "website_prechat" },
  ]);
  assert.equal(page.item.customer_id, null);
  assert.deepEqual(page.details.matchingCustomers, []);
  assert.equal(
    page.details.identities.some((i) => i.kind === "phone"),
    false,
  );
});

test("website claim replay is atomic and idempotent across independent connections", async () => {
  const input = event(a, 101),
    second = await local.connect();
  const [x, y] = await Promise.all([
    capture(a, input),
    capture(a, input, second),
  ]);
  assert.equal(x.messageId, y.messageId);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_website_phone_claims where tenant_id=$1 and message_id=$2",
        [a.tenantId, x.messageId],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    capture(a, {
      ...input,
      identity: { ...input.identity, websitePhoneClaimE164: "+919000000002" },
    }),
    /replay changed/,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1 and event_type='chat.website.phone_claimed' and payload_json->>'messageId'=$2",
        [a.tenantId, x.messageId],
      )
    ).rows[0].n,
    1,
  );
});
test("capture and claim roll back together when audit fails", async () => {
  await local.db
    .query(`create function website_fail_audit() returns trigger language plpgsql as $$ begin if new.event_type='chat.website.phone_claimed' then raise exception 'synthetic website audit failure';end if;return new;end $$;
 create trigger website_fail_audit before insert on domain_events for each row execute function website_fail_audit();`);
  try {
    await assert.rejects(
      capture(a, event(a, 102)),
      /synthetic website audit failure/,
    );
  } finally {
    await local.db.query(
      "drop trigger website_fail_audit on domain_events;drop function website_fail_audit()",
    );
  }
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_messages where tenant_id=$1 and chatwoot_message_id=102",
        [a.tenantId],
      )
    ).rows[0].n,
    0,
  );
});
test("claims are tenant-isolated and separately PII-controlled; website claims cannot resolve a WhatsApp contact", async () => {
  const one = await capture(a, event(a, 103)),
    two = await capture(b, event(b, 103));
  const contact = async (f, saved) =>
    (
      await local.db.query(
        "select contact_id from chat_conversations where tenant_id=$1 and id=$2",
        [f.tenantId, saved.conversationId],
      )
    ).rows[0].contact_id;
  const ca = await contact(a, one),
    cb = await contact(b, two);
  assert.notEqual(ca, cb);
  assert.equal((await read(b, ca)).item, null);
  await assert.rejects(read(a, ca, "viewer"));
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:view',true)",
    [a.tenantId],
  );
  assert.deepEqual((await read(a, ca, "viewer")).details.phoneClaims, []);
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:pii',true)",
    [a.tenantId],
  );
  assert.equal(
    (await read(a, ca, "viewer")).details.phoneClaims[0].verified,
    false,
  );
  const wa = (
    await local.db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,21,'whatsapp','Synthetic WA') returning id",
      [a.tenantId, a.scope.workspaceId, a.brand],
    )
  ).rows[0].id;
  const request = event(a, 104);
  request.channelId = wa;
  request.message.inboxId = 21;
  request.message.channelKind = "whatsapp";
  request.identity = {
    displayName: "Synthetic verified source",
    sourceId: "919000000001",
    phoneE164: "+919000000001",
  };
  const w = await capture(a, request),
    cw = await contact(a, w);
  assert.notEqual(ca, cw);
  assert.equal(
    (await read(a, cw)).details.identities.find((i) => i.kind === "phone")
      .verified,
    true,
  );
  assert.equal(
    (await read(a, ca)).details.identities.some((i) => i.kind === "phone"),
    false,
  );
  await assert.rejects(
    capture(b, { ...event(b, 105), channelId: a.scope.channelId }),
  );
  await local.db.query("set role anon");
  try {
    await assert.rejects(
      local.db.query("select * from chat_website_phone_claims"),
      /permission denied/,
    );
  } finally {
    await local.db.query("reset role");
  }
});

test("unverified phone context follows explicit merge and conservative split without changing immutable provenance", async () => {
  const left = await capture(a, event(a, 110, "+919000000003")),
    right = await capture(a, event(a, 111, "+919000000004"));
  const get = async (saved) =>
    (
      await local.db.query(
        "select contact_id from chat_conversations where tenant_id=$1 and id=$2",
        [a.tenantId, saved.conversationId],
      )
    ).rows[0].contact_id;
  const from = await get(left),
    to = await get(right),
    beforeFrom = await read(a, from),
    beforeTo = await read(a, to);
  const command = async (action, input) =>
    local.db
      .query("select chat_lead_command($1::jsonb,$2,$3::jsonb) result", [
        { ...a.owner, idempotencyKey: randomUUID() },
        action,
        input,
      ])
      .then((r) => r.rows[0].result);
  const merged = await command("contact.merge", {
    fromId: from,
    toId: to,
    fromVersion: beforeFrom.item.version,
    toVersion: beforeTo.item.version,
  });
  assert.deepEqual(
    (await read(a, to)).details.phoneClaims.map((c) => c.value).sort(),
    ["+919000000003", "+919000000004"],
  );
  assert.deepEqual((await read(a, from)).details.phoneClaims, []);
  await command("contact.split", { mergeId: merged.mergeId });
  assert.deepEqual(
    (await read(a, from)).details.phoneClaims.map((c) => c.value),
    ["+919000000003"],
  );
  assert.deepEqual(
    (await read(a, to)).details.phoneClaims.map((c) => c.value),
    ["+919000000004"],
  );
});
