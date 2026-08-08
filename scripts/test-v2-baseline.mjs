import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assertFile(relativePath) {
  assert.equal(
    fs.existsSync(path.join(root, relativePath)),
    true,
    `${relativePath} must exist`,
  );
}

const requiredV2Docs = [
  "docs_v2/00_README_V2.md",
  "docs_v2/01_PRD.md",
  "docs_v2/02_WBS.md",
  "docs_v2/03_Tech_Development_Plan.md",
  "docs_v2/06_Rules.md",
  "docs_v2/07_Database_Delta_Model.md",
  "docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md",
  "docs_v2/13_Project_Summary_Update_Protocol.md",
  "docs_v2/14_Migration_and_Compatibility_Map.md",
  "docs_v2/15_V2_Decision_Log.md",
  "docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx",
];

for (const docPath of requiredV2Docs) {
  assertFile(docPath);
}

const packageJson = readJson("package.json");

assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
assert.equal(packageJson.scripts.lint, "eslint");
assert.equal(packageJson.scripts.build, "next build");
assert.equal(packageJson.scripts["test:roles"], "node scripts/test-role-route-policy.mjs");
assert.equal(
  packageJson.scripts["test:v2"],
  "node scripts/test-v2-baseline.mjs && node scripts/test-v2-work-unit-runtime.mjs && node scripts/test-v2-phase-3-commands-events-tasks.mjs && node scripts/test-v2-phase-4-laundry-custody.mjs",
);

