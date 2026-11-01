import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import * as zod from "zod";
import * as crypto from "node:crypto";
import * as permissions from "../src/features/chat/permissions.ts";
import * as schemas from "../src/features/chat/schemas.ts";
import {
  loadServerModule,
  postgresAdapter,
} from "./chat-db-harness/server-adapter.mjs";
import { ChatwootAdminClient } from "../src/integrations/chatwoot/admin-client.ts";
import * as secrets from "../src/features/chat/secrets.ts";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local;
const tenant = randomUUID(),
  workspace = randomUUID(),
  profile = randomUUID();
const actor = "synthetic-platform-owner";
const context = (key = randomUUID()) => ({
  tenantId: tenant,
  actor: { type: "USER", id: actor },
  source: "OS_PLUS_UI",
  correlationId: randomUUID(),
  idempotencyKey: key,
});
const input = () => ({
  workspaceId: workspace,
  accountId: 12,
  tenantUserId: profile,
  chatwootUserId: 3,
  profileFingerprint: createHash("sha256")
    .update("staff@example.invalid:synthetic-manager")
    .digest("hex"),
});
const call = async (c = context(), p = input(), db = local.db) =>
  (
    await db.query(
      "select chat_staff_link_configure($1::jsonb,$2::jsonb) result",
      [JSON.stringify(c), JSON.stringify(p)],
    )
  ).rows[0].result;
before(
  async () => {
    local = await startChatDatabase({ includeFollowups: false });
    await local.db.query(
      "insert into tenants(id,name,slug,store_name) values($1,'Synthetic upgrade','staff-upgrade','Synthetic upgrade')",
      [tenant],
    );
    await local.db.query(
      "insert into tenant_users(id,tenant_id,clerk_user_id,email,role,status) values($1,$2,'synthetic-manager','staff@example.invalid','manager','active')",
      [profile, tenant],
    );
    const customer = (
      await local.db.query(
        "insert into customers(tenant_id,name,phone,normalized_phone_e164) values($1,'Retained synthetic customer','+919999990001','+919999990001') returning id",
        [tenant],
      )
    ).rows[0].id;
    const order = (
      await local.db.query(
        "insert into orders(tenant_id,customer_id,order_number,tracking_token,total_amount,amount_paid,payment_status) values($1,$2,'STAFF-UPGRADE','synthetic-staff-upgrade',100,20,'partially_paid') returning id",
        [tenant, customer],
      )
    ).rows[0].id;
    await local.db.query(
      "insert into order_payments(tenant_id,order_id,amount) values($1,$2,20)",
      [tenant, order],
    );
    await local.db.query(
      "insert into orders(tenant_id,customer_id,order_number,tracking_token,source,financial_management,order_status) values($1,$2,'STAFF-SHOPIFY','synthetic-staff-shopify','shopify','external_shopify','draft')",
      [tenant, customer],
    );
    await local.db.query(
      "insert into chat_workspaces(id,tenant_id,chatwoot_base_url,workspace_key,webhook_secret_hash,chatwoot_account_id,status,api_token_enc) values($1,$2,'https://example.invalid',repeat('k',32),repeat('a',64),12,'active','gcm1.v1.synthetic')",
      [workspace, tenant],
    );
  },
  { timeout: 120000 },
);
after(async () => {
  await local?.stop();
});
test("additive upgrade installs the audited staff command without changing existing records", async () => {
  const db = local.db;
  const snapshot = async () =>
    (
      await db.query(
        "select jsonb_build_object('tenants',(select jsonb_agg(t) from tenants t),'users',(select jsonb_agg(u) from tenant_users u),'workspaces',(select jsonb_agg(w) from chat_workspaces w),'customers',(select jsonb_agg(c) from customers c),'orders',(select jsonb_agg(o) from orders o),'payments',(select jsonb_agg(p) from order_payments p)) snapshot",
      )
    ).rows[0].snapshot;
  const before = await snapshot();
  assert.equal(
    (
      await db.query(
        "select to_regprocedure('public.chat_staff_link_configure(jsonb,jsonb)') f",
      )
    ).rows[0].f,
    null,
  );
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261031132000_chat_staff_link_commands.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await assert.rejects(
    db.query(sql.replace(/commit;\s*$/i, "select 1/0; commit;")),
    { code: "22012" },
  );
  await db.query("rollback");
  assert.equal(
    (
      await db.query(
        "select to_regprocedure('public.chat_staff_link_configure(jsonb,jsonb)') f",
      )
    ).rows[0].f,
    null,
  );
  assert.deepEqual(await snapshot(), before);
  await db.query(sql);
  assert.deepEqual(await snapshot(), before);
  const c = context(),
    first = await call(c),
    replay = await call(c);
  assert.equal(first.id, replay.id);
  assert.equal(
    (await db.query("select count(*)::int n from chat_staff_links")).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from domain_events where event_type='chat.staff_linked'",
      )
    ).rows[0].n,
    1,
  );
});

