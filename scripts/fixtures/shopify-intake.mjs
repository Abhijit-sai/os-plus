import { createHmac, randomUUID } from "node:crypto";

// Synthetic only: no production IDs, customer exports or working credentials.
export const tenantA = "10000000-0000-4000-8000-000000000001";
export const tenantB = "10000000-0000-4000-8000-000000000002";
export const connectionA = {
  id: "20000000-0000-4000-8000-000000000001", tenant_id: tenantA,
  shop_gid: "gid://shopify/Shop/101", canonical_domain: "synthetic-intake.myshopify.com",
  app_ref: "synthetic-app", environment: "production", api_version: "2026-10",
  status: "verified", intake_enabled: true, verified_at: "2026-10-08T00:00:00.000Z", revision: 1,
};
export const intakeEnv = {
  SHOPIFY_INTAKE_ENABLED: "true", VERCEL_ENV: "production", SHOPIFY_DEPLOYMENT_ENV: "production",
  SHOPIFY_API_VERSION: "2026-10", SHOPIFY_CLIENT_ID: connectionA.app_ref,
  SHOPIFY_CLIENT_SECRET: "synthetic-not-a-real-secret", SHOPIFY_SYNC_ENABLED: "false",
};
export const orderGid = "gid://shopify/Order/9007199254740993";
export const deliveryRequest = (payload = { admin_graphql_api_id: orderGid }, overrides = {}) => {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const headers = {
    "content-type": "application/json", "x-shopify-shop-domain": connectionA.canonical_domain,
    "x-shopify-hmac-sha256": createHmac("sha256", intakeEnv.SHOPIFY_CLIENT_SECRET).update(body).digest("base64"),
    "x-shopify-topic": "orders/create", "x-shopify-webhook-id": randomUUID(),
    "x-shopify-api-version": "2026-10", ...overrides.headers,
  };
  return new Request("https://synthetic-osplus.example/api/integrations/shopify/webhooks", {
    method: "POST", body, ...overrides, headers,
  });
};
