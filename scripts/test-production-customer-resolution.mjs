import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const tenantId = "tenant-a";
const items = [{ id: "item-a", order_id: "order-a" }, { id: "item-b", order_id: "order-b" }];
const orders = [{ id: "order-a", customer_id: "customer-1234", order_number: "ORD-000005" }, { id: "order-b", customer_id: "customer-1235", order_number: "ORD-000012" }];
const customers = Array.from({ length: 1235 }, (_, index) => ({ id: `customer-${index + 1}`, name: `Synthetic customer ${index + 1}` }));
let empty = false, queryFailure = false;
const queried = [];
function databaseQuery(table) {
  const filters = [];
  const query = {
    select() { return query; }, eq(field, value) { filters.push(["eq", field, value]); return query; },
    is() { return query; }, order() { return query; }, limit() { return query; },
    in(field, values) { filters.push(["in", field, values]); return query; },
    then(resolve, reject) {
      queried.push({ table, filters });
      assert.ok(filters.some(([kind, field, value]) => kind === "eq" && field === "tenant_id" && value === tenantId), "All production/customer reads must be tenant scoped");
      let rows = table === "order_items" ? (empty ? [] : items) : table === "orders" ? orders : table === "customers" ? customers : [];
      for (const [kind, field, values] of filters) if (kind === "in") rows = rows.filter((row) => values.includes(row[field]));
      // Reproduce the shared PostgREST response cap AFTER server predicates.
      rows = rows.slice(0, 1000);
      return Promise.resolve({ data: rows, error: queryFailure && table === "customers" ? { message: "Synthetic read failed" } : null }).then(resolve, reject);
    },
  };
  return query;
}
const loaded = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync("src/features/production/queries.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
vm.runInNewContext(compiled, {
  module: loaded, exports: loaded.exports,
  require(id) {
    if (id === "server-only") return {};
    if (id === "zod") return require("zod");
    if (id === "next/navigation") return { notFound() { throw new Error("NOT_FOUND"); } };
    if (id.endsWith("/tenant/context")) return { requireTenantContext: async () => ({ tenant: { id: tenantId }, membership: { role: "manager" } }) };
    if (id.endsWith("/supabase/server")) return { createSupabaseServiceRoleClient: () => ({ from: databaseQuery }) };
    throw new Error(`Unexpected import ${id}`);
  },
});
const result = await loaded.exports.getProductionPageData({ itemTypeIds: [], workflowIds: [] });
for (const order of result.orders) {
  assert.ok(result.customers.some((customer) => customer.id === order.customer_id), `Linked customer beyond the first 1000 must resolve for ${order.order_number}`);
}
assert.equal(result.customers.length, 2, "Load only referenced customers rather than the directory");
assert.ok(queried.filter((call) => call.table === "orders").every((call) => call.filters.some(([kind, field]) => kind === "in" && field === "id")), "Displayed items determine the bounded order lookup");
assert.ok(queried.filter((call) => call.table === "customers").every((call) => call.filters.some(([kind, field]) => kind === "in" && field === "id")), "Displayed orders determine the bounded customer lookup");
empty = true; queried.length = 0;
const emptyResult = await loaded.exports.getProductionPageData({ itemTypeIds: [], workflowIds: [] });
assert.equal(emptyResult.orders.length, 0);
assert.equal(emptyResult.customers.length, 0);
assert.equal(queried.some((call) => ["orders", "customers"].includes(call.table)), false, "Empty board must not load the customer directory");
empty = false; queryFailure = true;
await assert.rejects(() => loaded.exports.getProductionPageData({ itemTypeIds: [], workflowIds: [] }), /Synthetic read failed/, "Read failures must not silently render Unknown customer");
console.log("Production customer resolution beyond 1000, tenant predicates, bounded related reads, empty board and read-failure regression passed.");
