import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopifyOrderHydrator } from "../src/integrations/shopify/order-hydration.ts";
import {
  connectionA,
  tenantA,
  tenantB,
  orderGid,
} from "./fixtures/shopify-intake.mjs";

// Fictional response fixtures only; no env file, credentials, DB or real fetch.
const current = Date.parse("2026-10-08T12:00:00Z");
const context = {
  tenantId: tenantA,
  connectionId: connectionA.id,
  shopGid: "gid://shopify/Shop/101",
  shopDomain: "synthetic-intake.myshopify.com",
  appRef: "synthetic-app",
  environment: "production",
  apiVersion: "2026-10",
  revision: 2,
  status: "verified",
  tenantStatus: "active",
  intakeEnabled: true,
  processingEnabled: true,
  requiredScopesVerified: true,
  protectedCustomerFieldsVerified: true,
  importCreatedAtCutoff: "2026-10-08T00:00:00Z",
};
const lease = {
  jobId: "30000000-0000-4000-8000-000000000001",
  tenantId: tenantA,
  connectionId: connectionA.id,
  orderGid,
  generation: 1,
  connectionRevision: 2,
  leaseToken: "40000000-0000-4000-8000-000000000001",
  leaseExpiresAt: "2026-10-08T12:02:00Z",
};
const env = {
  VERCEL_ENV: "production",
  SHOPIFY_DEPLOYMENT_ENV: "production",
  SHOPIFY_API_VERSION: "2026-10",
  SHOPIFY_HYDRATION_ENABLED: "true",
  SHOPIFY_SYNC_ENABLED: "true",
};
const bag = {
  shopMoney: { amount: "9007199254740993.12", currencyCode: "INR" },
  presentmentMoney: { amount: "100.25", currencyCode: "USD" },
};
const header = {
  id: orderGid,
  name: "#SYNTHETIC-1",
  createdAt: "2026-10-08T01:00:00Z",
  updatedAt: "2026-10-08T02:00:00Z",
  legacyResourceId: "9007199254740993",
  note: "Fictional customization",
  tags: ["synthetic"],
  customAttributes: [],
  edited: false,
  requiresShipping: true,
  currencyCode: "INR",
  presentmentCurrencyCode: "USD",
  cancelledAt: null,
  displayFinancialStatus: "PAID",
  displayFulfillmentStatus: "UNFULFILLED",
  taxesIncluded: false,
  email: "fictional@example.invalid",
  phone: null,
  customer: null,
  shippingAddress: null,
  billingAddress: null,
  currentTotalPriceSet: bag,
  currentSubtotalPriceSet: bag,
  currentTotalTaxSet: bag,
  currentTotalDiscountsSet: bag,
  totalShippingPriceSet: bag,
  totalOutstandingSet: bag,
  originalTotalPriceSet: bag,
  currentShippingPriceSet: bag,
  currentTotalDutiesSet: null,
  originalTotalDutiesSet: null,
  currentTotalAdditionalFeesSet: null,
  originalTotalAdditionalFeesSet: null,
  totalReceivedSet: bag,
  netPaymentSet: bag,
  totalRefundedSet: bag,
  totalRefundedShippingSet: bag,
  totalTipReceivedSet: bag,
  currentTaxLines: [],
  taxLines: [],
  totalCashRoundingAdjustment: { paymentSet: bag, refundSet: bag },
};
const line = (i) => ({
  id: `gid://shopify/LineItem/${i}`,
  title: "Synthetic shirt",
  name: "Synthetic shirt / Blue",
  variantTitle: "Blue",
  sku: " SAME-SKU ",
  quantity: 1,
  currentQuantity: 1,
  isGiftCard: false,
  requiresShipping: true,
  customAttributes: [{ key: "Colour", value: "Blue" }],
  product: null,
  variant: null,
  image: null,
  priceAfterAllDiscountsBeforeTaxesSet: bag,
  originalTotalSet: bag,
  originalUnitPriceSet: bag,
  totalDiscountSet: bag,
  taxLines: [],
  discountAllocations: [],
});
const code = (expected) => (error) => error.code === expected;
function setup(options = {}) {
  const calls = [];
  let revisions = 0;
  let pages = 0;
  const transport = async (url, init) => {
    assert.equal(
      url,
      `https://${context.shopDomain}/admin/api/2026-10/graphql.json`,
    );
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.equal(
      init.headers["X-Shopify-Access-Token"],
      "synthetic-access-token",
    );
    const input = JSON.parse(init.body);
    calls.push(input);
    if (options.transport) return options.transport(input, init);
    let data;
    if (input.query.includes("OSPlusOrderRevision")) {
      revisions++;
      data = {
        shop: {
          id: context.shopGid,
          myshopifyDomain: context.shopDomain,
          ...options.shop,
        },
        order: options.missing
          ? null
          : {
              id: header.id,
              createdAt: header.createdAt,
              updatedAt: header.updatedAt,
              ...options.envelope,
              ...(revisions > 1 ? options.final : {}),
            },
      };
    } else if (input.query.includes("OSPlusOrderShipping")) {
      data = {
        order: {
          id: header.id,
          createdAt: header.createdAt,
          updatedAt: header.updatedAt,
          ...options.envelope,
          ...options.shippingEnvelope,
          shippingLines: options.shippingPage?.(input.variables) ?? {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
    } else if (input.query.includes("OSPlusCatalogueEnrichment")) {
      data = {
        nodes:
          options.catalogue?.(input.variables.ids) ??
          input.variables.ids.map(() => null),
      };
    } else {
      const index = pages++;
      const page = options.page?.(index, input.variables) ?? {
        nodes: [line(1)],
        pageInfo: { hasNextPage: false, endCursor: "c1" },
      };
      data = {
        order: {
          ...header,
          ...options.envelope,
          ...options.header,
          ...options.pageHeader?.(index),
          lineItems: page,
        },
      };
    }
    return new Response(
      JSON.stringify({
        data,
        ...options.response,
        ...(input.query.includes("OSPlusCatalogue")
          ? options.catalogueResponse
          : {}),
      }),
      {
        headers: { "X-Shopify-API-Version": options.version ?? "2026-10" },
      },
    );
  };
  const hydrate = createShopifyOrderHydrator(
    transport,
    options.now ?? (() => current),
    options.budgetMs ?? 40_000,
  );
  const run = (overrides = {}) =>
    hydrate(
      overrides.context ?? context,
      overrides.lease ?? lease,
      "synthetic-access-token",
      overrides.signal,
      overrides.env ?? env,
    );
  return { run, calls };
}

test("complete multi-page snapshot retains distinct lines, exact decimal/string IDs and source provenance", async () => {
  const { run, calls } = setup({
    page: (index) => ({
      nodes: Array.from({ length: index ? 15 : 50 }, (_, i) => ({
        ...line(1 + i + index * 50),
        tenantId: tenantB,
      })),
      pageInfo: { hasNextPage: index === 0, endCursor: `c${index}` },
    }),
  });
  const actual = await run();
  assert.equal(actual.status, "complete");
  assert.equal(actual.snapshot.lines.length, 65);
  assert.equal(actual.snapshot.order.id, orderGid);
  assert.equal(actual.snapshot.tenantId, tenantA);
  assert.equal(
    actual.snapshot.order.currentTotalPriceSet.shopMoney.amount,
    "9007199254740993.12",
  );
  assert.equal(
    actual.snapshot.order.currentTotalPriceSet.presentmentMoney.currencyCode,
    "USD",
  );
  assert.equal(actual.snapshot.lines[0].sku, " SAME-SKU ");
  assert.equal(actual.snapshot.lines[0].product, null);
  assert.equal("tenantId" in actual.snapshot.lines[0], false);
  assert.equal("leaseToken" in actual.snapshot, false);
  assert.equal(calls.length, 5);
  assert.equal(calls[2].variables.after, "c0");
});

test("catalogue-only denial/throttle errors propagate; a recoverable optional partial error warns", async () => {
  const page = () => ({
    nodes: [withCatalogue()],
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  for (const [extensions, expected] of [
    [{ code: "ACCESS_DENIED" }, "ACCESS_DENIED"],
    [{ code: "THROTTLED" }, "THROTTLED"],
    [{ code: "SHOP_INACTIVE" }, "SHOP_INACTIVE"],
  ]) {
    await assert.rejects(
      () =>
        setup({
          page,
          catalogueResponse: {
            errors: [{ message: "private optional failure", extensions }],
          },
        }).run(),
      code(expected),
    );
  }
  const result = await setup({
    page,
    catalogueResponse: { errors: [{ message: "private optional failure" }] },
  }).run();
  assert.equal(result.status, "complete");
  assert.deepEqual(result.snapshot.lines[0].warnings, [
    "CATALOGUE_UNAVAILABLE",
  ]);
});

test("unique catalogue IDs are bounded batches and linked only to the matching source product/variant", async () => {
  const count = 65;
  const { run, calls } = setup({
    page: (index) => ({
      nodes: Array.from({ length: index ? 15 : 50 }, (_, i) => {
        const id = 1 + i + index * 50;
        return {
          ...line(id),
          product: { id: `gid://shopify/Product/${id}` },
          variant: { id: `gid://shopify/ProductVariant/${id}` },
        };
      }),
      pageInfo: { hasNextPage: index === 0, endCursor: `c${index}` },
    }),
    catalogue: (ids) =>
      ids.map((id) =>
        id.includes("/Product/")
          ? { ...catalogueProduct, id }
          : {
              ...catalogueVariant,
              id,
              product: { id: id.replace("/ProductVariant/", "/Product/") },
            },
      ),
  });
  const result = await run();
  assert.equal(result.status, "complete");
  assert.equal(result.snapshot.lines.length, count);
  const batches = calls.filter((c) => c.query.includes("OSPlusCatalogue"));
  assert.equal(batches.length, 3);
  for (const batch of batches) assert.ok(batch.variables.ids.length <= 50);
  for (const source of result.snapshot.lines) {
    assert.equal(source.catalogue.product.id, source.product.id);
    assert.equal(source.catalogue.variant.id, source.variant.id);
  }
});

test("shipping overflow and over-limit line tax/discount arrays return a minimized incomplete review", async () => {
  let pageIndex = 0;
  const result = await setup({
    shippingPage: () => ({
      nodes: [
        {
          id: `gid://shopify/ShippingLine/${++pageIndex}`,
          title: "Synthetic",
          code: null,
          source: null,
          deliveryCategory: null,
          isRemoved: false,
          originalPriceSet: bag,
          discountedPriceSet: bag,
          currentDiscountedPriceSet: bag,
          taxLines: [],
          discountAllocations: [],
        },
      ],
      pageInfo: { hasNextPage: true, endCursor: `s${pageIndex}` },
    }),
  }).run();
  assert.equal(result.status, "review");
  assert.equal(result.reason, "SHIPPING_LINE_LIMIT");
  assert.doesNotMatch(
    JSON.stringify(result),
    /shopMoney|shippingLines|fictional@example/,
  );
  for (const field of ["taxLines", "discountAllocations"]) {
    const candidate = {
      ...line(1),
      [field]: Array.from({ length: 101 }, () => ({})),
    };
    const result = await setup({
      page: () => ({
        nodes: [candidate],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    }).run();
    assert.equal(result.reason, "SOURCE_DETAIL_LIMIT");
  }
});

test("pre-cutoff source is skipped using createdAt before contact/money/line queries", async () => {
  const { run, calls } = setup({
    envelope: { createdAt: "2026-10-07T23:59:59Z" },
  });
  const result = await run();
  assert.equal(result.status, "ineligible");
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].query, /customer|email|lineItems|TotalPrice/);
  assert.doesNotMatch(
    JSON.stringify(result),
    /fictional@example|shopMoney|lines/,
  );
});

test("sub-millisecond cutoff compares exact source instant, not rounded JS milliseconds", async () => {
  const { run, calls } = setup({
    envelope: { createdAt: "2026-10-08T00:00:00.000000Z" },
  });
  const result = await run({
    context: {
      ...context,
      importCreatedAtCutoff: "2026-10-08T00:00:00.000001Z",
    },
  });
  assert.equal(result.status, "ineligible");
  assert.equal(calls.length, 1);
});

test("cutoff equality is eligible; cancelled/null customer/catalogue source is preserved, never invented", async () => {
  const { run } = setup({
    envelope: { createdAt: context.importCreatedAtCutoff },
    header: { cancelledAt: "2026-10-08T02:00:00Z" },
  });
  const result = await run();
  assert.equal(result.status, "complete");
  assert.equal(result.snapshot.order.customer, null);
  assert.equal(result.snapshot.order.cancelledAt, "2026-10-08T02:00:00Z");
  assert.equal(result.snapshot.lines[0].variant, null);
});

test("source changed on page or final revision causes bounded retry error, never partial complete", async () => {
  for (const options of [
    { pageHeader: () => ({ updatedAt: "2026-10-08T02:00:01Z" }) },
    { final: { updatedAt: "2026-10-08T02:00:01Z" } },
  ]) {
    const { run, calls } = setup(options);
    await assert.rejects(() => run(), code("SOURCE_CHANGED"));
    assert.ok(calls.length <= 4);
  }
});

test("wrong stable shop/domain/order or vanished source fails closed", async () => {
  for (const [options, expected] of [
    [{ shop: { id: "gid://shopify/Shop/102" } }, "ACCESS_DENIED"],
    [{ shop: { myshopifyDomain: "foreign.myshopify.com" } }, "ACCESS_DENIED"],
    [{ envelope: { id: "gid://shopify/Order/999" } }, "RESPONSE_INVALID"],
    [{ missing: true }, "SOURCE_UNAVAILABLE"],
  ]) {
    await assert.rejects(() => setup(options).run(), code(expected));
  }
});

test("unverified permissions, stale/foreign lease, inactive tenant and nonproduction config never fetch", async () => {
  const { run, calls } = setup();
  for (const patch of [
    { status: "paused" },
    { tenantStatus: "suspended" },
    { processingEnabled: false },
    { intakeEnabled: false },
    { requiredScopesVerified: false },
    { protectedCustomerFieldsVerified: false },
    { environment: "development" },
  ]) {
    await assert.rejects(
      () => run({ context: { ...context, ...patch } }),
      code("ACCESS_DENIED"),
    );
  }
  for (const patch of [
    { tenantId: tenantB },
    { connectionId: lease.jobId },
    { connectionRevision: 1 },
    { generation: Number.MAX_SAFE_INTEGER + 1 },
    { leaseExpiresAt: "2026-10-08T11:59:00Z" },
  ]) {
    await assert.rejects(
      () => run({ lease: { ...lease, ...patch } }),
      code("ACCESS_DENIED"),
    );
  }
  for (const patch of [
    { VERCEL_ENV: "preview" },
    { VERCEL_ENV: undefined },
    { SHOPIFY_HYDRATION_ENABLED: "false" },
    { SHOPIFY_SYNC_ENABLED: "false" },
    { SHOPIFY_API_VERSION: "2026-07" },
  ]) {
    await assert.rejects(
      () => run({ env: { ...env, ...patch } }),
      code("CONFIGURATION_INVALID"),
    );
  }
  assert.equal(calls.length, 0);
});

test("duplicate lines, missing/repeated cursor and empty nonterminal page are rejected", async () => {
  for (const page of [
    () => ({
      nodes: [line(1), line(1)],
      pageInfo: { hasNextPage: false, endCursor: "x" },
    }),
    () => ({
      nodes: [line(1)],
      pageInfo: { hasNextPage: true, endCursor: null },
    }),
    (index) => ({
      nodes: [line(index + 1)],
      pageInfo: { hasNextPage: true, endCursor: "repeated" },
    }),
    () => ({ nodes: [], pageInfo: { hasNextPage: true, endCursor: "x" } }),
  ]) {
    await assert.rejects(() => setup({ page }).run(), code("RESPONSE_INVALID"));
  }
});

test("exactly500 lines complete; additional/too-many-small pages return minimized review, no truncation", async () => {
  for (const [count, terminal, expected] of [
    [50, true, "complete"],
    [50, false, "review"],
    [1, false, "review"],
  ]) {
    const { run, calls } = setup({
      page: (index) => ({
        nodes: Array.from({ length: count }, (_, i) =>
          line(1 + index * count + i),
        ),
        pageInfo: {
          hasNextPage: terminal ? index < 9 : true,
          endCursor: `c${index}`,
        },
      }),
    });
    const result = await run();
    assert.equal(result.status, expected);
    assert.ok(calls.length <= 13);
    if (expected === "complete")
      assert.equal(result.snapshot.lines.length, 500);
    else {
      assert.equal(result.reason, "LINE_LIMIT");
      assert.equal(result.completeness, "partial");
      assert.doesNotMatch(
        JSON.stringify(result),
        /fictional@example|shopMoney|lines/,
      );
    }
  }
});

test("oversized attributes/unsupported quantity produce review with source envelope only", async () => {
  for (const [patch, expected] of [
    [
      {
        customAttributes: Array.from({ length: 101 }, () => ({
          key: "k",
          value: "v",
        })),
      },
      "ATTRIBUTE_LIMIT",
    ],
    [
      { customAttributes: [{ key: "k", value: "x".repeat(2001) }] },
      "ATTRIBUTE_LIMIT",
    ],
    [{ quantity: 0, currentQuantity: 0 }, "QUANTITY_NOT_POSITIVE"],
  ]) {
    const result = await setup({
      page: () => ({
        nodes: [{ ...line(1), ...patch }],
        pageInfo: { hasNextPage: false, endCursor: "x" },
      }),
    }).run();
    assert.equal(result.status, "review");
    assert.equal(result.reason, expected);
    assert.equal(result.completeness, "partial");
    assert.doesNotMatch(
      JSON.stringify(result),
      /fictional@example|shopMoney|lines/,
    );
  }
});

test("unsafe/malformed optional images warn without blocking; allowed CDN reference never fetched", async () => {
  for (const url of [
    "http://cdn.shopify.com/image.jpg",
    "https://evil.example/image.jpg",
    "https://cdn.shopify.com@evil.example/x",
    "https://cdn.shopify.com:444/x",
    "not-url",
    "https://cdn.shopify.com/x.jpg",
  ]) {
    const { run, calls } = setup({
      page: () => ({
        nodes: [
          {
            ...line(1),
            image: { id: "gid://shopify/ProductImage/1", url, altText: null },
          },
        ],
        pageInfo: { hasNextPage: false, endCursor: "x" },
      }),
    });
    const result = await run();
    assert.equal(result.status, "complete");
    const image = result.snapshot.lines[0].image;
    assert.equal(
      image?.url ?? null,
      url === "https://cdn.shopify.com/x.jpg" ? url : null,
    );
    assert.equal(result.snapshot.lines[0].warnings.length, image ? 0 : 1);
    assert.equal(calls.length, 4);
  }
});

const catalogueProduct = {
  __typename: "Product",
  id: "gid://shopify/Product/11",
  title: "Current catalogue label",
  description: "Plain text current description",
  productType: "Shirts",
  tags: ["private-classification"],
  updatedAt: "2026-10-08T03:00:00Z",
  featuredMedia: {
    preview: {
      image: {
        id: null,
        url: "https://cdn.shopify.com/product.jpg",
        altText: null,
      },
    },
  },
};
const catalogueVariant = {
  __typename: "ProductVariant",
  id: "gid://shopify/ProductVariant/12",
  title: "Current Blue / M",
  sku: "RENAMED-SKU",
  updatedAt: "2026-10-08T03:00:00Z",
  product: { id: catalogueProduct.id },
  selectedOptions: [
    { name: "Colour", value: "Blue" },
    { name: "Size", value: "M" },
  ],
  image: null,
};
const withCatalogue = () => ({
  ...line(1),
  product: { id: catalogueProduct.id },
  variant: { id: catalogueVariant.id },
});

test("private source detail and current catalogue enrichment retain distinct provenance without replacing order-time values", async () => {
  const { run, calls } = setup({
    page: () => ({
      nodes: [withCatalogue()],
      pageInfo: { hasNextPage: false, endCursor: null },
    }),
    catalogue: (ids) =>
      ids.map((id) =>
        id === catalogueProduct.id ? catalogueProduct : catalogueVariant,
      ),
  });
  const { snapshot } = await run();
  assert.equal(snapshot.order.note, "Fictional customization");
  assert.deepEqual(snapshot.order.tags, ["synthetic"]);
  assert.equal(snapshot.order.legacyResourceId, "9007199254740993");
  assert.equal(snapshot.lines[0].title, "Synthetic shirt");
  assert.equal(snapshot.lines[0].sku, " SAME-SKU ");
  assert.equal(snapshot.lines[0].catalogue.provenance, "current_catalogue");
  assert.equal(
    snapshot.lines[0].catalogue.variant.selectedOptions[1].value,
    "M",
  );
  assert.equal(
    snapshot.lines[0].catalogue.product.description,
    "Plain text current description",
  );
  assert.equal(
    snapshot.lines[0].catalogue.product.image.url,
    "https://cdn.shopify.com/product.jpg",
  );
  assert.equal(
    calls.filter((c) => c.query.includes("OSPlusCatalogue")).length,
    1,
  );
  assert.doesNotMatch(
    calls[2].query,
    /descriptionHtml|metafields|customerAcceptsMarketing/,
  );
});

test("optional catalogue missing/malformed/partial results warn; required permission/auth/version failures still fail closed", async () => {
  for (const candidate of [
    null,
    { ...catalogueProduct, id: "gid://shopify/Product/999" },
    { ...catalogueProduct, description: "x".repeat(10001) },
  ]) {
    const { snapshot } = await setup({
      page: () => ({
        nodes: [withCatalogue()],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
      catalogue: () => [candidate, null],
    }).run();
    assert.equal(snapshot.lines[0].catalogue.product, null);
    assert.ok(snapshot.lines[0].warnings.length);
    assert.equal(snapshot.lines[0].title, "Synthetic shirt");
  }
  const base = setup({
    page: () => ({
      nodes: [withCatalogue()],
      pageInfo: { hasNextPage: false, endCursor: null },
    }),
  });
  // Use the real shared client, changing only the enrichment response.
  const transport = async (_url, init) => {
    const input = JSON.parse(init.body);
    let data;
    if (input.query.includes("OSPlusOrderRevision"))
      data = {
        shop: { id: context.shopGid, myshopifyDomain: context.shopDomain },
        order: {
          id: header.id,
          createdAt: header.createdAt,
          updatedAt: header.updatedAt,
        },
      };
    else if (input.query.includes("OSPlusOrderShipping"))
      data = {
        order: {
          id: header.id,
          createdAt: header.createdAt,
          updatedAt: header.updatedAt,
          shippingLines: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
    else if (input.query.includes("OSPlusCatalogue"))
      return new Response(
        JSON.stringify({ errors: [{ message: "private upstream message" }] }),
        { headers: { "X-Shopify-API-Version": "2026-10" } },
      );
    else
      data = {
        order: {
          ...header,
          lineItems: {
            nodes: [withCatalogue()],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      };
    return new Response(JSON.stringify({ data }), {
      headers: { "X-Shopify-API-Version": "2026-10" },
    });
  };
  const result = await createShopifyOrderHydrator(transport, () => current)(
    context,
    lease,
    "synthetic-access-token",
    undefined,
    env,
  );
  assert.equal(result.status, "complete");
  assert.deepEqual(result.snapshot.lines[0].warnings, [
    "CATALOGUE_UNAVAILABLE",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /private upstream message/);
  assert.equal(base.calls.length, 0);
});

test("shipping connection paginates independently and checks order revision/cursors", async () => {
  const shipping = (i) => ({
    id: `gid://shopify/ShippingLine/${i}`,
    title: "Synthetic delivery",
    code: null,
    source: null,
    deliveryCategory: "shipping",
    isRemoved: false,
    originalPriceSet: bag,
    discountedPriceSet: bag,
    currentDiscountedPriceSet: bag,
    taxLines: [],
    discountAllocations: [],
  });
  const { run, calls } = setup({
    shippingPage: ({ after }) => ({
      nodes: [shipping(after ? 2 : 1)],
      pageInfo: { hasNextPage: !after, endCursor: after ? "s2" : "s1" },
    }),
  });
  const { snapshot } = await run();
  assert.equal(snapshot.shippingLines.length, 2);
  assert.equal(
    calls.filter((c) => c.query.includes("OSPlusOrderShipping"))[1].variables
      .after,
    "s1",
  );
  await assert.rejects(
    () =>
      setup({ shippingEnvelope: { updatedAt: "2026-10-08T04:00:00Z" } }).run(),
    code("SOURCE_CHANGED"),
  );
  await assert.rejects(
    () =>
      setup({
        shippingPage: () => ({
          nodes: [shipping(1)],
          pageInfo: { hasNextPage: true, endCursor: "s" },
        }),
      }).run(),
    code("RESPONSE_INVALID"),
  );
});

test("over-limit order source details are minimized review rather than silently truncated", async () => {
  for (const patch of [
    { note: "x".repeat(10001) },
    { tags: Array.from({ length: 101 }, () => "x") },
    { customAttributes: [{ key: "x", value: "y".repeat(2001) }] },
    {
      currentTaxLines: Array.from({ length: 101 }, () => ({
        title: "Tax",
        rate: 0.1,
        channelLiable: null,
        priceSet: bag,
      })),
    },
  ]) {
    const result = await setup({ header: patch }).run();
    assert.equal(result.status, "review");
    assert.equal(result.reason, "SOURCE_DETAIL_LIMIT");
    assert.doesNotMatch(
      JSON.stringify(result),
      /Fictional|shopMoney|catalogue|shippingLines/,
    );
  }
});

test("GraphQL field denial/partial error and version fallback never masquerade as a guest snapshot", async () => {
  for (const [options, expected] of [
    [
      {
        response: {
          errors: [
            {
              message: "private customer/token",
              extensions: { code: "ACCESS_DENIED" },
            },
          ],
        },
      },
      "ACCESS_DENIED",
    ],
    [
      { response: { errors: [{ message: "private customer/token" }] } },
      "GRAPHQL_INCOMPLETE",
    ],
    [{ version: "2026-07" }, "API_VERSION_MISMATCH"],
  ]) {
    await assert.rejects(
      () => setup(options).run(),
      (error) => {
        assert.equal(error.code, expected);
        assert.doesNotMatch(String(error), /private customer/);
        return true;
      },
    );
  }
});

test("total/caller/lease deadline bounds stalled transport; no retries or incomplete success", async () => {
  const { run, calls } = setup({
    transport: async () => new Promise(() => {}),
    budgetMs: 10,
  });
  await assert.rejects(() => run(), code("UPSTREAM_UNAVAILABLE"));
  assert.equal(calls.length, 1);
  const abort = new AbortController();
  abort.abort();
  const cancelled = setup();
  await assert.rejects(
    () => cancelled.run({ signal: abort.signal }),
    code("UPSTREAM_UNAVAILABLE"),
  );
  assert.equal(cancelled.calls.length, 0);
  const expired = setup({ now: () => current + 121_000 });
  await assert.rejects(() => expired.run(), code("ACCESS_DENIED"));
  assert.equal(expired.calls.length, 0);
});

test("malformed decimal/numeric source ID and inconsistent quantity fail validation without coercion", async () => {
  for (const patch of [
    { id: 123 },
    { currentQuantity: 2 },
    { quantity: 1.5 },
    {
      priceAfterAllDiscountsBeforeTaxesSet: {
        ...bag,
        shopMoney: { amount: "1e5", currencyCode: "INR" },
      },
    },
  ]) {
    await assert.rejects(
      () =>
        setup({
          page: () => ({
            nodes: [{ ...line(1), ...patch }],
            pageInfo: { hasNextPage: false, endCursor: "x" },
          }),
        }).run(),
      code("RESPONSE_INVALID"),
    );
  }
});

test("total budget spans all pages and prevents late complete/review/skipped outcomes", async () => {
  for (const nodes of [[line(1)], []]) {
    let clock = current;
    const fixture = setup({
      now: () => clock,
      page: () => {
        clock += 40_001;
        return { nodes, pageInfo: { hasNextPage: false, endCursor: "x" } };
      },
    });
    await assert.rejects(() => fixture.run(), code("UPSTREAM_UNAVAILABLE"));
    assert.equal(fixture.calls.length, 2);
  }
});
