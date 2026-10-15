import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareShopifyDraft } from "../src/integrations/shopify/draft-preparation.ts";
import { inrMinorUnits } from "../src/integrations/shopify/source-money.ts";
import { createShopifyOrderHydrator } from "../src/integrations/shopify/order-hydration.ts";
import {
  snapshot,
  addCatalogue,
  context,
  lease,
  env,
  now,
  bag,
  address,
} from "./fixtures/shopify-draft.mjs";
const prepare = (value = snapshot(), overrides = {}) =>
  prepareShopifyDraft(
    value,
    overrides.context ?? context,
    overrides.lease ?? lease,
    overrides.env ?? env,
    overrides.now ?? now,
  );
const code = (expected) => (error) => {
  assert.equal(error.code, expected);
  assert.equal(error.message, expected);
  return true;
};

test("real hydration -> private draft input retains source facts, zero writes and explicit unresolved dependencies", async () => {
  const fixture = snapshot();
  let calls = 0;
  const transport = async (_url, init) => {
    calls++;
    const query = JSON.parse(init.body).query;
    let data;
    if (query.includes("OSPlusOrderRevision"))
      data = {
        shop: { id: context.shopGid, myshopifyDomain: context.shopDomain },
        order: {
          id: fixture.order.id,
          createdAt: fixture.order.createdAt,
          updatedAt: fixture.order.updatedAt,
        },
      };
    else if (query.includes("OSPlusOrderShipping"))
      data = {
        order: {
          id: fixture.order.id,
          createdAt: fixture.order.createdAt,
          updatedAt: fixture.order.updatedAt,
          shippingLines: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
    else
      data = {
        order: {
          ...fixture.order,
          lineItems: {
            nodes: fixture.lines,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
    return new Response(JSON.stringify({ data }), {
      headers: { "X-Shopify-API-Version": "2026-10" },
    });
  };
  const hydrated = await createShopifyOrderHydrator(transport, () => now)(
    context,
    lease,
    "fictional-token",
    undefined,
    env,
  );
  const before = JSON.stringify(hydrated.snapshot);
  const draft = prepare(hydrated.snapshot);
  assert.equal(draft.kind, "shopify_draft_input");
  assert.equal(draft.releaseEligible, false);
  assert.equal(draft.customerId, null);
  assert.deepEqual(draft.reasons, [
    "CUSTOMER_RESOLUTION_REQUIRED",
    "MAPPING_REQUIRED",
    "DELIVERY_REVIEW_REQUIRED",
  ]);
  assert.equal(draft.money.validation, "restricted_reconciliation_passed");
  assert.equal(draft.money.merchandiseMinorUnits[0].amount, "10000");
  assert.equal(draft.money.localPaymentEntries, 0);
  assert.equal(draft.customer.messagingConsent, false);
  assert.equal(calls, 4);
  assert.equal(JSON.stringify(hydrated.snapshot), before);
  assert.doesNotMatch(JSON.stringify(draft), /fictional-token|leaseToken/);
});

test("partial/incomplete, malformed and duplicate source DTOs cannot become draft inputs", () => {
  for (const edit of [
    (v) => {
      v.completeness = "partial";
    },
    (v) => {
      v.lines = [];
    },
    (v) => {
      v.lines.push(structuredClone(v.lines[0]));
    },
    (v) => {
      v.lines[0].id = 123;
    },
    (v) => {
      v.lines[0].currentQuantity = 2;
    },
    (v) => {
      v.order.currentTotalPriceSet.shopMoney.amount = "1e3";
    },
  ]) {
    const value = snapshot();
    edit(value);
    assert.throws(() => prepare(value), code("RESPONSE_INVALID"));
  }
});

test("binding and every lease generation/job/order/revision fence are checked before normalization", () => {
  for (const patch of [
    { tenantId: lease.jobId },
    { connectionId: lease.jobId },
    { shopGid: "gid://shopify/Shop/999" },
    { jobId: lease.connectionId },
    { generation: 2 },
    { connectionRevision: 1 },
  ])
    assert.throws(
      () => prepare({ ...snapshot(), ...patch }),
      code("ACCESS_DENIED"),
    );
  for (const patch of [
    { tenantId: lease.jobId },
    { connectionId: lease.jobId },
    { orderGid: "gid://shopify/Order/999" },
    { jobId: lease.connectionId },
    { generation: 2 },
    { connectionRevision: 1 },
    { leaseExpiresAt: "2026-10-08T11:59:00Z" },
  ])
    assert.throws(
      () => prepare(snapshot(), { lease: { ...lease, ...patch } }),
      code("ACCESS_DENIED"),
    );
});

test("disabled/foreign readiness and Preview/local flags fail closed, no caller role can bypass", () => {
  for (const patch of [
    { protectedCustomerFieldsVerified: false },
    { requiredScopesVerified: false },
    { tenantStatus: "suspended" },
    { status: "paused" },
    { processingEnabled: false },
    { environment: "development" },
    { role: "manager" },
  ])
    assert.throws(
      () => prepare(snapshot(), { context: { ...context, ...patch } }),
      code("ACCESS_DENIED"),
    );
  for (const patch of [
    { SHOPIFY_SYNC_ENABLED: "false" },
    { SHOPIFY_HYDRATION_ENABLED: "false" },
    { VERCEL_ENV: "preview" },
    { VERCEL_ENV: undefined },
  ])
    assert.throws(
      () => prepare(snapshot(), { env: { ...env, ...patch } }),
      code("CONFIGURATION_INVALID"),
    );
});

test("freshness, future observation and exact cutoff are checked; stale input is not release authority", () => {
  assert.equal(
    prepare(snapshot(), { now: now + 120000 }).releaseEligible,
    false,
  );
  assert.throws(
    () => prepare(snapshot(), { now: now + 120001 }),
    code("SOURCE_CHANGED"),
  );
  assert.throws(
    () => prepare({ ...snapshot(), observedAt: "2026-10-08T12:00:00.000001Z" }),
    code("SOURCE_CHANGED"),
  );
  const before = snapshot();
  before.order.createdAt = "2026-10-08T00:00:00Z";
  assert.throws(
    () =>
      prepare(before, {
        context: {
          ...context,
          importCreatedAtCutoff: "2026-10-08T00:00:00.000001Z",
        },
      }),
    code("SOURCE_CHANGED"),
  );
});

test("explicit colour aliases and raw size retain order/current catalogue provenance; SKU is trim-only", () => {
  const draft = prepare(addCatalogue(snapshot()));
  const line = draft.lines[0];
  assert.equal(line.colour.value, "Blue");
  assert.equal(line.size.value, "M");
  assert.equal(line.standardSizeId, null);
  assert.equal(line.originalSku, " Shirt-01 ");
  assert.equal(line.skuLookup, "Shirt-01");
  assert.equal(line.title, "Synthetic blue shirt");
  assert.equal(line.descriptionProvenance, "current_catalogue");
  assert.equal(line.colour.evidence[0].provenance, "order_property");
  assert.equal(line.colour.evidence[1].provenance, "current_variant_option");
});

test("contradictory options hold review; no colour/size inference from title or variant label", () => {
  const conflict = addCatalogue(snapshot());
  conflict.lines[0].catalogue.variant.selectedOptions = [
    { name: "COLOR", value: "Red" },
    { name: "Size", value: "L" },
  ];
  conflict.lines[0].customAttributes.push({ key: "Size", value: "M" });
  const draft = prepare(conflict);
  assert.equal(draft.lines[0].colour.value, null);
  assert.equal(draft.lines[0].size.value, null);
  assert.ok(draft.reasons.includes("CONTRADICTORY_COLOUR"));
  assert.ok(draft.reasons.includes("CONTRADICTORY_SIZE"));
  const absent = snapshot();
  absent.lines[0].customAttributes = [];
  const line = prepare(absent).lines[0];
  assert.equal(line.colour.value, null);
  assert.equal(line.size.value, null);
  assert.ok(line.warnings.includes("COLOUR_UNAVAILABLE"));
  const multiple = snapshot();
  multiple.lines[0].customAttributes = [
    { key: "Shade", value: "Blue / White" },
  ];
  assert.equal(prepare(multiple).lines[0].colour.value, "Blue / White");
});

test("line -> current variant -> current product image fallback is labelled and never becomes public final photo", () => {
  const value = addCatalogue(snapshot());
  assert.equal(
    prepare(value).lines[0].imageProvenance,
    "current_product_fallback",
  );
  value.lines[0].catalogue.variant.image = {
    id: null,
    url: "https://cdn.shopify.com/variant.jpg",
    altText: null,
  };
  assert.equal(prepare(value).lines[0].imageProvenance, "current_variant");
  value.lines[0].image = {
    id: null,
    url: "https://cdn.shopify.com/line.jpg",
    altText: null,
  };
  const line = prepare(value).lines[0];
  assert.equal(line.imageProvenance, "source_line");
  assert.equal("final_photo_url" in line, false);
  value.lines[0].image.url = "https://evil.example/file";
  assert.throws(() => prepare(value), code("RESPONSE_INVALID"));
});

test("deleted catalogue and unavailable optional enrichment do not discard source line, notes or properties", () => {
  const value = snapshot();
  value.lines[0].warnings = ["CATALOGUE_UNAVAILABLE"];
  value.order.note = "<script>do not execute</script>";
  const draft = prepare(value);
  assert.equal(draft.lines[0].quantity, 1);
  assert.equal(draft.lines[0].description, null);
  assert.equal(draft.sourceSnapshot.order.note, value.order.note);
  assert.equal(draft.lines[0].colour.value, "Blue");
});

test("customer/address names and store-scoped identity candidates never create/link a customer", () => {
  const value = snapshot();
  value.order.customer = {
    id: "gid://shopify/Customer/13",
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
  };
  value.order.shippingAddress = address();
  const draft = prepare(value);
  assert.equal(draft.customer.proposedName, "Fictional Buyer");
  assert.equal(draft.customer.generatedName, false);
  assert.equal(draft.customer.shopifyCustomerGid, value.order.customer.id);
  assert.equal(draft.customer.guestOrderKey, null);
  assert.equal(draft.customerId, null);
  const anonymous = prepare();
  assert.equal(anonymous.customer.generatedName, true);
  assert.equal(
    anonymous.customer.guestOrderKey,
    `${context.shopGid}/${lease.orderGid}`,
  );
  const other = snapshot();
  other.order.id = "gid://shopify/Order/999";
  other.order.legacyResourceId = "999";
  assert.notEqual(
    prepare(other, { lease: { ...lease, orderGid: other.order.id } }).customer
      .guestOrderKey,
    anonymous.customer.guestOrderKey,
  );
});

test("customer primary then order phone only; alternate address phones never become match keys", () => {
  const value = snapshot();
  value.order.customer = {
    id: "gid://shopify/Customer/13",
    firstName: "Fictional",
    lastName: null,
    email: "synthetic@example.invalid",
    phone: "+919876543210",
  };
  value.order.phone = "+14155552671";
  value.order.shippingAddress = address("IN", "+61412345678");
  const draft = prepare(value);
  assert.equal(draft.customer.verifiedPhoneE164, "+919876543210");
  assert.deepEqual(draft.customer.alternatePhones, ["+61412345678"]);
  assert.equal(draft.customer.messagingConsent, false);
  assert.equal(draft.customer.emailSuggestion, "synthetic@example.invalid");
  value.order.customer.phone = null;
  assert.equal(prepare(value).customer.verifiedPhoneE164, "+14155552671");
});

test("conflicting countries/unverified numbers need review, explicit international format is authoritative", () => {
  const value = snapshot();
  value.order.phone = "9876543210";
  value.order.shippingAddress = address("IN");
  value.order.billingAddress = address("US");
  const draft = prepare(value);
  assert.equal(draft.customer.verifiedPhoneE164, null);
  assert.ok(draft.reasons.includes("PHONE_COUNTRY_CONFLICT"));
  value.order.phone = "+919876543210";
  assert.equal(prepare(value).customer.verifiedPhoneE164, "+919876543210");
  value.order.phone = "call +919876543210";
  assert.equal(prepare(value).customer.verifiedPhoneE164, null);
  assert.ok(prepare(value).reasons.includes("UNVERIFIED_PHONE"));
});

test("exact INR arithmetic handles huge/free values, rejects hidden fractions and never double-subtracts discounts", () => {
  assert.equal(
    inrMinorUnits("9007199254740993.12").toString(),
    "900719925474099312",
  );
  assert.equal(inrMinorUnits("0.000000"), BigInt(0));
  for (const amount of ["1.001", "1e2", "-1", "NaN", " 1", "01.00"])
    assert.equal(inrMinorUnits(amount), null);
  assert.equal(prepare().money.validation, "restricted_reconciliation_passed"); // 110 - already allocated 10 = 100; not 90
  const free = snapshot();
  for (const key of [
    "currentTotalPriceSet",
    "currentSubtotalPriceSet",
    "currentTotalTaxSet",
  ])
    free.order[key] = bag("0");
  free.order.taxLines = [];
  free.order.currentTaxLines = [];
  free.lines[0].priceAfterAllDiscountsBeforeTaxesSet = bag("0");
  free.lines[0].taxLines = [];
  assert.equal(prepare(free).money.merchandiseMinorUnits[0].amount, "0");
  const precision = snapshot();
  precision.lines[0].priceAfterAllDiscountsBeforeTaxesSet = bag("100.001");
  assert.ok(prepare(precision).money.reasons.includes("MONEY_PRECISION"));
});

test("unexplained total/currency/negative money differences hold without a rupee/FX/local payment projection", () => {
  const value = snapshot();
  value.order.currentTotalPriceSet = bag("117.99");
  assert.ok(prepare(value).reasons.includes("TOTAL_MISMATCH"));
  value.order.currentTotalPriceSet.shopMoney.currencyCode = "USD";
  assert.ok(prepare(value).reasons.includes("CURRENCY_MISMATCH"));
  value.order.currencyCode = "USD";
  assert.ok(prepare(value).reasons.includes("UNSUPPORTED_CURRENCY"));
  assert.equal(prepare(value).money.merchandiseMinorUnits, null);
  const negative = snapshot();
  negative.order.currentTotalTaxSet = bag("-1");
  assert.ok(prepare(negative).reasons.includes("NEGATIVE_SOURCE_MONEY"));
});

test("inclusive/duties/fees/tips/rounding/refunds/edit shapes retain source facts but cannot claim reconciled release value", () => {
  for (const edit of [
    (v) => {
      v.order.taxesIncluded = true;
    },
    (v) => {
      v.order.currentTotalDutiesSet = bag("1");
    },
    (v) => {
      v.order.currentTotalAdditionalFeesSet = bag("1");
    },
    (v) => {
      v.order.totalTipReceivedSet = bag("1");
    },
    (v) => {
      v.order.totalCashRoundingAdjustment.paymentSet = bag("0.01");
    },
    (v) => {
      v.order.totalRefundedSet = bag("1");
    },
    (v) => {
      v.order.edited = true;
    },
  ]) {
    const value = snapshot();
    edit(value);
    const draft = prepare(value);
    assert.ok(draft.reasons.includes("FINANCIAL_SHAPE_REVIEW"));
    assert.equal(draft.money.merchandiseMinorUnits, null);
    assert.equal(draft.money.localPaymentEntries, 0);
    assert.equal(draft.releaseEligible, false);
  }
});

test("cancel/refund/quantity edit/gift card/digital line retain all detail and cumulative reasons, no automatic effects", () => {
  const value = snapshot();
  value.order.cancelledAt = "2026-10-08T02:00:00Z";
  value.order.totalRefundedSet = bag("1");
  value.lines[0].currentQuantity = 0;
  value.lines[0].isGiftCard = true;
  value.lines[0].requiresShipping = false;
  const draft = prepare(value);
  for (const reason of [
    "SOURCE_CANCELLED",
    "SOURCE_REFUND",
    "SOURCE_EDIT",
    "UNSUPPORTED_LINE_TYPE",
  ])
    assert.ok(draft.reasons.includes(reason));
  assert.equal(draft.lines.length, 1);
  assert.equal(draft.lines[0].quantity, 1);
  assert.equal(draft.lines[0].currentQuantity, 0);
});

test("catalogue-only change never rewrites order SKU/name or masquerades as source order edit", () => {
  const value = addCatalogue(snapshot());
  const first = prepare(value);
  value.lines[0].catalogue.product.description = "Changed current catalogue";
  const second = prepare(value);
  assert.equal(second.sourceUpdatedAt, first.sourceUpdatedAt);
  assert.equal(second.lines[0].originalSku, first.lines[0].originalSku);
  assert.equal(second.reasons.includes("SOURCE_EDIT"), false);
  assert.notEqual(second.lines[0].description, first.lines[0].description);
});

test("restricted reconciliation checks tax and shipping detail, not only the grand-total equation", () => {
  const tax = snapshot();
  tax.order.currentTaxLines[0].priceSet = bag("17.00");
  assert.ok(prepare(tax).money.reasons.includes("TOTAL_MISMATCH"));
  const shipping = snapshot();
  shipping.order.currentShippingPriceSet = bag("5.00");
  shipping.order.currentTotalPriceSet = bag("123.00");
  assert.ok(prepare(shipping).money.reasons.includes("TOTAL_MISMATCH"));
});

test("explicit foreign prefixes never fall through to an Indian national-phone guess", () => {
  for (const input of ["+9876543210", "009876543210"]) {
    const value = snapshot();
    value.order.phone = input;
    value.order.shippingAddress = address("IR");
    const draft = prepare(value);
    assert.notEqual(draft.customer.verifiedPhoneE164, "+919876543210");
    assert.equal(draft.customer.verifiedPhoneE164, null);
    assert.ok(draft.reasons.includes("UNVERIFIED_PHONE"));
  }
});

test("INR presentment precision and historical duty/fee facts cannot silently qualify for the restricted path", () => {
  const precision = snapshot();
  precision.order.presentmentCurrencyCode = "INR";
  const rewrite = (value) => {
    if (value && typeof value === "object") {
      if (value.presentmentMoney) value.presentmentMoney.currencyCode = "INR";
      for (const child of Object.values(value)) rewrite(child);
    }
  };
  rewrite(precision);
  precision.lines[0].priceAfterAllDiscountsBeforeTaxesSet.presentmentMoney.amount =
    "100.001";
  assert.ok(prepare(precision).money.reasons.includes("MONEY_PRECISION"));
  for (const field of [
    "originalTotalDutiesSet",
    "originalTotalAdditionalFeesSet",
  ]) {
    const value = snapshot();
    value.order[field] = bag("1.00");
    assert.ok(prepare(value).money.reasons.includes("FINANCIAL_SHAPE_REVIEW"));
  }
});
