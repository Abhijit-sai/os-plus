import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { canonicalShopDomain } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

type Binding = { connectionId: string; tenantId: string; shopDomain: string; appRef: string };

function sign(binding: Binding, secret: string) {
  if (!secret || secret.length > 4096 || /[\s\x00-\x1f\x7f]/.test(secret))
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return createHmac("sha256", secret).update("osplus:shopify:orders-route:v1\0")
    .update(JSON.stringify([z.string().uuid().parse(binding.connectionId), z.string().uuid().parse(binding.tenantId),
      canonicalShopDomain(binding.shopDomain), binding.appRef])).digest("base64url");
}

export function shopifyOrdersWebhookUrl(origin: string, binding?: Binding, secret = "") {
  const url = new URL("/api/integrations/shopify/orders-webhook", origin);
  if (binding) url.searchParams.set("binding", sign(binding, secret));
  return url.toString();
}

export function matchesShopifyWebhookBinding(url: string, binding: Binding, secret: string) {
  const keys = new URL(url).searchParams.getAll("binding");
  if (keys.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(keys[0])) return false;
  return timingSafeEqual(Buffer.from(keys[0]), Buffer.from(sign(binding, secret)));
}
