import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decryptChatSecret } from "../secrets.ts";
import {
  formatDailySummary,
  formatInstantAlert,
  notificationEventSchema,
} from "./summary.ts";
export type NotificationContext = {
  tenantId: string;
  actor: { type: "SYSTEM"; id: "chat-notifications" };
  source: "AUTOMATION";
  correlationId: string;
};
export type NotificationDependencies = {
  run(
    context: NotificationContext,
    action: string,
    input: Record<string, string | number | boolean | null>,
  ): Promise<unknown>;
  send(input: { chatId: string; text: string }): Promise<{ messageId: number }>;
};
const claimSchema = z
  .object({
    status: z.literal("claimed"),
    id: z.string().uuid(),
    token: z.string().uuid(),
    targetId: z.string().uuid(),
    recipientEnc: z.string().max(12000),
    kind: notificationEventSchema,
    payload: z.unknown(),
  })
  .strict();
const recipientSchema = z
  .object({
    chatId: z.string().regex(/^-?[1-9][0-9]{0,15}$/),
    senderId: z.string().regex(/^[1-9][0-9]{0,15}$/),
  })
  .strict();
export async function runNotificationBatch(
  tenantId: string,
  deps: NotificationDependencies,
  appOrigin: string,
) {
  z.string().uuid().parse(tenantId);
  const result = { sent: 0, held: 0, cancelled: 0 };
  if (
    process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
    process.env.CHAT_NOTIFICATIONS_ENABLED !== "true" ||
    process.env.CHAT_DRY_RUN !== "false"
  )
    return result;
  const context: NotificationContext = {
    tenantId,
    actor: { type: "SYSTEM", id: "chat-notifications" },
    source: "AUTOMATION",
    correlationId: randomUUID(),
  };
  await deps.run(context, "prepare", {});
  for (let i = 0; i < 5; i++) {
    if (
      process.env.CHAT_NOTIFICATIONS_ENABLED !== "true" ||
      process.env.CHAT_DRY_RUN !== "false"
    )
      break;
    const raw = await deps.run(context, "claim", {});
    if (z.object({ status: z.literal("none") }).safeParse(raw).success) break;
    const claim = claimSchema.parse(raw),
      identity = { id: claim.id, token: claim.token };
    try {
      const recipient = recipientSchema.parse(
        JSON.parse(
          decryptChatSecret(claim.recipientEnc, {
            tenantId,
            workspaceId: claim.targetId,
            purpose: "notification_recipient",
          }),
        ),
      );
      const text =
        claim.kind === "daily_summary"
          ? formatDailySummary(claim.payload, appOrigin)
          : formatInstantAlert(claim.payload, appOrigin);
      const authorized = z
        .object({ allowed: z.boolean() })
        .strict()
        .parse(await deps.run(context, "authorize", identity));
      if (!authorized.allowed) {
        result.cancelled++;
        continue;
      }
      const receipt = await deps.send({ chatId: recipient.chatId, text });
      z.object({ messageId: z.number().int().positive().safe() })
        .strict()
        .parse(receipt);
      await deps.run(context, "record", {
        ...identity,
        messageId: receipt.messageId,
      });
      result.sent++;
    } catch {
      // If the receipt write itself is lost, the row stays sent/held; never send again.
      try {
        await deps.run(context, "uncertain", identity);
      } catch {
        /* Persisted sending is also a no-retry state. */
      }
      result.held++;
    }
  }
  return result;
}
