import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { readShopifyHydrationGraphQL } from "./client.ts";
import { normalizeShopifyDraftLines } from "./draft-preparation.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { assertShopifyHydrationContext, type ShopifyHydrationContext } from "./hydration-contract.ts";
import { resolveShopifyMapping } from "./mapping.ts";
import { parseShopifyOrderSnapshot, shopifyTimestampInstant } from "./order-hydration.ts";
import { openShopifySource } from "./source-crypto.ts";
import { inrMinorUnits, inspectShopifySourceMoney } from "./source-money.ts";

const timestamp = z.string().datetime({ offset: true });
const gid = (type: string) => z.string().regex(new RegExp(`^gid://shopify/${type}/[1-9][0-9]{0,31}$`));
const date = z.string().date();
export const shopifyReviewDecisionSchema = z.object({
  customerId: z.string().uuid(), deliveryType: z.enum(["store_pickup", "self_delivery", "courier"]),
  promisedDeliveryDate: date.nullable().optional(), reason: z.string().trim().min(1).max(1000),
  lines: z.array(z.object({
    lineGid: gid("LineItem"), mappingId: z.string().uuid(), mappingRevision: z.number().int().positive().safe(),
    nameOverride: z.string().trim().min(1).max(2000).optional(), colourOverride: z.string().trim().min(1).max(2000).optional(),
    sizeAcknowledged: z.boolean().optional(), skuChangeAcknowledged: z.boolean().optional(),
    expectedCompletionDate: date.nullable().optional(),
  }).strict()).min(1).max(500),
}).strict().refine(value => new Set(value.lines.map(line => line.lineGid)).size === value.lines.length);
export type ShopifyReviewDecision = z.infer<typeof shopifyReviewDecisionSchema>;
const revisionSchema = z.object({
  id: z.string().uuid(), tenantId: z.string().uuid(), connectionId: z.string().uuid(),
  sourceOrderId: z.string().uuid(), sourceOrderGid: gid("Order"), shopGid: gid("Shop"),
  sourceDigest: z.string().regex(/^[0-9a-f]{64}$/), sourceUpdatedAt: timestamp,
  completeness: z.literal("complete"), sealedSource: z.unknown(),
}).strict();
export type ShopifyReleaseRevision = z.infer<typeof revisionSchema>;
const proofSchema = z.object({
  tenantId: z.string().uuid(), connectionId: z.string().uuid(), shopGid: gid("Shop"),
  connectionRevision: z.number().int().positive().safe(), orderGid: gid("Order"),
  sourceUpdatedAt: timestamp, verifiedAt: timestamp,
}).strict();
type FreshnessProof = z.infer<typeof proofSchema>;

// The caller supplies a fresh DB/credential-bound context, never browser scope.
// The source update fence is always checked remotely, even when the encrypted
// snapshot is recent. SQL separately fences pending generations and local edits.
export async function verifyShopifyReleaseSource(context: ShopifyHydrationContext, revision: ShopifyReleaseRevision,
  accessToken: string, signal: AbortSignal, env: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch,
  now = Date.now): Promise<FreshnessProof> {
  assertShopifyHydrationContext(context, env);
  const row = revisionSchema.parse(revision);
  assertRevisionScope(row, context);
  const response = await readShopifyHydrationGraphQL({
    shopDomain: context.shopDomain, connectionEnvironment: context.environment, accessToken,
    query: `query OSPlusReleaseRevision($id: ID!) { shop { id myshopifyDomain } order(id: $id) { id updatedAt } }`,
    variables: { id: row.sourceOrderGid }, signal,
    schema: z.object({ shop: z.object({ id: gid("Shop"), myshopifyDomain: z.string() }),
      order: z.object({ id: gid("Order"), updatedAt: timestamp }).nullable() }),
  }, context, transport, env);
  if (response.data.shop.id !== context.shopGid || response.data.shop.myshopifyDomain !== context.shopDomain)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  if (!response.data.order || response.data.order.id !== row.sourceOrderGid ||
    shopifyTimestampInstant(response.data.order.updatedAt) !== shopifyTimestampInstant(row.sourceUpdatedAt))
    throw new ShopifyIntegrationError("SOURCE_CHANGED");
  return { tenantId: context.tenantId, connectionId: context.connectionId, shopGid: context.shopGid,
    connectionRevision: context.revision, orderGid: row.sourceOrderGid, sourceUpdatedAt: response.data.order.updatedAt,
    verifiedAt: new Date(now()).toISOString() };
}
function assertRevisionScope(row: ShopifyReleaseRevision, context: ShopifyHydrationContext) {
  if (row.tenantId !== context.tenantId || row.connectionId !== context.connectionId || row.shopGid !== context.shopGid)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
}

