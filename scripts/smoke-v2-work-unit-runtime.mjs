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
  console.log("V2 Work Unit DB smoke skipped. Set OS_PLUS_V2_DB_SMOKE=1 to run it.");
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

const actor = "v2_work_unit_smoke";
const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
const now = new Date().toISOString();
const created = {
  customers: [],
  orders: [],
  orderLines: [],
  workUnits: [],
  workflowInstances: [],
  stageInstances: [],
  workLogs: [],
  workflows: [],
  workflowStages: [],
  stageMasters: [],
  workgroups: [],
  workers: [],
  workerWorkgroups: [],
  stageWorkgroups: []
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
      deleted_at: new Date().toISOString()
    })
    .in("id", ids);

  if (result.error) {
    throw new Error(`Cleanup ${tableName}: ${result.error.message}`);
  }
}

async function hardDelete(tableName, ids) {
  if (!ids.length) {
    return;
  }

  const result = await supabase.from(tableName).delete().in("id", ids);

  if (result.error) {
    throw new Error(`Cleanup ${tableName}: ${result.error.message}`);
  }
}

async function cleanup() {
  await softDelete("work_unit_stage_work_logs", created.workLogs);
  await softDelete("work_unit_stage_instances", created.stageInstances);
  await softDelete("work_unit_workflow_instances", created.workflowInstances);
  await softDelete("work_units", created.workUnits);
  await softDelete("order_lines", created.orderLines);
  await softDelete("orders", created.orders);
  await softDelete("workflow_stages", created.workflowStages);
  await softDelete("workflows", created.workflows);
  await hardDelete("worker_workgroups", created.workerWorkgroups);
  await hardDelete("stage_workgroups", created.stageWorkgroups);
  await softDelete("stage_master", created.stageMasters);
  await softDelete("workers", created.workers);
  await softDelete("workgroups", created.workgroups);
  await softDelete("customers", created.customers);
}

