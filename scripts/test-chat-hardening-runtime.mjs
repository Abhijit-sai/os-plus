import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
import { benchCases, benchRequest } from "./chat-bench/fixtures.mjs";
import { runStoredMockTurn } from "../src/features/chat/agent/worker-core.ts";
import { createMockModel } from "../src/features/chat/agent/mock-model.ts";
let local;
const fixtures = [];
const owner = (f) => ({
  tenantId: f.tenantId,
  actor: { type: "USER", id: "hardening-owner" },
  source: "OS_PLUS_UI",
  correlationId: "ch10-hardening",
});
const call = async (name, context, action, input, db = local.db) => {
  assert.ok(
    ["chat_crm_read", "chat_agent_run", "chat_notification_command"].includes(
      name,
    ),
  );
  return (
    await db.query("select " + name + "($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
  ).rows[0].result;
};
before(
  async () => {
    local = await startChatDatabase();
    for (let i = 0; i < 2; i++) {
      const f = {
        tenantId: randomUUID(),
        brandId: randomUUID(),
        workspaceId: randomUUID(),
        channelId: randomUUID(),
        pack: benchRequest(
          benchCases.find((x) => x.index === i && x.name === "hours"),
        ).data.pack.body,
      };
      const db = local.db;
      await db.query(
        "insert into tenants(id,name,store_name,slug) values($1,$2,$2,$3)",
        [f.tenantId, f.pack.brand.displayName, "hardening-" + f.tenantId],
      );
      await db.query(
        "insert into tenant_modules(tenant_id,is_enabled,config_json) values($1,true,'{\"agentEnabled\":true}')",
        [f.tenantId],
      );
      await db.query("insert into chat_settings(tenant_id) values($1)", [
        f.tenantId,
      ]);
      for (const role of ["owner_admin", "manager", "viewer"])
        await db.query(
          "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$2,$4,'active')",
          [
            f.tenantId,
            "hardening-" + (role === "owner_admin" ? "owner" : role),
            role + "@example.invalid",
            role,
          ],
        );
      await db.query(
        "insert into chat_brands(id,tenant_id,name,slug,persona_name) values($1,$2,$3,'hardening','Synthetic assistant')",
        [f.brandId, f.tenantId, f.pack.brand.displayName],
      );
      await db.query(
        "insert into chat_workspaces(id,tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,$2,'https://chat.example.invalid',$3,$4,$5,'gcm1.v1.fixture','active')",
        [
          f.workspaceId,
          f.tenantId,
          901 + i,
          randomUUID().replaceAll("-", ""),
          "a".repeat(64),
        ],
      );
      await db.query(
        "insert into chat_channels(id,tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,$4,20,'website','Synthetic website')",
        [f.channelId, f.tenantId, f.workspaceId, f.brandId],
      );
      await db.query(
        "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,1,'published',$3::jsonb)",
        [f.tenantId, f.brandId, JSON.stringify(f.pack)],
      );
      f.webhook = {
        tenantId: f.tenantId,
        actor: { type: "WEBHOOK", id: "chatwoot" },
        source: "WEBHOOK",
        correlationId: "ch10-hardening",
      };
      const capture = (
        await db.query(
          "select chat_capture($1::jsonb,'agent',$2::jsonb) result",
          [
            JSON.stringify(f.webhook),
            JSON.stringify({
              workspaceId: f.workspaceId,
              secretHash: "a".repeat(64),
              channelId: f.channelId,
              identity: {
                displayName: f.pack.brand.displayName + " visitor",
                sourceId: "synthetic",
              },
              message: {
                messageId: 10,
                accountId: 901 + i,
                inboxId: 20,
                conversationId: 10,
                contactId: 10,
                status: "open",
                channelKind: "website",
                author: "customer",
                private: false,
                content: "When are you open?",
                contentType: "text",
                attachments: [],
                staffUserId: null,
                createdAt: new Date().toISOString(),
              },
            }),
          ],
        )
      ).rows[0].result;
      f.scope = {
        tenantId: f.tenantId,
        workspaceId: f.workspaceId,
        channelId: f.channelId,
        conversationId: capture.conversationId,
        triggerMessageId: capture.messageId,
      };
      f.input = {
        workspaceId: f.workspaceId,
        channelId: f.channelId,
        conversationId: capture.conversationId,
        triggerMessageId: capture.messageId,
        secretHash: "a".repeat(64),
      };
      fixtures.push(f);
    }
  },
  { timeout: 120000 },
);
after(async () => local?.stop(), { timeout: 30000 });
const load = async (f, input = f.input, context = f.webhook) =>
  (
    await local.db.query("select chat_agent_load($1::jsonb,$2::jsonb) result", [
      JSON.stringify(context),
      JSON.stringify(input),
    ])
  ).rows[0].result;
test("CH10 real database: two businesses retain distinct context, CRM, panel and summary scope", async () => {
  const [a, b] = fixtures;
  for (const f of fixtures) {
    const other = f === a ? b : a;
    const context = await load(f);
    assert.equal(context.pack.body.brand.displayName, f.pack.brand.displayName);
    assert.ok(!JSON.stringify(context).includes(other.pack.brand.displayName));
    assert.ok(!JSON.stringify(context).includes("gcm1"));
    await assert.rejects(
      load(f, { ...f.input, conversationId: other.scope.conversationId }),
    );
    await assert.rejects(load(f, f.input, other.webhook));
    const inbox = await call("chat_crm_read", owner(f), "leads", {});
    assert.equal(inbox.total, 1);
    assert.ok(!JSON.stringify(inbox).includes(other.pack.brand.displayName));
    const panel = await call("chat_crm_read", owner(f), "panel", {
      accountId: f === a ? 901 : 902,
      inboxId: 20,
      conversationId: 10,
    });
    assert.equal(panel.leadId, inbox.items[0].id);
    assert.equal(
      (
        await call("chat_crm_read", owner(other), "panel", {
          accountId: f === a ? 901 : 902,
          inboxId: 20,
          conversationId: 10,
        })
      ).leadId,
      null,
    );
    const preview = async (who, brandIds) =>
      (
        await local.db.query(
          "select chat_notification_preview($1::jsonb,$2::jsonb) result",
          [
            JSON.stringify(who),
            JSON.stringify({
              windowStart: new Date(Date.now() - 60000).toISOString(),
              windowEnd: new Date().toISOString(),
              brandIds,
            }),
          ],
        )
      ).rows[0].result;
    assert.equal((await preview(owner(f), [])).totals.chats, 1);
    await assert.rejects(preview(owner(f), [other.brandId]));
    await assert.rejects(
      preview(
        { ...owner(f), actor: { type: "USER", id: "hardening-manager" } },
        [],
      ),
    );
    await assert.rejects(
      call(
        "chat_crm_read",
        { ...owner(f), actor: { type: "USER", id: "hardening-viewer" } },
        "leads",
        {},
      ),
    );
  }
});
test("CH10 real database: concurrent idempotent commands commit one target and one audit event", async () => {
  const f = fixtures[0],
    id = randomUUID(),
    key = randomUUID(),
    ctx = { ...owner(f), idempotencyKey: key };
  const one = await local.connect(),
    two = await local.connect();
  const values = await Promise.all(
    [one, two].map((db) =>
      call(
        "chat_notification_command",
        ctx,
        "create",
        { id, label: "Synthetic concurrent target" },
        db,
      ),
    ),
  );
  assert.deepEqual(values[0], values[1]);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_notification_targets where tenant_id=$1 and id=$2",
        [f.tenantId, id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1 and event_type='chat.notification.create'",
        [f.tenantId],
      )
    ).rows[0].n,
    1,
  );
});
test("CH10 real database: slow storage after a transport receipt retains delivering state and cannot resend", async () => {
  const f = fixtures[1],
    writer = await local.connect(),
    blocker = await local.connect();
  await writer.query("set lock_timeout='80ms'");
  let posts = 0,
    locked = false,
    runId;
  const store = {
    load: () => load(f),
    dryRun: async () => null,
    run: async (action, input) => {
      const result = await call(
        "chat_agent_run",
        f.webhook,
        action,
        { ...f.input, ...input },
        writer,
      );
      if (action === "claim") runId = result.runId;
      return result;
    },
  };
  try {
    const result = await runStoredMockTurn(
      {
        scope: f.scope,
        now: new Date().toISOString(),
        dryRun: false,
        deliver: true,
      },
      store,
      createMockModel("information", f.pack),
      async () => {
        posts++;
        await blocker.query("begin");
        locked = true;
        await blocker.query(
          "select id from chat_agent_runs where id=$1 for update",
          [runId],
        );
        // Simulates the transport returning a receipt before storage becomes slow. Actual transport faults have separate loopback tests.
        return { id: 7001 };
      },
    );
    assert.equal(result.status, "uncertain");
  } finally {
    if (locked) await blocker.query("rollback");
  }
  assert.equal(posts, 1);
  const held = (
    await local.db.query("select status from chat_agent_runs where id=$1", [
      runId,
    ])
  ).rows[0];
  assert.equal(held.status, "delivering");
  const retry = await runStoredMockTurn(
    {
      scope: f.scope,
      now: new Date().toISOString(),
      dryRun: false,
      deliver: true,
    },
    store,
    createMockModel("information", f.pack),
    async () => {
      posts++;
      return { id: 7002 };
    },
  );
  assert.ok(
    ["delivering_existing", "busy", "delivering"].includes(retry.status),
    retry.status,
  );
  assert.equal(posts, 1);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from chat_messages where tenant_id=$1 and author='bot' and not private",
        [f.tenantId],
      )
    ).rows[0].n,
    0,
  );
});