// Private RPC input only. Commercial values are reconstructed from authenticated
// ciphertext and exact arithmetic. Browser choices contain only approved local
// overrides and mapping/customer decisions, never source money or quantity.
export function prepareShopifyRelease(revision: ShopifyReleaseRevision, context: ShopifyHydrationContext,
  decision: ShopifyReviewDecision, mappings: unknown, proof: FreshnessProof,
  env: NodeJS.ProcessEnv = process.env, now = Date.now()) {
  assertShopifyHydrationContext(context, env);
  const row = revisionSchema.parse(revision), choices = shopifyReviewDecisionSchema.parse(decision), fresh = proofSchema.parse(proof);
  assertRevisionScope(row, context);
  if (!Number.isFinite(now) || fresh.tenantId !== context.tenantId || fresh.connectionId !== context.connectionId ||
    fresh.shopGid !== context.shopGid || fresh.connectionRevision !== context.revision || fresh.orderGid !== row.sourceOrderGid)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  if (shopifyTimestampInstant(fresh.sourceUpdatedAt) !== shopifyTimestampInstant(row.sourceUpdatedAt) ||
    shopifyTimestampInstant(fresh.verifiedAt) > BigInt(Math.floor(now)) * BigInt(1_000_000) || now - Date.parse(fresh.verifiedAt) > 120_000)
    throw new ShopifyIntegrationError("SOURCE_CHANGED");
  const plaintext = openShopifySource(row.sealedSource,
    JSON.stringify([row.tenantId, row.connectionId, row.shopGid, row.sourceOrderGid, row.sourceDigest]), env);
  if (createHash("sha256").update(plaintext).digest("hex") !== row.sourceDigest)
    throw new ShopifyIntegrationError("RESPONSE_INVALID");
  let stored: unknown;
  try { stored = JSON.parse(plaintext); } catch { throw new ShopifyIntegrationError("RESPONSE_INVALID"); }
  const envelope = z.object({ kind: z.literal("shopify_draft_input"), schemaVersion: z.literal(1),
    tenantId: z.string().uuid(), connectionId: z.string().uuid(), shopGid: gid("Shop"), sourceOrderGid: gid("Order"),
    sourceSnapshot: z.unknown() }).safeParse(stored);
  if (!envelope.success || envelope.data.tenantId !== row.tenantId || envelope.data.connectionId !== row.connectionId ||
    envelope.data.shopGid !== row.shopGid || envelope.data.sourceOrderGid !== row.sourceOrderGid)
    throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const source = parseShopifyOrderSnapshot(envelope.data.sourceSnapshot);
  if (source.tenantId !== row.tenantId || source.connectionId !== row.connectionId || source.shopGid !== row.shopGid ||
    source.order.id !== row.sourceOrderGid || shopifyTimestampInstant(source.order.updatedAt) !== shopifyTimestampInstant(row.sourceUpdatedAt) ||
    shopifyTimestampInstant(source.order.createdAt) < shopifyTimestampInstant(context.importCreatedAtCutoff))
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const money = inspectShopifySourceMoney(source);
  if (money.validation !== "restricted_reconciliation_passed" ||
    ["REFUNDED", "PARTIALLY_REFUNDED"].includes(source.order.displayFinancialStatus ?? ""))
    throw new ShopifyIntegrationError("REVIEW_REQUIRED");
  if (choices.lines.length !== source.lines.length) throw new ShopifyIntegrationError("REVIEW_REQUIRED");
  const details = normalizeShopifyDraftLines(source);
  const lines = source.lines.map((line, index) => {
    const choice = choices.lines.find(item => item.lineGid === line.id), detail = details.lines[index];
    if (!choice) throw new ShopifyIntegrationError("REVIEW_REQUIRED");
    const mapping = resolveShopifyMapping({ tenantId: row.tenantId, connectionId: row.connectionId },
      { variantGid: detail.variantGid, sku: detail.originalSku }, mappings);
    if (mapping.status !== "mapped" || mapping.mapping.id !== choice.mappingId || mapping.mapping.revision !== choice.mappingRevision)
      throw new ShopifyIntegrationError("STALE_REVISION");
    if (mapping.warnings.length && !choice.skuChangeAcknowledged) throw new ShopifyIntegrationError("REVIEW_REQUIRED");
    const production = mapping.mapping.classification === "production";
    if (production && (line.isGiftCard || !line.requiresShipping ||
      (detail.colour.contradictory && !choice.colourOverride) || (detail.size.contradictory && !choice.sizeAcknowledged)))
      throw new ShopifyIntegrationError("REVIEW_REQUIRED");
    const unit = inrMinorUnits(line.originalUnitPriceSet.shopMoney.amount), gross = inrMinorUnits(line.originalTotalSet.shopMoney.amount),
      net = inrMinorUnits(line.priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount);
    if (unit === null || gross === null || net === null || unit * BigInt(line.quantity) !== gross || net > gross || gross >= BigInt("1000000000000"))
      throw new ShopifyIntegrationError("REVIEW_REQUIRED");
    const name = choice.nameOverride ?? line.title.trim();
    if (production && !name) throw new ShopifyIntegrationError("REVIEW_REQUIRED");
    return { lineGid: line.id, variantGid: line.variant?.id ?? null, quantity: line.quantity, name,
      description: detail.description, colour: choice.colourOverride ?? detail.colour.value,
      originalUnitMinorUnits: unit.toString(), netMinorUnits: net.toString(), productionAllowed: production };
  });
  if (!lines.some(line => line.productionAllowed)) throw new ShopifyIntegrationError("REVIEW_REQUIRED");
  return { connectionRevision: fresh.connectionRevision, sourceDigest: row.sourceDigest, sourceUpdatedAt: row.sourceUpdatedAt, verifiedAt: fresh.verifiedAt,
    sourceCurrency: source.order.currencyCode, moneyValidation: money.validation, lines };
}
export type ShopifyPreparedRelease = ReturnType<typeof prepareShopifyRelease>;
