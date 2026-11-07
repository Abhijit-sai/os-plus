import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runAgentTurn } from "../src/features/chat/agent/turn.ts";
const id = (n) => "7c000000-0000-4000-8000-" + String(n).padStart(12, "0");
const scope = {
  tenantId: id(1),
  workspaceId: id(2),
  channelId: id(3),
  conversationId: id(4),
  triggerMessageId: id(5),
};
const pack = JSON.parse(
  readFileSync(
    new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
    "utf8",
  ),
);
const request = () => ({
  scope,
  now: "2026-11-01T10:00:01Z",
  data: {
    ...scope,
    brandId: id(6),
    active: true,
    moduleEnabled: true,
    channelKind: "website",
    agentMode: "draft",
    quietUntil: null,
    ledger: {},
    historyComplete: true,
    pack: {
      tenantId: id(1),
      brandId: id(6),
      version: 1,
      body: structuredClone(pack),
    },
    messages: [
      {
        id: id(5),
        tenantId: id(1),
        conversationId: id(4),
        providerId: 1,
        author: "customer",
        private: false,
        content: "When are you open?",
        at: "2026-11-01T10:00:00Z",
      },
    ],
  },
});
const understanding = {
  confidence: "high",
  intent: null,
  services: [],
  language: "en",
  gist: "Opening enquiry",
  signals: [],
  slots: [],
};
test("live text assistance returns a private draft with exact incurred costs and approved fact provenance", async () => {
  const result = await runAgentTurn(request(), {
    kind: "live",
    async complete({ stage }) {
      return {
        json:
          stage === "understand"
            ? understanding
            : stage === "classify"
              ? { signals: [] }
              : { text: "{{FACT:hours}}" },
        model: "synthetic/live-test",
        costUsd:
          stage === "understand"
            ? "0.000000000001"
            : stage === "classify"
              ? "0.002"
              : "0.003",
      };
    },
  });
  assert.equal(result.outcome, "drafted");
  assert.equal(result.mode, "draft");
  assert.equal(result.costUsd, "0.005000000001");
  assert.equal(result.decision.mock, false);
  assert.match(result.replyText, /no published opening hours/);
  assert.deepEqual(result.provenance, [
    { kind: "knowledge", version: 1, reference: "hours" },
  ]);
  assert.deepEqual(
    Object.fromEntries(result.models.map((m) => [m.stage, m.costUsd])),
    { understand: "0.000000000001", classify: "0.002", write: "0.003" },
  );
});

const { runStoredAgentTurn } =
  await import("../src/features/chat/agent/worker-core.ts");
test("stored live assistance claims once and delivers only a private draft", async () => {
  const actions = [],
    notes = [];
  const capability = { runId: id(7), leaseToken: id(8) };
  const output = await runStoredAgentTurn(
    { scope, now: request().now, dryRun: false, deliver: true },
    {
      async load() {
        return request().data;
      },
      async dryRun() {
        throw Error("unexpected dry run");
      },
      async publicDelivery() {
        throw Error("live drafts cannot invoke public delivery");
      },
      async run(action, input) {
        actions.push(action);
        if (action === "claim")
          return { status: "claimed", ...capability, context: request().data };
        if (action === "complete") {
          assert.equal(input.result.mode, "draft");
          assert.equal(input.result.costUsd, "0.003");
          return { status: "ready" };
        }
        if (action === "delivery.claim")
          return {
            status: "delivering",
            draftId: id(9),
            replyText: "Private suggestion",
          };
        if (action === "delivery.record") return { status: "delivered" };
        throw Error("unexpected action");
      },
    },
    {
      kind: "live",
      create(lease) {
        assert.deepEqual(lease, capability);
        return {
          kind: "live",
          async complete({ stage }) {
            return {
              json:
                stage === "understand"
                  ? understanding
                  : stage === "classify"
                    ? { signals: [] }
                    : { text: "{{FACT:hours}}" },
              model: "synthetic/live-test",
              costUsd: "0.001",
            };
          },
        };
      },
    },
    async (draft) => {
      notes.push(draft);
      return { id: 101 };
    },
  );
  assert.equal(output.status, "delivered");
  assert.equal(notes.length, 1);
  assert.deepEqual(actions, [
    "claim",
    "complete",
    "delivery.claim",
    "delivery.record",
  ]);
});

