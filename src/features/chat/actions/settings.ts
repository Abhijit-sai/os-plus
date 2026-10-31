import "server-only";
import { z } from "zod";
import { requireChatPermission } from "../module";
import { createUserCommandContext } from "@/core/command-context/server";
import { commandKeySchema } from "../schemas";
import { chatActionsEnabled } from "./commands";
import { capabilitySchema } from "./rules";
const id = z.string().uuid(),
  version = z.number().int().nonnegative().safe();
export const settingsInputSchema = z
  .object({
    channelId: id,
    version,
    mode: z.enum(["off", "draft", "auto"]),
    canBook: z.boolean(),
    packId: id.nullable(),
    approveAuto: z.boolean(),
    locationId: id.nullable(),
    teamId: id.nullable(),
  })
  .strict();
export const settingsReadSchema = z
  .object({
    channels: z
      .array(
        z
          .object({
            id,
            name: z.string().max(160),
            kind: z.enum(["whatsapp", "instagram", "facebook", "website"]),
            mode: z.enum(["off", "draft", "auto"]),
            canBook: z.boolean(),
            version,
            packId: id.nullable(),
            packVersion: version.positive().nullable(),
            bookingCapability: capabilitySchema.nullable(),
            autoApproved: z.boolean(),
          })
          .strict(),
      )
      .max(1000),
    branches: z
      .array(
        z
          .object({
            channelId: id,
            id,
            name: z.string().max(200),
            teamId: id.nullable(),
          })
          .strict(),
      )
      .max(10000),
    teams: z
      .array(z.object({ id, name: z.string().max(200) }).strict())
      .max(1000),
  })
  .strict();
export async function getChatActionSettings() {
  if (!chatActionsEnabled()) return null;
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const result = await db.rpc("chat_action_settings_read", {
    p_context: { ...createUserCommandContext(context) },
  });
  if (result.error) throw new Error("Channel controls unavailable.");
  return {
    ...settingsReadSchema.parse(result.data),
    publicDeliveryEnabled: process.env.CHAT_PUBLIC_REPLY_ENABLED === "true",
  };
}
export async function configureChatActions(raw: unknown, key: string) {
  if (!chatActionsEnabled()) throw new Error("Channel controls unavailable.");
  const input = settingsInputSchema.parse(raw),
    { context, db } = await requireChatPermission("chat_settings:manage");
  const result = await db.rpc("chat_action_configure", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_input: input,
  });
  if (result.error) throw new Error("Channel controls not saved.");
  return z
    .object({ id, version: version.positive() })
    .strict()
    .parse(result.data);
}
export type ChatActionSettings = NonNullable<
  Awaited<ReturnType<typeof getChatActionSettings>>
>;
