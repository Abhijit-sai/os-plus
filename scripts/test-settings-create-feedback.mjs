import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const transpile = (path) => ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const policy = { exports: {} };
vm.runInNewContext(transpile("src/lib/permissions/roles.ts"), { module: policy, exports: policy.exports });
let role = "owner_admin";
let inserts = 0;
let dbError = { code: "23505", message: "duplicate key value" };
const actions = { exports: {} };
vm.runInNewContext(transpile("src/features/settings/actions.ts"), {
  module: actions, exports: actions.exports, FormData,
  require(id) {
    if (id === "zod") return require("zod");
    if (id === "next/cache") return { revalidatePath() {} };
    if (id.endsWith("/permissions/roles")) return policy.exports;
    if (id.endsWith("/tenant/context")) return { requireTenantContext: async () => ({ tenant: { id: "tenant-a" }, membership: { role, clerk_user_id: "actor-a" } }) };
    if (id.endsWith("/supabase/server")) return { createSupabaseServiceRoleClient: () => ({ from: () => ({ insert: async (row) => { inserts++; assert.equal(row.tenant_id, "tenant-a"); return { error: dbError }; } }) }) };
    if (id.endsWith("/item-type-icon")) return { normalizeItemTypeIcon: () => ({ kind: null, emoji: null, name: null, color: null }) };
    if (id.endsWith("/tenant/assets") || id.endsWith("/settings/defaults")) return {};
    if (id.endsWith("/settings/dialog-feedback")) return {};
    throw new Error(`Unexpected import: ${id}`);
  },
});
const names = ["createItemTypeAction", "createStageAction", "createCustomerStatusAction", "createWorkgroupAction", "createPaymentModeAction", "createExpenseCategoryAction"];
for (const name of names) {
  const data = new FormData(); data.set("name", "Synthetic duplicate"); data.set("description", "");
  const result = await actions.exports[name](data);
  assert.equal(result?.ok, false, `${name}: duplicate must not signal success`);
  assert.match(result.message, /already exists/i);
  role = "manager";
  const before = inserts;
  await assert.rejects(actions.exports[name](data), /Permission denied/);
  assert.equal(inserts, before, "Unauthorized create must not reach the database");
  role = "owner_admin";
  dbError = null;
  const success = await actions.exports[name](data);
  assert.ok(success === undefined || success.ok === true);
  dbError = { code: "23505", message: "duplicate key value" };
}
console.log("Settings duplicate feedback, authorized success, and unauthorized-write tests passed.");
