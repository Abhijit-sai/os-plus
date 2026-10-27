import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local;
before(
  async () => {
    local = await startChatDatabase();
  },
  { timeout: 120000 },
);
after(async () => {
  await local?.stop();
});
const A = "10000000-0000-4000-8000-000000000001",
  B = "20000000-0000-4000-8000-000000000001";
test("new tenants have no enabled chat module and cannot cross-link brand branches", async () => {
  const db = local.db;
  await db.query(
    "insert into tenants(id,name,slug,store_name) values($1,'Synthetic A','chat-test-a','Synthetic A'),($2,'Synthetic B','chat-test-b','Synthetic B')",
    [A, B],
  );
  assert.equal(
    (
      await db.query(
        "select * from tenant_modules where tenant_id=$1 and is_enabled",
        [A],
      )
    ).rowCount,
    0,
  );
  const brand = (
    await db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Example','example','Example assistant') returning id",
      [A],
    )
  ).rows[0].id;
  const location = (
    await db.query(
      "insert into tenant_locations(tenant_id,code,name) values($1,'other','Other') returning id",
      [B],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "insert into chat_brand_locations(tenant_id,brand_id,location_id) values($1,$2,$3)",
      [A, brand, location],
    ),
    { code: "23503" },
  );
});

const ctx = {
  tenantId: A,
  actor: { type: "USER", id: "chat-owner-a" },
  source: "OS_PLUS_UI",
  correlationId: "chat-test-correlation",
  idempotencyKey: "brand-first",
};
const command = (db, context, action, input) =>
  db
    .query("select chat_configure($1::jsonb,$2,$3::jsonb) as result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
test("brand commands authorize the active owner, atomically audit, and replay without duplicate writes", async () => {
  const db = local.db;
  await db.query(
    "insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'chat-owner-a','owner_admin','active'),($1,'chat-manager-a','manager','active')",
    [A],
  );
  await db.query(
    "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
    [A],
  );
  const input = {
    name: "Command brand",
    slug: "command-brand",
    personaName: "Example assistant",
  };
  const first = await command(db, ctx, "brand.save", input);
  const replay = await command(db, ctx, "brand.save", input);
  assert.deepEqual(first, replay);
  assert.equal(
    (
      await db.query(
        "select * from domain_events where tenant_id=$1 and aggregate_id=$2",
        [A, first.id],
      )
    ).rowCount,
    1,
  );
  await assert.rejects(
    command(
      db,
      {
        ...ctx,
        actor: { type: "USER", id: "chat-manager-a" },
        idempotencyKey: "manager",
      },
      "brand.save",
      { ...input, slug: "unauthorized" },
    ),
    /Chat access denied/,
  );
  await assert.rejects(
    command(db, { ...ctx, tenantId: B }, "brand.save", input),
    /Chat access denied/,
  );
  await assert.rejects(
    command(db, ctx, "brand.save", { ...input, name: "Changed" }),
    /Idempotency key reused/,
  );
  const before = (
    await db.query("select count(*) from chat_brands where tenant_id=$1", [A])
  ).rows[0].count;
  await assert.rejects(
    command(
      db,
      { ...ctx, idempotencyKey: "invalid-audit", correlationId: "" },
      "brand.save",
      { ...input, slug: "rollback" },
    ),
  );
  assert.equal(
    (await db.query("select count(*) from chat_brands where tenant_id=$1", [A]))
      .rows[0].count,
    before,
  );
});

test("branch mapping and concurrent knowledge revisions stay tenant-owned and publish one immutable active revision", async () => {
  const db = local.db,
    other = await local.connect();
  const brand = (
    await db.query(
      "select id from chat_brands where tenant_id=$1 and slug='command-brand'",
      [A],
    )
  ).rows[0].id;
  const location = (
    await db.query(
      "insert into tenant_locations(tenant_id,code,name) values($1,'north','North') returning id",
      [A],
    )
  ).rows[0].id;
  await command(db, { ...ctx, idempotencyKey: "map" }, "branch.map", {
    brandId: brand,
    locationId: location,
  });
  const { readFileSync } = await import("node:fs");
  const pack = JSON.parse(
    readFileSync(
      new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
      "utf8",
    ),
  );
  const south = (
    await db.query(
      "insert into tenant_locations(tenant_id,code,name) values($1,'south','South') returning id",
      [A],
    )
  ).rows[0].id;
  await command(db, { ...ctx, idempotencyKey: "map-south" }, "branch.map", {
    brandId: brand,
    locationId: south,
  });
  pack.areas = [
    { locationCode: "north", served: [], postalCodes: [] },
    { locationCode: "south", served: [], postalCodes: [] },
  ];
  assert.equal(
    (
      await db.query(
        "select * from chat_brand_locations where tenant_id=$1 and brand_id=$2",
        [A, brand],
      )
    ).rowCount,
    2,
  );
  const revisions = await Promise.all(
    [db, other].map((client, n) =>
      command(client, { ...ctx, idempotencyKey: "pack-" + n }, "pack.save", {
        brandId: brand,
        pack,
      }),
    ),
  );
  assert.notEqual(revisions[0].id, revisions[1].id);
  const versions = await db.query(
    "select version from chat_knowledge_packs where tenant_id=$1 and brand_id=$2 order by version",
    [A, brand],
  );
  assert.deepEqual(
    versions.rows.map((r) => r.version),
    [1, 2],
  );
  await Promise.all(
    [db, other].map((client, n) =>
      command(
        client,
        { ...ctx, idempotencyKey: "publish-" + n },
        "pack.publish",
        { id: revisions[n].id },
      ),
    ),
  );
  assert.equal(
    (
      await db.query(
        "select * from chat_knowledge_packs where tenant_id=$1 and status='published'",
        [A],
      )
    ).rowCount,
    1,
  );
  await assert.rejects(
    db.query(
      "update chat_knowledge_packs set pack_json='{}' where tenant_id=$1",
      [A],
    ),
    /Knowledge revisions are immutable/,
  );
  await assert.rejects(
    command(db, { ...ctx, idempotencyKey: "bad-branch" }, "branch.map", {
      brandId: brand,
      locationId: "20000000-0000-4000-8000-000000000009",
    }),
    /Chat branch unavailable/,
  );
});

test("workspace/channel/staff/notification references enforce tenant ownership and channel defaults", async () => {
  const db = local.db;
  const workspace = (
    await db.query(
      "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash) values($1,'https://chat.example.invalid',10,repeat('a',32),repeat('b',64)) returning id",
      [A],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash) values($1,'https://chat.example.invalid',10,repeat('c',32),repeat('d',64))",
      [B],
    ),
    { code: "23505" },
  );
  const brand = (
    await db.query(
      "select id from chat_brands where tenant_id=$1 and slug='command-brand'",
      [A],
    )
  ).rows[0].id;
  const foreignBrand = (
    await db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Foreign','foreign','Assistant') returning id",
      [B],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,5,'whatsapp','Example')",
      [A, workspace, foreignBrand],
    ),
    { code: "23503" },
  );
  const channel = (
    await db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,5,'whatsapp','Example') returning *",
      [A, workspace, brand],
    )
  ).rows[0];
  assert.equal(channel.agent_mode, "draft");
  assert.equal(channel.can_book, false);
  assert.equal(channel.can_share_statement, false);
  const foreignMember = (
    await db.query(
      "insert into tenant_users(tenant_id,clerk_user_id,role,status) values($1,'other-owner','owner_admin','active') returning id",
      [B],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,9)",
      [A, foreignMember],
    ),
    { code: "23503" },
  );
  const target = (
    await db.query(
      "insert into chat_notification_targets(tenant_id,label) values($1,'Example alerts') returning id",
      [A],
    )
  ).rows[0].id;
  await assert.rejects(
    db.query(
      "insert into chat_notification_target_brands(tenant_id,target_id,brand_id) values($1,$2,$3)",
      [A, target, foreignBrand],
    ),
    { code: "23503" },
  );
});

