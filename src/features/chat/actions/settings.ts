import "server-only";
import { z } from "zod";
import { requireChatPermission } from "../module";
import { createUserCommandContext } from "@/core/command-context/server";
import { commandKeySchema } from "../schemas";
import { chatActionsEnabled } from "./commands";
import { capabilitySchema } from "./rules";
import { chatwootOrigin } from "../connection";
import { readScopedDraftChannel, selectAgentRuntime } from "../agent/runtime-config";

function scopedReplyChannel(tenantId: string) {
  if (process.env.CHAT_AGENT_MODEL_MODE !== "live-scoped") return null;
  try {
    const scope = readScopedDraftChannel(process.env);
    return scope.tenantId === tenantId ? scope.channelId : null;
  } catch {
    return null;
  }
}

function automaticDelivery(tenantId: string) {
  try {
    const origin = chatwootOrigin();
    const runtime = selectAgentRuntime(process.env, origin);
    if (process.env.CHAT_DRY_RUN !== "false") return { all: false, channel: null };
    if (runtime?.kind === "mock")
      return { all: process.env.CHAT_PUBLIC_REPLY_ENABLED === "true", channel: null };
    if (runtime?.kind === "live" &&
        runtime.channelScope?.tenantId === tenantId &&
        process.env.CHAT_DRAFT_DELIVERY_ENABLED === "true" &&
        new URL(origin).protocol === "https:")
      return { all: false, channel: runtime.channelScope.channelId };
  } catch {
    // Missing or invalid installation configuration cannot activate automatic delivery.
  }
  return { all: false, channel: null };
}
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
  const allActions = chatActionsEnabled();
  if (!allActions && process.env.CHAT_AGENT_MODEL_MODE !== "live-scoped") return null;
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const scopedChannel = scopedReplyChannel(context.tenant.id);
  if (!allActions && !scopedChannel) return null;
  const result = await db.rpc("chat_action_settings_read", {
    p_context: { ...createUserCommandContext(context) },
  });
  if (result.error) throw new Error("Channel controls unavailable.");
  const settings = settingsReadSchema.parse(result.data);
  const automatic = automaticDelivery(context.tenant.id);
  return {
    ...settings,
    branches: allActions ? settings.branches : [],
    teams: allActions ? settings.teams : [],
    channels: settings.channels.filter((channel) => allActions || channel.id === scopedChannel).map((channel) => ({
      ...channel,
      automaticAvailable: automatic.all || (
        automatic.channel === channel.id && channel.kind === "whatsapp" && !channel.canBook
      ),
    })),
  };
}
export async function configureChatActions(raw: unknown, key: string) {
  const input = settingsInputSchema.parse(raw),
    { context, db } = await requireChatPermission("chat_settings:manage");
  if (!chatActionsEnabled() && (scopedReplyChannel(context.tenant.id) !== input.channelId ||
      input.canBook || input.locationId !== null || input.teamId !== null))
    throw new Error("Channel controls unavailable.");
  if (input.mode === "auto") {
    const automatic = automaticDelivery(context.tenant.id);
    if (!automatic.all && (automatic.channel !== input.channelId || input.canBook))
      throw new Error("Automatic replies are unavailable for this inbox.");
  }
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
