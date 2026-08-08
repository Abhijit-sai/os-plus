import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    process.env[trimmed.slice(0, separator).trim()] ??= trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
  }
}

if (process.env.OS_PLUS_PAYMENT_INTEGRITY_DB_SMOKE !== "1") {
  console.log("Payment-integrity DB smoke skipped. Set OS_PLUS_PAYMENT_INTEGRITY_DB_SMOKE=1 only for an approved QA database.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase QA credentials.");
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const marker = `payment-integrity-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
let tenantId;
let foreignTenantId;
let customerId;
let orderId;

async function rows(label, request) {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

try {
  const tenants = await rows("Load two QA tenants", supabase.from("tenants").select("id").eq("status", "active").limit(2));
  assert.equal(tenants.length, 2, "Two active QA tenants are required for tenant-isolation coverage.");
  tenantId = tenants[0].id;
  foreignTenantId = tenants[1].id;

  const [customer] = await rows("Create smoke customer", supabase.from("customers").insert({ tenant_id: tenantId, name: marker }).select("id"));
  customerId = customer.id;
  const [order] = await rows("Create smoke order", supabase.from("orders").insert({
    tenant_id: tenantId,
    customer_id: customerId,
    order_number: marker,
    tracking_token: crypto.randomUUID().replaceAll("-", ""),
    subtotal: 100,
    total_amount: 100,
  }).select("id"));
  orderId = order.id;

  const paymentArgs = (amount) => ({
    p_tenant_id: tenantId,
    p_order_id: orderId,
    p_amount: amount,
    p_payment_mode_id: null,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_reference_number: marker,
    p_notes: "Concurrency smoke",
    p_actor_id: "codex-payment-smoke",
  });
  const concurrent = await Promise.all([
    supabase.rpc("record_order_payment", paymentArgs(60)),
    supabase.rpc("record_order_payment", paymentArgs(60)),
  ]);
  assert.equal(concurrent.filter((result) => !result.error).length, 1, "Only one concurrent over-limit payment may succeed.");
  assert.match(concurrent.find((result) => result.error)?.error?.message ?? "", /PAYMENT_EXCEEDS_ORDER_TOTAL|ORDER_FULLY_PAID/);

  const payments = await rows("Load payment result", supabase.from("order_payments").select("id, amount").eq("tenant_id", tenantId).eq("order_id", orderId).is("deleted_at", null));
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount, 60);

  const correction = await supabase.rpc("correct_order_payment", {
    p_tenant_id: tenantId,
    p_payment_id: payments[0].id,
    p_amount: 50,
    p_payment_mode_id: null,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_reference_number: marker,
    p_notes: "Corrected by smoke test",
    p_reason: "Verify immutable correction history",
    p_actor_id: "codex-payment-smoke",
  });
  if (correction.error) throw new Error(`Correct payment: ${correction.error.message}`);
  const audits = await rows("Load correction audit", supabase.from("order_payment_corrections").select("id, reason, old_value_json, new_value_json").eq("tenant_id", tenantId).eq("payment_id", payments[0].id));
  assert.equal(audits.length, 1);
  assert.equal(audits[0].old_value_json.amount, 60);
  assert.equal(audits[0].new_value_json.amount, 50);

  const directMutation = await supabase.from("order_payment_corrections").update({ reason: "Forbidden direct change" }).eq("id", audits[0].id);
  assert.ok(directMutation.error);
  assert.match(directMutation.error.message, /IMMUTABLE_AUDIT_RECORD/);
  const foreignCorrection = await supabase.rpc("correct_order_payment", {
    p_tenant_id: foreignTenantId,
    p_payment_id: payments[0].id,
    p_amount: 40,
    p_payment_mode_id: null,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_reference_number: null,
    p_notes: null,
    p_reason: "Cross-tenant rejection",
    p_actor_id: "codex-payment-smoke",
  });
  assert.ok(foreignCorrection.error);
  assert.match(foreignCorrection.error.message, /PAYMENT_NOT_FOUND/);
  console.log("Payment concurrency, audit immutability, summary, and tenant-isolation DB smoke passed.");
} finally {
  if (orderId && tenantId) await supabase.from("orders").delete().eq("tenant_id", tenantId).eq("id", orderId);
  if (customerId && tenantId) await supabase.from("customers").delete().eq("tenant_id", tenantId).eq("id", customerId);
}