test("owner grants are audited, channel setup stays draft, and settings and summaries stay tenant-owned", async () => {
  const db = local.db;
  await command(db, { ...ctx, idempotencyKey: "grant-view" }, "role.grant", {
    role: "viewer",
    permission: "leads:view",
    allowed: true,
  });
  assert.equal(
    (
      await db.query(
        "select allowed from chat_role_permissions where tenant_id=$1 and role='viewer'",
        [A],
      )
    ).rows[0].allowed,
    true,
  );
  await assert.rejects(
    command(db, { ...ctx, idempotencyKey: "bad-grant" }, "role.grant", {
      role: "viewer",
      permission: "leads:manage",
      allowed: true,
    }),
  );
  const channel = (
    await db.query("select * from chat_channels where tenant_id=$1", [A])
  ).rows[0];
  await command(db, { ...ctx, idempotencyKey: "channel-map" }, "channel.map", {
    workspaceId: channel.workspace_id,
    brandId: channel.brand_id,
    inboxId: 5,
    kind: "whatsapp",
    name: "Mapped inbox",
    locationId: null,
  });
  assert.equal(
    (
      await db.query("select agent_mode from chat_channels where id=$1", [
        channel.id,
      ])
    ).rows[0].agent_mode,
    "draft",
  );
  await db.query("insert into chat_settings(tenant_id) values($1)", [A]);
  await db.query(
    "insert into chat_summary_runs(tenant_id,local_date) values($1,'2026-10-21')",
    [A],
  );
  await assert.rejects(
    db.query(
      "insert into chat_summary_runs(tenant_id,local_date) values($1,'2026-10-21')",
      [A],
    ),
    { code: "23505" },
  );
});

