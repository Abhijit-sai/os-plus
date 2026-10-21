import assert from "node:assert/strict";
import { test } from "node:test";
import { parseChatwootMessage } from "../src/integrations/chatwoot/payload.ts";
export const fixture = (patch = {}) => ({
  event: "message_created",
  id: 71,
  account: { id: 12 },
  inbox: { id: 4 },
  conversation: {
    id: 8,
    inbox_id: 4,
    status: "open",
    channel: "Channel::Whatsapp",
    meta: { sender: { id: 91 } },
  },
  message_type: "incoming",
  private: false,
  content: "Synthetic inquiry",
  content_type: "text",
  created_at: "2026-10-21T10:00:00Z",
  sender: { id: 91, type: "contact" },
  ...patch,
});
test("incoming string and numeric webhook messages normalize to the same customer event", () => {
  const expected = parseChatwootMessage(fixture());
  assert.equal(expected.author, "customer");
  assert.equal(expected.accountId, 12);
  assert.equal(expected.contactId, 91);
  assert.equal(expected.channelKind, "whatsapp");
  assert.deepEqual(
    parseChatwootMessage(fixture({ message_type: 0, created_at: 1792576800 })),
    expected,
  );
});

test("staff, bot, private note, activity, template and senderless greeting classification is explicit", () => {
  for (const message_type of ["outgoing", 1]) {
    assert.equal(
      parseChatwootMessage(
        fixture({ message_type, sender: { id: 9, type: "user" } }),
      ).author,
      "staff",
    );
    assert.equal(
      parseChatwootMessage(
        fixture({ message_type, sender: { id: 9, type: "agent_bot" } }),
      ).author,
      "bot",
    );
    assert.equal(
      parseChatwootMessage(fixture({ message_type, sender: null })).author,
      "system",
    );
  }
  for (const message_type of ["template", 3, "activity", 2])
    assert.equal(
      parseChatwootMessage(fixture({ message_type, sender: null })).author,
      "system",
    );
  const note = parseChatwootMessage(
    fixture({
      message_type: 1,
      private: true,
      sender: { id: 9, type: "user" },
    }),
  );
  assert.equal(note.private, true);
  assert.equal(note.staffUserId, 9);
});
test("four channels and legacy Instagram normalize without copying provider credentials", () => {
  for (const [channel, expected] of [
    ["Channel::Whatsapp", "whatsapp"],
    ["Channel::Instagram", "instagram"],
    ["Channel::FacebookPage", "facebook"],
    ["Channel::WebWidget", "website"],
  ]) {
    const base = fixture();
    const result = parseChatwootMessage({
      ...base,
      secret: "discard",
      conversation: { ...base.conversation, channel },
    });
    assert.equal(result.channelKind, expected);
    assert.equal(JSON.stringify(result).includes("discard"), false);
  }
  const base = fixture();
  assert.equal(
    parseChatwootMessage({
      ...base,
      conversation: {
        ...base.conversation,
        channel: "Channel::FacebookPage",
        additional_attributes: { type: "instagram_direct_message" },
      },
    }).channelKind,
    "instagram",
  );
});
test("malformed ids, mismatched nested ownership, unknown enums and unbounded content are rejected", () => {
  const base = fixture();
  for (const patch of [
    { id: 0 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { message_type: 7 },
    { private: "false" },
    { created_at: "yesterday" },
    { created_at: Infinity },
    { content: "x".repeat(150001) },
    { conversation: { ...base.conversation, inbox_id: 999 } },
    { conversation: { ...base.conversation, account_id: 999 } },
    { sender: { id: 999, type: "contact" } },
    { conversation: { ...base.conversation, meta: undefined }, sender: null },
  ])
    assert.throws(() => parseChatwootMessage(fixture(patch)));
});

test("a template with an explicit human sender remains staff; template type alone does not erase a real reply", () => {
  const result = parseChatwootMessage(
    fixture({ message_type: "template", sender: { id: 9, type: "user" } }),
  );
  assert.equal(result.author, "staff");
  assert.equal(result.staffUserId, 9);
});

test("captured local v4.18 website, email-prompt and human reply payloads retain their transport roles", async () => {
  const {readFile}=await import("node:fs/promises");
  const fixture=JSON.parse(await readFile(new URL("./fixtures/chatwoot/local-4.18-website.json",import.meta.url),"utf8"));
  const parsed=fixture.messages.map(parseChatwootMessage);
  assert.deepEqual(parsed.map(m=>m.author),["customer","system","staff"]);
  assert.ok(parsed.every(m=>m.channelKind==="website"&&!m.private));
});


test("captured local AgentBot output stays bot-authored and never becomes a staff reply", async () => {
  const { readFile } = await import("node:fs/promises");
  const captured = JSON.parse(await readFile(new URL("./fixtures/chatwoot/local-4.18-bot.json", import.meta.url), "utf8"));
  const [message] = captured.messages.map(parseChatwootMessage);
  assert.equal(message.author, "bot");
  assert.equal(message.staffUserId, null);
  assert.equal(message.channelKind, "website");
  assert.equal(message.private, false);
});
