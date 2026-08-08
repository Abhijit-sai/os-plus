import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const migration = readText("supabase/migrations/20260707100000_v2_phase_4_laundry_custody.sql");
const packageJson = JSON.parse(readText("package.json"));
const roles = readText("src/lib/permissions/roles.ts");
const appShell = readText("src/components/layout/app-shell.tsx");
const page = readText("src/app/(tenant)/laundry/custody/page.tsx");
const queries = readText("src/verticals/laundry/custody/queries.ts");
const actions = readText("src/verticals/laundry/custody/actions.ts");
const client = readText("src/verticals/laundry/custody/laundry-custody-client.tsx");
const smoke = readText("scripts/smoke-v2-laundry-custody.mjs");
const hardeningMigration = readText("supabase/migrations/20260707110000_v2_rpc_security_and_custody_integrity.sql");

const requiredTables = [
  "qr_identities",
  "laundry_service_catalog",
  "laundry_pickup_requests",
  "laundry_container_assets",
  "laundry_handling_units",
  "laundry_custody_events",
  "laundry_service_lots"
];

for (const tableName of requiredTables) {
  assert.match(migration, new RegExp(`create\\s+table\\s+${tableName}\\b`, "i"), `${tableName} must be created in V2-4`);
  assert.match(migration, new RegExp(`alter\\s+table\\s+${tableName}\\s+enable\\s+row\\s+level\\s+security`, "i"), `${tableName} must enable RLS`);
}

const commandFunctions = [
  "create_laundry_pickup_request_command",
  "create_laundry_container_asset_command",
  "complete_laundry_pickup_request_command",
  "create_laundry_service_lot_command"
];

for (const functionName of commandFunctions) {
  assert.match(migration, new RegExp(`create or replace function ${functionName}`, "i"), `${functionName} must be implemented as an RPC`);
  assert.match(migration, new RegExp(`v_command_type text := '[^']+'`, "i"), "V2-4 command RPCs must declare command type for idempotency");
}

assert.match(migration, /assert_laundry_vertical_enabled/i);
assert.match(migration, /TENANT_LAUNDRY_VERTICAL_NOT_ENABLED/);
assert.match(migration, /vertical_definitions\.key = 'laundry'/);

assert.match(migration, /constraint qr_identities_token_unique unique \(token\)/i);
assert.match(migration, /entity_type in \('laundry_container_asset', 'laundry_handling_unit'\)/i);
assert.match(migration, /generate_qr_identity_token/);
assert.match(migration, /gen_random_bytes\(24\)/);
assert.doesNotMatch(migration, /\/scan\/q\/\[/i);

assert.match(migration, /laundry_container_assets_tenant_code_active_idx/i);
assert.match(migration, /laundry_handling_units_tenant_code_active_idx/i);
assert.match(migration, /generate_laundry_human_code/);

assert.match(migration, /laundry_custody_events_append_only_update/i);
assert.match(migration, /laundry_custody_events_append_only_delete/i);
assert.match(migration, /LAUNDRY_CUSTODY_EVENTS_ARE_APPEND_ONLY/);
assert.match(migration, /insert into laundry_custody_events[\s\S]*'picked_up'/i);

assert.match(migration, /foreign key \(tenant_id, customer_id\)[\s\S]*references customers\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, pickup_address_id\)[\s\S]*references customer_addresses\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, assigned_user_id\)[\s\S]*references tenant_users\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, assigned_team_id\)[\s\S]*references teams\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, container_asset_id\)[\s\S]*references laundry_container_assets\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, handling_unit_id\)[\s\S]*references laundry_handling_units\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, work_unit_id\)[\s\S]*references work_units\(tenant_id, id\)/i);
assert.match(migration, /foreign key \(tenant_id, order_line_id\)[\s\S]*references order_lines\(tenant_id, id\)/i);

assert.match(migration, /from command_idempotency[\s\S]*tenant_id = p_tenant_id[\s\S]*command_type = v_command_type[\s\S]*idempotency_key = p_idempotency_key[\s\S]*for update/i);
assert.match(migration, /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/);
assert.match(migration, /COMMAND_ALREADY_PROCESSING/);
assert.match(migration, /if v_existing\.status = 'completed' then[\s\S]*return v_existing\.result_json/i);

assert.match(migration, /insert into domain_events[\s\S]*'pickup\.requested'/i);
assert.match(migration, /insert into domain_events[\s\S]*'pickup\.completed'/i);
assert.match(migration, /insert into domain_events[\s\S]*'handling_unit\.created'/i);
assert.match(migration, /insert into domain_events[\s\S]*'container_asset\.created'/i);
assert.match(migration, /insert into domain_events[\s\S]*'service_lot\.created'/i);

