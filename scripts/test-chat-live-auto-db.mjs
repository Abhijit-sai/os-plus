import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startChatDatabase } from "./chat-db-harness/database.mjs";
import { runAgentTurn } from "../src/features/chat/agent/turn.ts";

test("live WhatsApp auto uses owner approval, verified orders, one outbox and durable handoff", { timeout: 120000 }, async () => {
  const local = await startChatDatabase();
  try {
    const db = local.db;
    const key = (n) => "ac000000-0000-4000-8000-" + String(n).padStart(12, "0");
    const [tenant, workspace, brand, channel, packId, owner, customer, order] =
      Array.from({ length: 8 }, (_, index) => key(index + 1));
    const secretHash = "a".repeat(64);
    const hook = { tenantId: tenant, actor: { type: "WEBHOOK", id: "chatwoot" }, source: "WEBHOOK", correlationId: "auto-rehearsal" };
    const admin = { tenantId: tenant, actor: { type: "USER", id: "auto-owner" }, source: "OS_PLUS_UI", correlationId: "auto-rehearsal", idempotencyKey: "approve-auto" };
    const q = (sql, args) => db.query(sql, args);
    const scalar = async (sql, args) => (await q(sql, args)).rows[0].result;
    const action = (fn, name, input) => scalar(`select ${fn}($1,$2,$3) result`, [hook, name, input]);
    const run = (name, input) => action("chat_live_agent_run", name, input);
    const send = (name, input) => action("chat_live_public_reply", name, input);
    const pack = JSON.parse(readFileSync(new URL("../docs_chat/examples/new-business.pack.json", import.meta.url), "utf8"));
    pack.replies = { clarify: "Which detail should we check?", error: "The team will check and reply here." };
    await q("insert into tenants(id,name,store_name,slug) values($1,'Auto QA','Auto QA','chat-auto-qa')", [tenant]);
    await q("insert into tenant_users(id,tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,'auto-owner','auto@example.invalid','Owner','owner_admin','active')", [owner, tenant]);
    await q("insert into tenant_modules(tenant_id,module_key,is_enabled,config_json) values($1,'chat_leads',true,$2)", [tenant, { agentEnabled: true, uncappedDraftChannelId: channel }]);
    await q("insert into chat_settings(tenant_id) values($1)", [tenant]);
    await q("insert into chat_brands(id,tenant_id,name,slug,persona_name) values($1,$2,'Auto QA','auto','Demo')", [brand, tenant]);
    await q("insert into chat_workspaces(id,tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,$2,'https://chat.example.invalid',904,$3,$4,'gcm1.v1.fixture','active')", [workspace, tenant, "b".repeat(32), secretHash]);
    await q("insert into chat_channels(id,tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name,agent_mode) values($1,$2,$3,$4,905,'whatsapp','Synthetic','draft')", [channel, tenant, workspace, brand]);
    await q("insert into chat_knowledge_packs(id,tenant_id,brand_id,version,status,pack_json) values($1,$2,$3,1,'published',$4)", [packId, tenant, brand, pack]);
    await q("insert into customers(id,tenant_id,name,phone,normalized_phone_e164) values($1,$2,'Synthetic customer','+12025550123','+12025550123')", [customer, tenant]);
    const trackingToken = "x".repeat(32);
    await q("insert into orders(id,tenant_id,customer_id,order_number,order_status,tracking_token,delivery_type,delivery_address,total_amount) values($1,$2,$3,'ORD-000123','in_progress',$4,'courier','100 Synthetic Road',225)", [order, tenant, customer, trackingToken]);
    const captures = (content, provider, phone = "+12025550123", createdAt = new Date(Date.now() + 2000).toISOString(), conversation = provider, contact = conversation) =>
      scalar("select chat_capture($1,'agent',$2) result", [hook, {
        workspaceId: workspace, channelId: channel, secretHash,
        identity: { displayName: "Synthetic", sourceId: phone.slice(1), phoneE164: phone },
        message: { messageId: provider, accountId: 904, inboxId: 905, conversationId: conversation,
          contactId: contact, status: "open", channelKind: "whatsapp", author: "customer",
          private: false, content, contentType: "text", attachments: [], staffUserId: null, createdAt },
      }]).then((r) => ({ workspaceId: workspace, channelId: channel, secretHash,
        conversationId: r.conversationId, triggerMessageId: r.messageId }));
    const old = await captures("Hello", 12, undefined, new Date(Date.now() - 2000).toISOString());
    await scalar("select chat_action_configure($1,$2) result", [admin, { channelId: channel,
      version: 0, mode: "auto", canBook: false, packId, approveAuto: true, locationId: null, teamId: null }]);
    assert.equal((await run("claim", old)).status, "auto_unapproved");
    const known = await captures("Where is my order ORD-000123?", 13);
    const lookup = (input, kind = "status", verifiedPhone = "+12025550123") =>
      scalar("select chat_live_auto_customer_lookup($1,$2) result", [hook, { ...input, verifiedPhone, kind }]);
    const customerLookup = await lookup(known);
    assert.equal(customerLookup.text, "We’re working on your order.");
    assert.deepEqual(Object.keys(customerLookup).sort(), ["kind", "proof", "text"]);
    assert.equal(await lookup(known, "status", "+12025550124"), null);
    assert.equal(await lookup(known, "status", null), null);
    const unknown = await captures("Where is my order ORD-000123?", 14, "+12025550124");
    assert.equal(await lookup(unknown, "status", "+12025550124"), null);

    const scope = ({ secretHash, ...binding }) => ({ ...binding, tenantId: tenant });
    const orderClaim = await run("claim", known);
    const orderResult = await runAgentTurn({
      scope: scope(known), now: new Date(Date.now() + 3000).toISOString(),
      data: orderClaim.context, allowAutomatic: true, customerLookup,
    }, { kind: "live", complete() { throw Error("Verified status needs no provider call"); } });
    const orderCap = { ...known, runId: orderClaim.runId, leaseToken: orderClaim.leaseToken };
    assert.equal((await run("complete", { ...orderCap, result: orderResult })).status, "ready");
    assert.equal((await send("claim", { ...orderCap, verifiedPhone: "+12025550124" })).status, "customer_context_changed");
    const verifiedOrderCap = { ...orderCap, verifiedPhone: "+12025550123" };
    assert.equal((await send("claim", verifiedOrderCap)).status, "claimed");
    await q("update orders set order_status='ready' where id=$1", [order]);
    assert.equal((await send("target", verifiedOrderCap)).status, "customer_context_changed");

    const owned = (content, message) => captures(content, message, undefined, undefined, message, 13);
    const latest = await owned("Where is my order?", 30);
    assert.equal((await lookup(latest)).text, "Your order is ready.");
    assert.equal(await lookup(latest, "tracking"), null);
    const link = await owned("Send me my tracking link", 31);
    const trackingLookup = await lookup(link, "tracking");
    assert.equal(trackingLookup.text, "Here is your order tracking link: https://os-plus.vercel.app/track/" + trackingToken);
    const trackingClaim = await run("claim", link);
    const trackingCap = { ...link, runId: trackingClaim.runId, leaseToken: trackingClaim.leaseToken, verifiedPhone: "+12025550123" };
    const trackingResult = await runAgentTurn({
      scope: scope(link), now: new Date(Date.now() + 3000).toISOString(),
      data: trackingClaim.context, allowAutomatic: true, customerLookup: trackingLookup,
    }, { kind: "live", complete() { throw Error("Tracking needs no provider call"); } });
    const { verifiedPhone, ...trackingComplete } = trackingCap;
    assert.equal((await run("complete", { ...trackingComplete, result: trackingResult })).status, "ready");
    assert.equal((await send("claim", trackingCap)).status, "claimed");
    // A captured public reply may appear before the outbox has its provider receipt.
    await q("insert into chat_messages(id,tenant_id,conversation_id,chatwoot_message_id,author,private,content,content_type,created_at) values($1,$2,$3,503,'bot',false,$4,'text',now())",
      [key(52), tenant, link.conversationId, trackingLookup.text]);
    await q("update chat_channels set agent_mode='draft' where tenant_id=$1 and id=$2", [tenant, channel]);
    const draftContext = await scalar("select chat_agent_load($1,$2) result", [hook, link]);
    assert.deepEqual(draftContext.verifiedLookupReplyIds, [key(52)]);
    await q("update chat_channels set agent_mode='auto' where tenant_id=$1 and id=$2", [tenant, channel]);
    const balance = await owned("How much do I owe?", 32);
    assert.equal((await lookup(balance, "balance")).text, "There is a payment pending on your order. Our team can confirm the amount and payment options.");
    const address = await owned("Is my delivery address 100 Synthetic Road?", 33);
    assert.equal((await lookup(address, "address")).text, "That matches the delivery address on file for your order.");
    const addressOnFile = await owned("Is my delivery address on file?", 36);
    assert.equal((await lookup(addressOnFile, "address")).text, "We have a delivery address on file for your order.");
    const measurement = await owned("Do you have my measurements?", 34);
    assert.equal(await lookup(measurement, "measurements"), null);
    await q("insert into customer_measurements(tenant_id,customer_id,measurement_data_json) values($1,$2,$3)", [tenant, customer, { chest: 41, privateNote: "Staff only" }]);
    assert.equal((await lookup(measurement, "measurements")).text, "We have a saved measurement record. Our team can help confirm which fitting details apply.");
    await q("insert into customers(id,tenant_id,name,phone,normalized_phone_e164) values($1,$2,'Different customer','+12025550124','+12025550124')", [key(50), tenant]);
    await q("insert into orders(tenant_id,customer_id,order_number,order_status,tracking_token) values($1,$2,'ORD-000456','ready',$3)", [tenant, key(50), "y".repeat(32)]);
    const wrongOrder = await owned("Tracking link for ORD-000456", 35);
    assert.equal(await lookup(wrongOrder, "tracking"), null);
    assert.equal(await lookup(wrongOrder), null);
    await q("insert into orders(tenant_id,customer_id,order_number,order_status,tracking_token) values($1,$2,'ORD-000125','cancelled',$3)", [tenant, customer, "z".repeat(32)]);
    assert.equal(await lookup(latest), null);
    await assert.rejects(
      q("insert into customers(id,tenant_id,name,phone,normalized_phone_e164) values($1,$2,'Duplicate customer','+12025550123','+12025550123')", [key(51), tenant]),
      { code: "23505" },
    );

    await captures("Hello. You there?", 11, undefined, new Date(Date.now() - 1000).toISOString(), 15);
    const fresh = await captures("Are you there", 15);
    const claim = await run("claim", fresh);
    assert.equal(claim.status, "claimed");
    const result = await runAgentTurn({ scope: scope(fresh),
      now: new Date(Date.now() + 3000).toISOString(), data: claim.context, allowAutomatic: true }, {
      kind: "live", complete() { throw Error("Greeting needs no provider call"); },
    });
    const cap = { ...fresh, runId: claim.runId, leaseToken: claim.leaseToken };
    assert.equal((await run("complete", { ...cap, result })).status, "ready");
    assert.equal((await send("claim", cap)).status, "claimed");
    assert.equal((await send("claim", cap)).status, "held");
    assert.equal((await send("target", cap)).accountId, 904);
    assert.equal((await send("record", { ...cap, providerMessageId: 501 })).status, "sent");
    assert.equal((await send("claim", cap)).status, "sent");

    const finish = async (input, providerMessageId) => {
      const claimed = await run("claim", input);
      const result = await runAgentTurn({
        scope: scope(input), now: new Date(Date.now() + 3000).toISOString(),
        data: claimed.context, allowAutomatic: true,
      }, { kind: "live", async complete() { return { json: { fact: null }, model: "synthetic", costUsd: "0" }; } });
      const capability = { ...input, runId: claimed.runId, leaseToken: claimed.leaseToken };
      assert.equal((await run("complete", { ...capability, result })).status, "ready");
      if (providerMessageId) {
        assert.equal((await send("claim", capability)).status, "claimed");
        assert.equal((await send("record", { ...capability, providerMessageId })).status, "sent");
      }
      return result;
    };
    const sources = async (input) => (await q(`
      select kind from chat_notification_sources($1, '-infinity')
      where kind in ('handoff','agent_failure') and lead_id in (
        select id from leads where tenant_id=$1 and conversation_id=$2)
      order by kind`, [tenant, input.conversationId])).rows.map((row) => row.kind);
    assert.deepEqual(await sources(fresh), []);
    const sizing = await captures("You already know my size", 20);
    assert.equal((await finish(sizing)).decision.handoff, true);
    assert.deepEqual(await sources(sizing), []);
    assert.equal(await scalar("select count(*)::int result from chat_task_records tr join leads l on l.tenant_id=tr.tenant_id and l.id=tr.lead_id where tr.tenant_id=$1 and l.conversation_id=$2", [tenant, sizing.conversationId]), 1);
    const unknownFirst = await captures("Something unusual", 21);
    assert.equal((await finish(unknownFirst, 502)).replyText, pack.replies.clarify);
    assert.equal(await scalar("select ledger_json->>'automaticClarification' result from chat_state where tenant_id=$1 and conversation_id=$2", [tenant, unknownFirst.conversationId]), pack.replies.clarify);
    assert.deepEqual(await sources(unknownFirst), []);
    // The next customer message can arrive before Chatwoot captures the outgoing reply.
    const unknownAgain = await captures("Still something unusual", 23, undefined, new Date(Date.now() + 2400).toISOString(), 21);
    assert.equal((await finish(unknownAgain)).replyText, pack.locked.handoffLine);
    assert.deepEqual(await sources(unknownAgain), ["handoff"]);

    const interrupted = await captures("What are your hours?", 16);
    const second = await run("claim", interrupted);
    const pending = { ...interrupted, runId: second.runId, leaseToken: second.leaseToken };
    assert.equal((await run("budget.reserve", { ...pending, callKey: "write", maxUsd: "0.01" })).admitted, true);
    assert.equal((await run("budget.settle", { ...pending, callKey: "write", actualUsd: null })).status, "uncertain");
    const failure = await runAgentTurn({ scope: scope(interrupted),
      now: new Date(Date.now() + 3000).toISOString(), data: second.context, allowAutomatic: true }, {
      kind: "live", complete() { throw Error("Synthetic timeout"); },
    });
    const forged = { ...failure, replyText: "Unapproved error wording." };
    assert.equal((await action("chat_agent_run", "complete", { ...pending, result: forged })).status, "cost_pending");
    const oldDecision = { ...failure.decision };
    delete oldDecision.staffAlert;
    assert.equal((await action("chat_agent_run", "complete", {
      ...pending, result: { ...failure, decision: oldDecision },
    })).status, "cost_pending");
    assert.equal((await run("complete", { ...pending, result: failure })).status, "ready");
    assert.equal(await scalar("select reply_text result from chat_turns where trigger_message_id=$1", [interrupted.triggerMessageId]), pack.replies.error);
    assert.deepEqual(await sources(interrupted), ["handoff"]);
    assert.equal((await send("claim", pending)).status, "claimed");
    assert.equal(await scalar("select state result from chat_agent_cost_entries where run_id=$1", [second.runId]), "uncertain");
  } finally {
    await local.stop();
  }
});
