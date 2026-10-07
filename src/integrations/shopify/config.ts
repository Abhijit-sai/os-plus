import "server-only";

import { ShopifyIntegrationError } from "./errors.ts";

// Explicitly pinned; never silently fall forward to Shopify's `latest`.
export const SHOPIFY_API_VERSION = "2026-10";

export function canonicalShopDomain(input: string): string {
  const domain = input.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(domain)) {
    throw new ShopifyIntegrationError("SHOP_DOMAIN_INVALID");
  }
  return domain;
}
