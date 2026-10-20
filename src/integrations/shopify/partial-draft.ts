import "server-only";

import { z } from "zod";
import { ShopifyIntegrationError } from "./errors.ts";
import { assertShopifyHydrationContext, type ShopifyHydrationContext } from "./hydration-contract.ts";
import { shopifyJobLeaseSchema, type ShopifyJobLease } from "./queue-store.ts";
import { shopifyTimestampInstant } from "./order-hydration.ts";

// Only the trusted hydrator's ID/timestamp envelope. No partially fetched
// customer, money, line or address can leak into business records.
const schema = z.object({
  status: z.literal("review"), completeness: z.literal("partial"),
  reason: z.enum(["LINE_LIMIT", "SHIPPING_LINE_LIMIT", "SOURCE_DETAIL_LIMIT", "ATTRIBUTE_LIMIT", "QUANTITY_NOT_POSITIVE"]),
  envelope: z.object({
    id: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  }).strict(),
}).strict();
export function parseShopifyPartialDraft(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  return parsed.data;
}
export function prepareShopifyPartialDraft(input: unknown, context: ShopifyHydrationContext,
  lease: ShopifyJobLease, env: NodeJS.ProcessEnv, now: number, observedAt: string) {
  assertShopifyHydrationContext(context, env);
  if (!shopifyJobLeaseSchema.safeParse(lease).success || !Number.isFinite(now))
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const partial = parseShopifyPartialDraft(input);
  const observed = z.string().datetime({ offset: true }).safeParse(observedAt);
  if (!observed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  if (lease.tenantId !== context.tenantId || lease.connectionId !== context.connectionId ||
    lease.connectionRevision !== context.revision || lease.orderGid !== partial.envelope.id ||
    Date.parse(lease.leaseExpiresAt) <= now) throw new ShopifyIntegrationError("ACCESS_DENIED");
  if (shopifyTimestampInstant(partial.envelope.createdAt) < shopifyTimestampInstant(context.importCreatedAtCutoff) ||
    shopifyTimestampInstant(partial.envelope.updatedAt) < shopifyTimestampInstant(partial.envelope.createdAt) ||
    shopifyTimestampInstant(observedAt) > BigInt(Math.floor(now)) * BigInt(1_000_000) ||
    now - Date.parse(observedAt) > 120_000) throw new ShopifyIntegrationError("SOURCE_CHANGED", 60);
  return {
    kind: "shopify_partial_draft_input" as const, schemaVersion: 1,
    tenantId: context.tenantId, connectionId: context.connectionId, shopGid: context.shopGid,
    jobId: lease.jobId, generation: lease.generation, connectionRevision: context.revision,
    sourceOrderGid: partial.envelope.id, sourceUpdatedAt: partial.envelope.updatedAt, observedAt,
    sourceSnapshot: { order: { ...partial.envelope, currencyCode: "XXX" } },
    customer: { proposedName: "Incomplete Shopify order", generatedName: true,
      shopifyCustomerGid: null, verifiedPhoneE164: null, emailSuggestion: null,
      unverifiedPrimaryPhone: null, phoneCountryConflict: false },
    lines: [], reasons: ["INCOMPLETE_SOURCE", partial.reason], releaseEligible: false as const,
  };
}