test("browser roles cannot read configuration or invoke commands, and service writes require commands", async () => {
  const db = await local.connect();
  for (const role of ["anon", "authenticated"]) {
    await db.query("set role " + role);
    for (const table of [
      "tenant_modules",
      "chat_settings",
      "chat_workspaces",
      "chat_brands",
      "chat_brand_locations",
      "chat_knowledge_packs",
      "chat_channels",
      "chat_role_permissions",
      "chat_staff_links",
      "chat_notification_targets",
      "chat_notification_target_brands",
      "chat_summary_runs",
    ]) {
      await assert.rejects(db.query("select * from " + table), {
        code: "42501",
      });
    }
    await assert.rejects(command(db, ctx, "brand.save", {}), { code: "42501" });
    await db.query("reset role");
  }
  // Verify default-deny RLS independently of ACL denial.
  await db.query("begin");
  await db.query("grant select on chat_brands to authenticated");
  await db.query("set local role authenticated");
  assert.equal((await db.query("select * from chat_brands")).rowCount, 0);
  await db.query("rollback");
  await db.query("set role service_role");
  await assert.rejects(
    db.query("update chat_brands set name='Bypass' where tenant_id=$1", [A]),
    { code: "42501" },
  );
  const result = await command(
    db,
    { ...ctx, idempotencyKey: "service-command" },
    "brand.save",
    { name: "Via command", slug: "via-command", personaName: "Assistant" },
  );
  assert.ok(result.id);
  await db.query("reset role");
});
test("an audit insertion failure rolls back configuration and idempotency; concurrent retry writes once", async () => {
  const db = local.db,
    second = await local.connect();
  await db.query(`create function test_chat_audit_failure() returns trigger language plpgsql as $$
 begin if new.correlation_id='force-audit-failure' then raise exception 'Synthetic audit outage'; end if;return new;end;$$;
 create trigger test_chat_audit_failure before insert on domain_events for each row execute function test_chat_audit_failure();`);
  const input = { name: "Atomic", slug: "atomic", personaName: "Assistant" };
  await assert.rejects(
    command(
      db,
      {
        ...ctx,
        idempotencyKey: "atomic",
        correlationId: "force-audit-failure",
      },
      "brand.save",
      input,
    ),
    /Synthetic audit outage/,
  );
  assert.equal(
    (
      await db.query(
        "select * from chat_brands where tenant_id=$1 and slug='atomic'",
        [A],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from command_idempotency where tenant_id=$1 and idempotency_key='atomic'",
        [A],
      )
    ).rowCount,
    0,
  );
  const results = await Promise.all(
    [db, second].map((client) =>
      command(
        client,
        { ...ctx, idempotencyKey: "atomic" },
        "brand.save",
        input,
      ),
    ),
  );
  assert.deepEqual(results[0], results[1]);
  assert.equal(
    (
      await db.query(
        "select * from domain_events where tenant_id=$1 and aggregate_id=$2",
        [A, results[0].id],
      )
    ).rowCount,
    1,
  );
  await db.query(
    "drop trigger test_chat_audit_failure on domain_events;drop function test_chat_audit_failure()",
  );
});

