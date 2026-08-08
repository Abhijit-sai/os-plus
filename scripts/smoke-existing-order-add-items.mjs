import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function getArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function loadEnvFile(relativePath) {
  const envPath = path.join(root, relativePath);
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

loadEnvFile(".env.local");

if (process.env.OS_PLUS_ORDER_ADD_ITEMS_DB_SMOKE !== "1") {
  console.log(
    "Existing-order add-items DB smoke skipped. Set OS_PLUS_ORDER_ADD_ITEMS_DB_SMOKE=1 to run it.",
  );
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const smokeTenantId =
  getArgument("--tenant-id") ?? process.env.OS_PLUS_SMOKE_TENANT_ID;
const foreignTenantId =
  getArgument("--foreign-tenant-id") ??
  process.env.OS_PLUS_SMOKE_FOREIGN_TENANT_ID;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

if (!smokeTenantId || !foreignTenantId || smokeTenantId === foreignTenantId) {
  throw new Error(
    "Pass distinct --tenant-id and --foreign-tenant-id values for two active QA tenants.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const marker = `order-add-items-smoke-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const created = {
  tenantId: null,
  foreignTenantId: null,
  customerIds: [],
  itemTypeIds: [],
  stageMasterIds: [],
  workflowIds: [],
  orderId: null,
};

async function single(label, request) {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function query(label, request) {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

async function expectRpcError(label, request, expectedMessage) {
  const result = await request;
  assert.ok(result.error, `${label} must fail.`);
  assert.match(result.error.message, new RegExp(expectedMessage));
}

async function cleanup() {
  if (!created.tenantId) return;

  await supabase
    .from("command_idempotency")
    .delete()
    .eq("tenant_id", created.tenantId)
    .eq("command_type", "AddItemsToExistingOrder");

  if (created.orderId) {
    const itemRows = await query(
      "Load smoke items for cleanup",
      supabase.from("order_items").select("id").eq("tenant_id", created.tenantId).eq("order_id", created.orderId),
    );
    const itemIds = itemRows.map((row) => row.id);

    if (itemIds.length) {
      await supabase.from("item_history").delete().eq("tenant_id", created.tenantId).in("order_item_id", itemIds);
      await supabase.from("item_stage_instances").delete().eq("tenant_id", created.tenantId).in("order_item_id", itemIds);
      await supabase.from("item_workflow_instances").delete().eq("tenant_id", created.tenantId).in("order_item_id", itemIds);
    }

    await supabase.from("order_payments").delete().eq("tenant_id", created.tenantId).eq("order_id", created.orderId);
    await supabase.from("order_items").delete().eq("tenant_id", created.tenantId).eq("order_id", created.orderId);
    await supabase.from("orders").delete().eq("tenant_id", created.tenantId).eq("id", created.orderId);
  }

  if (created.customerIds.length) {
    await supabase.from("customer_measurements").delete().eq("tenant_id", created.tenantId).in("customer_id", created.customerIds);
  }

  if (created.itemTypeIds.length) {
    await supabase.from("item_type_standard_sizes").delete().eq("tenant_id", created.tenantId).in("item_type_id", created.itemTypeIds);
  }

  if (created.workflowIds.length) {
    await supabase.from("workflow_stages").delete().eq("tenant_id", created.tenantId).in("workflow_id", created.workflowIds);
    await supabase.from("workflows").delete().eq("tenant_id", created.tenantId).in("id", created.workflowIds);
  }

  if (created.stageMasterIds.length) {
    await supabase.from("stage_master").delete().eq("tenant_id", created.tenantId).in("id", created.stageMasterIds);
  }

  if (created.itemTypeIds.length) {
    await supabase.from("item_types").delete().eq("tenant_id", created.tenantId).in("id", created.itemTypeIds);
  }

  if (created.customerIds.length) {
    await supabase.from("customers").delete().eq("tenant_id", created.tenantId).in("id", created.customerIds);
  }
}

try {
  const tenants = await query(
    "Load two active QA tenants",
    supabase
      .from("tenants")
      .select("id, slug")
      .eq("status", "active")
      .in("id", [smokeTenantId, foreignTenantId]),
  );
  assert.equal(tenants.length, 2, "DB smoke requires two active tenants for tenant isolation.");
  assert.ok(tenants.some((tenant) => tenant.id === smokeTenantId));
  assert.ok(tenants.some((tenant) => tenant.id === foreignTenantId));
  created.tenantId = smokeTenantId;
  created.foreignTenantId = foreignTenantId;

  const [customer, otherCustomer] = await query(
    "Create smoke customers",
    supabase
      .from("customers")
      .insert([
        { tenant_id: created.tenantId, name: `${marker} customer` },
        { tenant_id: created.tenantId, name: `${marker} other customer` },
      ])
      .select("id"),
  );
  created.customerIds.push(customer.id, otherCustomer.id);

  const [blouseType, trouserType] = await query(
    "Create smoke item types",
    supabase
      .from("item_types")
      .insert([
        { tenant_id: created.tenantId, name: `${marker} blouse`, is_active: true },
        { tenant_id: created.tenantId, name: `${marker} trouser`, is_active: true },
      ])
      .select("id"),
  );
  created.itemTypeIds.push(blouseType.id, trouserType.id);

  const [cutStage, stitchStage] = await query(
    "Create smoke stages",
    supabase
      .from("stage_master")
      .insert([
        { tenant_id: created.tenantId, name: `${marker} cut`, is_active: true },
        { tenant_id: created.tenantId, name: `${marker} stitch`, is_active: true },
      ])
      .select("id"),
  );
  created.stageMasterIds.push(cutStage.id, stitchStage.id);

  const [blouseWorkflow, trouserWorkflow] = await query(
    "Create smoke workflows",
    supabase
      .from("workflows")
      .insert([
        { tenant_id: created.tenantId, name: `${marker} blouse flow`, item_type_id: blouseType.id, is_active: true },
        { tenant_id: created.tenantId, name: `${marker} trouser flow`, item_type_id: trouserType.id, is_active: true },
      ])
      .select("id"),
  );
  created.workflowIds.push(blouseWorkflow.id, trouserWorkflow.id);

  await query(
    "Create smoke workflow stages",
    supabase.from("workflow_stages").insert([
      {
        tenant_id: created.tenantId,
        workflow_id: blouseWorkflow.id,
        stage_master_id: cutStage.id,
        sequence_number: 1,
        is_active: true,
      },
      {
        tenant_id: created.tenantId,
        workflow_id: blouseWorkflow.id,
        stage_master_id: stitchStage.id,
        sequence_number: 2,
        is_active: true,
      },
      {
        tenant_id: created.tenantId,
        workflow_id: trouserWorkflow.id,
        stage_master_id: cutStage.id,
        sequence_number: 1,
        is_active: true,
      },
    ]),
  );

  const measurement = await single(
    "Create smoke measurement",
    supabase
      .from("customer_measurements")
      .insert({
        tenant_id: created.tenantId,
        customer_id: customer.id,
        item_type_id: blouseType.id,
        reference_name: marker,
        measurement_data_json: { bust: "36" },
      })
      .select("id")
      .single(),
  );
  const foreignCustomerMeasurement = await single(
    "Create other-customer measurement",
    supabase
      .from("customer_measurements")
      .insert({
        tenant_id: created.tenantId,
        customer_id: otherCustomer.id,
        item_type_id: blouseType.id,
        reference_name: `${marker} other`,
        measurement_data_json: { bust: "38" },
      })
      .select("id")
      .single(),
  );
  const standardSize = await single(
    "Create smoke standard size",
    supabase
      .from("item_type_standard_sizes")
      .insert({
        tenant_id: created.tenantId,
        item_type_id: trouserType.id,
        size_label: marker,
        measurement_data_json: { waist: "32" },
        is_active: true,
      })
      .select("id")
      .single(),
  );

  const order = await single(
    "Create smoke order",
    supabase
      .from("orders")
      .insert({
        tenant_id: created.tenantId,
        order_number: marker,
        customer_id: customer.id,
        source: "walk_in",
        order_date: new Date().toISOString().slice(0, 10),
        delivery_type: "store_pickup",
        subtotal: 100,
        discount_amount: 0,
        gst_treatment: "taxable_exclusive",
        gst_rate: 18,
        taxable_amount: 100,
        gst_amount: 18,
        total_amount: 118,
        amount_paid: 118,
        payment_status: "paid",
        order_status: "in_progress",
        tracking_token: crypto.randomUUID(),
        vertical_key: "boutique",
        runtime_model: "legacy_item_v1",
      })
      .select("id")
      .single(),
  );
  created.orderId = order.id;

  await query(
    "Create existing smoke item",
    supabase.from("order_items").insert({
      tenant_id: created.tenantId,
      order_id: order.id,
      item_type_id: blouseType.id,
      name: `${marker} existing`,
      quantity: 1,
      unit_price: 100,
      discount_amount: 0,
      final_price: 100,
      workflow_id: blouseWorkflow.id,
      item_status: "not_started",
    }),
  );
  await query(
    "Create existing smoke payment",
    supabase.from("order_payments").insert({
      tenant_id: created.tenantId,
      order_id: order.id,
      amount: 118,
      payment_date: new Date().toISOString().slice(0, 10),
    }),
  );

  const twoNewItems = [
    {
      item_type_id: blouseType.id,
      customer_measurement_id: measurement.id,
      standard_size_id: null,
      name: `${marker} new blouse`,
      quantity: 2,
      unit_price: 50,
      discount_amount: 10,
      workflow_id: blouseWorkflow.id,
    },
    {
      item_type_id: trouserType.id,
      customer_measurement_id: null,
      standard_size_id: standardSize.id,
      name: `${marker} new trouser`,
      quantity: 1,
      unit_price: 25,
      discount_amount: 0,
      workflow_id: trouserWorkflow.id,
    },
  ];
  const idempotencyKey = crypto.randomUUID();
  const addResult = await single(
    "Add two new items",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: twoNewItems,
      p_actor_id: marker,
      p_idempotency_key: idempotencyKey,
    }),
  );
  assert.equal(addResult.added_item_count, 2);
  assert.equal(addResult.subtotal, 225);
  assert.equal(addResult.discount_amount, 10);
  assert.equal(addResult.total_amount, 253.7);
  assert.equal(addResult.amount_paid, 118);
  assert.equal(addResult.payment_status, "partially_paid", "Payment status must become partially paid.");

  await single(
    "Create stale payment summary",
    supabase
      .from("orders")
      .update({ amount_paid: 0, payment_status: "unpaid" })
      .eq("tenant_id", created.tenantId)
      .eq("id", order.id)
      .select("id")
      .single(),
  );
  const paymentSummary = await single(
    "Recalculate payment summary under order lock",
    supabase.rpc("recalculate_order_payment_summary", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_actor_id: marker,
    }),
  );
  assert.equal(paymentSummary.total_amount, 253.7);
  assert.equal(paymentSummary.amount_paid, 118);
  assert.equal(paymentSummary.payment_status, "partially_paid");

  const addedItemIds = addResult.added_item_ids;
  const workflowInstances = await query(
    "Verify workflow initialization",
    supabase
      .from("item_workflow_instances")
      .select("id, order_item_id, current_stage_instance_id")
      .eq("tenant_id", created.tenantId)
      .in("order_item_id", addedItemIds),
  );
  assert.equal(workflowInstances.length, 2);
  assert.ok(workflowInstances.every((instance) => instance.current_stage_instance_id));
  const readyStages = await query(
    "Verify first ready stages",
    supabase
      .from("item_stage_instances")
      .select("order_item_id, status")
      .eq("tenant_id", created.tenantId)
      .in("order_item_id", addedItemIds)
      .eq("status", "ready_to_start"),
  );
  assert.equal(readyStages.length, 2);

  const retryResult = await single(
    "Idempotent retry",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: twoNewItems,
      p_actor_id: marker,
      p_idempotency_key: idempotencyKey,
    }),
  );
  assert.deepEqual(retryResult.added_item_ids, addedItemIds);

  const countBeforeRollback = await query(
    "Count items before atomic rollback",
    supabase.from("order_items").select("id").eq("tenant_id", created.tenantId).eq("order_id", order.id),
  );
  await expectRpcError(
    "Atomic rollback",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [twoNewItems[0], { ...twoNewItems[1], item_type_id: crypto.randomUUID() }],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "ITEM_TYPE_NOT_FOUND",
  );
  const countAfterRollback = await query(
    "Count items after atomic rollback",
    supabase.from("order_items").select("id").eq("tenant_id", created.tenantId).eq("order_id", order.id),
  );
  assert.equal(countAfterRollback.length, countBeforeRollback.length);

  await expectRpcError(
    "Measurement customer compatibility",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [{ ...twoNewItems[0], customer_measurement_id: foreignCustomerMeasurement.id }],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "MEASUREMENT_CUSTOMER_MISMATCH",
  );

  await expectRpcError(
    "Workflow item-type compatibility",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [{ ...twoNewItems[0], workflow_id: trouserWorkflow.id }],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "WORKFLOW_ITEM_TYPE_MISMATCH",
  );

  await expectRpcError(
    "Measurement item-type compatibility",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [{ ...twoNewItems[1], customer_measurement_id: measurement.id, standard_size_id: null }],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "MEASUREMENT_ITEM_TYPE_MISMATCH",
  );

  await expectRpcError(
    "Standard-size item-type compatibility",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [{ ...twoNewItems[0], customer_measurement_id: null, standard_size_id: standardSize.id }],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "STANDARD_SIZE_ITEM_TYPE_MISMATCH",
  );

  await expectRpcError(
    "Changed-payload idempotency rejection",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [{ ...twoNewItems[0], name: `${marker} changed retry` }],
      p_actor_id: marker,
      p_idempotency_key: idempotencyKey,
    }),
    "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST",
  );

  await expectRpcError(
    "Tenant isolation",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.foreignTenantId,
      p_order_id: order.id,
      p_items: twoNewItems,
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "ORDER_NOT_FOUND",
  );

  await single(
    "Mark order production completed",
    supabase
      .from("orders")
      .update({ order_status: "completed" })
      .eq("tenant_id", created.tenantId)
      .eq("id", order.id)
      .select("id")
      .single(),
  );
  const completedOrderResult = await single(
    "Production-completed order accepts new item",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [{ ...twoNewItems[0], name: `${marker} after production completion` }],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
  );
  assert.equal(completedOrderResult.added_item_count, 1);
  const reopenedOrder = await single(
    "Verify production-completed order reopens",
    supabase
      .from("orders")
      .select("order_status")
      .eq("tenant_id", created.tenantId)
      .eq("id", order.id)
      .single(),
  );
  assert.equal(reopenedOrder.order_status, "in_progress");

  await single(
    "Mark canonical order delivered",
    supabase
      .from("orders")
      .update({ order_status: "delivered" })
      .eq("tenant_id", created.tenantId)
      .eq("id", order.id)
      .select("id")
      .single(),
  );
  await expectRpcError(
    "Delivered order rejects new items",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [twoNewItems[0]],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "ORDER_FULLY_DELIVERED",
  );

  await single(
    "Mark order cancelled",
    supabase
      .from("orders")
      .update({ order_status: "cancelled" })
      .eq("tenant_id", created.tenantId)
      .eq("id", order.id)
      .select("id")
      .single(),
  );
  await expectRpcError(
    "Cancelled order rejects new items",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [twoNewItems[0]],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "ORDER_CANCELLED",
  );

  await single(
    "Prepare fully delivered item state",
    supabase
      .from("orders")
      .update({ order_status: "in_progress" })
      .eq("tenant_id", created.tenantId)
      .eq("id", order.id)
      .select("id")
      .single(),
  );
  await query(
    "Mark all items delivered",
    supabase
      .from("order_items")
      .update({ item_status: "delivered" })
      .eq("tenant_id", created.tenantId)
      .eq("order_id", order.id)
      .select("id"),
  );
  await expectRpcError(
    "Fully delivered order rejects new items",
    supabase.rpc("add_items_to_existing_order", {
      p_tenant_id: created.tenantId,
      p_order_id: order.id,
      p_items: [twoNewItems[0]],
      p_actor_id: marker,
      p_idempotency_key: crypto.randomUUID(),
    }),
    "ORDER_FULLY_DELIVERED",
  );

  await cleanup();
  console.log(`Existing-order add-items DB smoke passed for ${marker}.`);
} catch (error) {
  await cleanup().catch((cleanupError) => {
    console.error(`Cleanup failed: ${cleanupError.message}`);
  });
  throw error;
}
