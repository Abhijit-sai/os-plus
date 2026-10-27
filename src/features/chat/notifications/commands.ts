import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import type { Json } from "@/types/database";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "../module";
import { commandKeySchema } from "../schemas";
import { encryptChatSecret, decryptChatSecret } from "../secrets";
import {
  notificationCommandSchema,
  notificationReadSchema,
  notificationReceiptSchema,
  previewInputSchema,
} from "./schemas";
import { summarySchema, formatDailySummary } from "./summary";
import { notificationsEnabled } from "./flags";
function enabled() {
  if (!notificationsEnabled())
    throw new Error("Notification settings unavailable.");
}
export async function getNotificationSettings() {
  if (!notificationsEnabled()) return null;
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const result = await db.rpc("chat_notification_read", {
    p_context: { ...createUserCommandContext(context) },
  });
  if (result.error)
    throw new Error("Notification settings could not be loaded.");
  return {
    ...notificationReadSchema.parse(result.data),
    tenantId: context.tenant.id,
    previewEnd: new Date().toISOString(),
    deliveryEnabled:
      process.env.CHAT_DRY_RUN === "false" &&
      (process.env.CHAT_TELEGRAM_MOCK_ENABLED === "true" ||
        process.env.CHAT_TELEGRAM_LIVE_ENABLED === "true"),
  };
}
export async function configureNotification(
  raw: unknown,
  key: string,
  expectedTenantId: string,
) {
  enabled();
  const request = notificationCommandSchema.parse(raw);
  const { context, db } = await requireChatPermission("chat_settings:manage");
  if (z.string().uuid().parse(expectedTenantId) !== context.tenant.id)
    throw new Error(
      "Reload the selected business before changing notifications.",
    );
  let input: Json = request.input;
  if (request.action === "issue") {
    const code = randomBytes(32).toString("base64url");
    input = {
      ...request.input,
      codeHash: createHash("sha256").update(code).digest("hex"),
      codeEnc: encryptChatSecret(code, {
        tenantId: context.tenant.id,
        workspaceId: request.input.id,
        purpose: "notification_link",
      }),
    };
  }
  const result = await db.rpc("chat_notification_command", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_action: request.action,
    p_input: input,
  });
  if (result.error) throw new Error("Notification change not confirmed.");
  if (request.action === "issue") {
    const receipt = notificationReceiptSchema
      .extend({
        codeEnc: z.string().max(12000),
        expiresAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .parse(result.data);
    // Only this authorized one-time issuance returns a short-lived code. Ordinary DTOs never return it.
    const code = z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .parse(
        decryptChatSecret(receipt.codeEnc, {
          tenantId: context.tenant.id,
          workspaceId: receipt.id,
          purpose: "notification_link",
        }),
      );
    return {
      id: receipt.id,
      version: receipt.version,
      code,
      expiresAt: receipt.expiresAt,
    };
  }
  return {
    ...notificationReceiptSchema.parse(result.data),
    code: null,
    expiresAt: null,
  };
}
export async function previewNotificationSummary(
  raw: unknown,
  expectedTenantId: string,
) {
  enabled();
  const input = previewInputSchema.parse(raw),
    { context, db } = await requireChatPermission("chat_reports:view");
  if (z.string().uuid().parse(expectedTenantId) !== context.tenant.id)
    throw new Error(
      "Reload the selected business before previewing notifications.",
    );
  const result = await db.rpc("chat_notification_preview", {
    p_context: { ...createUserCommandContext(context) },
    p_input: input,
  });
  if (result.error) throw new Error("Report preview unavailable.");
  const summary = summarySchema.parse(result.data);
  return {
    summary,
    text: formatDailySummary(summary, process.env.CHAT_APP_ORIGIN ?? ""),
  };
}
