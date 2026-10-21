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
assert.equal(hasPermission("finance", "workers:view"), true);
assert.equal(hasPermission("finance", "settings:manage"), false);
assert.equal(hasPermission("finance", "orders:view"), false);
assert.equal(hasPermission("finance", "dashboard:view"), false);
assert.equal(hasPermission("viewer", "reports:view"), true);
assert.equal(hasPermission("viewer", "orders:view"), false);
assert.equal(hasPermission("viewer", "dashboard:view"), false);
assert.equal(hasPermission("manager", "salary:view"), false);
assert.equal(hasPermission("manager", "workers:view"), false);
assert.equal(hasPermission("owner_admin", "worker_contribution_amounts:view"), true);
assert.equal(hasPermission("manager", "worker_contribution_amounts:view"), false);

for (const [role, permissions] of Object.entries(rolePermissions)) {
  for (const permission of ["attendance:view", "attendance:manage", "worker_contributions:view", "worker_contribution_amounts:view"]) {
    assert.equal(hasPermission(role, permission), role === "owner_admin", `${role}: ${permission} must be owner/admin-only`);
  }
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


// Chat grants cannot bypass active tenant/module checks through the legacy role API.
for (const role of Object.keys(expectedDefaults)) {
 for (const permission of ["leads:view","leads:manage","leads:pii","chat_settings:manage","chat_reports:view"]) {
  assert.equal(hasPermission(role,permission),false,role+": use the guarded Chat resolver");
 }
}
const zod = await import("zod");
const chatPolicyModule={exports:{}};
const chatPolicySource=ts.transpileModule(fs.readFileSync("src/features/chat/permissions.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
vm.runInNewContext(chatPolicySource,{module:chatPolicyModule,exports:chatPolicyModule.exports,require(name){
 if(name==="zod")return zod;throw new Error("Unexpected Chat policy dependency");
}});
const tenantId="10000000-0000-4000-8000-000000000001";
const chatAccess={tenantId,tenantActive:true,moduleEnabled:true,membership:{tenantId,status:"active",role:"manager"},grants:[]};
assert.equal(chatPolicyModule.exports.canUseChat(chatAccess,"leads:manage"),true);
assert.equal(chatPolicyModule.exports.canUseChat({...chatAccess,moduleEnabled:false},"leads:manage"),false);
assert.equal(chatPolicyModule.exports.canUseChat(chatAccess,"chat_reports:view"),false);
console.log("Chat guarded role integration tests passed");


// Execute the actual proxy callback: only exact authenticated-provider POST routes bypass Clerk.
const proxyModule={exports:{}};
vm.runInNewContext(ts.transpileModule(proxySource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
 module:proxyModule,exports:proxyModule.exports,URL,
 require(name){if(name==="@clerk/nextjs/server")return{clerkMiddleware:callback=>callback,createRouteMatcher:()=>()=>false};throw new Error("Unexpected proxy dependency");}
});
const hook="/api/chat/webhooks/chatwoot/"+"a".repeat(32);
for(const [method,path,protectedRoute] of [
 ["POST",hook+"/events",false],["POST",hook+"/agent",false],
 ["GET",hook+"/events",true],["POST",hook+"/events/extra",true],
 ["POST","/api/chat/webhooks/chatwoot/short/events",true],
 ["POST","/api/chat/cron/stages",false],["GET","/api/chat/cron/stages",true],["POST","/api/chat/cron/stages/extra",true],["POST","/api/chat/cron/hourly",true],["POST","/settings/chat",true],
 ["GET","/chat/panel",false],["POST","/chat/panel",true],["GET","/chat/panel/extra",true],["GET","/leads",true],
 ["POST","/api/integrations/shopify/orders-webhook",false],
 ["POST","/api/integrations/shopify/worker",false],
 ["GET","/api/integrations/shopify/worker",true],
 ["POST","/api/integrations/shopify/orders-webhook/extra",true],
]) {
 let calls=0;await proxyModule.exports.default({protect:async()=>{calls++;}},new Request("https://app.example.invalid"+path,{method}));
 assert.equal(calls,protectedRoute?1:0,method+" "+path);
}
console.log("Exact Chat/Shopify ingress proxy tests passed (18 cases)");
