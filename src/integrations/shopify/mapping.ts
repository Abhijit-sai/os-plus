import "server-only";

import { z } from "zod";
import { ShopifyIntegrationError } from "./errors.ts";

const variant = z.string().regex(/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]{0,31}$/);
const sku = z.string().trim().min(1).max(512);
export const shopifyMappingBindingSchema = z.object({
  tenantId: z.string().uuid(), connectionId: z.string().uuid(),
}).strict();
export const shopifyMappingSchema = z.object({
  id: z.string().uuid(), tenant_id: z.string().uuid(), connection_id: z.string().uuid(),
  variant_gid: variant, sku: sku.nullable(),
  classification: z.enum(["production", "nonproduction"]),
  item_type_id: z.string().uuid().nullable(), workflow_id: z.string().uuid().nullable(), standard_size_id: z.string().uuid().nullable(),
  is_active: z.boolean(), revision: z.number().int().positive().safe(),
}).strict().refine(row => (row.variant_gid !== null || row.sku !== null) &&
  (row.classification === "production" ? row.item_type_id !== null && row.workflow_id !== null :
    row.item_type_id === null && row.workflow_id === null && row.standard_size_id === null));
export const shopifyMappingCommandSchema = z.object({
  mappingId: z.string().uuid().nullable(), expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER-1),
  variantGid: variant, sku: sku.nullable(),
  classification: z.enum(["production", "nonproduction"]),
  itemTypeId: z.string().uuid().nullable(), workflowId: z.string().uuid().nullable(), standardSizeId: z.string().uuid().nullable(),
  isActive: z.boolean(), reason: z.string().trim().min(1).max(1000),
}).strict().refine(input => (input.mappingId === null ? input.expectedRevision === 0 : input.expectedRevision > 0) &&
  (input.variantGid !== null || input.sku !== null) &&
  (input.classification === "production" ? input.itemTypeId !== null && input.workflowId !== null :
    input.itemTypeId === null && input.workflowId === null && input.standardSizeId === null));
export type ShopifyMapping = z.infer<typeof shopifyMappingSchema>;
export type ShopifyMappingBinding = z.infer<typeof shopifyMappingBindingSchema>;
export type ShopifyMappingCommand = z.infer<typeof shopifyMappingCommandSchema>;
type MappingResult =
  | { status: "mapped"; mapping: ShopifyMapping; warnings: ("MAPPING_SKU_CHANGED")[] }
  | { status: "review"; reason: "MISSING_MAPPING" | "AMBIGUOUS_SKU" | "VARIANT_IDENTITY_MISMATCH" | "INACTIVE_MAPPING" };

// Candidates must be the complete exact-variant/exact-SKU result set, not a
// truncated catalogue. No case folding, fuzzy match, product-ID fallback or
// first-match policy. This selects a candidate; release still revalidates all
// configuration and version references transactionally.
export function resolveShopifyMapping(binding: ShopifyMappingBinding,
  line: { variantGid: string | null; sku: string | null }, candidates: unknown): MappingResult {
  const scope = shopifyMappingBindingSchema.parse(binding);
  const source = z.object({ variantGid: variant.nullable(), sku: sku.nullable() }).strict().parse(line);
  const parsed = z.array(shopifyMappingSchema).max(500).safeParse(candidates);
  if (!parsed.success || parsed.data.some(row => row.tenant_id !== scope.tenantId || row.connection_id !== scope.connectionId) ||
    new Set(parsed.data.map(row => row.id)).size !== parsed.data.length) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const exactVariant = source.variantGid === null ? [] : parsed.data.filter(row => row.variant_gid === source.variantGid);
  if (exactVariant.length > 1) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  if (exactVariant.length === 1) {
    const mapping = exactVariant[0];
    if (!mapping.is_active) return { status: "review", reason: "INACTIVE_MAPPING" };
    return { status: "mapped", mapping, warnings: mapping.sku !== source.sku?.trim() && !(mapping.sku === null && source.sku === null) ? ["MAPPING_SKU_CHANGED"] : [] };
  }
  const exactSku = source.sku?.trim();
  if (!exactSku) return { status: "review", reason: "MISSING_MAPPING" };
  const matches = parsed.data.filter(row => row.sku === exactSku && row.is_active);
  if (matches.length > 1) return { status: "review", reason: "AMBIGUOUS_SKU" };
  if (!matches.length) return { status: "review", reason: "MISSING_MAPPING" };
  // An SKU match without the same verified variant is evidence for review,
  // not permission to apply a catalogue rule to a previously unseen variant.
  return { status: "review", reason: "VARIANT_IDENTITY_MISMATCH" };
}
