"use server";
import { z } from "zod";
import { requireChatPermission } from "../module";
import { createUserCommandContext } from "@/core/command-context/server";
import { staffDraftInputSchema } from "./staff-draft-schema";
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
