import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const rowCount = 1205;
const tenantId = "tenant-a";
const common = { tenant_id: tenantId, deleted_at: null, status: "completed", completed_at: "2026-10-01T12:00:00.000Z" };
const tables = {
  item_stage_work_logs: Array.from({ length: rowCount }, (_, i) => ({ ...common, id: `log-${i}`, stage_instance_id: `stage-${i}`, order_item_id: `item-${i}`, worker_id: "worker", workgroup_id: "group", credited_units: 1, credited_minutes: 60, calculated_contribution_amount: 100 })),
  item_stage_instances: Array.from({ length: rowCount }, (_, i) => ({ ...common, id: `stage-${i}`, stage_master_id: "master", effort_tracking_mode_snapshot: "units", contribution_method_snapshot: "per_unit" })),
  order_items: Array.from({ length: rowCount }, (_, i) => ({ ...common, id: `item-${i}`, item_type_id: "type" })),
  workers: [{ ...common, id: "worker", name: "Synthetic worker" }],
  item_types: [{ ...common, id: "type", name: "Shirt" }],
  stage_master: [{ ...common, id: "master", name: "Stitching" }],
  workgroups: [{ ...common, id: "group", name: "Stitchers" }],
};
const calls = [];
let readFailure = false;
function query(table) {
  const predicates = [];
  let from = 0, to = 999;
  const builder = {
    select() { return builder; }, order() { return builder; },
    eq(field, value) { predicates.push([field, "eq", value]); return builder; },
    is(field, value) { return builder.eq(field, value); },
    in(field, value) { predicates.push([field, "in", value]); return builder; },
    gte(field, value) { predicates.push([field, "gte", value]); return builder; },
    lt(field, value) { predicates.push([field, "lt", value]); return builder; },
    range(start, end) { from = start; to = end; return builder; },
    then(resolve, reject) {
      calls.push({ table, predicates, from, to });
      assert.ok(predicates.some(([field, op, value]) => field === "tenant_id" && op === "eq" && value === tenantId));
      const rows = tables[table].filter(row => predicates.every(([field, op, value]) => op === "in" ? value.includes(row[field]) : op === "gte" ? row[field] >= value : op === "lt" ? row[field] < value : row[field] === value));
      return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: readFailure && table === "order_items" ? { message: "Synthetic failure" } : null }).then(resolve, reject);
    },
  };
  return builder;
}
const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/features/dashboard/queries.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
  module: loaded, exports: loaded.exports,
  require(id) {
    if (id === "server-only") return {};
    if (id.endsWith("/permissions/roles")) return { assertPermission() {}, hasPermission() { return true; } };
    if (id.endsWith("/tenant/context")) return { requireTenantContext: async () => ({ tenant: { id: tenantId }, membership: { role: "owner_admin" } }) };
    if (id.endsWith("/supabase/server")) return { createSupabaseServiceRoleClient: () => ({ from: query }) };
    throw new Error(`Unexpected import ${id}`);
  },
});
const options = { startDate: "2026-10-01", endDate: "2026-10-02" };
const report = await loaded.exports.getWorkerContributionReportData(options);
assert.equal(report.logs.length, rowCount, "All completed logs beyond the response cap must be reported");
assert.equal(report.logs.reduce((sum, log) => sum + log.calculatedContributionAmount, 0), rowCount * 100);
assert.ok(report.logs.every(log => log.itemTypeId === "type" && log.stageId === "master" && log.rateConfigured), "Category, stage, and rate coverage must resolve beyond 1000 rows");
assert.ok(calls.filter(call => call.table === "order_items").every(call => call.predicates.some(([field, op, value]) => field === "id" && op === "in" && value.length <= 500)), "Item lookup must be bounded to referenced IDs");
readFailure = true;
await assert.rejects(() => loaded.exports.getWorkerContributionReportData(options), /Synthetic failure/);
console.log("Complete contribution totals, categories, coverage, tenant boundaries and query-error regression beyond 1000 rows passed.");
