import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnvFile(relativePath) {
  const envPath = path.join(root, relativePath);

  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

loadEnvFile(".env.local");

if (process.env.OS_PLUS_V2_DB_SMOKE !== "1") {
  console.log("V2 command/event/task DB smoke skipped. Set OS_PLUS_V2_DB_SMOKE=1 to run it.");
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const actor = "v2_command_smoke";
const actorType = "SYSTEM";
const source = "AUTOMATION";
const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
const created = {
  tasks: [],
  teams: []
};

async function single(label, query) {
  const result = await query;

  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data;
}

async function maybeSingle(label, query) {
  const result = await query;

  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

async function expectRpcError(label, query, expectedMessage) {
  const result = await query;

  assert.ok(result.error, `${label} should fail`);
  assert.match(result.error.message, expectedMessage);
}

async function softDelete(tableName, ids) {
  if (!ids.length) {
    return;
  }

  const result = await supabase
    .from(tableName)
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: actor
    })
    .in("id", ids);

  if (result.error) {
    throw new Error(`Cleanup ${tableName}: ${result.error.message}`);
  }
}

async function cleanup() {
  await softDelete("tasks", created.tasks);
  await softDelete("teams", created.teams);
}

function assertCommandResult(value, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must return an object`);
  assert.ok(Array.isArray(value.event_ids), `${label} must return event_ids`);
  assert.ok(value.event_ids.every((eventId) => typeof eventId === "string"), `${label} event_ids must be strings`);
  return value;
}

async function getEvent(eventId, tenantId) {
  return single(
    "Load domain event",
    supabase.from("domain_events").select("*").eq("tenant_id", tenantId).eq("id", eventId).single()
  );
}

try {
  const tenant = await maybeSingle(
    "Load active tenant",
    supabase.from("tenants").select("id, slug").eq("status", "active").limit(1).maybeSingle()
  );
  assert.ok(tenant, "At least one active tenant is required for V2-3 smoke.");

  const foreignTenant = await maybeSingle(
    "Load foreign active tenant",
    supabase.from("tenants").select("id, slug").neq("id", tenant.id).eq("status", "active").limit(1).maybeSingle()
  );
  assert.ok(foreignTenant, "V2-3 tenant isolation smoke requires a second active tenant.");

  const team = await single(
    "Create smoke team",
    supabase
      .from("teams")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Command Smoke Team ${suffix}`,
        code: `CMD-${suffix}`,
        description: "Temporary V2 command smoke team.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.teams.push(team.id);

  const idempotencyKey = `create-task-${suffix}`;
  const title = `V2 Command Smoke ${suffix}`;
  const createArgs = {
    p_tenant_id: tenant.id,
    p_actor_type: actorType,
    p_actor_id: actor,
    p_source: source,
    p_correlation_id: `corr-create-${suffix}`,
    p_idempotency_key: idempotencyKey,
    p_task_type: "GENERAL",
    p_title: title,
    p_description: "Temporary V2 command smoke task.",
    p_subject_type: "general",
    p_subject_id: crypto.randomUUID(),
    p_assigned_team_id: team.id,
    p_priority: "HIGH",
    p_due_at: null,
    p_source_event_id: null
  };

  const createResult = assertCommandResult(
    await single("Create task command", supabase.rpc("create_task_command", createArgs)),
    "CreateTask"
  );
  created.tasks.push(createResult.task_id);
  assert.equal(createResult.status, "ASSIGNED");

  const repeatCreateResult = assertCommandResult(
    await single("Repeat idempotent create task command", supabase.rpc("create_task_command", createArgs)),
    "CreateTask repeat"
  );
  assert.equal(repeatCreateResult.task_id, createResult.task_id, "Idempotent repeat should return the original task.");
  assert.deepEqual(repeatCreateResult.event_ids, createResult.event_ids, "Idempotent repeat should return original event ids.");

  const duplicateTasks = await single(
    "Verify no duplicate task was created",
    supabase
      .from("tasks")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("title", title)
      .is("deleted_at", null)
  );
  assert.equal(duplicateTasks.length, 1, "Idempotent repeat must not create a duplicate task.");

  await expectRpcError(
    "Reuse idempotency key with different payload",
    supabase.rpc("create_task_command", {
      ...createArgs,
      p_title: `${title} changed`
    }),
    /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/
  );

  const createdEvent = await getEvent(createResult.event_ids[0], tenant.id);
  assert.equal(createdEvent.event_type, "task.created");
  assert.equal(createdEvent.actor_type, actorType);
  assert.equal(createdEvent.actor_id, actor);
  assert.equal(createdEvent.source, source);
  assert.equal(createdEvent.correlation_id, createArgs.p_correlation_id);

  const createHistory = await single(
    "Verify task create history",
    supabase
      .from("task_history")
      .select("id, event_type, actor_type, actor_id, source")
      .eq("tenant_id", tenant.id)
      .eq("task_id", createResult.task_id)
      .eq("event_type", "task_created")
  );
  assert.equal(createHistory.length, 1);
  assert.equal(createHistory[0].actor_type, actorType);
  assert.equal(createHistory[0].source, source);

  const assignResult = assertCommandResult(
    await single(
      "Assign task command",
      supabase.rpc("assign_task_command", {
        p_tenant_id: tenant.id,
        p_actor_type: actorType,
        p_actor_id: actor,
        p_source: source,
        p_correlation_id: `corr-assign-${suffix}`,
        p_idempotency_key: `assign-task-${suffix}`,
        p_task_id: createResult.task_id,
        p_assigned_team_id: team.id,
        p_notes: "Smoke assignment."
      })
    ),
    "AssignTask"
  );
  assert.equal(assignResult.status, "ASSIGNED");

  const startResult = assertCommandResult(
    await single(
      "Start task command",
      supabase.rpc("start_task_command", {
        p_tenant_id: tenant.id,
        p_actor_type: actorType,
        p_actor_id: actor,
        p_source: source,
        p_correlation_id: `corr-start-${suffix}`,
        p_idempotency_key: `start-task-${suffix}`,
        p_task_id: createResult.task_id,
        p_notes: "Smoke start."
      })
    ),
    "StartTask"
  );
  assert.equal(startResult.status, "IN_PROGRESS");

  const completeResult = assertCommandResult(
    await single(
      "Complete task command",
      supabase.rpc("complete_task_command", {
        p_tenant_id: tenant.id,
        p_actor_type: actorType,
        p_actor_id: actor,
        p_source: source,
        p_correlation_id: `corr-complete-${suffix}`,
        p_idempotency_key: `complete-task-${suffix}`,
        p_task_id: createResult.task_id,
        p_notes: "Smoke complete."
      })
    ),
    "CompleteTask"
  );
  assert.equal(completeResult.status, "COMPLETED");

  const finalTask = await single(
    "Verify completed task",
    supabase
      .from("tasks")
      .select("status, assigned_team_id, started_at, completed_at")
      .eq("tenant_id", tenant.id)
      .eq("id", createResult.task_id)
      .single()
  );
  assert.equal(finalTask.status, "COMPLETED");
  assert.equal(finalTask.assigned_team_id, team.id);
  assert.ok(finalTask.started_at);
  assert.ok(finalTask.completed_at);

  const historyRows = await single(
    "Verify task history rows",
    supabase
      .from("task_history")
      .select("event_type")
      .eq("tenant_id", tenant.id)
      .eq("task_id", createResult.task_id)
  );
  const historyTypes = new Set(historyRows.map((row) => row.event_type));
  for (const expectedHistory of ["task_created", "task_assigned", "task_started", "task_completed"]) {
    assert.ok(historyTypes.has(expectedHistory), `Missing ${expectedHistory} history.`);
  }

  await expectRpcError(
    "Cross-tenant task mutation rejected",
    supabase.rpc("start_task_command", {
      p_tenant_id: foreignTenant.id,
      p_actor_type: actorType,
      p_actor_id: actor,
      p_source: source,
      p_correlation_id: `corr-cross-${suffix}`,
      p_idempotency_key: `cross-task-${suffix}`,
      p_task_id: createResult.task_id,
      p_notes: "Wrong tenant should fail."
    }),
    /TASK_NOT_FOUND/
  );

  const eventCountBeforeFailedCommand = await single(
    "Count task.created events before failed command",
    supabase
      .from("domain_events")
      .select("id", { count: "exact", head: false })
      .eq("tenant_id", tenant.id)
      .eq("event_type", "task.created")
      .eq("correlation_id", `corr-fail-${suffix}`)
  );
  assert.equal(eventCountBeforeFailedCommand.length, 0);

  await expectRpcError(
    "Atomic rollback/no event on failed CreateTask",
    supabase.rpc("create_task_command", {
      p_tenant_id: tenant.id,
      p_actor_type: actorType,
      p_actor_id: actor,
      p_source: source,
      p_correlation_id: `corr-fail-${suffix}`,
      p_idempotency_key: `failed-create-${suffix}`,
      p_task_type: "GENERAL",
      p_title: `V2 Failed Command Smoke ${suffix}`,
      p_description: "This should roll back.",
      p_subject_type: "general",
      p_subject_id: crypto.randomUUID(),
      p_assigned_team_id: crypto.randomUUID(),
      p_priority: "NORMAL",
      p_due_at: null,
      p_source_event_id: null
    }),
    /ASSIGNED_TEAM_NOT_FOUND/
  );

  const failedTaskRows = await single(
    "Verify failed command did not create task",
    supabase
      .from("tasks")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("title", `V2 Failed Command Smoke ${suffix}`)
      .is("deleted_at", null)
  );
  assert.equal(failedTaskRows.length, 0);

  const failedEventRows = await single(
    "Verify failed command did not create event",
    supabase
      .from("domain_events")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("correlation_id", `corr-fail-${suffix}`)
  );
  assert.equal(failedEventRows.length, 0);

  await cleanup();

  console.log(
    [
      `V2 command/event/task DB smoke passed for tenant ${tenant.slug};`,
      `idempotency reused task ${createResult.task_id};`,
      `events ${[
        ...createResult.event_ids,
        ...assignResult.event_ids,
        ...startResult.event_ids,
        ...completeResult.event_ids
      ].length};`,
      `cross-tenant rejected ${foreignTenant.slug}.`
    ].join(" ")
  );
} catch (error) {
  await cleanup().catch((cleanupError) => {
    console.error(`Cleanup failed: ${cleanupError.message}`);
  });
  throw error;
}
