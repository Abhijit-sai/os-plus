import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { state, connect, verifyContainer, runtime } from "./common.mjs";
import {
  state as providerState,
  owned,
  runtime as providerRuntime,
} from "../chatwoot-local/common.mjs";
const s = await state();
await verifyContainer(s, "db");
await owned(await providerState());
const db = await connect(s);
try {
  const tenant = "81000000-0000-4000-8000-000000000001",
    messageId = 290;
  const rows = (
    await db.query(
      "select m.id,m.conversation_id,m.content,c.chatwoot_conversation_id,c.contact_id,l.id lead_id,ct.customer_id from chat_messages m join chat_conversations c on c.tenant_id=m.tenant_id and c.id=m.conversation_id join leads l on l.tenant_id=c.tenant_id and l.conversation_id=c.id join chat_contacts ct on ct.tenant_id=c.tenant_id and ct.id=c.contact_id where m.tenant_id=$1 and m.chatwoot_message_id=$2",
      [tenant, messageId],
    )
  ).rows;
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(
    row.content,
    "CH9 browser synthetic enquiry: what are your opening hours?",
  );
  assert.equal(row.customer_id, null);
  const claims = (
    await db.query(
      "select value,verified from chat_website_phone_claims where tenant_id=$1 and message_id=$2",
      [tenant, row.id],
    )
  ).rows;
  assert.deepEqual(claims, [{ value: "+919000000006", verified: false }]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_contact_identities where tenant_id=$1 and contact_id=$2 and kind='phone'",
        [tenant, row.contact_id],
      )
    ).rows[0].n,
    0,
  );
  const runs = (
    await db.query(
      "select r.id,r.status,r.delivery_note_id,t.cost_usd from chat_agent_runs r join chat_turns t on t.tenant_id=r.tenant_id and t.id=r.turn_id where r.tenant_id=$1 and r.trigger_message_id=$2",
      [tenant, row.id],
    )
  ).rows;
  assert.equal(runs.length, 1);
  assert.equal(runs[0].status, "delivered");
  assert.equal(Number(runs[0].cost_usd), 0);
  const a = JSON.parse(
    await readFile(path.join(providerRuntime, "accounts.private.json")),
  ).accounts.find((a) => a.accountId === 901);
  assert.ok(a);
  const approved = process.argv.includes("--approved");
  const response = await fetch(
    "http://127.0.0.1:4141/api/v1/accounts/901/conversations/" +
      row.chatwoot_conversation_id +
      "/messages",
    {
      headers: { "api-access-token": a.token },
      signal: AbortSignal.timeout(15000),
    },
  );
  assert.equal(response.status, 200);
  const messages = (await response.json()).payload;
  const notes = messages.filter(
    (m) => m.private && m.content_attributes?.osplus_draft_id === runs[0].id,
  );
  assert.equal(notes.length, 1);
  assert.equal(notes[0].private, true);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from chat_messages where tenant_id=$1 and conversation_id=$2 and author='bot' and not private",
        [tenant, row.conversation_id],
      )
    ).rows[0].n,
    approved ? 1 : 0,
  );
  const report = {
    at: new Date().toISOString(),
    result: "PASS",
    checks: [
      "Actual browser pre-chat message captured under A with one lead",
      "Country-code phone from actual pre-chat stored once and remains unverified/no customer or phone identity",
      approved
        ? "One private mock suggestion; exactly one staff-approved public reply and zero cost"
        : "One actual private mock suggestion and zero public bot replies/cost",
    ],
    tenantId: tenant,
    conversationId: Number(row.chatwoot_conversation_id),
    messageId,
    contactId: row.contact_id,
    leadId: row.lead_id,
    noteId: notes[0].id,
    spendUsd: 0,
  };
  if (approved) {
    const reply = messages.find((m) => m.id === 294);
    assert.ok(reply);
    assert.equal(reply.private, false);
    assert.equal(
      reply.content,
      "Synthetic local test hours: Monday to Friday, ten in the morning to six in the evening.",
    );
    const stored = (
      await db.query(
        "select author from chat_messages where tenant_id=$1 and chatwoot_message_id=294",
        [tenant],
      )
    ).rows;
    assert.deepEqual(stored, [{ author: "bot" }]);
    // Captured staff-approved suggestions deliberately count as bot for draft-use analytics.
    const receipts = (
      await db.query(
        "select s.state,s.provider_message_id,u.role from chat_draft_sends s join tenant_users u on u.tenant_id=s.tenant_id and u.id=s.actor_tenant_user_id where s.tenant_id=$1 and s.run_id=$2",
        [tenant, runs[0].id],
      )
    ).rows;
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].state, "sent");
    assert.equal(Number(receipts[0].provider_message_id), 294);
    assert.equal(receipts[0].role, "owner_admin");
    report.checks.push(
      "Explicit Chatwoot staff approval created reply294, observed in visitor widget and matched exact authenticated sent receipt",
    );
    report.staffApprovedReplyId = 294;
  }
  await writeFile(
    path.join(
      runtime,
      approved
        ? "ch9-browser-approved-report.json"
        : "ch9-browser-widget-report.json",
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await db.end();
}
