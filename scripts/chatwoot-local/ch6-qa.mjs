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
import { validateKnowledgePublication } from "../../src/features/chat/knowledge-pack.ts";
import { approvedImage } from "../../src/integrations/chatwoot/supplemental-client.ts";
if (!process.argv.includes("--run"))
  throw new Error("Explicit --run required for owned local synthetic CH6 QA.");
const local = await appState();
await verifyContainer(local, "db");
await owned(await state());
const accounts = JSON.parse(
  await readFile(path.join(runtime, "accounts.private.json"), "utf8"),
).accounts;
const db = await connect(local),
  report = {
    at: new Date().toISOString(),
    checks: [],
    conversations: [],
    liveAI: false,
    spendUsd: "0",
    mockOnly: true,
  };
const pass = (name) => {
  report.checks.push(name);
  console.log("PASS " + name);
};
async function wait(fn, label) {
  for (let n = 0; n < 160; n++) {
    const value = await fn();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(label + " timed out");
}
async function api(a, route, body) {
  const r = await fetch(
    "https://localhost:4444/api/v1/accounts/" + a.accountId + route,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "api-access-token": a.token,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new Error("Owned provider request status " + r.status);
  return r.json();
}
async function conversation(a, name) {
  const response = await api(a, "/contacts", {
    inbox_id: a.inboxId,
    name,
    identifier: "ch6-" + randomUUID(),
  });
  const person = response.payload.contact,
    source = person.contact_inboxes.find(
      (c) => c.inbox.id === a.inboxId,
    ).source_id;
  return api(a, "/conversations", {
    source_id: source,
    inbox_id: a.inboxId,
    contact_id: person.id,
    status: "open",
  });
}
async function incoming(a, conversationId, text) {
  const out = await rails(
    "Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:" +
      a.accountId +
      ",display_id:" +
      conversationId +
      ");m=c.messages.create!(account_id:c.account_id,inbox_id:c.inbox_id,sender:c.contact,message_type: :incoming,content:" +
      JSON.stringify(text) +
      ");puts 'CH6_MESSAGE='+m.id.to_s",
  );
  const providerId = Number(
    out
      .split("\n")
      .find((l) => l.startsWith("CH6_MESSAGE="))
      .slice(12),
  );
  const stored = await wait(
    async () =>
      (
        await db.query(
          "select id,conversation_id from chat_messages where tenant_id=$1 and chatwoot_message_id=$2",
          [a.tenantId, providerId],
        )
      ).rows[0],
    "Native incoming capture",
  );
  return { ...stored, providerId };
}
const context = (a) => ({
  tenantId: a.tenantId,
  actor: { type: "USER", id: a.owner },
  source: "OS_PLUS_UI",
  correlationId: randomUUID(),
  idempotencyKey: randomUUID(),
});
async function config(a, mode) {
  const version =
    (
      await db.query(
        "select version from chat_channel_action_approvals where tenant_id=$1 and channel_id=$2",
        [a.tenantId, a.channelId],
      )
    ).rows[0]?.version ?? 0;
  return db.query("select chat_action_configure($1,$2)", [
    JSON.stringify(context(a)),
    JSON.stringify({
      channelId: a.channelId,
      version,
      mode,
      canBook: true,
      packId: a.packId,
      approveAuto: mode === "auto",
      locationId: null,
      teamId: null,
    }),
  ]);
}
async function delivered(a, messageId, publicReply = false) {
  return wait(
    async () =>
      (
        await db.query(
          "select r.id,r.status,r.delivery_note_id,r.result_json,t.cost_usd,o.id outbox_id,o.provider_message_id,o.latency_ms from chat_agent_runs r join chat_turns t on t.tenant_id=r.tenant_id and t.id=r.turn_id left join chat_public_outbox o on o.tenant_id=r.tenant_id and o.run_id=r.id where r.tenant_id=$1 and r.trigger_message_id=$2 and r.status='delivered'" +
            (publicReply ? " and o.state='sent'" : ""),
          [a.tenantId, messageId],
        )
      ).rows[0],
    publicReply ? "Native public reply" : "Native private suggestion",
  );
}
try {
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
  for (const [i, a] of accounts.entries()) {
    assert.equal(a.accountId, 901 + i);
    a.tenantId = "81000000-0000-4000-8000-" + String(i + 1).padStart(12, "0");
    a.owner = "local-api-owner-" + (i ? "b" : "a");
    const scope = (
      await db.query(
        "select c.id,c.brand_id,k.pack_json from chat_channels c join chat_workspaces w on w.tenant_id=c.tenant_id and w.id=c.workspace_id join chat_knowledge_packs k on k.tenant_id=c.tenant_id and k.brand_id=c.brand_id and k.status='published' where c.tenant_id=$1 and w.chatwoot_base_url='https://localhost:4444' and w.chatwoot_account_id=$2 and c.chatwoot_inbox_id=$2 and c.kind='website' and c.is_active",
        [a.tenantId, a.accountId],
      )
    ).rows[0];
    assert.ok(scope);
    a.channelId = scope.id;
    const pack = structuredClone(scope.pack_json);
    pack.handoffTopics = ["complaint", "refund", "payment", "order status"];
    pack.booking = {
      capability: "follow_up_task",
      confirmation: {
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
      },
      prompts: {
        services: "Which service would you like?",
        name: "What is your name?",
        address: "What is the pickup address?",
        date: "Which pickup date would you prefer?",
        window: "Which configured window would you prefer?",
        awaitingStaff: "The team will review this request.",
        whatsappHandoff: "Please continue on the business WhatsApp.",
        location: "Which area are you in?",
      },
    };
    if (i === 0) {
      const asset = await conversation(a, "CH6 synthetic approved image");
      const form = new FormData();
      form.set("content", "Synthetic approved image fixture.");
      form.set("message_type", "outgoing");
      form.set("private", "true");
      form.append(
        "attachments[]",
        new Blob(
          [
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=",
              "base64",
            ),
          ],
          { type: "image/png" },
        ),
        "synthetic-price-list.png",
      );
      const uploaded = await api(
        a,
        "/conversations/" + asset.id + "/messages",
        form,
      );
      assert.equal(uploaded.attachments.length, 1);
      const url = new URL(uploaded.attachments[0].data_url);
      assert.ok(["localhost", "127.0.0.1", "rails"].includes(url.hostname));
      process.env.CHAT_MEDIA_ORIGINS = '["https://localhost:4444"]';
      const original = "https://localhost:4444" + url.pathname + url.search;
      await assert.rejects(approvedImage(original));
      url.pathname = url.pathname.replace("/blobs/redirect/", "/blobs/proxy/");
      pack.priceListImageUrl =
        "https://localhost:4444" + url.pathname + url.search;
      assert.equal(
        (await approvedImage(pack.priceListImageUrl)).type,
        "image/png",
      );
      pack.media = {
        priceListCaption: "Synthetic local indicative price list.",
      };
    }
    const valid = validateKnowledgePublication(pack, {
      locationCodes: pack.areas.map((x) => x.locationCode),
      capabilities: ["follow_up_task"],
    });
    const saved = (
      await db.query("select chat_configure($1,'pack.save',$2) result", [
        JSON.stringify(context(a)),
        JSON.stringify({ brandId: scope.brand_id, pack: valid }),
      ])
    ).rows[0].result;
    await db.query("select chat_publish_action_pack($1,$2)", [
      JSON.stringify(context(a)),
      JSON.stringify({ id: saved.id }),
    ]);
    a.packId = saved.id;
    await config(a, "draft");
  }
  pass(
    "Two owned synthetic businesses have separately published callback packs; modes remain draft and live models stay disabled",
  );
  for (const a of accounts) {
    const c = await conversation(a, "CH6 synthetic callback " + a.accountId),
      message = await incoming(
        a,
        c.id,
        "CH6 synthetic booking: General inquiry",
      );
    const run = await delivered(a, message.id),
      request = await wait(
        async () =>
          (
            await db.query(
              "select r.id,r.version,r.status,l.id lead_id from chat_action_requests r join leads l on l.tenant_id=r.tenant_id and l.id=r.lead_id where r.tenant_id=$1 and r.source_message_id=$2",
              [a.tenantId, message.id],
            )
          ).rows[0],
        "Provisional request",
      );
    assert.equal(request.status, "requested");
    assert.equal(Number(run.cost_usd), 0);
    const native = await api(a, "/conversations/" + c.id + "/messages");
    assert.ok(
      native.payload.some(
        (m) => m.id === Number(run.delivery_note_id) && m.private,
      ),
    );
    assert.equal(
      native.payload.filter(
        (m) => m.content_attributes?.osplus_public_outbox_id,
      ).length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*) n from chat_action_requests where tenant_id<>$1 and id=$2",
          [a.tenantId, request.id],
        )
      ).rows[0].n,
      "0",
    );
    report.conversations.push({
      kind: "callback",
      accountId: a.accountId,
      conversationId: c.id,
      leadId: request.lead_id,
      requestId: request.id,
      noteId: Number(run.delivery_note_id),
    });
  }
  pass(
    "Actual native callbacks create tenant-isolated provisional requests/private suggestions in both accounts at zero cost",
  );
  const a = accounts[0],
    complaint = await conversation(a, "CH6 synthetic handoff");
  await api(a, "/conversations/" + complaint.id + "/labels", {
    labels: ["qa-preserved"],
  });
  const complaintMessage = await incoming(
    a,
    complaint.id,
    "CH6 synthetic complaint: Please help with this inquiry",
  );
  await delivered(a, complaintMessage.id);
  await wait(async () => {
    const labels = await api(a, "/conversations/" + complaint.id + "/labels");
    return (
      labels.payload.includes("osplus-handoff") &&
      labels.payload.includes("qa-preserved")
    );
  }, "Merged native label");
  assert.equal(
    (
      await db.query(
        "select count(*) n from chat_task_records r join leads l on l.tenant_id=r.tenant_id and l.id=r.lead_id where r.tenant_id=$1 and l.conversation_id=$2 and r.work_kind='CHAT_HANDOFF' and r.closed_at is null",
        [a.tenantId, complaintMessage.conversation_id],
      )
    ).rows[0].n,
    "1",
  );
  pass(
    "Actual automatic safety handoff creates one task and merges its native label while preserving an unrelated label",
  );
  report.conversations.push({
    kind: "handoff",
    accountId: a.accountId,
    conversationId: complaint.id,
  });
  await config(a, "auto");
  const prices = await conversation(a, "CH6 synthetic automatic price list");
  const priceMessage = await incoming(
    a,
    prices.id,
    "CH6 synthetic price_list: Please show the price list",
  );
  const publicRun = await delivered(a, priceMessage.id, true);
  const image = await wait(
    async () =>
      (
        await db.query(
          "select * from chat_supplemental_deliveries where tenant_id=$1 and run_id=$2 and kind='price_image' and state='sent'",
          [a.tenantId, publicRun.id],
        )
      ).rows[0],
    "Native price image",
  );
  const messages = await api(a, "/conversations/" + prices.id + "/messages");
  const text = messages.payload.find(
      (m) => m.id === Number(publicRun.provider_message_id),
    ),
    photo = messages.payload.find(
      (m) => m.id === Number(image.provider_message_id),
    );
  assert.equal(text.private, false);
  assert.equal(photo.private, false);
  assert.equal(photo.attachments.length, 1);
  assert.ok(photo.id > text.id);
  assert.equal(
    messages.payload.filter(
      (m) => m.content_attributes?.osplus_public_outbox_id === image.id,
    ).length,
    1,
  );
  report.latencyMs = Number(publicRun.latency_ms);
  assert.ok(report.latencyMs >= 0);
  pass(
    "Actual native auto reply then one requested multipart image succeed only after owner channel signoff; transport receipt latency measured",
  );
  report.conversations.push({
    kind: "automatic_price",
    accountId: a.accountId,
    conversationId: prices.id,
    textId: text.id,
    imageId: photo.id,
  });
  const replay = await rails(
    "Rails.logger.level=Logger::FATAL;c=Conversation.find_by!(account_id:901,display_id:" +
      prices.id +
      ");m=c.messages.find(" +
      priceMessage.providerId +
      ");2.times{SafeFetch.fetch(c.inbox.agent_bot.outgoing_url,method: :post,body:m.webhook_data.merge(event:'message_created').to_json,headers:{'Content-Type'=>'application/json'},open_timeout:5,read_timeout:5,validate_content_type:false){|_r|nil}};puts 'CH6_REPLAY_OK'",
  );
  assert.ok(replay.includes("CH6_REPLAY_OK"));
  assert.equal(
    (await api(a, "/conversations/" + prices.id + "/messages")).payload.filter(
      (m) => m.content_attributes?.osplus_public_outbox_id === image.id,
    ).length,
    1,
  );
  pass(
    "Repeated actual native agent callbacks do not duplicate the public image",
  );
  await config(a, "draft");
  const callback = report.conversations.find(
      (c) => c.kind === "callback" && c.accountId === 901,
    ),
    request = (
      await db.query(
        "select * from chat_action_requests where tenant_id=$1 and id=$2",
        [a.tenantId, callback.requestId],
      )
    ).rows[0];
  const workflow = async (action, input) =>
    (
      await db.query("select chat_request_workflow($1,$2,$3) result", [
        JSON.stringify(context(a)),
        action,
        JSON.stringify(input),
      ])
    ).rows[0].result;
  const review = await workflow("review", {
    id: request.id,
    version: request.version,
  });
  const summary = await api(
    a,
    "/conversations/" + callback.conversationId + "/messages",
    { content: review.reviewText, message_type: "outgoing", private: false },
  );
  await wait(
    async () =>
      (
        await db.query(
          "select id from chat_messages where tenant_id=$1 and chatwoot_message_id=$2",
          [a.tenantId, summary.id],
        )
      ).rows[0],
    "Summary capture",
  );
  const yes = await incoming(a, callback.conversationId, "yes"),
    confirmed = await workflow("confirm", {
      id: request.id,
      version: review.version,
      messageId: yes.id,
    });
  await assert.rejects(
    workflow("approve", {
      id: request.id,
      version: confirmed.version,
      countryCode: null,
    }),
    /Verified WhatsApp/,
  );
  pass(
    "Actual website summary/yes evidence is capturable but cannot authorize operational approval without verified WhatsApp identity",
  );
  report.result = "PASS";
} finally {
  for (const a of accounts)
    if (a.packId) await config(a, "draft").catch(() => {});
  await db.end();
  await writeFile(
    path.join(appRuntime, "ch6-native-report.json"),
    JSON.stringify(report, null, 2),
  );
}
console.log(
  "CH6 owned native QA PASS: " +
    report.checks.length +
    " checks; liveAI false; spendUSD0.",
);
