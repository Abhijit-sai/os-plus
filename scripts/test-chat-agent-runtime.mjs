import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
let local, brandA, brandB;
const fixtures = [];
const pack = JSON.parse(
  readFileSync(
    new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
    "utf8",
  ),
);
const a = "62000000-0000-4000-8000-000000000001",
  b = "62000000-0000-4000-8000-000000000002";
const ctx = (tenantId = a, who = "owner") => ({
  tenantId,
  actor: { type: "USER", id: "agent-" + who },
  source: "OS_PLUS_UI",
  correlationId: "agent-runtime-test",
});
const command = (action, input, context = ctx()) =>
  local.db
    .query("select chat_agent_command($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
before(
  async () => {
    local = await startChatDatabase();
    for (const [i, t] of [a, b].entries()) {
      await local.db.query(
        "insert into tenants(id,name,store_name,slug) values($1,'Agent QA','Agent QA',$2)",
        [t, "agent-qa-" + i],
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
      ])
        await local.db.query(
          "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$4,$5,'active')",
          [t, "agent-" + who, who + "@example.invalid", who, role],
        );
      const id = (
        await local.db.query(
          "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Agent Brand','agent','Demo') returning id",
          [t],
        )
      ).rows[0].id;
      if (i === 0) brandA = id;
      else brandB = id;
      const w = (
        await local.db.query(
          "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',$2,$3,$4,'gcm1.v1.fixture','active') returning id",
          [t, 901 + i, String(i).repeat(32), "a".repeat(64)],
        )
      ).rows[0].id;
      const c = (
        await local.db.query(
          "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,20,'website','Synthetic') returning id",
          [t, w, id],
        )
      ).rows[0].id;
      await local.db.query(
        "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,1,'published',$3::jsonb)",
        [t, id, JSON.stringify(pack)],
      );
      const webhook = {
        tenantId: t,
        actor: { type: "WEBHOOK", id: "chatwoot" },
        source: "WEBHOOK",
        correlationId: "agent-fixture",
      };
      const input = {
        workspaceId: w,
        secretHash: "a".repeat(64),
        channelId: c,
        identity: { displayName: "Synthetic customer", sourceId: "fixture" },
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
          content: "Opening hours?",
          contentType: "text",
          attachments: [],
          staffUserId: null,
          createdAt: new Date().toISOString(),
        },
      };
      const captured = (
        await local.db.query(
          "select chat_capture($1::jsonb,'agent',$2::jsonb) result",
          [JSON.stringify(webhook), JSON.stringify(input)],
        )
      ).rows[0].result;
      fixtures.push({
        tenantId: t,
        workspaceId: w,
        channelId: c,
        conversationId: captured.conversationId,
        triggerMessageId: captured.messageId,
        secretHash: "a".repeat(64),
        context: webhook,
      });
    }
  },
  { timeout: 120000 },
);
after(async () => local?.stop(), { timeout: 30000 });
test("sandbox logs are owner-only, tenant-owned and retry-safe without fabricating business/message records", async () => {
  const key = randomUUID(),
    input = {
      brandId: brandA,
      commandKey: key,
      requestHash: "b".repeat(64),
      result: {
        outcome: "drafted",
        replyText: "A synthetic inquiry preview.",
        costUsd: "0",
        models: [],
        packVersion: null,
        understanding: {},
        checks: [],
        provenance: [],
        timingsMs: {},
      },
    };
  const tables = [
    "chat_messages",
    "chat_conversations",
    "leads",
    "customers",
    "chat_state",
    "domain_events",
  ];
  const before = await Promise.all(
    tables.map((t) =>
      local.db.query("select count(*) n from " + t).then((r) => r.rows[0].n),
    ),
  );
  const first = await command("sandbox.record", input);
  assert.equal((await command("sandbox.record", input)).id, first.id);
  await assert.rejects(
    command("sandbox.record", {
      ...input,
      result: { ...input.result, replyText: "Changed" },
    }),
  );
  await assert.rejects(command("sandbox.record", input, ctx(a, "manager")));
  await assert.rejects(
    command("sandbox.record", {
      ...input,
      brandId: brandB,
      commandKey: randomUUID(),
    }),
  );
  await local.db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [a],
  );
  await assert.rejects(command("sandbox.record", input));
  await local.db.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [a],
  );
  assert.deepEqual(
    await Promise.all(
      tables.map((t) =>
        local.db.query("select count(*) n from " + t).then((r) => r.rows[0].n),
      ),
    ),
    before,
  );
  await local.db.query("set role authenticated");
  try {
    await assert.rejects(local.db.query("select * from chat_sandbox_turns"));
  } finally {
    await local.db.query("reset role");
  }
});
test("actual context RPC and adapter enforce workspace-secret tenancy and project only this conversation's public history", async () => {
  const { buildAgentContext } =
    await import("../src/features/chat/agent/context.ts");
  const fixture = fixtures[0],
    { context, secretHash, ...scope } = fixture;
  const load = (input, ctx = context) =>
    local.db
      .query("select chat_agent_load($1::jsonb,$2::jsonb) result", [
        JSON.stringify(ctx),
        JSON.stringify(input),
      ])
      .then((r) => r.rows[0].result);
  const input = {
    workspaceId: scope.workspaceId,
    channelId: scope.channelId,
    conversationId: scope.conversationId,
    triggerMessageId: scope.triggerMessageId,
    secretHash,
  };
  const raw = await load(input),
    built = buildAgentContext(scope, raw);
  assert.equal(built.pack.brand.displayName, pack.brand.displayName);
  assert.equal(built.session.messages[0].content, "Opening hours?");
  assert.equal(JSON.stringify(raw).includes("gcm1"), false);
  await assert.rejects(load({ ...input, secretHash: "b".repeat(64) }));
  await assert.rejects(
    load({ ...input, conversationId: fixtures[1].conversationId }),
  );
  await assert.rejects(load(input, { ...context, tenantId: b }));
  await assert.rejects(load(input, ctx()));
});

