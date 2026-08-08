import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { normalizeIndianMobile } from "../src/features/customers/phone.ts";

for (const value of [
  "9876543210",
  "09876543210",
  "+91 98765 43210",
  "0091-98765-43210",
]) {
  assert.equal(
    normalizeIndianMobile(value),
    "9876543210",
    `${value} should normalize to the final ten digits`,
  );
}

for (const value of ["", "12345", "+1 9876543210", "0092 9876543210"]) {
  assert.equal(normalizeIndianMobile(value), null, `${value} should be rejected`);
}

const root = process.cwd();
const customerActions = fs.readFileSync(
  path.join(root, "src/features/customers/actions.ts"),
  "utf8",
);
const customerPicker = fs.readFileSync(
  path.join(root, "src/components/orders/customer-picker.tsx"),
  "utf8",
);
const customerDialog = fs.readFileSync(
  path.join(root, "src/components/customers/create-customer-dialog.tsx"),
  "utf8",
);
const sharedDialog = fs.readFileSync(
  path.join(root, "src/components/ui/dialog.tsx"),
  "utf8",
);
const newOrderPage = fs.readFileSync(
  path.join(root, "src/app/(tenant)/orders/new/page.tsx"),
  "utf8",
);

assert.match(customerActions, /normalizeCustomerPhone/);
assert.match(customerActions, /export async function createCustomerInlineAction/);
assert.match(
  customerActions,
  /\.from\("customers"\)[\s\S]*?\.eq\("tenant_id", context\.tenant\.id\)[\s\S]*?\.is\("deleted_at", null\)/,
  "duplicate resolution must remain current-tenant and active-customer scoped",
);
assert.match(
  customerActions,
  /normalizeCustomerPhone\(customer\.phone\)\?\.e164 === normalized\.e164/,
);
assert.match(customerActions, /normalizedPhone: parsed\.phone/);
assert.match(customerPicker, /CreateCustomerDialog/);
assert.match(customerPicker, /setCustomerOptions/);
assert.doesNotMatch(customerPicker, /href=\{createCustomerHref/);
assert.match(customerDialog, /createCustomerInlineAction/);
assert.doesNotMatch(customerDialog, /<form\b/);
assert.match(sharedDialog, /confirmClose/);
assert.doesNotMatch(newOrderPage, /href="\/customers\/new"/);

console.log("Inline customer creation and duplicate-resolution contracts passed.");
