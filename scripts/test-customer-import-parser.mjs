import assert from "node:assert/strict";
import * as XLSX from "@e965/xlsx";

import { parseCustomerImportFile } from "../src/features/customers/import-parser.ts";

const csv = Buffer.from([
  "Customer ID,First Name,Last Name,Email,Default Address Address1,Default Address City,Default Address Province Code,Default Address Country Code,Default Address Zip,Default Address Phone,Phone,Accepts Email Marketing,Accepts SMS Marketing,Accepts WhatsApp Marketing,Total Spent,Total Orders,Tax Exempt,Tags",
  "'shop-101,Asha,Rao,ASHA@example.com,12 Lake Road,Hyderabad,TS,IN,500001,'09876543210,,yes,no,no,1200.50,3,no,VIP",
].join("\n"));

const parsed = parseCustomerImportFile(csv, "customers.csv");
assert.equal(parsed.sourceRowCount, 1);
assert.equal(parsed.invalidRowCount, 0);
assert.equal(parsed.rows.length, 1);
assert.deepEqual(parsed.rows[0], {
  address: {
    addressLine1: "12 Lake Road",
    addressLine2: null,
    city: "Hyderabad",
    countryCode: "IN",
    postalCode: "500001",
    state: "TS",
  },
  displayPhone: "9876543210",
  email: "asha@example.com",
  invalidReasons: [],
  legacyAddressText: null,
  name: "Asha Rao",
  notes: null,
  normalizedPhoneE164: "+919876543210",
  phoneCountryCode: "IN",
  rowNumber: 2,
  shopifyCustomerId: "shop-101",
  sourceMetadata: {
    acceptsEmailMarketing: true,
    acceptsSmsMarketing: false,
    acceptsWhatsAppMarketing: false,
    tags: ["VIP"],
    taxExempt: false,
    totalOrders: 3,
    totalSpent: 1200.5,
  },
});

const edgeWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(edgeWorkbook, XLSX.utils.aoa_to_sheet([
  ["Name", "Phone", "Default Address Phone", "Country Code", "Address Line 2", "City"],
  ["US Customer", "(415) 555-2671", "", "US", "", ""],
  ["", "+44 20 7946 0958", "", "GB", "", "London"],
  ["Conflicting phones", "+1 415 555 2671", "+44 20 7946 0958", "US", "", ""],
  ["Incomplete address", "", "", "GB", "Suite 4", "London"],
  ["Ambiguous phone", "4155552671", "", "", "", ""],
  ["Invalid country", "", "", "USA", "", "London"],
]), "Customers");
const edgeBytes = XLSX.write(edgeWorkbook, { bookType: "xlsx", type: "buffer" });
const edgeParsed = parseCustomerImportFile(edgeBytes, "edge-customers.xlsx");
assert.equal(edgeParsed.sourceRowCount, 6);
assert.equal(edgeParsed.rows[0].normalizedPhoneE164, "+14155552671");
assert.match(edgeParsed.rows[1].invalidReasons.join(" "), /name is required/i);
assert.match(edgeParsed.rows[2].invalidReasons.join(" "), /phone columns resolve to different numbers/i);
assert.equal(edgeParsed.rows[3].legacyAddressText, "Suite 4, London, GB");
assert.match(edgeParsed.rows[4].invalidReasons.join(" "), /country context/i);
assert.match(edgeParsed.rows[5].invalidReasons.join(" "), /two ISO letters/i);

const tooManyRows = Buffer.from(["Name", ...Array.from({ length: 5001 }, (_, index) => `Customer ${index + 1}`)].join("\n"));
assert.throws(() => parseCustomerImportFile(tooManyRows, "too-many.csv"), /5,000 data rows/i);
assert.throws(() => parseCustomerImportFile(Buffer.from("Name\nAsha"), "renamed.xlsx"), /valid (?:Excel workbook|XLSX)/i);
assert.throws(() => parseCustomerImportFile(Buffer.from([0x4e, 0x61, 0x6d, 0x65, 0x0a, 0xff]), "invalid.csv"), /valid UTF-8/i);

console.log("Customer import parser tests passed.");
