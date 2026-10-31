import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { state, owned, runtime, rails } from "./common.mjs";
import {
  state as appState,
  connect,
  verifyContainer,
  runtime as appRuntime,
} from "../chat-local/common.mjs";
if (!process.argv.includes("--run"))
  throw Error("Explicit --run required for owned synthetic CH9 QA.");
await owned(await state());
const local = await appState();
await verifyContainer(local, "db");
await verifyContainer(local, "rest");
const accounts = JSON.parse(
  await readFile(path.join(runtime, "accounts.private.json"), "utf8"),
).accounts;
assert.deepEqual(
  accounts.map((a) => a.accountId),
  [901, 902],
);
for (const kind of ["events", "agent"]) {
  const r = await fetch(
    "http://localhost:4131/api/chat/webhooks/chatwoot/" +
      "0".repeat(32) +
      "/" +
      kind +
      "?token=" +
      "0".repeat(32),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(60000),
    },
  );
  assert.equal(r.status, 404);
  await r.body?.cancel();
}
const db = await connect(local),
  report = {
    at: new Date().toISOString(),
    cases: [],
    checks: [],
    scope: "owned local synthetic website contacts and native callbacks",
    liveAI: false,
    liveTranscription: false,
    spendUsd: 0,
  };
const phone = "+919000000005";
const reuse = process.argv.includes("--replay-existing");
if (reuse) {
  report.cases = JSON.parse(
    await readFile(path.join(appRuntime, "ch9-native-report.json"), "utf8"),
  ).cases;
  assert.deepEqual(
    report.cases.map((c) => c.accountId),
    [901, 902],
  );
}
const pass = (name) => {
  report.checks.push(name);
  console.log("PASS " + name);
};
async function api(a, route, body) {
  const r = await fetch(
    "http://127.0.0.1:4141/api/v1/accounts/" + a.accountId + route,
    {
      method: body ? "POST" : "GET",
      headers: {
        "api-access-token": a.token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw Error("Owned native provider status " + r.status);
  return r.json();
}
async function wait(fn, label) {
  for (let n = 0; n < 120; n++) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error(label + " timed out");
}
try {
  for (const [index, a] of accounts.entries()) {
    const tenantId = "81000000-0000-4000-8000-00000000000" + (index + 1);
    const w = (
      await db.query(
        "select w.id from chat_workspaces w join chat_channels c on c.tenant_id=w.tenant_id and c.workspace_id=w.id where w.tenant_id=$1 and w.chatwoot_account_id=$2 and w.chatwoot_base_url='https://localhost:4444' and w.status='active' and c.chatwoot_inbox_id=$2 and c.kind='website' and c.is_active and c.agent_mode='draft'",
        [tenantId, a.accountId],
      )
    ).rows;
    assert.equal(w.length, 1);
    if (reuse) {
      assert.equal(
        report.cases.find((c) => c.accountId === a.accountId).tenantId,
        tenantId,
      );
      continue;
    }
    const inbox = await api(a, "/inboxes/" + a.inboxId);
    assert.equal(inbox.id, a.inboxId);
    assert.equal(inbox.channel_type, "Channel::WebWidget");
    const created = await api(a, "/contacts", {
      inbox_id: a.inboxId,
      name: "CH9 synthetic website " + (index + 1),
      identifier: "ch9-" + randomUUID(),
      phone_number: phone,
    });
    const contact = created.payload.contact,
      source = contact.contact_inboxes.find(
        (c) => c.inbox.id === a.inboxId,
      ).source_id;
    const conversation = await api(a, "/conversations", {
      inbox_id: a.inboxId,
      contact_id: contact.id,
      source_id: source,
      status: "open",
    });
    report.cases.push({
      tenantId,
      accountId: a.accountId,
      conversationId: conversation.id,
      providerContactId: contact.id,
    });
  }
  const raw = reuse
    ? "CH9_NATIVE=" +
      JSON.stringify(
        report.cases.map((c) => ({
          accountId: c.accountId,
          messageId: c.messageId,
        })),
      )
    : await rails(
        "Rails.logger.level=Logger::FATAL;rows=JSON.parse(" +
          JSON.stringify(JSON.stringify(report.cases)) +
          ");out=rows.map do |r|;c=Conversation.find_by!(account_id:r['accountId'],display_id:r['conversationId']);m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:'CH9 synthetic opening-hours enquiry');{accountId:c.account_id,messageId:m.id};end;puts 'CH9_NATIVE='+out.to_json",
      );
  const native = JSON.parse(
    raw
      .split("\n")
      .find((line) => line.startsWith("CH9_NATIVE="))
      .slice(11),
  );
  for (const item of report.cases) {
    item.messageId = native.find(
      (m) => m.accountId === item.accountId,
    ).messageId;
    const stored = await wait(
      async () =>
        (
          await db.query(
            "select id,conversation_id from chat_messages where tenant_id=$1 and chatwoot_message_id=$2",
            [item.tenantId, item.messageId],
          )
        ).rows[0],
      "Native website capture",
    );
    const run = await wait(
      async () =>
        (
          await db.query(
            "select r.id,r.delivery_note_id,t.cost_usd from chat_agent_runs r join chat_turns t on t.tenant_id=r.tenant_id and t.id=r.turn_id where r.tenant_id=$1 and r.trigger_message_id=$2 and r.status='delivered'",
            [item.tenantId, stored.id],
          )
        ).rows[0],
      "Private website draft",
    );
    const lead = (
      await db.query(
        "select l.id,l.contact_id,c.customer_id from leads l join chat_contacts c on c.tenant_id=l.tenant_id and c.id=l.contact_id where l.tenant_id=$1 and l.conversation_id=$2",
        [item.tenantId, stored.conversation_id],
      )
    ).rows;
    assert.equal(lead.length, 1);
    assert.equal(lead[0].customer_id, null);
    item.leadId = lead[0].id;
    item.contactId = lead[0].contact_id;
    item.noteId = Number(run.delivery_note_id);
    const claims = (
      await db.query(
        "select value,verified from chat_website_phone_claims where tenant_id=$1 and message_id=$2",
        [item.tenantId, stored.id],
      )
    ).rows;
    assert.deepEqual(claims, [{ value: phone, verified: false }]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from chat_contact_identities where tenant_id=$1 and contact_id=$2 and kind='phone'",
          [item.tenantId, item.contactId],
        )
      ).rows[0].n,
      0,
    );
    const messages = await api(
      accounts.find((a) => a.accountId === item.accountId),
      "/conversations/" + item.conversationId + "/messages",
    );
    const note = messages.payload.find((m) => m.id === item.noteId);
    assert.equal(note.private, true);
    assert.ok(note.content_attributes.osplus_draft_id);
    assert.equal(
      messages.payload.filter(
        (m) => m.content_attributes?.osplus_draft_id === run.id,
      ).length,
      1,
    );
    assert.equal(Number(run.cost_usd), 0);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from chat_messages where tenant_id=$1 and conversation_id=$2 and author='bot' and not private",
          [item.tenantId, stored.conversation_id],
        )
      ).rows[0].n,
      0,
    );
    pass(
      "Account " +
        item.accountId +
        " native website capture retains one unverified phone claim, one lead/private draft and no customer/public bot reply at zero cost",
    );
  }
  assert.notEqual(report.cases[0].contactId, report.cases[1].contactId);
  pass("Same claimed phone stays separated across the two tenant workspaces");
  const replay = await rails(
    "Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:901,display_id:" +
      report.cases[0].conversationId +
      ");m=c.messages.find(" +
      report.cases[0].messageId +
      ");2.times{SafeFetch.fetch(c.inbox.agent_bot.outgoing_url,method: :post,body:m.webhook_data.merge(event:'message_created').to_json,headers:{'Content-Type'=>'application/json'},open_timeout:5,read_timeout:5,validate_content_type:false){|_r|nil}};puts 'CH9_REPLAY=OK'",
  );
  assert.ok(replay.includes("CH9_REPLAY=OK"));
  const first = report.cases[0];
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_website_phone_claims p join chat_messages m on m.tenant_id=p.tenant_id and m.id=p.message_id where p.tenant_id=$1 and m.chatwoot_message_id=$2",
        [first.tenantId, first.messageId],
      )
    ).rows[0].n,
    1,
  );
  pass(
    "Two actual pinned SafeFetch callback replays preserve the single stored website claim",
  );
  report.result = "PASS";
} finally {
  await db.end();
  await writeFile(
    path.join(appRuntime, "ch9-native-report.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    cases: report.cases,
    liveAI: false,
    spendUsd: 0,
  }),
);
