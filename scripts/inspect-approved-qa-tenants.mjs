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
const approvedDisplayNames = ["Fundry Laundry", "Phantom Threads Test"];
const { data: tenants, error } = await supabase
  .from("tenants")
  .select("id, name, store_name, slug, status")
  .or("store_name.eq.Fundry Laundry,name.eq.Phantom Threads Test")
  .order("name");

if (error) {
  throw new Error(`Unable to load approved QA tenants: ${error.message}`);
}

if (
  (tenants ?? []).length !== approvedDisplayNames.length ||
  !approvedDisplayNames.every((displayName) =>
    (tenants ?? []).some(
      (tenant) =>
        tenant.name === displayName || tenant.store_name === displayName,
    ),
  )
) {
  throw new Error("Both explicitly approved QA tenants were not found.");
}

for (const tenant of tenants ?? []) {
  const [workers, categories] = await Promise.all([
    supabase
      .from("workers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "active")
      .is("deleted_at", null),
    supabase
      .from("expense_categories")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null),
  ]);

  if (workers.error || categories.error) {
    throw new Error(`Unable to inspect ${tenant.name}.`);
  }

  console.log(
    JSON.stringify({
      ...tenant,
      activeWorkerCount: workers.count ?? 0,
      expenseCategoryCount: categories.count ?? 0,
    }),
  );
}
