import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const id = (n) => "63000000-0000-4000-8000-" + String(n).padStart(12, "0");
const pack = JSON.parse(
  readFileSync(
    new URL("../docs_chat/examples/new-business.pack.json", import.meta.url),
    "utf8",
  ),
);
const scope = {
  tenantId: id(1),
  workspaceId: id(2),
  channelId: id(3),
  conversationId: id(4),
  triggerMessageId: id(5),
};
const row = {
  tenantId: id(1),
  conversationId: id(4),
  id: id(5),
  providerId: 10,
  author: "customer",
  private: false,
  content: "Opening hours?",
  at: "2026-10-22T10:00:00Z",
};
const data = () => ({
  ...scope,
  brandId: id(6),
  active: true,
  moduleEnabled: true,
  channelKind: "website",
  agentMode: "draft",
  quietUntil: null,
  pack: { tenantId: id(1), brandId: id(6), version: 1, body: pack },
  ledger: {},
  historyComplete: true,
  messages: [
    { ...row },
    {
      ...row,
      id: id(7),
      providerId: 11,
      private: true,
      author: "staff",
      content: "PRIVATE STAFF NOTE",
    },
  ],
});
test("context is built only from the exact tenant/conversation and excludes private notes and identity authority", async () => {
  const { buildAgentContext } =
    await import("../src/features/chat/agent/context.ts");
  const result = buildAgentContext(scope, data());
  assert.equal(result.session.messages.length, 1);
  assert.equal(result.packVersion, 1);
  assert.equal(
    JSON.stringify(result.modelContext).includes("PRIVATE STAFF NOTE"),
    false,
  );
  assert.equal("tenantId" in result.modelContext, false);
  for (const mutate of [
    (d) => (d.tenantId = id(9)),
    (d) => (d.workspaceId = id(9)),
    (d) => (d.channelId = id(9)),
    (d) => (d.conversationId = id(9)),
    (d) => (d.messages[0].tenantId = id(9)),
    (d) => (d.messages[0].conversationId = id(9)),
    (d) => (d.pack.tenantId = id(9)),
    (d) => (d.pack.brandId = id(9)),
    (d) => (d.moduleEnabled = false),
    (d) => (d.active = false),
    (d) => (d.agentMode = "off"),
    (d) => (d.historyComplete = false),
    (d) => (d.pack.body = { bad: true }),
    (d) => (d.ledger = { unexpected: "do not silently reset" }),
  ]) {
    const input = data();
    mutate(input);
    assert.throws(() => buildAgentContext(scope, input));
  }
});

test("brand-configured session intervals override defaults without rewriting the stored ledger", async () => {
  const { buildAgentContext } =
    await import("../src/features/chat/agent/context.ts");
  const input = data();
  input.messages = [
    { ...row, id: id(8), providerId: 8, at: "2026-10-22T09:45:00Z" },
    row,
  ];
  input.pack.body = structuredClone(pack);
  input.pack.body.agent = {
    session: { continueMinutes: 10, freshHours: 12 },
    indicativeLabel: "indicative",
  };
  input.ledger = {
    schemaVersion: 1,
    sessionStartedAt: "2026-10-22T09:45:00Z",
    requestOpen: true,
    vendorQuietUntil: null,
  };
  const result = buildAgentContext(scope, input);
  assert.equal(result.session.band, "resumed");
  assert.equal(result.ledger.requestOpen, true);
  assert.equal(input.ledger.requestOpen, true);
  input.messages[0].at = "2026-10-21T09:45:00Z";
  const fresh = buildAgentContext(scope, input);
  assert.equal(fresh.session.band, "fresh");
  assert.equal(fresh.ledger.requestOpen, false);
  assert.equal(input.ledger.requestOpen, true);
});

test("inquiry ledger follows configured session and actual public vendor replies, never unsent drafts", async () => {
  const { buildAgentContext } =
    await import("../src/features/chat/agent/context.ts");
  const input = data();
  input.quietMinutes = 90;
  input.messages.unshift({
    ...row,
    id: id(8),
    providerId: 8,
    author: "staff",
    content: pack.locked.vendorReply,
    at: "2026-10-22T09:59:00Z",
  });
  const actual = buildAgentContext(scope, input);
  assert.equal(actual.ledger.vendorQuietUntil, "2026-10-22T11:29:00.000Z");
  const privateDraft = structuredClone(input);
  privateDraft.messages[0].private = true;
  assert.equal(
    buildAgentContext(scope, privateDraft).ledger.vendorQuietUntil,
    null,
  );
  assert.equal(actual.ledger.language, null);
  assert.equal(actual.ledger.handoff, false);
});

test("own-contact background and branch facts are scoped before model projection, and private native details stay server-side", async () => {
  const { buildAgentContext } =
    await import("../src/features/chat/agent/context.ts");
  const input = data();
  input.background = {
    tenantId: id(1),
    contactId: id(20),
    displayName: "Synthetic visitor",
    preferredLanguage: "en",
    customer: {
      tenantId: id(1),
      id: id(21),
      verified: true,
      name: "Synthetic customer",
      addresses: [
        {
          label: "Home",
          line: "PRIVATE STREET",
          area: "East Park",
          city: "Demo",
        },
      ],
      orders: [{ status: "in_progress", at: "2026-10-21T10:00:00Z" }],
      openTasks: 1,
    },
  };
  input.locations = [
    {
      tenantId: id(1),
      brandId: id(6),
      code: "demo",
      name: "Demo branch",
      address: "Business road",
      mapUrl: "https://maps.example.invalid/demo",
      lat: 17,
      lng: 78,
      primary: true,
      default: true,
    },
  ];
  const context = buildAgentContext(scope, input);
  assert.equal(context.modelContext.background.returningCustomer, true);
  assert.equal(context.modelContext.background.recentOrders, 1);
  assert.equal(context.modelContext.locations[0].code, "demo");
  assert.equal(
    JSON.stringify(context.modelContext).includes("PRIVATE STREET"),
    false,
  );
  for (const mutate of [
    (d) => (d.background.tenantId = id(99)),
    (d) => (d.background.customer.tenantId = id(99)),
    (d) => (d.background.customer.verified = false),
    (d) => (d.locations[0].tenantId = id(99)),
    (d) => (d.locations[0].brandId = id(99)),
  ]) {
    const bad = structuredClone(input);
    mutate(bad);
    assert.throws(() => buildAgentContext(scope, bad));
  }
});
