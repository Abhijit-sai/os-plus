import * as XLSX from "@e965/xlsx";

import { assertSafeXlsxWorkbook } from "../attendance/import-parser.ts";
import { normalizeCustomerPhone } from "./phone.ts";

const MAX_DATA_ROWS = 5000;
const MAX_COLUMNS = 128;

type CellValue = boolean | number | string | null | undefined;

export type CustomerImportAddress = {
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  countryCode: string;
  postalCode: string | null;
  state: string | null;
};

export type ParsedCustomerImportRow = {
  address: CustomerImportAddress | null;
  displayPhone: string | null;
  email: string | null;
  invalidReasons: string[];
  legacyAddressText: string | null;
  name: string;
  notes: string | null;
  normalizedPhoneE164: string | null;
  phoneCountryCode: string | null;
  rowNumber: number;
  shopifyCustomerId: string | null;
  sourceMetadata: {
    acceptsEmailMarketing: boolean | null;
    acceptsSmsMarketing: boolean | null;
    acceptsWhatsAppMarketing: boolean | null;
    tags: string[];
    taxExempt: boolean | null;
    totalOrders: number | null;
    totalSpent: number | null;
  };
};

export type ParsedCustomerImport = {
  invalidRowCount: number;
  rows: ParsedCustomerImportRow[];
  sourceRowCount: number;
};

