import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260810100000_worker_money_ledger.sql", import.meta.url),
  "utf8",
);
const salaryWorkflowMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260812120000_salary_workflow_hardening.sql", import.meta.url),
  "utf8",
);
const workerSummaryRepairMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260812152000_restore_worker_money_summaries.sql", import.meta.url),
  "utf8",
);
const bulkWorkspaceMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260812170000_salary_period_bulk_workspace.sql", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../src/features/salary/actions.ts", import.meta.url),
  "utf8",
);

assert.match(migration, /add column balance_account text/i);
assert.match(migration, /add column idempotency_key uuid/i);
assert.match(migration, /add column corrected_from_entry_id uuid/i);
assert.match(migration, /add column reversed_at timestamptz/i);
assert.match(migration, /create unique index worker_ledger_tenant_idempotency_idx/i);
assert.match(migration, /create or replace function record_worker_money_entry/i);
assert.match(migration, /create or replace function correct_worker_money_entry/i);
assert.match(migration, /create or replace function reverse_worker_money_entry/i);
assert.match(migration, /create or replace function worker_money_summaries/i);
assert.match(migration, /from workers[\s\S]*?tenant_id = p_tenant_id[\s\S]*?for update/i);
assert.match(migration, /from payment_modes[\s\S]*?tenant_id = p_tenant_id/i);
assert.match(migration, /WORKER_MONEY_PAYMENT_MODE_REQUIRED/);
assert.match(migration, /WORKER_MONEY_BALANCE_EXCEEDED/);
assert.match(migration, /WORKER_MONEY_SALARY_OVERPAY/);
assert.match(migration, /WORKER_MONEY_SALARY_NOT_FINALIZED/);
assert.match(
  migration,
  /from salary_calculations[\s\S]*?salary_period_id = p_linked_salary_period_id[\s\S]*?worker_id = p_worker_id[\s\S]*?for update/i,
);
assert.match(
  migration,
  /v_salary_paid \+ p_amount > v_salary_calculation\.finalized_payable_amount/i,
);
assert.match(
  migration,
  /v_other_salary_paid \+ p_amount > coalesce[\s\S]*?finalized_payable_amount[\s\S]*?final_payable/i,
);
assert.match(migration, /WORKER_MONEY_CORRECTION_REASON_REQUIRED/);
const correctionFunction = migration.match(/create or replace function correct_worker_money_entry[\s\S]*?\n\$\$;/i)?.[0] ?? "";
assert.match(correctionFunction, /when unique_violation then/i);
assert.match(correctionFunction, /where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key/i);
assert.match(migration, /revoke all on function worker_money_summaries\(uuid\) from public, anon, authenticated/i);
assert.match(migration, /grant execute on function worker_money_summaries\(uuid\) to service_role/i);
assert.match(workerSummaryRepairMigration, /create or replace function worker_money_summaries\(p_tenant_id uuid\)/i);
assert.match(workerSummaryRepairMigration, /where w\.tenant_id = p_tenant_id/i);
assert.match(workerSummaryRepairMigration, /and l\.reversed_at is null/i);
assert.match(workerSummaryRepairMigration, /revoke all on function worker_money_summaries\(uuid\) from public, anon, authenticated, service_role/i);
assert.match(workerSummaryRepairMigration, /grant execute on function worker_money_summaries\(uuid\) to service_role/i);
assert.match(bulkWorkspaceMigration, /create or replace function finalize_salary_calculations_bulk/i);
assert.match(bulkWorkspaceMigration, /create or replace function record_salary_payments_bulk/i);
assert.match(bulkWorkspaceMigration, /SALARY_BULK_STALE_ROW/i);
assert.match(bulkWorkspaceMigration, /perform lock_salary_period/i);
assert.match(bulkWorkspaceMigration, /record_worker_money_entry_without_period_lock/i);
assert.match(bulkWorkspaceMigration, /revoke all on function finalize_salary_calculations_bulk[\s\S]*?from public, anon, authenticated/i);
assert.match(bulkWorkspaceMigration, /revoke all on function record_salary_payments_bulk[\s\S]*?from public, anon, authenticated/i);
assert.match(migration, /reversed_at is null/g);
assert.match(migration, /corrected_from_entry_id/);
assert.match(migration, /refresh_salary_payment_from_ledger/i);
assert.match(actions, /rpc\("record_worker_money_entry"/);
assert.match(salaryWorkflowMigration, /create table salary_workflow_operations/i);
assert.match(salaryWorkflowMigration, /create or replace function create_salary_period_with_calculations/i);
assert.match(salaryWorkflowMigration, /create or replace function regenerate_salary_period_calculations/i);
assert.match(salaryWorkflowMigration, /create or replace function update_salary_period_with_calculations/i);
assert.match(salaryWorkflowMigration, /create or replace function finalize_salary_calculation/i);
assert.match(salaryWorkflowMigration, /from tenants[\s\S]*?for update/i);
assert.match(salaryWorkflowMigration, /SALARY_PERIOD_OVERLAP/);
assert.match(salaryWorkflowMigration, /SALARY_PAYABLE_BELOW_PAID/);
assert.match(salaryWorkflowMigration, /SALARY_FINALIZATION_NOTE_REQUIRED/);
assert.match(salaryWorkflowMigration, /SALARY_CALCULATIONS_EMPTY/);
assert.match(salaryWorkflowMigration, /SALARY_CALCULATIONS_INCOMPLETE/);
assert.match(salaryWorkflowMigration, /SALARY_WORKFLOW_IDEMPOTENCY_CONFLICT/);
assert.match(salaryWorkflowMigration, /target_key text not null/);
assert.match(salaryWorkflowMigration, /request_fingerprint text not null/);
assert.match(salaryWorkflowMigration, /payload_fingerprint text not null/);
assert.match(salaryWorkflowMigration, /salary_workflow_operations_immutable/);
assert.match(salaryWorkflowMigration, /salary_calculation_revisions_immutable/);
assert.match(salaryWorkflowMigration, /select period\.\* into v_period[\s\S]*?for update of period[\s\S]*?select \* into v_calculation[\s\S]*?for update/i);
assert.match(salaryWorkflowMigration, /revoke all on function insert_salary_calculation_payload\([\s\S]*?service_role/i);
assert.match(salaryWorkflowMigration, /rename to record_worker_money_entry_without_period_lock/i);
assert.match(salaryWorkflowMigration, /create or replace function lock_salary_period/i);
assert.match(salaryWorkflowMigration, /perform lock_salary_period\(p_tenant_id, p_linked_salary_period_id\)/i);
assert.match(salaryWorkflowMigration, /revoke all on function lock_salary_period\(uuid, uuid\) from public, anon, authenticated, service_role/i);
assert.doesNotMatch(salaryWorkflowMigration, /grant execute on function lock_salary_period/i);
assert.match(salaryWorkflowMigration, /alter table worker_ledger add column request_fingerprint text/i);
assert.match(salaryWorkflowMigration, /WORKER_MONEY_IDEMPOTENCY_CONFLICT/g);
assert.match(salaryWorkflowMigration, /revoke all on function worker_money_balance\(uuid, uuid, text, uuid\) from service_role/i);
assert.match(salaryWorkflowMigration, /revoke all on function refresh_salary_payment_from_ledger\(uuid, uuid, uuid, text\) from service_role/i);
assert.match(salaryWorkflowMigration, /revoke all on function update_worker_configuration\([\s\S]*?from public, anon, authenticated/i);
assert.match(salaryWorkflowMigration, /when coalesce\(finalized_payable_amount, final_payable\) <= 0 then 'paid'/i);
assert.match(salaryWorkflowMigration, /bool_and\([\s\S]*?finalized_payable_amount is not null[\s\S]*?amount_paid >= finalized_payable_amount/i);
assert.match(salaryWorkflowMigration, /previous_finalized_payable_amount/);
assert.match(salaryWorkflowMigration, /reason text not null/i);
assert.match(actions, /rpc\("create_salary_period_with_calculations"/);
assert.match(actions, /rpc\("regenerate_salary_period_calculations"/);
assert.match(actions, /rpc\("update_salary_period_with_calculations"/);
assert.match(actions, /rpc\("finalize_salary_calculation"/);
assert.match(actions, /assertPermission\(context\.membership\.role, "workers:view"\)/);
assert.match(actions, /paymentModeId:\s*z\.string\(\)\.uuid/);
assert.match(actions, /const isoDateSchema/);
assert.match(actions, /const optionalUuid/);
assert.match(actions, /export type WorkerMoneyActionState/);
assert.doesNotMatch(
  actions.match(/export async function recordSalaryPaymentAction[\s\S]*?export async function addWorkerLedgerEntryAction/)?.[0] ?? "",
  /\.from\("worker_ledger"\)\.insert/,
);
const salaryPaymentAction =
  actions.match(/export async function recordSalaryPaymentAction[\s\S]*?export async function addWorkerLedgerEntryAction/)?.[0] ?? "";
assert.match(
  salaryPaymentAction,
  /if \(calculation\.finalized_payable_amount === null\)[\s\S]*?return \{[\s\S]*?periodId: calculation\.salary_period_id,[\s\S]*?workerId: calculation\.worker_id/,
  "The action must reject stale unfinalized submissions without throwing a runtime page error",
);
assert.match(
  salaryPaymentAction,
  /catch \(error\) \{[\s\S]*?return \{ idempotencyKey: retryKey, message: workerMoneyActionError\(error\), ok: false \}/,
  "Recoverable salary-payment failures must return inline action-state feedback",
);

console.log("Worker money database contract tests passed.");
