import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    process.env[trimmed.slice(0, separator).trim()] ??= trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

if (process.env.OS_PLUS_WORKFLOW_STAGE_DB_SMOKE !== "1") {
  console.log("Workflow-stage concurrency DB smoke skipped. Set OS_PLUS_WORKFLOW_STAGE_DB_SMOKE=1 only for an approved disposable QA database.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase QA credentials.");

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const actor = "codex-workflow-stage-smoke";
const marker = `workflow-stage-race-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const workflowIds = [];
const stageIds = [];

async function one(label, request) {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

try {
  const tenants = await one("Load QA tenant", supabase.from("tenants").select("id").eq("status", "active").limit(1));
  assert.equal(tenants.length, 1, "One active QA tenant is required.");
  const tenantId = tenants[0].id;

  // Repeating independent pairs makes the previously unlocked interleaving
  // observable while keeping every test record isolated and self-cleaning.
  for (let index = 0; index < 12; index += 1) {
    const [stage] = await one("Create isolated stage", supabase.from("stage_master").insert({
      tenant_id: tenantId,
      name: `${marker}-stage-${index}`,
      is_active: true,
      created_by: actor,
      updated_by: actor,
    }).select("id"));
    stageIds.push(stage.id);

    const [workflow] = await one("Create isolated inactive workflow", supabase.from("workflows").insert({
      tenant_id: tenantId,
      name: `${marker}-workflow-${index}`,
      is_active: false,
      created_by: actor,
      updated_by: actor,
    }).select("id"));
    workflowIds.push(workflow.id);

    await one("Attach sole stage", supabase.from("workflow_stages").insert({
      tenant_id: tenantId,
      workflow_id: workflow.id,
      stage_master_id: stage.id,
      sequence_number: 1,
      created_by: actor,
      updated_by: actor,
    }));

    const [activation, deactivation] = await Promise.all([
      supabase.rpc("update_workflow_configuration", {
        p_tenant_id: tenantId,
        p_workflow_id: workflow.id,
        p_name: `${marker}-workflow-${index}`,
        p_description: null,
        p_item_type_id: null,
        p_is_default: false,
        p_is_active: true,
        p_actor_id: actor,
      }),
      supabase.rpc("update_stage_configuration", {
        p_tenant_id: tenantId,
        p_stage_id: stage.id,
        p_name: `${marker}-stage-${index}`,
        p_description: null,
        p_is_active: false,
        p_actor_id: actor,
      }),
    ]);

    assert.equal(Number(!activation.error) + Number(!deactivation.error), 1, "Exactly one conflicting state change must commit.");
    const rejectedMessage = activation.error?.message ?? deactivation.error?.message ?? "";
    assert.match(rejectedMessage, /STAGE_REQUIRED_BY_ACTIVE_WORKFLOW|ACTIVE_WORKFLOW_REQUIRES_ACTIVE_STAGE/);

    const [savedWorkflow, savedStage] = await Promise.all([
      one("Reload workflow", supabase.from("workflows").select("is_active").eq("tenant_id", tenantId).eq("id", workflow.id).single()),
      one("Reload stage", supabase.from("stage_master").select("is_active").eq("tenant_id", tenantId).eq("id", stage.id).single()),
    ]);
    assert.ok(!(savedWorkflow.is_active && !savedStage.is_active), "An active workflow may not retain only an inactive stage.");
  }

  console.log("Workflow activation versus last-stage deactivation concurrency smoke passed.");
} finally {
  const cleanupErrors = [];
  if (workflowIds.length > 0) {
    const { error } = await supabase.from("workflows").delete().in("id", workflowIds);
    if (error) cleanupErrors.push(new Error(`Delete smoke workflows: ${error.message}`));
  }
  if (stageIds.length > 0) {
    const { error } = await supabase.from("stage_master").delete().in("id", stageIds);
    if (error) cleanupErrors.push(new Error(`Delete smoke stages: ${error.message}`));
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Workflow-stage smoke cleanup was incomplete.");
  }
}
