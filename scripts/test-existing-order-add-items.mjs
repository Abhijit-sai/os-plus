import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, "utf8");
}

const migration = readText(
  "supabase/migrations/20260807100000_existing_order_add_items.sql",
);
const actions = readText("src/features/orders/actions.ts");
const dialog = readText("src/components/orders/add-order-items-dialog.tsx");
const itemBuilder = readText("src/components/orders/order-item-builder.tsx");
const orderPage = readText("src/app/(tenant)/orders/[orderId]/page.tsx");
const packageJson = JSON.parse(readText("package.json"));
const smoke = readText("scripts/smoke-existing-order-add-items.mjs");

assert.match(migration, /create or replace function add_items_to_existing_order/i);
assert.match(migration, /language plpgsql[\s\S]*security definer/i);
assert.match(migration, /set search_path = public/i);
assert.match(migration, /from orders[\s\S]*tenant_id = p_tenant_id[\s\S]*id = p_order_id[\s\S]*for update/i);
assert.match(migration, /ORDER_CANCELLED/);
assert.match(migration, /ORDER_FULLY_DELIVERED/);
assert.match(migration, /v_order\.order_status = 'delivered'/);
assert.doesNotMatch(
  migration,
  /v_order\.order_status = 'completed'[\s\S]{0,300}ORDER_FULLY_DELIVERED/i,
);
assert.match(migration, /ITEM_TYPE_NOT_FOUND/);
assert.match(migration, /WORKFLOW_NOT_FOUND/);
assert.match(migration, /WORKFLOW_ITEM_TYPE_MISMATCH/);
assert.match(migration, /WORKFLOW_HAS_NO_ACTIVE_STAGES/);
assert.match(migration, /MEASUREMENT_NOT_FOUND/);
assert.match(migration, /MEASUREMENT_CUSTOMER_MISMATCH/);
assert.match(migration, /MEASUREMENT_ITEM_TYPE_MISMATCH/);
assert.match(migration, /STANDARD_SIZE_NOT_FOUND/);
assert.match(migration, /STANDARD_SIZE_ITEM_TYPE_MISMATCH/);
assert.match(migration, /insert into order_items/i);
assert.match(migration, /insert into item_workflow_instances/i);
assert.match(migration, /insert into item_stage_instances/i);
assert.match(migration, /ready_to_start/i);
assert.match(migration, /current_stage_instance_id/i);
assert.match(migration, /insert into item_history[\s\S]*item_added_to_existing_order/i);
assert.match(migration, /from order_payments[\s\S]*deleted_at is null/i);
assert.match(migration, /taxable_exclusive/);
assert.match(migration, /taxable_inclusive/);
assert.match(migration, /payment_status/i);
assert.match(migration, /from command_idempotency/i);
assert.match(migration, /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/);
assert.match(migration, /COMMAND_ALREADY_PROCESSING/);
assert.match(migration, /revoke all on function add_items_to_existing_order/i);
assert.match(migration, /grant execute on function add_items_to_existing_order/i);
assert.match(migration, /create or replace function recalculate_order_payment_summary/i);
assert.match(migration, /recalculate_order_payment_summary[\s\S]*for update/i);
assert.match(migration, /grant execute on function recalculate_order_payment_summary/i);

assert.match(actions, /export async function addOrderItemsFormAction/i);
assert.match(actions, /addItemsToExistingOrderSchema/);
assert.match(actions, /rpc\("add_items_to_existing_order"/);
assert.match(actions, /rpc\("record_order_payment"/);
assert.match(actions, /revalidatePath\("\/production"\)/);
assert.match(actions, /revalidatePath\("\/finance"\)/);
assert.match(actions, /revalidatePath\(`\/track\/\$\{trackingToken\}`\)/);

assert.match(dialog, /OrderItemBuilder/);
assert.match(dialog, /useFormStatus/);
assert.match(dialog, /pending \? "Adding items\.\.\." : "Add items"/);
assert.match(dialog, /disabled=\{pending\}/);
assert.match(dialog, /preventClose=\{pending\}/);
assert.match(dialog, /data-unsaved-guard="true"/);
assert.match(dialog, /Production has already started/);
assert.match(dialog, /fully delivered|cancelled/i);
assert.match(dialog, /crypto\.randomUUID\(\)/);
assert.match(dialog, /pendingRequestRef\.current/);
assert.match(dialog, /state\.ok && state\.message/);
assert.match(dialog, /CheckCircle2/);
assert.match(itemBuilder, /const availableWorkflows = workflows\.filter/);
assert.match(itemBuilder, /workflow\.item_type_id === selectedItemTypeId/);

assert.match(orderPage, /AddOrderItemsDialog/);
assert.match(orderPage, /workflows=\{workflows\}/);
assert.match(orderPage, /measurementFields=\{measurementFields\}/);

assert.equal(
  packageJson.scripts["test:order-add-items"],
  "node scripts/test-existing-order-add-items.mjs",
);
assert.equal(
  packageJson.scripts["smoke:order-add-items"],
  "node scripts/smoke-existing-order-add-items.mjs",
);

assert.match(smoke, /OS_PLUS_ORDER_ADD_ITEMS_DB_SMOKE/);
assert.match(smoke, /two new items/i);
assert.match(smoke, /tenant isolation/i);
assert.match(smoke, /atomic rollback/i);
assert.match(smoke, /idempotent retry/i);
assert.match(smoke, /payment status/i);
assert.match(smoke, /Recalculate payment summary under order lock/i);
assert.match(smoke, /Production-completed order accepts new item/i);
assert.match(smoke, /Delivered order rejects new items/i);
assert.match(smoke, /Cancelled order rejects new items/i);
assert.match(smoke, /Fully delivered order rejects new items/i);
assert.match(smoke, /Workflow item-type compatibility/i);
assert.match(smoke, /Measurement item-type compatibility/i);
assert.match(smoke, /Standard-size item-type compatibility/i);
assert.match(smoke, /Changed-payload idempotency rejection/i);

console.log("Existing-order add-items source contract passed");
