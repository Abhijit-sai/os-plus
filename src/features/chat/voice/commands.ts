import "server-only";
import { z } from "zod";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "../module";
import { commandKeySchema } from "../schemas";
import { voiceSettingsSchema } from "./schemas";
export const voiceEnabled = () => process.env.CHAT_VOICE_ENABLED === "true";
export async function getVoiceSettings() {
  if (!voiceEnabled()) return null;
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const result = await db.rpc("chat_voice_settings", {
    p_context: { ...createUserCommandContext(context) },
    p_input: {},
  });
  if (result.error) throw new Error("Voice settings unavailable.");
  return {
    ...voiceSettingsSchema.parse(result.data),
    tenantId: context.tenant.id,
  };
}
export async function configureVoice(
  raw: unknown,
  key: string,
  expectedTenantId: string,
) {
  if (!voiceEnabled()) throw new Error("Voice settings unavailable.");
  const input = voiceSettingsSchema.parse(raw),
    { context, db } = await requireChatPermission("chat_settings:manage");
  if (z.string().uuid().parse(expectedTenantId) !== context.tenant.id)
    throw new Error(
      "Reload the selected business before changing voice settings.",
    );
  const result = await db.rpc("chat_voice_settings", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_input: input,
  });
  if (result.error) throw new Error("Voice settings not confirmed.");
  return voiceSettingsSchema.parse(result.data);
}
