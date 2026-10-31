import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { encryptChatSecret } from "../src/features/chat/secrets.ts";
const priorKeys = process.env.CHAT_SECRETS_KEYS,
  priorVersion = process.env.CHAT_SECRETS_ACTIVE_VERSION;
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local;
const tenants = [];
const context = (t, who = "owner", key = randomUUID()) => ({
  tenantId: t,
  actor: { type: "USER", id: "notify-" + who },
  source: "OS_PLUS_UI",
  correlationId: "notification-qa",
  idempotencyKey: key,
});
const run = (t, action, input, ctx = context(t), db = local.db) =>
  db
    .query("select chat_notification_command($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(ctx),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
before(
  async () => {
    process.env.CHAT_SECRETS_KEYS = JSON.stringify({
      v1: randomBytes(32).toString("base64"),
    });
    process.env.CHAT_SECRETS_ACTIVE_VERSION = "v1";
    local = await startChatDatabase();
    for (let i = 0; i < 2; i++) {
      const t = randomUUID();
      tenants.push(t);
      await local.db.query(
        "insert into tenants(id,name,store_name,slug) values($1,'Notification QA','Notification QA',$2)",
        [t, "notify-" + i],
      );
      await local.db.query(
        "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
        [t],
      );
      await local.db.query("insert into chat_settings(tenant_id) values($1)", [
        t,
      ]);
      for (const [who, role] of [
        ["owner", "owner_admin"],
        ["manager", "manager"],
        ["viewer", "viewer"],
        ["finance", "finance"],
      ])
        await local.db.query(
          "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$4,$5,'active')",
          [t, "notify-" + who, who + "@example.invalid", who, role],
        );
    }
  },
  { timeout: 120000 },
);
after(
  async () => {
    await local?.stop();
    if (priorKeys === undefined) delete process.env.CHAT_SECRETS_KEYS;
    else process.env.CHAT_SECRETS_KEYS = priorKeys;
    if (priorVersion === undefined)
      delete process.env.CHAT_SECRETS_ACTIVE_VERSION;
    else process.env.CHAT_SECRETS_ACTIVE_VERSION = priorVersion;
  },
  { timeout: 30000 },
);
test("owner creates a disabled target atomically; retries, roles and tenant guesses cannot change authority", async () => {
  const [a, b] = tenants,
    id = randomUUID(),
    key = randomUUID(),
    input = { id, label: "Owner reports" };
  const first = await run(a, "create", input, context(a, "owner", key));
  assert.deepEqual(first, { id, version: 1 });
  assert.deepEqual(
    await run(a, "create", input, context(a, "owner", key)),
    first,
  );
  const row = (
    await local.db.query(
      "select * from chat_notification_targets where tenant_id=$1 and id=$2",
      [a, id],
    )
  ).rows[0];
  assert.equal(row.is_active, false);
  assert.deepEqual(row.events, []);
  assert.equal(row.recipient_enc, null);
  for (const who of ["manager", "viewer", "finance"])
    await assert.rejects(
      run(a, "create", { id: randomUUID(), label: "Denied" }, context(a, who)),
    );
  await assert.rejects(
    run(b, "save", {
      id,
      version: 1,
      label: "Guessed",
      events: [],
      brandIds: [],
      active: false,
      confirm: false,
    }),
  );
  await assert.rejects(
    run(
      a,
      "create",
      { ...input, label: "Different" },
      context(a, "owner", key),
    ),
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1 and event_type='chat.notification.create'",
        [a],
      )
    ).rows[0].n,
    1,
  );
  await local.db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [a],
  );
  await assert.rejects(run(a, "create", input, context(a, "owner", key)));
  await local.db.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [a],
  );
});

