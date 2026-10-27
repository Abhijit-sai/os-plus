import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local, channel, workspace;
const tenant = "30000000-0000-4000-8000-000000000001",
  hash = "a".repeat(64);
const context = {
  tenantId: tenant,
  actor: { type: "WEBHOOK", id: "chatwoot" },
  source: "WEBHOOK",
  correlationId: "capture-test",
};
const message = {
  messageId: 71,
  accountId: 12,
  inboxId: 4,
  conversationId: 8,
  contactId: 91,
  status: "open",
  channelKind: "whatsapp",
  author: "customer",
  private: false,
  content: "Synthetic inquiry",
  contentType: "text",
  createdAt: "2020-01-01T10:00:00.000Z",
  staffUserId: null,
  attachments: [],
};
before(
  async () => {
    local = await startChatDatabase();
    const db = local.db;
    await db.query(
      "insert into tenants(id,name,slug,store_name) values($1,'Capture fixture','capture-fixture','Capture fixture')",
      [tenant],
    );
    await db.query(
      "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
      [tenant],
    );
    await db.query("insert into chat_settings(tenant_id) values($1)", [tenant]);
    workspace = (
      await db.query(
        "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',12,$2,$3,'gcm1.v1.synthetic','active') returning id",
        [tenant, "b".repeat(32), hash],
      )
    ).rows[0].id;
    const brand = (
      await db.query(
        "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Example','example','Example assistant') returning id",
        [tenant],
      )
    ).rows[0].id;
    channel = (
      await db.query(
        "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,4,'whatsapp','Example') returning id",
        [tenant, workspace, brand],
      )
    ).rows[0].id;
  },
  { timeout: 120000 },
);
after(async () => {
  await local?.stop();
});
const capture = (db, kind = "events", event = message, overrides = {}) =>
  db
    .query("select chat_capture($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      kind,
      JSON.stringify({
        workspaceId: workspace,
        secretHash: hash,
        channelId: channel,
        message: event,
        ...overrides,
      }),
    ])
    .then((r) => r.rows[0].result);
test("capture atomically stores one message, conversation, state and audit; agent-first replay creates one silent turn", async () => {
  const first = await capture(local.db, "agent");
  assert.equal(first.outcome, "silent");
  await capture(local.db);
  await capture(local.db, "agent");
  for (const table of [
    "chat_messages",
    "chat_conversations",
    "chat_state",
    "chat_turns",
  ])
    assert.equal(
      (
        await local.db.query(
          "select count(*)::int n from " + table + " where tenant_id=$1",
          [tenant],
        )
      ).rows[0].n,
      1,
    );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1 and event_type in ('chat.message.captured','chat.turn.silent')",
        [tenant],
      )
    ).rows[0].n,
    2,
  );
});

