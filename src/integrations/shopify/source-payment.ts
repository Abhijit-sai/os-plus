import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { ShopifyIntegrationError } from "./errors.ts";
import { parseShopifyOrderSnapshot, shopifyTimestampInstant } from "./order-hydration.ts";
import { openShopifySource } from "./source-crypto.ts";

const statuses = ["AUTHORIZED", "EXPIRED", "PAID", "PARTIALLY_PAID", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "VOIDED"] as const;
type FinancialStatus = typeof statuses[number];
const labels: Record<FinancialStatus, string> = {
  AUTHORIZED: "Authorized · not captured", EXPIRED: "Authorization expired", PAID: "Paid",
  PARTIALLY_PAID: "Partially paid", PARTIALLY_REFUNDED: "Partially refunded",
  PENDING: "Pending", REFUNDED: "Refunded", VOIDED: "Authorization voided",
};
type Amounts = { total: string; received: string; refunded: string; net: string; outstanding: string };
export type ShopifySourcePayment = {
  availability: "available"; status: FinancialStatus | null; statusLabel: string;
  currency: string; presentmentCurrency: string; amounts: Amounts; presentmentAmounts: Amounts;
  observedAt: string; sourceUpdatedAt: string; productionHeld: boolean;
  validation: "source_consistent" | "review"; reasons: string[];
};
export type ShopifyPaymentDisplay = ShopifySourcePayment | { availability: "unavailable" };

// Decimal strings are source facts, not fabricated transactions. Six-digit
// integer scaling matches the authenticated source schema, without rounding/FX.
const decimal = (value: string) => {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const scaled = BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
  return negative ? -scaled : scaled;
};
export function projectShopifySourcePayment(input: unknown, productionHeld = false): ShopifySourcePayment {
  const source = parseShopifyOrderSnapshot(input), order = source.order;
  const status = statuses.find(value => value === order.displayFinancialStatus) ?? null;
  const reasons = new Set<string>();
  if (!status) reasons.add("UNKNOWN_PAYMENT_STATUS");
  const bags = { total: order.currentTotalPriceSet, received: order.totalReceivedSet,
    refunded: order.totalRefundedSet, net: order.netPaymentSet, outstanding: order.totalOutstandingSet };
  for (const bag of Object.values(bags)) {
    if (bag.shopMoney.currencyCode !== order.currencyCode || bag.presentmentMoney.currencyCode !== order.presentmentCurrencyCode)
      throw new ShopifyIntegrationError("RESPONSE_INVALID");
  }
  const amounts = Object.fromEntries(Object.entries(bags).map(([key, bag]) => [key, bag.shopMoney.amount])) as Amounts;
  const presentmentAmounts = Object.fromEntries(Object.entries(bags).map(([key, bag]) => [key, bag.presentmentMoney.amount])) as Amounts;
  for (const values of [amounts, presentmentAmounts]) {
    const received = decimal(values.received), refunded = decimal(values.refunded), net = decimal(values.net);
    if ([values.total, values.received, values.refunded].some(value => decimal(value) < BigInt(0))) reasons.add("NEGATIVE_SOURCE_PAYMENT");
    if (net !== received - refunded) reasons.add("PAYMENT_NET_MISMATCH");
    if (status === "PAID" && decimal(values.outstanding) > BigInt(0)) reasons.add("PAYMENT_STATUS_CONFLICT");
    if (status === "PARTIALLY_PAID" && (received <= BigInt(0) || decimal(values.outstanding) <= BigInt(0))) reasons.add("PAYMENT_STATUS_CONFLICT");
    if (["AUTHORIZED", "EXPIRED", "VOIDED"].includes(status ?? "") && received !== BigInt(0)) reasons.add("PAYMENT_STATUS_CONFLICT");
    if (status === "PARTIALLY_REFUNDED" && !(refunded > BigInt(0) && refunded < received)) reasons.add("PAYMENT_STATUS_CONFLICT");
    if (status === "REFUNDED" && !(refunded > BigInt(0) && refunded === received)) reasons.add("PAYMENT_STATUS_CONFLICT");
  }
  // Preserve the reported decimals even when held; never round them into a
  // normal-looking local amount. INR nonzero sub-paise values need review.
  for (const [currency, values] of [[order.currencyCode, amounts], [order.presentmentCurrencyCode, presentmentAmounts]] as const) {
    if (currency === "INR" && Object.values(values).some(value => /[1-9]/.test((value.split(".")[1] ?? "").slice(2))))
      reasons.add("PAYMENT_PRECISION_REVIEW");
  }
  return { availability: "available", status, statusLabel: status ? labels[status] : "Status unavailable",
    currency: order.currencyCode, presentmentCurrency: order.presentmentCurrencyCode, amounts, presentmentAmounts,
    observedAt: source.observedAt, sourceUpdatedAt: order.updatedAt, productionHeld,
    validation: reasons.size ? "review" : "source_consistent", reasons: [...reasons] };
}

