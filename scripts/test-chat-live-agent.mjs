import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runAgentTurn } from "../src/features/chat/agent/turn.ts";
import * as customerLookups from "../src/features/chat/agent/customer-lookup.ts";
import { parseKnowledgePack } from "../src/features/chat/knowledge-pack.ts";
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

const autoRequest = (content) => {
  const req = request();
  req.allowAutomatic = true;
  req.data.agentMode = "auto";
  req.data.channelKind = "whatsapp";
  req.data.messages[0].content = content;
  return req;
};
const autoModel = (fact) => ({
  kind: "live",
  async complete({ stage }) {
    assert.equal(stage, "write");
    if (fact instanceof Error) throw fact;
    return { json: { fact }, model: "synthetic/auto-test", costUsd: "0" };
  },
});
const autoRun = (req, fact = null) => runAgentTurn(req, autoModel(fact));
const fallbackHandoff = "I’ll pass this to our team. They’ll check the details and reply here.";

test("each automatic reply can be overridden independently and validates customer text", async () => {
  const cases = [
    ["greeting", "Hello", `Hi! How can I help you with ${pack.brand.displayName} today?`, false, false],
    ["needsPerson", "I want to cancel", fallbackHandoff, true, true],
    ["handoffTopic", "How do I wash it?", fallbackHandoff, true, false],
    ["askOrderNumber", "Where is my order?", "Could you share your order number so I can check the latest status?", false, false],
    ["orderUnconfirmed", "Where is my order ORD-000123?", `I couldn’t confirm that order from this chat. ${fallbackHandoff}`, true, true],
    ["availability", "Is it in stock?", `${fallbackHandoff} If you have a product link or a size in mind, you can share it here.`, true, true],
    ["clarify", "Something unusual", "Could you tell me a little more about what you need?", false, false],
    ["error", "Something unusual", fallbackHandoff, true, true, new Error("fake provider failure")],
  ];
  for (const [key, message, defaultText, handoff, alert, fact] of cases) {
    const req = autoRequest(message);
    const body = req.data.pack.body;
    body.handoffTopics = ["wash", "where is my order"];
    const check = async (expected) => {
      const result = await autoRun(req, fact);
      assert.equal(result.replyText, expected, key);
      assert.equal(result.decision.handoff, handoff, key);
      assert.equal(result.decision.staffAlert, alert, key);
    };
    await check(defaultText);
    const override = `Approved ${key} response.`;
    body.replies = { [key]: override };
    await check(override);
    body.replies[key] = "tenant_id";
    assert.throws(() => parseKnowledgePack(body), /Unsafe reply/, key);
  }
  assert.throws(() => parseKnowledgePack({ ...pack, replies: { typo: "Hi" } }));
});

test("Auto clarifies once per session, escalates the next miss, and suppresses a repeated handoff", async () => {
  const req = autoRequest("Something unusual");
  req.data.pack.body.replies = { clarify: "Which detail should we check?" };
  const next = (previous, minutes) => {
    const prior = req.data.messages.at(-1);
    const at = new Date(Date.parse(prior.at) + minutes * 60000).toISOString();
    const bot = { ...prior, id: id(prior.providerId + 20), providerId: prior.providerId + 1,
      author: "bot", content: previous.replyText };
    const trigger = { ...prior, id: id(prior.providerId + 21), providerId: prior.providerId + 2, at };
    if (previous.replyText) req.data.messages.push(bot);
    req.data.messages.push(trigger);
    req.scope = { ...req.scope, triggerMessageId: trigger.id };
    req.data.triggerMessageId = trigger.id;
    req.data.ledger = previous.ledger;
    req.now = at;
  };
  const first = await autoRun(req);
  assert.equal(first.replyText, "Which detail should we check?");
  assert.equal(first.ledger.automaticClarification, first.replyText);
  assert.equal(first.decision.handoff, false);
  assert.equal(first.decision.staffAlert, false);
  next(first, 1);
  req.data.pack.body.replies.clarify = "A revised question?";
  const bot = req.data.messages.splice(1, 1)[0];
  const unsent = await autoRun(req);
  assert.equal(unsent.replyText, "A revised question?");
  assert.equal(unsent.decision.handoff, false);
  req.data.messages.splice(1, 0, bot);
  const second = await autoRun(req);
  assert.equal(second.replyText, pack.locked.handoffLine);
  assert.equal(second.decision.handoff, true);
  assert.equal(second.decision.staffAlert, true);
  next(second, 1);
  const repeated = await autoRun(req);
  assert.equal(repeated.outcome, "silent");
  next(repeated, 25 * 60);
  const fresh = await autoRun(req);
  assert.equal(fresh.replyText, "A revised question?");
  assert.equal(fresh.decision.handoff, false);
});