test("concurrent duplicate callbacks on independent connections keep one message and turn", async () => {
  const second = await local.connect();
  const event = { ...message, messageId: 72 };
  await Promise.all([
    capture(local.db, "events", event),
    capture(second, "agent", event),
    capture(local.db, "agent", event),
  ]);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_messages where tenant_id=$1 and chatwoot_message_id=72",
        [tenant],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_turns where tenant_id=$1",
        [tenant],
      )
    ).rows[0].n,
    2,
  );
});
test("public staff quiet clock is monotonic; duplicate, private, bot and system messages do not extend it", async () => {
  const db = local.db;
  const staff = {
    ...message,
    messageId: 73,
    author: "staff",
    staffUserId: 9,
    createdAt: "2020-01-01T11:00:00Z",
  };
  await capture(db, "events", staff);
  const get = async () =>
    (
      await db.query(
        "select quiet_until,last_staff_at from chat_conversations where tenant_id=$1",
        [tenant],
      )
    ).rows[0];
  const expected = await get();
  assert.equal(expected.quiet_until.toISOString(), "2020-01-01T12:00:00.000Z");
  await capture(db, "events", { ...staff, createdAt: "2020-01-01T13:00:00Z" });
  await capture(db, "events", {
    ...staff,
    messageId: 74,
    createdAt: "2020-01-01T09:00:00Z",
  });
  await capture(db, "events", {
    ...staff,
    messageId: 75,
    private: true,
    createdAt: "2020-01-01T13:00:00Z",
  });
  for (const [messageId, author] of [
    [76, "system"],
    [77, "bot"],
  ])
    await capture(db, "events", {
      ...staff,
      messageId,
      author,
      staffUserId: null,
      createdAt: "2020-01-01T14:00:00Z",
    });
  assert.deepEqual(await get(), expected);
  const before = (await db.query("select count(*)::int n from chat_turns"))
    .rows[0].n;
  await capture(db, "agent", staff);
  assert.equal(
    (await db.query("select count(*)::int n from chat_turns")).rows[0].n,
    before,
  );
});
test("account, inbox, secret, channel ownership and duplicate identity mismatch fail before persistence", async () => {
  const db = local.db;
  const before = (await db.query("select count(*)::int n from chat_messages"))
    .rows[0].n;
  for (const event of [
    { ...message, messageId: 78, accountId: 13 },
    { ...message, messageId: 78, inboxId: 5 },
    { ...message, messageId: 78, channelKind: "facebook" },
    { ...message, conversationId: 999 },
  ])
    await assert.rejects(capture(db, "events", event));
  await assert.rejects(
    capture(db, "events", message, { secretHash: "b".repeat(64) }),
  );
  await assert.rejects(
    capture(db, "events", message, {
      channelId: "30000000-0000-4000-8000-000000000099",
    }),
  );
  assert.equal(
    (await db.query("select count(*)::int n from chat_messages")).rows[0].n,
    before,
  );
});
test("two tenants with identical provider ids stay separate and composite references reject crossing", async () => {
  const db = local.db,
    other = "40000000-0000-4000-8000-000000000001";
  await db.query(
    "insert into tenants(id,name,slug,store_name) values($1,'Other','other-capture','Other')",
    [other],
  );
  const conv = (
    await db.query("select id from chat_conversations where tenant_id=$1", [
      tenant,
    ])
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "insert into chat_state(tenant_id,conversation_id) values($1,$2)",
      [other, conv],
    ),
    { code: "23503" },
  );
  await db.query(
    "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
    [other],
  );
  const ws = (
    await db.query(
      "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',13,$2,$3,'gcm1.v1.synthetic','active') returning id",
      [other, "c".repeat(32), hash],
    )
  ).rows[0].id;
  const brand = (
    await db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Other','other','Other') returning id",
      [other],
    )
  ).rows[0].id;
  const ch = (
    await db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,4,'whatsapp','Other') returning id",
      [other, ws, brand],
    )
  ).rows[0].id;
  const args = [
    JSON.stringify({ ...context, tenantId: other }),
    "events",
    JSON.stringify({
      workspaceId: ws,
      channelId: ch,
      secretHash: hash,
      message: { ...message, accountId: 13 },
    }),
  ];
  await db.query("select chat_capture($1::jsonb,$2,$3::jsonb)", args);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_messages where chatwoot_message_id=71",
      )
    ).rows[0].n,
    2,
  );
  await assert.rejects(
    capture(db, "events", message, { workspaceId: ws, channelId: ch }),
  );
});
test("disabled module/workspace and off agent are rechecked at execution; events still capture in off mode", async () => {
  const db = local.db;
  await db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [tenant],
  );
  await assert.rejects(capture(db));
  await db.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [tenant],
  );
  await db.query("update chat_workspaces set status='suspended' where id=$1", [
    workspace,
  ]);
  await assert.rejects(capture(db));
  await db.query("update chat_workspaces set status='active' where id=$1", [
    workspace,
  ]);
  await db.query("update chat_channels set agent_mode='off' where id=$1", [
    channel,
  ]);
  assert.equal(
    (await capture(db, "agent", { ...message, messageId: 79 })).outcome,
    "ignored",
  );
  assert.equal(
    (await capture(db, "events", { ...message, messageId: 79 })).outcome,
    "captured",
  );
  await db.query("update chat_channels set agent_mode='draft' where id=$1", [
    channel,
  ]);
});
test("audit failure rolls back the entire capture transaction; browser SQL roles cannot read or execute", async () => {
  const db = local.db;
  await db.query(
    "create function fail_capture_audit() returns trigger language plpgsql as $$ begin raise exception 'Synthetic audit failure'; end $$; create trigger fail_capture before insert on domain_events for each row execute function fail_capture_audit()",
  );
  await assert.rejects(
    capture(db, "events", { ...message, messageId: 80, conversationId: 80 }),
    /Synthetic audit failure/,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_conversations where chatwoot_conversation_id=80",
      )
    ).rows[0].n,
    0,
  );
  await db.query(
    "drop trigger fail_capture on domain_events;drop function fail_capture_audit()",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.query("set role " + role);
    try {
      for (const table of [
        "chat_conversations",
        "chat_messages",
        "chat_state",
        "chat_turns",
      ])
        await assert.rejects(db.query("select * from " + table), {
          code: "42501",
        });
      await assert.rejects(capture(db), { code: "42501" });
    } finally {
      await db.query("reset role");
    }
  }
  await db.query("set role service_role");
  try {
    assert.equal((await capture(db)).outcome, "captured");
  } finally {
    await db.query("reset role");
  }
});

