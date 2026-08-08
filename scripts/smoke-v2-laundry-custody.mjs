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
  console.log("V2 Laundry custody DB smoke skipped. Set OS_PLUS_V2_DB_SMOKE=1 to run it.");
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

const actor = "v2_laundry_custody_smoke";
const actorType = "SYSTEM";
const source = "AUTOMATION";
const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
const created = {
  customers: [],
  customerAddresses: [],
  teams: [],
  tenantLocations: [],
  stageMasters: [],
  workflows: [],
  workflowStages: [],
  serviceCatalog: [],
  pickupRequests: [],
  containerAssets: [],
  handlingUnits: [],
  serviceLots: [],
  orders: [],
  orderLines: [],
  workUnits: [],
  workflowInstances: [],
  stageInstances: [],
  tasks: []
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

async function expectMutationError(label, query, expectedMessage) {
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
      deleted_at: new Date().toISOString(),
      updated_by: actor
    })
    .in("id", ids);

  if (result.error) {
    throw new Error(`Cleanup ${tableName}: ${result.error.message}`);
  }
}

async function cleanup() {
  await softDelete("tasks", created.tasks);
  await softDelete("laundry_service_lots", created.serviceLots);
  await softDelete("work_unit_stage_instances", created.stageInstances);
  await softDelete("work_unit_workflow_instances", created.workflowInstances);
  await softDelete("work_units", created.workUnits);
  await softDelete("order_lines", created.orderLines);
  await softDelete("orders", created.orders);
  await softDelete("laundry_handling_units", created.handlingUnits);
  await softDelete("laundry_container_assets", created.containerAssets);
  await softDelete("laundry_pickup_requests", created.pickupRequests);
  await softDelete("laundry_service_catalog", created.serviceCatalog);
  await softDelete("workflow_stages", created.workflowStages);
  await softDelete("workflows", created.workflows);
  await softDelete("stage_master", created.stageMasters);
  await softDelete("tenant_locations", created.tenantLocations);
  await softDelete("teams", created.teams);
  await softDelete("customer_addresses", created.customerAddresses);
  await softDelete("customers", created.customers);
}