const runCommand = (
  action,
  input,
  context = fixtures[0].context,
  db = local.db,
) =>
  db
    .query("select chat_agent_run($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(context),
      action,
      JSON.stringify(input),
    ])
    .then((r) => r.rows[0].result);
const base = () => {
  const { tenantId, context, ...input } = fixtures[0];
  return input;
};
test("claim reuses the captured placeholder once; concurrent budget reservations cannot overspend and unknown costs remain held", async () => {
  const input = base();
  await local.db.query(
    "update tenant_modules set config_json='{\"agentEnabled\":true}' where tenant_id=$1",
    [a],
  );
  const claim = await runCommand("claim", input);
  assert.ok(claim.runId);
  assert.ok(claim.leaseToken);
  assert.equal((await runCommand("claim", input)).status, "busy");
  const turnCount = await local.db.query(
    "select count(*) n from chat_turns where tenant_id=$1 and trigger_message_id=$2",
    [a, input.triggerMessageId],
  );
  assert.equal(turnCount.rows[0].n, "1");
  const scope = { ...input, runId: claim.runId, leaseToken: claim.leaseToken };
  await local.db.query(
    "update chat_settings set monthly_budget_usd=0.10 where tenant_id=$1",
    [a],
  );
  const c1 = await local.connect(),
    c2 = await local.connect();
  await c1.query("begin");
  try {
    const first = await runCommand(
      "budget.reserve",
      { ...scope, callKey: "understand", maxUsd: "0.06" },
      fixtures[0].context,
      c1,
    );
    assert.equal(first.admitted, true);
    let completed = false;
    const pending = runCommand(
      "budget.reserve",
      { ...scope, callKey: "classify", maxUsd: "0.06" },
      fixtures[0].context,
      c2,
    ).then((value) => ((completed = true), value));
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(completed, false);
    await c1.query("commit");
    assert.equal((await pending).admitted, false);
  } finally {
    await c1.query("rollback");
  }
  assert.equal(
    (
      await runCommand("budget.reserve", {
        ...scope,
        callKey: "understand",
        maxUsd: "0.06",
      })
    ).admitted,
    false,
  );
  const unknown = await runCommand("budget.settle", {
    ...scope,
    callKey: "understand",
    actualUsd: null,
    generationId: "gen-synthetic",
  });
  assert.equal(unknown.status, "uncertain");
  assert.equal(
    (
      await runCommand("budget.reserve", {
        ...scope,
        callKey: "write",
        maxUsd: "0.05",
      })
    ).admitted,
    false,
  );
  await runCommand("budget.settle", {
    ...scope,
    callKey: "understand",
    actualUsd: "0.02",
    generationId: "gen-synthetic",
  });
  assert.equal(
    (
      await runCommand("budget.reserve", {
        ...scope,
        callKey: "write",
        maxUsd: "0.05",
      })
    ).admitted,
    true,
  );
  await assert.rejects(
    runCommand("budget.settle", {
      ...scope,
      callKey: "understand",
      actualUsd: "0.01",
      generationId: "gen-synthetic",
    }),
  );
  await assert.rejects(
    runCommand(
      "budget.reserve",
      { ...scope, callKey: "rewrite", maxUsd: "0.01" },
      fixtures[1].context,
    ),
  );
});

