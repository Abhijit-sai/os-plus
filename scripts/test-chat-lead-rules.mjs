import assert from "node:assert/strict";
import { test } from "node:test";
import { decideLeadStage } from "../src/features/leads/rules.ts";

test("only a real explicitly linked paid or delivered order wins a sales lead", () => {
  const base = {
    stage: "engaged",
    kind: "sales",
    lastCustomerAt: "2026-10-20T00:00:00Z",
    now: "2026-10-21T00:00:00Z",
    lostAfterDays: 7,
  };
  assert.equal(
    decideLeadStage({
      ...base,
      order: { status: "ready", paymentStatus: "unpaid", isDraft: false },
    }).stage,
    "in_progress",
  );
  assert.equal(
    decideLeadStage({
      ...base,
      order: { status: "completed", paymentStatus: "unpaid", isDraft: false },
    }).stage,
    "in_progress",
  );
  assert.equal(
    decideLeadStage({
      ...base,
      order: { status: "confirmed", paymentStatus: "paid", isDraft: false },
    }).stage,
    "won",
  );
  assert.equal(
    decideLeadStage({
      ...base,
      order: { status: "delivered", paymentStatus: "unpaid", isDraft: false },
    }).stage,
    "won",
  );
  assert.equal(
    decideLeadStage({
      ...base,
      order: { status: "delivered", paymentStatus: "paid", isDraft: true },
    }).stage,
    "engaged",
  );
  assert.equal(decideLeadStage(base).stage, "engaged");
});

test("inactivity closure has an exact configurable boundary and excludes service, terminal and active work", () => {
  const lead = {
    stage: "engaged",
    kind: "sales",
    lastCustomerAt: "2026-10-01T00:00:00Z",
    now: "2026-10-08T00:00:00Z",
    lostAfterDays: 7,
  };
  assert.deepEqual(decideLeadStage(lead), {
    stage: "lost",
    reason: "customer_silence",
  });
  assert.equal(
    decideLeadStage({ ...lead, now: "2026-10-07T23:59:59Z" }).stage,
    "engaged",
  );
  assert.equal(
    decideLeadStage({ ...lead, lostAfterDays: 10 }).stage,
    "engaged",
  );
  assert.equal(decideLeadStage({ ...lead, kind: "service" }).stage, "engaged");
  assert.equal(decideLeadStage({ ...lead, kind: "spam" }).stage, "engaged");
  assert.equal(decideLeadStage({ ...lead, stage: "won" }).stage, "won");
  assert.equal(decideLeadStage({ ...lead, stage: "booked" }).stage, "booked");
  assert.equal(
    decideLeadStage({ ...lead, booking: { confirmed: false, active: true } })
      .stage,
    "engaged",
  );
  assert.equal(
    decideLeadStage({ ...lead, booking: { confirmed: true, active: true } })
      .stage,
    "booked",
  );
  assert.equal(
    decideLeadStage({
      ...lead,
      order: { status: "confirmed", paymentStatus: "unpaid", isDraft: false },
    }).stage,
    "in_progress",
  );
  assert.equal(
    decideLeadStage({ ...lead, lastCustomerAt: "2026-10-09T00:00:00Z" }).stage,
    "engaged",
  );
});

test("website phone claims cannot join an existing person; verified WhatsApp phone requires matching source identity", async () => {
  const { captureIdentities } = await import("../src/features/leads/rules.ts");
  const base = {
    workspaceId: "10000000-0000-4000-8000-000000000001",
    channelId: "10000000-0000-4000-8000-000000000002",
    contactId: 91,
    sourceId: "visitor-abc",
    phone: "+919876543210",
    email: "someone@example.invalid",
    displayName: "Example Visitor",
  };
  const website = captureIdentities({ ...base, kind: "website" });
  assert.ok(
    website.identities.every((i) => i.kind !== "phone" && i.kind !== "email"),
  );
  assert.equal(website.claimedPhone, "+919876543210");
  const whatsapp = captureIdentities({
    ...base,
    kind: "whatsapp",
    sourceId: "919876543210",
  });
  assert.equal(
    whatsapp.identities.find((i) => i.kind === "phone").value,
    "+919876543210",
  );
  assert.equal(
    whatsapp.identities.find((i) => i.kind === "phone").verified,
    true,
  );
  assert.ok(
    captureIdentities({
      ...base,
      kind: "whatsapp",
      sourceId: "447911123456",
    }).identities.every((i) => i.kind !== "phone"),
  );
  assert.notDeepEqual(
    captureIdentities({ ...base, kind: "facebook" }).identities,
    captureIdentities({
      ...base,
      kind: "facebook",
      channelId: "10000000-0000-4000-8000-000000000003",
    }).identities,
  );
});