const platform = (db, context, action, input) =>
  db
    .query("select chat_platform_configure($1::jsonb,$2,$3::jsonb) as result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
test("platform provisioning persists a single remote attempt and enables explicitly without exposing secrets in audit", async () => {
  const db = local.db,
    second = await local.connect();
  const pc = {
    ...ctx,
    tenantId: B,
    actor: { type: "USER", id: "synthetic-super-admin" },
    idempotencyKey: "prepare",
  };
  const prepared = await platform(db, pc, "workspace.prepare", {
    id: "20000000-0000-4000-8000-000000000002",
    origin: "https://chat.example.invalid",
    workspaceKey: "w".repeat(32),
    secretHash: "f".repeat(64),
  });
  assert.ok(prepared.id);
  const reserve = { ...pc, idempotencyKey: "reserve" };
  const claims = await Promise.all(
    [db, second].map((client) =>
      platform(client, reserve, "workspace.reserve", { id: prepared.id }),
    ),
  );
  assert.equal(claims.filter((r) => r.claimed).length, 1);
  await assert.rejects(
    platform(
      db,
      { ...pc, idempotencyKey: "reserve-again" },
      "workspace.reserve",
      { id: prepared.id },
    ),
    /Reconcile the pending account/,
  );
  const encryption = "gcm1.v1.synthetic.encrypted.value";
  await platform(db, { ...pc, idempotencyKey: "link" }, "workspace.link", {
    id: prepared.id,
    accountId: 20,
    apiTokenEnc: encryption,
  });
  await platform(db, { ...pc, idempotencyKey: "enable" }, "module.set", {
    enabled: true,
  });
  assert.equal(
    (
      await db.query(
        "select is_enabled from tenant_modules where tenant_id=$1",
        [B],
      )
    ).rows[0].is_enabled,
    true,
  );
  const audits = await db.query(
    "select payload_json from domain_events where tenant_id=$1",
    [B],
  );
  assert.ok(!JSON.stringify(audits.rows).includes(encryption));
  assert.ok(!JSON.stringify(audits.rows).includes("secretHash"));
  await db.query("set role authenticated");
  await assert.rejects(platform(db, pc, "module.set", { enabled: true }), {
    code: "42501",
  });
  await db.query("reset role");
});

test("archiving a brand preserves its history and disables its channels atomically", async () => {
  const db = local.db;
  const brand = (
    await db.query(
      "select id from chat_brands where tenant_id=$1 and slug='example'",
      [A],
    )
  ).rows[0].id;
  const workspace = (
    await db.query("select id from chat_workspaces where tenant_id=$1", [A])
  ).rows[0].id;
  await db.query(
    "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,77,'website','Archive example')",
    [A, workspace, brand],
  );
  await command(
    db,
    { ...ctx, idempotencyKey: "archive-brand" },
    "brand.archive",
    { id: brand },
  );
  const archived = (
    await db.query(
      "select is_active,deleted_at from chat_brands where tenant_id=$1 and id=$2",
      [A, brand],
    )
  ).rows[0];
  assert.equal(archived.is_active, false);
  const archivedChannels = (
    await db.query(
      "select is_active,agent_mode from chat_channels where tenant_id=$1 and brand_id=$2",
      [A, brand],
    )
  ).rows;
  assert.ok(archivedChannels.length > 0);
  assert.ok(
    archivedChannels.every((c) => !c.is_active && c.agent_mode === "off"),
  );
  assert.ok(archived.deleted_at);
  await assert.rejects(
    command(db, { ...ctx, idempotencyKey: "edit-archived" }, "brand.save", {
      id: brand,
      name: "Changed",
      slug: "example",
      personaName: "Assistant",
    }),
    /Chat record unavailable/,
  );
});

test("retrying one-time preparation and rotation recovers receipts without replacing stored secrets", async () => {
  const db = local.db,
    pc = {
      ...ctx,
      tenantId: B,
      actor: { type: "USER", id: "synthetic-super-admin" },
      idempotencyKey: "prepare",
    };
  const repeated = await platform(db, pc, "workspace.prepare", {
    id: "20000000-0000-4000-8000-000000000003",
    origin: "https://chat.example.invalid",
    workspaceKey: "z".repeat(32),
    secretHash: "e".repeat(64),
  });
  assert.equal(repeated.id, "20000000-0000-4000-8000-000000000002");
  assert.equal(repeated.replayed, true);
  assert.equal(
    (
      await db.query(
        "select workspace_key from chat_workspaces where tenant_id=$1",
        [B],
      )
    ).rows[0].workspace_key,
    "w".repeat(32),
  );
  const rotation = { ...pc, idempotencyKey: "rotate" };
  await platform(db, rotation, "workspace.rotate", {
    id: repeated.id,
    secretHash: "a".repeat(64),
  });
  assert.equal(
    (
      await platform(db, rotation, "workspace.rotate", {
        id: repeated.id,
        secretHash: "b".repeat(64),
      })
    ).replayed,
    true,
  );
  assert.equal(
    (
      await db.query(
        "select webhook_secret_hash from chat_workspaces where tenant_id=$1",
        [B],
      )
    ).rows[0].webhook_secret_hash,
    "a".repeat(64),
  );
  const linking = { ...pc, idempotencyKey: "link-retry" },
    tokenHash = "d".repeat(64);
  await platform(db, linking, "workspace.link", {
    id: repeated.id,
    accountId: 20,
    apiTokenEnc: "gcm1.v1.first.cipher.value",
    tokenHash,
  });
  assert.equal(
    (
      await platform(db, linking, "workspace.link", {
        id: repeated.id,
        accountId: 20,
        apiTokenEnc: "gcm1.v1.new.cipher.value",
        tokenHash,
      })
    ).replayed,
    true,
  );
  assert.equal(
    (
      await db.query(
        "select api_token_enc from chat_workspaces where tenant_id=$1",
        [B],
      )
    ).rows[0].api_token_enc,
    "gcm1.v1.first.cipher.value",
  );
  await assert.rejects(
    platform(db, linking, "workspace.link", {
      id: repeated.id,
      accountId: 20,
      apiTokenEnc: "gcm1.v1.other.cipher.value",
      tokenHash: "c".repeat(64),
    }),
    /Idempotency key reused/,
  );
});
test("grant history records safe before and after values atomically", async () => {
  const db = local.db;
  await command(db, { ...ctx, idempotencyKey: "revoke-view" }, "role.grant", {
    role: "viewer",
    permission: "leads:view",
    allowed: false,
  });
  const events = (
    await db.query(
      "select payload_json from domain_events where tenant_id=$1 and event_type='chat.role.grant' order by occurred_at",
      [A],
    )
  ).rows.map((r) => r.payload_json);
  assert.deepEqual(events, [
    {
      role: "viewer",
      permission: "leads:view",
      beforeAllowed: false,
      allowed: true,
    },
    {
      role: "viewer",
      permission: "leads:view",
      beforeAllowed: true,
      allowed: false,
    },
  ]);
});

test("production server commands replay committed publication before checking draft state", async () => {
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const zod = await import("zod"),
    schemas = await import("../src/features/chat/schemas.ts"),
    knowledge = await import("../src/features/chat/knowledge-pack.ts"),
    actionRules = await import("../src/features/chat/actions/rules.ts");
  const db = postgresAdapter(local.db);
  let tenant = A,
    actor = "chat-owner-a",
    networkCalls = 0;
  const guard = async () => ({
    context: { tenant: { id: tenant, store_name: "Synthetic" } },
    db,
  });
  const { configureChat } = loadServerModule("src/features/chat/commands.ts", {
    z: zod.z,
    zod,
    "./schemas": schemas,
    "./knowledge-pack": knowledge,
    "./actions/rules": actionRules,
    "./module": { requireChatPermission: guard },
    "@/core/command-context/server": {
      createUserCommandContext: (_context, options) => ({
        ...ctx,
        tenantId: tenant,
        actor: { type: "USER", id: actor },
        ...options,
      }),
    },
    "./connection": {
      accountClient: () => ({
        listInboxes: async () => {
          networkCalls++;
          return [{ id: 5, name: "Verified inbox", kind: "whatsapp" }];
        },
      }),
    },
  });
  const brand = (
    await local.db.query(
      "select id from chat_brands where tenant_id=$1 and slug='command-brand'",
      [A],
    )
  ).rows[0].id;
  const pack = (
    await local.db.query(
      "select pack_json from chat_knowledge_packs where tenant_id=$1 and brand_id=$2 limit 1",
      [A, brand],
    )
  ).rows[0].pack_json;
  const { randomUUID } = await import("node:crypto");
  pack.booking = { capability: "follow_up_task" };
  const saveKey = randomUUID(),
    publishKey = randomUUID();
  const saved = await configureChat(
    { action: "pack.save", input: { brandId: brand, pack } },
    saveKey,
  );
  assert.equal(
    (
      await configureChat(
        { action: "pack.save", input: { brandId: brand, pack } },
        saveKey,
      )
    ).id,
    saved.id,
  );
  const published = await configureChat(
    { action: "pack.publish", input: { id: saved.id } },
    publishKey,
  );
  assert.equal(
    (
      await configureChat(
        { action: "pack.publish", input: { id: saved.id } },
        publishKey,
      )
    ).id,
    published.id,
  );
  const channel = (
      await local.db.query("select * from chat_channels where tenant_id=$1", [
        A,
      ])
    ).rows[0],
    channelKey = randomUUID();
  const mapping = {
    action: "channel.map",
    input: {
      workspaceId: channel.workspace_id,
      brandId: brand,
      locationId: null,
      inboxId: 5,
      kind: "whatsapp",
      name: "Untrusted label",
    },
  };
  await configureChat(mapping, channelKey);
  await configureChat(mapping, channelKey);
  assert.equal(networkCalls, 1);
  tenant = B;
  actor = "other-owner";
  await assert.rejects(
    configureChat(
      { action: "pack.publish", input: { id: saved.id } },
      randomUUID(),
    ),
    /Draft unavailable/,
  );
  await assert.rejects(
    configureChat(
      {
        action: "brand.save",
        input: {
          id: brand,
          name: "Cross tenant",
          slug: "cross",
          personaName: "Assistant",
        },
      },
      randomUUID(),
    ),
    /not saved/,
  );
  tenant = A;
  actor = "chat-manager-a";
  await assert.rejects(
    configureChat(
      { action: "pack.publish", input: { id: saved.id } },
      publishKey,
    ),
    /not saved/,
  );
});

test("production knowledge reads keep each brand published revision and paginate tenant-owned history", async () => {
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const zod = await import("zod"),
    knowledge = await import("../src/features/chat/knowledge-pack.ts"),
    db = postgresAdapter(local.db);
  const brand = (
    await local.db.query(
      "select id from chat_brands where tenant_id=$1 and slug='command-brand'",
      [A],
    )
  ).rows[0].id;
  const pack = (
    await local.db.query(
      "select pack_json from chat_knowledge_packs where tenant_id=$1 and brand_id=$2 limit 1",
      [A, brand],
    )
  ).rows[0].pack_json;
  const second = await command(
    local.db,
    { ...ctx, idempotencyKey: "second-history-brand" },
    "brand.save",
    {
      name: "Second history",
      slug: "second-history",
      personaName: "Assistant",
    },
  );
  const secondPack = await command(
    local.db,
    { ...ctx, idempotencyKey: "second-history-pack" },
    "pack.save",
    { brandId: second.id, pack },
  );
  await local.db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,pack_json) select $1,$2,n,$3::jsonb from generate_series(100,310) n",
    [A, brand, JSON.stringify(pack)],
  );
  let tenant = A;
  const queries = loadServerModule("src/features/chat/queries.ts", {
    zod,
    "./knowledge-pack": knowledge,
    "./module": {
      requireChatPermission: async () => ({
        context: { tenant: { id: tenant, store_name: "Synthetic" } },
        db,
      }),
      isChatFoundationEnabled: () => true,
    },
    "@/lib/auth/super-admin": { requireSuperAdmin: async () => "super" },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
  });
  const setup = await queries.getChatSetup();
  assert.ok(setup.packs.some((p) => p.id === secondPack.id));
  assert.ok(
    setup.packs.some((p) => p.brand_id === brand && p.status === "published"),
  );
  assert.ok(setup.packs.every((p) => !("pack_json" in p)));
  const first = await queries.getChatKnowledge({ brandId: brand });
  assert.equal(first.revisions.length, 20);
  assert.equal(first.revisions[0].version, 310);
  const page = await queries.getChatKnowledge({
    brandId: brand,
    beforeVersion: first.olderBefore,
  });
  assert.equal(page.revisions[0].version, 290);
  const full = await queries.getChatKnowledge({
    brandId: second.id,
    id: secondPack.id,
  });
  assert.ok(full.revision.pack_json);
  tenant = B;
  await assert.rejects(
    queries.getChatKnowledge({ brandId: second.id, id: secondPack.id }),
    /unavailable/,
  );
  const b = await queries.getChatSetup();
  assert.ok(
    b.packs.every((p) => p.brand_id !== brand && p.brand_id !== second.id),
  );
});

