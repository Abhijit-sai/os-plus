import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [actions, customerActions, dialog, migration, roles, types] = await Promise.all([
  readFile(new URL("../src/features/customers/import-actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/customers/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/customers/customer-import-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260809100000_customer_import_and_phone_identity.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/permissions/roles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/types/database.ts", import.meta.url), "utf8"),
]);

assert.match(actions, /assertPermission\(context\.membership\.role, "customer_imports:manage"\)/);
assert.match(actions, /MAX_FILE_BYTES = 5 \* 1024 \* 1024/);
assert.match(actions, /expectedPreviewFingerprint/);
assert.match(actions, /existingCustomer:/);
assert.match(customerActions, /normalizeCustomerPhone/);
assert.doesNotMatch(customerActions, /valid 10-digit Indian mobile number/);
assert.match(actions, /reviewDecisions/);
assert.match(actions, /\.rpc\("import_customer_rows"/);
assert.match(roles, /owner_admin:[\s\S]*"customer_imports:manage"/);
assert.doesNotMatch(roles.match(/manager:\s*\[[\s\S]*?\],\s*finance:/)?.[0] ?? "", /customer_imports:manage/);

assert.match(dialog, /preventClose=\{pending\}/);
assert.match(dialog, /disabled=\{pending/);
assert.match(dialog, /pendingLabel="Importing customers\.\.\."/);
assert.match(dialog, /Create separate customer/);
assert.match(dialog, /Reuse \{row\.existingCustomerName/);
assert.match(dialog, /Skip this row/);
assert.match(dialog, /Showing every email decision plus the first 200 other rows/);
assert.match(dialog, /<ConflictList conflicts=\{row\.conflicts\}/);

assert.match(migration, /create unique index customers_tenant_normalized_phone_active_idx/i);
assert.match(migration, /where deleted_at is null and normalized_phone_e164 is not null/i);
assert.match(migration, /create table customer_external_identities/i);
assert.match(migration, /create table customer_imports/i);
assert.match(migration, /customer_imports_immutable/i);
assert.match(migration, /pg_advisory_xact_lock/i);
assert.match(migration, /EXTERNAL_ID_PHONE_CUSTOMER_CONFLICT/i);
assert.match(migration, /PREVIEW_STALE_CUSTOMER_MATCH/i);
assert.match(migration, /grant execute on function import_customer_rows[\s\S]*to service_role/i);
assert.match(migration, /revoke all on function import_customer_rows[\s\S]*from public, anon, authenticated/i);
assert.match(types, /customer_external_identities:/);
assert.match(types, /customer_imports:[\s\S]*Update: never;/);
assert.match(types, /import_customer_rows:/);

console.log("Customer import permission, UI, schema, and atomic-RPC contracts passed.");
