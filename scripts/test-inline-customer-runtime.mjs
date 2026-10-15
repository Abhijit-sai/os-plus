import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
import { normalizeCustomerPhone } from "../src/features/customers/phone.ts";
import { assertPermission } from "../src/lib/permissions/roles.ts";

// Execute the actual server action; only framework, session and database IO are mocked.
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../src/features/customers/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const phone = "+919876543210";
const duplicate = { code: "23505", message: 'duplicate key value violates unique constraint "customers_tenant_normalized_phone_active_idx"' };
const row = (id, overrides = {}) => ({ id, name: "Synthetic customer", phone: "9876543210", normalized_phone_e164: phone, tenant_id: "tenant-a", deleted_at: null, ...overrides });

function harness({ rows = [], role = "manager", insertError, readError, race = false, cap = 1000, signedIn = true } = {}) {
  const state = { reads: [], inserts: [], clients: 0, invalidated: [] };
  function from(table) {
    assert.equal(table, "customers");
    const filters = [];
    let values, limit = cap, single = false, ordered = false;
    const query = {
      select() { return query; },
      eq(k, v) { filters.push(["eq", k, v]); return query; },
      neq(k, v) { filters.push(["neq", k, v]); return query; },
      is(k, v) { filters.push(["eq", k, v]); return query; },
      not(k, operator, v) { assert.equal(operator, "is"); return query.neq(k, v); },
      gt(k, v) { filters.push(["gt", k, v]); return query; },
      order(k) { assert.equal(k, "id"); ordered = true; return query; },
      limit(n) { limit = Math.min(n, cap); return query; },
      maybeSingle() { single = true; return query; },
      single() { single = true; return query; },
      insert(data) { values = data; return query; },
      then(resolve, reject) {
        return Promise.resolve().then(() => {
          if (values) {
            state.inserts.push(values);
            if (race) rows.push(row("race-winner"));
            if (insertError || race) return { data: null, error: insertError ?? duplicate };
            const created = row("created", values);
            rows.push(created);
            return { data: created, error: null };
          }
          state.reads.push(filters);
          if (readError) return { data: null, error: readError };
          let found = rows.filter(r => filters.every(([op, k, v]) => op === "eq" ? r[k] === v : op === "neq" ? r[k] !== v : r[k] > v));
          if (ordered) found = found.toSorted((a, b) => a.id.localeCompare(b.id));
          found = found.slice(0, limit);
          return { data: single ? found[0] ?? null : found, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  }
  const exports = {};
  vm.runInNewContext(`${compiled}\nexports.lookupForTest = findCustomerByNormalizedMobile;`, {
    exports,
    require: (name) => {
      if (name === "next/cache") return { revalidatePath: path => state.invalidated.push(path) };
      if (name === "next/navigation") return { redirect: () => { throw new Error("redirect"); } };
      if (name === "@/lib/permissions/roles") return { assertPermission };
      if (name === "@/features/customers/phone") return { normalizeCustomerPhone };
      if (name === "@/lib/tenant/context") return { requireTenantContext: async () => {
        if (!signedIn) throw new Error("Authentication required");
        return { tenant: { id: "tenant-a" }, membership: { role, clerk_user_id: "actor" } };
      } };
      if (name === "@/lib/supabase/server") return { createSupabaseServiceRoleClient: () => { state.clients++; return { from }; } };
      return require(name);
    },
  });
  return { state, lookup: exports.lookupForTest, run: (overrides = {}) => {
    const form = new FormData();
    Object.entries({ name: "Synthetic customer", phone, email: "", gender: "", address: "", notes: "", ...overrides }).forEach(([k, v]) => form.set(k, v));
    return exports.createCustomerInlineAction(form);
  } };
}

test("resolves canonical phone beyond the first 1000 customers without inserting", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => row(String(i), { phone: null, normalized_phone_e164: null }));
  // All preceding rows have display phones too: the old scan consumes its entire cap.
  rows.forEach(r => { r.phone = "9123456789"; });
  rows.push(row("target"));
  const h = harness({ rows });
  const result = await h.run();
  assert.equal(result.customer.id, "target");
  assert.equal(result.wasExisting, true);
  assert.equal(h.state.inserts.length, 0);
});

test("canonical-only phone is found even when display phone is null", async () => {
  const h = harness({ rows: [row("target", { phone: null })] });
  assert.equal((await h.run()).customer.id, "target");
  assert.equal(h.state.inserts.length, 0);
});

test("legacy scan paginates even when API cap is smaller than requested page", async () => {
  const rows = Array.from({ length: 11 }, (_, i) => row(String(i).padStart(3, "0"), { phone: "9123456789", normalized_phone_e164: null }));
  rows.push(row("999", { phone: "0091 98765 43210", normalized_phone_e164: null }));
  const h = harness({ rows, cap: 3 });
  assert.equal((await h.run()).customer.id, "999");
  assert.equal(h.state.inserts.length, 0);
});

test("unique collision after lookup resolves winner without a second insert", async () => {
  const h = harness({ race: true });
  const result = await h.run();
  assert.equal(result.customer.id, "race-winner");
  assert.equal(result.wasExisting, true);
  assert.equal(h.state.inserts.length, 1);
});

test("other tenant and deleted customers never resolve, including forged tenant input", async () => {
  const h = harness({ rows: [row("foreign", { tenant_id: "tenant-b" }), row("deleted", { deleted_at: "2026-01-01" })] });
  assert.equal((await h.run({ tenantId: "tenant-b" })).customer.id, "created");
  assert.equal(h.state.inserts[0].tenant_id, "tenant-a");
  for (const filters of h.state.reads) assert.ok(filters.some(([op, k, v]) => op === "eq" && k === "tenant_id" && v === "tenant-a"));
});

for (const role of ["owner_admin", "manager"]) test(`${role} can create; audit actor and normalized phone are server-derived`, async () => {
  const h = harness({ role });
  assert.equal((await h.run()).wasExisting, false);
  assert.equal(h.state.inserts[0].normalized_phone_e164, phone);
  assert.equal(h.state.inserts[0].created_by, "actor");
});
for (const role of ["finance", "viewer"]) test(`${role} denied before database access`, async () => {
  const h = harness({ role });
  await assert.rejects(h.run(), /Permission denied/);
  assert.equal(h.state.clients, 0);
});
test("signed-out request denied before database access", async () => {
  const h = harness({ signedIn: false });
  await assert.rejects(h.run(), /Authentication required/);
  assert.equal(h.state.clients, 0);
});

for (const settings of [
  { insertError: { code: "23505", message: "unrelated_unique SECRET" } },
  { insertError: { code: "XX000", message: "SECRET" } },
  { readError: { code: "XX000", message: "SECRET" } },
  { insertError: duplicate },
]) test(`database failure returns safe state: ${JSON.stringify(settings)}`, async () => {
  const h = harness(settings);
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.equal(typeof result.error, "string");
  assert.doesNotMatch(result.error, /SECRET|23505|constraint|React/);
  assert.equal(result.customer, undefined);
});

test("validation failure returns useful state without any database access", async () => {
  const h = harness();
  const result = await h.run({ phone: "123" });
  assert.equal(result.ok, false);
  assert.match(result.error, /valid/);
  assert.equal(h.state.clients, 0);
});
test("optional blank phone still creates a customer without a lookup", async () => {
  const h = harness();
  assert.equal((await h.run({ phone: "" })).customer.id, "created");
  assert.equal(h.state.reads.length, 0);
});

test("editing excludes the current customer in canonical and legacy lookup", async () => {
  for (const normalized_phone_e164 of [phone, null]) {
    const h = harness({ rows: [row("self", { normalized_phone_e164 })] });
    assert.equal(await h.lookup({ tenantId: "tenant-a", normalizedPhone: phone, excludeCustomerId: "self" }), null);
  }
});

test("legacy work limit returns failure without inserting after a partial scan", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => row(String(i).padStart(3, "0"), { phone: "9123456789", normalized_phone_e164: null }));
  const h = harness({ rows, cap: 1 });
  assert.equal((await h.run()).ok, false);
  assert.equal(h.state.inserts.length, 0);
});

test("canonical number takes precedence over inconsistent display phone", async () => {
  const h = harness({ rows: [row("different", { normalized_phone_e164: "+919123456789" })] });
  assert.equal((await h.run()).wasExisting, false);
});

test("all accepted Indian formats reuse the same canonical customer", async () => {
  const h = harness({ rows: [row("target")] });
  for (const input of ["9876543210", "09876543210", "+91 98765 43210", "0091 98765 43210"]) {
    assert.equal((await h.run({ phone: input })).customer.id, "target");
  }
  assert.equal(h.state.inserts.length, 0);
});

// Invoke the real component's handlers with deterministic hook state, no DOM/network.
const dialogSource = fs.readFileSync(new URL("../src/components/customers/create-customer-dialog.tsx", import.meta.url), "utf8");
const dialogCode = ts.transpileModule(dialogSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function dialogHarness(action) {
  const hooks = [], pending = [], resolved = [];
  let cursor = 0;
  const exports = {};
  vm.runInNewContext(dialogCode, {
    exports, FormData,
    window: { confirm: () => true },
    require(name) {
      if (name === "react") return {
        useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === "function" ? value(hooks[i]) : value; }]; },
        useRef(initial) { const i = cursor++; return hooks[i] ??= { current: initial }; },
        useMemo: fn => fn(), useId: () => "test-action",
        useTransition: () => [false, fn => pending.push(fn())],
      };
      if (name === "@/features/customers/actions") return { createCustomerInlineAction: action };
      if (name === "@/features/customers/phone") return require("../src/features/customers/phone.ts");
      if (name.includes("action-feedback-provider")) return { useActionFeedback: () => null };
      if (name === "react/jsx-runtime") return require(name);
      return new Proxy({}, { get: (_, key) => key });
    },
  });
  function render() {
    cursor = 0;
    const dialog = exports.CreateCustomerDialog({ customers: [], onCustomerResolved: c => resolved.push(c), trigger: "Open" });
    const elements = [];
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(visit);
      elements.push(node);
      visit(node.props?.children);
    }
    visit(dialog.props.children({ close() {} }));
    return { dialog, elements, create: elements.find(e => e.props?.children === "Create customer").props.onClick };
  }
  render().dialog.props.onOpenChange(true);
  render().elements.find(e => e.props?.id === "inlineCustomerName").props.onChange({ target: { value: "Synthetic draft" } });
  return { render, pending, resolved };
}