test("completion and private-note delivery are fenced, audited and retry-safe; an uncertain send cannot be sent again", async () => {
  const input = base(),
    r = (
      await local.db.query(
        "select id,lease_token from chat_agent_runs where tenant_id=$1",
        [a],
      )
    ).rows[0];
  const scope = { ...input, runId: r.id, leaseToken: r.lease_token };
  await runCommand("budget.settle", {
    ...scope,
    callKey: "write",
    actualUsd: "0",
    generationId: "gen-write-synthetic",
  });
  const result = {
    mode: "draft",
    outcome: "drafted",
    replyText: "A synthetic safe draft.",
    costUsd: "0",
    packVersion: 1,
    understanding: {
      intent: null,
      services: [],
      language: "en",
      gist: "Synthetic inquiry",
      signals: [],
      slots: [],
    },
    decision: { reason: "information", handoff: false },
    checks: [],
    provenance: [],
    models: [],
    timingsMs: {},
  };
  assert.equal(
    (await runCommand("complete", { ...scope, result })).status,
    "ready",
  );
  assert.equal(
    (await runCommand("complete", { ...scope, result })).status,
    "ready",
  );
  assert.equal(
    (await runCommand("delivery.claim", scope)).status,
    "delivering",
  );
  assert.equal(
    (await runCommand("delivery.claim", scope)).status,
    "delivering_existing",
  );
  assert.equal(
    (await runCommand("delivery.uncertain", scope)).status,
    "uncertain",
  );
  assert.equal((await runCommand("delivery.claim", scope)).status, "uncertain");
  await assert.rejects(
    runCommand("complete", {
      ...scope,
      result: { ...result, replyText: "changed retry" },
    }),
  );
  const persisted = (
    await local.db.query(
      "select reply_text,cost_usd,decision_json from chat_turns where tenant_id=$1 and trigger_message_id=$2",
      [a, input.triggerMessageId],
    )
  ).rows[0];
  assert.equal(persisted.reply_text, result.replyText);
  assert.equal(Number(persisted.cost_usd), 0.02);
  assert.equal(persisted.decision_json.delivery, "uncertain");
  assert.equal(
    (
      await local.db.query(
        "select gist from leads where tenant_id=$1 and conversation_id=$2",
        [a, input.conversationId],
      )
    ).rows[0].gist,
    "Synthetic inquiry",
  );
  assert.equal(
    (
      await local.db.query(
        "select count(*) n from domain_events where tenant_id=$1 and event_type='chat.lead.enriched'",
        [a],
      )
    ).rows[0].n,
    "1",
  );
});

const nextMessage = async (n, author = "customer") => {
  const f = fixtures[0];
  return local.db
    .query("select chat_capture($1::jsonb,$2,$3::jsonb) result", [
      JSON.stringify(f.context),
      author === "staff" ? "events" : "agent",
      JSON.stringify({
        workspaceId: f.workspaceId,
        secretHash: f.secretHash,
        channelId: f.channelId,
        identity: { displayName: "Synthetic customer", sourceId: "fixture" },
        message: {
          messageId: n,
          accountId: 901,
          inboxId: 20,
          conversationId: 10,
          contactId: 10,
          status: "open",
          channelKind: "website",
          author,
          private: false,
          content:
            author === "staff" ? "A staff reply." : "New synthetic inquiry.",
          contentType: "text",
          attachments: [],
          staffUserId: author === "staff" ? 55 : null,
          createdAt: new Date().toISOString(),
        },
      }),
    ])
    .then((r) => r.rows[0].result);
};
const readyResult = () => ({
  mode: "draft",
  outcome: "drafted",
  replyText: "Synthetic revised draft.",
  costUsd: "0",
  packVersion: 1,
  understanding: {
    intent: null,
    services: [],
    language: "en",
    gist: "New inquiry",
    signals: [],
    slots: [],
  },
  decision: { handoff: false },
  checks: [],
  provenance: [],
  models: [],
  timingsMs: {},
});
test("new customer messages and staff quiet fence completed drafts; invalid enrichment rolls back the entire command", async () => {
  const captured = await nextMessage(20),
    input = { ...base(), triggerMessageId: captured.messageId };
  const claim = await runCommand("claim", input),
    scope = { ...input, runId: claim.runId, leaseToken: claim.leaseToken };
  const result = readyResult();
  await assert.rejects(
    runCommand("complete", {
      ...scope,
      result: {
        ...result,
        understanding: { ...result.understanding, services: ["not_declared"] },
      },
    }),
  );
  assert.equal(
    (
      await local.db.query(
        "select status from chat_agent_runs where tenant_id=$1 and id=$2",
        [a, claim.runId],
      )
    ).rows[0].status,
    "running",
  );
  assert.equal(
    (await runCommand("complete", { ...scope, result })).status,
    "ready",
  );
  const newer = await nextMessage(21);
  assert.equal(
    (await runCommand("delivery.claim", scope)).status,
    "superseded",
  );
  const second = { ...base(), triggerMessageId: newer.messageId },
    claim2 = await runCommand("claim", second);
  await nextMessage(22, "staff");
  assert.equal(
    (
      await runCommand("complete", {
        ...second,
        runId: claim2.runId,
        leaseToken: claim2.leaseToken,
        result,
      })
    ).status,
    "superseded",
  );
  assert.equal(
    (
      await local.db.query(
        "select reply_text from chat_turns where tenant_id=$1 and id=(select turn_id from chat_agent_runs where tenant_id=$1 and id=$2)",
        [a, claim2.runId],
      )
    ).rows[0].reply_text,
    null,
  );
});
test("expired leases rotate capabilities, pending cost prevents reclaim, and accounting survives module revocation", async () => {
  await local.db.query(
    "update chat_conversations set quiet_until=null where tenant_id=$1",
    [a],
  );
  const captured = await nextMessage(30),
    input = { ...base(), triggerMessageId: captured.messageId };
  const claim = await runCommand("claim", input);
  await local.db.query(
    "update chat_agent_runs set lease_until=now()-interval '1 second' where tenant_id=$1 and id=$2",
    [a, claim.runId],
  );
  const renewed = await runCommand("claim", input);
  assert.notEqual(renewed.leaseToken, claim.leaseToken);
  await assert.rejects(
    runCommand("complete", {
      ...input,
      runId: claim.runId,
      leaseToken: claim.leaseToken,
      result: readyResult(),
    }),
  );
  const scope = {
    ...input,
    runId: renewed.runId,
    leaseToken: renewed.leaseToken,
  };
  assert.equal(
    (
      await runCommand("budget.reserve", {
        ...scope,
        callKey: "understand",
        maxUsd: "0.01",
      })
    ).admitted,
    true,
  );
  await local.db.query(
    "update chat_agent_runs set lease_until=now()-interval '1 second' where tenant_id=$1 and id=$2",
    [a, claim.runId],
  );
  assert.equal((await runCommand("claim", input)).status, "busy");
  await local.db.query(
    "update tenant_modules set is_enabled=false where tenant_id=$1",
    [a],
  );
  await assert.rejects(runCommand("claim", input));
  assert.equal(
    (
      await runCommand("budget.settle", {
        ...scope,
        callKey: "understand",
        actualUsd: "0.005",
        generationId: "gen-late",
      })
    ).status,
    "settled",
  );
  await local.db.query(
    "update tenant_modules set is_enabled=true where tenant_id=$1",
    [a],
  );
  await local.db.query("set role anon");
  try {
    await assert.rejects(runCommand("claim", input));
    await assert.rejects(local.db.query("select * from chat_agent_runs"));
    await assert.rejects(
      local.db.query("select * from chat_agent_cost_entries"),
    );
  } finally {
    await local.db.query("reset role");
  }
});

