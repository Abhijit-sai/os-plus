import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
export async function voiceFixture(db, index = 0, transformPack, ageHours=0) {
  const tenantId = randomUUID();
  await db.query(
    "insert into tenants(id,name,store_name,slug) values($1,'Voice QA','Voice QA',$2)",
    [tenantId, "voice-" + tenantId],
  );
  await db.query(
    "insert into tenant_modules(tenant_id,is_enabled,config_json) values($1,true,'{\"agentEnabled\":true}')",
    [tenantId],
  );
  await db.query("insert into chat_settings(tenant_id) values($1)", [tenantId]);
  for (const role of ["owner_admin", "manager", "viewer", "finance"])
    await db.query(
      "insert into tenant_users(tenant_id,clerk_user_id,email,display_name,role,status) values($1,$2,$3,$2,$4,'active')",
      [tenantId, "voice-" + role, role + "@example.invalid", role],
    );
  const brand = (
    await db.query(
      "insert into chat_brands(tenant_id,name,slug,persona_name) values($1,'Voice brand','voice','Demo') returning id",
      [tenantId],
    )
  ).rows[0].id;
  const workspaceId = (
    await db.query(
      "insert into chat_workspaces(tenant_id,chatwoot_base_url,chatwoot_account_id,workspace_key,webhook_secret_hash,api_token_enc,status) values($1,'https://chat.example.invalid',$2,$3,$4,'gcm1.v1.fixture','active') returning id",
      [tenantId, 901 + index, randomUUID().replaceAll("-", ""), "a".repeat(64)],
    )
  ).rows[0].id;
  const channelId = (
    await db.query(
      "insert into chat_channels(tenant_id,workspace_id,brand_id,chatwoot_inbox_id,kind,name) values($1,$2,$3,20,'website','Voice QA') returning id",
      [tenantId, workspaceId, brand],
    )
  ).rows[0].id;
  let pack = JSON.parse(
    readFileSync(
      new URL(
        "../../docs_chat/examples/new-business.pack.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  if(transformPack)pack=transformPack(pack);
  await db.query(
    "insert into chat_knowledge_packs(tenant_id,brand_id,version,status,pack_json) values($1,$2,1,'published',$3)",
    [tenantId, brand, pack],
  );
  const context = {
    tenantId,
    actor: { type: "WEBHOOK", id: "chatwoot" },
    source: "WEBHOOK",
    correlationId: "voice-test",
  };
  const captured = (
    await db.query("select chat_capture($1::jsonb,'agent',$2::jsonb) result", [
      JSON.stringify(context),
      JSON.stringify({
        workspaceId,
        secretHash: "a".repeat(64),
        channelId,
        identity: {
          displayName: "Synthetic voice",
          sourceId: "voice-" + index,
        },
        message: {
          messageId: 20,
          accountId: 901 + index,
          inboxId: 20,
          conversationId: 21,
          contactId: 22,
          status: "open",
          channelKind: "website",
          author: "customer",
          private: false,
          content: null,
          contentType: "text",
          attachments: [
            {
              id: 30,
              file_type: "audio",
              data_url: "http://169.254.169.254/never-fetch",
            },
          ],
          staffUserId: null,
          createdAt: new Date(Date.now()-ageHours*3600000).toISOString(),
        },
      }),
    ])
  ).rows[0].result;
  const scope = {
    workspaceId,
    secretHash: "a".repeat(64),
    channelId,
    conversationId: captured.conversationId,
    triggerMessageId: captured.messageId,
  };
  return {
    tenantId,
    context,
    scope,
    pack,
    brand,
    owner: {
      tenantId,
      actor: { type: "USER", id: "voice-owner_admin" },
      source: "OS_PLUS_UI",
      correlationId: "voice-owner",
      idempotencyKey: randomUUID(),
    },
  };
}
