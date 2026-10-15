import "server-only";

import type { ShopifyOrderSnapshot } from "./order-hydration.ts";

type MoneyBag = ShopifyOrderSnapshot["order"]["currentTotalPriceSet"];
type MoneyReason =
  | "UNSUPPORTED_CURRENCY"
  | "CURRENCY_MISMATCH"
  | "MONEY_PRECISION"
  | "NEGATIVE_SOURCE_MONEY"
  | "TOTAL_MISMATCH"
  | "FINANCIAL_SHAPE_REVIEW";

// INR only. Do not round source values or convert through Number; JSON-facing
// minor units remain decimal strings even above JavaScript's safe integer range.
export function inrMinorUnits(amount: string): bigint | null {
  const match = /^(0|[1-9][0-9]{0,17})(?:\.(\d{1,6}))?$/.exec(amount);
  if (!match || /[1-9]/.test((match[2] ?? "").slice(2))) return null;
  return (
    BigInt(match[1]) * BigInt(100) +
    BigInt((match[2] ?? "").slice(0, 2).padEnd(2, "0"))
  );
}

export function inspectShopifySourceMoney(snapshot: ShopifyOrderSnapshot) {
  const order = snapshot.order;
  const reasons = new Set<MoneyReason>();
  const bags: MoneyBag[] = [
    order.currentTotalPriceSet,
    order.currentSubtotalPriceSet,
    order.currentTotalTaxSet,
    order.currentTotalDiscountsSet,
    order.totalShippingPriceSet,
    order.totalOutstandingSet,
    order.originalTotalPriceSet,
    order.currentShippingPriceSet,
    order.totalReceivedSet,
    order.netPaymentSet,
    order.totalRefundedSet,
    order.totalRefundedShippingSet,
    order.totalTipReceivedSet,
    ...[
      order.currentTotalDutiesSet,
      order.originalTotalDutiesSet,
      order.currentTotalAdditionalFeesSet,
      order.originalTotalAdditionalFeesSet,
    ].filter((bag): bag is MoneyBag => bag !== null),
    ...order.taxLines.map((tax) => tax.priceSet),
    ...order.currentTaxLines.map((tax) => tax.priceSet),
    ...snapshot.lines.flatMap((line) => [
      line.priceAfterAllDiscountsBeforeTaxesSet,
      line.originalTotalSet,
      line.originalUnitPriceSet,
      line.totalDiscountSet,
      ...line.taxLines.map((tax) => tax.priceSet),
      ...line.discountAllocations.map(
        (discount) => discount.allocatedAmountSet,
      ),
    ]),
    ...snapshot.shippingLines.flatMap((line) => [
      line.originalPriceSet,
      line.discountedPriceSet,
      line.currentDiscountedPriceSet,
      ...line.taxLines.map((tax) => tax.priceSet),
      ...line.discountAllocations.map(
        (discount) => discount.allocatedAmountSet,
      ),
    ]),
  ];
  const rounding = [
    order.totalCashRoundingAdjustment.paymentSet,
    order.totalCashRoundingAdjustment.refundSet,
  ];
  for (const bag of [...bags, ...rounding]) {
    if (
      bag.shopMoney.currencyCode !== order.currencyCode ||
      bag.presentmentMoney.currencyCode !== order.presentmentCurrencyCode
    )
      reasons.add("CURRENCY_MISMATCH");
  }
  if (order.currencyCode !== "INR") reasons.add("UNSUPPORTED_CURRENCY");
  for (const bag of bags) {
    if (
      bag.shopMoney.amount.startsWith("-") ||
      bag.presentmentMoney.amount.startsWith("-")
    )
      reasons.add("NEGATIVE_SOURCE_MONEY");
    if (
      (order.currencyCode === "INR" &&
        inrMinorUnits(bag.shopMoney.amount) === null) ||
      (order.presentmentCurrencyCode === "INR" &&
        inrMinorUnits(bag.presentmentMoney.amount) === null)
    )
      reasons.add("MONEY_PRECISION");
  }
  const positive = (bag: MoneyBag | null) =>
    bag !== null && /[1-9]/.test(bag.shopMoney.amount);
  // Current/original fields and cash-settlement rounding have different source
  // semantics. Complex/refunded/inclusive cases stay held for the later financial
  // adapter, rather than forcing every source through a manual GST calculator.
  if (
    order.taxesIncluded ||
    order.edited ||
    order.cancelledAt !== null ||
    positive(order.totalRefundedSet) ||
    positive(order.totalTipReceivedSet) ||
    positive(order.currentTotalDutiesSet) ||
    positive(order.originalTotalDutiesSet) ||
    positive(order.currentTotalAdditionalFeesSet) ||
    positive(order.originalTotalAdditionalFeesSet) ||
    positive(order.totalRefundedShippingSet) ||
    rounding.some(positive) ||
    snapshot.lines.some((line) => line.quantity !== line.currentQuantity) ||
    snapshot.shippingLines.some((line) => line.isRemoved)
  )
    reasons.add("FINANCIAL_SHAPE_REVIEW");
  if (!reasons.size) {
    // Null duties/fees represent no reported component for this restricted path.
    // Discounts are already reflected in the authoritative merchandise amounts;
    // never subtract currentTotalDiscountsSet a second time.
    const amounts = snapshot.lines.map((line) =>
      inrMinorUnits(line.priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount),
    );
    const subtotal = inrMinorUnits(
      order.currentSubtotalPriceSet.shopMoney.amount,
    );
    const shipping = inrMinorUnits(
      order.currentShippingPriceSet.shopMoney.amount,
    );
    const tax = inrMinorUnits(order.currentTotalTaxSet.shopMoney.amount);
    const total = inrMinorUnits(order.currentTotalPriceSet.shopMoney.amount);
    if (
      subtotal === null ||
      shipping === null ||
      tax === null ||
      total === null ||
      amounts.some((amount) => amount === null)
    ) {
      reasons.add("MONEY_PRECISION");
    } else {
      const merchandise = amounts.reduce<bigint>(
        (sum, amount) => sum + (amount ?? BigInt(0)),
        BigInt(0),
      );
      const sum = (values: MoneyBag[]) =>
        values.reduce(
          (result, bag) =>
            result + (inrMinorUnits(bag.shopMoney.amount) ?? BigInt(0)),
          BigInt(0),
        );
      const currentTax = sum(order.currentTaxLines.map((tax) => tax.priceSet));
      const detailedTax = sum([
        ...snapshot.lines.flatMap((line) =>
          line.taxLines.map((tax) => tax.priceSet),
        ),
        ...snapshot.shippingLines.flatMap((line) =>
          line.taxLines.map((tax) => tax.priceSet),
        ),
      ]);
      const detailedShipping = sum(
        snapshot.shippingLines.map((line) => line.currentDiscountedPriceSet),
      );
      if (
        merchandise !== subtotal ||
        merchandise + shipping + tax !== total ||
        currentTax !== tax ||
        detailedTax !== tax ||
        detailedShipping !== shipping
      )
        reasons.add("TOTAL_MISMATCH");
    }
  }
  return {
    treatment: "external_shopify" as const,
    validation: reasons.size
      ? ("review" as const)
      : ("restricted_reconciliation_passed" as const),
    reasons: [...reasons],
    // Not an instruction to write orders/items or any local finance record.
    merchandiseMinorUnits: reasons.size
      ? null
      : snapshot.lines.map((line) => ({
          lineGid: line.id,
          currency: "INR" as const,
          amount:
            inrMinorUnits(
              line.priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount,
            )?.toString() ?? null,
        })),
    localPaymentEntries: 0 as const,
  };
}
