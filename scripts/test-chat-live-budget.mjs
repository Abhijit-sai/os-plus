import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
const tenant = "7d000000-0000-4000-8000-000000000001";
let local;
const context = (who = "owner", key) => ({
  tenantId: tenant,
  actor: { type: "USER", id: "live-budget-" + who },
  source: "OS_PLUS_UI",
  correlationId: "live-budget-synthetic",
  ...(key ? { idempotencyKey: key } : {}),
});
const settings = (input = {}, ctx = context(), db = local.db) =>
  db
    .query("select chat_ai_budget_settings($1::jsonb,$2::jsonb) result", [
      JSON.stringify(ctx),
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
before(
  async () => {
    local = await startChatDatabase();
    await local.db.query(
      "insert into tenants(id,name,store_name,slug) values($1,'Live budget QA','Live budget QA','live-budget-qa')",
      [tenant],
    );
    await local.db.query(
      "insert into tenant_modules(tenant_id,is_enabled) values($1,true)",
      [tenant],
    );
    await local.db.query("insert into chat_settings(tenant_id) values($1)", [
      tenant,
    ]);
    for (const [who, role] of [
      ["owner", "owner_admin"],
      ["manager", "manager"],
    ])
      await local.db.query(
        "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$4,$5,'active')",
        [tenant, "live-budget-" + who, who + "@example.invalid", who, role],
      );
  },
  { timeout: 120000 },
);
after(async () => local?.stop(), { timeout: 30000 });
test("owner explicitly sets a finite tenant AI limit with a versioned, retry-safe audited command", async () => {
  const first = await settings();
  assert.equal(first.monthlyBudgetUsd, null);
  assert.equal(first.version, 0);
  const input = { monthlyBudgetUsd: "5.25", version: 0 },
    ctx = context("owner", randomUUID());
  const saved = await settings(input, ctx);
  assert.equal(saved.monthlyBudgetUsd, "5.25");
  assert.equal(saved.version, 1);
  assert.deepEqual(await settings(input, ctx), saved);
  assert.equal(
    (
      await local.db.query(
        "select count(*)::int n from domain_events where tenant_id=$1 and event_type='chat.ai.budget_saved'",
        [tenant],
      )
    ).rows[0].n,
    1,
  );
  assert.equal((await settings()).monthlyBudgetUsd, "5.25");
});

test("budget settings reject managers, stale edits, null or changed retries and preserve tenant isolation", async () => {
  const current = await settings();
  await assert.rejects(settings({}, context("manager")));
  await assert.rejects(
    settings(
      { monthlyBudgetUsd: "1", version: 0 },
      context("owner", randomUUID()),
    ),
  );
  for (const monthlyBudgetUsd of [
    null,
    "NaN",
    "Infinity",
    "-1",
    "1e3",
    "0.0000000000001",
  ])
    await assert.rejects(
      settings(
        { monthlyBudgetUsd, version: current.version },
        context("owner", randomUUID()),
      ),
    );
  const ctx = context("owner", randomUUID()),
    input = { monthlyBudgetUsd: "0", version: current.version };
  const paused = await settings(input, ctx);
  assert.equal(paused.monthlyBudgetUsd, "0");
  await assert.rejects(settings({ ...input, monthlyBudgetUsd: "100" }, ctx));
  await assert.rejects(settings({}, { ...context(), tenantId: randomUUID() }));
  await local.db.query("set role service_role");
  try {
    await assert.rejects(
      local.db.query(
        "update chat_settings set monthly_budget_usd=null where tenant_id=$1",
        [tenant],
      ),
    );
  } finally {
    await local.db.query("reset role");
  }
  assert.equal((await settings()).monthlyBudgetUsd, "0");
});
import { readFileSync } from "node:fs";
let agent;
async function createAgentFixture() {
  const db = local.db;
  const brand = (
    await db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Budget brand','budget','Demo') returning id",
      [tenant],
    )
  ).rows[0].id;
  const workspace = (
    await db.query(
      "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',904,$2,$3,'gcm1.v1.fixture','active') returning id",
      [tenant, "d".repeat(32), "a".repeat(64)],
    )
  ).rows[0].id;
  const channel = (
    await db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,904,'website','Synthetic') returning id",
      [tenant, workspace, brand],
    )
  ).rows[0].id;
  const pack = JSON.parse(
    readFileSync(
      new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
      "utf8",
    ),
  );
  await db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,1,'published',$3::jsonb)",
    [tenant, brand, JSON.stringify(pack)],
  );
  const ctx = {
    tenantId: tenant,
    actor: { type: "WEBHOOK", id: "chatwoot" },
    source: "WEBHOOK",
    correlationId: "live-budget-fixture",
  };
  const input = {
    workspaceId: workspace,
    channelId: channel,
    secretHash: "a".repeat(64),
    identity: { displayName: "Synthetic", sourceId: "fixture" },
    message: {
      messageId: 10,
      accountId: 904,
      inboxId: 904,
      conversationId: 10,
      contactId: 10,
      status: "open",
      channelKind: "website",
      author: "customer",
      private: false,
      content: "Opening hours?",
      contentType: "text",
      attachments: [],
      staffUserId: null,
      createdAt: new Date().toISOString(),
    },
  };
  const captured = (
    await db.query("select chat_capture($1::jsonb,'agent',$2::jsonb) result", [
      JSON.stringify(ctx),
      JSON.stringify(input),
    ])
  ).rows[0].result;
  await db.query(
    "update tenant_modules set config_json='{\"agentEnabled\":true}' where tenant_id=$1",
    [tenant],
  );
  return {
    ctx,
    brand,
    capture: input,
    input: {
      workspaceId: workspace,
      channelId: channel,
      conversationId: captured.conversationId,
      triggerMessageId: captured.messageId,
      secretHash: input.secretHash,
    },
  };
}
const liveRun = (action, input, ctx = agent.ctx, db = local.db) =>
  db
    .query("select chat_live_agent_run($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(ctx),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
test("live admission refuses an unconfigured cap, automatic mode and booking capability before claiming", async () => {
  agent = await createAgentFixture();
  await local.db.query(
    "update chat_settings set monthly_budget_usd=null where tenant_id=$1",
    [tenant],
  );
  assert.equal(
    (await liveRun("claim", agent.input)).status,
    "budget_unconfigured",
  );
  const s = await settings();
  await settings(
    { monthlyBudgetUsd: "0.01", version: s.version },
    context("owner", randomUUID()),
  );
  await local.db.query(
    "update chat_channels set agent_mode='auto' where id=$1",
    [agent.input.channelId],
  );
  await assert.rejects(liveRun("claim", agent.input));
  await local.db.query(
    "update chat_channels set agent_mode='draft',can_book=true where id=$1",
    [agent.input.channelId],
  );
  await assert.rejects(liveRun("claim", agent.input));
  await local.db.query("update chat_channels set can_book=false where id=$1", [
    agent.input.channelId,
  ]);
  const claim = await liveRun("claim", agent.input);
  assert.equal(claim.status, "claimed");
  agent.capability = { runId: claim.runId, leaseToken: claim.leaseToken };
});

test("concurrent live reservations share a hard cap and uncertain costs remain held through revocation", async () => {
  const input = { ...agent.input, ...agent.capability };
  const connections = await Promise.all([local.connect(), local.connect()]);
  const results = await Promise.all(
    ["understand", "classify"].map((callKey, i) =>
      liveRun(
        "budget.reserve",
        { ...input, callKey, maxUsd: "0.008" },
        agent.ctx,
        connections[i],
      ),
    ),
  );
  assert.equal(results.filter((r) => r.admitted).length, 1);
  const callKey = ["understand", "classify"][
    results.findIndex((r) => r.admitted)
  ];
  assert.equal(
    (
      await liveRun("budget.settle", {
        ...input,
        callKey,
        actualUsd: null,
        generationId: null,
      })
    ).status,
    "uncertain",
  );
  assert.equal(
    (
      await liveRun("budget.reserve", {
        ...input,
        callKey: "write",
        maxUsd: "0.005",
      })
    ).admitted,
    false,
  );
  await local.db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [tenant],
  );
  assert.equal(
    (
      await liveRun("budget.settle", {
        ...input,
        callKey,
        actualUsd: "0.001",
        generationId: "gen-synthetic-late",
      })
    ).status,
    "settled",
  );
  await assert.rejects(
    liveRun("budget.reserve", {
      ...input,
      callKey: "rewrite",
      maxUsd: "0.001",
    }),
  );
  await local.db.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [tenant],
  );
  assert.equal(
    (await liveRun("budget.reserve", { ...input, callKey, maxUsd: "0.001" }))
      .admitted,
    false,
  );
  const s = await settings();
  await settings(
    { monthlyBudgetUsd: "0", version: s.version },
    context("owner", randomUUID()),
  );
  assert.equal(
    (
      await liveRun("budget.reserve", {
        ...input,
        callKey: "rewrite",
        maxUsd: "0.001",
      })
    ).admitted,
    false,
  );
});