test("preview server boundary logs only a sandbox turn, replays before regeneration and rejects changed input or tenant brands", async () => {
  const { runMockPreview } =
    await import("../src/features/chat/agent/preview-core.ts");
  let loads = 0;
  const deps = {
    async authorize() {
      return ctx();
    },
    async load(tenantId, brandId, source) {
      loads++;
      const row = (
        await local.db.query(
          "select tenant_id,brand_id,version,pack_json from chat_knowledge_packs where tenant_id=$1 and brand_id=$2 and status=$3 order by version desc limit 1",
          [tenantId, brandId, source],
        )
      ).rows[0];
      return row
        ? {
            tenantId: row.tenant_id,
            brandId: row.brand_id,
            version: row.version,
            body: row.pack_json,
          }
        : null;
    },
    async command(context, action, input) {
      return command(action, input, context);
    },
  };
  const key = randomUUID(),
    input = {
      brandId: brandA,
      knowledge: "published",
      scenario: "information",
      message: "What are the hours?",
      history: [],
    };
  const result = await runMockPreview(input, key, deps);
  assert.equal(result.mock, true);
  assert.equal(result.costUsd, "0");
  assert.match(result.replyText, /no published opening hours/);
  assert.deepEqual(await runMockPreview(input, key, deps), result);
  assert.equal(loads, 1);
  await assert.rejects(
    runMockPreview({ ...input, message: "Changed request" }, key, deps),
  );
  await assert.rejects(
    runMockPreview({ ...input, brandId: brandB }, randomUUID(), deps),
  );
  const manager = { ...deps, authorize: async () => ctx(a, "manager") };
  await assert.rejects(runMockPreview(input, randomUUID(), manager));
  assert.equal(JSON.stringify(result).includes("agent-owner"), false);
});

test("mock worker logs dry-run only and sends at most one private draft across duplicate or uncertain retries", async () => {
  const { runStoredMockTurn } =
    await import("../src/features/chat/agent/worker-core.ts");
  const { createMockModel } =
    await import("../src/features/chat/agent/mock-model.ts");
  const captured = await nextMessage(40),
    scope = { ...fixtures[0], triggerMessageId: captured.messageId };
  delete scope.context;
  delete scope.secretHash;
  const dataInput = { ...base(), triggerMessageId: captured.messageId };
  let sends = 0;
  const store = {
    load: async () =>
      local.db
        .query("select chat_agent_load($1::jsonb,$2::jsonb) result", [
          JSON.stringify(fixtures[0].context),
          JSON.stringify(dataInput),
        ])
        .then((r) => r.rows[0].result),
    run: async (action, input) =>
      runCommand(action, { ...dataInput, ...input }),
    dryRun: async (result) =>
      local.db
        .query("select chat_agent_dry_run($1::jsonb,$2::jsonb) result", [
          JSON.stringify(fixtures[0].context),
          JSON.stringify({ ...dataInput, ...(result ? { result } : {}) }),
        ])
        .then((r) => r.rows[0].result),
  };
  const counts = await local.db.query(
    "select (select count(*) from chat_agent_runs) runs,(select count(*) from chat_agent_cost_entries) costs,(select count(*) from lead_events) events,(select count(*) from chat_state) ledgers",
  );
  let result = await runStoredMockTurn(
    { scope, now: new Date().toISOString(), dryRun: true, deliver: true },
    store,
    createMockModel("information", pack),
    async () => {
      sends++;
      return { id: 111 };
    },
  );
  assert.equal(result.status, "dry_run");
  assert.equal(sends, 0);
  await runStoredMockTurn(
    { scope, now: new Date().toISOString(), dryRun: true, deliver: true },
    store,
    createMockModel("information", pack),
    async () => {
      sends++;
      return { id: 111 };
    },
  );
  assert.deepEqual(
    (
      await local.db.query(
        "select (select count(*) from chat_agent_runs) runs,(select count(*) from chat_agent_cost_entries) costs,(select count(*) from lead_events) events,(select count(*) from chat_state) ledgers",
      )
    ).rows,
    counts.rows,
  );
  const newer = await nextMessage(41);
  scope.triggerMessageId = newer.messageId;
  dataInput.triggerMessageId = newer.messageId;
  result = await runStoredMockTurn(
    { scope, now: new Date().toISOString(), dryRun: false, deliver: true },
    store,
    createMockModel("information", pack),
    async () => {
      sends++;
      throw new Error("Lost provider response");
    },
  );
  assert.equal(result.status, "uncertain");
  assert.equal(sends, 1);
  result = await runStoredMockTurn(
    { scope, now: new Date().toISOString(), dryRun: false, deliver: true },
    store,
    createMockModel("information", pack),
    async () => {
      sends++;
      return { id: 112 };
    },
  );
  assert.equal(result.status, "uncertain");
  assert.equal(sends, 1);
});