test("one-use link claims stay inactive, expire safely and never expose plaintext in audit or receipts", async () => {
  const t = tenants[0],
    id = randomUUID();
  await run(t, "create", { id, label: "Private owner" });
  const code = "b".repeat(43),
    hash = createHash("sha256").update(code).digest("hex"),
    key = randomUUID();
  const issue = {
    id,
    version: 1,
    codeHash: hash,
    codeEnc: "gcm1.v1.synthetic-encrypted-code",
  };
  const issued = await run(t, "issue", issue, context(t, "owner", key));
  assert.equal(issued.version, 2);
  assert.equal(issued.codeEnc, issue.codeEnc);
  assert.deepEqual(
    await run(
      t,
      "issue",
      { ...issue, codeHash: "c".repeat(64), codeEnc: "gcm1.v1.different" },
      context(t, "owner", key),
    ),
    issued,
  );
  const webhook = {
    tenantId: t,
    actor: { type: "WEBHOOK", id: "telegram" },
    source: "WEBHOOK",
    correlationId: "telegram-update-19",
  };
  const claim = {
    id,
    codeHash: hash,
    recipientEnc: "gcm1.v1.encrypted-recipient",
    kind: "private",
    hint: "0123",
    updateId: 19,
  };
  const connections = await Promise.all([local.connect(), local.connect()]);
  const results = await Promise.all(
    connections.map((db) =>
      db
        .query("select chat_notification_link($1::jsonb,$2::jsonb) result", [
          JSON.stringify(webhook),
          JSON.stringify(claim),
        ])
        .then((r) => r.rows[0].result),
    ),
  );
  assert.equal(results.filter((r) => r.claimed).length, 1);
  const row = (
    await local.db.query(
      "select * from chat_notification_targets where id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(row.is_active, false);
  assert.equal(row.version, 3);
  assert.equal(row.link_code_hash, null);
  assert.equal(row.link_code_enc, null);
  assert.equal(row.telegram_chat_id, null);
  assert.equal(row.recipient_enc, claim.recipientEnc);
  await assert.rejects(
    run(t, "save", {
      id,
      version: 3,
      label: "Private owner",
      events: ["daily_summary"],
      brandIds: [],
      active: true,
      confirm: false,
    }),
  );
  const active = await run(t, "save", {
    id,
    version: 3,
    label: "Private owner",
    events: ["daily_summary"],
    brandIds: [],
    active: true,
    confirm: true,
  });
  assert.equal(active.version, 4);
  const audit = (
    await local.db.query(
      "select payload_json from domain_events where tenant_id=$1 and aggregate_id=$2",
      [t, id],
    )
  ).rows;
  assert.ok(!JSON.stringify(audit).includes("gcm1"));
  assert.ok(!JSON.stringify(audit).includes(hash));
  const expired = randomUUID();
  await run(t, "create", { id: expired, label: "Expired" });
  await run(t, "issue", {
    id: expired,
    version: 1,
    codeHash: "d".repeat(64),
    codeEnc: "gcm1.v1.expired",
  });
  await local.db.query(
    "update chat_notification_targets set link_code_expires_at=now()-interval '1 second' where id=$1",
    [expired],
  );
  assert.equal(
    (
      await local.db.query(
        "select chat_notification_link($1::jsonb,$2::jsonb) result",
        [
          JSON.stringify(webhook),
          JSON.stringify({ ...claim, id: expired, codeHash: "d".repeat(64) }),
        ],
      )
    ).rows[0].result.claimed,
    false,
  );
});

test("owner-only target DTO hides recipient/code; cross-tenant brand mapping rolls back the entire save", async () => {
  const [a, b] = tenants;
  const read = (t, who = "owner") =>
    local.db
      .query("select chat_notification_read($1::jsonb) result", [
        JSON.stringify(context(t, who)),
      ])
      .then((r) => r.rows[0].result);
  const data = await read(a);
  assert.equal(data.settings.enabled, false);
  assert.equal(data.settings.localTime, "21:30");
  assert.ok(!JSON.stringify(data).includes("gcm1"));
  assert.ok(!JSON.stringify(data).includes("codeHash"));
  assert.ok(!JSON.stringify(data).includes("recipientEnc"));
  for (const who of ["manager", "viewer", "finance"])
    await assert.rejects(read(a, who));
  assert.deepEqual((await read(b)).targets, []);
  const brand = (
    await local.db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'B brand','b','Demo') returning id",
      [b],
    )
  ).rows[0].id;
  const target = data.targets.find((t) => t.active);
  const input = {
    id: target.id,
    version: target.version,
    label: "Changed",
    events: ["handoff"],
    brandIds: [brand],
    active: true,
    confirm: false,
  };
  await assert.rejects(run(a, "save", input));
  assert.equal(
    (await read(a)).targets.find((t) => t.id === target.id).version,
    target.version,
  );
  const before = (
    await local.db.query(
      "select count(*)::int n from domain_events where tenant_id=$1",
      [a],
    )
  ).rows[0].n;
  await local.db.query("begin");
  await local.db.query("set local role authenticated");
  await assert.rejects(
    local.db.query("select * from chat_notification_targets"),
  );
  await local.db.query("rollback");
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1",
        [a],
      )
    ).rows[0].n,
    before,
  );
});

test("notification schedule is disabled by default and only owner can change its current version", async () => {
  const t = tenants[1];
  const input = {
    version: 1,
    enabled: true,
    timezone: "America/New_York",
    localTime: "21:30",
  };
  await assert.rejects(run(t, "settings", input, context(t, "manager")));
  const first = await run(t, "settings", input);
  assert.equal(first.version, 2);
  await assert.rejects(run(t, "settings", input));
  await assert.rejects(
    run(t, "settings", { ...input, version: 2, timezone: "+05:30" }),
  );
  await assert.rejects(
    run(t, "settings", { ...input, version: 2, localTime: "24:00" }),
  );
  const settings = (
    await local.db.query("select chat_notification_read($1::jsonb) result", [
      JSON.stringify(context(t)),
    ])
  ).rows[0].result.settings;
  assert.deepEqual(settings, {
    version: 2,
    enabled: true,
    timezone: "America/New_York",
    localTime: "21:30",
  });
});

