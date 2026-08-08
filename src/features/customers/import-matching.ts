import type { ParsedCustomerImportRow } from "./import-parser.ts";

export type ExistingCustomerImportReference = {
  address: string | null;
  email: string | null;
  id: string;
  name: string;
  normalizedPhoneE164: string | null;
  notes: string | null;
  phone: string | null;
  structuredAddressKeys?: string[];
};

export type CustomerExternalIdentityReference = {
  customerId: string;
  externalCustomerId: string;
};

export type CustomerImportConflict = {
  existingValue: string;
  field: "address" | "email" | "name" | "notes" | "phone";
  sourceValue: string;
};

export type MatchedCustomerImportRow = ParsedCustomerImportRow & {
  conflicts: CustomerImportConflict[];
  customerId: string | null;
  matchState: "create" | "invalid" | "reuse_external_id" | "reuse_phone" | "review_email";
};

function normalizeEmail(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-IN") || null;
}

function pushIndex(map: Map<string, string[]>, key: string | null, value: string) {
  if (!key) return;
  map.set(key, [...(map.get(key) ?? []), value]);
}

function findConflicts(row: ParsedCustomerImportRow, customer: ExistingCustomerImportReference) {
  const conflicts: CustomerImportConflict[] = [];
  const compare = (field: CustomerImportConflict["field"], sourceValue: string | null, existingValue: string | null) => {
    if (sourceValue && existingValue && sourceValue.trim().toLocaleLowerCase("en-IN") !== existingValue.trim().toLocaleLowerCase("en-IN")) {
      conflicts.push({ existingValue, field, sourceValue });
    }
  };
  compare("name", row.name, customer.name);
  compare("email", row.email, customer.email);
  compare("phone", row.normalizedPhoneE164, customer.normalizedPhoneE164);
  compare("notes", row.notes, customer.notes);
  if (row.address) {
    const sourceAddressKey = `${row.address.addressLine1.trim().toLocaleLowerCase("en-IN")}|${row.address.postalCode?.trim().toLocaleLowerCase("en-IN") ?? ""}`;
    const savedAddressKeys = customer.structuredAddressKeys ?? [];
    if (savedAddressKeys.length && !savedAddressKeys.includes(sourceAddressKey)) {
      conflicts.push({
        existingValue: "Existing saved address",
        field: "address",
        sourceValue: [row.address.addressLine1, row.address.postalCode].filter(Boolean).join(", "),
      });
    } else if (!savedAddressKeys.length) {
      compare("address", row.address.addressLine1, customer.address);
    }
  } else {
    compare("address", row.legacyAddressText, customer.address);
  }
  return conflicts;
}

export function matchCustomerImportRows(
  rows: ParsedCustomerImportRow[],
  customers: ExistingCustomerImportReference[],
  identities: CustomerExternalIdentityReference[],
): MatchedCustomerImportRow[] {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const customerIdsByPhone = new Map<string, string[]>();
  const customerIdsByEmail = new Map<string, string[]>();
  const customerIdsByExternalId = new Map<string, string[]>();
  const sourcePhoneCounts = new Map<string, number>();
  const sourceExternalIdCounts = new Map<string, number>();

  for (const customer of customers) {
    pushIndex(customerIdsByPhone, customer.normalizedPhoneE164, customer.id);
    pushIndex(customerIdsByEmail, normalizeEmail(customer.email), customer.id);
  }
  for (const identity of identities) pushIndex(customerIdsByExternalId, identity.externalCustomerId, identity.customerId);
  for (const row of rows) {
    if (row.normalizedPhoneE164) sourcePhoneCounts.set(row.normalizedPhoneE164, (sourcePhoneCounts.get(row.normalizedPhoneE164) ?? 0) + 1);
    if (row.shopifyCustomerId) sourceExternalIdCounts.set(row.shopifyCustomerId, (sourceExternalIdCounts.get(row.shopifyCustomerId) ?? 0) + 1);
  }

  return rows.map((row) => {
    const invalidReasons = [...row.invalidReasons];
    if (row.normalizedPhoneE164 && (sourcePhoneCounts.get(row.normalizedPhoneE164) ?? 0) > 1) {
      invalidReasons.push("The normalized phone number appears more than once in this file.");
    }
    if (row.shopifyCustomerId && (sourceExternalIdCounts.get(row.shopifyCustomerId) ?? 0) > 1) {
      invalidReasons.push("The Shopify customer ID appears more than once in this file.");
    }

    const externalCandidates = row.shopifyCustomerId ? customerIdsByExternalId.get(row.shopifyCustomerId) ?? [] : [];
    const phoneCandidates = row.normalizedPhoneE164 ? customerIdsByPhone.get(row.normalizedPhoneE164) ?? [] : [];
    if (externalCandidates.length > 1) invalidReasons.push("The Shopify customer ID is ambiguous in this tenant.");
    if (phoneCandidates.length > 1) invalidReasons.push("The normalized phone number is ambiguous in this tenant.");
    if (externalCandidates.length === 1 && phoneCandidates.length === 1 && externalCandidates[0] !== phoneCandidates[0]) {
      invalidReasons.push("The Shopify customer ID and normalized phone resolve to different customers.");
    }

    if (invalidReasons.length) {
      return { ...row, conflicts: [], customerId: null, invalidReasons, matchState: "invalid" };
    }

    const authoritativeCustomerId = externalCandidates[0] ?? phoneCandidates[0] ?? null;
    if (authoritativeCustomerId) {
      const customer = customersById.get(authoritativeCustomerId);
      if (!customer) {
        return { ...row, conflicts: [], customerId: null, invalidReasons: ["The matched customer is unavailable."], matchState: "invalid" };
      }
      return {
        ...row,
        conflicts: findConflicts(row, customer),
        customerId: customer.id,
        invalidReasons,
        matchState: externalCandidates.length ? "reuse_external_id" : "reuse_phone",
      };
    }

    const emailCandidates = row.email ? customerIdsByEmail.get(normalizeEmail(row.email) as string) ?? [] : [];
    if (emailCandidates.length > 1) {
      return { ...row, conflicts: [], customerId: null, invalidReasons: ["The email address matches more than one customer and requires manual cleanup."], matchState: "invalid" };
    }
    if (emailCandidates.length === 1) {
      const customer = customersById.get(emailCandidates[0]);
      return {
        ...row,
        conflicts: customer ? findConflicts(row, customer) : [],
        customerId: customer?.id ?? null,
        invalidReasons,
        matchState: "review_email",
      };
    }

    return { ...row, conflicts: [], customerId: null, invalidReasons, matchState: "create" };
  });
}
