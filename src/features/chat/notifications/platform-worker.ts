import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { encryptChatSecret, decryptChatSecret } from "../secrets.ts";
import type {
  NotificationDependencies,
  NotificationContext,
} from "./worker.ts";
export async function runPlatformAlert(
  tenantId: string,
  deps: NotificationDependencies,
  chatId: string,
) {
  if (
    process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
    process.env.CHAT_NOTIFICATIONS_ENABLED !== "true" ||
    process.env.CHAT_PLATFORM_ALERTS_ENABLED !== "true" ||
    process.env.CHAT_DRY_RUN !== "false"
  )
    return { status: "none" };
  z.string().uuid().parse(tenantId);
  z.string()
    .regex(/^-?[1-9][0-9]{0,15}$/)
    .parse(chatId);
  const id = randomUUID(),
    context: NotificationContext = {
      tenantId,
      actor: { type: "SYSTEM", id: "chat-notifications" },
      source: "AUTOMATION",
      correlationId: randomUUID(),
    };
  const raw = await deps.run(context, "claim", {
    id,
    recipientEnc: encryptChatSecret(chatId, {
      tenantId,
      workspaceId: id,
      purpose: "platform_notification_recipient",
    }),
  });
  if (
    z
      .object({ status: z.literal("none") })
      .strict()
      .safeParse(raw).success
  )
    return { status: "none" };
  const claim = z
    .object({
      status: z.literal("claimed"),
      id: z.string().uuid(),
      token: z.string().uuid(),
      recipientEnc: z.string().max(12000),
    })
    .strict()
    .parse(raw);
  const identity = { id: claim.id, token: claim.token };
  try {
    const recipient = decryptChatSecret(claim.recipientEnc, {
      tenantId,
      workspaceId: claim.id,
      purpose: "platform_notification_recipient",
    });
    if (
      recipient !== chatId ||
      process.env.CHAT_PLATFORM_ALERTS_ENABLED !== "true"
    )
      throw new Error("Operator destination changed.");
    const receipt = await deps.send({
      chatId: recipient,
      text: "OS PLUS notification processing needs attention. Review protected platform health and delivery status. Unconfirmed deliveries are held for review.",
    });
    z.object({ messageId: z.number().int().positive().safe() })
      .strict()
      .parse(receipt);
    await deps.run(context, "record", {
      ...identity,
      messageId: receipt.messageId,
    });
    return { status: "sent" };
  } catch {
    try {
      await deps.run(context, "uncertain", identity);
    } catch {
      /* Persisted sending is also held, never a retry. */
    }
    return { status: "held" };
  }
}
