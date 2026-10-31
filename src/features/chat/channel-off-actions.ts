"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireChatPermission } from "./module";
import { commandKeySchema } from "./schemas";
import { createUserCommandContext } from "@/core/command-context/server";
import type { ChatActionResult } from "./actions";

const requestSchema = z
  .object({
    channelId: z.string().uuid(),
    version: z.number().int().nonnegative().safe(),
  })
  .strict();

/** Pausing cannot depend on enabling the capabilities being paused. */
export async function setChannelStaffOnlyAction(
  raw: unknown,
  key: string,
  expectedTenantId: string,
): Promise<ChatActionResult> {
  try {
    const input = requestSchema.parse(raw);
    const tenantId = z.string().uuid().parse(expectedTenantId);
    const commandKey = commandKeySchema.parse(key);
    const { context, db } = await requireChatPermission("chat_settings:manage");
    if (context.tenant.id !== tenantId) throw new Error("Business changed.");
    const result = await db.rpc("chat_action_configure", {
      p_context: {
        ...createUserCommandContext(context, { idempotencyKey: commandKey }),
      },
      p_input: {
        ...input,
        mode: "off",
        canBook: false,
        packId: null,
        approveAuto: false,
        locationId: null,
        teamId: null,
      },
    });
    if (result.error) throw new Error("Reply mode was not saved.");
    z.object({
      id: z.string().uuid(),
      version: z.number().int().positive().safe(),
    })
      .strict()
      .parse(result.data);
    revalidatePath("/settings/chat");
    return {
      ok: true,
      message:
        "Replies are staff-operated. Automatic suggestions and replies are off.",
    };
  } catch {
    return {
      ok: false,
      message: "Reply mode was not saved. Reload this business and try again.",
    };
  }
}
