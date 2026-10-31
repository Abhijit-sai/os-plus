import { test } from "node:test";
import assert from "node:assert/strict";
const id = "50000000-0000-4000-8000-000000000001";
const lead = {
  id,
  ref_code: "ABCDE",
  brand_id: id,
  location_id: null,
  channel_id: id,
  contact_id: id,
  customer_id: id,
  owner_tenant_user_id: null,
  conversation_id: id,
  channel_kind: "website",
  kind: "sales",
  stage: "new",
  intent: "inquiry",
  services: ["Secret name"],
  area: "Private address",
  gist: "Email private@example.invalid",
  notes: "Phone +919876543210",
  handoff: false,
  est_value: null,
  currency: "INR",
  first_customer_at: "2026-10-21T10:00:00Z",
  last_customer_at: "2026-10-21T10:00:00Z",
  first_response_at: null,
  first_human_response_at: null,
  last_reply_at: null,
  closed_at: null,
  version: 1,
  tenant_id: "internal",
  credentials: "must never leave",
};
test("read-only non-PII lead DTO omits all customer/free-form/provider data while retaining operational state", async () => {
  const { projectLead } = await import("../src/features/leads/pii.ts");
  const dto = projectLead(lead, {
    pii: false,
    now: "2026-10-21T11:00:00Z",
    hotHours: 24,
    hotIntents: [],
  });
  assert.equal(dto.stage, "new");
  assert.equal(dto.waitingSeconds, 3600);
  assert.equal(dto.estimatedValue, null);
  const wire = JSON.stringify(dto);
  for (const text of [
    "Secret name",
    "Private address",
    "private@example",
    "9876543210",
    "must never leave",
    "internal",
  ])
    assert.equal(wire.includes(text), false, text);
  assert.equal("customerId" in dto, false);
  assert.equal("notes" in dto, false);
  assert.equal("gist" in dto, false);
});

test("contact and conversation DTOs hide raw text, identities, tokens and audit metadata from non-PII readers", async () => {
  const { projectContact, projectMessage, projectHistory } =
    await import("../src/features/leads/pii.ts");
  const contact = {
    id,
    display_name: "Secret Person",
    customer_id: id,
    merged_into: null,
    first_seen_at: "2026-10-21T10:00:00Z",
    last_seen_at: "2026-10-21T10:00:00Z",
    notes: "private@example.invalid",
    version: 1,
    prefs_json: { token: "secret" },
  };
  const identity = { kind: "phone", value: "+919876543210", verified: true };
  const dto = projectContact(contact, [identity], false);
  assert.equal(dto.name, "Contact hidden");
  assert.deepEqual(dto.identities, []);
  assert.equal("notes" in dto, false);
  assert.equal(
    projectContact(contact, [identity], true).identities[0].value,
    identity.value,
  );
  const message = {
    id,
    author: "customer",
    private: false,
    content: "Secret Person +919876543210",
    created_at: "2026-10-21T10:00:00Z",
    attachments_json: [{ url: "https://private.invalid?token=secret" }],
    raw_json: { token: "secret" },
  };
  assert.equal(projectMessage(message, false).content, null);
  assert.equal(projectMessage({ ...message, private: true }, true), null);
  assert.equal(projectMessage(message, true).content, message.content);
  const event = {
    id,
    kind: "lead.note_changed",
    at: message.created_at,
    actor_type: "USER",
    meta_json: { secret: "Secret Person" },
  };
  assert.equal(
    JSON.stringify(projectHistory(event)).includes("Secret Person"),
    false,
  );
  for (const word of [
    "Secret Person",
    "9876543210",
    "private@example",
    "secret",
  ])
    assert.equal(JSON.stringify(dto).includes(word), false);
});

test("Chatwoot navigation has no credentials/query tokens and accepts only explicit HTTP loopback browser overrides", async () => {
  const { chatwootBrowserUrl } =
    await import("../src/features/leads/transport.ts");
  const input = {
    baseUrl: "https://chat.example.invalid",
    accountId: 10,
    conversationId: 20,
  };
  assert.equal(
    chatwootBrowserUrl(input),
    "https://chat.example.invalid/app/accounts/10/conversations/20",
  );
  assert.equal(
    chatwootBrowserUrl(input, "http://localhost:4141"),
    "http://localhost:4141/app/accounts/10/conversations/20",
  );
  for (const baseUrl of [
    "javascript:alert(1)",
    "https://secret@chat.example.invalid",
    "https://chat.example.invalid?token=secret",
  ])
    assert.throws(() => chatwootBrowserUrl({ ...input, baseUrl }));
  assert.throws(() =>
    chatwootBrowserUrl(input, "http://public.example.invalid"),
  );
  assert.throws(() =>
    chatwootBrowserUrl(input, "https://chat.example.invalid/path"),
  );
});

