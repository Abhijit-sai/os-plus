import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const migration = readText("supabase/migrations/20260706130000_v2_phase_3_commands_events_tasks.sql");
const packageJson = JSON.parse(readText("package.json"));
const databaseTypes = readText("src/types/database.ts");
const taskActions = readText("src/features/tasks/actions.ts");
const taskQueries = readText("src/features/tasks/queries.ts");
const taskPage = readText("src/app/(tenant)/tasks/page.tsx");
const taskQueueClient = readText("src/features/tasks/task-queue-client.tsx");
const workUnitCommands = readText("src/features/work-units/commands.ts");
const commandSmoke = readText("scripts/smoke-v2-commands-events-tasks.mjs");
const commandContext = readText("src/core/command-context/types.ts");
const commandContextServer = readText("src/core/command-context/server.ts");
const commandResult = readText("src/core/commands/result.ts");
const clientCommandKey = readText("src/core/idempotency/client-command-key.ts");
const securityMigration = readText("supabase/migrations/20260707110000_v2_rpc_security_and_custody_integrity.sql");

const requiredTables = ["command_idempotency", "domain_events", "tasks", "task_history"];

for (const tableName of requiredTables) {
  const createTablePattern = new RegExp(`create\\s+table\\s+${tableName}\\b`, "i");
  assert.match(migration, createTablePattern, `${tableName} must be created in V2-3`);
  assert.match(databaseTypes, new RegExp(`${tableName}: \\{`, "i"), `${tableName} must be represented in database types`);
}

assert.match(migration, /command_idempotency_tenant_command_key_unique[\s\S]*unique \(tenant_id, command_type, idempotency_key\)/i);
assert.match(migration, /status text not null default 'processing'/i);
assert.match(migration, /if v_existing\.status = 'completed' then[\s\S]*return v_existing\.result_json/i);
assert.match(migration, /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/i);
assert.match(migration, /COMMAND_ALREADY_PROCESSING/i);

assert.match(migration, /create trigger domain_events_append_only_update/i);
assert.match(migration, /create trigger domain_events_append_only_delete/i);
assert.match(migration, /DOMAIN_EVENTS_ARE_APPEND_ONLY/i);
assert.match(migration, /event_type text not null/i);
assert.match(migration, /actor_type text not null/i);
assert.match(migration, /source text not null/i);
assert.match(migration, /correlation_id text not null/i);

const commandFunctions = [
  "create_task_command",
  "assign_task_command",
  "start_task_command",
  "complete_task_command",
  "cancel_task_command",
  "start_work_unit_stage_command",
  "complete_work_unit_stage_command"
];

for (const functionName of commandFunctions) {
  assert.match(migration, new RegExp(`create or replace function ${functionName}`, "i"), `${functionName} must be implemented as an RPC`);
  assert.match(databaseTypes, new RegExp(`${functionName}: \\{`, "i"), `${functionName} must be in generated database types`);
}

assert.match(migration, /from tasks[\s\S]*where tenant_id = p_tenant_id[\s\S]*and id = p_task_id[\s\S]*for update/i);
assert.match(migration, /from work_unit_stage_instances[\s\S]*where tenant_id = p_tenant_id[\s\S]*and id = p_stage_instance_id/i);
assert.match(migration, /TASK_NOT_FOUND/i);
assert.match(migration, /WORK_UNIT_STAGE_NOT_FOUND/i);
assert.match(migration, /ASSIGNED_USER_NOT_FOUND/i);
assert.match(migration, /ASSIGNED_TEAM_NOT_FOUND/i);
assert.match(migration, /foreign key \(tenant_id, assigned_user_id\)[\s\S]*references tenant_users\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, assigned_team_id\)[\s\S]*references teams\(tenant_id, id\)/i);

assert.match(migration, /insert into domain_events[\s\S]*'task\.created'/i);
assert.match(migration, /insert into domain_events[\s\S]*'task\.assigned'/i);
assert.match(migration, /insert into domain_events[\s\S]*'task\.started'/i);
assert.match(migration, /insert into domain_events[\s\S]*'task\.completed'/i);
assert.match(migration, /insert into domain_events[\s\S]*'task\.cancelled'/i);
assert.match(migration, /insert into domain_events[\s\S]*'work_unit\.stage_started'/i);
assert.match(migration, /insert into domain_events[\s\S]*'work_unit\.stage_completed'/i);
assert.match(migration, /insert into task_history[\s\S]*'task_created'/i);
assert.match(migration, /insert into task_history[\s\S]*'task_assigned'/i);
assert.match(migration, /insert into task_history[\s\S]*'task_completed'/i);

