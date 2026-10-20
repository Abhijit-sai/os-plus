import type { UnifiedImportPreview } from "./unified-contract";

export type ImportRow = UnifiedImportPreview["rows"][number];
export const importLabels = {
  new: "New — ready to import",
  already_imported: "Already in Orders",
  reference_match: "Reference matches an existing order",
  conflict: "Needs review — not imported",
};
export function importExplanation(row: ImportRow) {
  if (row.status === "new") return "Creates one draft. Your team can assign garment types and workflows later.";
  if (row.status === "already_imported") return "This Shopify order is already linked. It will not be created again.";
  if (row.status === "reference_match") return "Same Reference order ID, but not a verified Shopify link. Compare the existing order; this import skips it without merging or overwriting details.";
  if (!row.reference.trim()) return "Shopify returned no reference. This order is skipped until its identity can be checked.";
  if (row.incomingReferenceConflict) return "Multiple Shopify orders in this range share this reference. They are skipped to prevent a duplicate.";
  return "This reference has an ambiguous, archived or differently linked match. Review the existing records before importing it.";
}
export function previewExpired(preview: UnifiedImportPreview, now: number) {
  const expiry = Date.parse(preview.expiresAt ?? "");
  return !Number.isFinite(expiry) || now >= expiry;
}
export function importDateError(from: string, through: string, today: string) {
  if (!from || !through) return "Choose both dates.";
  if (from > through) return "The end date must be on or after the start date.";
  if (through > today) return "Choose today or an earlier date.";
  if ((Date.parse(through) - Date.parse(from)) / 86400000 >= 31) return "Choose no more than 31 days, including both dates.";
  return "";
}
