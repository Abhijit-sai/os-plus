import assert from "node:assert/strict";

import {
  normalizeCustomerPhone,
  normalizeIndianMobile,
} from "../src/features/customers/phone.ts";

for (const input of ["9876543210", "09876543210", "+91 98765 43210", "0091-98765-43210"]) {
  assert.deepEqual(normalizeCustomerPhone(input), {
    countryCode: "IN",
    displayPhone: "9876543210",
    e164: "+919876543210",
  });
  assert.equal(normalizeIndianMobile(input), "9876543210");
}

assert.deepEqual(normalizeCustomerPhone("+1 (415) 555-2671"), {
  countryCode: "US",
  displayPhone: "+14155552671",
  e164: "+14155552671",
});
assert.deepEqual(normalizeCustomerPhone("0044 20 7946 0958"), {
  countryCode: "GB",
  displayPhone: "+442079460958",
  e164: "+442079460958",
});
assert.deepEqual(normalizeCustomerPhone("(415) 555-2671", "US"), {
  countryCode: "US",
  displayPhone: "+14155552671",
  e164: "+14155552671",
});
assert.deepEqual(normalizeCustomerPhone("6505551234", "US"), {
  countryCode: "US",
  displayPhone: "+16505551234",
  e164: "+16505551234",
});

assert.equal(normalizeCustomerPhone("4155552671"), null, "ambiguous foreign national numbers must not be guessed");
assert.equal(normalizeCustomerPhone("12345", "US"), null);
assert.equal(normalizeCustomerPhone(""), null);
assert.equal(normalizeIndianMobile("+1 415 555 2671"), null);

console.log("Customer phone normalization tests passed.");
