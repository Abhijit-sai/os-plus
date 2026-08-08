import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Missing configured Supabase environment.");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeLegacyPhone(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { canonical: null, category: "blank" };

  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return { canonical: `+${digits}`, category: "explicit_international" };
  }

  if (digits.startsWith("00") && digits.length >= 10 && digits.length <= 17) {
    const internationalDigits = digits.slice(2);
    if (internationalDigits.length >= 8 && internationalDigits.length <= 15) {
      return {
        canonical: `+${internationalDigits}`,
        category: "explicit_international",
      };
    }
  }

  if (/^[6-9]\d{9}$/.test(digits)) {
    return { canonical: `+91${digits}`, category: "legacy_indian" };
  }

  if (/^0[6-9]\d{9}$/.test(digits)) {
    return { canonical: `+91${digits.slice(1)}`, category: "legacy_indian" };
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return { canonical: `+${digits}`, category: "legacy_indian" };
  }

  if (/^0091[6-9]\d{9}$/.test(digits)) {
    return { canonical: `+${digits.slice(2)}`, category: "legacy_indian" };
  }

  return { canonical: null, category: "unresolved" };
}

async function loadAllActiveCustomers() {
  const pageSize = 1000;
  const customers = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, tenant_id, phone")
      .is("deleted_at", null)
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Unable to audit customers: ${error.message}`);
    }

    customers.push(...(data ?? []));
    if ((data ?? []).length < pageSize) break;
  }

  return customers;
}

const [{ data: tenants, error: tenantError }, customers] = await Promise.all([
  supabase.from("tenants").select("id, name, store_name").order("name"),
  loadAllActiveCustomers(),
]);

if (tenantError) {
  throw new Error(`Unable to load tenants: ${tenantError.message}`);
}

const tenantById = new Map((tenants ?? []).map((tenant) => [tenant.id, tenant]));
const reports = new Map();

for (const customer of customers) {
  const report = reports.get(customer.tenant_id) ?? {
    activeCustomers: 0,
    explicitInternationalPhones: 0,
    legacyIndianPhones: 0,
    noPhone: 0,
    unresolvedPhones: 0,
    canonicalGroups: new Map(),
  };
  report.activeCustomers += 1;

  const normalized = normalizeLegacyPhone(customer.phone);
  if (normalized.category === "blank") report.noPhone += 1;
  if (normalized.category === "explicit_international") {
    report.explicitInternationalPhones += 1;
  }
  if (normalized.category === "legacy_indian") report.legacyIndianPhones += 1;
  if (normalized.category === "unresolved") report.unresolvedPhones += 1;

  if (normalized.canonical) {
    const ids = report.canonicalGroups.get(normalized.canonical) ?? [];
    ids.push(customer.id);
    report.canonicalGroups.set(normalized.canonical, ids);
  }

  reports.set(customer.tenant_id, report);
}

const tenantReports = [...reports.entries()].map(([tenantId, report]) => {
  const collisionGroups = [...report.canonicalGroups.entries()].filter(
    ([, ids]) => ids.length > 1,
  );
  const tenant = tenantById.get(tenantId);

  return {
    tenantId,
    tenantDisplayName: tenant?.store_name || tenant?.name || "Unknown tenant",
    activeCustomers: report.activeCustomers,
    noPhone: report.noPhone,
    legacyIndianPhones: report.legacyIndianPhones,
    explicitInternationalPhones: report.explicitInternationalPhones,
    unresolvedPhones: report.unresolvedPhones,
    collisionGroupCount: collisionGroups.length,
    customersInCollisionGroups: collisionGroups.reduce(
      (total, [, ids]) => total + ids.length,
      0,
    ),
    collisionGroups: collisionGroups.map(([canonical, ids]) => ({
      canonicalHash: crypto
        .createHash("sha256")
        .update(canonical)
        .digest("hex")
        .slice(0, 12),
      customerIds: ids,
      recordCount: ids.length,
    })),
  };
});

const totals = tenantReports.reduce(
  (summary, report) => ({
    activeCustomers: summary.activeCustomers + report.activeCustomers,
    collisionGroupCount:
      summary.collisionGroupCount + report.collisionGroupCount,
    customersInCollisionGroups:
      summary.customersInCollisionGroups + report.customersInCollisionGroups,
    explicitInternationalPhones:
      summary.explicitInternationalPhones + report.explicitInternationalPhones,
    legacyIndianPhones:
      summary.legacyIndianPhones + report.legacyIndianPhones,
    noPhone: summary.noPhone + report.noPhone,
    unresolvedPhones: summary.unresolvedPhones + report.unresolvedPhones,
  }),
  {
    activeCustomers: 0,
    collisionGroupCount: 0,
    customersInCollisionGroups: 0,
    explicitInternationalPhones: 0,
    legacyIndianPhones: 0,
    noPhone: 0,
    unresolvedPhones: 0,
  },
);

console.log(JSON.stringify({ totals, tenants: tenantReports }, null, 2));
