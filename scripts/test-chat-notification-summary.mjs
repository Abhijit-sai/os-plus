import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDailySummary,
  formatInstantAlert,
} from "../src/features/chat/notifications/summary.ts";
const metrics = {
  chats: 2,
  customerMessages: 3,
  botReplies: 1,
  staffReplies: 1,
  medianReplySeconds: 5,
  unansweredChats: 1,
  handoffs: 1,
  handoffReasons: { complaint: 1 },
  requests: 2,
  operationalActions: 1,
  confirmedBookings: 0,
  paymentClaims: 1,
  tasks: 1,
  newLeads: 2,
  wonLeads: 1,
  wonEstimatedValue: [
    { currency: "INR", amount: 2000 },
    { currency: "USD", amount: 20 },
  ],
  errors: 1,
  cost: { knownUsd: 0.001, unsettledCalls: 1 },
};
test("daily report labels evidence, unknowns and currencies truthfully without raw messages", () => {
  const input = {
    version: 1,
    localDate: "2026-10-27",
    timezone: "Asia/Kolkata",
    windowStart: "2026-10-26T16:00:00Z",
    windowEnd: "2026-10-27T16:00:00Z",
    totals: metrics,
    brands: [
      { id: "10000000-0000-4000-8000-000000000001", name: "Demo A", metrics },
      { id: "10000000-0000-4000-8000-000000000002", name: "Demo B", metrics },
    ],
    judge: { status: "not_evaluated" },
  };
  const text = formatDailySummary(input, "https://app.example.invalid");
  assert.match(text, /2026-10-26T16:00:00Z/);
  assert.match(text, /Customer messages: 3/);
  assert.match(text, /Provisional requests: 2/);
  assert.match(text, /Confirmed bookings: 0/);
  assert.match(text, /Payment claims.*not verified payments/);
  assert.match(text, /INR 2000/);
  assert.match(text, /USD 20/);
  assert.match(text, /1 unsettled/);
  assert.match(text, /not evaluated/i);
  assert.match(text, /Demo A/);
  assert.match(text, /Demo B/);
  assert.throws(() =>
    formatDailySummary(
      { ...input, transcript: "private" },
      "https://app.example.invalid",
    ),
  );
  const huge = {
    ...input,
    brands: Array.from({ length: 100 }, (_, i) => ({
      ...input.brands[0],
      name: "Brand " + i + "x".repeat(180),
    })),
  };
  const bounded = formatDailySummary(huge, "https://app.example.invalid");
  assert.ok(Array.from(bounded).length <= 4096);
  assert.match(bounded, /Further brand sections omitted/);
});
test("instant group alert is minimal and only links to an authenticated trusted OS PLUS origin", () => {
  const text = formatInstantAlert(
    {
      kind: "payment_claim",
      brand: "Demo",
      leadId: "10000000-0000-4000-8000-000000000001",
    },
    "https://app.example.invalid",
  );
  assert.match(text, /Payment claim/);
  assert.match(text, /https:\/\/app.example.invalid\/leads\//);
  assert.throws(() =>
    formatInstantAlert(
      { kind: "payment_claim", brand: "Demo", phone: "+919999990000" },
      "https://app.example.invalid",
    ),
  );
  assert.throws(() =>
    formatInstantAlert(
      { kind: "handoff", brand: "Demo", leadId: null },
      "https://evil.invalid/path",
    ),
  );
});
