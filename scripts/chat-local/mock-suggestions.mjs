import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { connect, verifyContainer, runtime } from "./common.mjs";

/** Explicit local demonstration only; inherited production flags/keys never enter this mode. */
export function mockSuggestionEnvironment(enabled, env) {
  if (!enabled) return {};
  if (
    env.CHATWOOT_BASE_URL !== "https://localhost:4444" ||
    env.CHATWOOT_BROWSER_ORIGIN !== "http://localhost:4141" ||
    env.CHAT_WEBHOOK_ORIGIN !== "https://osplus-bridge"
  )
    throw Error("Mock suggestions require the owned local Chatwoot launch.");
  return {
    CHAT_AGENT_ENABLED: "true",
    CHAT_AGENT_MODEL_MODE: "mock",
    CHAT_DRAFT_DELIVERY_ENABLED: "true",
    CHAT_MODEL_LIVE_ENABLED: "false",
    CHAT_MODEL_UNDERSTAND: "",
    CHAT_MODEL_CLASSIFY: "",
    CHAT_MODEL_WRITE: "",
    CHAT_MODEL_PROVIDER: "",
    OPENROUTER_API_KEY: "",
  };
}

/** Synthetic fixture command. Exact owned DB/tenants only; update and audit are atomic/idempotent. */
export async function enableOwnedMockSuggestions(local) {
  await verifyContainer(local, "db");
  const db = await connect(local);
  try {
    await db.query("begin");
    const tenantIds = [1, 2].map(
      (n) => "81000000-0000-4000-8000-" + String(n).padStart(12, "0"),
    );
    const rows = (
      await db.query(
        "select t.id,t.name,m.id module_id,m.config_json from tenants t join tenant_modules m on m.tenant_id=t.id and m.module_key='chat_leads' and m.is_enabled where t.id=any($1::uuid[]) and t.status='active' order by t.id for update of m",
        [tenantIds],
      )
    ).rows;
    assert.equal(
      rows.length,
      2,
      "Both existing synthetic tenants must be active",
    );
    for (const [index, row] of rows.entries()) {
      assert.equal(row.id, tenantIds[index]);
      assert.equal(row.name, index ? "Local QA B" : "Local QA A");
      const eligible = await db.query(
        "select 1 from chat_workspaces w join chat_channels c on c.tenant_id=w.tenant_id and c.workspace_id=w.id join chat_knowledge_packs k on k.tenant_id=c.tenant_id and k.brand_id=c.brand_id and k.status='published' where w.tenant_id=$1 and w.chatwoot_base_url='https://localhost:4444' and w.chatwoot_account_id=$2 and w.status='active' and c.chatwoot_inbox_id=$2 and c.is_active and c.agent_mode='draft'",
        [row.id, 901 + index],
      );
      assert.ok(
        eligible.rowCount,
        "Local synthetic draft channel must have a published pack",
      );
    }
    await writeFile(
      path.join(runtime, "mock-suggestions-before.private.json"),
      JSON.stringify(rows),
      { flag: "wx", mode: 0o600 },
    ).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    let changed = 0;
    for (const row of rows) {
      if (row.config_json?.agentEnabled === true) continue;
      const correlationId = randomUUID();
      await db.query(
        "update tenant_modules set config_json=config_json||'{\"agentEnabled\":true}'::jsonb,updated_by='local-mock-qa',updated_at=now() where tenant_id=$1 and module_key='chat_leads'",
        [row.id],
      );
      await db.query(
        "insert into domain_events(tenant_id,event_type,aggregate_type,aggregate_id,actor_type,actor_id,source,correlation_id,payload_json) values($1,'chat.local_mock.enabled','tenant_module',$2,'SYSTEM','local-mock-qa','API',$3,'{\"mockOnly\":true,\"localOnly\":true}'::jsonb)",
        [row.id, row.module_id, correlationId],
      );
      changed++;
    }
    await db.query("commit");
    return { tenants: rows.length, changed, mockOnly: true };
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}
