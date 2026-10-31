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
  throw new Error("Use --run for owned loopback synthetic timing only.");
const local = await appState();
await verifyContainer(local, "db");
await owned(await state());
const a = JSON.parse(
  await readFile(path.join(runtime, "accounts.private.json"), "utf8"),
).accounts[0];
assert.equal(a.accountId, 901);
const tenant = "81000000-0000-4000-8000-000000000001",
  db = await connect(local),
  report = {
    at: new Date().toISOString(),
    scope:
      "Owned native loopback Chatwoot with local mock, no paid/live model or Meta",
    samples: [],
    spendUsd: "0",
  };
async function api(route, body) {
  const r = await fetch("https://localhost:4444/api/v1/accounts/901" + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "api-access-token": a.token,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Owned timing request failed");
  return r.json();
}
const row = (
  await db.query(
    "select c.id,p.id pack_id from chat_channels c join chat_workspaces w on w.tenant_id=c.tenant_id and w.id=c.workspace_id join chat_knowledge_packs p on p.tenant_id=c.tenant_id and p.brand_id=c.brand_id and p.status='published' where c.tenant_id=$1 and w.chatwoot_account_id=901 and w.chatwoot_base_url='https://localhost:4444' and c.chatwoot_inbox_id=901 and c.is_active",
    [tenant],
  )
).rows[0];
assert.ok(row);
async function config(mode) {
  const version =
    (
      await db.query(
        "select version from chat_channel_action_approvals where tenant_id=$1 and channel_id=$2",
        [tenant, row.id],
      )
    ).rows[0]?.version ?? 0;
  await db.query("select chat_action_configure($1,$2)", [
    JSON.stringify({
      tenantId: tenant,
      actor: { type: "USER", id: "local-api-owner-a" },
      source: "OS_PLUS_UI",
      correlationId: randomUUID(),
      idempotencyKey: randomUUID(),
    }),
    JSON.stringify({
      channelId: row.id,
      version,
      mode,
      canBook: true,
      packId: row.pack_id,
      approveAuto: mode === "auto",
      locationId: null,
      teamId: null,
    }),
  ]);
}
try {
  await config("auto");
  const conversations = [];
  for (let i = 0; i < 5; i++) {
    const created = await api("/contacts", {
        inbox_id: 901,
        name: "CH6 synthetic timing " + (i + 1),
        identifier: "ch6-timing-" + randomUUID(),
      }),
      person = created.payload.contact,
      source = person.contact_inboxes.find((x) => x.inbox.id === 901).source_id;
    const conv = await api("/conversations", {
      inbox_id: 901,
      contact_id: person.id,
      source_id: source,
      status: "open",
    });
    conversations.push(conv.id);
  }
  const output = await rails(
    "Rails.logger.level=Logger::FATAL;ids=JSON.parse(" +
      JSON.stringify(JSON.stringify(conversations)) +
      ");rows=ids.map do |id|;c=Conversation.find_by!(account_id:901,display_id:id);m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:'CH6 synthetic timing opening-hours inquiry');{conversationId:id,messageId:m.id};end;puts 'CH6_TIMING='+rows.to_json",
  );
  const messages = JSON.parse(
    output
      .split("\n")
      .find((x) => x.startsWith("CH6_TIMING="))
      .slice(11),
  );
  for (let attempt = 0; attempt < 160; attempt++) {
    const rows = (
      await db.query(
        "select m.chatwoot_message_id,o.provider_message_id,o.latency_ms,r.id run_id,t.cost_usd from chat_messages m join chat_agent_runs r on r.tenant_id=m.tenant_id and r.trigger_message_id=m.id join chat_turns t on t.tenant_id=r.tenant_id and t.id=r.turn_id join chat_public_outbox o on o.tenant_id=r.tenant_id and o.run_id=r.id and o.state='sent' where m.tenant_id=$1 and m.chatwoot_message_id=any($2::bigint[])",
        [tenant, messages.map((x) => x.messageId)],
      )
    ).rows;
    if (rows.length === 5) {
      for (const m of messages) {
        const r = rows.find(
            (x) => Number(x.chatwoot_message_id) === m.messageId,
          ),
          native = await api(
            "/conversations/" + m.conversationId + "/messages",
          );
        assert.ok(
          native.payload.some(
            (x) => x.id === Number(r.provider_message_id) && !x.private,
          ),
        );
        assert.equal(Number(r.cost_usd), 0);
        report.samples.push({
          conversationId: m.conversationId,
          latencyMs: Number(r.latency_ms),
          publicMessageId: Number(r.provider_message_id),
        });
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.equal(report.samples.length, 5);
  const times = report.samples.map((x) => x.latencyMs).sort((a, b) => a - b);
  report.medianMs = times[2];
  report.targetMs = 6000;
  report.targetMet = report.medianMs <= 6000;
  report.result = "PASS";
  console.log(
    JSON.stringify({
      samples: 5,
      medianMs: report.medianMs,
      targetMet: report.targetMet,
      scope: "native local mocks only",
      spendUsd: "0",
    }),
  );
} finally {
  await config("draft").catch(() => {});
  await db.end();
  await writeFile(
    path.join(appRuntime, "ch6-latency-report.json"),
    JSON.stringify(report, null, 2),
  );
}