test("production platform retries recover one-time receipts and do not call remote verification twice", async () => {
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const zod = await import("zod"),
    schemas = await import("../src/features/chat/schemas.ts"),
    crypto = await import("node:crypto");
  const db = postgresAdapter(local.db),
    tenant = crypto.randomUUID();
  await local.db.query(
    "insert into tenants(id,name,slug,store_name) values($1,'Platform retry','platform-retry','Synthetic')",
    [tenant],
  );
  const oldOrigin = process.env.CHAT_WEBHOOK_ORIGIN;
  process.env.CHAT_WEBHOOK_ORIGIN = "https://example.invalid";
  let verifications = 0;
  const { configurePlatformChat } = loadServerModule(
    "src/features/chat/platform-commands.ts",
    {
      zod,
      "node:crypto": crypto,
      "./schemas": schemas,
      "@/lib/auth/super-admin": {
        requireSuperAdmin: async () => "synthetic-super",
      },
      "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
      "./module": { isChatFoundationEnabled: () => true },
      "./connection": {
        chatwootOrigin: () => "https://chat.example.invalid",
        assertChatLiveAccess: () => {},
        platformClient: () => {
          throw new Error("Unexpected remote create");
        },
      },
      "@/integrations/chatwoot/admin-client": {
        ChatwootAdminClient: class {
          async verifyAccount() {
            verifications++;
          }
        },
      },
      "./secrets": {
        encryptChatSecret: () => "gcm1.v1." + crypto.randomUUID() + ".cipher",
      },
    },
  );
  try {
    const key = crypto.randomUUID(),
      prepared = await configurePlatformChat(
        { action: "workspace.prepare", tenantId: tenant },
        key,
      );
    assert.ok(prepared.webhooks);
    assert.equal(
      (
        await configurePlatformChat(
          { action: "workspace.prepare", tenantId: tenant },
          key,
        )
      ).webhooks,
      undefined,
    );
    const rotation = crypto.randomUUID();
    assert.ok(
      (
        await configurePlatformChat(
          { action: "workspace.rotate", tenantId: tenant },
          rotation,
        )
      ).webhooks,
    );
    assert.equal(
      (
        await configurePlatformChat(
          { action: "workspace.rotate", tenantId: tenant },
          rotation,
        )
      ).webhooks,
      undefined,
    );
    const link = crypto.randomUUID(),
      input = {
        action: "workspace.link",
        tenantId: tenant,
        accountId: 999,
        token: "synthetic-only-token",
      };
    await configurePlatformChat(input, link);
    await configurePlatformChat(input, link);
    assert.equal(verifications, 1);
    await assert.rejects(
      configurePlatformChat(
        { ...input, token: "changed-synthetic-token" },
        link,
      ),
      /not saved/,
    );
  } finally {
    if (oldOrigin === undefined) delete process.env.CHAT_WEBHOOK_ORIGIN;
    else process.env.CHAT_WEBHOOK_ORIGIN = oldOrigin;
  }
});