test("write-free report uses captured public reply times, not private drafts, and separates estimated currencies", async () => {
  const t = tenants[0],
    brand = randomUUID(),
    workspace = randomUUID(),
    channel = randomUUID(),
    contact = randomUUID();
  await local.db.query(
    "insert into chat_brands(id,tenant_id,name,slug,persona_name) values($1,$2,'Report Brand','report','Demo')",
    [brand, t],
  );
  await local.db.query(
    "insert into chat_workspaces(id,tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,$2,'https://chat.example.invalid',901,$3,$4,'gcm1.v1.fixture','active')",
    [workspace, t, "z".repeat(32), "a".repeat(64)],
  );
  await local.db.query(
    "insert into chat_channels(id,tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,$4,20,'website','Report')",
    [channel, t, workspace, brand],
  );
  await local.db.query(
    "insert into chat_contacts(id,tenant_id,display_name,first_seen_at,last_seen_at) values($1,$2,'PRIVATE CUSTOMER','2026-10-20T10:00:00Z','2026-10-20T10:00:00Z')",
    [contact, t],
  );
  for (let i = 0; i < 3; i++) {
    const conv = randomUUID(),
      message = randomUUID();
    await local.db.query(
      "insert into chat_conversations(id,tenant_id,channel_id,contact_id,chatwoot_conversation_id,chatwoot_contact_id,status,status_at) values($1,$2,$3,$4,$5,10,'open','2026-10-20T10:00:00Z')",
      [conv, t, channel, contact, 20 + i],
    );
    await local.db.query(
      "insert into chat_messages(id,tenant_id,conversation_id,chatwoot_message_id,author,private,content,content_type,created_at) values($1,$2,$3,$4,'customer',false,'PRIVATE MESSAGE','text','2026-10-20T10:00:00Z')",
      [message, t, conv, 100 + i * 10],
    );
    await local.db.query(
      "insert into chat_messages(tenant_id,conversation_id,chatwoot_message_id,author,private,content,content_type,created_at) values($1,$2,$3,'bot',true,'PRIVATE DRAFT','text','2026-10-20T10:00:01Z')",
      [t, conv, 101 + i * 10],
    );
    if (i < 2)
      await local.db.query(
        "insert into chat_messages(tenant_id,conversation_id,chatwoot_message_id,author,private,content,content_type,staff_chatwoot_user_id,created_at) values($1,$2,$3,$4,false,'PUBLIC REPLY','text',$5,$6)",
        [
          t,
          conv,
          102 + i * 10,
          i === 0 ? "bot" : "staff",
          i === 0 ? null : 50,
          "2026-10-20T10:00:" + (i === 0 ? "05" : "15") + "Z",
        ],
      );
    const won = i < 2;
    await local.db.query(
      "insert into leads(tenant_id,ref_code,brand_id,channel_id,channel_kind,contact_id,conversation_id,currency,est_value,stage,closed_at,first_customer_at,last_customer_at,created_at) values($1,$2,$3,$4,'website',$5,$6,$7,$8,$9,$10,'2026-10-20T10:00:00Z','2026-10-20T10:00:00Z','2026-10-20T10:00:00Z')",
      [
        t,
        "ABCD" + (i + 2),
        brand,
        channel,
        contact,
        conv,
        i === 0 ? "INR" : "USD",
        i === 0 ? 2000 : 20,
        won ? "won" : "new",
        won ? "2026-10-20T11:00:00Z" : null,
      ],
    );
    if (i === 2)
      await local.db.query(
        "insert into chat_turns(tenant_id,conversation_id,trigger_message_id,mode,outcome,error,created_at) values($1,$2,$3,'draft','error','PRIVATE ERROR','2026-10-20T10:00:00Z')",
        [t, conv, message],
      );
  }
  const input = {
    windowStart: "2026-10-20T00:00:00Z",
    windowEnd: "2026-10-21T00:00:00Z",
    brandIds: [],
  };
  const preview = (tenant, who = "owner", payload = input) =>
    local.db
      .query("select chat_notification_preview($1::jsonb,$2::jsonb) result", [
        JSON.stringify(context(tenant, who)),
        JSON.stringify(payload),
      ])
      .then((r) => r.rows[0].result);
  const before = (
    await local.db.query(
      "select count(*)::int n from domain_events where tenant_id=$1",
      [t],
    )
  ).rows[0].n;
  const report = await preview(t);
  const { summarySchema } =
    await import("../src/features/chat/notifications/summary.ts");
  summarySchema.parse(report);
  assert.equal(report.totals.chats, 3);
  assert.equal(report.totals.customerMessages, 3);
  assert.equal(report.totals.botReplies, 1);
  assert.equal(report.totals.staffReplies, 1);
  assert.equal(report.totals.medianReplySeconds, 10);
  assert.equal(report.totals.unansweredChats, 1);
  assert.equal(report.totals.newLeads, 3);
  assert.equal(report.totals.wonLeads, 2);
  assert.equal(report.totals.errors, 1);
  assert.deepEqual(report.totals.wonEstimatedValue, [
    { currency: "INR", amount: 2000 },
    { currency: "USD", amount: 20 },
  ]);
  assert.equal(report.judge.status, "not_evaluated");
  assert.ok(!JSON.stringify(report).includes("PRIVATE"));
  assert.equal((await preview(tenants[1])).totals.chats, 0);
  await assert.rejects(preview(t, "manager"));
  await assert.rejects(
    preview(t, "owner", { ...input, brandIds: [randomUUID()] }),
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1",
        [t],
      )
    ).rows[0].n,
    before,
  );
  assert.equal(
    (await local.db.query("select count(*)::int n from chat_summary_runs"))
      .rows[0].n,
    0,
  );
});

