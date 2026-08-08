"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  matchCustomerImportRows,
  type MatchedCustomerImportRow,
} from "@/features/customers/import-matching";
import { parseCustomerImportFile } from "@/features/customers/import-parser";
import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";
import type { Json } from "@/types/database";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const confirmationSchema = z.object({
  expectedFileFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  expectedPreviewFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  idempotencyKey: z.string().uuid(),
  reviewDecisions: z.record(z.enum(["create", "reuse", "skip"])),
});

export type CustomerImportPreviewRow = {
  conflicts: MatchedCustomerImportRow["conflicts"];
  customerId: string | null;
  email: string | null;
  existingCustomerEmail: string | null;
  existingCustomerName: string | null;
  invalidReasons: string[];
  matchState: MatchedCustomerImportRow["matchState"];
  name: string;
  phone: string | null;
  rowNumber: number;
  shopifyCustomerId: string | null;
};

export type CustomerImportPreview = {
  createCount: number;
  fileFingerprint: string;
  idempotencyKey: string;
  invalidCount: number;
  previewFingerprint: string;
  reuseCount: number;
  reviewCount: number;
  rows: CustomerImportPreviewRow[];
  skippedCount: number;
  sourceRowCount: number;
};

export type CustomerImportResult = {
  addressCount: number;
  createdCount: number;
  idempotentReplay: boolean;
  invalidCount: number;
  reusedCount: number;
  skippedCount: number;
  updatedCount: number;
};

export type CustomerImportState =
  | { message: string; status: "error" }
  | { message: string; preview: CustomerImportPreview; status: "preview" }
  | { message: string; result: CustomerImportResult; status: "success" };

function cleanFileName(name: string) {
  return name.replace(/[\\/]/g, "_").trim().slice(0, 180) || "customers.csv";
}

async function readCustomerFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.name || value.size === 0) {
    throw new Error("Choose a customer CSV or XLSX file first.");
  }
  if (value.size > MAX_FILE_BYTES) throw new Error("The customer file must be 5 MB or smaller.");
  const bytes = Buffer.from(await value.arrayBuffer());
  return {
    bytes,
    fileName: cleanFileName(value.name),
    fingerprint: createHash("sha256").update(bytes).digest("hex"),
  };
}

function previewFingerprint(
  rows: MatchedCustomerImportRow[],
  customersById: Map<string, ExistingCustomerSnapshot>,
) {
  const contract = rows.map((row) => ({
    conflicts: row.conflicts,
    customerId: row.customerId,
    existingCustomer: row.customerId ? customersById.get(row.customerId) ?? null : null,
    invalidReasons: row.invalidReasons,
    matchState: row.matchState,
    normalizedPhoneE164: row.normalizedPhoneE164,
    rowNumber: row.rowNumber,
    shopifyCustomerId: row.shopifyCustomerId,
  }));
  return createHash("sha256").update(JSON.stringify(contract)).digest("hex");
}

type ExistingCustomerSnapshot = {
  address: string | null;
  email: string | null;
  id: string;
  name: string;
  normalizedPhoneE164: string | null;
  notes: string | null;
  phone: string | null;
  structuredAddressKeys: string[];
};

function parseReviewDecisions(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value ?? "{}"));
  } catch {
    throw new Error("The row decisions are invalid. Preview the file again.");
  }
}