test("Auto greetings and ordinary product, sizing, store, returns and custom answers never hand off", async () => {
  for (const greeting of ["hi there", "hii", "hello sir", "hi team", "namaste", "good evening sir", "Hello! 👋🏽", "Adaab 🙏"]) {
    const req = autoRequest(greeting);
    req.data.pack.body.brand.localGreetings = ["adaab"];
    req.data.pack.body.replies = { greeting: "Welcome!" };
    const result = await autoRun(req, new Error("Greeting must skip the provider"));
    assert.equal(result.replyText, "Welcome!", greeting);
    assert.equal(result.decision.handoff, false, greeting);
    assert.equal(result.decision.staffAlert, false, greeting);
  }
  for (const [question, topic, fact] of [
    ["Hello 👋 what shirts do you sell?", "products", "policy:0"],
    ["Is the size chart available in inches?", "sizing", "policy:0"],
    ["Where is your store?", "store", "policy:0"],
    ["What is your returns window?", "returns", "policy:0"],
    ["Do you make custom designs?", "custom_design_enquiry", null],
  ]) {
    const req = autoRequest(question);
    const answer = "An approved answer. https://example.invalid/collection";
    req.data.pack.body.policies = [{ topic, answer }];
    const result = await autoRun(req, fact);
    assert.equal(result.replyText, answer, question);
    assert.equal(result.decision.handoff, false, question);
    assert.equal(result.decision.staffAlert, false, question);
  }
});

test("payment and sensitive requests alert while saved sizing and unrelated handoff topics only create tasks", async () => {
  for (const [question, alert] of [
    ["I already paid", true],
    ["Paid just now", true],
    ["Where is the payment link?", false],
    ["Can I have a refund?", true],
    ["I have a complaint", true],
    ["It arrived damaged", true],
    ["I received the wrong item", true],
    ["I want a person", true],
    ["You already know my size", false],
    ["When will you deliver?", false],
    ["Stock?", true],
    ["Do you have stock for this?", true],
  ]) {
    const result = await autoRun(autoRequest(question), new Error("Must skip the provider"));
    assert.equal(result.outcome, "handoff", question);
    assert.equal(result.decision.staffAlert, alert, question);
    if (question === "I already paid") assert.equal(result.replyText, pack.locked.paymentClaimReply);
  }
});

test("Auto configuration stays out of private Draft model context", async () => {
  const req = request();
  req.data.pack.body.replies = { greeting: "Auto welcome." };
  req.data.pack.body.brand.localGreetings = ["adaab"];
  req.data.messages.unshift({
    ...req.data.messages[0], id: id(39), providerId: 2, author: "bot",
    content: "Here is your order tracking link: https://os-plus.vercel.app/track/synthetic",
    at: "2026-11-01T09:59:59Z",
  });
  req.data.verifiedLookupReplyIds = [id(39)];
  const contexts = [];
  const result = await runAgentTurn(req, {
    kind: "live",
    async complete({ stage, context }) {
      contexts.push(context.context ?? context);
      const json = stage === "understand" ? understanding
        : stage === "classify" ? { signals: [] } : { text: "{{FACT:hours}}" };
      return { json, model: "synthetic/draft-test", costUsd: "0" };
    },
  });
  assert.equal(result.replyText, pack.hours.default);
  assert.equal(contexts.length, 3);
  for (const context of contexts) {
    assert.equal(context.knowledge.replies, undefined);
    assert.equal(context.knowledge.brand.localGreetings, undefined);
    assert.equal(context.brand.localGreetings, undefined);
    assert.equal(context.messages.some(message => message.id === id(39)), false);
  }
});

test("suppressing repeated customer text does not hide a new sensitive request", async () => {
  const req = autoRequest("I want a refund");
  const prior = {
    ...req.data.messages[0], id: id(40), providerId: 2, author: "bot",
    content: fallbackHandoff, at: "2026-11-01T09:59:59Z",
  };
  req.data.messages.unshift(prior);
  const result = await autoRun(req, new Error("Must skip the provider"));
  assert.equal(result.outcome, "silent");
  assert.equal(result.decision.staffAlert, true);
});
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