test("two tenant schedules reserve one stable daily window each, even under concurrent preparation", async () => {
  for (let i = 0; i < 2; i++) {
    const t = tenants[i],
      id = randomUUID(),
      hash = (i === 0 ? "e" : "f").repeat(64);
    await run(t, "create", { id, label: "Scheduled owner" });
    await run(t, "issue", {
      id,
      version: 1,
      codeHash: hash,
      codeEnc: "gcm1.v1.test",
    });
    await local.db.query("select chat_notification_link($1::jsonb,$2::jsonb)", [
      JSON.stringify({
        tenantId: t,
        actor: { type: "WEBHOOK", id: "telegram" },
        source: "WEBHOOK",
        correlationId: "schedule-link",
      }),
      JSON.stringify({
        id,
        codeHash: hash,
        recipientEnc: encryptChatSecret(
          JSON.stringify({
            chatId: String(123 + i),
            senderId: String(123 + i),
          }),
          { tenantId: t, workspaceId: id, purpose: "notification_recipient" },
        ),
        kind: "private",
        hint: String(123 + i),
        updateId: 30 + i,
      }),
    ]);
    await run(t, "save", {
      id,
      version: 3,
      label: "Scheduled owner",
      events: ["daily_summary"],
      brandIds: [],
      active: true,
      confirm: true,
    });
    const v = (
      await local.db.query(
        "select notification_version from chat_settings where tenant_id=$1",
        [t],
      )
    ).rows[0].notification_version;
    await run(t, "settings", {
      version: v,
      enabled: true,
      timezone: "UTC",
      localTime: i === 0 ? "01:00" : "02:00",
    });
    await local.db.query(
      "update chat_notification_targets set activated_at=now()-interval '2 days' where id=$1",
      [id],
    );
    const system = {
      tenantId: t,
      actor: { type: "SYSTEM", id: "chat-notifications" },
      source: "AUTOMATION",
      correlationId: "schedule-qa",
    };
    const peers = await Promise.all([local.connect(), local.connect()]);
    const result = await Promise.all(
      peers.map((db) =>
        db
          .query(
            "select chat_notification_dispatch($1::jsonb,'prepare','{}'::jsonb) result",
            [JSON.stringify(system)],
          )
          .then((r) => r.rows[0].result),
      ),
    );
    assert.equal(result.filter((r) => r.summaryCreated).length, 1);
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from chat_summary_runs where tenant_id=$1",
          [t],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from chat_notification_outbox where tenant_id=$1 and kind='daily_summary'",
          [t],
        )
      ).rows[0].n,
      1,
    );
  }
  const windows = (
    await local.db.query(
      "select window_start,window_end from chat_summary_runs order by window_end",
    )
  ).rows;
  assert.equal(windows.length, 2);
  assert.notEqual(
    windows[0].window_end.toISOString(),
    windows[1].window_end.toISOString(),
  );
  for (const w of windows)
    assert.equal(w.window_end - w.window_start, 86400000);
  const manager = context(tenants[0], "manager");
  await assert.rejects(
    local.db.query(
      "select chat_notification_dispatch($1::jsonb,'prepare','{}'::jsonb)",
      [JSON.stringify(manager)],
    ),
  );
});