test("each paid-call reservation rechecks the latest customer, staff quiet and published pack", async () => {
  await local.db.query(
    "update chat_conversations set quiet_until=null where tenant_id=$1",
    [a],
  );
  const fresh = await nextMessage(50);
  const firstInput = { ...base(), triggerMessageId: fresh.messageId };
  const first = await runCommand("claim", firstInput);
  const firstScope = {
    ...firstInput,
    runId: first.runId,
    leaseToken: first.leaseToken,
  };
  const newer = await nextMessage(51);
  assert.deepEqual(
    await runCommand("budget.reserve", {
      ...firstScope,
      callKey: "understand",
      maxUsd: "0.001",
    }),
    { admitted: false, reason: "superseded" },
  );

  const secondInput = { ...base(), triggerMessageId: newer.messageId };
  const second = await runCommand("claim", secondInput);
  const secondScope = {
    ...secondInput,
    runId: second.runId,
    leaseToken: second.leaseToken,
  };
  await nextMessage(52, "staff");
  assert.deepEqual(
    await runCommand("budget.reserve", {
      ...secondScope,
      callKey: "understand",
      maxUsd: "0.001",
    }),
    { admitted: false, reason: "superseded" },
  );

  await local.db.query(
    "update chat_conversations set quiet_until=null where tenant_id=$1",
    [a],
  );
  const latest = await nextMessage(53);
  const thirdInput = { ...base(), triggerMessageId: latest.messageId };
  const third = await runCommand("claim", thirdInput);
  await local.db.query(
    "update chat_knowledge_packs set status='archived' where tenant_id=$1 and brand_id=$2 and status='published'",
    [a, brandA],
  );
  await local.db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,2,'published',$3::jsonb)",
    [a, brandA, JSON.stringify(pack)],
  );
  assert.deepEqual(
    await runCommand("budget.reserve", {
      ...thirdInput,
      runId: third.runId,
      leaseToken: third.leaseToken,
      callKey: "understand",
      maxUsd: "0.001",
    }),
    { admitted: false, reason: "superseded" },
  );
  const reserved = await local.db.query(
    "select count(*) n from chat_agent_cost_entries where run_id=any($1::uuid[])",
    [[first.runId, second.runId, third.runId]],
  );
  assert.equal(reserved.rows[0].n, "0");
});

