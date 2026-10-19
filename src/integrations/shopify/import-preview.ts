import "server-only";
import { z } from "zod";
import { getShopifyApplicationConfig } from "./application-config.ts";
import { createShopifyTokenProvider } from "./client-credentials.ts";
import { readShopifyApplicationGraphQL } from "./client.ts";
import { buildShopifyImportWindow, normalizeShopifyReference } from "./import-plan.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";

const gid = (kind: string) => z.string().regex(new RegExp(`^gid://shopify/${kind}/[1-9][0-9]{0,31}$`));
const time = z.string().datetime({ offset: true });
const shopSchema = z.object({ id: gid("Shop"), myshopifyDomain: z.string() });
const scopeSchema = z.object({ shop: shopSchema,
  currentAppInstallation: z.object({ accessScopes: z.array(z.object({ handle: z.string() })).max(512) }) });
const ordersSchema = z.object({ shop: shopSchema, orders: z.object({
  nodes: z.array(z.object({ id: gid("Order"), name: z.string().max(256), createdAt: time, updatedAt: time,
    cancelledAt: time.nullable(), displayFinancialStatus: z.string().max(64).nullable(),
    currentTotalPriceSet: z.object({ shopMoney: z.object({ amount: z.string().regex(/^\d{1,20}(\.\d{1,6})?$/),
      currencyCode: z.string().regex(/^[A-Z]{3}$/) }) }),
  })).max(100),
  pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().min(1).max(2048).nullable() }),
}) });

const query = `query OSPlusImportOrders($search: String!, $after: String) {
  shop { id myshopifyDomain }
  orders(first: 100, after: $after, query: $search, sortKey: CREATED_AT, reverse: false) {
    nodes { id name createdAt updatedAt cancelledAt displayFinancialStatus currentTotalPriceSet { shopMoney { amount currencyCode } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

// Read-only source preview. No customer payload, arbitrary queries, callbacks,
// tenant IDs or tokens come from the browser. The caller supplies shopGid from
// its freshly verified DB connection. Never queue an incomplete preview.
export function createShopifyImportPreviewReader(transport: typeof fetch = fetch, now = Date.now, maxPages = 20) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  const tokens = createShopifyTokenProvider(transport, now);
  return async (actor: ShopifyProbeActor, expectedShopGid: string, range: unknown, signal: AbortSignal,
    env: NodeJS.ProcessEnv = process.env) => {
    signal.throwIfAborted();
    const config = getShopifyApplicationConfig(actor, env);
    gid("Shop").parse(expectedShopGid);
    const observedAt = now();
    // Validate structure/calendar before any request. History permission is
    // evaluated only against the actual installation scopes below.
    buildShopifyImportWindow(range, observedAt, true);
    const accessToken = await tokens.getToken(config);
    signal.throwIfAborted();
    const request = { shopDomain: config.shopDomain, connectionEnvironment: "production" as const, accessToken, signal };
    const metadata = await readShopifyApplicationGraphQL({ ...request,
      query: "query OSPlusImportScope { shop { id myshopifyDomain } currentAppInstallation { accessScopes { handle } } }",
      schema: scopeSchema }, actor, transport, env);
    const assertShop = (shop: z.infer<typeof shopSchema>) => {
      if (shop.id !== expectedShopGid || shop.myshopifyDomain !== config.shopDomain) throw new ShopifyIntegrationError("ACCESS_DENIED");
    };
    assertShop(metadata.data.shop);
    const scopes = new Set(metadata.data.currentAppInstallation.accessScopes.map(scope => scope.handle));
    if (!scopes.has("read_orders") && !scopes.has("write_orders")) throw new ShopifyIntegrationError("ACCESS_DENIED");
    const window = buildShopifyImportWindow(range, observedAt, scopes.has("read_all_orders"));
    const search = `created_at:>='${window.start}' created_at:<'${window.endExclusive}'`;
    const rows: Array<{ orderGid: string; reference: string; createdAt: string; updatedAt: string;
      cancelledAt: string | null; financialStatus: string | null; amount: string; currency: string }> = [];
    const ids = new Set<string>(), cursors = new Set<string>();
    let after: string | null = null, previousCreated = -Infinity;
    for (let index = 0; index < maxPages; index++) {
      signal.throwIfAborted();
      const result: { data: z.infer<typeof ordersSchema> } = await readShopifyApplicationGraphQL({ ...request, query, variables: { search, after }, schema: ordersSchema }, actor, transport, env);
      assertShop(result.data.shop);
      const { nodes, pageInfo } = result.data.orders;
      for (const order of nodes) {
        const created = Date.parse(order.createdAt);
        if (ids.has(order.id) || created < Date.parse(window.start) || created >= Date.parse(window.endExclusive) ||
            created < previousCreated || Date.parse(order.updatedAt) < created)
          throw new ShopifyIntegrationError("RESPONSE_INVALID");
        // Blank references remain visible as conflicts; malformed controls are
        // not accepted as an apparently usable matching key.
        normalizeShopifyReference(order.name);
        ids.add(order.id); previousCreated = created;
        rows.push({ orderGid: order.id, reference: order.name, createdAt: order.createdAt, updatedAt: order.updatedAt,
          cancelledAt: order.cancelledAt, financialStatus: order.displayFinancialStatus,
          amount: order.currentTotalPriceSet.shopMoney.amount, currency: order.currentTotalPriceSet.shopMoney.currencyCode });
      }
      if (!pageInfo.hasNextPage) return { window, observedAt: new Date(observedAt).toISOString(), rows, complete: true as const, reason: null };
      if (!nodes.length || !pageInfo.endCursor || cursors.has(pageInfo.endCursor)) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      after = pageInfo.endCursor; cursors.add(after);
    }
    return { window, observedAt: new Date(observedAt).toISOString(), rows, complete: false as const, reason: "NARROW_DATE_RANGE" as const };
  };
}