assert.match(migration, /select create_task_command\(/i);
assert.match(migration, /'PICKUP'/);
assert.match(migration, /'VERIFY_INTAKE'/);
assert.match(migration, /select initialize_work_unit_workflow\(p_tenant_id, v_work_unit_id, p_actor_id\)/i);
assert.match(migration, /ORDER_NOT_LAUNDRY_WORK_UNIT_RUNTIME/);
assert.match(migration, /ORDER_CUSTOMER_MISMATCH/);

assert.match(roles, /"laundry:view"/);
assert.match(roles, /"laundry:manage"/);
assert.match(appShell, /href:\s*"\/laundry\/custody"/);
assert.match(appShell, /vertical:\s*"laundry"/);
assert.match(appShell, /href:\s*"\/tasks"[\s\S]{0,180}vertical:\s*"laundry"/);
assert.match(page, /getLaundryCustodyData/);
assert.match(page, /LaundryCustodyClient/);

assert.match(queries, /assertPermission\(context\.membership\.role, "laundry:view"\)/);
assert.match(queries, /assertTenantVertical\(context, "laundry"\)/);
assert.match(queries, /\.from\("laundry_pickup_requests"\)/);
assert.match(queries, /\.from\("laundry_handling_units"\)/);
assert.match(queries, /\.from\("laundry_service_lots"\)/);
assert.match(queries, /\.from\("orders"\)[\s\S]*\.eq\("vertical_key", "laundry"\)[\s\S]*\.eq\("runtime_model", "work_unit_v2"\)/);

assert.match(actions, /createUserCommandContext/);
assert.match(actions, /normalizeIdempotencyKey/);
assert.match(actions, /assertPermission\(context\.membership\.role, "laundry:manage"\)/);
assert.match(actions, /assertTenantVertical\(context, "laundry"\)/);
assert.match(actions, /rpc\("create_laundry_pickup_request_command"/);
assert.match(actions, /rpc\("complete_laundry_pickup_request_command"/);
assert.match(actions, /rpc\("create_laundry_container_asset_command"/);
assert.match(actions, /rpc\("create_laundry_service_lot_command"/);
assert.match(client, /getOrCreateCommandKey/);
assert.match(client, /pendingCommandRef\.current/);
assert.doesNotMatch(client, /function newIdempotencyKey/);
assert.match(client, /container\.assigned_customer_id === item\.pickup\.customer_id/);
assert.match(client, /addressesByCustomer\.get\(pickupCustomerId\)/);
assert.match(client, /setPickupAddressId\(""\)/);
assert.match(hardeningMigration, /create or replace function enforce_laundry_container_customer_assignment/i);
assert.match(hardeningMigration, /LAUNDRY_CONTAINER_CUSTOMER_MISMATCH/);
assert.match(hardeningMigration, /laundry_handling_units_validate_container_assignment/);
for (const functionName of [
  "create_task_command",
  "create_work_unit_runtime",
  "create_laundry_pickup_request_command",
  "complete_laundry_pickup_request_command",
  "create_laundry_service_lot_command"
]) {
  assert.match(hardeningMigration, new RegExp(`'${functionName}'`, "i"), `${functionName} must be restricted to the service-role boundary`);
}
assert.match(hardeningMigration, /revoke all on function %s from anon/i);
assert.match(hardeningMigration, /grant execute on function %s to service_role/i);

assert.match(client, /createLaundryPickupRequestAction/);
assert.match(client, /completeLaundryPickupRequestAction/);
assert.match(client, /createLaundryContainerAssetAction/);
assert.match(client, /createLaundryServiceLotAction/);
assert.match(client, /getOrCreateCommandKey/);
assert.match(client, /router\.refresh\(\)/);

assert.equal(packageJson.scripts["smoke:v2:laundry-custody"], "node scripts/smoke-v2-laundry-custody.mjs");
assert.match(smoke, /OS_PLUS_V2_DB_SMOKE/);
assert.match(smoke, /create_laundry_pickup_request_command/);
assert.match(smoke, /create_laundry_container_asset_command/);
assert.match(smoke, /complete_laundry_pickup_request_command/);
assert.match(smoke, /create_laundry_service_lot_command/);
assert.match(smoke, /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/);
assert.match(smoke, /PICKUP_ADDRESS_NOT_FOUND/);
assert.match(smoke, /LAUNDRY_CUSTODY_EVENTS_ARE_APPEND_ONLY/);
assert.match(smoke, /TI-006/);
assert.match(smoke, /pickup\.requested/);
assert.match(smoke, /container_asset\.created/);
assert.match(smoke, /pickup\.completed/);
assert.match(smoke, /handling_unit\.created/);
assert.match(smoke, /service_lot\.created/);
assert.match(smoke, /VERIFY_INTAKE/);
assert.match(smoke, /Create second Laundry service lot/);
assert.match(smoke, /Verify handling unit supports multiple service lots/);
assert.match(smoke, /Reject container assigned to another customer/);
assert.match(smoke, /LAUNDRY_CONTAINER_CUSTOMER_MISMATCH/);

assert.doesNotMatch(migration, /laundry_transfer_manifests/i);
assert.doesNotMatch(migration, /laundry_manifest_units/i);
assert.doesNotMatch(migration, /laundry_collection_batches/i);
assert.doesNotMatch(migration, /invoice_counters|create table invoices|payment_intents|payment_allocations/i);
assert.doesNotMatch(migration, /razorpay|zoho|channel_connections|conversation_messages|agent_runs/i);
assert.doesNotMatch(migration, /order_items|item_workflow_instances|item_stage_instances|item_stage_work_logs|order_payments/i);

assert.equal(
  packageJson.scripts["test:v2"],
  "node scripts/test-v2-baseline.mjs && node scripts/test-v2-work-unit-runtime.mjs && node scripts/test-v2-phase-3-commands-events-tasks.mjs && node scripts/test-v2-phase-4-laundry-custody.mjs"
);

console.log("V2-4 Laundry custody tests passed");