test("an unsent ready draft resumes without regenerating; terminal delivery evidence survives stale retries", async () => {
  const { runStoredMockTurn } =
    await import("../src/features/chat/agent/worker-core.ts");
  const { createMockModel } =
    await import("../src/features/chat/agent/mock-model.ts");
  await local.db.query(
    "update chat_conversations set quiet_until=null where tenant_id=$1",
    [a],
  );
  const msg = await nextMessage(60),
    scope = { ...fixtures[0], triggerMessageId: msg.messageId };
  delete scope.context;
  delete scope.secretHash;
  const input = { ...base(), triggerMessageId: msg.messageId };
  const store = {
    load: async () => {
      throw new Error("Unexpected reload");
    },
    run: (action, extra) => runCommand(action, { ...input, ...extra }),
    dryRun: async () => {
      throw new Error("Unexpected dry run");
    },
  };
  const args = {
    scope,
    now: new Date().toISOString(),
    dryRun: false,
    deliver: false,
  };
  let sends = 0;
  assert.equal(
    (
      await runStoredMockTurn(
        args,
        store,
        createMockModel("information", pack),
        async () => {
          sends++;
          return { id: 160 };
        },
      )
    ).status,
    "ready",
  );
  const row = (
    await local.db.query(
      "select id,lease_token from chat_agent_runs where tenant_id=$1 and trigger_message_id=$2",
      [a, msg.messageId],
    )
  ).rows[0];
  const unavailable = {
    kind: "mock",
    complete: async () => {
      throw new Error("Must not regenerate");
    },
  };
  assert.equal(
    (
      await runStoredMockTurn(
        { ...args, deliver: true },
        store,
        unavailable,
        async () => {
          sends++;
          return { id: 160 };
        },
      )
    ).status,
    "delivered",
  );
  assert.equal(sends, 1);
  const before = (
    await local.db.query(
      "select reply_text,decision_json from chat_turns where tenant_id=$1 and trigger_message_id=$2",
      [a, msg.messageId],
    )
  ).rows;
  await nextMessage(61);
  const capability = { ...input, runId: row.id, leaseToken: row.lease_token };
  assert.equal(
    (await runCommand("delivery.claim", capability)).status,
    "delivered",
  );
  assert.deepEqual(
    (
      await local.db.query(
        "select reply_text,decision_json from chat_turns where tenant_id=$1 and trigger_message_id=$2",
        [a, msg.messageId],
      )
    ).rows,
    before,
  );
  const uncertain = (
    await local.db.query(
      "select id,lease_token,trigger_message_id from chat_agent_runs where tenant_id=$1 and status='uncertain'",
      [a],
    )
  ).rows[0];
  assert.ok(uncertain);
  assert.equal(
    (
      await runCommand("delivery.claim", {
        ...base(),
        triggerMessageId: uncertain.trigger_message_id,
        runId: uncertain.id,
        leaseToken: uncertain.lease_token,
      })
    ).status,
    "uncertain",
  );
});

test("failed understanding flags handoff atomically even without a gist", async () => {
  const msg = await nextMessage(62),
    input = { ...base(), triggerMessageId: msg.messageId };
  const claimed = await runCommand("claim", input);
  await local.db.query(
    "update leads set handoff=false where tenant_id=$1 and conversation_id=$2",
    [a, input.conversationId],
  );
  const capability = {
    ...input,
    runId: claimed.runId,
    leaseToken: claimed.leaseToken,
  };
  const result = {
    ...readyResult(),
    packVersion: 2,
    outcome: "fallback",
    understanding: {},
    decision: { handoff: true, reason: "unavailable_or_unsafe" },
  };
  const before = (
    await local.db.query(
      "select count(*) n from domain_events where tenant_id=$1 and event_type='chat.lead.enriched'",
      [a],
    )
  ).rows[0].n;
  await runCommand("complete", { ...capability, result });
  await runCommand("complete", { ...capability, result });
  assert.equal(
    (
      await local.db.query(
        "select handoff from leads where tenant_id=$1 and conversation_id=$2",
        [a, input.conversationId],
      )
    ).rows[0].handoff,
    true,
  );
  const after = (
    await local.db.query(
      "select count(*) n from domain_events where tenant_id=$1 and event_type='chat.lead.enriched'",
      [a],
    )
  ).rows[0].n;
  assert.equal(Number(after), Number(before) + 1);
});

test("same-version brand remapping invalidates both final delivery and spend capabilities", async () => {
  const msg = await nextMessage(70),
    input = { ...base(), triggerMessageId: msg.messageId };
  const claim = await runCommand("claim", input);
  const capability = {
    ...input,
    runId: claim.runId,
    leaseToken: claim.leaseToken,
  };
  await runCommand("complete", {
    ...capability,
    result: { ...readyResult(), packVersion: 2 },
  });
  assert.equal(
    (await runCommand("delivery.claim", capability)).status,
    "delivering",
  );
  const target = () =>
    local.db.query("select chat_agent_target($1::jsonb,$2::jsonb) result", [
      JSON.stringify(fixtures[0].context),
      JSON.stringify(capability),
    ]);
  assert.deepEqual((await target()).rows[0].result, {
    accountId: 901,
    conversationId: 10,
    triggerProviderId: 70,
    knowledgeVersion: 2,
  });
  const otherBrand = (
    await local.db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Other QA brand','other-qa-brand','Other') returning id",
      [a],
    )
  ).rows[0].id;
  await local.db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,2,'published',$3::jsonb)",
    [a, otherBrand, JSON.stringify(pack)],
  );
  const remap = (brand) =>
    local.db.query(
      "update chat_channels set brand_id=$1 where tenant_id=$2 and id=$3",
      [brand, a, input.channelId],
    );
  await remap(otherBrand);
  await assert.rejects(target());
  await remap(brandA);
  const latest = await nextMessage(71),
    nextInput = { ...base(), triggerMessageId: latest.messageId };
  const next = await runCommand("claim", nextInput);
  await remap(otherBrand);
  assert.deepEqual(
    await runCommand("budget.reserve", {
      ...nextInput,
      runId: next.runId,
      leaseToken: next.leaseToken,
      callKey: "understand",
      maxUsd: "0.001",
    }),
    { admitted: false, reason: "superseded" },
  );
  await remap(brandA);
});