async function buildCustomerImportPreview(tenantId: string, bytes: Buffer, fileName: string, fileFingerprint: string, idempotencyKey: string) {
  const parsed = parseCustomerImportFile(bytes, fileName);
  const supabase = createSupabaseServiceRoleClient();
  const [customersResult, identitiesResult, addressesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, normalized_phone_e164, email, address, notes")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
    supabase
      .from("customer_external_identities")
      .select("customer_id, external_customer_id")
      .eq("tenant_id", tenantId)
      .eq("provider", "shopify")
      .is("deleted_at", null),
    supabase
      .from("customer_addresses")
      .select("customer_id, address_line_1, postal_code")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null),
  ]);
  if (customersResult.error) throw new Error(`Unable to compare tenant customers: ${customersResult.error.message}`);
  if (identitiesResult.error) throw new Error(`Unable to compare Shopify customer IDs: ${identitiesResult.error.message}`);
  if (addressesResult.error) throw new Error(`Unable to compare saved customer addresses: ${addressesResult.error.message}`);

  const addressKeysByCustomer = new Map<string, string[]>();
  for (const address of addressesResult.data ?? []) {
    const key = `${address.address_line_1.trim().toLocaleLowerCase("en-IN")}|${address.postal_code?.trim().toLocaleLowerCase("en-IN") ?? ""}`;
    addressKeysByCustomer.set(address.customer_id, [...(addressKeysByCustomer.get(address.customer_id) ?? []), key]);
  }
  const customerReferences = (customersResult.data ?? []).map((customer) => ({
    ...customer,
    normalizedPhoneE164: customer.normalized_phone_e164,
    structuredAddressKeys: addressKeysByCustomer.get(customer.id) ?? [],
  }));
  const customerReferencesById = new Map(customerReferences.map((customer) => [customer.id, customer]));
  const identityReferences = (identitiesResult.data ?? []).map((identity) => ({
    customerId: identity.customer_id,
    externalCustomerId: identity.external_customer_id,
  }));
  const matched = matchCustomerImportRows(parsed.rows, customerReferences, identityReferences);
  const customersById = new Map((customersResult.data ?? []).map((customer) => [customer.id, customer]));
  const rows: CustomerImportPreviewRow[] = matched.map((row) => {
    const existing = row.customerId ? customersById.get(row.customerId) : null;
    return {
      conflicts: row.conflicts,
      customerId: row.customerId,
      email: row.email,
      existingCustomerEmail: existing?.email ?? null,
      existingCustomerName: existing?.name ?? null,
      invalidReasons: row.invalidReasons,
      matchState: row.matchState,
      name: row.name || "Blank name",
      phone: row.displayPhone,
      rowNumber: row.rowNumber,
      shopifyCustomerId: row.shopifyCustomerId,
    };
  });
  const skippedCount = matched.filter((row) => row.invalidReasons.includes("Customer name is required.")).length;
  const invalidCount = matched.filter((row) => row.matchState === "invalid" && !row.invalidReasons.includes("Customer name is required.")).length;
  return {
    matched,
    preview: {
      createCount: matched.filter((row) => row.matchState === "create").length,
      fileFingerprint,
      idempotencyKey,
      invalidCount,
      previewFingerprint: previewFingerprint(matched, customerReferencesById),
      reuseCount: matched.filter((row) => row.matchState === "reuse_external_id" || row.matchState === "reuse_phone").length,
      reviewCount: matched.filter((row) => row.matchState === "review_email").length,
      rows,
      skippedCount,
      sourceRowCount: parsed.sourceRowCount,
    },
  };
}

function toRpcRow(row: MatchedCustomerImportRow, decision: "create" | "reuse") {
  return {
    address: row.address as unknown as Json,
    customer_id: decision === "reuse" ? row.customerId : null,
    decision,
    email: row.email,
    legacy_address_text: row.legacyAddressText,
    name: row.name,
    normalized_phone_e164: row.normalizedPhoneE164,
    notes: row.notes,
    phone: row.displayPhone,
    row_number: row.rowNumber,
    shopify_customer_id: row.shopifyCustomerId,
    source_metadata: row.sourceMetadata as unknown as Json,
  };
}

function safeErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) return "The import confirmation is invalid. Preview the file again.";
  if (error instanceof Error) {
    if (/PREVIEW_STALE|CUSTOMER_NOT_ACTIVE|EXTERNAL_ID_PHONE_CUSTOMER_CONFLICT/.test(error.message)) {
      return "Customer data changed after preview. Preview the file again before importing.";
    }
    if (error.message.includes("IDEMPOTENCY_KEY_FINGERPRINT_MISMATCH")) {
      return "This confirmation belongs to a different preview. Preview the file again.";
    }
    return error.message;
  }
  return "Customers could not be imported. No customer records were changed.";
}

