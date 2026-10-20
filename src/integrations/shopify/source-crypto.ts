import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { ShopifyIntegrationError } from "./errors.ts";

const id = /^[A-Za-z0-9_-]{1,64}$/;
const packetSchema = z.object({ version: z.literal(1), keyId: z.string().regex(id),
  iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/), tag: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  ciphertext: z.string().min(1).max(12_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();

function keys(env: NodeJS.ProcessEnv) {
  const active = env.SHOPIFY_SOURCE_KEY_ID;
  let raw: unknown;
  try { raw = env.SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON ? JSON.parse(env.SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON) :
    { [active ?? ""]: env.SHOPIFY_SOURCE_ENCRYPTION_KEY }; }
  catch { throw new ShopifyIntegrationError("CONFIGURATION_INVALID"); }
  if (!active || !id.test(active) || !raw || typeof raw !== "object" || Array.isArray(raw))
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  const entries = Object.entries(raw);
  if (entries.length < 1 || entries.length > 10) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  const ring = new Map<string, Buffer>();
  for (const [version, encoded] of entries) {
    if (!id.test(version) || typeof encoded !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
      throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.length !== 32 || decoded.toString("base64") !== encoded)
      throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
    ring.set(version, decoded);
  }
  if (!ring.has(active)) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return { active, ring };
}
export function sealShopifySource(plaintext: string, aad: string, env: NodeJS.ProcessEnv) {
  if (Buffer.byteLength(plaintext, "utf8") > 8_000_000) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const { active, ring } = keys(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ring.get(active)!, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { version: 1 as const, keyId: active, iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}
export function openShopifySource(packet: unknown, aad: string, env: NodeJS.ProcessEnv) {
  const parsed = packetSchema.safeParse(packet);
  if (!parsed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const { ring } = keys(env);
  const key = ring.get(parsed.data.keyId);
  if (!key) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.data.iv, "base64"));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(parsed.data.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(parsed.data.ciphertext, "base64")), decipher.final()]).toString("utf8");
  } catch { throw new ShopifyIntegrationError("RESPONSE_INVALID"); }
}
