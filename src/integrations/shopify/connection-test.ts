import "server-only";

import { z } from "zod";
import { SHOPIFY_API_VERSION } from "./config.ts";
import { getShopifyProbeConfig, type ShopifyProbeActor } from "./probe-config.ts";
import { createShopifyTokenProvider } from "./client-credentials.ts";
import { readShopifyProbeGraphQL } from "./client.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const query = `query OSPlusConnectionProbe {
  shop { id myshopifyDomain }
  currentAppInstallation { accessScopes { handle } }
}`;
const schema = z.object({
  shop: z.object({ id: z.string().regex(/^gid:\/\/shopify\/Shop\/\d+$/), myshopifyDomain: z.string() }),
  currentAppInstallation: z.object({ accessScopes: z.array(z.object({ handle: z.string().max(128) })).max(512) }),
});

export function createShopifyConnectionTester(transport: typeof fetch = fetch, now = Date.now) {
  const tokens = createShopifyTokenProvider(transport, now);
  return async function testConnection(actor: ShopifyProbeActor, env: NodeJS.ProcessEnv = process.env) {
    const config = getShopifyProbeConfig(actor, env);
    try {
      const accessToken = await tokens.getToken(config);
      const result = await readShopifyProbeGraphQL({
        shopDomain: config.shopDomain, connectionEnvironment: "production", accessToken, query, schema,
      }, actor, transport, env);
      if (result.data.shop.myshopifyDomain !== config.shopDomain) throw new ShopifyIntegrationError("ACCESS_DENIED");
      const granted = new Set(result.data.currentAppInstallation.accessScopes.map(scope => scope.handle));
      const required = ["orders", "customers", "products"];
      if (required.some(scope => !granted.has(`read_${scope}`) && !granted.has(`write_${scope}`))) {
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      }
      return {
        status: "verified" as const, tenantId: config.tenantId, shopDomain: config.shopDomain,
        apiVersion: SHOPIFY_API_VERSION, verifiedAt: new Date(now()).toISOString(),
        requiredScopesVerified: true, importsEnabled: false, messagingEnabled: false,
        protectedCustomerFieldsVerified: false,
      };
    } catch (error) {
      if (error instanceof ShopifyIntegrationError && error.code === "AUTHENTICATION_REQUIRED") tokens.invalidate();
      throw error;
    }
  };
}