import { createServer } from "node:http";
import { OpenRouterClient } from "../src/integrations/openrouter/client.ts";
import { createLiveModel } from "../src/features/chat/agent/live-model.ts";
import { runStoredAgentTurn } from "../src/features/chat/agent/worker-core.ts";
test("stored live turn uses real SQL admission and outbox, posts one private draft and cannot regenerate on replay", async () => {
  const s = await settings();
  await settings(
    { monthlyBudgetUsd: "1", version: s.version },
    context("owner", randomUUID()),
  );
  const body = structuredClone(agent.capture);
  body.message.messageId = 11;
  body.message.createdAt = new Date().toISOString();
  const captured = (
    await local.db.query(
      "select chat_capture($1::jsonb,'agent',$2::jsonb) result",
      [JSON.stringify(agent.ctx), JSON.stringify(body)],
    )
  ).rows[0].result;
  const input = { ...agent.input, triggerMessageId: captured.messageId };
  const seen = [],
    notes = [];
  const responses = [
    {
      intent: null,
      services: [],
      language: "en",
      gist: "Opening enquiry",
      confidence: "high",
      signals: [],
      slots: [],
    },
    { signals: [] },
    { text: "{{FACT:hours}}" },
  ];
  const server = createServer((req, res) => {
    let text = "";
    req.on("data", (b) => (text += b));
    req.on("end", () => {
      seen.push(JSON.parse(text));
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: "gen-synthetic-" + seen.length,
          model: "synthetic/live-test",
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(responses[seen.length - 1]) },
            },
          ],
          usage: { cost: 0.001 },
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new OpenRouterClient({
      origin: "http://127.0.0.1:" + server.address().port,
      token: "fake-only",
      allowLocalMock: true,
    });
    const scope = {
      tenantId: tenant,
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      conversationId: input.conversationId,
      triggerMessageId: input.triggerMessageId,
    };
    const store = {
      async load() {
        throw Error("claim supplies validated context");
      },
      async dryRun() {
        throw Error("unexpected dryrun");
      },
      async publicDelivery() {
        throw Error("live cannot send public replies");
      },
      run: (action, extra) => liveRun(action, { ...input, ...extra }),
    };
    const factory = {
      kind: "live",
      create(capability) {
        return createLiveModel(
          {
            models: {
              understand: "synthetic/live-test",
              classify: "synthetic/live-test",
              write: "synthetic/live-test",
            },
            provider: "synthetic-provider",
            maxPrice: { prompt: "1", completion: "2", request: "0" },
          },
          {
            run: (action, extra) =>
              liveRun(action, { ...input, ...capability, ...extra }),
          },
          client,
        );
      },
    };
    const run = () =>
      runStoredAgentTurn(
        { scope, now: new Date().toISOString(), dryRun: false, deliver: true },
        store,
        factory,
        async (note) => {
          notes.push(note);
          return { id: 201 };
        },
      );
    assert.equal((await run()).status, "delivered");
    assert.equal((await run()).status, "delivered");
    assert.equal(seen.length, 3);
    assert.equal(notes.length, 1);
    assert.match(notes[0].text, /no published opening hours/);
    const read = (
      await local.db.query(
        "select cost_usd::text cost,models_json models,mode from chat_turns where tenant_id=$1 and trigger_message_id=$2",
        [tenant, input.triggerMessageId],
      )
    ).rows[0];
    assert.equal(Number(read.cost), 0.003);
    assert.equal(read.models.length, 3);
    assert.equal(read.mode, "draft");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("the owner settings adapter binds saves to the displayed business and preserves uncertain retry keys", async () => {
  const { loadServerModule, postgresAdapter } =
    await import("./chat-db-harness/server-adapter.mjs");
  const z = await import("zod"),
    budget = await import("../src/features/chat/agent/budget.ts");
  const api = loadServerModule("src/features/chat/agent/budget-settings.ts", {
    zod: z,
    "../module": {
      async requireChatPermission() {
        return {
          context: { tenant: { id: tenant } },
          db: postgresAdapter(local.db),
        };
      },
    },
    "@/core/command-context/server": {
      createUserCommandContext(_ctx, options = {}) {
        return context("owner", options.idempotencyKey);
      },
    },
    "../schemas": { commandKeySchema: z.z.string().uuid() },
    "./budget": budget,
  });
  const current = await settings(),
    input = { monthlyBudgetUsd: "0.50", version: current.version },
    key = randomUUID();
  await assert.rejects(
    api.configureAiBudget(input, key, randomUUID()),
    /selected business/,
  );
  const result = await api.configureAiBudget(input, key, tenant);
  assert.deepEqual(await api.configureAiBudget(input, key, tenant), result);
  assert.equal(result.monthlyBudgetUsd, "0.50");
});

test("invalid legacy numeric caps block live admission and can be repaired by the owner", async () => {
  for (const value of ["NaN", "Infinity", "1000000000"]) {
    await local.db.query(
      "update chat_settings set monthly_budget_usd=$2::numeric where tenant_id=$1",
      [tenant, value],
    );
    const current = await settings();
    assert.equal(current.monthlyBudgetUsd, null);
    assert.equal(
      (await liveRun("claim", agent.input)).status,
      "budget_unconfigured",
    );
    assert.equal(
      (
        await liveRun("budget.reserve", {
          ...agent.input,
          ...agent.capability,
          callKey: "rewrite",
          maxUsd: "0.001",
        })
      ).admitted,
      false,
    );
    await settings(
      { monthlyBudgetUsd: "0.50", version: current.version },
      context("owner", randomUUID()),
    );
    assert.equal((await settings()).monthlyBudgetUsd, "0.50");
  }
});
