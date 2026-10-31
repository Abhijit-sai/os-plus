import { test } from "node:test";
import assert from "node:assert/strict";
test("request-first booking readiness never authorizes an operational action or treats a callback as a reserved appointment", async () => {
  const { bookingReadiness } =
    await import("../src/features/chat/actions/rules.ts");
  const base = {
    capability: "follow_up_task",
    canBook: true,
    channel: "whatsapp",
    verifiedPhone: true,
    name: null,
    services: [],
    allowedServices: ["repair"],
    area: null,
    address: null,
    date: null,
    window: null,
    allowedWindows: ["morning"],
    today: "2026-10-22",
  };
  assert.deepEqual(bookingReadiness(base), {
    ready: false,
    missing: ["service"],
    requiresStaffApproval: true,
    reservesAppointment: false,
  });
  assert.equal(bookingReadiness({ ...base, services: ["repair"] }).ready, true);
  const laundry = {
    ...base,
    capability: "laundry_pickup",
    services: ["repair"],
  };
  assert.deepEqual(bookingReadiness(laundry).missing, [
    "name",
    "address",
    "date",
    "window",
  ]);
  assert.equal(
    bookingReadiness({
      ...laundry,
      name: "Synthetic Person",
      address: "Synthetic address",
      date: "2026-10-23",
      window: "morning",
    }).ready,
    true,
  );
  assert.equal(
    bookingReadiness({ ...laundry, date: "2026-02-30" }).ready,
    false,
  );
  assert.equal(
    bookingReadiness({ ...laundry, channel: "website", verifiedPhone: false })
      .ready,
    false,
  );
  assert.throws(
    () => bookingReadiness({ ...base, services: ["unknown"] }),
    /service/,
  );
});

test("handoff routing rejects foreign/revoked mappings and preserves Chatwoot-to-lead-to-team-to-unassigned order", async () => {
  const { resolveTaskRoute } =
    await import("../src/features/chat/actions/rules.ts");
  const t = "70000000-0000-4000-8000-000000000001",
    foreign = "70000000-0000-4000-8000-000000000002";
  const u = "70000000-0000-4000-8000-000000000010",
    v = "70000000-0000-4000-8000-000000000011",
    team = "70000000-0000-4000-8000-000000000012";
  const base = {
    tenantId: t,
    chatwootAssigneeId: 3,
    staffLinks: [{ tenantId: t, chatwootUserId: 3, userId: u }],
    users: [
      { tenantId: t, id: u, role: "manager", status: "active" },
      { tenantId: t, id: v, role: "owner_admin", status: "active" },
    ],
    leadOwnerId: v,
    branchTeamId: team,
    teams: [{ tenantId: t, id: team, active: true }],
  };
  assert.deepEqual(resolveTaskRoute(base), {
    userId: u,
    teamId: null,
    source: "chatwoot",
  });
  assert.deepEqual(
    resolveTaskRoute({
      ...base,
      staffLinks: [{ tenantId: foreign, chatwootUserId: 3, userId: u }],
    }),
    { userId: v, teamId: null, source: "lead" },
  );
  assert.equal(resolveTaskRoute({ ...base, users: [] }).teamId, team);
  assert.deepEqual(resolveTaskRoute({ ...base, users: [], teams: [] }), {
    userId: null,
    teamId: null,
    source: "unassigned",
  });
  assert.equal(
    resolveTaskRoute({
      ...base,
      users: base.users.map((x) => ({ ...x, role: "viewer" })),
    }).source,
    "team",
  );
});

test("neutral review eligibility needs real delivery and cooldown; price media needs a request and a confirmed preceding text", async () => {
  const { reviewEligibility, priceImageEligibility } =
    await import("../src/features/chat/actions/rules.ts");
  const base = {
    enabled: true,
    deliveredAt: "2026-10-20T12:00:00Z",
    historicalImport: false,
    now: "2026-10-22T12:00:00Z",
    lastPublicReviewAt: null,
    cooldownDays: 90,
  };
  assert.equal(reviewEligibility(base), true);
  assert.equal(reviewEligibility({ ...base, deliveredAt: null }), false);
  assert.equal(reviewEligibility({ ...base, historicalImport: true }), false);
  assert.equal(
    reviewEligibility({ ...base, lastPublicReviewAt: "2026-10-21T12:00:00Z" }),
    false,
  );
  assert.equal(
    reviewEligibility({ ...base, lastPublicReviewAt: "2026-10-23T12:00:00Z" }),
    false,
  );
  assert.throws(() => reviewEligibility({ ...base, positiveSentiment: true }));
  assert.equal(
    priceImageEligibility({
      requested: true,
      textDelivered: true,
      alreadyPublic: false,
      approvedUrl: "https://assets.example.invalid/price.png",
    }),
    true,
  );
  assert.equal(
    priceImageEligibility({
      requested: false,
      textDelivered: true,
      alreadyPublic: false,
      approvedUrl: "https://assets.example.invalid/price.png",
    }),
    false,
  );
  assert.equal(
    priceImageEligibility({
      requested: true,
      textDelivered: false,
      alreadyPublic: false,
      approvedUrl: "https://assets.example.invalid/price.png",
    }),
    false,
  );
  assert.throws(() =>
    priceImageEligibility({
      requested: true,
      textDelivered: true,
      alreadyPublic: false,
      approvedUrl: "http://169.254.169.254/secret",
    }),
  );
});