export async function customerImportAction(formData: FormData): Promise<CustomerImportState> {
  try {
    const context = await requireTenantContext();
    assertPermission(context.membership.role, "customer_imports:manage");
    const intent = String(formData.get("intent") ?? "preview");
    if (intent !== "preview" && intent !== "confirm") throw new Error("Unknown customer import action.");
    const file = await readCustomerFile(formData.get("file"));
    const confirmation = intent === "confirm"
      ? confirmationSchema.parse({
          expectedFileFingerprint: formData.get("expectedFileFingerprint"),
          expectedPreviewFingerprint: formData.get("expectedPreviewFingerprint"),
          idempotencyKey: formData.get("idempotencyKey"),
          reviewDecisions: parseReviewDecisions(formData.get("reviewDecisions")),
        })
      : {
          expectedFileFingerprint: file.fingerprint,
          expectedPreviewFingerprint: "",
          idempotencyKey: randomUUID(),
          reviewDecisions: {},
        };
    if (confirmation.expectedFileFingerprint !== file.fingerprint) {
      throw new Error("The selected customer file changed after preview. Preview it again before importing.");
    }

    const { matched, preview } = await buildCustomerImportPreview(
      context.tenant.id,
      file.bytes,
      file.fileName,
      file.fingerprint,
      confirmation.idempotencyKey,
    );
    if (intent === "preview") {
      return {
        message: "Preview ready. Resolve email-only matches and review conflicts before importing.",
        preview,
        status: "preview",
      };
    }
    if (confirmation.expectedPreviewFingerprint !== preview.previewFingerprint) {
      throw new Error("Customer data changed after preview. Preview the file again before importing.");
    }

    let reviewSkippedCount = 0;
    const rows = matched.flatMap((row) => {
      if (row.matchState === "invalid") return [];
      if (row.matchState === "review_email") {
        const decision = confirmation.reviewDecisions[String(row.rowNumber)];
        if (!decision) throw new Error(`Choose Create, Reuse, or Skip for row ${row.rowNumber}.`);
        if (decision === "skip") {
          reviewSkippedCount += 1;
          return [];
        }
        return [toRpcRow(row, decision)];
      }
      return [toRpcRow(row, row.matchState === "create" ? "create" : "reuse")];
    });
    if (!rows.length) throw new Error("There are no approved customer rows to import.");

    const supabase = createSupabaseServiceRoleClient();
    const result = await supabase.rpc("import_customer_rows", {
      p_actor_id: context.membership.clerk_user_id,
      p_file_hash: file.fingerprint,
      p_file_name: file.fileName,
      p_idempotency_key: confirmation.idempotencyKey,
      p_invalid_count: preview.invalidCount,
      p_preview_fingerprint: preview.previewFingerprint,
      p_rows: rows as unknown as Json,
      p_skipped_count: preview.skippedCount + reviewSkippedCount,
      p_source_row_count: preview.sourceRowCount,
      p_tenant_id: context.tenant.id,
    });
    if (result.error) throw new Error(`Unable to import customers: ${result.error.message}`);
    const data = (result.data ?? {}) as Record<string, Json | undefined>;
    const finalResult: CustomerImportResult = {
      addressCount: Number(data.addressCount ?? 0),
      createdCount: Number(data.createdCount ?? 0),
      idempotentReplay: data.idempotentReplay === true,
      invalidCount: Number(data.invalidCount ?? preview.invalidCount),
      reusedCount: Number(data.reusedCount ?? 0),
      skippedCount: Number(data.skippedCount ?? preview.skippedCount + reviewSkippedCount),
      updatedCount: Number(data.updatedCount ?? 0),
    };

    revalidatePath("/customers");
    revalidatePath("/orders/new");
    return {
      message: finalResult.idempotentReplay
        ? "This customer-file confirmation was already imported; no duplicates were created."
        : `Customer import complete: ${finalResult.createdCount} created and ${finalResult.reusedCount} reused.`,
      result: finalResult,
      status: "success",
    };
  } catch (error) {
    return { message: safeErrorMessage(error), status: "error" };
  }
}
