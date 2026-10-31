import "server-only";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { accountClient, chatwootOrigin } from "../connection";
import type { Json } from "@/types/database";
export async function deliverHandoffLabel(
  context: Json,
  input: Record<string, string>,
  workspace: { tenantId: string; id?: string; accountId?: number },
) {
  try {
    if (
      process.env.CHAT_ACTIONS_ENABLED !== "true" ||
      process.env.CHAT_DRY_RUN !== "false" ||
      process.env.CHAT_AGENT_MODEL_MODE !== "mock" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(chatwootOrigin()).hostname,
      )
    )
      return;
    const db = createSupabaseServiceRoleClient();
    const call = async (action: string) => {
      const r = await db.rpc("chat_handoff_label", {
        p_context: context,
        p_action: action,
        p_input: input,
      });
      if (r.error) throw new Error("Label receipt unavailable");
      return r.data;
    };
    const claim = z
      .object({
        status: z.string(),
        workspaceId: z.string().uuid().optional(),
        accountId: z.number().int().positive().safe().optional(),
        conversationId: z.number().int().positive().safe().optional(),
        label: z.string().optional(),
      })
      .strict()
      .parse(await call("claim"));
    if (claim.status !== "claimed") return;
    try {
      const row = await db
        .from("chat_workspaces")
        .select("*")
        .eq("tenant_id", workspace.tenantId)
        .eq("id", claim.workspaceId ?? workspace.id ?? "")
        .eq("status", "active")
        .single();
      if (
        row.error ||
        !claim.accountId ||
        (workspace.accountId !== undefined &&
          claim.accountId !== workspace.accountId) ||
        (workspace.id !== undefined && claim.workspaceId !== workspace.id) ||
        row.data.chatwoot_account_id !== claim.accountId ||
        !claim.conversationId ||
        !claim.label
      )
        throw new Error("Label target unavailable");
      await accountClient(row.data).mergeConversationLabel(
        claim.accountId,
        claim.conversationId,
        claim.label,
      );
      await call("record");
    } catch {
      try {
        await call("uncertain");
      } catch {
        /* Durable claim is held. */
      }
    }
  } catch {
    /* Committed handoff remains visible even when label transport is unavailable. */
  }
}