function cleanCell(value: CellValue) {
  return String(value ?? "").replace(/^'/, "").replace(/\u00a0/g, " ").trim();
}

function headerKey(value: CellValue) {
  return cleanCell(value).toLocaleLowerCase("en-IN").replace(/[^a-z0-9]+/g, "");
}

function booleanValue(value: CellValue) {
  const normalized = cleanCell(value).toLocaleLowerCase("en-IN");
  if (["yes", "true", "1", "y"].includes(normalized)) return true;
  if (["no", "false", "0", "n"].includes(normalized)) return false;
  return null;
}

function numberValue(value: CellValue) {
  const text = cleanCell(value).replace(/,/g, "");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function nullable(value: CellValue) {
  return cleanCell(value) || null;
}

function emailValue(value: CellValue) {
  const email = cleanCell(value).toLocaleLowerCase("en-IN");
  return email || null;
}

function valueFrom(row: CellValue[], headers: Map<string, number>, ...keys: string[]) {
  for (const key of keys) {
    const index = headers.get(key);
    if (index !== undefined) return row[index];
  }
  return null;
}

function parseRow(row: CellValue[], headers: Map<string, number>, rowNumber: number): ParsedCustomerImportRow {
  const firstName = cleanCell(valueFrom(row, headers, "firstname"));
  const lastName = cleanCell(valueFrom(row, headers, "lastname"));
  const explicitName = cleanCell(valueFrom(row, headers, "name", "customername"));
  const name = explicitName || [firstName, lastName].filter(Boolean).join(" ");
  const countryCode = cleanCell(valueFrom(row, headers, "defaultaddresscountrycode", "countrycode")).toUpperCase();
  const primaryPhone = cleanCell(valueFrom(row, headers, "phone", "mobile", "mobilenumber"));
  const addressPhone = cleanCell(valueFrom(row, headers, "defaultaddressphone"));
  const phoneInput = primaryPhone || addressPhone;
  const primaryNormalizedPhone = primaryPhone ? normalizeCustomerPhone(primaryPhone, countryCode || undefined) : null;
  const addressNormalizedPhone = addressPhone ? normalizeCustomerPhone(addressPhone, countryCode || undefined) : null;
  const phone = primaryNormalizedPhone ?? addressNormalizedPhone;
  const addressLine1 = cleanCell(valueFrom(row, headers, "defaultaddressaddress1", "addressline1", "address1"));
  const addressLine2 = nullable(valueFrom(row, headers, "defaultaddressaddress2", "addressline2", "address2"));
  const city = nullable(valueFrom(row, headers, "defaultaddresscity", "city"));
  const state = nullable(valueFrom(row, headers, "defaultaddressprovincecode", "state", "statecode"));
  const postalCode = nullable(valueFrom(row, headers, "defaultaddresszip", "postalcode", "zipcode", "zip"));
  const addressParts = [addressLine1, addressLine2, city, state, postalCode, countryCode].filter(Boolean);
  const email = emailValue(valueFrom(row, headers, "email"));
  const invalidReasons: string[] = [];

  if (!name) invalidReasons.push("Customer name is required.");
  if ((primaryPhone && !primaryNormalizedPhone) || (addressPhone && !addressNormalizedPhone)) {
    invalidReasons.push("Phone number is invalid or missing reliable country context.");
  }
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    invalidReasons.push("Country code must use two ISO letters, such as IN or US.");
  }
  if (primaryNormalizedPhone && addressNormalizedPhone && primaryNormalizedPhone.e164 !== addressNormalizedPhone.e164) {
    invalidReasons.push("The phone columns resolve to different numbers.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalidReasons.push("Email address is invalid.");

  return {
    address: addressLine1
      ? {
          addressLine1,
          addressLine2,
          city,
          countryCode: countryCode || "IN",
          postalCode,
          state,
        }
      : null,
    displayPhone: phone?.displayPhone ?? null,
    email,
    invalidReasons,
    legacyAddressText: !addressLine1 && addressParts.length ? addressParts.join(", ") : null,
    name,
    notes: nullable(valueFrom(row, headers, "note", "notes")),
    normalizedPhoneE164: phone?.e164 ?? null,
    phoneCountryCode: phone?.countryCode ?? null,
    rowNumber,
    shopifyCustomerId: nullable(valueFrom(row, headers, "customerid", "shopifycustomerid")),
    sourceMetadata: {
      acceptsEmailMarketing: booleanValue(valueFrom(row, headers, "acceptsemailmarketing")),
      acceptsSmsMarketing: booleanValue(valueFrom(row, headers, "acceptssmsmarketing")),
      acceptsWhatsAppMarketing: booleanValue(valueFrom(row, headers, "acceptswhatsappmarketing")),
      tags: cleanCell(valueFrom(row, headers, "tags")).split(",").map((tag) => tag.trim()).filter(Boolean),
      taxExempt: booleanValue(valueFrom(row, headers, "taxexempt")),
      totalOrders: numberValue(valueFrom(row, headers, "totalorders")),
      totalSpent: numberValue(valueFrom(row, headers, "totalspent")),
    },
  };
}

export function parseCustomerImportFile(buffer: Uint8Array, fileName: string): ParsedCustomerImport {
  const extension = fileName.toLocaleLowerCase("en-IN").split(".").pop();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Choose a CSV or XLSX customer file.");
  }
  if (extension === "xlsx") {
    assertSafeXlsxWorkbook(buffer, fileName);
  } else {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new Error("Choose a valid UTF-8 CSV customer file.");
    }
    const firstBytes = Buffer.from(buffer.subarray(0, Math.min(buffer.byteLength, 1024)));
    if (firstBytes.includes(0)) throw new Error("Choose a valid UTF-8 CSV customer file.");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { cellDates: false, dense: false, type: "array" });
  } catch {
    throw new Error("The customer file could not be read as CSV or XLSX.");
  }
  if (workbook.SheetNames.length !== 1) throw new Error("Customer imports must contain exactly one worksheet.");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (sheet["!ref"]) {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const declaredRows = range.e.r - range.s.r + 1;
    const declaredColumns = range.e.c - range.s.c + 1;
    if (declaredRows > MAX_DATA_ROWS + 1 || declaredColumns > MAX_COLUMNS) {
      throw new Error(`Customer imports are limited to 5,000 data rows and ${MAX_COLUMNS} columns.`);
    }
  }
  const values = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { defval: "", header: 1, raw: false });
  if (!values.length) throw new Error("The customer file is empty.");
  if (values.length - 1 > MAX_DATA_ROWS) throw new Error("Customer imports are limited to 5,000 data rows.");

  const headers = new Map<string, number>();
  values[0].forEach((value, index) => {
    const key = headerKey(value);
    if (key && !headers.has(key)) headers.set(key, index);
  });
  if (!headers.has("name") && !headers.has("customername") && !headers.has("firstname") && !headers.has("lastname")) {
    throw new Error("The customer file must include Name or First Name/Last Name columns.");
  }

  const rows = values.slice(1).flatMap((row, index) =>
    row.some((cell) => cleanCell(cell)) ? [parseRow(row, headers, index + 2)] : [],
  );
  return {
    invalidRowCount: rows.filter((row) => row.invalidReasons.length > 0).length,
    rows,
    sourceRowCount: rows.length,
  };
}