test("actual HTTP ingress resolves URL authority, acknowledges before work, and writes through the production adapter", async () => {
  const { createServer } = await import("node:http");
  const { createHash } = await import("node:crypto");
  const { handleChatwootWebhook } =
    await import("../src/features/chat/ingress.ts");
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const db = local.db,
    base = postgresAdapter(db),
    pending = [];
  const adapter = {
    ...base,
    async rpc(name, args) {
      try {
        const sql =
          name === "chat_capture"
            ? "select chat_capture($1::jsonb,$2,$3::jsonb) result"
            : "select chat_capture_issue($1::jsonb,$2::jsonb) result";
        const values =
          name === "chat_capture"
            ? [
                JSON.stringify(args.p_context),
                args.p_kind,
                JSON.stringify(args.p_input),
              ]
            : [JSON.stringify(args.p_context), JSON.stringify(args.p_input)];
        return {
          data: (await db.query(sql, values)).rows[0].result,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
  const { chatCaptureDependencies } = loadServerModule(
    "src/features/chat/capture.ts",
    {
      zod: await import("zod"),
      "node:crypto": await import("node:crypto"),
      "../leads/rules": await import("../src/features/leads/rules.ts"),
      "./notifications/trigger": { scheduleNotificationCheck: async () => {} },
      "@/lib/supabase/server": {
        createSupabaseServiceRoleClient: () => adapter,
      },
    },
  );
  const deps = chatCaptureDependencies((work) => pending.push(work));
  const token = "synthetic-webhook-secret-never-live-0001";
  await db.query(
    "update chat_workspaces set webhook_secret_hash=$1 where id=$2",
    [createHash("sha256").update(token).digest("hex"), workspace],
  );
  const previous = process.env.CHAT_FOUNDATION_ENABLED;
  process.env.CHAT_FOUNDATION_ENABLED = "true";
  const key = "b".repeat(32);
  const event = {
    event: "message_created",
    id: 81,
    account: { id: 12 },
    inbox: { id: 4 },
    conversation: {
      id: 8,
      inbox_id: 4,
      status: "open",
      channel: "Channel::Whatsapp",
      meta: { sender: { id: 91 } },
    },
    message_type: "incoming",
    private: false,
    content: "HTTP inquiry",
    content_type: "text",
    created_at: "2020-01-01T10:00:00Z",
    sender: { id: 91, type: "contact" },
  };
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const url = "http://127.0.0.1" + req.url,
        path = new URL(url).pathname.split("/");
      const request = new Request(url, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: Buffer.concat(chunks),
      });
      const result = await handleChatwootWebhook(
        request,
        path.at(-2),
        path.at(-1),
        deps,
      );
      res.writeHead(result.status);
      res.end();
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const send = (body = event, secret = token, urlKey = key, kind = "events") =>
    fetch(
      "http://127.0.0.1:" +
        server.address().port +
        "/" +
        urlKey +
        "/" +
        kind +
        "?token=" +
        encodeURIComponent(secret),
      { method: "POST", body: JSON.stringify(body) },
    );
  const flush = async () => {
    while (pending.length) await pending.shift()();
  };
  try {
    assert.equal((await send()).status, 200);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from chat_messages where chatwoot_message_id=81",
        )
      ).rows[0].n,
      0,
    );
    await flush();
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from chat_messages where chatwoot_message_id=81",
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await send(event, "wrong")).status, 404);
    assert.equal((await send(event, token, "c".repeat(32))).status, 404);
    assert.equal((await send({ ...event, account: { id: 13 } })).status, 404);
    assert.equal((await send({ ...event, id: 0 })).status, 400);
    const unknown = {
      ...event,
      inbox: { id: 999 },
      conversation: { ...event.conversation, inbox_id: 999 },
    };
    assert.equal((await send(unknown)).status, 200);
    await flush();
    assert.equal(
      (
        await db.query("select last_error from chat_workspaces where id=$1", [
          workspace,
        ])
      ).rows[0].last_error,
      "unknown_inbox",
    );
    assert.equal(
      (await send({ ...event, id: 82 }, token, key, "agent")).status,
      200,
    );
    await db.query(
      "update tenant_modules set is_enabled=false where tenant_id=$1",
      [tenant],
    );
    await flush();
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from chat_messages where chatwoot_message_id=82",
        )
      ).rows[0].n,
      0,
    );
    assert.equal((await send()).status, 404);
    await db.query(
      "update tenant_modules set is_enabled=true where tenant_id=$1",
      [tenant],
    );
    process.env.CHAT_FOUNDATION_ENABLED = "false";
    assert.equal((await send()).status, 404);
  } finally {
    if (previous === undefined) delete process.env.CHAT_FOUNDATION_ENABLED;
    else process.env.CHAT_FOUNDATION_ENABLED = previous;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("capture shares the configuration lock before rows, preventing suspension and archive lock inversions", async () => {
  const admin = await local.connect(),
    worker = await local.connect(),
    inspect = local.db;
  const pid = (await worker.query("select pg_backend_pid() pid")).rows[0].pid;
  await admin.query(
    "insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'capture-owner','owner_admin','active')",
    [tenant],
  );
  await admin.query(
    "update chat_workspaces set webhook_secret_hash=$1 where id=$2",
    [hash, workspace],
  );
  for (const action of ["module.set", "workspace.suspend", "brand.archive"]) {
    await admin.query("begin");
    await admin.query(
      "select pg_advisory_xact_lock(hashtextextended('chat-config:'||$1,0))",
      [tenant],
    );
    const result = capture(worker, "events", {
      ...message,
      messageId: 90,
    }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    let blocked = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      blocked = (
        await inspect.query(
          "select exists(select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted) blocked",
          [pid],
        )
      ).rows[0].blocked;
      if (blocked) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!blocked) {
      await admin.query("rollback");
      await result;
      assert.fail("Capture did not wait on the configuration advisory lock");
    }
    const ctx = {
      tenantId: tenant,
      actor: { type: "USER", id: "capture-owner" },
      source: "OS_PLUS_UI",
      correlationId: "race",
      idempotencyKey: action,
    };
    if (action === "brand.archive") {
      const brand = (
        await admin.query("select brand_id from chat_channels where id=$1", [
          channel,
        ])
      ).rows[0].brand_id;
      await admin.query("select chat_configure($1::jsonb,$2,$3::jsonb)", [
        JSON.stringify(ctx),
        action,
        JSON.stringify({ id: brand }),
      ]);
    } else
      await admin.query(
        "select chat_platform_configure($1::jsonb,$2,$3::jsonb)",
        [JSON.stringify(ctx), action, JSON.stringify({ enabled: false })],
      );
    await admin.query("commit");
    const outcome = await result;
    assert.ok(outcome.error, "Capture must see completed revocation");
    assert.notEqual(outcome.error.code, "40P01", "No deadlock");
    await admin.query(
      "update chat_workspaces set status='active' where id=$1",
      [workspace],
    );
    await admin.query(
      "update tenant_modules set is_enabled=true where tenant_id=$1",
      [tenant],
    );
    await admin.query(
      "update chat_brands set is_active=true,deleted_at=null where tenant_id=$1",
      [tenant],
    );
    await admin.query("update chat_channels set is_active=true where id=$1", [
      channel,
    ]);
  }
});

test("transport reservations serialize create authority, reconcile completion and keep bot secrets out of receipts/audit", async () => {
  const db = local.db,
    other = await local.connect();
  const ctx = {
    tenantId: tenant,
    actor: { type: "USER", id: "capture-platform-owner" },
    source: "OS_PLUS_UI",
    correlationId: "setup-test",
  };
  const input = {
    workspaceId: workspace,
    secretHash: hash,
    requestHash: "d".repeat(64),
    stage: "bot",
  };
  const call = (client, action, extra = {}) =>
    client
      .query("select chat_transport_setup($1::jsonb,$2,$3::jsonb) result", [
        JSON.stringify(ctx),
        action,
        JSON.stringify({ ...input, ...extra }),
      ])
      .then((r) => r.rows[0].result);
  const results = await Promise.all([call(db, "begin"), call(other, "begin")]);
  assert.equal(results.filter((r) => r.started).length, 1);
  assert.equal(results.filter((r) => !r.started).length, 1);
  await assert.rejects(
    call(db, "complete", { remoteId: 31 }),
    /Missing bot credential/,
  );
  await call(db, "complete", {
    remoteId: 31,
    botTokenEnc: "gcm1.v1.encrypted-bot-credential",
  });
  await call(db, "complete", {
    remoteId: 31,
    botTokenEnc: "gcm1.v1.encrypted-bot-credential",
  });
  assert.deepEqual(await call(db, "begin"), {
    started: false,
    completedId: 31,
  });
  await assert.rejects(
    call(db, "complete", { remoteId: 32 }),
    /identity mismatch/,
  );
  const receipts = await db.query(
    "select result_json from command_idempotency where tenant_id=$1 and command_type='chat.transport.setup'",
    [tenant],
  );
  const audit = await db.query(
    "select payload_json from domain_events where tenant_id=$1 and event_type like 'chat.transport.%'",
    [tenant],
  );
  assert.equal(
    JSON.stringify([receipts.rows, audit.rows]).includes(
      "encrypted-bot-credential",
    ),
    false,
  );
  assert.equal(audit.rowCount, 2);
  await db.query("set role authenticated");
  try {
    await assert.rejects(call(db, "begin"), { code: "42501" });
  } finally {
    await db.query("reset role");
  }
});