test("actual two-tenant outbox to mock HTTP delivers one correct summary each and no replay duplicates", async () => {
  const { createServer } = await import("node:http");
  const sent = [];
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const part of req) text += part;
    const body = JSON.parse(text);
    sent.push(body);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        result: {
          message_id: 100 + sent.length,
          chat: { id: Number(body.chat_id) },
          text: body.text,
        },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const flags = [
    "CHAT_FOUNDATION_ENABLED",
    "CHAT_NOTIFICATIONS_ENABLED",
    "CHAT_DRY_RUN",
    "CHAT_TELEGRAM_MOCK_ENABLED",
    "TELEGRAM_BOT_TOKEN",
  ];
  const saved = Object.fromEntries(flags.map((k) => [k, process.env[k]]));
  try {
    Object.assign(process.env, {
      CHAT_FOUNDATION_ENABLED: "true",
      CHAT_NOTIFICATIONS_ENABLED: "true",
      CHAT_DRY_RUN: "false",
      CHAT_TELEGRAM_MOCK_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "12345:synthetic_only",
    });
    const { runNotificationBatch } =
      await import("../src/features/chat/notifications/worker.ts");
    const { TelegramClient } =
      await import("../src/integrations/telegram/client.ts");
    const client = new TelegramClient({
      origin: "http://127.0.0.1:" + server.address().port,
      allowLocalMock: true,
    });
    for (const t of tenants) {
      const deps = {
        run: async (ctx, action, input) =>
          local.db
            .query(
              "select chat_notification_dispatch($1::jsonb,$2,$3::jsonb) result",
              [JSON.stringify(ctx), action, JSON.stringify(input)],
            )
            .then((r) => r.rows[0].result),
        send: (input) => client.send(input),
      };
      const result = await runNotificationBatch(
        t,
        deps,
        "https://app.example.invalid",
      );
      assert.equal(result.sent, 1);
      assert.equal(
        (await runNotificationBatch(t, deps, "https://app.example.invalid"))
          .sent,
        0,
      );
    }
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.map((s) => s.chat_id).sort(), ["123", "124"]);
    for (const message of sent) {
      assert.match(message.text, /Window:/);
      assert.match(message.text, /not evaluated/);
      assert.ok(!message.text.includes("PRIVATE"));
    }
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from chat_summary_runs where state='sent' and sent_at is not null",
        )
      ).rows[0].n,
      2,
    );
  } finally {
    for (const key of flags) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("fresh alert intents dedupe; revocation cancels a claimed send and an unknown receipt never retries", async () => {
  const t = tenants[0];
  let target = (
    await local.db.query(
      "select * from chat_notification_targets where tenant_id=$1 and is_active and label='Scheduled owner'",
      [t],
    )
  ).rows[0];
  const save = () =>
    run(t, "save", {
      id: target.id,
      version: target.version,
      label: target.label,
      events: ["new_lead"],
      brandIds: [],
      active: true,
      confirm: false,
    });
  await save();
  target = (
    await local.db.query(
      "select * from chat_notification_targets where id=$1",
      [target.id],
    )
  ).rows[0];
  const addLead = async (ref) =>
    local.db
      .query(
        "insert into leads(tenant_id,ref_code,brand_id,channel_id,channel_kind,contact_id,conversation_id,currency,first_customer_at,last_customer_at) select tenant_id,$2,brand_id,channel_id,channel_kind,contact_id,conversation_id,currency,now(),now() from leads where tenant_id=$1 and stage='won' order by ref_code limit 1 returning id",
        [t, ref],
      )
      .then((r) => r.rows[0].id);
  const lid = await addLead("NEW22");
  const system = {
    tenantId: t,
    actor: { type: "SYSTEM", id: "chat-notifications" },
    source: "AUTOMATION",
    correlationId: "alert-qa",
  };
  const dispatch = (action, input = {}) =>
    local.db
      .query(
        "select chat_notification_dispatch($1::jsonb,$2,$3::jsonb) result",
        [JSON.stringify(system), action, JSON.stringify(input)],
      )
      .then((r) => r.rows[0].result);
  await dispatch("prepare");
  await dispatch("prepare");
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_notification_outbox where tenant_id=$1 and kind='new_lead' and lead_id=$2",
        [t, lid],
      )
    ).rows[0].n,
    1,
  );
  const connections = await Promise.all([local.connect(), local.connect()]);
  const claims = await Promise.all(
    connections.map((db) =>
      db
        .query(
          "select chat_notification_dispatch($1::jsonb,'claim','{}') result",
          [JSON.stringify(system)],
        )
        .then((r) => r.rows[0].result),
    ),
  );
  assert.equal(claims.filter((c) => c.status === "claimed").length, 1);
  const claim = claims.find((c) => c.status === "claimed");
  await run(t, "save", {
    id: target.id,
    version: target.version,
    label: target.label,
    events: ["new_lead"],
    brandIds: [],
    active: false,
    confirm: false,
  });
  assert.deepEqual(
    await dispatch("authorize", { id: claim.id, token: claim.token }),
    { allowed: false },
  );
  assert.equal(
    (
      await local.db.query(
        "select state from chat_notification_outbox where id=$1",
        [claim.id],
      )
    ).rows[0].state,
    "cancelled",
  );
  target = (
    await local.db.query(
      "select * from chat_notification_targets where id=$1",
      [target.id],
    )
  ).rows[0];
  await save();
  await local.db.query(
    "update leads set stage='lost',closed_at=now() where id=$1",
    [lid],
  );
  await addLead("NEW23");
  const { runNotificationBatch } =
    await import("../src/features/chat/notifications/worker.ts");
  let attempts = 0;
  const before = { ...process.env };
  try {
    Object.assign(process.env, {
      CHAT_FOUNDATION_ENABLED: "true",
      CHAT_NOTIFICATIONS_ENABLED: "true",
      CHAT_DRY_RUN: "false",
    });
    const deps = {
      run: (_ctx, action, input) => dispatch(action, input),
      send: async () => {
        attempts++;
        throw new Error("Connection lost after POST");
      },
    };
    assert.equal(
      (await runNotificationBatch(t, deps, "https://app.example.invalid")).held,
      1,
    );
    await runNotificationBatch(t, deps, "https://app.example.invalid");
    assert.equal(attempts, 1);
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from chat_notification_outbox where tenant_id=$1 and state='uncertain'",
          [t],
        )
      ).rows[0].n,
      1,
    );
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in before)) delete process.env[k];
    Object.assign(process.env, before);
  }
});

