import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  state as appState,
  connect,
  verifyContainer,
  runtime as appRuntime,
} from "../chat-local/common.mjs";
import { state, owned, runtime, rails } from "./common.mjs";
if (!process.argv.includes("--run"))
  throw Error("Use --run for owned local synthetic fresh-chat QA.");
const local = await appState();
await verifyContainer(local, "db");
await owned(await state());
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
      signal: AbortSignal.timeout(60000),
    },
  );
  assert.equal(r.status, 404);
  await r.body?.cancel();
}
const accounts = JSON.parse(
  await readFile(path.join(runtime, "accounts.private.json"), "utf8"),
).accounts;
const db = await connect(local),
  report = {
    at: new Date().toISOString(),
    checks: [],
    conversations: [],
    mockOnly: true,
    liveAI: false,
    spendUsd: "0",
  };
const pass = (name) => {
  report.checks.push(name);
  console.log("PASS " + name);
};
async function api(a, route, body) {
  const r = await fetch(
    "https://localhost:4444/api/v1/accounts/" + a.accountId + route,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "api-access-token": a.token,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  if (!r.ok) throw Error("Owned provider request status " + r.status);
  return r.json();
}
async function wait(fn, label) {
  for (let n = 0; n < 120; n++) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error(label + " timed out");
}
async function captured(tenant, id) {
  return wait(
    async () =>
      (
        await db.query(
          "select id,conversation_id,author from chat_messages where tenant_id=$1 and chatwoot_message_id=$2",
          [tenant, id],
        )
      ).rows[0],
    "Native callback capture",
  );
}
async function delivered(tenant, id) {
  return wait(
    async () =>
      (
        await db.query(
          "select r.id,r.status,r.delivery_note_id,r.result_json,t.cost_usd from chat_agent_runs r join chat_turns t on t.tenant_id=r.tenant_id and t.id=r.turn_id where r.tenant_id=$1 and r.trigger_message_id=$2 and r.status='delivered'",
          [tenant, id],
        )
      ).rows[0],
    "Automatic private draft",
  );
}
try {
  for (const [i, a] of accounts.entries()) {
    assert.equal(a.accountId, 901 + i);
    const tenantId =
      "81000000-0000-4000-8000-" + String(i + 1).padStart(12, "0");
    const enabled = (
      await db.query(
        "select config_json->>'agentEnabled' enabled from tenant_modules where tenant_id=$1 and module_key='chat_leads'",
        [tenantId],
      )
    ).rows[0];
    assert.equal(enabled.enabled, "true");
    const created = await api(a, "/contacts", {
      inbox_id: a.inboxId,
      name: "Fresh mock QA " + (i + 1),
      identifier: "fresh-mock-" + randomUUID(),
    });
    const contact = created.payload.contact,
      source = contact.contact_inboxes.find(
        (c) => c.inbox.id === a.inboxId,
      ).source_id;
    const c = await api(a, "/conversations", {
      source_id: source,
      inbox_id: a.inboxId,
      contact_id: contact.id,
      status: "open",
    });
    report.conversations.push({
      accountId: a.accountId,
      conversationId: c.id,
      tenantId,
    });
  }
  const native = await rails(
    "Rails.logger.level=Logger::FATAL;rows=JSON.parse(" +
      JSON.stringify(JSON.stringify(report.conversations)) +
      ");out=rows.map do |r|;c=Conversation.find_by!(account_id:r['accountId'],display_id:r['conversationId']);m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:'Fresh synthetic opening-hours enquiry');{accountId:c.account_id,messageId:m.id};end;puts 'FRESH='+out.to_json",
  );
  const incoming = JSON.parse(
    native
      .split("\n")
      .find((l) => l.startsWith("FRESH="))
      .slice(6),
  );
  for (const [index, c] of report.conversations.entries()) {
    c.messageId = incoming.find((m) => m.accountId === c.accountId).messageId;
    const stored = await captured(c.tenantId, c.messageId),
      run = await delivered(c.tenantId, stored.id);
    c.noteId = Number(run.delivery_note_id);
    c.runId = run.id;
    const messages = await api(
      accounts[index],
      "/conversations/" + c.conversationId + "/messages",
    );
    const note = messages.payload.find((m) => m.id === c.noteId);
    assert.equal(note.private, true);
    assert.equal(note.content_attributes.osplus_draft_id, run.id);
    assert.equal(
      messages.payload.filter(
        (m) => m.content_attributes?.osplus_draft_id === run.id,
      ).length,
      1,
    );
    assert.equal(Number(run.cost_usd), 0);
    const leads = (
      await db.query(
        "select count(*)::int n from leads where tenant_id=$1 and conversation_id=$2",
        [c.tenantId, stored.conversation_id],
      )
    ).rows[0];
    assert.equal(leads.n, 1);
    const foreign = (
      await db.query(
        "select count(*)::int n from chat_agent_runs where tenant_id<>$1 and id=$2",
        [c.tenantId, run.id],
      )
    ).rows[0];
    assert.equal(foreign.n, 0);
    pass(
      "Account " +
        c.accountId +
        " fresh native callback automatically creates exactly one private mock draft/lead at zero cost in its own tenant",
    );
  }
  const first = report.conversations[0];
  const replay = await rails(
    "Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:901,display_id:" +
      first.conversationId +
      ");m=c.messages.find(" +
      first.messageId +
      ");2.times{SafeFetch.fetch(c.inbox.agent_bot.outgoing_url,method: :post,body:m.webhook_data.merge(event:'message_created').to_json,headers:{'Content-Type'=>'application/json'},open_timeout:5,read_timeout:5,validate_content_type:false){|_r|nil}};puts 'REPLAY_OK'",
  );
  assert.ok(replay.includes("REPLAY_OK"));
  const after = await api(
    accounts[0],
    "/conversations/" + first.conversationId + "/messages",
  );
  assert.equal(
    after.payload.filter(
      (m) => m.content_attributes?.osplus_draft_id === first.runId,
    ).length,
    1,
  );
  pass("Duplicate actual agent callbacks do not duplicate a draft");
  const follow = await rails(
    "Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:901,display_id:" +
      first.conversationId +
      ");m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:'Fresh synthetic follow-up enquiry');puts 'FOLLOW='+m.id.to_s",
  );
  const followId = Number(
    follow
      .split("\n")
      .find((l) => l.startsWith("FOLLOW="))
      .slice(7),
  );
  const followStored = await captured(first.tenantId, followId),
    followRun = await delivered(first.tenantId, followStored.id);
  assert.notEqual(followRun.id, first.runId);
  pass(
    "Fresh follow-up receives its own new private suggestion without a public bot reply",
  );
  await api(
    accounts[0],
    "/conversations/" + first.conversationId + "/messages",
    {
      content: "Synthetic human takeover reply",
      message_type: "outgoing",
      private: false,
    },
  );
  await wait(
    async () =>
      (
        await db.query(
          "select quiet_until>now() quiet from chat_conversations where tenant_id=$1 and id=$2",
          [first.tenantId, followStored.conversation_id],
        )
      ).rows[0]?.quiet,
    "Staff quiet capture",
  );
  const quiet = await rails(
    "Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:901,display_id:" +
      first.conversationId +
      ");m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:'Synthetic enquiry while human is replying');SafeFetch.fetch(c.inbox.agent_bot.outgoing_url,method: :post,body:m.webhook_data.merge(event:'message_created').to_json,headers:{'Content-Type'=>'application/json'},open_timeout:5,read_timeout:5,validate_content_type:false){|_r|nil};puts 'QUIET='+m.id.to_s",
  );
  const quietId = Number(
    quiet
      .split("\n")
      .find((l) => l.startsWith("QUIET="))
      .slice(6),
  );
  const quietStored = await captured(first.tenantId, quietId);
  const count = (
    await db.query(
      "select count(*)::int n from chat_agent_runs where tenant_id=$1 and trigger_message_id=$2",
      [first.tenantId, quietStored.id],
    )
  ).rows[0];
  assert.equal(count.n, 0);
  pass(
    "Human reply starts saved quiet interval; next native incoming callback creates no model run or suggestion",
  );
  report.result = "PASS";
} finally {
  await db.end();
  await writeFile(
    path.join(appRuntime, "ch5-fresh-chat-report.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    checks: report.checks.length,
    conversations: report.conversations,
    liveAI: false,
    spendUsd: "0",
  }),
);