const gid = (type: string) => z.string().regex(new RegExp(`^gid://shopify/${type}/[1-9][0-9]{0,31}$`));
const rowSchema = z.object({ tenantId: z.string().uuid(), orderId: z.string().uuid(), connectionId: z.string().uuid(),
  shopGid: gid("Shop"), sourceOrderGid: gid("Order"), sourceDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceUpdatedAt: z.string().datetime({ offset: true }), observedAt: z.string().datetime({ offset: true }),
  completeness: z.enum(["complete", "partial"]), sealedSource: z.unknown(), productionHeld: z.boolean() }).strict();

// Only called on the trusted server after a current actor/tenant/order scoped
// read. Return financial facts only; never raw source/customer/card/receipt data.
export function decodeShopifySourcePayment(input: unknown, expected: { tenantId: string; orderId: string },
  env: NodeJS.ProcessEnv = process.env): ShopifySourcePayment {
  const row = rowSchema.parse(input);
  if (row.tenantId !== expected.tenantId || row.orderId !== expected.orderId) throw new ShopifyIntegrationError("ACCESS_DENIED");
  if (row.completeness !== "complete") throw new ShopifyIntegrationError("REVIEW_REQUIRED");
  const text = openShopifySource(row.sealedSource,
    JSON.stringify([row.tenantId, row.connectionId, row.shopGid, row.sourceOrderGid, row.sourceDigest]), env);
  if (createHash("sha256").update(text).digest("hex") !== row.sourceDigest) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  let stored: unknown;
  try { stored = JSON.parse(text); } catch { throw new ShopifyIntegrationError("RESPONSE_INVALID"); }
  const envelope = z.object({ kind: z.literal("shopify_draft_input"), schemaVersion: z.literal(1),
    tenantId: z.string().uuid(), connectionId: z.string().uuid(), shopGid: gid("Shop"), sourceOrderGid: gid("Order"),
    sourceSnapshot: z.unknown() }).parse(stored);
  if (envelope.tenantId !== row.tenantId || envelope.connectionId !== row.connectionId ||
    envelope.shopGid !== row.shopGid || envelope.sourceOrderGid !== row.sourceOrderGid) throw new ShopifyIntegrationError("ACCESS_DENIED");
  const source = parseShopifyOrderSnapshot(envelope.sourceSnapshot);
  if (source.tenantId !== row.tenantId || source.connectionId !== row.connectionId || source.shopGid !== row.shopGid ||
    source.order.id !== row.sourceOrderGid || shopifyTimestampInstant(source.order.updatedAt) !== shopifyTimestampInstant(row.sourceUpdatedAt) ||
    shopifyTimestampInstant(source.observedAt) !== shopifyTimestampInstant(row.observedAt)) throw new ShopifyIntegrationError("ACCESS_DENIED");
  return projectShopifySourcePayment(source, row.productionHeld);
}
