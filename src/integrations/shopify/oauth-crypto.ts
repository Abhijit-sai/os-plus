import "server-only";
import { z } from "zod";
import { sealShopifySource, openShopifySource } from "./source-crypto.ts";
import { canonicalShopDomain } from "./config.ts";
import { shopifyOAuthTokenSchema, type ShopifyOAuthToken } from "./oauth.ts";
import { ShopifyIntegrationError } from "./errors.ts";

export type ShopifyCredentialBinding = { tenantId: string; shopDomain: string; appRef: string };
function aad(binding: ShopifyCredentialBinding) {
  if (!z.string().uuid().safeParse(binding.tenantId).success ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(binding.appRef) ||
    canonicalShopDomain(binding.shopDomain) !== binding.shopDomain)
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  return JSON.stringify(["osplus-shopify-offline-token-v1", binding.tenantId, binding.shopDomain, binding.appRef]);
}
function keys(env: NodeJS.ProcessEnv) {
  // Reuse the audited AES-GCM implementation, NOT the raw-payload key ring.
  // Payload expiry and credential retention/key rotation are independent.
  return { NODE_ENV: env.NODE_ENV, SHOPIFY_SOURCE_KEY_ID: env.SHOPIFY_CREDENTIAL_KEY_ID,
    SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON: env.SHOPIFY_CREDENTIAL_ENCRYPTION_KEYS_JSON };
}
export function sealShopifyCredential(token: ShopifyOAuthToken, binding: ShopifyCredentialBinding, env: NodeJS.ProcessEnv) {
  const parsed = shopifyOAuthTokenSchema.safeParse(token);
  if (!parsed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  return sealShopifySource(JSON.stringify(parsed.data), aad(binding), keys(env));
}
export function openShopifyCredential(packet: unknown, binding: ShopifyCredentialBinding, env: NodeJS.ProcessEnv): ShopifyOAuthToken {
  if (JSON.stringify(packet)?.length > 32768) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const plaintext = openShopifySource(packet, aad(binding), keys(env));
  try { return shopifyOAuthTokenSchema.parse(JSON.parse(plaintext)); }
  catch { throw new ShopifyIntegrationError("RESPONSE_INVALID"); }
}
