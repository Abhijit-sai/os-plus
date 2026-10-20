import "server-only";

import { z } from "zod";
import { readShopifyHydrationGraphQL } from "./client.ts";
import {
  assertShopifyHydrationContext,
  type ShopifyHydrationContext,
} from "./hydration-contract.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { shopifyJobLeaseSchema, type ShopifyJobLease } from "./queue-store.ts";
import { shopifyOrderGid } from "./intake-contract.ts";

const gid = (type: string) =>
  z.string().regex(new RegExp(`^gid://shopify/${type}/[1-9][0-9]{0,31}$`));
const timestamp = z.string().datetime({ offset: true });
const text = (max: number) => z.string().max(max);
const money = z.object({
  amount: z.string().regex(/^-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,6})?$/),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
});
const moneyBag = z.object({ shopMoney: money, presentmentMoney: money });
const attributes = z
  .array(z.object({ key: text(2000), value: text(2000) }))
  .max(100);
const taxLines = z
  .array(
    z.object({
      title: text(512),
      rate: z.number().finite().nullable(),
      channelLiable: z.boolean().nullable(),
      priceSet: moneyBag,
    }),
  )
  .max(100);
const allocations = z
  .array(z.object({ allocatedAmountSet: moneyBag }))
  .max(100);
const imageSchema = z.object({
  id: text(512).nullable(),
  url: text(4096),
  altText: text(2000).nullable(),
});
const address = z.object({
  firstName: text(256).nullable(),
  lastName: text(256).nullable(),
  phone: text(128).nullable(),
  address1: text(2048).nullable(),
  address2: text(2048).nullable(),
  city: text(256).nullable(),
  province: text(256).nullable(),
  countryCodeV2: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  zip: text(128).nullable(),
});
const envelopeSchema = z.object({
  id: shopifyOrderGid,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const headerSchema = envelopeSchema.extend({
  legacyResourceId: z.string().regex(/^[1-9][0-9]{0,31}$/),
  name: text(256),
  note: text(10000).nullable(),
  tags: z.array(text(256)).max(100),
  customAttributes: attributes,
  edited: z.boolean(),
  requiresShipping: z.boolean(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  presentmentCurrencyCode: z.string().regex(/^[A-Z]{3}$/),
  cancelledAt: timestamp.nullable(),
  displayFinancialStatus: text(64).nullable(),
  displayFulfillmentStatus: text(64),
  email: text(512).nullable(),
  phone: text(128).nullable(),
  taxesIncluded: z.boolean(),
  customer: z
    .object({
      id: gid("Customer"),
      firstName: text(256).nullable(),
      lastName: text(256).nullable(),
      email: text(512).nullable(),
      phone: text(128).nullable(),
    })
    .nullable(),
  shippingAddress: address.nullable(),
  billingAddress: address.nullable(),
  currentTotalPriceSet: moneyBag,
  currentSubtotalPriceSet: moneyBag,
  currentTotalTaxSet: moneyBag,
  currentTotalDiscountsSet: moneyBag,
  totalShippingPriceSet: moneyBag,
  totalOutstandingSet: moneyBag,
  originalTotalPriceSet: moneyBag,
  currentShippingPriceSet: moneyBag,
  currentTotalDutiesSet: moneyBag.nullable(),
  originalTotalDutiesSet: moneyBag.nullable(),
  currentTotalAdditionalFeesSet: moneyBag.nullable(),
  originalTotalAdditionalFeesSet: moneyBag.nullable(),
  totalReceivedSet: moneyBag,
  netPaymentSet: moneyBag,
  totalRefundedSet: moneyBag,
  totalRefundedShippingSet: moneyBag,
  totalTipReceivedSet: moneyBag,
  currentTaxLines: taxLines,
  taxLines,
  totalCashRoundingAdjustment: z.object({
    paymentSet: moneyBag,
    refundSet: moneyBag,
  }),
});
const lineSchema = z.object({
  id: gid("LineItem"),
  title: text(2000),
  name: text(2000),
  variantTitle: text(2000).nullable(),
  sku: text(512).nullable(),
  quantity: z.number().int().nonnegative().safe(),
  currentQuantity: z.number().int().nonnegative().safe(),
  isGiftCard: z.boolean(),
  requiresShipping: z.boolean(),
  customAttributes: attributes,
  product: z.object({ id: gid("Product") }).nullable(),
  variant: z.object({ id: gid("ProductVariant") }).nullable(),
  image: z.unknown(),
  priceAfterAllDiscountsBeforeTaxesSet: moneyBag,
  originalTotalSet: moneyBag,
  originalUnitPriceSet: moneyBag,
  totalDiscountSet: moneyBag,
  taxLines,
  discountAllocations: allocations,
});
const pageSchema = z.object({
  order: headerSchema
    .extend({
      note: z.unknown(),
      tags: z.unknown(),
      customAttributes: z.unknown(),
      currentTaxLines: z.unknown(),
      taxLines: z.unknown(),
      lineItems: z.object({
        nodes: z.array(z.unknown()).max(50),
        pageInfo: z.object({
          hasNextPage: z.boolean(),
          endCursor: text(4096).nullable(),
        }),
      }),
    })
    .nullable(),
});
const metadataSchema = z.object({
  shop: z.object({ id: gid("Shop"), myshopifyDomain: text(128) }),
  order: envelopeSchema.nullable(),
});
const metadataQuery = `query OSPlusOrderRevision($id: ID!) {
  shop { id myshopifyDomain }
  order(id: $id) { id createdAt updatedAt }
}`;
const bagFields =
  "{ shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }";
const addressFields =
  "{ firstName lastName phone address1 address2 city province countryCodeV2 zip }";
const taxFields = `{ title rate channelLiable priceSet ${bagFields} }`;
const allocationFields = `{ allocatedAmountSet ${bagFields} }`;
const pageQuery = `query OSPlusOrderSnapshot($id: ID!, $after: String) {
  order(id: $id) {
    id legacyResourceId name createdAt updatedAt cancelledAt displayFinancialStatus displayFulfillmentStatus taxesIncluded email phone
    note tags customAttributes { key value } edited requiresShipping currencyCode presentmentCurrencyCode
    customer { id firstName lastName email phone }
    shippingAddress ${addressFields} billingAddress ${addressFields}
    currentTotalPriceSet ${bagFields} currentSubtotalPriceSet ${bagFields} currentTotalTaxSet ${bagFields}
    currentTotalDiscountsSet ${bagFields} totalShippingPriceSet ${bagFields} totalOutstandingSet ${bagFields}
    originalTotalPriceSet ${bagFields} currentShippingPriceSet ${bagFields}
    currentTotalDutiesSet ${bagFields} originalTotalDutiesSet ${bagFields}
    currentTotalAdditionalFeesSet ${bagFields} originalTotalAdditionalFeesSet ${bagFields}
    totalReceivedSet ${bagFields} netPaymentSet ${bagFields} totalRefundedSet ${bagFields}
    totalRefundedShippingSet ${bagFields} totalTipReceivedSet ${bagFields}
    currentTaxLines ${taxFields} taxLines ${taxFields}
    totalCashRoundingAdjustment { paymentSet ${bagFields} refundSet ${bagFields} }
    lineItems(first: 50, after: $after) {
      nodes {
        id title name variantTitle sku quantity currentQuantity isGiftCard requiresShipping customAttributes { key value }
        product { id } variant { id } image { id url altText } priceAfterAllDiscountsBeforeTaxesSet ${bagFields}
        originalTotalSet ${bagFields} originalUnitPriceSet ${bagFields} totalDiscountSet ${bagFields}
        taxLines ${taxFields} discountAllocations ${allocationFields}
      }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const shippingLineSchema = z.object({
  id: text(512).nullable(),
  title: text(2000),
  code: text(512).nullable(),
  source: text(512).nullable(),
  deliveryCategory: text(512).nullable(),
  isRemoved: z.boolean(),
  originalPriceSet: moneyBag,
  discountedPriceSet: moneyBag,
  currentDiscountedPriceSet: moneyBag,
  taxLines,
  discountAllocations: allocations,
});
const shippingSchema = z.object({
  order: envelopeSchema
    .extend({
      shippingLines: z.object({
        nodes: z.array(z.unknown()).max(50),
        pageInfo: z.object({
          hasNextPage: z.boolean(),
          endCursor: text(4096).nullable(),
        }),
      }),
    })
    .nullable(),
});
const shippingQuery = `query OSPlusOrderShipping($id: ID!, $after: String) {
  order(id: $id) { id createdAt updatedAt shippingLines(first: 50, after: $after) {
    nodes { id title code source deliveryCategory isRemoved originalPriceSet ${bagFields}
      discountedPriceSet ${bagFields} currentDiscountedPriceSet ${bagFields}
      taxLines ${taxFields} discountAllocations ${allocationFields} }
    pageInfo { hasNextPage endCursor }
  } }
}`;
const productSchema = z.object({
  __typename: z.literal("Product"),
  id: gid("Product"),
  title: text(2000),
  description: text(10000),
  productType: text(512),
  tags: z.array(text(256)).max(100),
  updatedAt: timestamp,
  featuredMedia: z
    .object({ preview: z.object({ image: z.unknown() }).nullable() })
    .nullable(),
});
const variantSchema = z.object({
  __typename: z.literal("ProductVariant"),
  id: gid("ProductVariant"),
  title: text(2000),
  sku: text(512).nullable(),
  updatedAt: timestamp,
  product: z.object({ id: gid("Product") }),
  selectedOptions: z
    .array(z.object({ name: text(2000), value: text(2000) }))
    .max(100),
  image: z.unknown(),
});
const catalogueSchema = z.object({ nodes: z.array(z.unknown()).max(50) });
const catalogueQuery = `query OSPlusCatalogueEnrichment($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename ... on Product { id title description productType tags updatedAt featuredMedia { preview { image { id url altText } } } }
    ... on ProductVariant { id title sku updatedAt product { id } selectedOptions { name value } image { id url altText } }
  }
}`;
type SourceEnvelope = z.infer<typeof envelopeSchema>;
const safeImageSchema = imageSchema.refine(
  (value) => safeImage(value) !== null,
);
const catalogueObservationSchema = z.object({
  provenance: z.literal("current_catalogue"),
  observedAt: timestamp,
  product: productSchema
    .omit({ featuredMedia: true })
    .extend({ image: safeImageSchema.nullable() })
    .nullable(),
  variant: variantSchema
    .extend({ image: safeImageSchema.nullable() })
    .nullable(),
});
const snapshotSchema = z.object({
  completeness: z.literal("complete"),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid(),
  shopGid: gid("Shop"),
  connectionRevision: z.number().int().positive().safe(),
  jobId: z.string().uuid(),
  generation: z.number().int().positive().safe(),
  observedAt: timestamp,
  order: headerSchema,
  lines: z
    .array(
      lineSchema.omit({ image: true }).extend({
        image: safeImageSchema.nullable(),
        catalogue: catalogueObservationSchema,
        warnings: z
          .array(
            z.enum([
              "IMAGE_REFERENCE_UNAVAILABLE",
              "CATALOGUE_UNAVAILABLE",
              "CATALOGUE_REFERENCE_MISSING",
            ]),
          )
          .max(3),
      }),
    )
    .min(1)
    .max(500),
  shippingLines: z.array(shippingLineSchema).max(500),
});
export type ShopifyOrderSnapshot = z.infer<typeof snapshotSchema>;

// Revalidate the complete private DTO at the normalization boundary rather than
// trusting a TypeScript annotation on an arbitrary caller-supplied object.
export function parseShopifyOrderSnapshot(
  value: unknown,
): ShopifyOrderSnapshot {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  if (
    parsed.data.order.id.split("/").at(-1) !==
    parsed.data.order.legacyResourceId
  )
    throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const ids = parsed.data.lines.map((line) => line.id);
  const shippingIds = parsed.data.shippingLines
    .map((line) => line.id)
    .filter((id): id is string => id !== null);
  if (
    new Set(ids).size !== ids.length ||
    new Set(shippingIds).size !== shippingIds.length ||
    parsed.data.lines.some(
      (line) =>
        line.quantity <= 0 ||
        line.currentQuantity > line.quantity ||
        (line.catalogue.product &&
          line.catalogue.product.id !== line.product?.id) ||
        (line.catalogue.variant &&
          (line.catalogue.variant.id !== line.variant?.id ||
            line.catalogue.variant.product.id !== line.product?.id)),
    )
  )
    throw new ShopifyIntegrationError("RESPONSE_INVALID");
  return parsed.data;
}
type ReviewReason =
  | "LINE_LIMIT"
  | "SHIPPING_LINE_LIMIT"
  | "SOURCE_DETAIL_LIMIT"
  | "ATTRIBUTE_LIMIT"
  | "QUANTITY_NOT_POSITIVE";
export type ShopifyHydrationResult =
  | { status: "complete"; snapshot: ShopifyOrderSnapshot }
  | { status: "ineligible"; reason: "BEFORE_CUTOFF"; envelope: SourceEnvelope }
  | {
      status: "review";
      reason: ReviewReason;
      completeness: "partial";
      envelope: SourceEnvelope;
    };

// Source references only. Never fetch image bytes, arbitrary URLs or status-page
// links. Render/persistence and approved financial normalization are later work.
function safeImage(image: unknown): z.infer<typeof imageSchema> | null {
  if (!image) return null;
  const parsed = imageSchema.safeParse(image);
  if (!parsed.success) return null;
  try {
    const url = new URL(parsed.data.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "cdn.shopify.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      return null;
    return parsed.data;
  } catch {
    return null;
  }
}
function sameRevision(actual: SourceEnvelope, expected: SourceEnvelope) {
  if (
    actual.id !== expected.id ||
    actual.createdAt !== expected.createdAt ||
    actual.updatedAt !== expected.updatedAt
  ) {
    throw new ShopifyIntegrationError("SOURCE_CHANGED", 60);
  }
}

// PostgreSQL cutoffs preserve microseconds; Date.parse alone truncates them.
// Compare exact instants through nine fractional digits without money floats.
export function shopifyTimestampInstant(value: string): bigint {
  const milliseconds = Date.parse(value);
  const fraction = value.match(/\.(\d+)(?=Z|[+-]\d\d:\d\d$)/)?.[1] ?? "";
  if (!Number.isFinite(milliseconds) || fraction.length > 9)
    throw new ShopifyIntegrationError("RESPONSE_INVALID");
  return (
    BigInt(milliseconds) * BigInt(1_000_000) +
    BigInt(fraction.padEnd(9, "0").slice(3))
  );
}

export function createShopifyOrderHydrator(
  transport: typeof fetch = fetch,
  now = Date.now,
  budgetMs = 40_000,
) {
  if (!Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 40_000)
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return async function hydrate(
    context: ShopifyHydrationContext,
    lease: ShopifyJobLease,
    accessToken: string,
    signal?: AbortSignal,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<ShopifyHydrationResult> {
    assertShopifyHydrationContext(context, env);
    const parsedLease = shopifyJobLeaseSchema.safeParse(lease);
    if (
      !parsedLease.success ||
      lease.tenantId !== context.tenantId ||
      lease.connectionId !== context.connectionId ||
      lease.connectionRevision !== context.revision ||
      Date.parse(lease.leaseExpiresAt) <= now()
    )
      throw new ShopifyIntegrationError("ACCESS_DENIED");
    const startedAt = now();
    const controller = new AbortController();
    const abort = () => controller.abort();
    const deadline = setTimeout(
      abort,
      Math.min(
        budgetMs,
        Math.max(1, Date.parse(lease.leaseExpiresAt) - startedAt),
      ),
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const read = async <T>(
      query: string,
      schema: z.ZodType<T>,
      variables: Record<string, unknown>,
    ) => {
      const remaining = Math.min(
        budgetMs - (now() - startedAt),
        Date.parse(lease.leaseExpiresAt) - now(),
      );
      if (controller.signal.aborted || remaining < 1)
        throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
      const result = await readShopifyHydrationGraphQL(
        {
          shopDomain: context.shopDomain,
          connectionEnvironment: "production",
          accessToken,
          query,
          variables,
          schema,
          timeoutMs: Math.min(15_000, Math.floor(remaining)),
          signal: controller.signal,
        },
        context,
        transport,
        env,
      );
      if (
        controller.signal.aborted ||
        now() - startedAt >= budgetMs ||
        Date.parse(lease.leaseExpiresAt) <= now()
      ) {
        throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
      }
      return result.data;
    };
    try {
      const metadata = await read(metadataQuery, metadataSchema, {
        id: lease.orderGid,
      });
      if (
        metadata.shop.id !== context.shopGid ||
        metadata.shop.myshopifyDomain !== context.shopDomain
      )
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      if (!metadata.order)
        throw new ShopifyIntegrationError("SOURCE_UNAVAILABLE", 60);
      const envelope = metadata.order;
      if (
        envelope.id !== lease.orderGid ||
        shopifyTimestampInstant(envelope.updatedAt) <
          shopifyTimestampInstant(envelope.createdAt)
      )
        throw new ShopifyIntegrationError("RESPONSE_INVALID");
      if (
        shopifyTimestampInstant(envelope.createdAt) <
        shopifyTimestampInstant(context.importCreatedAtCutoff)
      )
        return { status: "ineligible", reason: "BEFORE_CUTOFF", envelope };
      const review = (reason: ReviewReason): ShopifyHydrationResult => ({
        status: "review",
        reason,
        completeness: "partial",
        envelope,
      });
      const lines: ShopifyOrderSnapshot["lines"] = [];
      const ids = new Set<string>();
      const cursors = new Set<string>();
      let after: string | null = null;
      let header: ShopifyOrderSnapshot["order"] | null = null;
      for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
        const page: z.infer<typeof pageSchema> = await read(
          pageQuery,
          pageSchema,
          { id: lease.orderGid, after },
        );
        if (!page.order)
          throw new ShopifyIntegrationError("SOURCE_UNAVAILABLE", 60);
        sameRevision(page.order, envelope);
        const parsedHeader = headerSchema.safeParse(page.order);
        if (!parsedHeader.success) return review("SOURCE_DETAIL_LIMIT");
        if (!header) header = parsedHeader.data;
        const { nodes, pageInfo } = page.order.lineItems;
        for (const candidate of nodes) {
          const collections = z
            .object({
              taxLines: z.array(z.unknown()),
              discountAllocations: z.array(z.unknown()),
            })
            .safeParse(candidate);
          if (
            collections.success &&
            (collections.data.taxLines.length > 100 ||
              collections.data.discountAllocations.length > 100)
          )
            return review("SOURCE_DETAIL_LIMIT");
          const properties = z
            .object({
              customAttributes: z.array(
                z.object({ key: z.string(), value: z.string() }),
              ),
            })
            .safeParse(candidate);
          if (
            properties.success &&
            (properties.data.customAttributes.length > 100 ||
              properties.data.customAttributes.some(
                (attribute) =>
                  attribute.key.length > 2000 || attribute.value.length > 2000,
              ))
          )
            return review("ATTRIBUTE_LIMIT");
          const parsed = lineSchema.safeParse(candidate);
          if (!parsed.success || ids.has(parsed.data.id))
            throw new ShopifyIntegrationError("RESPONSE_INVALID");
          const line = parsed.data;
          if (line.quantity <= 0) return review("QUANTITY_NOT_POSITIVE");
          if (line.currentQuantity > line.quantity)
            throw new ShopifyIntegrationError("RESPONSE_INVALID");
          const image = safeImage(line.image);
          ids.add(line.id);
          lines.push({
            ...line,
            image,
            catalogue: {
              provenance: "current_catalogue",
              observedAt: new Date(now()).toISOString(),
              product: null,
              variant: null,
            },
            warnings:
              line.image && !image ? ["IMAGE_REFERENCE_UNAVAILABLE"] : [],
          });
        }
        if (!pageInfo.hasNextPage) break;
        if (
          !nodes.length ||
          !pageInfo.endCursor ||
          cursors.has(pageInfo.endCursor)
        )
          throw new ShopifyIntegrationError("RESPONSE_INVALID");
        cursors.add(pageInfo.endCursor);
        after = pageInfo.endCursor;
        if (lines.length >= 500 || pageIndex === 9) return review("LINE_LIMIT");
      }
      const shippingLines: ShopifyOrderSnapshot["shippingLines"] = [];
      const shippingIds = new Set<string>();
      const shippingCursors = new Set<string>();
      let shippingAfter: string | null = null;
      for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
        const page: z.infer<typeof shippingSchema> = await read(
          shippingQuery,
          shippingSchema,
          { id: lease.orderGid, after: shippingAfter },
        );
        if (!page.order)
          throw new ShopifyIntegrationError("SOURCE_UNAVAILABLE", 60);
        sameRevision(page.order, envelope);
        for (const candidate of page.order.shippingLines.nodes) {
          const parsed = shippingLineSchema.safeParse(candidate);
          if (!parsed.success) return review("SOURCE_DETAIL_LIMIT");
          if (parsed.data.id && shippingIds.has(parsed.data.id))
            throw new ShopifyIntegrationError("RESPONSE_INVALID");
          if (parsed.data.id) shippingIds.add(parsed.data.id);
          shippingLines.push(parsed.data);
        }
        const { nodes, pageInfo } = page.order.shippingLines;
        if (!pageInfo.hasNextPage) break;
        if (
          !nodes.length ||
          !pageInfo.endCursor ||
          shippingCursors.has(pageInfo.endCursor)
        )
          throw new ShopifyIntegrationError("RESPONSE_INVALID");
        shippingCursors.add(pageInfo.endCursor);
        shippingAfter = pageInfo.endCursor;
        if (shippingLines.length >= 500 || pageIndex === 9)
          return review("SHIPPING_LINE_LIMIT");
      }
      // Catalogue fields are observed now, not an immutable checkout snapshot.
      // Fetch separately: optional enrichment failures cannot erase order lines.
      const catalogueIds = [
        ...new Set(
          lines.flatMap((line) =>
            [line.product?.id, line.variant?.id].filter(
              (id): id is string => !!id,
            ),
          ),
        ),
      ];
      for (let offset = 0; offset < catalogueIds.length; offset += 50) {
        const batch = catalogueIds.slice(offset, offset + 50);
        const affected = lines.filter(
          (line) =>
            batch.includes(line.product?.id ?? "") ||
            batch.includes(line.variant?.id ?? ""),
        );
        let response: z.infer<typeof catalogueSchema>;
        try {
          response = await read(catalogueQuery, catalogueSchema, {
            ids: batch,
          });
        } catch (error) {
          if (
            !(error instanceof ShopifyIntegrationError) ||
            ![
              "GRAPHQL_INCOMPLETE",
              "RESPONSE_INVALID",
              "BODY_TOO_LARGE",
              "UPSTREAM_REJECTED",
              "UPSTREAM_UNAVAILABLE",
            ].includes(error.code) ||
            controller.signal.aborted ||
            now() - startedAt >= budgetMs ||
            Date.parse(lease.leaseExpiresAt) <= now()
          )
            throw error;
          for (const line of affected)
            if (!line.warnings.includes("CATALOGUE_UNAVAILABLE"))
              line.warnings.push("CATALOGUE_UNAVAILABLE");
          continue;
        }
        // Shopify nodes preserves request ordering, including null/deleted nodes.
        if (response.nodes.length !== batch.length) {
          for (const line of affected)
            if (!line.warnings.includes("CATALOGUE_UNAVAILABLE"))
              line.warnings.push("CATALOGUE_UNAVAILABLE");
          continue;
        }
        for (let index = 0; index < batch.length; index++) {
          const sourceId = batch[index];
          const candidate = response.nodes[index];
          const product = productSchema.safeParse(candidate);
          const variant = variantSchema.safeParse(candidate);
          for (const line of affected) {
            if (line.product?.id !== sourceId && line.variant?.id !== sourceId)
              continue;
            line.catalogue.observedAt = new Date(now()).toISOString();
            if (
              product.success &&
              product.data.id === sourceId &&
              line.product?.id === sourceId
            ) {
              const { featuredMedia, ...data } = product.data;
              const reference = featuredMedia?.preview?.image;
              const image = safeImage(reference);
              line.catalogue.product = { ...data, image };
              if (
                reference &&
                !image &&
                !line.warnings.includes("IMAGE_REFERENCE_UNAVAILABLE")
              )
                line.warnings.push("IMAGE_REFERENCE_UNAVAILABLE");
            } else if (
              variant.success &&
              variant.data.id === sourceId &&
              line.variant?.id === sourceId &&
              line.product?.id === variant.data.product.id
            ) {
              const image = safeImage(variant.data.image);
              line.catalogue.variant = { ...variant.data, image };
              if (
                variant.data.image &&
                !image &&
                !line.warnings.includes("IMAGE_REFERENCE_UNAVAILABLE")
              )
                line.warnings.push("IMAGE_REFERENCE_UNAVAILABLE");
            } else {
              const warning =
                candidate === null
                  ? "CATALOGUE_REFERENCE_MISSING"
                  : "CATALOGUE_UNAVAILABLE";
              if (!line.warnings.includes(warning)) line.warnings.push(warning);
            }
          }
        }
      }
      const final = await read(metadataQuery, metadataSchema, {
        id: lease.orderGid,
      });
      if (
        final.shop.id !== context.shopGid ||
        final.shop.myshopifyDomain !== context.shopDomain
      )
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      if (!final.order)
        throw new ShopifyIntegrationError("SOURCE_UNAVAILABLE", 60);
      sameRevision(final.order, envelope);
      if (!header || !lines.length) return review("QUANTITY_NOT_POSITIVE");
      if (
        controller.signal.aborted ||
        now() - startedAt >= budgetMs ||
        Date.parse(lease.leaseExpiresAt) <= now()
      )
        throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
      return {
        status: "complete",
        snapshot: {
          completeness: "complete",
          tenantId: context.tenantId,
          connectionId: context.connectionId,
          shopGid: context.shopGid,
          connectionRevision: context.revision,
          jobId: lease.jobId,
          generation: lease.generation,
          observedAt: new Date(now()).toISOString(),
          order: header,
          lines,
          shippingLines,
        },
      };
    } finally {
      clearTimeout(deadline);
      signal?.removeEventListener("abort", abort);
    }
  };
}
