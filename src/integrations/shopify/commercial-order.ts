import "server-only";
import { z } from "zod";
import { parseShopifyOrderSnapshot } from "./order-hydration.ts";
import { projectShopifySourcePayment } from "./source-payment.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const text = (max: number) => z.string().max(max);
const time = z.string().datetime({ offset: true });
const currency = z.string().regex(/^[A-Z]{3}$/);
const decimal = z.string().regex(/^-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,6})?$/);
const address = z.object({ firstName: text(256).nullable(), lastName: text(256).nullable(), phone: text(128).nullable(),
  address1: text(2048).nullable(), address2: text(2048).nullable(), city: text(256).nullable(), province: text(256).nullable(),
  countryCodeV2: z.string().regex(/^[A-Z]{2}$/).nullable(), zip: text(128).nullable() }).strict().nullable();
const amounts = z.object({ total: decimal, received: decimal, refunded: decimal, net: decimal, outstanding: decimal }).strict();
const payment = z.object({ availability: z.literal("available"),
  status: z.enum(["AUTHORIZED", "EXPIRED", "PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "VOIDED"]).nullable(),
  statusLabel: text(128), currency, presentmentCurrency: currency, amounts, presentmentAmounts: amounts,
  observedAt: time, sourceUpdatedAt: time, productionHeld: z.boolean(),
  validation: z.enum(["source_consistent", "review"]), reasons: z.array(text(80)).max(60),
}).strict();

// Normalized BUSINESS records, distinct from temporary raw API/encrypted
// hydration payloads. Versioned/strict so extra raw fields cannot silently
// become durable when Shopify adds fields. Storage must be tenant/owner scoped.
export const shopifyCommercialDetailsSchema = z.object({
  sourceNumber: text(256), createdAt: time, updatedAt: time, cancelledAt: time.nullable(),
  fulfillmentStatus: text(64), note: text(10000).nullable(),
  customer: z.object({ name: text(513), email: text(512).nullable(), phone: text(128).nullable() }).strict(),
  shippingAddress: address, billingAddress: address, currency, subtotal: decimal, shipping: decimal, tax: decimal, discount: decimal,
  payment, lines: z.array(z.object({ id: z.string().regex(/^gid:\/\/shopify\/LineItem\/[1-9][0-9]{0,31}$/),
    title: text(2000), variant: text(2000).nullable(), sku: text(512).nullable(),
    quantity: z.number().int().positive().safe(), currentQuantity: z.number().int().nonnegative().safe(),
    isGiftCard: z.boolean(), requiresShipping: z.boolean(),
    unitPrice: decimal, unitCurrency: currency, currentLineSubtotal: decimal,
    properties: z.array(z.object({ name: text(2000), value: text(2000) }).strict()).max(100),
  }).strict()).max(1000),
}).strict();
export type ShopifyCommercialDetails = z.infer<typeof shopifyCommercialDetailsSchema>;

export function readShopifyCommercialPayment(input: unknown, expected: { tenantId: string; orderId: string }) {
  const parsed = z.object({ tenantId: z.string().uuid(), orderId: z.string().uuid(), payment }).strict().parse(input);
  if (parsed.tenantId !== expected.tenantId || parsed.orderId !== expected.orderId)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  return parsed.payment;
}

export function projectShopifyCommercialDetails(input: unknown): ShopifyCommercialDetails {
  const source = parseShopifyOrderSnapshot(input), order = source.order;
  const person = order.customer ?? order.shippingAddress ?? order.billingAddress;
  return shopifyCommercialDetailsSchema.parse({ sourceNumber: order.name,
    createdAt: order.createdAt, updatedAt: order.updatedAt, cancelledAt: order.cancelledAt,
    fulfillmentStatus: order.displayFulfillmentStatus, note: order.note,
    customer: { name: [person?.firstName, person?.lastName].filter(Boolean).join(" ") || "Shopify guest",
      email: order.email ?? order.customer?.email ?? null, phone: order.phone ?? order.customer?.phone ?? null },
    shippingAddress: order.shippingAddress, billingAddress: order.billingAddress,
    currency: order.currencyCode, subtotal: order.currentSubtotalPriceSet.shopMoney.amount,
    shipping: order.currentShippingPriceSet.shopMoney.amount, tax: order.currentTotalTaxSet.shopMoney.amount,
    discount: order.currentTotalDiscountsSet.shopMoney.amount, payment: projectShopifySourcePayment(source),
    lines: source.lines.map(line => ({ id: line.id, title: line.title, variant: line.variantTitle, sku: line.sku,
      quantity: line.quantity, currentQuantity: line.currentQuantity, unitPrice: line.originalUnitPriceSet.shopMoney.amount,
      isGiftCard: line.isGiftCard, requiresShipping: line.requiresShipping,
      unitCurrency: line.originalUnitPriceSet.shopMoney.currencyCode, currentLineSubtotal: line.priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount,
      properties: line.customAttributes.map(attribute => ({ name: attribute.key, value: attribute.value })) })),
  });
}

const durableSchema = z.object({ schemaVersion: z.literal(1), tenantId: z.string().uuid(), orderId: z.string().uuid(),
  number: text(256), sourceOrderGid: z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/),
  details: shopifyCommercialDetailsSchema }).strict();

// No raw key or expiry is needed to render retained, normalized business data.
// Permission checks belong to the SQL reader; this repeats exact tenant/order
// validation before returning the enumerated display DTO.
export function readShopifyCommercialDetails(input: unknown, expected: { tenantId: string; orderId: string }) {
  const row = durableSchema.parse(input);
  if (row.tenantId !== expected.tenantId || row.orderId !== expected.orderId)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  return { id: row.orderId, number: row.number, sourceOrderGid: row.sourceOrderGid,
    availability: "available" as const, ...row.details };
}
