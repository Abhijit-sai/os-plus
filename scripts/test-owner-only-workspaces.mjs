import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const transpile = (path) => ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const policy = { exports: {} };
vm.runInNewContext(transpile("src/lib/permissions/roles.ts"), { module: policy, exports: policy.exports, Error });
let role = "manager";
let databaseCalls = 0;
function load(path) {
  const loadedModule = { exports: {} };
  vm.runInNewContext(transpile(path), {
    module: loadedModule, exports: loadedModule.exports, FormData, Date, Error, Buffer,
    require(id) {
      if (id === "zod" || id === "crypto" || id === "node:crypto") return require(id);
      if (id === "server-only" || id === "next/cache" || id.endsWith("/import-parser")) return {};
      if (id.endsWith("/permissions/roles")) return policy.exports;
      if (id.endsWith("/tenant/context")) return { requireTenantContext: async () => ({ tenant: { id: "tenant-a" }, membership: { role } }) };
      if (id.endsWith("/supabase/server")) return { createSupabaseServiceRoleClient() { databaseCalls++; throw new Error("Unauthorized DB access"); } };
      throw new Error(`Unexpected import ${id}`);
    },
  });
  return loadedModule.exports;
}
const attendance = load("src/features/attendance/queries.ts");
const dashboard = load("src/features/dashboard/queries.ts");
const actions = load("src/features/attendance/actions.ts");
const imports = load("src/features/attendance/import-actions.ts");
for (role of ["manager", "finance", "viewer"]) {
  await assert.rejects(attendance.getAttendancePageData(), /Permission denied: attendance:view/);
  await assert.rejects(dashboard.getWorkerContributionReportData({ startDate: "2026-10-01", endDate: "2026-10-02" }), /Permission denied: worker_contributions:view/);
  await assert.rejects(dashboard.getDashboardPageData(), /Permission denied: dashboard:view/);
  await assert.rejects(actions.markAttendanceAction(new FormData()), /Permission denied: attendance:manage/);
  await assert.rejects(actions.markAttendanceSheetAction(new FormData()), /Permission denied: attendance:manage/);
  const result = await imports.attendanceImportAction(new FormData());
  assert.match(result.message, /Permission denied: attendance:manage/);
}
assert.equal(databaseCalls, 0, "Denied report, attendance, and import requests must not initialize the service database client");
console.log("Owner-only report/attendance query, mutation, and import boundaries passed for all unauthorized roles.");