test("request revisions invalidate confirmation and stale approvals; materialized changes become handoffs", async () => {
  const { requestOperation } =
    await import("../src/features/chat/actions/rules.ts");
  const base = {
    operation: "approve",
    status: "customer_confirmed",
    version: 4,
    expectedVersion: 4,
    revision: 2,
    confirmedRevision: 2,
    role: "manager",
    ready: true,
  };
  assert.equal(requestOperation(base).effect, "materialize");
  assert.throws(
    () => requestOperation({ ...base, expectedVersion: 3 }),
    /changed/,
  );
  assert.throws(
    () => requestOperation({ ...base, confirmedRevision: 1 }),
    /confirmation/,
  );
  assert.throws(
    () => requestOperation({ ...base, role: "viewer" }),
    /approval/,
  );
  for (const role of ["viewer", "finance"])
    for (const operation of ["revise", "confirm", "withdraw"])
      assert.throws(
        () => requestOperation({ ...base, operation, role }),
        /access/,
      );

  const revision = requestOperation({ ...base, operation: "revise" });
  assert.equal(revision.effect, "revise");
  assert.equal(revision.clearConfirmation, true);
  assert.equal(
    requestOperation({ ...base, status: "materialized", operation: "withdraw" })
      .effect,
    "handoff",
  );
  assert.equal(
    requestOperation({ ...base, status: "requested", operation: "withdraw" })
      .effect,
    "withdraw",
  );
  assert.throws(
    () => requestOperation({ ...base, status: "withdrawn" }),
    /withdrawn/,
  );
});

test("staff request and task forms reject tenant/actor overrides, unknown JSON and invalid targets", async () => {
  const { chatRequestCommandSchema, chatTaskCommandSchema } =
    await import("../src/features/chat/actions/schemas.ts");
  const leadId = "70000000-0000-4000-8000-000000000001",
    messageId = "70000000-0000-4000-8000-000000000002";
  const base = {
    action: "request.save",
    input: {
      leadId,
      sourceMessageId: messageId,
      capability: "follow_up_task",
      evidence: "callback",
      details: {
        name: null,
        services: ["general_inquiry"],
        area: null,
        address: null,
        date: null,
        window: null,
        timePreference: null,
      },
    },
  };
  assert.deepEqual(chatRequestCommandSchema.parse(base), base);
  assert.throws(() =>
    chatRequestCommandSchema.parse({ ...base, tenantId: leadId }),
  );
  assert.throws(() =>
    chatRequestCommandSchema.parse({
      ...base,
      input: { ...base.input, actor: "owner" },
    }),
  );
  assert.throws(() =>
    chatRequestCommandSchema.parse({
      ...base,
      input: {
        ...base.input,
        details: {
          ...base.input.details,
          services: ["general_inquiry", "general_inquiry"],
        },
      },
    }),
  );
  assert.throws(() =>
    chatTaskCommandSchema.parse({
      action: "handoff",
      input: { leadId, messageId, reason: "dues", assigneeChatwootId: 3 },
    }),
  );
  assert.throws(() =>
    chatTaskCommandSchema.parse({
      action: "assign",
      input: { id: leadId, version: 1, userId: leadId, teamId: messageId },
    }),
  );
});

test("booking confirmation wording is tenant knowledge, strictly shaped and uses explicit exact phrases", async () => {
  const { parseKnowledgePack } =
    await import("../src/features/chat/knowledge-pack.ts");
  const { readFileSync } = await import("node:fs");
  const pack = JSON.parse(
    readFileSync(
      new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
      "utf8",
    ),
  );
  const confirmation = {
    intro: "Please confirm these requested details.",
    labels: {
      name: "Name",
      services: "Services",
      address: "Address",
      date: "Date",
      window: "Window",
      timePreference: "Contact time",
    },
    phrases: ["yes", "confirmed"],
  };
  assert.deepEqual(
    parseKnowledgePack({
      ...pack,
      booking: { capability: "follow_up_task", confirmation },
    }).booking.confirmation,
    confirmation,
  );
  assert.throws(() =>
    parseKnowledgePack({
      ...pack,
      booking: {
        capability: "follow_up_task",
        confirmation: { ...confirmation, phrases: ["yes", "YES"] },
      },
    }),
  );
});