test("generated draft provenance is whitelisted, tenant-scoped and hidden from masked readers; ledger completion is atomic", async () => {
  const { runStoredMockTurn } =
    await import("../src/features/chat/agent/worker-core.ts");
  const { createMockModel } =
    await import("../src/features/chat/agent/mock-model.ts");
  const msg = await nextMessage(80),
    input = { ...base(), triggerMessageId: msg.messageId };
  const { context, secretHash, tenantId, ...rest } = fixtures[0];
  const scope = { ...rest, tenantId, triggerMessageId: msg.messageId };
  const store = {
    load: async () => null,
    run: (action, extra) => runCommand(action, { ...input, ...extra }),
    dryRun: async () => null,
  };
  await runStoredMockTurn(
    { scope, now: new Date().toISOString(), dryRun: false, deliver: false },
    store,
    createMockModel("information", pack),
    async () => {
      throw Error("Must not post");
    },
  );
  const lead = (
    await local.db.query(
      "select id from leads where tenant_id=$1 and conversation_id=$2",
      [a, input.conversationId],
    )
  ).rows[0].id;
  const read = (c = ctx(), id = lead) =>
    local.db
      .query("select chat_agent_draft_read($1::jsonb,$2::jsonb) result", [
        JSON.stringify(c),
        JSON.stringify({ id }),
      ])
      .then((r) => r.rows[0].result);
  const result = await read();
  assert.deepEqual(result.sourceRefs, ["hours"]);
  assert.equal(result.mock, true);
  assert.equal(result.privateNoteStatus, "pending");
  assert.equal(JSON.stringify(result).includes("local-synthetic-mock"), false);
  assert.equal((await read(ctx(a, "manager"))).text, result.text);
  assert.equal(await read(ctx(b)), null);
  await local.db.query(
    "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,'agent-viewer','viewer@example.invalid','Viewer','viewer','active')",
    [a],
  );
  await local.db.query(
    "insert into chat_role_permissions(tenant_id,role,permission,allowed) values($1,'viewer','leads:view',true)",
    [a],
  );
  assert.equal(await read(ctx(a, "viewer")), null);
  const ledger = (
    await local.db.query(
      "select ledger_json from chat_state where tenant_id=$1 and conversation_id=$2",
      [a, input.conversationId],
    )
  ).rows[0].ledger_json;
  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.language, "en");
  const completed = (
    await local.db.query(
      "select count(*) n from domain_events where tenant_id=$1 and event_type='chat.agent.turn_completed' and payload_json->>'turnId'=(select id::text from chat_turns where tenant_id=$1 and trigger_message_id=$2)",
      [a, msg.messageId],
    )
  ).rows[0].n;
  assert.equal(completed, "1");
  await local.db.query("set role authenticated");
  try {
    await assert.rejects(read());
  } finally {
    await local.db.query("reset role");
  }
});

test("actual contact context requires a verified exact customer identity and active brand branches, even with the same phone in another tenant", async () => {
  const { buildAgentContext } =
    await import("../src/features/chat/agent/context.ts");
  const customerIds = [];
  for (const [i, t] of [a, b].entries()) {
    const customer = (
      await local.db.query(
        "insert into customers(tenant_id,name,phone,normalized_phone_e164) values($1,$2,'9000000111','+919000000111') returning id,normalized_phone_e164",
        [t, i ? "FOREIGN CUSTOMER" : "Synthetic returning customer"],
      )
    ).rows[0];
    customerIds.push(customer.id);
    const person = (
      await local.db.query(
        "select contact_id from chat_conversations where tenant_id=$1 and id=$2",
        [t, fixtures[i].conversationId],
      )
    ).rows[0].contact_id;
    await local.db.query(
      "update chat_contacts set customer_id=$1 where tenant_id=$2 and id=$3",
      [customer.id, t, person],
    );
    await local.db.query(
      "insert into chat_contact_identities(tenant_id,contact_id,kind,value,verified) values($1,$2,'phone',$3,false)",
      [t, person, customer.normalized_phone_e164],
    );
    await local.db.query(
      "insert into customer_addresses(tenant_id,customer_id,label,address_line_1,city) values($1,$2,'Home',$3,'Demo')",
      [t, customer.id, i ? "FOREIGN STREET" : "PRIVATE LOCAL STREET"],
    );
  }
  const msg = await nextMessage(90),
    input = { ...base(), triggerMessageId: msg.messageId };
  const load = () =>
    local.db
      .query("select chat_agent_load($1::jsonb,$2::jsonb) result", [
        JSON.stringify(fixtures[0].context),
        JSON.stringify(input),
      ])
      .then((r) => r.rows[0].result);
  assert.equal((await load()).background.customer, null);
  await local.db.query(
    "update chat_contact_identities set verified=true where tenant_id=$1 and kind='phone'",
    [a],
  );
  const location = (
    await local.db.query(
      "insert into tenant_locations(tenant_id,code,name,address_line_1) values($1,'local-branch','Synthetic branch','Business road') returning id",
      [a],
    )
  ).rows[0].id;
  await local.db.query(
    "insert into chat_brand_locations(tenant_id,brand_id,location_id,map_url) values($1,$2,$3,'https://maps.example.invalid/demo')",
    [a, brandA, location],
  );
  const raw = await load(),
    { context, secretHash, ...scope } = fixtures[0];
  scope.triggerMessageId = msg.messageId;
  const built = buildAgentContext(scope, raw);
  assert.equal(built.background.customer.id, customerIds[0]);
  assert.equal(built.modelContext.background.returningCustomer, true);
  assert.equal(built.locations[0].code, "local-branch");
  assert.equal(built.locations[0].default, false);
  assert.equal(
    JSON.stringify(built.modelContext).includes("PRIVATE LOCAL STREET"),
    false,
  );
  assert.equal(JSON.stringify(raw).includes("FOREIGN"), false);
  await local.db.query(
    "update tenant_locations set is_active=false where tenant_id=$1 and id=$2",
    [a, location],
  );
  assert.deepEqual((await load()).locations, []);
});