const projectSummary = readText("project_summary.md");
assert.match(projectSummary, /V2-0 - Baseline, Documentation and Compatibility Gate/);
assert.match(projectSummary, /V2-1 - Vertical Context, Locations, Addresses and Teams/);
assert.match(projectSummary, /V2-2 - Commercial Lines and Parallel Work Unit Runtime/);
assert.match(projectSummary, /### Phase Status\s+[\s\S]*?(PLANNED|IN_PROGRESS|READY_FOR_CLOSURE|CLOSED)/);
assert.match(projectSummary, /Boutique compatibility/i);

const readme = readText("docs_v2/00_README_V2.md");
assert.match(readme, /Start with V2 Phase 0/);
assert.match(readme, /Do not use `\/docs\/05_Project_Summary\.md`/);

const wbs = readText("docs_v2/02_WBS.md");
assert.match(wbs, /## V2-0 Baseline, Documentation and Compatibility Gate/);
assert.match(wbs, /## V2-1 Vertical Context, Locations, Addresses and Teams/);
assert.match(wbs, /## V2-2 V2 Commercial Lines and Parallel Work Unit Runtime/);
assert.match(wbs, /## V2-3 Commands, Domain Events, Idempotency and Tasks/);
assert.match(wbs, /No V2 domain schema is introduced before baseline evidence exists/);

const rules = readText("docs_v2/06_Rules.md");
assert.match(rules, /Existing live Boutique behaviour is a protected compatibility contract/);
assert.match(rules, /Never hardcode a tenant slug\/name such as `fundry`/);

const compatibilityMap = readText("docs_v2/14_Migration_and_Compatibility_Map.md");
assert.match(compatibilityMap, /legacy_item_v1/);
assert.match(compatibilityMap, /work_unit_v2/);
assert.match(compatibilityMap, /Do not automatically switch new Boutique orders to Work Unit V2/);

const tenantActions = readText("src/features/tenants/actions.ts");
const tenantDetailPage = readText("src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx");
const workUnitInstances = readText("src/features/work-units/instances.ts");
const workUnitQueries = readText("src/features/work-units/queries.ts");
assert.match(tenantActions, /updateTenantVerticalAction/);
assert.match(tenantActions, /vertical_definitions/);
assert.match(tenantActions, /tenant_verticals/);
assert.match(tenantDetailPage, /Vertical enablement/);
assert.doesNotMatch(tenantActions, /fundry/i);
assert.doesNotMatch(tenantDetailPage, /fundry/i);
assert.match(workUnitInstances, /initializeWorkUnitWorkflow/);
assert.match(workUnitInstances, /initialize_work_unit_workflow/);
assert.match(workUnitInstances, /createWorkUnitRuntime/);
assert.match(workUnitInstances, /create_work_unit_runtime/);
assert.match(workUnitInstances, /startWorkUnitStage/);
assert.match(workUnitInstances, /start_work_unit_stage/);
assert.match(workUnitInstances, /completeWorkUnitStage/);
assert.match(workUnitInstances, /complete_work_unit_stage/);
assert.match(workUnitQueries, /getWorkUnitQueueData/);
assert.match(workUnitQueries, /getWorkUnitDetailData/);
assert.match(workUnitQueries, /requireTenantContext/);
assert.match(workUnitQueries, /\.from\("work_units"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(workUnitQueries, /\.from\("work_unit_stage_instances"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(workUnitQueries, /\.from\("work_unit_stage_work_logs"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)/);
assert.doesNotMatch(workUnitQueries, /order_items/);

const migrationDir = path.join(root, "supabase/migrations");
const migrationSql = fs
  .readdirSync(migrationDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) => readText(path.join("supabase/migrations", fileName)))
  .join("\n\n");
const v2Phase2MigrationSql = [
  "supabase/migrations/20260706110000_v2_phase_2_work_unit_runtime.sql",
  "supabase/migrations/20260706113000_v2_phase_2_work_unit_stage_transitions.sql",
  "supabase/migrations/20260706120000_v2_phase_2_work_unit_runtime_creation.sql",
]
  .map((fileName) => readText(fileName))
  .join("\n\n");

const v2Phase1Tables = [
  "vertical_definitions",
  "tenant_verticals",
  "tenant_locations",
  "customer_addresses",
  "teams",
  "team_members",
];

for (const tableName of v2Phase1Tables) {
  const createTablePattern = new RegExp(
    `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${tableName}\\b`,
    "i",
  );
  assert.match(
    migrationSql,
    createTablePattern,
    `${tableName} must be introduced during V2-1 platform primitives`,
  );
}

assert.match(migrationSql, /'boutique'[\s\S]*'laundry'|'laundry'[\s\S]*'boutique'/i);
assert.match(migrationSql, /on conflict \(tenant_id, vertical_definition_id\)/i);
assert.match(migrationSql, /foreign key \(tenant_id, customer_id\)[\s\S]*references customers\(tenant_id, id\)/i);
assert.match(
  migrationSql,
  /constraint teams_location_tenant_fkey[\s\S]*foreign key \(tenant_id, location_id\)[\s\S]*references tenant_locations\(tenant_id, id\)[\s\S]*on delete restrict/i,
);
assert.match(migrationSql, /foreign key \(tenant_id, team_id\)[\s\S]*references teams\(tenant_id, id\)/i);
assert.match(migrationSql, /foreign key \(tenant_id, tenant_user_id\)[\s\S]*references tenant_users\(tenant_id, id\)/i);
assert.match(migrationSql, /comment on table tenant_verticals[\s\S]*Do not infer verticals from tenant slug/i);

const v2Phase2Tables = [
  "order_lines",
  "work_units",
  "work_unit_workflow_instances",
  "work_unit_stage_instances",
  "work_unit_stage_work_logs",
];

for (const tableName of v2Phase2Tables) {
  const createTablePattern = new RegExp(
    `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${tableName}\\b`,
    "i",
  );
  assert.match(
    migrationSql,
    createTablePattern,
    `${tableName} must be introduced during V2-2 work unit runtime`,
  );
}

assert.match(migrationSql, /alter table public\.orders[\s\S]*add column if not exists vertical_key text/i);
assert.match(migrationSql, /alter table public\.orders[\s\S]*add column if not exists runtime_model text/i);
assert.match(migrationSql, /vertical_key = coalesce\(vertical_key, 'boutique'\)/i);
assert.match(migrationSql, /runtime_model = coalesce\(runtime_model, 'legacy_item_v1'\)/i);
assert.match(migrationSql, /orders_runtime_model_check[\s\S]*legacy_item_v1[\s\S]*work_unit_v2/i);
assert.match(migrationSql, /constraint order_lines_order_tenant_fkey[\s\S]*foreign key \(tenant_id, order_id\)[\s\S]*references orders\(tenant_id, id\)/i);
assert.match(migrationSql, /constraint work_units_order_tenant_fkey[\s\S]*foreign key \(tenant_id, order_id\)[\s\S]*references orders\(tenant_id, id\)/i);
assert.match(migrationSql, /constraint work_units_workflow_tenant_fkey[\s\S]*foreign key \(tenant_id, workflow_id\)[\s\S]*references workflows\(tenant_id, id\)/i);
assert.match(migrationSql, /constraint work_unit_stage_instances_workflow_stage_tenant_fkey[\s\S]*references workflow_stages\(tenant_id, id\)/i);
assert.match(migrationSql, /constraint work_unit_stage_work_logs_worker_tenant_fkey[\s\S]*references workers\(tenant_id, id\)/i);
assert.match(migrationSql, /comment on table work_units[\s\S]*V2 operational production units/i);
assert.match(migrationSql, /create or replace function initialize_work_unit_workflow/i);
assert.match(migrationSql, /create or replace function create_work_unit_runtime/i);
assert.match(migrationSql, /ORDER_NOT_WORK_UNIT_RUNTIME/i);
assert.match(migrationSql, /TENANT_VERTICAL_NOT_ENABLED/i);
assert.match(migrationSql, /insert into order_lines/i);
assert.match(migrationSql, /insert into work_units/i);
assert.match(migrationSql, /for update/i);
assert.match(migrationSql, /WORKFLOW_HAS_NO_ACTIVE_STAGES/i);
assert.match(migrationSql, /current_stage_instance_id = v_first_stage_instance_id/i);
assert.match(migrationSql, /create or replace function start_work_unit_stage/i);
assert.match(migrationSql, /WORK_UNIT_STAGE_NOT_READY/i);
assert.match(migrationSql, /STAGE_HAS_NO_ALLOWED_WORKGROUPS/i);
assert.match(migrationSql, /WORKER_NOT_ALLOWED_FOR_STAGE/i);
assert.match(migrationSql, /create or replace function complete_work_unit_stage/i);
assert.match(migrationSql, /WORK_UNIT_STAGE_NOT_IN_PROGRESS/i);
assert.match(migrationSql, /status = 'production_complete'/i);
assert.match(migrationSql, /without inferring fulfilment/i);
assert.doesNotMatch(v2Phase2MigrationSql, /deliver|handoff/i);

const laterPhaseTables = [
  "invoices",
  "invoice_lines",
  "payments",
  "payment_allocations",
  "payment_intents",
];

for (const tableName of laterPhaseTables) {
  const createTablePattern = new RegExp(
    `create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+(?:public\\.)?${tableName}\\b`,
    "i",
  );
  assert.doesNotMatch(
    migrationSql,
    createTablePattern,
    `${tableName} must not be introduced during V2-1 platform primitives`,
  );
}

console.log("V2 baseline tests passed");
