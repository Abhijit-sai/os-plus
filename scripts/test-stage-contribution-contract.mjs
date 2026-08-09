import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260809120000_stage_worker_contributions.sql", import.meta.url),
  "utf8",
);
const usabilityMigration = await readFile(
  new URL("../supabase/migrations/20260809130000_stage_contribution_usability_reports.sql", import.meta.url),
  "utf8",
);
const contributionActions = await readFile(
  new URL("../src/features/production/contribution-actions.ts", import.meta.url),
  "utf8",
);

assert.match(migration, /create type stage_effort_tracking_mode as enum \('none', 'units', 'hours', 'hybrid'\)/i);
assert.match(migration, /create table item_type_stage_contribution_rules/i);
assert.match(migration, /create table item_stage_contribution_corrections/i);
assert.match(migration, /create table item_stage_contribution_operations/i);
assert.match(migration, /credited_units numeric/i);
assert.match(migration, /credited_minutes integer/i);
assert.match(migration, /calculated_contribution_amount numeric/i);
assert.match(migration, /contribution_item_value_snapshot/i);
assert.match(migration, /contribution_pool_snapshot/i);
assert.match(migration, /contribution_revision bigint not null default 0/i);
assert.match(migration, /item_stage_contribution_corrections_immutable/i);
assert.match(migration, /item_stage_contribution_operations_immutable/i);
assert.match(migration, /create or replace function start_item_stage_with_contributions/i);
assert.match(migration, /create or replace function replace_item_stage_contributions/i);
assert.match(migration, /create or replace function complete_item_stage_with_contributions/i);
assert.match(migration, /for update/i);
assert.match(migration, /order by worker_id, workgroup_id/i);
assert.match(migration, /fractional_remainder/i, "percentage allocation must use a non-negative largest-remainder calculation");
assert.match(migration, /WORKER_NOT_ELIGIBLE_FOR_STAGE/i);
assert.match(migration, /WORKGROUP_NOT_ELIGIBLE_FOR_STAGE/i);
assert.match(migration, /UNIT_TOTAL_MUST_EQUAL_ITEM_QUANTITY/i);
assert.match(migration, /COMPLETED_CONTRIBUTION_CORRECTION_NOT_ALLOWED/i);
assert.match(migration, /LEGACY_COMPLETED_STAGE_IMMUTABLE/i);
assert.match(migration, /STALE_CONTRIBUTION_REVISION/i);
assert.match(migration, /IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH/i);
assert.doesNotMatch(migration, /if v_existing_log_id is null and not exists/i, "existing assignments must be revalidated too");
assert.match(migration, /update_stage_configuration_with_effort[\s\S]*?perform update_stage_configuration\([\s\S]*?STAGE_EFFORT_MODE_HAS_INCOMPATIBLE_RULES/i, "stage configuration must acquire the base workflow-then-stage locks before checking rule compatibility");
assert.match(migration, /revoke all on function start_item_stage_with_contributions[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /grant execute on function start_item_stage_with_contributions[\s\S]*to service_role/i);
assert.match(migration, /replace_item_stage_contributions\(uuid, uuid, jsonb, text, text, boolean, bigint, uuid\)/i);
assert.match(migration, /complete_item_stage_with_contributions\(uuid, uuid, jsonb, text, text, text, bigint, uuid\)/i);
assert.doesNotMatch(migration, /update\s+(salary_calculations|worker_ledger|expenses|order_payments)/i);
assert.doesNotMatch(migration, /like '%deliver%'|like '%handoff%'/i, "workflow completion must not infer fulfillment from configurable labels");
assert.match(migration, /customer_statuses\.is_final_status/i, "final fulfillment must use the explicit configured final-status flag");
assert.match(migration, /v_old_effort_json[\s\S]*?is distinct from v_new_effort_json/i, "ordinary status-only completion must not create a false correction");
assert.match(usabilityMigration, /drop constraint if exists item_stage_work_logs_credited_units_quarter_step/i);
assert.match(usabilityMigration, /mod\(credited_units \* 100, 10\) = 0/i);
assert.match(usabilityMigration, /mod\(v_units \* 100, 10\) <> 0/i);
assert.match(usabilityMigration, /item_stage_work_logs_tenant_completed_contribution_idx/i);
assert.match(usabilityMigration, /UNEXPECTED_STAGE_CONTRIBUTION_INCREMENT_FUNCTION/i, "the applied-environment increment patch must fail closed on an unknown function version");
assert.match(usabilityMigration, /UNEXPECTED_STAGE_CONTRIBUTION_COMPLETION_FUNCTION/i, "the applied-environment fulfillment patch must fail closed on an unknown function version");
assert.match(usabilityMigration, /suppress_status_only_contribution_correction/i);
assert.match(contributionActions, /Number\.isInteger\(value \* 10\)/i);
assert.match(contributionActions, /Units must use 0\.10 increments\./i);

console.log("Stage contribution database and atomic-RPC contracts passed.");