test("dialog retains draft on safe failure, guards double-click, allows retry and closes on success", async () => {
  let finish, calls = 0;
  const h = dialogHarness(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const click = h.render().create;
  click(); click();
  assert.equal(calls, 1);
  finish({ ok: false, error: "Please check the details." });
  await h.pending[0];
  const failed = h.render();
  assert.equal(failed.dialog.props.open, true);
  assert.equal(failed.elements.find(e => e.props?.id === "inlineCustomerName").props.value, "Synthetic draft");
  assert.equal(failed.elements.find(e => e.props?.role === "alert").props.children, "Please check the details.");
  assert.equal(h.resolved.length, 0);
  failed.create();
  assert.equal(calls, 2);
  finish({ ok: true, customer: row("existing"), wasExisting: true });
  await h.pending[1];
  assert.equal(h.render().dialog.props.open, false);
  assert.equal(h.resolved[0].id, "existing");
});

test("dialog hides thrown transport/server details and retains the draft", async () => {
  const h = dialogHarness(async () => { throw new Error("SECRET React #441"); });
  h.render().create();
  await h.pending[0];
  const result = h.render();
  assert.equal(result.dialog.props.open, true);
  assert.doesNotMatch(result.elements.find(e => e.props?.role === "alert").props.children, /SECRET|441/);
});
