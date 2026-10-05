import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const cache = new Map();
let role = "owner_admin", writes = 0, reads = 0;
let dbError = { code: "23505", message: "PRIVATE_DATABASE_DETAIL" };
const uuid = "11111111-1111-4111-8111-111111111111";
const navigation = {
  redirect() { const error = new Error("NEXT_REDIRECT"); error.digest = "NEXT_REDIRECT"; throw error; },
  unstable_rethrow(error) { if (error?.digest === "NEXT_REDIRECT") throw error; },
};
function query(table) {
  const builder = {
    select() { return builder; }, eq() { return builder; }, is() { return builder; },
    async maybeSingle() { reads++; return { data: { id: uuid, channel: "email" }, error: null }; },
    async insert(row) { writes++; assert.equal(row.tenant_id, "tenant-a"); return { error: dbError }; },
    then(resolve, reject) { reads++; return Promise.resolve({ data: table === "item_type_measurement_fields" ? [{ field_key: "chest" }] : [], error: null }).then(resolve, reject); },
  };
  return builder;
}
function loadModule(path) {
  if (cache.has(path)) return cache.get(path);
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    module: loaded, exports: loaded.exports, FormData, Error,
    require(id) {
      if (id === "zod") return require("zod");
      if (id === "next/cache") return { revalidatePath() {} };
      if (id === "next/navigation") return navigation;
      if (id === "next/headers") return {};
      if (id.endsWith("/permissions/roles")) return loadModule("src/lib/permissions/roles.ts");
      if (id.endsWith("/settings/dialog-feedback")) return loadModule("src/features/settings/dialog-feedback.ts");
      if (id.endsWith("/tenant/context")) return { requireTenantContext: async () => ({ tenant: { id: "tenant-a" }, membership: { role, clerk_user_id: "actor-a" } }) };
      if (id.endsWith("/supabase/server")) return { createSupabaseServiceRoleClient: () => ({ from: query, rpc: async (_name, args) => { writes++; assert.equal(args.p_tenant_id, "tenant-a"); return { data: dbError ? null : uuid, error: dbError }; } }) };
      if (id.endsWith("/item-type-icon")) return { normalizeItemTypeIcon: () => ({ kind: null, emoji: null, name: null, color: null }) };
      if (id.endsWith("/tenant/assets") || id.endsWith("/settings/defaults")) return {};
      if (id.endsWith("/communications/rendering")) return { safeCommunicationVariables: ["order_number"] };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  cache.set(path, loaded.exports);
  return loaded.exports;
}
const modules = ["settings", "workflows", "communications", "tenant-users"].map(name => loadModule(`src/features/${name}/actions.ts`));
const names = ["createItemTypeAction", "createStageAction", "createCustomerStatusAction", "createWorkgroupAction", "createPaymentModeAction", "createExpenseCategoryAction", "createTenantLocationAction", "createTeamAction", "addTeamMemberAction", "createMeasurementFieldAction", "createStandardSizeAction", "createWorkflowAction", "addStageWorkgroupAction", "createCommunicationTemplateAction", "createCommunicationTriggerRuleAction", "createTenantUserAction"];
function validForm() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Synthetic record", description: "", code: "SYNTH", locationType: "store", locationId: "", countryCode: "IN", itemTypeId: uuid, fieldKey: "chest", fieldLabel: "Chest", sizeLabel: "M", teamId: uuid, tenantUserId: uuid, stageMasterId: uuid, workgroupId: uuid, stageId_1: uuid, channel: "email", purpose: "order_update", bodyText: "Order {{order_number}}", triggerType: "order_confirmed", templateId: uuid, email: "synthetic@example.invalid", role: "manager", status: "active" })) data.set(key, value);
  data.set("measurementKeys", "chest"); data.set("measurementValues", "40");
  for (const key of ["addressLine1", "addressLine2", "area", "city", "state", "postalCode", "unit", "helpText"]) data.set(key, "");
  return data;
}
for (const name of names) {
  const action = modules.find(loaded => name in loaded)[name];
  const data = validForm();
  const result = await action(data);
  if (!["addTeamMemberAction", "addStageWorkgroupAction"].includes(name)) {
    assert.equal(result?.ok, false, `${name}: duplicate must not signal success`);
    assert.match(result.message, /already exists|already mapped/i);
  }
  role = "manager";
  const before = reads + writes;
  await assert.rejects(action(data), /Permission denied/);
  assert.equal(reads + writes, before, `${name}: unauthorized create must not reach the database`);
  role = "owner_admin";
  const invalid = await action(new FormData());
  assert.equal(invalid?.ok, false, `${name}: validation must be structured`);
  dbError = { code: "XX000", message: "PRIVATE_DATABASE_DETAIL" };
  const failure = await action(data);
  assert.equal(failure?.ok, false, `${name}: unexpected database failure must be structured`);
  assert.doesNotMatch(failure.message, /PRIVATE_DATABASE_DETAIL/);
  dbError = null;
  if (name === "createWorkflowAction") await assert.rejects(action(data), /NEXT_REDIRECT/, "successful workflow redirect must not be swallowed");
  else { const success = await action(data); assert.ok(success === undefined || success.ok === true, `${name}: authorized success`); }
  dbError = { code: "23505", message: "PRIVATE_DATABASE_DETAIL" };
}
const duplicateSequence = validForm(); duplicateSequence.set("stageId_2", uuid);
assert.match((await modules[1].createWorkflowAction(duplicateSequence)).message, /same stage/);
const unsafe = validForm(); unsafe.set("bodyText", "{{salary_amount}}");
assert.match((await modules[2].createCommunicationTemplateAction(unsafe)).message, /approved customer-message variables/);
console.log("All 16 settings popup actions: conflicts, validation, private-error redaction, owner success, unauthorized boundaries, and redirect preservation passed.");
