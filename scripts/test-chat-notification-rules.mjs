import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTelegramLink } from "../src/features/chat/notifications/rules.ts";
const code = "aB3_".repeat(10) + "XYZ";
const update = {
  update_id: 19,
  message: {
    message_id: 2,
    date: 1793000000,
    chat: { id: 123, type: "private" },
    from: { id: 123, is_bot: false },
    text: "/start " + code,
  },
};
test("Telegram linking accepts only an exact original human start command in its supported chat", () => {
  assert.deepEqual(parseTelegramLink(update), {
    updateId: 19,
    chatId: "123",
    senderId: "123",
    chatType: "private",
    code,
  });
  for (const extra of [
    { edited_message: update.message, message: undefined },
    { message: { ...update.message, text: "hello /start " + code } },
    { message: { ...update.message, forward_origin: { type: "user" } } },
    { message: { ...update.message, sender_chat: { id: -50 } } },
    { message: { ...update.message, from: { id: 123, is_bot: true } } },
    { message: { ...update.message, chat: { id: 124, type: "private" } } },
    { message: { ...update.message, chat: { id: -123, type: "channel" } } },
  ])
    assert.equal(parseTelegramLink({ ...update, ...extra }), null);
  assert.equal(
    parseTelegramLink({ ...update, update_id: Number.MAX_SAFE_INTEGER + 1 }),
    null,
  );
  assert.equal(
    parseTelegramLink({
      ...update,
      message: {
        ...update.message,
        chat: { id: -900, type: "supergroup" },
        text: "/start@ExampleBot " + code,
      },
    }).chatId,
    "-900",
  );
});

test("latest summary slot follows the tenant calendar and cutoff, including DST and year boundaries", async () => {
  const { latestSummaryDate } =
    await import("../src/features/chat/notifications/rules.ts");
  assert.equal(
    latestSummaryDate("2026-10-27T15:59:59Z", "Asia/Kolkata", "21:30"),
    "2026-10-26",
  );
  assert.equal(
    latestSummaryDate("2026-10-27T16:00:00Z", "Asia/Kolkata", "21:30"),
    "2026-10-27",
  );
  assert.equal(
    latestSummaryDate("2026-01-01T00:01:00Z", "UTC", "21:30"),
    "2025-12-31",
  );
  assert.equal(
    latestSummaryDate("2026-03-08T07:10:00Z", "America/New_York", "03:30"),
    "2026-03-07",
  );
  assert.equal(
    latestSummaryDate("2026-03-08T07:30:00Z", "America/New_York", "03:30"),
    "2026-03-08",
  );
  assert.throws(() => latestSummaryDate("invalid", "UTC", "21:30"));
  assert.throws(() =>
    latestSummaryDate("2026-10-27T00:00:00Z", "+05:30", "21:30"),
  );
  assert.throws(() =>
    latestSummaryDate("2026-10-27T00:00:00Z", "UTC", "24:00"),
  );
});

test("pure preview date also waits for the later fall-back cutoff", async () => {
  const { latestSummaryDate } =
    await import("../src/features/chat/notifications/rules.ts");
  assert.equal(
    latestSummaryDate("2026-11-01T05:45:00Z", "America/New_York", "01:30"),
    "2026-10-31",
  );
  assert.equal(
    latestSummaryDate("2026-11-01T06:31:00Z", "America/New_York", "01:30"),
    "2026-11-01",
  );
});