test("cancelled and abandoned deliveries close their summary as partial, with audit instead of retry", async () => {
  const t = tenants[1],
    target = (
      await local.db.query(
        "select * from chat_notification_targets where tenant_id=$1 and label='Scheduled owner'",
        [t],
      )
    ).rows[0];
  const s = (
    await local.db.query("select * from chat_settings where tenant_id=$1", [t])
  ).rows[0];
  const runid = (
    await local.db.query(
      "insert into chat_summary_runs(tenant_id,local_date,window_start,window_end,reporting_timezone) values($1,'2020-01-01','2020-01-01T00:00:00Z','2020-01-02T00:00:00Z','UTC') returning id",
      [t],
    )
  ).rows[0].id;
  const held = randomUUID(),
    token = randomUUID();
  await local.db.query(
    "insert into chat_notification_outbox(tenant_id,target_id,target_version,settings_version,kind,source_key,summary_run_id,payload_json) values($1,$2,$3,$4,'daily_summary','qa-cancelled',$5,'{}')",
    [t, target.id, target.version, s.notification_version, runid],
  );
  await local.db.query(
    "insert into chat_notification_outbox(id,tenant_id,target_id,target_version,settings_version,kind,source_key,summary_run_id,payload_json,state,claim_token,attempted_at) values($1,$2,$3,$4,$5,'daily_summary','qa-abandoned',$6,'{}','sending',$7,now()-interval '3 minutes')",
    [held, t, target.id, target.version, s.notification_version, runid, token],
  );
  await run(t, "save", {
    id: target.id,
    version: target.version,
    label: target.label,
    events: target.events,
    brandIds: [],
    active: false,
    confirm: false,
  });
  const system = {
    tenantId: t,
    actor: { type: "SYSTEM", id: "chat-notifications" },
    source: "AUTOMATION",
    correlationId: "abandoned-qa",
  };
  const dispatch = (action, input = {}) =>
    local.db
      .query(
        "select chat_notification_dispatch($1::jsonb,$2,$3::jsonb) result",
        [JSON.stringify(system), action, JSON.stringify(input)],
      )
      .then((r) => r.rows[0].result);
  assert.deepEqual(await dispatch("claim"), { status: "none" });
  const report = (
    await local.db.query(
      "select state,sent_at from chat_summary_runs where id=$1",
      [runid],
    )
  ).rows[0];
  assert.equal(report.state, "partial");
  assert.equal(report.sent_at, null);
  assert.equal(
    (
      await local.db.query(
        "select state from chat_notification_outbox where id=$1",
        [held],
      )
    ).rows[0].state,
    "uncertain",
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1 and event_type='chat.notification.delivery_cancelled'",
        [t],
      )
    ).rows[0].n,
    1,
  );
  await dispatch("record", { id: held, token, messageId: 999 });
  assert.equal(
    (
      await local.db.query("select state from chat_summary_runs where id=$1", [
        runid,
      ])
    ).rows[0].state,
    "partial",
  );
});

test("database cutoff calendar handles 23/25-hour days and waits for the later ambiguous cutoff", async () => {
  const slot = (at, time = "03:30") =>
    local.db
      .query(
        "select chat_notification_slot('America/New_York',$1::time,$2::timestamptz) result",
        [time, at],
      )
      .then((r) => r.rows[0].result);
  const spring = await slot("2026-03-08T07:31:00Z");
  assert.equal(spring.localDate, "2026-03-08");
  assert.equal(
    Date.parse(spring.windowEnd) - Date.parse(spring.windowStart),
    23 * 3600000,
  );
  const fall = await slot("2026-11-01T08:31:00Z");
  assert.equal(fall.localDate, "2026-11-01");
  assert.equal(
    Date.parse(fall.windowEnd) - Date.parse(fall.windowStart),
    25 * 3600000,
  );
  assert.equal(
    (await slot("2026-11-01T05:45:00Z", "01:30")).localDate,
    "2026-10-31",
  );
  assert.equal(
    (await slot("2026-11-01T06:31:00Z", "01:30")).localDate,
    "2026-11-01",
  );
});

