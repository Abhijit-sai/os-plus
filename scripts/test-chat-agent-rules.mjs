import { test } from "node:test";
import assert from "node:assert/strict";
const customer = (content, at = "2026-10-22T10:00:00Z", providerId = 10) => ({
  id: "61000000-0000-4000-8000-" + String(providerId).padStart(12, "0"),
  providerId,
  author: "customer",
  private: false,
  content,
  at,
});
test("bare configured acknowledgement is silent only with no open request; questions still get a draft", async () => {
  const { preflight } = await import("../src/features/chat/agent/rules.ts");
  const input = {
    now: "2026-10-22T10:00:01Z",
    triggerId: customer("Thanks!").id,
    messages: [customer("Thanks!")],
    quietUntil: null,
    openRequest: false,
    acknowledgements: ["thanks"],
  };
  assert.equal(preflight(input).reason, "closing");
  assert.equal(preflight({ ...input, openRequest: true }).reason, null);
  assert.equal(
    preflight({
      ...input,
      messages: [customer("Thanks! What are your opening hours?")],
    }).reason,
    null,
  );
  assert.equal(preflight({ ...input, acknowledgements: [] }).reason, null);
});

test("quiet and latest-message fences use public facts; an acknowledgement cannot hide an unanswered question", async () => {
  const { preflight } = await import("../src/features/chat/agent/rules.ts");
  const first = customer("Are you open?", "2026-10-22T09:59:59Z", 9),
    last = customer("Thanks!");
  const input = {
    now: "2026-10-22T10:00:01Z",
    triggerId: last.id,
    messages: [first, last],
    quietUntil: null,
    openRequest: false,
    acknowledgements: ["thanks"],
  };
  assert.equal(preflight(input).reason, null);
  assert.equal(
    preflight({ ...input, triggerId: first.id }).reason,
    "superseded",
  );
  assert.equal(
    preflight({ ...input, quietUntil: "2026-10-22T10:01:00Z" }).reason,
    "quiet",
  );
  assert.equal(preflight({ ...input, quietUntil: input.now }).reason, null);
  const note = {
    ...customer("internal", "2026-10-22T10:00:01Z", 11),
    author: "staff",
    private: true,
  };
  assert.equal(
    preflight({ ...input, messages: [first, last, note] }).reason,
    null,
  );
  assert.throws(() =>
    preflight({ ...input, triggerId: note.id, messages: [note] }),
  );
});

test("session bands use configured gaps, ignore private notes and preserve the fresh boundary", async () => {
  const { sliceSession } =
    await import("../src/features/chat/agent/session.ts");
  const last = customer("Current inquiry", "2026-10-22T10:00:00Z", 10);
  const run = (at, policy) =>
    sliceSession({
      triggerId: last.id,
      messages: [
        customer("Earlier", at, 9),
        {
          ...customer("private", "2026-10-22T09:59:59Z", 11),
          author: "staff",
          private: true,
        },
        last,
      ],
      ...(policy ? { policy } : {}),
    });
  assert.equal(run("2026-10-22T09:31:00Z").band, "continuing");
  assert.equal(run("2026-10-22T09:30:00Z").band, "resumed");
  assert.equal(run("2026-10-21T10:00:00Z").band, "resumed");
  const fresh = run("2026-10-21T09:59:59Z");
  assert.equal(fresh.band, "fresh");
  assert.deepEqual(
    fresh.messages.map((m) => m.content),
    ["Current inquiry"],
  );
  assert.equal(
    run("2026-10-22T09:45:00Z", { continueMinutes: 10, freshHours: 12 }).band,
    "resumed",
  );
  assert.throws(() =>
    run("2026-10-22T09:45:00Z", { continueMinutes: 120, freshHours: 1 }),
  );
});

test("model slots and signals require exact evidence in a current public customer message", async () => {
  const { validateUnderstanding } =
    await import("../src/features/chat/agent/schemas.ts");
  const { readFile } = await import("node:fs/promises");
  const pack = JSON.parse(
    await readFile(
      new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
      "utf8",
    ),
  );
  const current = customer("Please tell me your opening hours in East Park.");
  const raw = {
    confidence: "high",
    intent: null,
    services: [],
    language: pack.brand.languages[0],
    gist: "Opening hours inquiry",
    signals: [],
    slots: [
      {
        key: "area",
        value: "East Park",
        quote: "in East Park",
        messageId: current.id,
      },
    ],
  };
  assert.equal(
    validateUnderstanding(raw, [current], pack).slots[0].value,
    "East Park",
  );
  assert.throws(() =>
    validateUnderstanding(
      { ...raw, slots: [{ ...raw.slots[0], value: "West Park" }] },
      [current],
      pack,
    ),
  );
  assert.throws(() =>
    validateUnderstanding(raw, [{ ...current, author: "bot" }], pack),
  );
  assert.throws(() =>
    validateUnderstanding(raw, [{ ...current, private: true }], pack),
  );
  assert.throws(() =>
    validateUnderstanding(
      { ...raw, slots: [{ ...raw.slots[0], quote: "invented quote" }] },
      [current],
      pack,
    ),
  );
  assert.throws(() =>
    validateUnderstanding({ ...raw, language: "xx" }, [current], pack),
  );
  assert.throws(() =>
    validateUnderstanding(
      { ...raw, intent: "invented_intent" },
      [current],
      pack,
    ),
  );
  assert.throws(() =>
    validateUnderstanding(
      {
        ...raw,
        signals: [
          { kind: "payment_claim", quote: "I paid", messageId: current.id },
        ],
      },
      [current],
      pack,
    ),
  );
  assert.throws(() =>
    validateUnderstanding({ ...raw, customerId: "injected" }, [current], pack),
  );
});