test("staff commands reject collisions, foreign scope, stale profiles and restricted database callers", async () => {
  const db = local.db;
  for (const change of [
    { chatwootUserId: 4 },
    { tenantUserId: randomUUID() },
    { workspaceId: randomUUID() },
    { accountId: 99 },
    { profileFingerprint: "b".repeat(64) },
    { extra: true },
  ])
    await assert.rejects(call(context(), { ...input(), ...change }));
  const key = randomUUID();
  await call(context(key));
  await assert.rejects(call(context(key), { ...input(), chatwootUserId: 4 }));
  await assert.rejects(
    call({
      ...context(key),
      actor: { type: "USER", id: "other-platform-owner" },
    }),
  );
  for (const role of ["viewer", "finance"]) {
    await db.query("update tenant_users set role=$1 where id=$2", [
      role,
      profile,
    ]);
    await assert.rejects(call());
  }
  await db.query(
    "update tenant_users set role='manager',status='disabled' where id=$1",
    [profile],
  );
  await assert.rejects(call());
  await db.query(
    "update tenant_users set status='active',clerk_user_id=null where id=$1",
    [profile],
  );
  await assert.rejects(call());
  await db.query(
    "update tenant_users set clerk_user_id='synthetic-manager' where id=$1",
    [profile],
  );
  const foreign = randomUUID();
  await db.query(
    "insert into tenants(id,name,slug,store_name) values($1,'Foreign synthetic','foreign-staff','Foreign')",
    [foreign],
  );
  await assert.rejects(call({ ...context(), tenantId: foreign }));
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.query("set role " + role);
    try {
      if (role !== "service_role")
        await assert.rejects(call(), { code: "42501" });
      else assert.ok((await call()).id);
      await assert.rejects(
        db.query(
          "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) values($1,$2,88)",
          [tenant, profile],
        ),
        { code: "42501" },
      );
      await assert.rejects(
        db.query("update chat_staff_links set chatwoot_user_id=88"),
        { code: "42501" },
      );
      await assert.rejects(db.query("delete from chat_staff_links"), {
        code: "42501",
      });
      if (role !== "service_role")
        await assert.rejects(db.query("select * from chat_staff_links"), {
          code: "42501",
        });
    } finally {
      await db.query("reset role");
    }
  }
  assert.equal(
    (
      await db.query(
        "select relrowsecurity from pg_class where oid='chat_staff_links'::regclass",
      )
    ).rows[0].relrowsecurity,
    true,
  );
});
test("independent concurrent commands create one link and one audit; storage failure rolls back the receipt", async () => {
  const db = local.db,
    id = randomUUID();
  await db.query(
    "insert into tenant_users(id,tenant_id,clerk_user_id,email,role,status) values($1,$2,'synthetic-owner','owner@example.invalid','owner_admin','active')",
    [id, tenant],
  );
  const p = {
    ...input(),
    tenantUserId: id,
    chatwootUserId: 4,
    profileFingerprint: createHash("sha256")
      .update("owner@example.invalid:synthetic-owner")
      .digest("hex"),
  };
  const clients = await Promise.all([local.connect(), local.connect()]);
  const c = context();
  const results = await Promise.all(
    clients.map((client) => call(c, p, client)),
  );
  assert.equal(results[0].id, results[1].id);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_staff_links where tenant_user_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from domain_events where event_type='chat.staff_linked' and aggregate_id=$1",
        [results[0].id],
      )
    ).rows[0].n,
    1,
  );
  const id2 = randomUUID(),
    failed = context();
  await db.query(
    "insert into tenant_users(id,tenant_id,clerk_user_id,email,role,status) values($1,$2,'synthetic-failed','failed@example.invalid','manager','active')",
    [id2, tenant],
  );
  await db.query(
    "create function synthetic_reject_staff_audit() returns trigger language plpgsql as $$ begin if new.event_type='chat.staff_linked' then raise exception 'synthetic audit failure';end if;return new;end $$;create trigger synthetic_staff_failure before insert on domain_events for each row execute function synthetic_reject_staff_audit()",
  );
  try {
    await assert.rejects(
      call(failed, {
        ...p,
        tenantUserId: id2,
        chatwootUserId: 5,
        profileFingerprint: createHash("sha256")
          .update("failed@example.invalid:synthetic-failed")
          .digest("hex"),
      }),
    );
  } finally {
    await db.query(
      "drop trigger synthetic_staff_failure on domain_events;drop function synthetic_reject_staff_audit()",
    );
  }
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_staff_links where tenant_user_id=$1",
        [id2],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from command_idempotency where tenant_id=$1 and command_type='chat.staff.link' and idempotency_key=$2",
        [tenant, failed.idempotencyKey],
      )
    ).rows[0].n,
    0,
  );
});

