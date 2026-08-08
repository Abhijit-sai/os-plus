import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [defaultsSource, migration, settingsActions] = await Promise.all([
  readFile(new URL("../src/features/settings/defaults.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260808100000_configuration_editing_and_expense_defaults.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/features/settings/actions.ts", import.meta.url), "utf8")
]);

const expected = [
  "Raw material", "Salary", "Marketing", "Rent", "Travel",
  "Utilities", "Packaging", "Courier", "Maintenance", "Miscellaneous"
];
for (const name of expected) {
  assert.ok(defaultsSource.includes(`"${name}"`), `defaults.ts should include ${name}`);
  assert.ok(migration.includes(`'${name}'`), `tenant trigger should include ${name}`);
}
assert.match(defaultsSource, /defaultExpenseCategories\s*=\s*\[[\s\S]*?\];/);
assert.match(migration, /where not exists[\s\S]*lower\(btrim\(existing\.name\)\) = lower\(default_name\)/i);
assert.match(migration, /create trigger tenants_seed_default_expense_categories[\s\S]*after insert on tenants/i);
assert.match(migration, /for tenant_row in select id from tenants loop[\s\S]*seed_default_expense_categories_for_tenant/i);
assert.doesNotMatch(migration, /update expense_categories set/i, "backfill must not overwrite existing tenant categories");
assert.match(settingsActions, /updateExpenseCategoryAction[\s\S]*\.eq\("tenant_id", context\.tenant\.id\)[\s\S]*\.eq\("id", parsed\.expenseCategoryId\)/);

console.log("Default expense-category provisioning and preservation contracts passed.");
