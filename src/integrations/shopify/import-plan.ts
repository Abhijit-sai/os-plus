import { z } from "zod";
import { ShopifyIntegrationError } from "./errors.ts";

const referenceSchema = z.string().max(256).refine(value => !/[\u0000-\u001f\u007f]/.test(value)).nullable();
const uuid = z.string().uuid();
const gid = (kind: string) => z.string().regex(new RegExp(`^gid://shopify/${kind}/[1-9][0-9]{0,31}$`));
const identitySchema = z.object({
  tenantId: uuid, shopGid: gid("Shop"), orderGid: gid("Order"), reference: referenceSchema,
}).strict();
const candidateSchema = z.object({
  id: uuid, tenantId: uuid, reference: referenceSchema, deleted: z.boolean(),
  source: z.enum(["walk_in", "shopify_manual", "whatsapp", "other", "shopify"]),
  shopGid: gid("Shop").nullable(), orderGid: gid("Order").nullable(),
}).strict();
export type ShopifyImportIdentity = z.infer<typeof identitySchema>;
export type ShopifyImportCandidate = z.infer<typeof candidateSchema>;
export type ShopifyImportMatch = {
  status: "new" | "already_imported" | "reference_match" | "conflict";
  orderIds: string[];
};

// Keep this deliberately conservative and identical to the SQL implementation.
// ASCII folding avoids JS/Postgres locale differences. Never discard punctuation
// or leading zeros: PT-12, PT12 and PT012 can represent different real orders.
export function normalizeShopifyReference(input: string | null): string | null {
  const value = referenceSchema.parse(input);
  if (value === null) return null;
  const trimmed = value.replace(/^ +| +$/g, "");
  const withoutHash = (trimmed.startsWith("#") ? trimmed.slice(1) : trimmed).replace(/^ +| +$/g, "");
  return withoutHash.replace(/[A-Z]/g, letter => letter.toLowerCase()) || null;
}

// Advisory preview classification only. The committing DB transaction MUST
// repeat this check while holding the tenant/reference and source-identity locks.
export function classifyShopifyImport(input: ShopifyImportIdentity, candidates: ShopifyImportCandidate[]): ShopifyImportMatch {
  const identity = identitySchema.parse(input);
  const rows = z.array(candidateSchema).parse(candidates).filter(row => row.tenantId === identity.tenantId);
  const exact = rows.filter(row => row.shopGid === identity.shopGid && row.orderGid === identity.orderGid);
  if (exact.length) return {
    status: exact.length === 1 && !exact[0].deleted ? "already_imported" : "conflict",
    orderIds: exact.map(row => row.id),
  };
  const reference = normalizeShopifyReference(identity.reference);
  if (!reference) return { status: "conflict", orderIds: [] };
  const matches = rows.filter(row => normalizeShopifyReference(row.reference) === reference);
  if (!matches.length) return { status: "new", orderIds: [] };
  return { status: matches.length === 1 && !matches[0].deleted && matches[0].source !== "shopify" && !matches[0].shopGid && !matches[0].orderGid
    ? "reference_match" : "conflict", orderIds: matches.map(row => row.id) };
}

const DAY = 86_400_000;
const INDIA_OFFSET = 330 * 60_000;
const rangeSchema = z.object({ from: z.string(), through: z.string() }).strict();
export type ShopifyImportWindow = {
  from: string; through: string; timezone: "Asia/Kolkata"; start: string; endExclusive: string;
};

function indiaMidnight(value: string): number {
  if (!/^[2-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(value)) throw new ShopifyIntegrationError("REQUEST_INVALID");
  const midnight = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== value)
    throw new ShopifyIntegrationError("REQUEST_INVALID");
  return midnight - INDIA_OFFSET;
}

// UI dates are explicitly India dates, not the browser/server timezone. A
// through-date is inclusive, with an exclusive upper bound for Shopify search.
// Today's partial day is frozen at preview time; later orders arrive via sync.
export function buildShopifyImportWindow(input: unknown, now = Date.now(), hasAllOrdersScope = false): ShopifyImportWindow {
  const range = rangeSchema.parse(input);
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) throw new ShopifyIntegrationError("REQUEST_INVALID");
  const start = indiaMidnight(range.from), lastDay = indiaMidnight(range.through);
  const today = new Date(now + INDIA_OFFSET).toISOString().slice(0, 10);
  if (lastDay < start || lastDay - start >= 31 * DAY || range.through > today)
    throw new ShopifyIntegrationError("REQUEST_INVALID");
  if (!hasAllOrdersScope && start < now - 60 * DAY)
    throw new ShopifyIntegrationError("ORDER_HISTORY_SCOPE_REQUIRED");
  return { ...range, timezone: "Asia/Kolkata", start: new Date(start).toISOString(),
    endExclusive: new Date(Math.min(lastDay + DAY, now)).toISOString() };
}