test("live assistance refuses automatic mode before making any model call", async () => {
  let calls = 0;
  const req = request();
  req.data.agentMode = "auto";
  await assert.rejects(
    () =>
      runAgentTurn(req, {
        kind: "live",
        async complete() {
          calls++;
          throw Error("unexpected paid call");
        },
      }),
    /private drafts only/i,
  );
  assert.equal(calls, 0);
});

import { createServer } from "node:http";
import { OpenRouterClient } from "../src/integrations/openrouter/client.ts";
const liveConfig = {
  models: {
    understand: "synthetic/live-test",
    classify: "synthetic/live-test",
    write: "synthetic/live-test",
  },
  provider: "synthetic-provider",
  maxPrice: { prompt: "1", completion: "2", request: "0" },
};
async function providerTest(run) {
  const seen = [];
  let payload = { json: { text: "{{FACT:hours}}" }, cost: 0.001 };
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (b) => (body += b));
    req.on("end", () => {
      seen.push(JSON.parse(body));
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: "gen-synthetic-" + seen.length,
          model: "synthetic/live-test",
          choices: [
            {
              finish_reason: "stop",
              message: {
                content:
                  typeof payload.json === "string"
                    ? payload.json
                    : JSON.stringify(payload.json),
              },
            },
          ],
          usage: payload.cost === null ? {} : { cost: payload.cost },
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run({
      seen,
      client: new OpenRouterClient({
        origin: "http://127.0.0.1:" + server.address().port,
        token: "fake-only",
        allowLocalMock: true,
      }),
      setPayload(value) {
        payload = value;
      },
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test("a live provider call requires a durable reservation before HTTP and settles exact usage", async () => {
  const { createLiveModel } =
    await import("../src/features/chat/agent/live-model.ts");
  await providerTest(async ({ client, seen }) => {
    const receipts = [];
    const model = createLiveModel(
      liveConfig,
      {
        async run(action, input) {
          receipts.push({ action, input });
          if (action === "budget.reserve") {
            assert.equal(seen.length, 0);
            assert.equal(input.callKey, "write");
            assert.ok(Number(input.maxUsd) > 0.001);
            return { admitted: true };
          }
          return { status: "settled" };
        },
      },
      client,
    );
    const result = await model.complete({
      stage: "write",
      context: {
        facts: { hours: "Staff confirms hours." },
        context: { messages: [] },
      },
      signal: new AbortController().signal,
    });
    assert.equal(seen.length, 1);
    assert.equal(result.costUsd, "0.001000000000");
    assert.deepEqual(result.json, { text: "{{FACT:hours}}" });
    assert.deepEqual(
      receipts.map((r) => r.action),
      ["budget.reserve", "budget.settle"],
    );
    assert.equal(receipts[1].input.actualUsd, "0.001000000000");
    assert.deepEqual(seen[0].provider.only, ["synthetic-provider"]);
    assert.equal(seen[0].provider.data_collection, "deny");
  });
});

test("a charged malformed completion retains its actual cost in the fallback audit", async () => {
  const { createLiveModel } =
    await import("../src/features/chat/agent/live-model.ts");
  await providerTest(async ({ client, seen, setPayload }) => {
    setPayload({ json: "not JSON", cost: 0.002 });
    const settlements = [];
    const model = createLiveModel(
      liveConfig,
      {
        async run(action, input) {
          if (action === "budget.reserve") return { admitted: true };
          settlements.push(input);
          return { status: "settled" };
        },
      },
      client,
    );
    const result = await runAgentTurn(request(), model);
    assert.equal(result.outcome, "fallback");
    assert.equal(seen.length, 1);
    assert.equal(settlements[0].actualUsd, "0.002000000000");
    assert.equal(result.costUsd, "0.002");
    assert.equal(result.models[0].costUsd, "0.002000000000");
    assert.equal(result.timingsMs.understand, result.models[0].timingMs);
    assert.ok(!JSON.stringify(result).includes("gen-synthetic"));
  });
});

test("canceling a stage aborts the provider request rather than allowing a late completion", async () => {
  let arrived;
  const received = new Promise((resolve) => (arrived = resolve));
  const server = createServer((req) => {
    req.resume();
    arrived();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new OpenRouterClient({
      origin: "http://127.0.0.1:" + server.address().port,
      token: "fake-only",
      allowLocalMock: true,
    });
    const controller = new AbortController();
    const pending = client
      .complete(
        {
          model: "synthetic/live-test",
          provider: "synthetic-provider",
          system: "Return JSON",
          user: "Synthetic only",
          maxTokens: 100,
          maxPrice: { prompt: 1, completion: 2, request: 0 },
          timeoutMs: 2000,
        },
        controller.signal,
      )
      .then(
        () => false,
        () => true,
      );
    await received;
    controller.abort();
    assert.equal(
      await Promise.race([
        pending,
        new Promise((resolve) => setTimeout(() => resolve(false), 300)),
      ]),
      true,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("budget denial makes zero HTTP requests and an unknown charge cannot be retried", async () => {
  const { createLiveModel } =
    await import("../src/features/chat/agent/live-model.ts");
  await providerTest(async ({ client, seen, setPayload }) => {
    const denied = createLiveModel(
      liveConfig,
      {
        async run() {
          return { admitted: false, reason: "budget" };
        },
      },
      client,
    );
    const input = {
      stage: "write",
      context: { facts: {} },
      signal: new AbortController().signal,
    };
    await assert.rejects(denied.complete(input));
    assert.equal(seen.length, 0);
    setPayload({ json: { text: "Draft" }, cost: null });
    const receipts = [];
    const unknown = createLiveModel(
      liveConfig,
      {
        async run(action, input) {
          receipts.push({ action, input });
          return action === "budget.reserve"
            ? { admitted: true }
            : { status: "uncertain" };
        },
      },
      client,
    );
    await assert.rejects(unknown.complete(input));
    await assert.rejects(unknown.complete(input));
    assert.equal(seen.length, 1);
    assert.deepEqual(
      receipts.map((r) => r.action),
      ["budget.reserve", "budget.settle"],
    );
    assert.equal(receipts[1].input.actualUsd, null);
  });
});
test("live dry run and duplicate claims never construct or call a paid model", async () => {
  let factories = 0,
    claims = 0,
    dryRuns = 0;
  const factory = {
    kind: "live",
    create() {
      factories++;
      throw Error("unexpected paid model");
    },
  };
  const store = {
    async load() {
      throw Error("unexpected load");
    },
    async dryRun() {
      dryRuns++;
      return null;
    },
    async run() {
      claims++;
      return { status: "busy" };
    },
  };
  const input = { scope, now: request().now, dryRun: true, deliver: true };
  assert.deepEqual(
    await runStoredAgentTurn(input, store, factory, async () => {
      throw Error("unexpected note");
    }),
    { status: "dry_run" },
  );
  assert.deepEqual(
    await runStoredAgentTurn(
      { ...input, dryRun: false },
      store,
      factory,
      async () => {
        throw Error("unexpected note");
      },
    ),
    { status: "busy" },
  );
  assert.equal(factories, 0);
  assert.equal(claims, 1);
  assert.equal(dryRuns, 1);
});
test("provider context excludes private staff notes and unrelated tenant records", async () => {
  const { createLiveModel } =
    await import("../src/features/chat/agent/live-model.ts");
  await providerTest(async ({ client, seen, setPayload }) => {
    setPayload({ json: understanding, cost: 0.001 });
    const req = request();
    req.data.messages.push({
      id: id(20),
      tenantId: scope.tenantId,
      conversationId: scope.conversationId,
      providerId: 2,
      author: "staff",
      private: true,
      content: "PRIVATE_STAFF_SENTINEL",
      at: "2026-11-01T10:00:00Z",
    });
    const model = createLiveModel(
      liveConfig,
      {
        async run(action) {
          return action === "budget.reserve"
            ? { admitted: true }
            : { status: "settled" };
        },
      },
      client,
    );
    await runAgentTurn(req, model);
    assert.ok(seen.length > 0);
    assert.ok(!JSON.stringify(seen).includes("PRIVATE_STAFF_SENTINEL"));
    const count = seen.length;
    req.data.messages[0].tenantId = id(99);
    await assert.rejects(() => runAgentTurn(req, model));
    assert.equal(seen.length, count);
  });
});

test("live runtime configuration fails closed until every live flag and price/model/provider bound is explicit", async () => {
  const { selectAgentRuntime } =
    await import("../src/features/chat/agent/runtime-config.ts");
  const env = {
    CHAT_AGENT_ENABLED: "true",
    CHAT_AGENT_MODEL_MODE: "live",
    CHAT_MODEL_LIVE_ENABLED: "true",
    CHAT_DRY_RUN: "false",
    CHAT_MODEL_UNDERSTAND: "synthetic/u",
    CHAT_MODEL_CLASSIFY: "synthetic/c",
    CHAT_MODEL_WRITE: "synthetic/w",
    CHAT_MODEL_PROVIDER: "synthetic-provider",
    CHAT_MODEL_MAX_PROMPT_USD_PER_MILLION: "1",
    CHAT_MODEL_MAX_COMPLETION_USD_PER_MILLION: "2",
    CHAT_MODEL_MAX_REQUEST_USD: "0",
    OPENROUTER_API_KEY: "fake-only",
  };
  assert.equal(
    selectAgentRuntime(env, "https://chat.example.invalid").kind,
    "live",
  );
  for (const flag of ["CHAT_AGENT_ENABLED", "CHAT_MODEL_LIVE_ENABLED"])
    assert.equal(
      selectAgentRuntime(
        { ...env, [flag]: "false" },
        "https://chat.example.invalid",
      ),
      null,
    );
  assert.equal(
    selectAgentRuntime(
      { ...env, CHAT_DRY_RUN: "true" },
      "https://chat.example.invalid",
    ),
    null,
  );
  for (const key of [
    "CHAT_MODEL_WRITE",
    "CHAT_MODEL_PROVIDER",
    "CHAT_MODEL_MAX_PROMPT_USD_PER_MILLION",
    "OPENROUTER_API_KEY",
  ])
    assert.throws(() =>
      selectAgentRuntime({ ...env, [key]: "" }, "https://chat.example.invalid"),
    );
  assert.equal(
    selectAgentRuntime(
      { ...env, CHAT_AGENT_MODEL_MODE: "mock" },
      "https://chat.example.invalid",
    ),
    null,
  );
  assert.equal(
    selectAgentRuntime(
      { ...env, CHAT_AGENT_MODEL_MODE: "mock" },
      "http://127.0.0.1:4130",
    ).kind,
    "mock",
  );
});

test("a known charge remains in the fallback audit when durable settlement cannot be confirmed", async () => {
  const { createLiveModel } =
    await import("../src/features/chat/agent/live-model.ts");
  await providerTest(async ({ client, seen, setPayload }) => {
    setPayload({ json: understanding, cost: 0.001 });
    const model = createLiveModel(
      liveConfig,
      {
        async run(action) {
          if (action === "budget.reserve") return { admitted: true };
          throw Error("synthetic database unavailable");
        },
      },
      client,
    );
    const result = await runAgentTurn(request(), model);
    assert.equal(seen.length, 1);
    assert.equal(result.outcome, "fallback");
    assert.equal(result.costUsd, "0.001");
    assert.equal(result.models[0].costUsd, "0.001000000000");
  });
});

test("live drafts reject invented alphabetic business claims even when no numeric or safety pattern matches", async () => {
  const result = await runAgentTurn(request(), {
    kind: "live",
    async complete({ stage }) {
      return {
        json:
          stage === "understand"
            ? understanding
            : stage === "classify"
              ? { signals: [] }
              : {
                  text: "All our shirts are organic cotton and we provide free alterations.",
                },
        model: "synthetic/live-test",
        costUsd: "0.001",
      };
    },
  });
  assert.equal(result.outcome, "fallback");
  assert.equal(result.replyText, pack.locked.handoffLine);
  assert.equal(result.costUsd, "0.004");
  assert.ok(result.checks.includes("unapproved_live_prose"));
  assert.ok(!result.replyText.includes("organic"));
});

test("live pilot accepts only its exact fictional website trigger and approved knowledge", async () => {
  const { allowsPilotContext, pilotKnowledgeHash } = await import("../src/features/chat/agent/live-draft-pilot.ts");
  const { scope: target, data, now } = request();
  const pilot = {
    scope: target,
    brandId: data.brandId,
    packVersion: data.pack.version,
    packSha256: pilotKnowledgeHash(data.pack.body),
    message: data.messages[0].content,
    displayName: null,
    expiresAt: "2026-11-01T11:00:00Z",
  };
  const instant = Date.parse(now);
  assert.equal(allowsPilotContext(pilot, target, data, instant), true);
  assert.equal(allowsPilotContext(pilot, { ...target, triggerMessageId: id(92) }, data, instant), false);
  assert.equal(allowsPilotContext(pilot, target, data, Date.parse(pilot.expiresAt)), false);
  for (const change of [
    (fixture) => { fixture.channelKind = "whatsapp"; },
    (fixture) => { fixture.brandId = id(91); fixture.pack.brandId = id(91); },
    (fixture) => { fixture.pack.version += 1; },
    (fixture) => { fixture.pack.body.hours.default = "Changed approved facts"; },
    (fixture) => { fixture.messages[0].content = "Different message"; },
    (fixture) => { fixture.messages[0].originalContent = "Unapproved content"; },
    (fixture) => { fixture.messages[0].inputSource = "voice"; },
    (fixture) => { fixture.messages.push({ ...fixture.messages[0], id: id(93), providerId: 2 }); },
    (fixture) => { fixture.background = { tenantId: target.tenantId, contactId: id(90), displayName: "Unapproved name", preferredLanguage: null, customer: null }; },
    (fixture) => { fixture.background = { tenantId: target.tenantId, contactId: id(90), displayName: null, preferredLanguage: null, customer: { tenantId: target.tenantId, id: id(94), verified: true, name: null, addresses: [], orders: [], openTasks: 0 } }; },
  ]) {
    const altered = structuredClone(data);
    change(altered);
    assert.equal(allowsPilotContext(pilot, target, altered, instant), false);
  }
});

test("live-pilot mode rejects missing or invalid binding instead of falling through to live", async () => {
  const { selectAgentRuntime } = await import("../src/features/chat/agent/runtime-config.ts");
  const { pilotKnowledgeHash } = await import("../src/features/chat/agent/live-draft-pilot.ts");
  const { scope: target, data } = request();
  const env = {
    CHAT_AGENT_ENABLED: "true", CHAT_DRY_RUN: "false", CHAT_AGENT_MODEL_MODE: "live-pilot", CHAT_MODEL_LIVE_ENABLED: "true",
    OPENROUTER_API_KEY: "fixture-unused", CHAT_MODEL_UNDERSTAND: "google/gemini-3.8-flash", CHAT_MODEL_CLASSIFY: "google/gemini-3.8-flash", CHAT_MODEL_WRITE: "google/gemini-3.8-flash",
    CHAT_MODEL_PROVIDER: "google-vertex/global", CHAT_MODEL_MAX_PROMPT_USD_PER_MILLION: "0.75", CHAT_MODEL_MAX_COMPLETION_USD_PER_MILLION: "3.75", CHAT_MODEL_MAX_REQUEST_USD: "0",
  };
  const origin = "https://chat.example.invalid";
  assert.throws(() => selectAgentRuntime(env, origin));
  assert.throws(() => selectAgentRuntime({ ...env, CHAT_LIVE_DRAFT_PILOT_JSON: "{}" }, origin));
  const pilot = { scope: target, brandId: data.brandId, packVersion: data.pack.version, packSha256: pilotKnowledgeHash(data.pack.body), message: data.messages[0].content, displayName: null, expiresAt: "2026-11-01T11:00:00Z" };
  const bound = { ...env, CHAT_LIVE_DRAFT_PILOT_JSON: JSON.stringify(pilot) };
  assert.deepEqual(selectAgentRuntime(bound, origin).pilot, pilot);
  assert.throws(() => selectAgentRuntime({ ...bound, CHAT_MODEL_PROVIDER: "other/provider" }, origin));
  assert.throws(() => selectAgentRuntime({ ...bound, CHAT_MODEL_WRITE: "other/model" }, origin));
  assert.throws(() => selectAgentRuntime({ ...bound, CHAT_MODEL_MAX_REQUEST_USD: "0.01" }, origin));
});

test("captured pilot jobs reject unrelated scope before loading and recheck the claimed context before creating a model", async () => {
  const { loadServerModule } = await import("./chat-db-harness/server-adapter.mjs");
  const pilotModule = await import("../src/features/chat/agent/live-draft-pilot.ts");
  const core = await import("../src/features/chat/agent/worker-core.ts");
  const zod = await import("zod");
  const { randomUUID } = await import("node:crypto");
  const { scope: target, data } = request();
  const pilot = {
    scope: target,
    brandId: data.brandId,
    packVersion: data.pack.version,
    packSha256: pilotModule.pilotKnowledgeHash(data.pack.body),
    message: data.messages[0].content,
    displayName: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  const calls = [];
  let models = 0;
  let expiresDuringClaim = false;
  const drift = structuredClone(data);
  drift.messages[0].content = "Unapproved context after claim";
  const { processCapturedAgent } = loadServerModule("src/features/chat/agent/worker.ts", {
    "node:crypto": { randomUUID },
    zod,
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => ({
      async rpc(name, args) {
        calls.push([name, args.p_action ?? null]);
        if (name === "chat_agent_load") return { data };
        if (expiresDuringClaim && args.p_action === "claim") {
          pilot.expiresAt = "2000-01-01T00:00:00Z";
          return { data: { status: "ready", runId: id(95), leaseToken: id(96) } };
        }
        return { data: { status: "claimed", runId: id(95), leaseToken: id(96), context: drift } };
      },
    }) },
    "../connection": { chatwootOrigin: () => "https://chat.example.invalid" },
    "../secrets": {},
    "./mock-model": {},
    "./worker-core": core,
    "./runtime-config": { selectAgentRuntime: () => ({ kind: "live", config: {}, pilot }) },
    "./live-draft-pilot": pilotModule,
    "./live-model": { createLiveModel() { models++; throw new Error("Pilot crossed its boundary"); } },
    "@/integrations/openrouter/client": { OpenRouterClient: class {} },
    "@/integrations/chatwoot/message-client": {},
    "../actions/public-worker": {},
    "../actions/label-worker": {},
    "../actions/supplemental-worker": {},
  });
  const job = {
    workspace: { id: target.workspaceId, tenantId: target.tenantId, accountId: 901, secretHash: "fixture-only" },
    channel: { id: target.channelId, kind: "website", mode: "draft" },
    conversationId: target.conversationId,
    triggerMessageId: target.triggerMessageId,
  };
  const previousAgent = process.env.CHAT_AGENT_ENABLED;
  const previousDryRun = process.env.CHAT_DRY_RUN;
  const previousDelivery = process.env.CHAT_DRAFT_DELIVERY_ENABLED;
  try {
    process.env.CHAT_AGENT_ENABLED = "true";
    process.env.CHAT_DRY_RUN = "false";
    await processCapturedAgent({ ...job, conversationId: id(97) });
    assert.deepEqual(calls, []);
    await processCapturedAgent(job);
    assert.deepEqual(calls, [["chat_agent_load", null], ["chat_live_agent_run", "claim"]]);
    assert.equal(models, 0);
    calls.length = 0;
    expiresDuringClaim = true;
    process.env.CHAT_DRAFT_DELIVERY_ENABLED = "true";
    await processCapturedAgent(job);
    assert.deepEqual(calls, [["chat_agent_load", null], ["chat_live_agent_run", "claim"]]);
  } finally {
    if (previousDelivery === undefined) delete process.env.CHAT_DRAFT_DELIVERY_ENABLED;
    else process.env.CHAT_DRAFT_DELIVERY_ENABLED = previousDelivery;
    if (previousAgent === undefined) delete process.env.CHAT_AGENT_ENABLED;
    else process.env.CHAT_AGENT_ENABLED = previousAgent;
    if (previousDryRun === undefined) delete process.env.CHAT_DRY_RUN;
    else process.env.CHAT_DRY_RUN = previousDryRun;
  }
});

test("the owner can see the pause control throughout live-pilot mode", async () => {
  const { loadServerModule } = await import("./chat-db-harness/server-adapter.mjs");
  const zod = await import("zod");
  const { usd } = await import("../src/features/chat/agent/budget.ts");
  const { getAiBudgetSettings } = loadServerModule("src/features/chat/agent/budget-settings.ts", {
    zod,
    "./budget": { usd },
    "../schemas": {},
    "@/core/command-context/server": { createUserCommandContext: () => ({}) },
    "../module": {
      async requireChatPermission(permission) {
        assert.equal(permission, "chat_settings:manage");
        return { context: { tenant: { id: scope.tenantId } }, db: {
          async rpc(name) {
            assert.equal(name, "chat_ai_budget_settings");
            return { data: { monthlyBudgetUsd: "0.25", version: 3 } };
          },
        } };
      },
    },
  });
  const previous = process.env.CHAT_AGENT_MODEL_MODE;
  try {
    process.env.CHAT_AGENT_MODEL_MODE = "live-pilot";
    const settings = await getAiBudgetSettings();
    assert.equal(settings.monthlyBudgetUsd, "0.25");
    assert.equal(settings.tenantId, scope.tenantId);
    process.env.CHAT_AGENT_MODEL_MODE = "mock";
    assert.equal(await getAiBudgetSettings(), null);
  } finally {
    if (previous === undefined) delete process.env.CHAT_AGENT_MODEL_MODE;
    else process.env.CHAT_AGENT_MODEL_MODE = previous;
  }
});

test("pilot expiry after durable admission settles zero without starting the provider request", async () => {
  const { createLiveModel } = await import("../src/features/chat/agent/live-model.ts");
  let allowed = true;
  let calls = 0;
  const settlement = [];
  const model = createLiveModel({
    models: { understand: "fixture/model", classify: "fixture/model", write: "fixture/model" },
    provider: "fixture/provider",
    maxPrice: { prompt: "0.75", completion: "3.75", request: "0" },
  }, {
    async run(action, input) {
      if (action === "budget.reserve") {
        allowed = false;
        return { admitted: true };
      }
      settlement.push(input);
      return { status: "settled" };
    },
  }, {
    async complete() {
      calls++;
      throw new Error("An expired pilot made a provider request");
    },
  }, () => allowed);
  await assert.rejects(() => model.complete({ stage: "understand", context: {}, signal: new AbortController().signal }));
  assert.equal(calls, 0);
  assert.deepEqual(settlement, [{ callKey: "understand", actualUsd: "0", generationId: null }]);
});
