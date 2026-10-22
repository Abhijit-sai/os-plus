import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { chatwootOrigin } from "../connection";
import { decryptChatSecret } from "../secrets";
import { createMockModel } from "./mock-model";
import { runStoredMockTurn } from "./worker-core";
import { ChatwootMessageClient } from "@/integrations/chatwoot/message-client";
import type { CaptureWorkspace, CaptureChannel } from "../ingress";
import type { Json } from "@/types/database";
export type CapturedAgentJob = {
  workspace: CaptureWorkspace;
  channel: CaptureChannel;
  conversationId: string;
  triggerMessageId: string;
};

/** D042: live models remain disabled. Only an explicitly enabled loopback mock can run. */
export async function processCapturedAgent(job: CapturedAgentJob) {
  if (process.env.CHAT_AGENT_ENABLED !== "true") return;
  try {
    const origin = chatwootOrigin(),
      url = new URL(origin);
    if (
      process.env.CHAT_AGENT_MODEL_MODE !== "mock" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      return;
    const db = createSupabaseServiceRoleClient(),
      w = job.workspace;
    const context = {
      tenantId: w.tenantId,
      actor: { type: "WEBHOOK", id: "chatwoot" },
      source: "WEBHOOK",
      correlationId: randomUUID(),
    };
    const scope = {
      tenantId: w.tenantId,
      workspaceId: w.id,
      channelId: job.channel.id,
      conversationId: job.conversationId,
      triggerMessageId: job.triggerMessageId,
    };
    const input = {
      workspaceId: w.id,
      secretHash: w.secretHash,
      channelId: job.channel.id,
      conversationId: job.conversationId,
      triggerMessageId: job.triggerMessageId,
    };
    const call = async (
      name:
        | "chat_agent_load"
        | "chat_agent_run"
        | "chat_agent_dry_run"
        | "chat_agent_target",
      body: Json,
      action?: string,
    ) => {
      const args = { p_context: context as Json, p_input: body };
      const response =
        name === "chat_agent_run"
          ? await db.rpc(name, { ...args, p_action: action! })
          : await db.rpc(name, args);
      if (response.error) throw new Error("Agent storage unavailable.");
      return response.data;
    };
    const data = await call("chat_agent_load", input);
    const pack = z
      .object({ pack: z.object({ body: z.unknown() }).passthrough() })
      .passthrough()
      .parse(data).pack.body;
    const model = createMockModel("information", pack);
    await runStoredMockTurn(
      {
        scope,
        now: new Date().toISOString(),
        dryRun: process.env.CHAT_DRY_RUN !== "false",
        deliver: process.env.CHAT_DRAFT_DELIVERY_ENABLED === "true",
      },
      {
        load: () => call("chat_agent_load", input),
        run: (action, extra) =>
          call(
            "chat_agent_run",
            { ...input, ...z.record(z.unknown()).parse(extra) } as Json,
            action,
          ),
        dryRun: (result) =>
          call("chat_agent_dry_run", {
            ...input,
            ...(result ? { result } : {}),
          } as Json),
      },
      model,
      async (draft) => {
        if (process.env.CHAT_AGENT_ENABLED !== "true")
          throw new Error("Agent disabled.");
        const target = z
          .object({
            accountId: z.number().int().positive().safe(),
            conversationId: z.number().int().positive().safe(),
            triggerProviderId: z.number().int().positive().safe(),
            knowledgeVersion: z.number().int().positive(),
          })
          .strict()
          .parse(
            await call("chat_agent_target", {
              ...input,
              runId: draft.runId,
              leaseToken: draft.leaseToken,
            }),
          );
        const workspace = await db
          .from("chat_workspaces")
          .select("*")
          .eq("tenant_id", w.tenantId)
          .eq("id", w.id)
          .eq("status", "active")
          .maybeSingle();
        if (
          workspace.error ||
          !workspace.data ||
          workspace.data.chatwoot_base_url !== origin ||
          Number(workspace.data.chatwoot_account_id) !== target.accountId ||
          !workspace.data.bot_token_enc
        )
          throw new Error("Draft transport unavailable.");
        const token = decryptChatSecret(workspace.data.bot_token_enc, {
          tenantId: w.tenantId,
          workspaceId: w.id,
          purpose: "bot_token",
        });
        return new ChatwootMessageClient({ origin, token }).postPrivateDraft({
          draftId: draft.draftId,
          text: draft.text,
          ...target,
        });
      },
    );
  } catch {
    // Preserve claims for recovery. Error details, URLs and credentials must never reach logs/customer text.
    console.warn("Chat agent processing unavailable.");
  }
}