assert.match(migration, /select start_work_unit_stage\(p_tenant_id, p_stage_instance_id, p_worker_id, p_actor_id, p_notes\)/i);
assert.match(migration, /select complete_work_unit_stage\(p_tenant_id, p_stage_instance_id, p_actor_id, p_notes\)/i);
assert.doesNotMatch(migration, /event_outbox/i);

assert.match(commandContext, /tenantId: string/);
assert.match(commandContext, /correlationId: string/);
assert.match(commandContext, /idempotencyKey\?: string/);
assert.match(commandContextServer, /createUserCommandContext/);
assert.match(commandContextServer, /crypto\.randomUUID\(\)/);
assert.match(taskQueueClient, /getOrCreateCommandKey/);
assert.match(taskQueueClient, /pendingCommandRef\.current/);
assert.doesNotMatch(taskQueueClient, /function newIdempotencyKey/);
assert.match(clientCommandKey, /fingerprintCommandForm/);
assert.match(clientCommandKey, /existing\?\.fingerprint === fingerprint/);
assert.match(clientCommandKey, /pendingKeys\.set\(commandName/);
assert.match(securityMigration, /revoke all on function %s from public/i);
assert.match(securityMigration, /revoke all on function %s from authenticated/i);
assert.match(securityMigration, /grant execute on function %s to service_role/i);
assert.match(commandResult, /CommandResult/);

assert.match(taskActions, /create_task_command/);
assert.match(taskActions, /assign_task_command/);
assert.match(taskActions, /start_task_command/);
assert.match(taskActions, /complete_task_command/);
assert.match(taskActions, /cancel_task_command/);
assert.match(taskActions, /assertPermission\(context\.membership\.role, "tasks:manage"\)/);
assert.match(taskActions, /assertTenantVertical\(context, "laundry"\)/);
assert.match(taskActions, /createUserCommandContext/);
assert.doesNotMatch(taskActions, /Promise\.all/);

assert.match(taskQueries, /requireTenantRoutePermission\("tasks:view"\)/);
assert.match(taskQueries, /assertTenantVertical\(context, "laundry"\)/);
assert.match(taskQueries, /\.from\("tasks"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(taskQueries, /\.from\("tenant_users"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(taskQueries, /\.from\("teams"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)/);

assert.match(taskPage, /getTaskQueueData/);
assert.match(taskPage, /TaskQueueClient/);
assert.match(taskPage, /TenantVerticalUnavailableError/);
assert.match(taskPage, /notFound\(\)/);
assert.match(taskQueueClient, /"use client"/);
assert.match(taskQueueClient, /Task queue/);
assert.match(taskQueueClient, /createTaskAction/);
assert.match(taskQueueClient, /assignTaskAction/);
assert.match(taskQueueClient, /startTaskAction/);
assert.match(taskQueueClient, /completeTaskAction/);
assert.match(taskQueueClient, /cancelTaskAction/);
assert.match(taskQueueClient, /router\.refresh\(\)/);

assert.match(workUnitCommands, /start_work_unit_stage_command/);
assert.match(workUnitCommands, /complete_work_unit_stage_command/);
assert.match(workUnitCommands, /CommandContext/);
assert.match(workUnitCommands, /CommandResult/);

assert.equal(packageJson.scripts["smoke:v2:commands"], "node scripts/smoke-v2-commands-events-tasks.mjs");
assert.match(commandSmoke, /OS_PLUS_V2_DB_SMOKE !== "1"/);
assert.match(commandSmoke, /create_task_command/);
assert.match(commandSmoke, /assign_task_command/);
assert.match(commandSmoke, /start_task_command/);
assert.match(commandSmoke, /complete_task_command/);
assert.match(commandSmoke, /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/);
assert.match(commandSmoke, /TASK_NOT_FOUND/);
assert.match(commandSmoke, /ASSIGNED_TEAM_NOT_FOUND/);
assert.match(commandSmoke, /domain_events/);
assert.match(commandSmoke, /task_history/);

assert.equal(
  packageJson.scripts["test:v2"],
  "node scripts/test-v2-baseline.mjs && node scripts/test-v2-work-unit-runtime.mjs && node scripts/test-v2-phase-3-commands-events-tasks.mjs && node scripts/test-v2-phase-4-laundry-custody.mjs"
);

console.log("V2-3 command, event, idempotency, and task tests passed");
