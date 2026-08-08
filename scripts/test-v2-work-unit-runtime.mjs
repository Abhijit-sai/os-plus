import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const runtimeMigration = readText("supabase/migrations/20260706110000_v2_phase_2_work_unit_runtime.sql");
const transitionMigration = readText("supabase/migrations/20260706113000_v2_phase_2_work_unit_stage_transitions.sql");
const creationMigration = readText("supabase/migrations/20260706120000_v2_phase_2_work_unit_runtime_creation.sql");
const workUnitInstances = readText("src/features/work-units/instances.ts");
const workUnitQueries = readText("src/features/work-units/queries.ts");
const workUnitSmoke = readText("scripts/smoke-v2-work-unit-runtime.mjs");
const packageJson = JSON.parse(readText("package.json"));

assert.match(creationMigration, /create or replace function create_work_unit_runtime/i);
assert.match(creationMigration, /for update/i);
assert.match(creationMigration, /ORDER_NOT_WORK_UNIT_RUNTIME/i);
assert.match(creationMigration, /ORDER_VERTICAL_MISMATCH/i);
assert.match(creationMigration, /TENANT_VERTICAL_NOT_ENABLED/i);
assert.match(creationMigration, /insert into order_lines/i);
assert.match(creationMigration, /insert into work_units/i);
assert.match(creationMigration, /initialize_work_unit_workflow\(p_tenant_id, v_work_unit_id, p_actor\)/i);
assert.match(creationMigration, /jsonb_build_object\([\s\S]*order_line_id[\s\S]*work_unit_id[\s\S]*workflow_instance_id/i);

assert.match(runtimeMigration, /runtime_model = coalesce\(runtime_model, 'legacy_item_v1'\)/i);
assert.match(runtimeMigration, /orders_runtime_model_check[\s\S]*legacy_item_v1[\s\S]*work_unit_v2/i);
assert.match(runtimeMigration, /constraint work_units_order_tenant_fkey[\s\S]*references orders\(tenant_id, id\)/i);
assert.match(runtimeMigration, /constraint work_units_workflow_tenant_fkey[\s\S]*references workflows\(tenant_id, id\)/i);

assert.match(transitionMigration, /create or replace function start_work_unit_stage/i);
assert.match(transitionMigration, /create or replace function complete_work_unit_stage/i);
assert.match(transitionMigration, /WORKER_NOT_ALLOWED_FOR_STAGE/i);
assert.match(transitionMigration, /status = 'production_complete'/i);
assert.doesNotMatch(transitionMigration, /deliver|handoff/i);

assert.match(workUnitInstances, /createWorkUnitRuntime/);
assert.match(workUnitInstances, /create_work_unit_runtime/);
assert.match(workUnitInstances, /parseCreatedWorkUnitRuntime/);
assert.match(workUnitInstances, /initializeWorkUnitWorkflow/);
assert.match(workUnitInstances, /startWorkUnitStage/);
assert.match(workUnitInstances, /completeWorkUnitStage/);

assert.match(workUnitQueries, /getWorkUnitQueueData/);
assert.match(workUnitQueries, /getWorkUnitDetailData/);
assert.match(workUnitQueries, /requireTenantContext/);
assert.match(workUnitQueries, /\.eq\("tenant_id", context\.tenant\.id\)/);
assert.doesNotMatch(workUnitQueries, /from\("order_items"\)/);

assert.equal(packageJson.scripts["smoke:v2:work-units"], "node scripts/smoke-v2-work-unit-runtime.mjs");
assert.match(workUnitSmoke, /OS_PLUS_V2_DB_SMOKE !== "1"/);
assert.match(workUnitSmoke, /create_work_unit_runtime/);
assert.match(workUnitSmoke, /start_work_unit_stage/);
assert.match(workUnitSmoke, /complete_work_unit_stage/);
assert.match(workUnitSmoke, /production_complete/);
assert.match(workUnitSmoke, /await cleanup\(\)/);

console.log("V2 Work Unit runtime tests passed");