test("recorded legacy costs remain visible and reservation entries replace rather than double-count them", async () => {
  const t = tenants[0],
    window = {
      windowStart: "2026-10-20T00:00:00Z",
      windowEnd: "2026-10-21T00:00:00Z",
      brandIds: [],
    };
  const get = () =>
    local.db
      .query("select chat_notification_preview($1::jsonb,$2::jsonb) result", [
        JSON.stringify(context(t)),
        JSON.stringify(window),
      ])
      .then((r) => r.rows[0].result.totals.cost);
  const turn = (
    await local.db.query(
      "select r.*,c.id channel_id,c.brand_id from chat_turns r join chat_conversations v on v.tenant_id=r.tenant_id and v.id=r.conversation_id join chat_channels c on c.tenant_id=r.tenant_id and c.id=v.channel_id where r.tenant_id=$1 limit 1",
      [t],
    )
  ).rows[0];
  await local.db.query(
    "update chat_turns set cost_usd=1.25 where tenant_id=$1 and id=$2",
    [t, turn.id],
  );
  assert.deepEqual(await get(), { knownUsd: 1.25, unsettledCalls: 0 });
  const pack = (
    await local.db.query(
      "insert into chat_knowledge_packs(tenant_id,brand_id,version,pack_json) values($1,$2,1,'{}') returning id",
      [t, turn.brand_id],
    )
  ).rows[0].id;
  const run = (
    await local.db.query(
      "insert into chat_agent_runs(tenant_id,conversation_id,trigger_message_id,turn_id,channel_id,pack_id,pack_version) values($1,$2,$3,$4,$5,$6,1) returning id,lease_token",
      [
        t,
        turn.conversation_id,
        turn.trigger_message_id,
        turn.id,
        turn.channel_id,
        pack,
      ],
    )
  ).rows[0];
  await local.db.query(
    "insert into chat_agent_cost_entries(tenant_id,run_id,call_key,lease_token,max_usd,actual_usd,state,created_at,settled_at) values($1,$2,'understand',$3,1,0.5,'settled','2026-10-20T10:00:00Z',now())",
    [t, run.id, run.lease_token],
  );
  await local.db.query(
    "insert into chat_agent_cost_entries(tenant_id,run_id,call_key,lease_token,max_usd,state,created_at) values($1,$2,'write',$3,1,'uncertain','2026-10-20T10:00:00Z')",
    [t, run.id, run.lease_token],
  );
  assert.deepEqual(await get(), { knownUsd: 0.5, unsettledCalls: 1 });
});

test("archiving an alert brand after claim revokes authorization and records cancellation", async () => {
  const t = tenants[0],
    target = (
      await local.db.query(
        "select * from chat_notification_targets where tenant_id=$1 and label='Scheduled owner'",
        [t],
      )
    ).rows[0],
    s = (
      await local.db.query(
        "select notification_version from chat_settings where tenant_id=$1",
        [t],
      )
    ).rows[0];
  const lead = (
    await local.db.query(
      "select id,brand_id from leads where tenant_id=$1 and ref_code='NEW23'",
      [t],
    )
  ).rows[0];
  await local.db.query(
    "insert into chat_notification_outbox(tenant_id,target_id,target_version,settings_version,kind,source_key,brand_id,lead_id,payload_json) values($1,$2,$3,$4,'new_lead','qa-brand-revocation',$5,$6,$7)",
    [
      t,
      target.id,
      target.version,
      s.notification_version,
      lead.brand_id,
      lead.id,
      JSON.stringify({
        kind: "new_lead",
        brand: "Report Brand",
        leadId: lead.id,
      }),
    ],
  );
  const system = {
    tenantId: t,
    actor: { type: "SYSTEM", id: "chat-notifications" },
    source: "AUTOMATION",
    correlationId: "brand-revocation",
  };
  const call = (action, input = {}) =>
    local.db
      .query(
        "select chat_notification_dispatch($1::jsonb,$2,$3::jsonb) result",
        [JSON.stringify(system), action, JSON.stringify(input)],
      )
      .then((r) => r.rows[0].result);
  const claim = await call("claim");
  assert.equal(claim.status, "claimed");
  await local.db.query(
    "update chat_brands set is_active=false where tenant_id=$1 and id=$2",
    [t, lead.brand_id],
  );
  assert.deepEqual(
    await call("authorize", { id: claim.id, token: claim.token }),
    { allowed: false },
  );
  assert.equal(
    (
      await local.db.query(
        "select state from chat_notification_outbox where id=$1",
        [claim.id],
      )
    ).rows[0].state,
    "cancelled",
  );
  await local.db.query(
    "update chat_brands set is_active=true where tenant_id=$1 and id=$2",
    [t, lead.brand_id],
  );
});

