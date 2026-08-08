import assert from "node:assert/strict";
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
  console.log("V2 Boutique legacy contract smoke skipped. Set OS_PLUS_V2_DB_SMOKE=1 to run it.");
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appBaseUrl = (process.env.OS_PLUS_APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function query(label, request) {
  const result = await request;

  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? [];
}

async function maybeSingle(label, request) {
  const result = await request;

  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  return result.data ?? null;
}

async function findBoutiqueTenantWithLegacyRuntime() {
  const boutiqueVertical = await maybeSingle(
    "Load boutique vertical",
    supabase.from("vertical_definitions").select("id").eq("key", "boutique").eq("is_active", true).maybeSingle()
  );

  assert.ok(boutiqueVertical, "Boutique vertical must exist and be active.");

  const tenantVerticals = await query(
    "Load boutique-enabled tenants",
    supabase
      .from("tenant_verticals")
      .select("tenant_id")
      .eq("vertical_definition_id", boutiqueVertical.id)
      .eq("is_enabled", true)
      .limit(20)
  );

  assert.ok(tenantVerticals.length > 0, "At least one tenant must have Boutique enabled.");

  for (const tenantVertical of tenantVerticals) {
    const tenant = await maybeSingle(
      "Load active boutique tenant",
      supabase
        .from("tenants")
        .select("id, name, slug")
        .eq("id", tenantVertical.tenant_id)
        .eq("status", "active")
        .maybeSingle()
    );

    if (!tenant) {
      continue;
    }

    const orders = await query(
      "Load legacy Boutique orders",
      supabase
        .from("orders")
        .select("id, order_number, tracking_token, runtime_model, vertical_key, amount_paid, payment_status")
        .eq("tenant_id", tenant.id)
        .eq("runtime_model", "legacy_item_v1")
        .eq("vertical_key", "boutique")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(25)
    );

    if (!orders.length) {
      continue;
    }

    const orderIds = orders.map((order) => order.id);
    const orderItems = await query(
      "Load legacy Boutique order items",
      supabase
        .from("order_items")
        .select("id, order_id, name, item_status, customer_status_id, is_customer_visible")
        .eq("tenant_id", tenant.id)
        .in("order_id", orderIds)
        .is("deleted_at", null)
    );

    if (!orderItems.length) {
      continue;
    }

    const itemIds = orderItems.map((item) => item.id);
    const workflowInstances = await query(
      "Load legacy item workflow instances",
      supabase
        .from("item_workflow_instances")
        .select("id, order_item_id, workflow_id, status, current_stage_instance_id")
        .eq("tenant_id", tenant.id)
        .in("order_item_id", itemIds)
        .is("deleted_at", null)
    );

    if (!workflowInstances.length) {
      continue;
    }

    return {
      tenant,
      orders,
      orderItems,
      workflowInstances
    };
  }

  throw new Error("No active Boutique tenant with legacy order_items and item workflow instances was found.");
}

function extractMainText(html) {
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  const source = mainMatch?.[0] ?? html;

  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const boutique = await findBoutiqueTenantWithLegacyRuntime();
const orderIds = boutique.orders.map((order) => order.id);
const itemIds = boutique.orderItems.map((item) => item.id);
const workflowInstanceIds = boutique.workflowInstances.map((instance) => instance.id);

const [stageInstances, workLogs, payments, workUnits, communicationQueue] = await Promise.all([
  query(
    "Load legacy item stage instances",
    supabase
      .from("item_stage_instances")
      .select("id, order_item_id, workflow_instance_id, status, sequence_number")
      .eq("tenant_id", boutique.tenant.id)
      .in("workflow_instance_id", workflowInstanceIds)
      .is("deleted_at", null)
  ),
  query(
    "Load legacy item stage work logs",
    supabase
      .from("item_stage_work_logs")
      .select("id, order_item_id, stage_instance_id, status")
      .eq("tenant_id", boutique.tenant.id)
      .in("order_item_id", itemIds)
      .is("deleted_at", null)
  ),
  query(
    "Load legacy order payments",
    supabase
      .from("order_payments")
      .select("id, order_id, amount")
      .eq("tenant_id", boutique.tenant.id)
      .in("order_id", orderIds)
      .is("deleted_at", null)
  ),
  query(
    "Ensure no Work Units exist for legacy Boutique orders",
    supabase
      .from("work_units")
      .select("id, order_id")
      .eq("tenant_id", boutique.tenant.id)
      .in("order_id", orderIds)
      .is("deleted_at", null)
  ),
  query(
    "Load Boutique communication queue",
    supabase
      .from("communication_message_queue")
      .select("id, order_id, status")
      .eq("tenant_id", boutique.tenant.id)
      .in("order_id", orderIds)
      .is("deleted_at", null)
  )
]);

assert.ok(stageInstances.length > 0, "Legacy item workflow stage instances must exist.");
assert.ok(workLogs.length > 0, "Legacy item work logs/history must exist.");
assert.ok(payments.length > 0, "Legacy partial payments must remain in order_payments.");
assert.equal(workUnits.length, 0, "Legacy Boutique orders must not be migrated to Work Units.");
assert.ok(communicationQueue.length > 0, "Boutique communications queue evidence must remain available.");

const publicOrder = boutique.orders.find((order) => order.tracking_token);
assert.ok(publicOrder, "A Boutique order with a tracking token is required for public tracking smoke.");

const validTracking = await fetch(`${appBaseUrl}/track/${publicOrder.tracking_token}`);
assert.equal(validTracking.status, 200, "Valid Boutique tracking token should load.");
const validTrackingHtml = await validTracking.text();
const validTrackingText = extractMainText(validTrackingHtml);
assert.ok(validTrackingText.includes(publicOrder.order_number), "Public tracking should show the order number.");
assert.doesNotMatch(validTrackingText, /salary|worker productivity|internal notes/i);

const invalidTracking = await fetch(`${appBaseUrl}/track/not-a-real-v2-boutique-token`);
assert.equal(invalidTracking.status, 404, "Invalid Boutique tracking token should return not found.");

console.log(
  [
    `V2 Boutique legacy contract smoke passed for tenant ${boutique.tenant.slug}.`,
    `Orders: ${boutique.orders.length}`,
    `Items: ${boutique.orderItems.length}`,
    `Workflow instances: ${boutique.workflowInstances.length}`,
    `Stage instances: ${stageInstances.length}`,
    `Work logs: ${workLogs.length}`,
    `Payments: ${payments.length}`,
    `Communication queue rows: ${communicationQueue.length}`
  ].join(" ")
);
