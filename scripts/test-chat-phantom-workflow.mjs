import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "./shopify-db-harness/node_modules/@electric-sql/pglite/dist/index.js";
import { pgcrypto } from "./shopify-db-harness/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js";
import { applyChatMigrations } from "./chat-db-harness/migrate.mjs";
import { runAgentTurn } from "../src/features/chat/agent/turn.ts";
import { formatDailySummary, formatInstantAlert } from "../src/features/chat/notifications/summary.ts";

test("Phantom Threads Test projects a photo and queues one Telegram alert per task and deadline", async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await applyChatMigrations({ query: (sql) => db.exec(sql) });
    const tenant = "7be40f50-94a0-46c5-af57-7eea5e36ea8a";
    const key = (n) => "12345678-1234-4000-8000-" + String(n).padStart(12, "0");
    const [workspace, brand, channel, packId, owner, target] = Array.from({ length: 6 }, (_, i) => key(i + 1));
    const hook = { tenantId: tenant, actor: { type: "WEBHOOK", id: "chatwoot" }, source: "WEBHOOK", correlationId: "fixture" };
    const admin = { tenantId: tenant, actor: { type: "USER", id: "test-owner" }, source: "OS_PLUS_UI", correlationId: "fixture", idempotencyKey: "approve-auto" };
    const notifications = { tenantId: tenant, actor: { type: "SYSTEM", id: "chat-notifications" }, source: "AUTOMATION", correlationId: "fixture" };
    const q = async (sql, args = []) => (await db.query(sql, args)).rows;
    const scalar = async (sql, args) => (await q(sql, args))[0].result;
    const run = (name, input) => scalar("select chat_live_agent_run($1,$2,$3) result", [hook, name, input]);
    const dispatch = (name, input = {}) => scalar("select chat_notification_dispatch($1,$2,$3) result", [notifications, name, input]);
    const pack = JSON.parse(readFileSync(new URL("../docs_chat/examples/new-business.pack.json", import.meta.url), "utf8"));
    pack.hours = { default: "We are open every day, 10 AM to 7 PM." };
    await q("insert into tenants(id,name,store_name,slug) values($1,'Phantom Threads Test','Test','phantom-test')", [tenant]);
    await q("insert into tenant_users(id,tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,'test-owner','test@example.invalid','Owner','owner_admin','active')", [owner, tenant]);
    await q("insert into tenant_modules(tenant_id,module_key,is_enabled,config_json) values($1,'chat_leads',true,$2)", [tenant, { agentEnabled: true, uncappedDraftChannelId: channel }]);
    await q("insert into chat_settings(tenant_id,notifications_enabled,summary_local_time) values($1,true,((now()-interval '10 seconds') at time zone 'Asia/Kolkata')::time)", [tenant]);
    await q("insert into chat_brands(id,tenant_id,name,slug,persona_name) values($1,$2,'Phantom Threads Test','phantom','Demo')", [brand, tenant]);
    await q("insert into chat_workspaces(id,tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,$2,'https://chat.example.invalid',904,$3,$4,'gcm1.v1.fixture','active')", [workspace, tenant, "b".repeat(32), "a".repeat(64)]);
    await q("insert into chat_channels(id,tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name,agent_mode) values($1,$2,$3,$4,905,'whatsapp','Synthetic','draft')", [channel, tenant, workspace, brand]);
    await q("insert into chat_knowledge_packs(id,tenant_id,brand_id,version,status,pack_json) values($1,$2,$3,1,'published',$4)", [packId, tenant, brand, pack]);
    await scalar("select chat_action_configure($1,$2) result", [admin, {
      channelId: channel, version: 0, mode: "auto", canBook: false, packId, approveAuto: true, locationId: null, teamId: null,
    }]);
    await q("insert into chat_notification_targets(id,tenant_id,recipient_kind,label,recipient_enc,events,is_active,linked_at,confirmed_at,activated_at) values($1,$2,'private','Test','gcm1.v1.fixture',array['handoff','new_lead','daily_summary'],true,now(),now(),now()-interval '2 days')", [target, tenant]);

    const capture = async (messageId, content, attachments = []) => {
      const binding = { workspaceId: workspace, channelId: channel, secretHash: "a".repeat(64) };
      const receipt = await scalar("select chat_capture($1,'agent',$2) result", [hook, {
        ...binding, identity: { displayName: "Test Customer", sourceId: "12025550123", phoneE164: "+12025550123" },
        message: { messageId, accountId: 904, inboxId: 905, conversationId: 10, contactId: 10,
          status: "open", channelKind: "whatsapp", author: "customer", private: false, content,
          contentType: "text", attachments, staffUserId: null, createdAt: new Date().toISOString() },
      }]);
      return { ...binding, conversationId: receipt.conversationId, triggerMessageId: receipt.messageId };
    };
    await capture(30, "Custom shirt, relaxed fit. Can you deliver tomorrow?");
    const input = await capture(31, null, [{ id: 81, file_type: "image" }]);
    const claim = await run("claim", input);
    assert.equal(claim.status, "claimed");
    assert.equal(claim.context.messages.at(-1).hasImage, true);
    assert.equal(claim.context.messages.at(-1).attachments, undefined);
    const { secretHash: _secret, ...scope } = input;
    const result = await runAgentTurn({
      scope: { ...scope, tenantId: tenant }, now: new Date().toISOString(),
      data: claim.context, allowAutomatic: true,
    }, { kind: "live", complete() { throw Error("Photo intake should use grounded replies"); } });
    assert.equal(result.decision.phantomRequest.reference, "photo");
    assert.equal((await run("complete", { ...input, runId: claim.runId, leaseToken: claim.leaseToken, result })).status, "ready");

    const leadId = await scalar("select id result from leads where tenant_id=$1 and conversation_id=$2", [tenant, input.conversationId]);
    const record = await scalar("select id result from chat_task_records where tenant_id=$1 and lead_id=$2", [tenant, leadId]);
    const repeat = await capture(32, "Yes, tomorrow");
    const revised = await capture(33, "Actually, Friday");
    for (const [messageId, deadline] of [[repeat.triggerMessageId, "tomorrow"], [revised.triggerMessageId, "Friday"]]) {
      await q("insert into chat_task_reasons(tenant_id,record_id,message_id,reason) values($1,$2,$3,'staff_requested')", [tenant, record, messageId]);
      await q("update chat_turns set decision_json=$3 where tenant_id=$1 and trigger_message_id=$2",
        [tenant, messageId, { phantomRequest: { ...result.decision.phantomRequest, deadline } }]);
    }
    const sources = await q("select kind from chat_notification_sources($1,'-infinity') where lead_id=$2", [tenant, leadId]);
    assert.deepEqual(sources.map(({ kind }) => kind), ["handoff", "handoff"]);

    await dispatch("prepare");
    const origin = "https://os-plus.example.invalid";
    const seen = [];
    const deadlines = [];
    for (let i = 0; i < 3; i++) {
      const delivery = await dispatch("claim");
      const context = await scalar("select chat_phantom_notification_context($1,$2,$3) result", [tenant, delivery.id, delivery.token]);
      seen.push(delivery.kind);
      if (delivery.kind === "daily_summary") {
        const digest = formatDailySummary(delivery.payload, origin, context);
        assert.match(digest, /Needs attention now/);
        assert.match(digest, /Needed by Friday/);
      } else {
        const alert = formatInstantAlert(delivery.payload, origin, context);
        deadlines.push(context.request.deadline);
        assert.match(alert, /Photo in chat/);
        assert.match(alert, /Needed by (tomorrow|Friday)/);
        assert.match(alert, /Next step/);
        assert.equal(await scalar("select chat_phantom_notification_context($1,$2,$3) result", [tenant, delivery.id, key(99)]), null);
        await q("update chat_notification_targets set recipient_kind='group',events=array['handoff'] where id=$1", [target]);
        assert.equal(await scalar("select chat_phantom_notification_context($1,$2,$3) result", [tenant, delivery.id, delivery.token]), null);
        await q("update chat_notification_targets set recipient_kind='private',events=array['handoff','new_lead','daily_summary'] where id=$1", [target]);
      }
      await dispatch("record", { id: delivery.id, token: delivery.token, messageId: i + 1 });
    }
    assert.deepEqual(seen.sort(), ["daily_summary", "handoff", "handoff"]);
    assert.deepEqual(deadlines.sort(), ["Friday", "tomorrow"]);
    assert.equal((await dispatch("claim")).status, "none");
  } finally {
    await db.close();
  }
});