test("configured reporting hours use explicit timezone and half-open weekly windows; missing schedule stays unknown", async () => {
  const { isOutsideReportingHours, reportingScheduleSchema } =
    await import("../src/features/leads/reporting-hours.ts");
  const schedule = {
    timezone: "Asia/Kolkata",
    intervals: [{ day: 1, startMinute: 540, endMinute: 1080 }],
  };
  assert.equal(
    isOutsideReportingHours("2026-10-19T03:30:00Z", schedule),
    false,
  );
  assert.equal(isOutsideReportingHours("2026-10-19T12:30:00Z", schedule), true);
  assert.equal(isOutsideReportingHours("2026-10-18T03:30:00Z", schedule), true);
  assert.equal(
    isOutsideReportingHours("2026-10-19T03:30:00Z", undefined),
    null,
  );
  assert.equal(
    reportingScheduleSchema.safeParse({ ...schedule, timezone: "Not/AZone" })
      .success,
    false,
  );
  assert.equal(
    reportingScheduleSchema.safeParse({
      ...schedule,
      intervals: [{ day: 1, startMinute: 1080, endMinute: 540 }],
    }).success,
    false,
  );
});

test("Dashboard App handshake requires the exact parent origin, account and bounded documented appContext", async () => {
  const { parsePanelContext } = await import("../src/features/leads/panel.ts");
  const message = JSON.stringify({
    event: "appContext",
    data: {
      conversation: { id: 20, inbox_id: 4, account_id: 10 },
      contact: { name: "Untrusted ignored" },
      currentAgent: { id: 999 },
    },
  });
  const policy = { origin: "https://chat.example.invalid", accountId: 10 };
  assert.deepEqual(parsePanelContext(message, policy.origin, policy, true), {
    accountId: 10,
    inboxId: 4,
    conversationId: 20,
  });
  for (const [origin, parent, payload] of [
    ["https://evil.invalid", true, message],
    [policy.origin, false, message],
    [
      policy.origin,
      true,
      message.replace('"account_id":10', '"account_id":11'),
    ],
    [policy.origin, true, "x".repeat(262145)],
    [policy.origin, true, "invalid"],
  ])
    assert.equal(parsePanelContext(payload, origin, policy, parent), null);
});

test("editing notes preserves automatic ownership; explicit unassignment and lost reasons remain deliberate", async () => {
  const { buildLeadEdit, replyState, needsLookHref } =
    await import("../src/features/leads/editor-state.ts");
  const { projectLead } = await import("../src/features/leads/pii.ts");
  const dto = projectLead(lead, { pii: true, now: "2026-10-21T11:00:00Z" });
  const unchanged = buildLeadEdit(dto, {
    stage: "new",
    ownerId: "",
    notes: "Updated",
    lostReason: "",
  });
  assert.equal("ownerId" in unchanged.input, false);
  assert.equal("stage" in unchanged.input, false);
  assert.equal(unchanged.input.notes, "Updated");
  const assigned = { ...dto, ownerId: id };
  assert.equal(
    buildLeadEdit(assigned, {
      stage: "new",
      ownerId: "",
      notes: "",
      lostReason: "",
    }).input.ownerId,
    null,
  );
  const closed = {
    ...dto,
    stage: "lost",
    lostReason: "No longer needed",
    waitingSeconds: null,
  };
  const noteOnly = buildLeadEdit(closed, {
    stage: "lost",
    ownerId: "",
    notes: "Follow-up note",
    lostReason: "No longer needed",
  });
  assert.equal("stage" in noteOnly.input, false);
  assert.equal(replyState(closed), "closed_unanswered");
  assert.equal(replyState({ ...closed, firstReplySeconds: 10 }), "closed");
  assert.equal(replyState(dto), "waiting");
  assert.equal(
    replyState({ ...dto, waitingSeconds: null, firstReplySeconds: 10 }),
    "replied",
  );
  const href = needsLookHref({
    page: 3,
    brandId: id,
    locationId: id,
    channelId: id,
  });
  const url = new URL(href, "https://example.invalid");
  assert.equal(url.searchParams.get("state"), "needs_look");
  assert.equal(url.searchParams.get("page"), "1");
  for (const key of ["brandId", "locationId", "channelId"])
    assert.equal(url.searchParams.get(key), id);
});

test("an unconfirmed transport response retains the exact command and retry key without throwing or resubmitting changed inputs", async () => {
  const { createConfirmedCommand } =
    await import("../src/features/leads/confirmed-command.ts");
  const attempts = [];
  let first = true;
  const command = createConfirmedCommand(
    async (input, key) => {
      attempts.push({ input, key });
      if (first) {
        first = false;
        throw new Error("private network detail");
      }
      return { ok: true, message: "Changes saved." };
    },
    () => "synthetic-retry-key",
  );
  const input = { action: "lead.edit", input: { notes: "draft" } };
  const lost = await command.run(input);
  assert.equal(lost.ok, false);
  assert.equal(lost.uncertain, true);
  assert.equal(lost.message.includes("private"), false);
  assert.equal(
    (await command.run({ ...input, input: { notes: "changed" } })).ok,
    false,
  );
  assert.equal(attempts.length, 1);
  assert.equal((await command.run(input)).ok, true);
  assert.deepEqual(attempts[0], attempts[1]);
});
