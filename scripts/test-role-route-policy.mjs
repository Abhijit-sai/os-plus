import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

import ts from "typescript";

const source = fs.readFileSync("src/lib/permissions/roles.ts", "utf8");
const proxySource = fs.readFileSync("src/proxy.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const sandboxModule = { exports: {} };

vm.runInNewContext(outputText, {
  exports: sandboxModule.exports,
  module: sandboxModule,
  require(id) {
    throw new Error(`Unexpected runtime import in role policy test: ${id}`);
  },
});

const {
  getDefaultTenantRoute,
  getDefaultTenantRouteLabel,
  hasPermission,
  rolePermissions,
} = sandboxModule.exports;

const expectedDefaults = {
  owner_admin: ["/dashboard", "Dashboard"],
  manager: ["/orders", "Orders"],
  finance: ["/finance", "Finance"],
  viewer: ["/reports", "Reports"],
};

for (const [role, [path, label]] of Object.entries(expectedDefaults)) {
  assert.equal(getDefaultTenantRoute(role), path);
  assert.equal(getDefaultTenantRouteLabel(role), label);
}

assert.equal(hasPermission("owner_admin", "dashboard:view"), true);
assert.equal(hasPermission("owner_admin", "settings:view"), true);
assert.equal(hasPermission("manager", "orders:view"), true);
assert.equal(hasPermission("manager", "production:view"), true);
assert.equal(hasPermission("manager", "dashboard:view"), false);
assert.equal(hasPermission("manager", "finance:view"), false);
assert.equal(hasPermission("finance", "finance:view"), true);
assert.equal(hasPermission("finance", "salary:view"), true);
assert.equal(hasPermission("finance", "orders:view"), false);
assert.equal(hasPermission("finance", "dashboard:view"), false);
assert.equal(hasPermission("viewer", "reports:view"), true);
assert.equal(hasPermission("viewer", "orders:view"), false);
assert.equal(hasPermission("viewer", "dashboard:view"), false);

for (const [role, permissions] of Object.entries(rolePermissions)) {
  assert.equal(
    permissions.includes("dashboard:view"),
    role === "owner_admin",
    `${role} dashboard permission must match owner-only dashboard rule`,
  );
}

assert.match(
  proxySource,
  /\/industries\(\.\*\)/,
  "Industry SEO/use-case pages must remain public routes",
);

console.log("Role route policy tests passed");