test("the actual Off-only action persists off, replays once and rejects stale or foreign channel versions", async () => {
  const db = local.db;
  const owner = (
    await db.query(
      "select * from tenant_users where tenant_id=$1 and clerk_user_id='synthetic-owner'",
      [tenant],
    )
  ).rows[0];
  await db.query(
    "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
    [tenant],
  );
  const brand = (
    await db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Synthetic brand','staff-off','Synthetic') returning id",
      [tenant],
    )
  ).rows[0].id;
  const channel = (
    await db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name,can_book) values($1,$2,$3,12,'website','Synthetic website',true) returning id",
      [tenant, workspace, brand],
    )
  ).rows[0].id;
  const adapter = postgresAdapter(db);
  const rpc = adapter.rpc;
  adapter.rpc = async (name, args) =>
    name === "chat_action_configure"
      ? db
          .query("select chat_action_configure($1::jsonb,$2::jsonb) result", [
            JSON.stringify(args.p_context),
            JSON.stringify(args.p_input),
          ])
          .then(
            (r) => ({ data: r.rows[0].result, error: null }),
            (error) => ({ data: null, error }),
          )
      : rpc(name, args);
  const env = {
    CHAT_FOUNDATION_ENABLED: process.env.CHAT_FOUNDATION_ENABLED,
    CHAT_ACTIONS_ENABLED: process.env.CHAT_ACTIONS_ENABLED,
  };
  Object.assign(process.env, {
    CHAT_FOUNDATION_ENABLED: "true",
    CHAT_ACTIONS_ENABLED: "false",
  });
  try {
    const guard = loadServerModule("src/features/chat/module.ts", {
      "@/lib/tenant/context": {
        requireTenantContext: async () => ({
          tenant: { id: tenant, status: "active" },
          membership: owner,
        }),
      },
      "@/lib/supabase/server": {
        createSupabaseServiceRoleClient: () => adapter,
      },
      "./permissions": permissions,
    });
    const command = loadServerModule("src/core/command-context/server.ts", {});
    const action = loadServerModule(
      "src/features/chat/channel-off-actions.ts",
      {
        zod,
        "next/cache": { revalidatePath: () => {} },
        "./module": guard,
        "./schemas": schemas,
        "@/core/command-context/server": command,
      },
    ).setChannelStaffOnlyAction;
    const key = randomUUID();
    assert.equal(
      (await action({ channelId: channel, version: 0 }, key, tenant)).ok,
      true,
    );
    assert.equal(
      (await action({ channelId: channel, version: 0 }, key, tenant)).ok,
      true,
    );
    assert.equal(
      (await action({ channelId: channel, version: 0 }, randomUUID(), tenant))
        .ok,
      false,
    );
    assert.equal(
      (
        await action(
          { channelId: randomUUID(), version: 0 },
          randomUUID(),
          tenant,
        )
      ).ok,
      false,
    );
    assert.deepEqual(
      (
        await db.query(
          "select agent_mode,can_book from chat_channels where id=$1",
          [channel],
        )
      ).rows[0],
      { agent_mode: "off", can_book: false },
    );
    assert.equal(
      (
        await db.query(
          "select version from chat_channel_action_approvals where channel_id=$1",
          [channel],
        )
      ).rows[0].version,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from domain_events where aggregate_id=$1 and event_type='chat.channel.actions_configured'",
          [channel],
        )
      ).rows[0].n,
      1,
    );
  } finally {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("the real platform staff action, encrypted account client and SQL command persist one verified link under replay", async () => {
  const db = local.db,
    id = randomUUID();
  const env = {
    CHAT_FOUNDATION_ENABLED: "true",
    CHAT_ADMIN_LIVE_ENABLED: "true",
    CHAT_DRY_RUN: "false",
    CHATWOOT_BASE_URL: "https://example.invalid",
    CHAT_SECRETS_ACTIVE_VERSION: "v1",
    CHAT_SECRETS_KEYS: JSON.stringify({
      v1: crypto.randomBytes(32).toString("base64"),
    }),
    OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS: actor,
  };
  const old = Object.fromEntries(
      Object.keys(env).map((k) => [k, process.env[k]]),
    ),
    fetch = globalThis.fetch;
  let nativeCalls = 0;
  Object.assign(process.env, env);
  try {
    await db.query(
      "insert into tenant_users(id,tenant_id,clerk_user_id,email,role,status) values($1,$2,'synthetic-linked','linked@example.invalid','manager','active')",
      [id, tenant],
    );
    const encrypted = secrets.encryptChatSecret("synthetic-account-token", {
      tenantId: tenant,
      workspaceId: workspace,
      purpose: "account_token",
    });
    await db.query("update chat_workspaces set api_token_enc=$1 where id=$2", [
      encrypted,
      workspace,
    ]);
    globalThis.fetch = async (url, options) => {
      nativeCalls++;
      assert.equal(url, "https://example.invalid/api/v1/accounts/12/agents");
      assert.equal(
        options.headers["api-access-token"],
        "synthetic-account-token",
      );
      return new Response(
        JSON.stringify([
          {
            id: 6,
            account_id: 12,
            name: "Synthetic linked staff",
            email: "linked@example.invalid",
            role: "agent",
            confirmed: true,
            access_token: "discard-me",
          },
        ]),
      );
    };
    const auth = loadServerModule("src/lib/auth/super-admin.ts", {
      "@clerk/nextjs/server": { auth: async () => ({ userId: actor }) },
      "next/navigation": {},
    });
    const connection = loadServerModule("src/features/chat/connection.ts", {
      "@/integrations/chatwoot/admin-client": { ChatwootAdminClient },
      "./secrets": secrets,
    });
    const adapter = postgresAdapter(db);
    const core = loadServerModule("src/features/chat/staff-links.ts", {
      zod,
      "node:crypto": crypto,
      "@/lib/auth/super-admin": auth,
      "@/lib/supabase/server": {
        createSupabaseServiceRoleClient: () => adapter,
      },
      "./connection": connection,
    });
    const invalidations = [];
    const action = loadServerModule("src/features/chat/staff-link-actions.ts", {
      "next/cache": { revalidatePath: (p) => invalidations.push(p) },
      "./staff-links": core,
    });
    const choices = await action.loadPlatformChatStaffAction({
      tenantId: tenant,
      workspaceId: workspace,
      accountId: 12,
    });
    if (!choices.ok) await core.getPlatformChatStaffChoices({tenantId:tenant,workspaceId:workspace,accountId:12});
    assert.equal(choices.ok, true);
    assert.equal(JSON.stringify(choices).includes("discard-me"), false);
    const request = {
        tenantId: tenant,
        workspaceId: workspace,
        accountId: 12,
        tenantUserId: id,
        chatwootUserId: 6,
      },
      key = randomUUID();
    assert.equal(
      (await action.linkPlatformChatStaffAction(request, key)).ok,
      true,
    );
    assert.equal(
      (await action.linkPlatformChatStaffAction(request, key)).ok,
      true,
    );
    assert.equal(nativeCalls, 2); // one discovery plus one fresh verification; receipt replay does not call Chatwoot.
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from chat_staff_links where tenant_user_id=$1 and chatwoot_user_id=6",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.deepEqual(invalidations, [
      "/super-admin/chat-workspaces",
      "/super-admin/chat-workspaces",
    ]);
    assert.equal(
      (
        await action.linkPlatformChatStaffAction(
          { ...request, chatwootUserId: 99 },
          randomUUID(),
        )
      ).ok,
      false,
    );
  } finally {
    globalThis.fetch = fetch;
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