test("later acknowledgements cannot downgrade intent and unknown priorities never invent intent", async () => {
  const { mergeLeadIntent } = await import("../src/features/leads/rules.ts");
  const priorities = { question: 1, quote: 2, booking: 3, thanks: 0 };
  assert.equal(
    mergeLeadIntent({ current: "booking", incoming: "thanks", priorities }),
    "booking",
  );
  assert.equal(
    mergeLeadIntent({ current: "question", incoming: "quote", priorities }),
    "quote",
  );
  assert.equal(
    mergeLeadIntent({ current: null, incoming: "unconfigured", priorities }),
    null,
  );
  assert.equal(
    mergeLeadIntent({ current: "booking", incoming: null, priorities }),
    "booking",
  );
});

test("values distinguish unknown from zero and service leads never get a sales value", async () => {
  const { estimateLeadValue } = await import("../src/features/leads/rules.ts");
  assert.equal(
    estimateLeadValue({
      kind: "sales",
      orderAmounts: [100, 300, 200, 400],
      typicalBasket: null,
    }),
    250,
  );
  assert.equal(
    estimateLeadValue({ kind: "sales", orderAmounts: [], typicalBasket: null }),
    null,
  );
  assert.equal(
    estimateLeadValue({ kind: "sales", orderAmounts: [], typicalBasket: 0 }),
    0,
  );
  assert.equal(
    estimateLeadValue({
      kind: "service",
      orderAmounts: [1000],
      typicalBasket: 1000,
    }),
    null,
  );
  assert.throws(() =>
    estimateLeadValue({
      kind: "sales",
      orderAmounts: [-1],
      typicalBasket: 100,
    }),
  );
});

test("SLA clocks distinguish first bot response, human response and current unanswered customer wait", async () => {
  const { leadClocks } = await import("../src/features/leads/rules.ts");
  const base = {
    stage: "engaged",
    firstCustomerAt: "2026-10-01T00:00:00Z",
    lastCustomerAt: "2026-10-01T00:10:00Z",
    firstResponseAt: "2026-10-01T00:00:05Z",
    firstHumanResponseAt: "2026-10-01T00:05:00Z",
    lastReplyAt: "2026-10-01T00:05:00Z",
    now: "2026-10-01T00:12:00Z",
  };
  assert.deepEqual(leadClocks(base), {
    awaitingFirstReply: false,
    firstReplySeconds: 5,
    firstHumanReplySeconds: 300,
    waitingSeconds: 120,
  });
  assert.equal(
    leadClocks({ ...base, lastReplyAt: "2026-10-01T00:11:00Z" }).waitingSeconds,
    null,
  );
  assert.equal(leadClocks({ ...base, stage: "won" }).waitingSeconds, null);
  assert.equal(
    leadClocks({
      ...base,
      firstResponseAt: null,
      firstHumanResponseAt: null,
      lastReplyAt: null,
    }).awaitingFirstReply,
    true,
  );
  assert.equal(
    leadClocks({ ...base, now: "2026-10-01T00:09:00Z" }).waitingSeconds,
    0,
  );
});

test("hot requires open sales, configured high-interest intent and customer activity inside the exact time window", async () => {
  const { isHotLead } = await import("../src/features/leads/rules.ts");
  const base = {
    stage: "engaged",
    kind: "sales",
    intent: "booking",
    hotIntents: ["booking"],
    hotHours: 24,
    lastCustomerAt: "2026-10-01T00:00:00Z",
    now: "2026-10-01T23:59:59Z",
  };
  assert.equal(isHotLead(base), true);
  for (const change of [
    { hotIntents: [] },
    { kind: "service" },
    { kind: "spam" },
    { stage: "won" },
    { stage: "lost" },
    { intent: "question" },
    { now: "2026-10-02T00:00:00Z" },
    { now: "2026-09-30T23:59:59Z" },
  ])
    assert.equal(isHotLead({ ...base, ...change }), false);
});
