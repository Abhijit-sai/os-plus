"use server";
import { z } from "zod";
import { requireChatPermission } from "../module";
import { createUserCommandContext } from "@/core/command-context/server";
import { staffDraftInputSchema } from "./staff-draft-schema";
import { readScopedDraftChannel } from "./runtime-config";
export async function staffDraftAction(
  actionInput: unknown,
  raw: unknown,
): Promise<{ status: "claimed" | "sent" | "uncertain" | "blocked" }> {
  if (process.env.CHAT_STAFF_DRAFT_SEND_ENABLED !== "true")
    return { status: "blocked" };
  try {
    const action = z.enum(["claim", "record"]).parse(actionInput),
      input = staffDraftInputSchema.parse(raw);
    const { context, db } = await requireChatPermission("leads:manage");
    if (process.env.CHAT_AGENT_MODEL_MODE === "live-scoped" || process.env.CHAT_LIVE_DRAFT_CHANNEL_SCOPE) {
      const scope = readScopedDraftChannel(process.env);
      if (scope.tenantId !== context.tenant.id || scope.accountId !== input.accountId)
        return { status: "blocked" };
      const run = await db
        .from("chat_agent_runs")
        .select("id")
        .eq("tenant_id", scope.tenantId)
        .eq("channel_id", scope.channelId)
        .eq("id", input.draftId)
        .maybeSingle();
      if (run.error || !run.data) return { status: "blocked" };
    }
    const result = await db.rpc("chat_staff_draft_command", {
      p_context: { ...createUserCommandContext(context) },
      p_action: action,
      p_input: input,
    });
    if (result.error) return { status: "blocked" };
    return z
      .object({ status: z.enum(["claimed", "sent", "uncertain"]) })
      .strict()
      .parse(result.data);
  } catch {
    return { status: "blocked" };
  }
}
