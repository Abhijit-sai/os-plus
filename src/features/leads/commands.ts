import "server-only";
import { z } from "zod";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "../chat/module";
import { commandKeySchema } from "../chat/schemas";
import {
  prepareLeadCommand,
  refreshInputSchema,
  refreshResultSchema,
} from "./schemas";

export async function runLeadCommand(input: unknown, commandKey: string) {
  const request = prepareLeadCommand(input),
    key = commandKeySchema.parse(commandKey);
  const { context, db } = await requireChatPermission("leads:manage");
  const result = await db.rpc("chat_lead_command", {
    p_context: {
      ...createUserCommandContext(context, { idempotencyKey: key }),
    },
    p_action: request.action,
    p_input: request.input,
  });
  if (result.error)
    throw new Error(
      "The change could not be saved. Reload this record and try again.",
    );
  return z
    .object({
      id: z.string().uuid().optional(),
      version: z.number().int().positive().optional(),
      contactId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      mergeId: z.string().uuid().optional(),
    })
    .strict()
    .parse(result.data);
}

/** CH-4 page-view hook; current managers/owners can refresh an explicitly scoped record. */
export async function refreshLeadOnView(leadId: string) {
  const input = refreshInputSchema.parse({ leadId });
  const { context, db } = await requireChatPermission("leads:manage");
  const result = await db.rpc("chat_lead_refresh", {
    p_context: { ...createUserCommandContext(context) },
    p_input: input,
  });
  if (result.error) throw new Error("Lead status could not be refreshed.");
  return refreshResultSchema.parse(result.data);
}
