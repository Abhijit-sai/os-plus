import "server-only";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { chatwootOrigin } from "../connection";
import { decryptChatSecret } from "../secrets";
import { ChatwootPublicClient } from "@/integrations/chatwoot/public-client";
import type { CaptureWorkspace } from "../ingress";
import type { Json } from "@/types/database";
export async function tryPublicReply(options: {
  context: Json;
  input: Record<string, string>;
  workspace: CaptureWorkspace;
  runId: string;
  leaseToken: string;
}): Promise<{ status: string }> {
  if (
    process.env.CHAT_ACTIONS_ENABLED !== "true" ||
    process.env.CHAT_PUBLIC_REPLY_ENABLED !== "true" ||
    process.env.CHAT_DRY_RUN !== "false"
  )
    return { status: "private" };
  const db = createSupabaseServiceRoleClient(),
    cap = {
      ...options.input,
      runId: options.runId,
      leaseToken: options.leaseToken,
    };
  const call = async (action: string, extra: Record<string, Json> = {}) => {
    const value = await db.rpc("chat_public_reply", {
      p_context: options.context,
      p_action: action,
      p_input: { ...cap, ...extra },
    });
    if (value.error) throw new Error("Public receipt unavailable.");
    return value.data;
  };
  const claim = z
    .object({
      status: z.string(),
      id: z.string().uuid().optional(),
      replyText: z.string().min(1).max(6000).optional(),
    })
    .strict()
    .parse(await call("claim"));
  if (claim.status !== "claimed") return { status: claim.status };
  let providerId: number | undefined;
  try {
    if (!claim.id || !claim.replyText) throw new Error("Missing public claim");
    const origin = chatwootOrigin();
    const row = await db
      .from("chat_workspaces")
      .select("*")
      .eq("tenant_id", options.workspace.tenantId)
      .eq("id", options.workspace.id)
      .eq("status", "active")
      .maybeSingle();
    if (
      row.error ||
      !row.data ||
      row.data.chatwoot_base_url !== origin ||
      !row.data.bot_token_enc
    )
      throw new Error("Public transport unavailable");
    const token = decryptChatSecret(row.data.bot_token_enc, {
      tenantId: options.workspace.tenantId,
      workspaceId: options.workspace.id,
      purpose: "bot_token",
    });
    // Recheck public-specific owner approval after all other awaited preparation.
    const target = z
      .object({
        accountId: z.number().int().positive().safe(),
        conversationId: z.number().int().positive().safe(),
        triggerProviderId: z.number().int().positive().safe(),
        knowledgeVersion: z.number().int().positive(),
      })
      .strict()
      .parse(await call("target"));
    if (row.data.chatwoot_account_id !== target.accountId)
      throw new Error("Public target changed");
    providerId = (
      await new ChatwootPublicClient({ origin, token }).post({
        accountId: target.accountId,
        conversationId: target.conversationId,
        outboxId: claim.id,
        text: claim.replyText,
      })
    ).id;
    try {
      await call("record", { providerMessageId: providerId });
    } catch {
      await call("record", { providerMessageId: providerId });
    }
    return { status: "sent" };
  } catch {
    try {
      await call(
        "uncertain",
        providerId ? { providerMessageId: providerId } : {},
      );
    } catch {
      /* Durable sending claim remains held; never resend automatically. */
    }
    return { status: "uncertain" };
  }
}