function assertCommandResult(value, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must return an object`);
  assert.ok(Array.isArray(value.event_ids), `${label} must return event_ids`);
  assert.ok(value.event_ids.every((eventId) => typeof eventId === "string"), `${label} event_ids must be strings`);
  return value;
}

async function getEvents(eventIds, tenantId) {
  return single(
    "Load domain events",
    supabase.from("domain_events").select("id, event_type, aggregate_type, aggregate_id, actor_type, actor_id, source, correlation_id").eq("tenant_id", tenantId).in("id", eventIds)
  );
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
    "Load active laundry tenant",
    supabase.from("tenants").select("id, name, slug").eq("id", tenantVertical.tenant_id).eq("status", "active").maybeSingle()
  );
  assert.ok(tenant, "Laundry-enabled tenant must be active.");

  const foreignTenant = await maybeSingle(
    "Load foreign active tenant",
    supabase.from("tenants").select("id, name, slug").neq("id", tenant.id).eq("status", "active").limit(1).maybeSingle()
  );
  assert.ok(foreignTenant, "V2-4 tenant-isolation smoke requires a second active tenant.");

  const customer = await single(
    "Create smoke customer",
    supabase
      .from("customers")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Smoke ${suffix}`,
        phone: null,
        email: null,
        address: null,
        notes: "Temporary V2 Laundry custody smoke record.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.customers.push(customer.id);

  const otherCustomer = await single(
    "Create second smoke customer",
    supabase
      .from("customers")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Other Customer ${suffix}`,
        phone: null,
        email: null,
        address: null,
        notes: "Temporary V2 Laundry container-assignment smoke record.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.customers.push(otherCustomer.id);

  const address = await single(
    "Create smoke customer address",
    supabase
      .from("customer_addresses")
      .insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        label: "Smoke pickup",
        address_line_1: "V2 Laundry Smoke Address",
        area: "Smoke Area",
        city: "Smoke City",
        country_code: "IN",
        is_default: true,
        source: "manual",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.customerAddresses.push(address.id);

  const team = await single(
    "Create smoke pickup team",
    supabase
      .from("teams")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Pickup Team ${suffix}`,
        code: `LPU-${suffix}`,
        description: "Temporary V2 Laundry custody smoke team.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.teams.push(team.id);

  const location = await single(
    "Create smoke tenant location",
    supabase
      .from("tenant_locations")
      .insert({
        tenant_id: tenant.id,
        code: `LST-${suffix}`,
        name: `V2 Laundry Store ${suffix}`,
        location_type: "store",
        country_code: "IN",
        is_active: true,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.tenantLocations.push(location.id);

  const stage = await single(
    "Create smoke stage",
    supabase
      .from("stage_master")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Smoke Stage ${suffix}`,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.stageMasters.push(stage.id);

  const workflow = await single(
    "Create smoke workflow",
    supabase
      .from("workflows")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Smoke Workflow ${suffix}`,
        description: "Temporary V2 Laundry service workflow.",
        is_active: true,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.workflows.push(workflow.id);

  const workflowStage = await single(
    "Create smoke workflow stage",
    supabase
      .from("workflow_stages")
      .insert({
        tenant_id: tenant.id,
        workflow_id: workflow.id,
        stage_master_id: stage.id,
        sequence_number: 1,
        is_active: true,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.workflowStages.push(workflowStage.id);

  const service = await single(
    "Create smoke Laundry service",
    supabase
      .from("laundry_service_catalog")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Smoke Wash ${suffix}`,
        code: `WASH-${suffix}`,
        description: "Temporary V2 Laundry service.",
        default_workflow_id: workflow.id,
        default_sla_hours: 24,
        default_quantity_unit: "kg",
        allows_weight: true,
        allows_piece_count: true,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.serviceCatalog.push(service.id);

  const secondService = await single(
    "Create second smoke Laundry service",
    supabase
      .from("laundry_service_catalog")
      .insert({
        tenant_id: tenant.id,
        name: `V2 Laundry Smoke Dry ${suffix}`,
        code: `DRY-${suffix}`,
        description: "Temporary V2 Laundry second service.",
        default_workflow_id: workflow.id,
        default_sla_hours: 48,
        default_quantity_unit: "piece",
        allows_weight: false,
        allows_piece_count: true,
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.serviceCatalog.push(secondService.id);

  const pickupArgs = {
    p_tenant_id: tenant.id,
    p_actor_type: actorType,
    p_actor_id: actor,
    p_source: source,
    p_correlation_id: `corr-pickup-${suffix}`,
    p_idempotency_key: `pickup-${suffix}`,
    p_customer_id: customer.id,
    p_pickup_address_id: address.id,
    p_requested_date: new Date().toISOString().slice(0, 10),
    p_requested_window: "10 AM - 1 PM",
    p_pickup_source: "manual",
    p_assigned_user_id: null,
    p_assigned_team_id: team.id,
    p_scheduled_at: null,
    p_notes: "Smoke pickup request."
  };

  const pickupResult = assertCommandResult(
    await single("Create Laundry pickup request", supabase.rpc("create_laundry_pickup_request_command", pickupArgs)),
    "CreateLaundryPickupRequest"
  );
  created.pickupRequests.push(pickupResult.pickup_request_id);
  created.tasks.push(pickupResult.task_id);
  assert.equal(pickupResult.status, "ASSIGNED");

  const repeatPickupResult = assertCommandResult(
    await single("Repeat idempotent Laundry pickup request", supabase.rpc("create_laundry_pickup_request_command", pickupArgs)),
    "CreateLaundryPickupRequest repeat"
  );
  assert.equal(repeatPickupResult.pickup_request_id, pickupResult.pickup_request_id);
  assert.deepEqual(repeatPickupResult.event_ids, pickupResult.event_ids);

  await expectRpcError(
    "Reuse Laundry pickup idempotency key with different payload",
    supabase.rpc("create_laundry_pickup_request_command", {
      ...pickupArgs,
      p_requested_window: "2 PM - 5 PM"
    }),
    /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/
  );

  const duplicatePickups = await single(
    "Verify idempotent pickup did not duplicate",
    supabase.from("laundry_pickup_requests").select("id").eq("tenant_id", tenant.id).eq("customer_id", customer.id).eq("requested_window", pickupArgs.p_requested_window).is("deleted_at", null)
  );
  assert.equal(duplicatePickups.length, 1);

  await expectRpcError(
    "Failed pickup rolls back",
    supabase.rpc("create_laundry_pickup_request_command", {
      ...pickupArgs,
      p_correlation_id: `corr-pickup-fail-${suffix}`,
      p_idempotency_key: `pickup-fail-${suffix}`,
      p_pickup_address_id: crypto.randomUUID()
    }),
    /PICKUP_ADDRESS_NOT_FOUND/
  );

  const failedPickupEvents = await single(
    "Verify failed pickup created no event",
    supabase.from("domain_events").select("id").eq("tenant_id", tenant.id).eq("correlation_id", `corr-pickup-fail-${suffix}`)
  );
  assert.equal(failedPickupEvents.length, 0);

  const containerArgs = {
    p_tenant_id: tenant.id,
    p_actor_type: actorType,
    p_actor_id: actor,
    p_source: source,
    p_correlation_id: `corr-container-${suffix}`,
    p_idempotency_key: `container-${suffix}`,
    p_container_code: `BAG-${suffix}`,
    p_container_type: "bag",
    p_assigned_customer_id: customer.id,
    p_notes: "Smoke reusable bag."
  };
  const containerResult = assertCommandResult(
    await single("Create Laundry container asset", supabase.rpc("create_laundry_container_asset_command", containerArgs)),
    "CreateLaundryContainerAsset"
  );
  created.containerAssets.push(containerResult.container_asset_id);
  assert.equal(containerResult.container_code, containerArgs.p_container_code);
  assert.ok(typeof containerResult.qr_token === "string" && containerResult.qr_token.length >= 32);

  const repeatContainerResult = assertCommandResult(
    await single("Repeat idempotent Laundry container asset", supabase.rpc("create_laundry_container_asset_command", containerArgs)),
    "CreateLaundryContainerAsset repeat"
  );
  assert.equal(repeatContainerResult.container_asset_id, containerResult.container_asset_id);

  await expectRpcError(
    "Reject container assigned to another customer",
    supabase.from("laundry_handling_units").insert({
      tenant_id: tenant.id,
      handling_unit_code: `HU-MISMATCH-${suffix}`,
      container_asset_id: containerResult.container_asset_id,
      customer_id: otherCustomer.id,
      handling_unit_type: "bag",
      custody_status: "PICKED_UP",
      created_by: actor,
      updated_by: actor
    }),
    /LAUNDRY_CONTAINER_CUSTOMER_MISMATCH/
  );

  const completeArgs = {
    p_tenant_id: tenant.id,
    p_actor_type: actorType,
    p_actor_id: actor,
    p_source: source,
    p_correlation_id: `corr-complete-pickup-${suffix}`,
    p_idempotency_key: `complete-pickup-${suffix}`,
    p_pickup_request_id: pickupResult.pickup_request_id,
    p_handling_unit_type: "bag",
    p_current_location_id: location.id,
    p_container_asset_id: containerResult.container_asset_id,
    p_notes: "Smoke pickup complete."
  };
  const completePickupResult = assertCommandResult(
    await single("Complete Laundry pickup request", supabase.rpc("complete_laundry_pickup_request_command", completeArgs)),
    "CompleteLaundryPickupRequest"
  );
  created.handlingUnits.push(completePickupResult.handling_unit_id);
  created.tasks.push(completePickupResult.intake_task_id);
  assert.ok(completePickupResult.handling_unit_code.startsWith("HU-"));
  assert.ok(typeof completePickupResult.qr_token === "string" && completePickupResult.qr_token.length >= 32);

  const repeatCompleteResult = assertCommandResult(
    await single("Repeat idempotent complete Laundry pickup", supabase.rpc("complete_laundry_pickup_request_command", completeArgs)),
    "CompleteLaundryPickupRequest repeat"
  );
  assert.equal(repeatCompleteResult.handling_unit_id, completePickupResult.handling_unit_id);

  const pickupAfterComplete = await single(
    "Verify pickup completed",
    supabase.from("laundry_pickup_requests").select("status, completed_at").eq("tenant_id", tenant.id).eq("id", pickupResult.pickup_request_id).single()
  );
  assert.equal(pickupAfterComplete.status, "PICKED_UP");
  assert.ok(pickupAfterComplete.completed_at);

  const handlingUnit = await single(
    "Verify handling unit",
    supabase
      .from("laundry_handling_units")
      .select("id, custody_status, customer_id, container_asset_id, qr_identity_id, current_location_id")
      .eq("tenant_id", tenant.id)
      .eq("id", completePickupResult.handling_unit_id)
      .single()
  );
  assert.equal(handlingUnit.custody_status, "AT_STORE");
  assert.equal(handlingUnit.customer_id, customer.id);
  assert.equal(handlingUnit.container_asset_id, containerResult.container_asset_id);
  assert.equal(handlingUnit.current_location_id, location.id);
  assert.ok(handlingUnit.qr_identity_id);

  const custodyEvent = await single(
    "Verify custody event",
    supabase.from("laundry_custody_events").select("*").eq("tenant_id", tenant.id).eq("id", completePickupResult.custody_event_id).single()
  );
  assert.equal(custodyEvent.event_type, "picked_up");
  assert.equal(custodyEvent.handling_unit_id, completePickupResult.handling_unit_id);
  assert.equal(custodyEvent.source, source);

  await expectMutationError(
    "Custody events are append-only",
    supabase.from("laundry_custody_events").update({ notes: "Should not update" }).eq("tenant_id", tenant.id).eq("id", completePickupResult.custody_event_id),
    /LAUNDRY_CUSTODY_EVENTS_ARE_APPEND_ONLY/
  );

  const foreignHandlingUnit = await maybeSingle(
    "TI-006 foreign tenant handling-unit read",
    supabase.from("laundry_handling_units").select("id").eq("tenant_id", foreignTenant.id).eq("id", completePickupResult.handling_unit_id).maybeSingle()
  );
  assert.equal(foreignHandlingUnit, null, "TI-006: foreign tenant must not read Handling Unit by guessed ID.");

  const order = await single(
    "Create smoke Laundry order",
    supabase
      .from("orders")
      .insert({
        tenant_id: tenant.id,
        order_number: `V2-LDY-${suffix}`,
        source: "other",
        customer_id: customer.id,
        tracking_token: crypto.randomUUID(),
        vertical_key: "laundry",
        runtime_model: "work_unit_v2",
        notes: "Temporary V2 Laundry service-lot smoke order.",
        created_by: actor,
        updated_by: actor
      })
      .select("id")
      .single()
  );
  created.orders.push(order.id);

  const serviceLotArgs = {
    p_tenant_id: tenant.id,
    p_actor_type: actorType,
    p_actor_id: actor,
    p_source: source,
    p_correlation_id: `corr-service-lot-${suffix}`,
    p_idempotency_key: `service-lot-${suffix}`,
    p_handling_unit_id: completePickupResult.handling_unit_id,
    p_order_id: order.id,
    p_service_catalog_id: service.id,
    p_quantity: 2.5,
    p_quantity_unit: "kg",
    p_piece_count: 3,
    p_weight_kg: 2.5,
    p_special_instructions: "Smoke wash and fold.",
    p_display_code: `SL-${suffix}`
  };
  const serviceLotResult = assertCommandResult(
    await single("Create Laundry service lot", supabase.rpc("create_laundry_service_lot_command", serviceLotArgs)),
    "CreateLaundryServiceLot"
  );
  created.serviceLots.push(serviceLotResult.service_lot_id);
  created.orderLines.push(serviceLotResult.order_line_id);
  created.workUnits.push(serviceLotResult.work_unit_id);
  created.workflowInstances.push(serviceLotResult.workflow_instance_id);
  assert.equal(serviceLotResult.display_code, serviceLotArgs.p_display_code);

  const repeatServiceLotResult = assertCommandResult(
    await single("Repeat idempotent Laundry service lot", supabase.rpc("create_laundry_service_lot_command", serviceLotArgs)),
    "CreateLaundryServiceLot repeat"
  );
  assert.equal(repeatServiceLotResult.service_lot_id, serviceLotResult.service_lot_id);

  const secondServiceLotArgs = {
    ...serviceLotArgs,
    p_correlation_id: `corr-service-lot-2-${suffix}`,
    p_idempotency_key: `service-lot-2-${suffix}`,
    p_service_catalog_id: secondService.id,
    p_quantity: 3,
    p_quantity_unit: "piece",
    p_piece_count: 3,
    p_weight_kg: null,
    p_special_instructions: "Smoke dry cleaning.",
    p_display_code: `SL2-${suffix}`
  };
  const secondServiceLotResult = assertCommandResult(
    await single("Create second Laundry service lot", supabase.rpc("create_laundry_service_lot_command", secondServiceLotArgs)),
    "CreateLaundryServiceLot second"
  );
  created.serviceLots.push(secondServiceLotResult.service_lot_id);
  created.orderLines.push(secondServiceLotResult.order_line_id);
  created.workUnits.push(secondServiceLotResult.work_unit_id);
  created.workflowInstances.push(secondServiceLotResult.workflow_instance_id);
  assert.equal(secondServiceLotResult.display_code, secondServiceLotArgs.p_display_code);

  const stageInstances = await single(
    "Verify service-lot Work Unit stages",
    supabase
      .from("work_unit_stage_instances")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .eq("work_unit_id", serviceLotResult.work_unit_id)
      .order("sequence_number")
  );
  created.stageInstances.push(...stageInstances.map((row) => row.id));
  assert.equal(stageInstances.length, 1);
  assert.equal(stageInstances[0].status, "ready_to_start");

  const secondStageInstances = await single(
    "Verify second service-lot Work Unit stages",
    supabase
      .from("work_unit_stage_instances")
      .select("id, status")
      .eq("tenant_id", tenant.id)
      .eq("work_unit_id", secondServiceLotResult.work_unit_id)
      .order("sequence_number")
  );
  created.stageInstances.push(...secondStageInstances.map((row) => row.id));
  assert.equal(secondStageInstances.length, 1);
  assert.equal(secondStageInstances[0].status, "ready_to_start");

  const serviceLot = await single(
    "Verify service lot links",
    supabase
      .from("laundry_service_lots")
      .select("work_unit_id, handling_unit_id, order_line_id, service_catalog_id, quantity_unit, piece_count, weight_kg, intake_verified_at")
      .eq("tenant_id", tenant.id)
      .eq("id", serviceLotResult.service_lot_id)
      .single()
  );
  assert.equal(serviceLot.work_unit_id, serviceLotResult.work_unit_id);
  assert.equal(serviceLot.handling_unit_id, completePickupResult.handling_unit_id);
  assert.equal(serviceLot.order_line_id, serviceLotResult.order_line_id);
  assert.equal(serviceLot.service_catalog_id, service.id);
  assert.equal(serviceLot.quantity_unit, "kg");
  assert.equal(serviceLot.piece_count, 3);
  assert.ok(Number(serviceLot.weight_kg) === 2.5);
  assert.ok(serviceLot.intake_verified_at);

  const handlingUnitServiceLots = await single(
    "Verify handling unit supports multiple service lots",
    supabase
      .from("laundry_service_lots")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("handling_unit_id", completePickupResult.handling_unit_id)
      .is("deleted_at", null)
  );
  assert.equal(handlingUnitServiceLots.length, 2);

  const linkedHandlingUnit = await single(
    "Verify handling unit linked to order",
    supabase.from("laundry_handling_units").select("order_id").eq("tenant_id", tenant.id).eq("id", completePickupResult.handling_unit_id).single()
  );
  assert.equal(linkedHandlingUnit.order_id, order.id);

  const serviceLotEvents = await getEvents(
    [
      ...pickupResult.event_ids,
      ...containerResult.event_ids,
      ...completePickupResult.event_ids,
      ...serviceLotResult.event_ids,
      ...secondServiceLotResult.event_ids
    ],
    tenant.id
  );
  const eventTypes = new Set(serviceLotEvents.map((event) => event.event_type));
  for (const expectedEvent of ["pickup.requested", "task.created", "container_asset.created", "pickup.completed", "handling_unit.created", "service_lot.created"]) {
    assert.ok(eventTypes.has(expectedEvent), `Missing ${expectedEvent} event.`);
  }

  const pickupTask = await single(
    "Verify pickup task",
    supabase.from("tasks").select("task_type, subject_type, subject_id, assigned_team_id").eq("tenant_id", tenant.id).eq("id", pickupResult.task_id).single()
  );
  assert.equal(pickupTask.task_type, "PICKUP");
  assert.equal(pickupTask.subject_type, "pickup_request");
  assert.equal(pickupTask.subject_id, pickupResult.pickup_request_id);
  assert.equal(pickupTask.assigned_team_id, team.id);

  const intakeTask = await single(
    "Verify intake task",
    supabase.from("tasks").select("task_type, subject_type, subject_id").eq("tenant_id", tenant.id).eq("id", completePickupResult.intake_task_id).single()
  );
  assert.equal(intakeTask.task_type, "VERIFY_INTAKE");
  assert.equal(intakeTask.subject_type, "handling_unit");
  assert.equal(intakeTask.subject_id, completePickupResult.handling_unit_id);

  await cleanup();

  console.log(
    [
      `V2 Laundry custody DB smoke passed for tenant ${tenant.slug};`,
      `pickup ${pickupResult.pickup_request_id};`,
      `handling unit ${completePickupResult.handling_unit_code};`,
      `service lots ${serviceLotResult.service_lot_id}, ${secondServiceLotResult.service_lot_id};`,
      `TI-006 rejected ${foreignTenant.slug}.`
    ].join(" ")
  );
} catch (error) {
  await cleanup().catch((cleanupError) => {
    console.error(`Cleanup failed: ${cleanupError.message}`);
  });
  throw error;
}
