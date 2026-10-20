import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { openShopifySource } from "./source-crypto.ts";
import { parseShopifyOrderSnapshot, shopifyTimestampInstant } from "./order-hydration.ts";
import { projectShopifyCommercialDetails } from "./commercial-order.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { safeShopifyImageUrl, type ShopifyImageReference } from "./image-reference.ts";

const id = z.string().uuid();
const time = z.string().datetime({ offset: true });
const rowSchema = z.object({
  tenantId: id, orderId: id, number: z.string(), connectionId: id,
  shopGid: z.string(), sourceOrderGid: z.string(), sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUpdatedAt: time, observedAt: time, completeness: z.enum(["partial", "complete"]),
  expiresAt: time, sealedSource: z.unknown(),
});

// Server-only projection: deliberately enumerate business fields. Never spread
// a decrypted source, envelope, token, internal review or worker data into JSX.
export function projectImportedShopifyOrder(input: unknown, expectedTenant: string,
  env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
  const row = rowSchema.parse(input);
  if (row.tenantId !== expectedTenant) throw new ShopifyIntegrationError("ACCESS_DENIED");
  const common = { id: row.orderId, number: row.number, sourceOrderGid: row.sourceOrderGid };
  if (Date.parse(row.expiresAt) <= now) return { ...common, availability: "expired" as const };
  if (row.completeness !== "complete") return { ...common, availability: "partial" as const };
  if (!z.object({ ciphertext: z.string() }).safeParse(row.sealedSource).success)
    return { ...common, availability: "unavailable" as const };
  const plaintext = openShopifySource(row.sealedSource,
    JSON.stringify([row.tenantId, row.connectionId, row.shopGid, row.sourceOrderGid, row.sourceDigest]), env);
  if (createHash("sha256").update(plaintext).digest("hex") !== row.sourceDigest)
    throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const envelope = z.object({ kind: z.literal("shopify_draft_input"), schemaVersion: z.literal(1),
    tenantId: id, connectionId: id, shopGid: z.string(), sourceOrderGid: z.string(), sourceSnapshot: z.unknown(),
  }).parse(JSON.parse(plaintext));
  if (envelope.tenantId !== row.tenantId || envelope.connectionId !== row.connectionId ||
      envelope.shopGid !== row.shopGid || envelope.sourceOrderGid !== row.sourceOrderGid)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const source = parseShopifyOrderSnapshot(envelope.sourceSnapshot);
  if (source.tenantId !== row.tenantId || source.connectionId !== row.connectionId || source.shopGid !== row.shopGid ||
      source.order.id !== row.sourceOrderGid || shopifyTimestampInstant(source.order.updatedAt) !== shopifyTimestampInstant(row.sourceUpdatedAt) ||
      shopifyTimestampInstant(source.observedAt) !== shopifyTimestampInstant(row.observedAt))
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const details = projectShopifyCommercialDetails(source);
  return { ...common, availability: "available" as const, ...details, lines: details.lines.map((line, index) => {
    const original = source.lines[index];
    const reference = original.image ?? original.catalogue?.variant?.image ?? original.catalogue?.product?.image;
    const url = safeShopifyImageUrl(reference?.url);
    const image: ShopifyImageReference | null = url ? { url, altText: reference?.altText ?? null,
      provenance: original.image ? "order" : "current_catalogue" } : null;
    return { ...line, image };
  }) };
}
type Projected = ReturnType<typeof projectImportedShopifyOrder>;
// Retained business records predate previews. A missing image never hides an order.
export type ImportedShopifyOrder = Exclude<Projected, {availability:"available"}> |
  (Omit<Extract<Projected, {availability:"available"}>, "lines"> & {
    lines: Array<Omit<Extract<Projected, {availability:"available"}>["lines"][number], "image"> & {image?: ShopifyImageReference | null}>;
  });

export function withShopifyImageReferences(retained: ImportedShopifyOrder, temporary: ImportedShopifyOrder | undefined): ImportedShopifyOrder {
  if (retained.availability !== "available" || temporary?.availability !== "available" ||
      retained.id !== temporary.id || retained.sourceOrderGid !== temporary.sourceOrderGid ||
      shopifyTimestampInstant(retained.updatedAt) !== shopifyTimestampInstant(temporary.updatedAt)) return retained;
  const images = new Map(temporary.lines.map(line => [line.id, line.image]));
  return { ...retained, lines: retained.lines.map(line => ({ ...line, image: images.get(line.id) ?? null })) };
}

// A missing historical key must not take ordinary Orders down with the import.
// Validate the SQL row and tenant before recovery; never recover a foreign row.
export function projectImportedShopifyOrderSafely(input: unknown, expectedTenant: string,
  env: NodeJS.ProcessEnv = process.env, now = Date.now()): ImportedShopifyOrder {
  const row = rowSchema.parse(input);
  if (row.tenantId !== expectedTenant) throw new ShopifyIntegrationError("ACCESS_DENIED");
  try { return projectImportedShopifyOrder(row, expectedTenant, env, now); }
  catch { return { id: row.orderId, number: row.number, sourceOrderGid: row.sourceOrderGid, availability: "unavailable" }; }
}

export function importedShopifyOrdersVisible(tenantId: string, role: string, env: NodeJS.ProcessEnv = process.env) {
  return env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED === "true" &&
    id.safeParse(tenantId).success && tenantId === env.SHOPIFY_CONNECTION_TEST_TENANT_ID &&
    (role === "owner_admin" || role === "manager");
}
