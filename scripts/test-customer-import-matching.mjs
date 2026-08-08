import assert from "node:assert/strict";

import { matchCustomerImportRows } from "../src/features/customers/import-matching.ts";

const baseRow = {
  address: null,
  displayPhone: null,
  email: null,
  invalidReasons: [],
  legacyAddressText: null,
  name: "New name",
  notes: null,
  normalizedPhoneE164: null,
  phoneCountryCode: null,
  rowNumber: 2,
  shopifyCustomerId: null,
  sourceMetadata: {
    acceptsEmailMarketing: null,
    acceptsSmsMarketing: null,
    acceptsWhatsAppMarketing: null,
    tags: [],
    taxExempt: null,
    totalOrders: null,
    totalSpent: null,
  },
};

const customers = [
  { address: null, email: "known@example.com", id: "customer-a", name: "Known name", normalizedPhoneE164: "+919999999999", notes: null, phone: "9999999999", structuredAddressKeys: ["10 old road|500001"] },
  { address: "Existing address", email: "other@example.com", id: "customer-b", name: "Other", normalizedPhoneE164: "+14155552671", notes: "Keep", phone: "+14155552671" },
];
const identities = [{ customerId: "customer-a", externalCustomerId: "shop-1" }];

const [external] = matchCustomerImportRows([
  { ...baseRow, email: "changed@example.com", normalizedPhoneE164: "+919999999999", rowNumber: 2, shopifyCustomerId: "shop-1" },
], customers, identities);
assert.equal(external.matchState, "reuse_external_id");
assert.equal(external.customerId, "customer-a");
assert.deepEqual(external.conflicts.map((conflict) => conflict.field).sort(), ["email", "name"]);

const [addressConflict] = matchCustomerImportRows([
  {
    ...baseRow,
    address: { addressLine1: "99 New Road", addressLine2: null, city: "Hyderabad", countryCode: "IN", postalCode: "500002", state: "TS" },
    normalizedPhoneE164: "+919999999999",
    rowNumber: 20,
  },
], customers, identities);
assert.equal(addressConflict.matchState, "reuse_phone");
assert.equal(addressConflict.conflicts.some((conflict) => conflict.field === "address"), true);

const [phone] = matchCustomerImportRows([
  { ...baseRow, name: "Other", normalizedPhoneE164: "+14155552671", rowNumber: 3 },
], customers, identities);
assert.equal(phone.matchState, "reuse_phone");
assert.equal(phone.customerId, "customer-b");

const [emailReview] = matchCustomerImportRows([
  { ...baseRow, email: "KNOWN@example.com", rowNumber: 4 },
], customers, identities);
assert.equal(emailReview.matchState, "review_email");
assert.equal(emailReview.customerId, "customer-a");

const [create] = matchCustomerImportRows([{ ...baseRow, rowNumber: 5 }], customers, identities);
assert.equal(create.matchState, "create");
assert.equal(create.customerId, null);

const [authoritativeConflict] = matchCustomerImportRows([
  { ...baseRow, normalizedPhoneE164: "+14155552671", rowNumber: 6, shopifyCustomerId: "shop-1" },
], customers, identities);
assert.equal(authoritativeConflict.matchState, "invalid");
assert.match(authoritativeConflict.invalidReasons.join(" "), /different customers/i);

const duplicateSource = matchCustomerImportRows([
  { ...baseRow, normalizedPhoneE164: "+919888888888", rowNumber: 7 },
  { ...baseRow, normalizedPhoneE164: "+919888888888", rowNumber: 8 },
], customers, identities);
assert.equal(duplicateSource[0].matchState, "invalid");
assert.equal(duplicateSource[1].matchState, "invalid");

console.log("Customer import matching tests passed.");