test("operator incidents also persist one hourly claim and hold unknown receipts without exposing tenant details", async () => {
  const t = tenants[0],
    { runPlatformAlert } =
      await import("../src/features/chat/notifications/platform-worker.ts");
  const saved = { ...process.env };
  let attempts = 0,
    observed = "";
  try {
    Object.assign(process.env, {
      CHAT_FOUNDATION_ENABLED: "true",
      CHAT_NOTIFICATIONS_ENABLED: "true",
      CHAT_PLATFORM_ALERTS_ENABLED: "true",
      CHAT_DRY_RUN: "false",
    });
    const deps = {
      run: async (ctx, action, input) =>
        local.db
          .query("select chat_platform_alert($1::jsonb,$2,$3::jsonb) result", [
            JSON.stringify(ctx),
            action,
            JSON.stringify(input),
          ])
          .then((r) => r.rows[0].result),
      send: async (input) => {
        attempts++;
        observed = input.text;
        throw new Error("Unknown operator receipt");
      },
    };
    assert.equal((await runPlatformAlert(t, deps, "456")).status, "held");
    assert.equal((await runPlatformAlert(t, deps, "456")).status, "none");
    assert.equal(attempts, 1);
    assert.ok(!observed.includes(t));
    assert.ok(!observed.includes("PRIVATE"));
    assert.ok(!observed.includes("Report Brand"));
    const row = (
      await local.db.query(
        "select * from chat_platform_alert_attempts where tenant_id=$1",
        [t],
      )
    ).rows[0];
    assert.equal(row.state, "uncertain");
    assert.ok(row.recipient_enc.startsWith("gcm1."));
    assert.ok(!row.recipient_enc.includes('"chatId":"456"'));
    await local.db.query("begin");
    await local.db.query("set local role authenticated");
    await assert.rejects(
      local.db.query("select * from chat_platform_alert_attempts"),
    );
    await local.db.query("rollback");
  } finally {
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test("an audit failure rolls back target creation and its idempotency receipt together", async () => {
  const t = tenants[0],
    id = randomUUID(),
    key = randomUUID();
  await local.db.query(
    "create function chat_notification_qa_fail() returns trigger language plpgsql as $$ begin if new.event_type='chat.notification.create' then raise exception 'Synthetic audit failure';end if;return new;end $$",
  );
  await local.db.query(
    "create trigger chat_notification_qa_fail before insert on domain_events for each row execute function chat_notification_qa_fail()",
  );
  try {
    await assert.rejects(
      run(
        t,
        "create",
        { id, label: "Atomic rollback" },
        context(t, "owner", key),
      ),
    );
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from chat_notification_targets where tenant_id=$1 and id=$2",
          [t, id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from command_idempotency where tenant_id=$1 and command_type='CHAT_NOTIFICATION' and idempotency_key=$2",
          [t, key],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await local.db.query(
      "drop trigger chat_notification_qa_fail on domain_events",
    );
    await local.db.query("drop function chat_notification_qa_fail()");
  }
});

test("a stale owner tab cannot save or preview notifications for a different currently selected business", async () => {
  const { loadServerModule } =
      await import("./chat-db-harness/server-adapter.mjs"),
    schema = await import("../src/features/chat/notifications/schemas.ts"),
    summary = await import("../src/features/chat/notifications/summary.ts"),
    secrets = await import("../src/features/chat/secrets.ts"),
    { z } = await import("zod");
  const selected = tenants[1],
    expected = tenants[0];
  let calls = 0;
  const adapter = loadServerModule(
    "src/features/chat/notifications/commands.ts",
    {
      "node:crypto": await import("node:crypto"),
      zod: { z },
      "@/core/command-context/server": {
        createUserCommandContext: (c, o = {}) => ({
          ...context(c.tenant.id),
          ...o,
        }),
      },
      "../module": {
        requireChatPermission: async () => ({
          context: { tenant: { id: selected } },
          db: {
            rpc: async (name, args) => {
              calls++;
              const parameters =
                name === "chat_notification_command"
                  ? [args.p_context, args.p_action, args.p_input]
                  : [args.p_context, args.p_input];
              const sql =
                name === "chat_notification_command"
                  ? "select chat_notification_command($1::jsonb,$2,$3::jsonb) result"
                  : "select chat_notification_preview($1::jsonb,$2::jsonb) result";
              const out = await local.db.query(
                sql,
                parameters.map((v, i) =>
                  name === "chat_notification_command" && i === 1
                    ? v
                    : JSON.stringify(v),
                ),
              );
              return { data: out.rows[0].result, error: null };
            },
          },
        }),
      },
      "../schemas": { commandKeySchema: z.string().uuid() },
      "../secrets": secrets,
      "./schemas": schema,
      "./summary": summary,
      "./flags": { notificationsEnabled: () => true },
    },
  );
  await assert.rejects(
    adapter.configureNotification(
      { action: "create", input: { id: randomUUID(), label: "Stale tab" } },
      randomUUID(),
      expected,
    ),
  );
  await assert.rejects(
    adapter.previewNotificationSummary(
      {
        windowStart: "2026-10-20T00:00:00Z",
        windowEnd: "2026-10-21T00:00:00Z",
        brandIds: [],
      },
      expected,
    ),
  );
  assert.equal(calls, 0);
  const id = randomUUID();
  assert.equal(
    (
      await adapter.configureNotification(
        { action: "create", input: { id, label: "Current business" } },
        randomUUID(),
        selected,
      )
    ).id,
    id,
  );
  assert.equal(calls, 1);
});
