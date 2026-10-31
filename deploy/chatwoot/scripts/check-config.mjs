import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const freshHex = z.string().regex(/^(?:[a-f0-9]{64}|[a-f0-9]{128})$/, "Generate 32-64 bytes of fresh hex.");
const host = z.string().regex(/^chat\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Use a chat subdomain without a scheme or path.");
const image = z.string().min(1).refine(
  (value) => /:[a-zA-Z0-9][a-zA-Z0-9_.-]*$|@sha256:[a-f0-9]{64}$/.test(value) && !/:(latest|stable|beta)(?:-ce)?$/.test(value),
  "Use an explicit version or digest; floating latest/stable/beta is forbidden.",
);
const optionalText = z.string().default("");
export const deploymentSchema = z.object({
  CHAT_HOST: host,
  ACME_EMAIL: z.string().email(),
  CHATWOOT_IMAGE: image,
  N8N_IMAGE: image,
  CHATWOOT_POSTGRES_IMAGE: image,
  N8N_POSTGRES_IMAGE: image,
  REDIS_IMAGE: image,
  CADDY_IMAGE: image,
  BACKUP_IMAGE: image,
  CW_SECRET_KEY_BASE: freshHex,
  CW_ENCRYPTION_PRIMARY_KEY: freshHex,
  CW_ENCRYPTION_DETERMINISTIC_KEY: freshHex,
  CW_ENCRYPTION_SALT: freshHex,
  CW_DB_PASSWORD: freshHex,
  CW_REDIS_PASSWORD: freshHex,
  N8N_DB_ADMIN_PASSWORD: freshHex,
  N8N_DB_PASSWORD: freshHex,
  N8N_ENCRYPTION_KEY: freshHex,
  SCHEDULER_TIMEZONE: z.string().refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
    catch { return false; }
  }, "Use an IANA timezone."),
  FB_APP_ID: optionalText,
  FB_APP_SECRET: optionalText,
  FB_VERIFY_TOKEN: optionalText,
  IG_VERIFY_TOKEN: optionalText,
  MAILER_SENDER_EMAIL: optionalText,
  SMTP_ADDRESS: optionalText,
  SMTP_PORT: z.string().regex(/^[0-9]+$/).refine((value) => Number(value) > 0 && Number(value) <= 65535, "Invalid SMTP port."),
  SMTP_USERNAME: optionalText,
  SMTP_PASSWORD: optionalText,
}).strict().superRefine((config, ctx) => {
  const secretFields = [
    "CW_SECRET_KEY_BASE", "CW_ENCRYPTION_PRIMARY_KEY", "CW_ENCRYPTION_DETERMINISTIC_KEY",
    "CW_ENCRYPTION_SALT", "CW_DB_PASSWORD", "CW_REDIS_PASSWORD",
    "N8N_DB_ADMIN_PASSWORD", "N8N_DB_PASSWORD", "N8N_ENCRYPTION_KEY",
  ];
  const used = new Set();
  for (const field of secretFields) {
    if (used.has(config[field])) ctx.addIssue({ code: "custom", path: [field], message: "Every deployment secret must be independently generated." });
    used.add(config[field]);
  }
  if (Boolean(config.FB_APP_ID) !== Boolean(config.FB_APP_SECRET)) {
    ctx.addIssue({ code: "custom", path: ["FB_APP_ID"], message: "Configure both Meta app id and secret, or leave both blank for local preparation." });
  }
});

export function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match || Object.hasOwn(result, match[1])) throw new Error("Invalid or duplicate environment assignment.");
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

export function validateDeployment(input, { allowExampleHost = false } = {}) {
  const config = deploymentSchema.parse(input);
  if (!allowExampleHost && (config.CHAT_HOST.endsWith(".invalid") || config.ACME_EMAIL.endsWith(".invalid"))) {
    throw new Error("Replace example hostname and operations email before deployment.");
  }
  return config;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const envPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(kit, ".env");
    const mode = fs.statSync(envPath).mode;
    if (process.platform !== "win32" && (mode & 0o077) !== 0) throw new Error("Deployment environment permissions must be 600.");
    validateDeployment(parseEnv(fs.readFileSync(envPath, "utf8")));
    process.stdout.write("Deployment configuration passed; values are never printed.\n");
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) process.stderr.write(`${issue.path.join(".")}: ${issue.message}\n`);
    } else {
      process.stderr.write(error instanceof Error ? `${error.message}\n` : "Configuration check failed.\n");
    }
    process.exitCode = 1;
  }
}