test("approved automatic mode greets, uses only approved facts and checks verified orders", async () => {
  async function automatic(content, answer, customerLookup, previous) {
    const req = request();
    req.allowAutomatic = true;
    req.customerLookup = customerLookup;
    req.data.agentMode = "auto";
    req.data.channelKind = "whatsapp";
    req.data.messages[0].content = content;
    if (previous) {
      req.data.messages[0].providerId = 2;
      req.data.messages.unshift({
        ...req.data.messages[0], id: id(99), providerId: 1,
        at: "2026-11-01T09:59:50Z",
        ...(typeof previous === "string" ? { content: previous } : previous),
      });
    }
    let calls = 0;
    const result = await runAgentTurn(req, {
      kind: "live",
      async complete({ stage, context }) {
        calls++;
        assert.equal(stage, "write");
        assert.equal(context.unanswered[0], content);
        return { json: answer, model: "synthetic/auto", costUsd: "0" };
      },
    });
    assert.equal(result.decision.automatic, true);
    return { result, calls };
  }

  const hello = await automatic("Hello. You there?");
  assert.match(hello.result.replyText, /^Hi! How can I help/);
  assert.equal(hello.calls, 0);
  for (const [latest, previous] of [
    ["Are you there", undefined],
    ["Are you there", "Hello. You there?"],
  ]) {
    const presence = await automatic(latest, undefined, undefined, previous);
    assert.equal(presence.result.replyText, hello.result.replyText);
    assert.equal(presence.calls, 0);
  }
  const hoursAfterGreeting = await automatic("Are you there", undefined, undefined, "Are you open tomorrow?");
  assert.equal(hoursAfterGreeting.result.replyText, pack.hours.default);
  assert.equal(hoursAfterGreeting.calls, 0);
  const hours = await automatic("Can I come by tomorrow?", { fact: "hours" });
  assert.equal(hours.result.replyText, pack.hours.default);
  assert.equal(hours.calls, 0);
  const size = await automatic("Is this available in my size?");
  assert.match(size.result.replyText, /They’ll check the details and reply here/);
  assert.equal(size.result.decision.handoff, true);
  const savedSize = await automatic("You know my size already", undefined, undefined, {
    author: "bot",
    content: "Could you share a little more about what you’re looking for? Our team can help with the details.",
  });
  assert.match(savedSize.result.replyText, /check your sizing details.*follow up with you here/);
  assert.equal(savedSize.result.decision.handoff, true);
  assert.equal(savedSize.calls, 0);
  const repeatedSize = await automatic("You know my size already", undefined, undefined, {
    author: "bot", content: savedSize.result.replyText,
  });
  assert.equal(repeatedSize.result.replyText, null);
  assert.equal(repeatedSize.result.decision.handoff, true);
  for (const question of ["Do you have a medium?", "Is the black shirt available?"]) {
    const unavailable = await automatic(question);
    assert.equal(unavailable.result.decision.handoff, true);
    assert.equal(unavailable.calls, 0);
  }
  const verified = { kind: "status", text: "We’re working on your order.", proof: "a".repeat(64) };
  const order = await automatic("Where is my order ORD-000123?", undefined, verified);
  assert.equal(order.result.replyText, verified.text);
  assert.deepEqual(order.result.decision.verifiedCustomerLookup, { kind: "status", proof: verified.proof });
  assert.equal(order.calls, 0);
  assert.equal(customerLookups.customerLookupKind("Can you give me an update?"), null);
  assert.equal(customerLookups.customerLookupKind("Where is my order #1234?"), null);
  assert.equal(customerLookups.customerLookupKind("Can I see the tracking link?"), "tracking");
  for (const wording of [
    "Where is my order: ORD-000123?",
    "Please check my order #ORD-000123",
    "What is the current status of my order ORD-000123?",
  ]) assert.equal((await automatic(wording, undefined, verified)).result.replyText, verified.text);
  assert.equal(customerLookups.customerLookupKind("Send me the tracking link for order ORD-000123"), "tracking");
  const unverified = await automatic("Where is my order ORD-000123?");
  assert.equal(unverified.result.decision.handoff, true);
  assert.match(unverified.result.replyText, /couldn’t confirm/);
  const paid = await automatic("I've paid for ORD-000123", undefined, verified);
  assert.equal(paid.result.replyText, pack.locked.paymentClaimReply);
  assert.equal(paid.result.decision.handoff, true);
  const vendor = await automatic("I'm a supplier");
  assert.equal(vendor.result.replyText, pack.locked.vendorReply);
  assert.equal(vendor.calls, 0);
  const invented = await automatic("Can you do it?", { fact: "fake-price" });
  assert.equal(invented.result.decision.handoff, true);
  assert.match(invented.result.replyText, /They’ll check the details and reply here/);
  assert.doesNotMatch(invented.result.replyText, /fake-price/);
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
    "./customer-lookup.ts": customerLookups,
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

test("ongoing scoped drafts use one inbox binding and the existing provider key", async () => {
  const { selectAgentRuntime, matchesScopedDraftChannel } = await import("../src/features/chat/agent/runtime-config.ts");
  const env = {
    CHAT_AGENT_ENABLED: "true", CHAT_MODEL_LIVE_ENABLED: "true", CHAT_DRY_RUN: "false",
    CHAT_AGENT_MODEL_MODE: "live-scoped", OPENROUTER_API_KEY: "fixture-only",
  };
  const binding = { tenantId: scope.tenantId, workspaceId: scope.workspaceId, channelId: scope.channelId, accountId: 904, inboxId: 905, brandId: id(6), startsAt: "2026-11-01T09:59:59Z" };
  assert.throws(() => selectAgentRuntime(env, ""));
  const runtime = selectAgentRuntime({ ...env, CHAT_LIVE_DRAFT_CHANNEL_SCOPE: JSON.stringify(binding) }, "");
  assert.deepEqual(runtime.channelScope, binding);
  assert.equal(runtime.config.provider, "google-vertex/global");
  assert.equal(runtime.config.models.write, "google/gemini-3.8-flash");
  const workspace = { tenantId: scope.tenantId, id: scope.workspaceId, accountId: 904 };
  const inbox = { id: scope.channelId, kind: "whatsapp", mode: "draft" };
  assert.equal(matchesScopedDraftChannel(binding, workspace, inbox, 905), true);
  assert.equal(matchesScopedDraftChannel(binding, { ...workspace, accountId: 903 }, inbox, 905), false);
  assert.equal(matchesScopedDraftChannel(binding, workspace, { ...inbox, kind: "website" }, 905), false);
  assert.equal(matchesScopedDraftChannel(binding, workspace, { ...inbox, mode: "off" }, 905), false);
  assert.equal(matchesScopedDraftChannel(binding, workspace, inbox, 906), false);
});

test("scoped WhatsApp drafts start only after the normal capture commits", async () => {
  const { loadServerModule } = await import("./chat-db-harness/server-adapter.mjs");
  const zod = await import("zod");
  const { randomUUID } = await import("node:crypto");
  const { matchesScopedDraftChannel } = await import("../src/features/chat/agent/runtime-config.ts");
  const binding = { tenantId: scope.tenantId, workspaceId: scope.workspaceId, channelId: scope.channelId, accountId: 904, inboxId: 905, brandId: id(6), startsAt: "2026-11-01T09:59:59Z" };
  const fixture = { conversationId: scope.conversationId, messageId: scope.triggerMessageId };
  const trace = [];
  let duplicate = false;
  let agentFailure = false;
  const { chatCaptureDependencies } = loadServerModule("src/features/chat/capture.ts", {
    zod,
    "node:crypto": { randomUUID },
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => ({
      async rpc(_name, args) {
        trace.push(args.p_kind);
        if (args.p_kind === "agent" && agentFailure) return { error: new Error("Fixture failed") };
        return { data: { ...fixture, inserted: args.p_kind === "events" && !duplicate }, error: null };
      },
    }) },
    "../leads/rules": { captureIdentities: () => ({ displayName: null, identities: [] }) },
    "./website/rules": {},
    "./notifications/trigger": { scheduleNotificationCheck: async () => { trace.push("notify"); } },
    "./agent/runtime-config": {
      matchesScopedDraftChannel,
      selectAgentRuntime: () => ({ kind: "live", channelScope: binding }),
    },
  });
  const deps = chatCaptureDependencies(() => {}, async (job) => {
    assert.equal(job.triggerMessageId, scope.triggerMessageId);
    trace.push("draft");
  });
  const workspace = { tenantId: scope.tenantId, id: scope.workspaceId, accountId: 904, secretHash: "fixture" };
  const inbox = { id: scope.channelId, kind: "whatsapp", mode: "draft" };
  const message = { contactId: 99, identity: {}, inboxId: 905, author: "customer", private: false, createdAt: "2026-11-01T10:00:00Z" };
  const previous = process.env.CHAT_AGENT_MODEL_MODE;
  try {
    process.env.CHAT_AGENT_MODEL_MODE = "live-scoped";
    await deps.capture(workspace, inbox, "events", message);
    assert.deepEqual(trace.splice(0), ["events", "notify", "agent", "draft"]);
    duplicate = true;
    await deps.capture(workspace, inbox, "events", { ...message, createdAt: "2026-11-01T09:59:58Z" });
    assert.deepEqual(trace.splice(0), ["events", "notify"]);
    duplicate = false;
    await deps.capture(workspace, inbox, "events", { ...message, private: true });
    assert.deepEqual(trace.splice(0), ["events", "notify"]);
    await deps.capture({ ...workspace, accountId: 903 }, inbox, "events", message);
    assert.deepEqual(trace.splice(0), ["events", "notify"]);
    agentFailure = true;
    await deps.capture(workspace, inbox, "events", message);
    assert.deepEqual(trace.splice(0), ["events", "notify", "agent"]);
    duplicate = true;
    agentFailure = false;
    await deps.capture(workspace, inbox, "events", message);
    assert.deepEqual(trace.splice(0), ["events", "notify", "agent", "draft"]);
  } finally {
    if (previous === undefined) delete process.env.CHAT_AGENT_MODEL_MODE;
    else process.env.CHAT_AGENT_MODEL_MODE = previous;
  }
});

test("scoped draft preparation excludes contact and location records but preserves the customer text", async () => {
  const { loadServerModule } = await import("./chat-db-harness/server-adapter.mjs");
  const { randomUUID } = await import("node:crypto");
  const zod = await import("zod");
  const { matchesScopedDraftChannel } = await import("../src/features/chat/agent/runtime-config.ts");
  const fixture = request();
  fixture.data.channelKind = "whatsapp";
  fixture.data.background = { displayName: "Fixture contact record" };
  fixture.data.locations = [{ name: "Fixture location record" }];
  fixture.data.messages.unshift({
    ...fixture.data.messages[0],
    id: id(27),
    at: "2026-11-01T09:59:59Z",
    inputSource: "voice",
    content: "Fixture voice transcript",
  });
  let loads = 0;
  let prepared;
  const { processCapturedAgent } = loadServerModule("src/features/chat/agent/worker.ts", {
    "node:crypto": { randomUUID },
    zod,
    "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => ({
      async rpc() { loads++; return { data: fixture.data }; },
    }) },
    "../connection": { chatwootOrigin: () => "https://chat.example.invalid" },
    "../secrets": {},
    "./mock-model": {},
    "./customer-lookup.ts": customerLookups,
    "./worker-core": {
      async runStoredAgentTurn(_raw, store) { prepared = await store.prepare({}, fixture.data); },
    },
    "./runtime-config": { matchesScopedDraftChannel, selectAgentRuntime: () => ({
      kind: "live", config: {}, channelScope: {
        tenantId: scope.tenantId, workspaceId: scope.workspaceId, channelId: scope.channelId, accountId: 904, inboxId: 905, brandId: id(6), startsAt: "2026-11-01T09:59:59Z",
      },
    }) },
    "./live-draft-pilot": {},
    "./live-model": {},
    "@/integrations/openrouter/client": {},
    "@/integrations/chatwoot/message-client": {},
    "../actions/public-worker": {},
    "../actions/label-worker": {},
    "../actions/supplemental-worker": {},
  });
  const job = {
    workspace: { id: scope.workspaceId, tenantId: scope.tenantId, accountId: 904 },
    channel: { id: scope.channelId, kind: "whatsapp", mode: "draft" },
    conversationId: scope.conversationId,
    triggerMessageId: scope.triggerMessageId,
    inboxId: 905,
  };
  const previous = process.env.CHAT_AGENT_ENABLED;
  try {
    process.env.CHAT_AGENT_ENABLED = "true";
    await processCapturedAgent({ ...job, workspace: { ...job.workspace, accountId: 903 } });
    assert.equal(loads, 0);
    await processCapturedAgent(job);
    assert.equal(loads, 1);
    assert.equal(prepared.status, "ready");
    assert.equal(prepared.data.background, null);
    assert.equal(prepared.data.locations.length, 0);
    assert.deepEqual(Array.from(prepared.data.messages, (message) => message.content), ["When are you open?"]);
    prepared = undefined;
    fixture.data.brandId = id(23);
    await processCapturedAgent(job);
    assert.equal(loads, 2);
    assert.equal(prepared, undefined);
  } finally {
    if (previous === undefined) delete process.env.CHAT_AGENT_ENABLED;
    else process.env.CHAT_AGENT_ENABLED = previous;
  }
});
