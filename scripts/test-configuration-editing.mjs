import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const settingsActions = read("src/features/settings/actions.ts");
const workerActions = read("src/features/workers/actions.ts");
const workflowActions = read("src/features/workflows/actions.ts");
const settingsList = read("src/components/settings/settings-list.tsx");
const workerPage = read("src/app/(tenant)/workers/page.tsx");
const workflowDetail = read("src/app/(tenant)/settings/workflows/[workflowId]/page.tsx");
const measurementStandardsPage = read("src/app/(tenant)/settings/measurement-standards/page.tsx");
const customerDetailPage = read("src/app/(tenant)/customers/[customerId]/page.tsx");
const financeActions = read("src/features/finance/actions.ts");
const financePage = read("src/app/(tenant)/finance/page.tsx");
const orderActions = read("src/features/orders/actions.ts");
const configurationMigration = read("supabase/migrations/20260808100000_configuration_editing_and_expense_defaults.sql");
const paymentSmoke = read("scripts/smoke-payment-integrity.mjs");
const configurationDialogs = read("src/components/settings/configuration-edit-dialogs.tsx");
const autoCloseDialog = read("src/components/ui/auto-close-action-dialog.tsx");

for (const actionName of [
  "updateItemTypeAction",
  "updateStageAction",
  "updateCustomerStatusAction",
  "updateWorkgroupAction",
  "updatePaymentModeAction",
  "updateExpenseCategoryAction",
  "updateTenantLocationAction",
  "updateTeamAction",
]) {
  assert.match(settingsActions, new RegExp(`export async function ${actionName}`));
}

assert.match(settingsActions, /\.eq\("tenant_id", context\.tenant\.id\)[\s\S]*\.eq\("id", parsed\./);
assert.match(settingsActions, /rpc\("update_stage_configuration_with_effort"/);
assert.match(configurationDialogs, /AutoCloseActionDialog/);
assert.match(autoCloseDialog, /nextState\.ok[\s\S]*?setOpen\(false\)/, "successful configuration saves must close their dialog");
assert.match(autoCloseDialog, /role="alert"/, "failed configuration saves must stay visible and recoverable");
assert.match(workerActions, /export async function updateWorkerAction/);
assert.match(workerActions, /rpc\("update_worker_configuration"/);
assert.match(workflowActions, /export async function updateWorkflowAction/);
assert.match(workflowActions, /rpc\("create_workflow_configuration"/);
assert.match(workflowActions, /rpc\("replace_workflow_stage_sequence"/);
assert.match(workflowActions, /export async function removeStageWorkgroupAction/);
assert.match(settingsList, /renderActions/);
assert.match(workerPage, /Edit worker/);
assert.match(workflowDetail, /Edit workflow/);
assert.match(measurementStandardsPage, /updateMeasurementFieldAction/);
assert.match(measurementStandardsPage, /updateStandardSizeAction/);
assert.match(measurementStandardsPage, /Edit measurement field/);
assert.match(measurementStandardsPage, /Edit standard size/);
assert.match(customerDetailPage, /Edit measurement/);
assert.match(financeActions, /export async function updateOrderPaymentAction/);
assert.match(financePage, /title="Edit expense"[\s\S]*?<Pencil[\s\S]*?Edit/);
assert.match(financePage, /title="Edit order payment"[\s\S]*?<Pencil[\s\S]*?Correct/);
assert.match(financeActions, /\.eq\("tenant_id", context\.tenant\.id\)/);
assert.match(financeActions, /rpc\("correct_order_payment"/, "payment corrections must be one atomic RPC");
assert.match(orderActions, /rpc\("record_order_payment"/, "new payments must validate and write under one order-row lock");
assert.match(configurationMigration, /create table order_payment_corrections/i);
assert.match(configurationMigration, /create or replace function correct_order_payment/i);
assert.match(configurationMigration, /create or replace function record_order_payment/i);
assert.match(configurationMigration, /insert into order_payment_corrections/i);
assert.match(configurationMigration, /for update/i);
assert.match(configurationMigration, /PAYMENT_EXCEEDS_ORDER_TOTAL/i);
assert.match(configurationMigration, /IMMUTABLE_AUDIT_RECORD/i);
assert.match(settingsActions, /MEASUREMENT_FIELD_IDENTITY_IMMUTABLE/);
assert.match(settingsActions, /STANDARD_SIZE_ITEM_TYPE_IMMUTABLE/);
assert.match(read("src/features/customers/actions.ts"), /CUSTOMER_MEASUREMENT_ITEM_TYPE_IMMUTABLE/);
assert.match(settingsActions, /\.select\("id"\)\s*\.maybeSingle\(\)/s, "tenant-scoped configuration updates must reject zero-row updates");
assert.match(workflowActions, /Default workflows must remain active/);
assert.match(configurationMigration, /DEFAULT_WORKFLOW_MUST_BE_ACTIVE/);
assert.match(configurationMigration, /ACTIVE_WORKFLOW_REQUIRES_ACTIVE_STAGE/);
assert.match(configurationMigration, /STAGE_REQUIRED_BY_ACTIVE_WORKFLOW/);
assert.match(configurationMigration, /create or replace function update_stage_configuration/i);
assert.match(configurationMigration, /update_stage_configuration[\s\S]*for update of workflows/i);
assert.match(
  configurationMigration,
  /update_workflow_configuration[\s\S]*perform stage_master\.id[\s\S]*for share of stage_master/i,
  "workflow activation must hold a stage lock until commit",
);
assert.match(configurationMigration, /create or replace function create_workflow_configuration/i);
assert.match(configurationMigration, /create or replace function replace_workflow_stage_sequence/i);
assert.match(configurationMigration, /replace_workflow_stage_sequence[\s\S]*for update/i);
assert.match(configurationMigration, /stage_master[\s\S]*is_active = true[\s\S]*for share/i);
assert.match(paymentSmoke, /two active QA tenants/i);
assert.match(paymentSmoke, /Promise\.all/);
assert.match(paymentSmoke, /IMMUTABLE_AUDIT_RECORD/);
assert.match(paymentSmoke, /PAYMENT_NOT_FOUND/);
assert.match(read("scripts/smoke-workflow-stage-concurrency.mjs"), /Promise\.all/);
assert.match(read("scripts/smoke-workflow-stage-concurrency.mjs"), /STAGE_REQUIRED_BY_ACTIVE_WORKFLOW|ACTIVE_WORKFLOW_REQUIRES_ACTIVE_STAGE/);
assert.match(read("scripts/smoke-workflow-stage-concurrency.mjs"), /Workflow-stage smoke cleanup was incomplete/);

console.log("Configuration editing contract passed");
