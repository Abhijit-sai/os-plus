import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

const contextSchema = z
  .object({
    tenantId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    // The historical workspaceId AAD slot is the target UUID for notification purposes.
    purpose: z.enum([
      "account_token",
      "bot_token",
      "notification_recipient",
      "notification_link",
      "platform_notification_recipient",
    ]),
  })
  .strict();
export type ChatSecretContext = z.infer<typeof contextSchema>;

function aad(context: ChatSecretContext, version: string): Buffer {
  const valid = contextSchema.parse(context);
  return Buffer.from(
    JSON.stringify([
      "osplus-chat",
      version,
      valid.tenantId,
      valid.workspaceId,
      valid.purpose,
    ]),
  );
}
function keyFor(version: string): Buffer {
  if (!/^v[1-9][0-9]{0,5}$/.test(version)) throw new Error("Invalid version");
  // Read on every call so rotation and emergency revocation do not require a restart.
  const keys: unknown = JSON.parse(process.env.CHAT_SECRETS_KEYS ?? "{}");
  const encoded = z.record(z.string(), z.string()).parse(keys)[version];
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
    throw new Error("Invalid key");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Invalid key");
  return key;
}
export function encryptChatSecret(
  plaintext: string,
  context: ChatSecretContext,
): string {
  try {
    z.string().min(1).max(8192).parse(plaintext);
    const version = process.env.CHAT_SECRETS_ACTIVE_VERSION ?? "";
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", keyFor(version), nonce);
    cipher.setAAD(aad(context, version));
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return [
      "gcm1",
      version,
      nonce.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  } catch {
    // Never attach the original error: it can contain supplied secrets or key configuration.
    throw new Error("Chat secret unavailable.");
  }
}
export function decryptChatSecret(
  envelope: string,
  context: ChatSecretContext,
): string {
  try {
    if (envelope.length > 12000) throw new Error("Invalid envelope");
    const parts = envelope.split(".");
    if (
      parts.length !== 5 ||
      parts[0] !== "gcm1" ||
      parts.slice(2).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    )
      throw new Error("Invalid envelope");
    const [, version, nonceText, tagText, encryptedText] = parts;
    const nonce = Buffer.from(nonceText, "base64url"),
      tag = Buffer.from(tagText, "base64url");
    if (nonce.length !== 12 || tag.length !== 16)
      throw new Error("Invalid envelope");
    const decipher = createDecipheriv("aes-256-gcm", keyFor(version), nonce);
    decipher.setAAD(aad(context, version));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Chat secret unavailable.");
  }
}