test("shared staff claims serialize devices and exact authenticated source provenance avoids human quiet; forged or edited-without-claim replies remain staff", async () => {
  await local.db.query(
    "update tenant_modules set config_json=config_json||'{\"staffDraftSendEnabled\":true}'::jsonb where tenant_id=$1",
    [a],
  );
  for (const [who, provider] of [
    ["owner", 55],
    ["manager", 56],
  ])
    await local.db.query(
      "insert into chat_staff_links(tenant_id,tenant_user_id,chatwoot_user_id) select $1,id,$3 from tenant_users where tenant_id=$1 and clerk_user_id=$2 on conflict do nothing",
      [a, "agent-" + who, provider],
    );
  const msg = await nextMessage(100),
    input = { ...base(), triggerMessageId: msg.messageId },
    r = await runCommand("claim", input);
  const capability = { ...input, runId: r.runId, leaseToken: r.leaseToken };
  await runCommand("complete", {
    ...capability,
    result: { ...readyResult(), packVersion: 2 },
  });
  await runCommand("delivery.claim", capability);
  await runCommand("delivery.record", { ...capability, providerNoteId: 501 });
  const send = {
    draftId: r.runId,
    accountId: 901,
    conversationId: 10,
    noteId: 501,
    staffId: 55,
    content: "Reviewed synthetic reply.",
  };
  const command = (action, body, context = ctx(), db = local.db) =>
    db
      .query("select chat_staff_draft_command($1::jsonb,$2,$3::jsonb) result", [
        JSON.stringify(context),
        action,
        JSON.stringify(body),
      ])
      .then((x) => x.rows[0].result);
  const c1 = await local.connect(),
    c2 = await local.connect();
  await c1.query("begin");
  try {
    assert.equal((await command("claim", send, ctx(), c1)).status, "claimed");
    let done = false;
    const second = command(
      "claim",
      { ...send, staffId: 56 },
      ctx(a, "manager"),
      c2,
    ).then((value) => ((done = true), value));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(done, false);
    await c1.query("commit");
    assert.equal((await second).status, "uncertain");
  } finally {
    await c1.query("rollback");
    await c1.end();
    await c2.end();
  }
  await assert.rejects(command("claim", send, ctx(b)));
  assert.equal((await command("claim", send)).status, "uncertain");
  assert.equal(
    (await command("record", { ...send, providerMessageId: 999 })).status,
    "uncertain",
  );
  const fixture = fixtures[0];
  const body = {
    workspaceId: fixture.workspaceId,
    secretHash: fixture.secretHash,
    channelId: fixture.channelId,
    message: {
      messageId: 101,
      accountId: 901,
      inboxId: 20,
      conversationId: 10,
      contactId: 10,
      status: "open",
      channelKind: "website",
      author: "staff",
      private: false,
      content: send.content,
      contentType: "text",
      attachments: [],
      staffUserId: 55,
      createdAt: new Date().toISOString(),
      sourceDraft: { draftId: r.runId, noteId: 501 },
    },
  };
  const capture = () =>
    local.db.query("select chat_capture($1::jsonb,'events',$2::jsonb) result", [
      JSON.stringify(fixture.context),
      JSON.stringify(body),
    ]);
  await capture();
  await capture();
  const actual = (
    await local.db.query(
      "select author,staff_chatwoot_user_id from chat_messages where tenant_id=$1 and chatwoot_message_id=101",
      [a],
    )
  ).rows[0];
  assert.equal(actual.author, "bot");
  assert.equal(actual.staff_chatwoot_user_id, null);
  assert.equal(
    (
      await local.db.query(
        "select quiet_until from chat_conversations where tenant_id=$1 and id=$2",
        [a, input.conversationId],
      )
    ).rows[0].quiet_until,
    null,
  );
  assert.equal(
    (await command("record", { ...send, providerMessageId: 101 })).status,
    "sent",
  );
  body.message.messageId = 102;
  body.message.content = "An unclaimed modification.";
  await capture();
  assert.equal(
    (
      await local.db.query(
        "select author from chat_messages where tenant_id=$1 and chatwoot_message_id=102",
        [a],
      )
    ).rows[0].author,
    "staff",
  );
  assert.ok(
    (
      await local.db.query(
        "select quiet_until>now() quiet from chat_conversations where tenant_id=$1 and id=$2",
        [a, input.conversationId],
      )
    ).rows[0].quiet,
  );
});