try {
  const laundryVertical = await maybeSingle(
    "Load laundry vertical",
    supabase.from("vertical_definitions").select("id").eq("key", "laundry").eq("is_active", true).maybeSingle()
  );

  assert.ok(laundryVertical, "Laundry vertical must exist and be active.");

  const tenantVertical = await maybeSingle(
    "Load laundry-enabled tenant",
    supabase
      .from("tenant_verticals")
      .select("tenant_id")
      .eq("vertical_definition_id", laundryVertical.id)
      .eq("is_enabled", true)
      .limit(1)
      .maybeSingle()
  );

  assert.ok(tenantVertical, "At least one tenant must have laundry enabled.");

  const tenant = await maybeSingle(
    "Load active tenant",
    supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenantVertical.tenant_id)
      .eq("status", "active")
      .maybeSingle()
  );

  assert.ok(tenant, "Laundry-enabled tenant must be active.");

  const foreignTenant = await maybeSingle(
    "Load foreign active tenant",
    supabase
      .from("tenants")
      .select("id, name, slug")
      .neq("id", tenant.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
  );

  assert.ok(foreignTenant, "TI-005 requires a second active tenant for cross-tenant negative checks.");

  const customer = await single(
    "Create smoke customer",
    supabase
      .from("customers")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Work Unit Smoke ${suffix}`,
        phone: null,
        email: null,
        address: null,
        notes: "Temporary V2 smoke record.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.customers.push(customer.id);

  const workgroup = await single(
    "Create smoke workgroup",
    supabase
      .from("workgroups")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Smoke Workgroup ${suffix}`,
        description: "Temporary V2 smoke workgroup.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.workgroups.push(workgroup.id);

  const worker = await single(
    "Create smoke worker",
    supabase
      .from("workers")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Smoke Worker ${suffix}`,
        status: "active",
        primary_workgroup_id: workgroup.id,
        wage_type: "daily",
        wage_amount: 0,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.workers.push(worker.id);

  const workerWorkgroup = await single(
    "Create smoke worker-workgroup",
    supabase
      .from("worker_workgroups")
      .insert({
        tenant_id: tenant.id,
        worker_id: worker.id,
        workgroup_id: workgroup.id,
        created_by: actor
      })
      .select("id")
      .single()
  );
  created.workerWorkgroups.push(workerWorkgroup.id);

  const stageOne = await single(
    "Create smoke stage one",
    supabase
      .from("stage_master")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Smoke Stage A ${suffix}`,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  const stageTwo = await single(
    "Create smoke stage two",
    supabase
      .from("stage_master")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Smoke Stage B ${suffix}`,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.stageMasters.push(stageOne.id, stageTwo.id);

  const stageWorkgroups = await single(
    "Create smoke stage workgroups",
    supabase
      .from("stage_workgroups")
      .insert([
        {
          tenant_id: tenant.id,
          stage_master_id: stageOne.id,
          workgroup_id: workgroup.id,
          created_by: actor
        },
        {
          tenant_id: tenant.id,
          stage_master_id: stageTwo.id,
          workgroup_id: workgroup.id,
          created_by: actor
        }
      ])
      .select("id")
  );
  created.stageWorkgroups.push(...stageWorkgroups.map((row) => row.id));

  const workflow = await single(
    "Create smoke workflow",
    supabase
      .from("workflows")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Smoke Workflow ${suffix}`,
        description: "Temporary V2 smoke workflow.",
        is_active: true,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.workflows.push(workflow.id);

  const workflowStages = await single(
    "Create smoke workflow stages",
    supabase
      .from("workflow_stages")
      .insert([
        {
          tenant_id: tenant.id,
          workflow_id: workflow.id,
          stage_master_id: stageOne.id,
          sequence_number: 1,
          is_active: true,
          created_by: actor,
          updated_by: actor
        },
        {
          tenant_id: tenant.id,
          workflow_id: workflow.id,
          stage_master_id: stageTwo.id,
          sequence_number: 2,
          is_active: true,
          created_by: actor,
          updated_by: actor
        }
      ])
      .select("id")
  );
  created.workflowStages.push(...workflowStages.map((row) => row.id));

  const order = await single(
    "Create smoke order",
    supabase
      .from("orders")
      .insert({
        tenant_id: tenant.id,
        order_number: `V2-SMOKE-${suffix}`,
        source: "other",
        customer_id: customer.id,
        tracking_token: crypto.randomUUID(),
        vertical_key: "laundry",
        runtime_model: "work_unit_v2",
        notes: "Temporary V2 Work Unit smoke order.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.orders.push(order.id);

  const runtime = await single(
    "Create Work Unit runtime",
    supabase.rpc("create_work_unit_runtime", {
      p_tenant_id: tenant.id,
      p_order_id: order.id,
      p_vertical_key: "laundry",
      p_workflow_id: workflow.id,
      p_display_code: `WU-SMOKE-${suffix}`,
      p_line_name: "V2 Smoke Service",
      p_line_type: "service",
      p_line_description: "Temporary V2 smoke line.",
      p_quantity: 1,
      p_quantity_unit: "unit",
      p_unit_price: 0,
      p_discount_amount: 0,
      p_gst_treatment: "not_applicable",
      p_gst_rate: 0,
      p_actor: actor
    })
  );

  assert.equal(typeof runtime.order_line_id, "string");
  assert.equal(typeof runtime.work_unit_id, "string");
  assert.equal(typeof runtime.workflow_instance_id, "string");
  created.orderLines.push(runtime.order_line_id);
  created.workUnits.push(runtime.work_unit_id);
  created.workflowInstances.push(runtime.workflow_instance_id);

  const initialStages = await single(
    "Load initialized Work Unit stages",
    supabase
      .from("work_unit_stage_instances")
      .select("id, sequence_number, status")
      .eq("tenant_id", tenant.id)
      .eq("work_unit_id", runtime.work_unit_id)
      .order("sequence_number")
  );
  created.stageInstances.push(...initialStages.map((row) => row.id));
  assert.deepEqual(
    initialStages.map((row) => row.status),
    ["ready_to_start", "not_started"]
  );

  const crossTenantWorkUnit = await maybeSingle(
    "TI-005 cross-tenant Work Unit read",
    supabase
      .from("work_units")
      .select("id")
      .eq("tenant_id", foreignTenant.id)
      .eq("id", runtime.work_unit_id)
      .maybeSingle()
  );
  assert.equal(crossTenantWorkUnit, null, "TI-005: foreign tenant must not read Work Unit by guessed ID.");

  const crossTenantStage = await maybeSingle(
    "TI-005 cross-tenant stage read",
    supabase
      .from("work_unit_stage_instances")
      .select("id")
      .eq("tenant_id", foreignTenant.id)
      .eq("id", initialStages[0].id)
      .maybeSingle()
  );
  assert.equal(crossTenantStage, null, "TI-005: foreign tenant must not read Work Unit stage by guessed ID.");

  await expectRpcError(
    "TI-005 cross-tenant stage start",
    supabase.rpc("start_work_unit_stage", {
      p_tenant_id: foreignTenant.id,
      p_stage_instance_id: initialStages[0].id,
      p_worker_id: worker.id,
      p_actor: actor,
      p_notes: "Smoke cross-tenant start should fail."
    }),
    /WORK_UNIT_STAGE_NOT_FOUND/
  );

  await expectRpcError(
    "TI-005 cross-tenant stage completion",
    supabase.rpc("complete_work_unit_stage", {
      p_tenant_id: foreignTenant.id,
      p_stage_instance_id: initialStages[0].id,
      p_actor: actor,
      p_notes: "Smoke cross-tenant completion should fail."
    }),
    /WORK_UNIT_STAGE_NOT_FOUND/
  );

  const firstLogId = await single(
    "Start first Work Unit stage",
    supabase.rpc("start_work_unit_stage", {
      p_tenant_id: tenant.id,
      p_stage_instance_id: initialStages[0].id,
      p_worker_id: worker.id,
      p_actor: actor,
      p_notes: "Smoke start stage one."
    })
  );
  created.workLogs.push(firstLogId);

  const nextStageId = await single(
    "Complete first Work Unit stage",
    supabase.rpc("complete_work_unit_stage", {
      p_tenant_id: tenant.id,
      p_stage_instance_id: initialStages[0].id,
      p_actor: actor,
      p_notes: "Smoke complete stage one."
    })
  );
  assert.equal(nextStageId, initialStages[1].id);

  const secondLogId = await single(
    "Start second Work Unit stage",
    supabase.rpc("start_work_unit_stage", {
      p_tenant_id: tenant.id,
      p_stage_instance_id: initialStages[1].id,
      p_worker_id: worker.id,
      p_actor: actor,
      p_notes: "Smoke start stage two."
    })
  );
  created.workLogs.push(secondLogId);

  const finalNextStageId = await single(
    "Complete second Work Unit stage",
    supabase.rpc("complete_work_unit_stage", {
      p_tenant_id: tenant.id,
      p_stage_instance_id: initialStages[1].id,
      p_actor: actor,
      p_notes: "Smoke complete stage two."
    })
  );
  assert.equal(finalNextStageId, null);

  const completedWorkUnit = await single(
    "Verify completed Work Unit",
    supabase
      .from("work_units")
      .select("status, production_completed_at")
      .eq("tenant_id", tenant.id)
      .eq("id", runtime.work_unit_id)
      .single()
  );
  assert.equal(completedWorkUnit.status, "production_complete");
  assert.ok(completedWorkUnit.production_completed_at);

  await cleanup();

  console.log(`V2 Work Unit DB smoke passed for tenant ${tenant.slug}; TI-005 rejected ${foreignTenant.slug}.`);
} catch (error) {
  await cleanup().catch((cleanupError) => {
    console.error(`Cleanup failed: ${cleanupError.message}`);
  });
  throw error;
}