test("hard budget admission reserves conservatively and never treats unknown cost as free", async () => {
  const { budgetAdmission } =
    await import("../src/features/chat/agent/budget.ts");
  const input = {
    capUsd: "1.00",
    spentUsd: "0.70",
    reservedUsd: "0.20",
    maxCallUsd: "0.10",
  };
  assert.equal(budgetAdmission(input), true);
  assert.equal(budgetAdmission({ ...input, maxCallUsd: "0.100000001" }), false);
  assert.equal(
    budgetAdmission({ ...input, spentUsd: "1", reservedUsd: "0" }),
    false,
  );
  assert.equal(budgetAdmission({ ...input, maxCallUsd: null }), false);
  assert.equal(
    budgetAdmission({ ...input, capUsd: null, maxCallUsd: "0.01" }),
    true,
  );
  assert.equal(
    budgetAdmission({ ...input, capUsd: "0", spentUsd: "0", reservedUsd: "0" }),
    false,
  );
  assert.throws(() => budgetAdmission({ ...input, spentUsd: "-1" }));
  assert.throws(() => budgetAdmission({ ...input, reservedUsd: "NaN" }));
});

test("draft renderer fills approved facts and links by code; rejects invented amounts, promises, internal text and repeat", async () => {
  const { renderDraft } = await import("../src/features/chat/agent/checks.ts");
  const input = {
    text: "Hours: {{FACT:hours}}\n{{PRICE:0}}\n{{MAP_LINK:demo}}",
    facts: { hours: "Weekdays 10–18" },
    prices: [
      { label: "Demo service", amount: 125, currency: "INR", unit: "item" },
    ],
    indicativeLabel: "indicative",
    links: { "MAP_LINK:demo": "https://maps.example.invalid/demo" },
    previousReplies: [],
    forbiddenTerms: [],
  };
  const result = renderDraft(input);
  assert.equal(result.ok, true);
  assert.match(result.text, /125/);
  assert.match(result.text, /indicative/);
  assert.match(result.text, /https:\/\/maps.example.invalid\/demo/);
  for (const text of [
    "Your total is INR 999.",
    "It is 999.",
    "{{PRICE:1}}",
    "{{STATEMENT_LINK}}",
    "Your booking is confirmed.",
    "Payment received.",
    "tenant_id: secret",
    "Here is https://evil.example.invalid",
    "One? Two?",
    '{"error":"failed"}',
    "A 61000000-0000-4000-8000-000000000010",
    "Never say model-x",
  ])
    assert.equal(
      renderDraft({ ...input, text, forbiddenTerms: ["model-x"] }).ok,
      false,
      text,
    );
  assert.equal(
    renderDraft({
      ...input,
      text: "Please tell us the service.",
      previousReplies: ["Please tell us the service."],
    }).ok,
    false,
  );
  assert.equal(
    renderDraft({ ...input, text: "{{FACT:hours}}\n{{FACT:hours}}" }).ok,
    true,
  );
  assert.equal(
    renderDraft({
      ...input,
      text: "Hello {{FACT:hours}}",
      facts: { hours: "broken {{MISSING}}" },
    }).ok,
    false,
  );
});

test("expanded knowledge obeys output limits, configured script and safe link boundaries", async () => {
  const { renderDraft } = await import("../src/features/chat/agent/checks.ts");
  const input = {
    text: "{{FACT:hours}}",
    facts: { hours: "Weekdays 10–18" },
    prices: [],
    indicativeLabel: null,
    links: {},
    previousReplies: [],
    forbiddenTerms: [],
    latinScriptOnly: true,
  };
  assert.equal(renderDraft(input).ok, true);
  assert.equal(
    renderDraft({ ...input, facts: { hours: "Café, weekdays" } }).ok,
    true,
  );
  for (const text of [
    "<img src=x onerror=alert()>",
    "javascript:alert()",
    "ftp://files.example.invalid",
    "नमस्ते",
    "api\u200b_key: hidden",
  ])
    assert.equal(renderDraft({ ...input, text }).ok, false, text);
  for (const hours of [
    "One? Two?",
    "Visit https://unapproved.example.invalid",
    "Your total is INR 999.",
    "<b>Open</b>",
    "नमस्ते",
  ])
    assert.equal(renderDraft({ ...input, facts: { hours } }).ok, false, hours);
  assert.equal(
    renderDraft({
      ...input,
      text: "{{FACT:a}} {{FACT:b}}",
      facts: { a: "a".repeat(4000), b: "b".repeat(4000) },
    }).ok,
    false,
  );
  assert.equal(
    renderDraft({ ...input, text: "नमस्ते", latinScriptOnly: false }).ok,
    true,
  );
  assert.equal(
    renderDraft({
      ...input,
      text: "Where? {{MAP_LINK:demo}}",
      links: { "MAP_LINK:demo": "https://maps.example.invalid/?q=demo" },
    }).ok,
    true,
  );
});

test("mechanical repeat repair removes an already-said sentence while retaining an approved answer", async () => {
  const { renderDraft } = await import("../src/features/chat/agent/checks.ts");
  const input = {
    text: "Please tell us your service. {{FACT:hours}}",
    facts: { hours: "Weekdays 10–18" },
    prices: [],
    indicativeLabel: null,
    links: {},
    previousReplies: ["Please tell us your service."],
    forbiddenTerms: [],
  };
  const result = renderDraft(input);
  assert.equal(result.ok, true);
  assert.equal(result.text, "Weekdays 10–18");
  assert.deepEqual(result.repairs, ["repeat"]);
});
