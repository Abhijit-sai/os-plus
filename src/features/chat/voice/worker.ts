import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { chatwootOrigin } from "../connection";
import { decryptChatSecret } from "../secrets";
import { ChatwootAttachmentClient } from "@/integrations/chatwoot/attachment-client";
import { ChatwootTranscriptClient } from "@/integrations/chatwoot/transcript-client";
import { prepareVoiceTurn } from "./worker-core";
import type { CapturedAgentJob } from "../agent/worker";
import type { Json } from "@/types/database";
export async function prepareCapturedVoice(
  job: CapturedAgentJob,
  capability: { runId: string; leaseToken: string },
  data: unknown,
) {
  const db = createSupabaseServiceRoleClient(),
    w = job.workspace;
  const context = {
    tenantId: w.tenantId,
    actor: { type: "WEBHOOK", id: "chatwoot" },
    source: "WEBHOOK",
    correlationId: randomUUID(),
  };
  const input = {
    workspaceId: w.id,
    secretHash: w.secretHash,
    channelId: job.channel.id,
    conversationId: job.conversationId,
    triggerMessageId: job.triggerMessageId,
  };
  const found = await db
    .from("chat_workspaces")
    .select("*")
    .eq("tenant_id", w.tenantId)
    .eq("id", w.id)
    .eq("status", "active")
    .single();
  const workspace = found.data;
  if (
    found.error ||
    !workspace ||
    workspace.chatwoot_base_url !== chatwootOrigin() ||
    Number(workspace.chatwoot_account_id) !== w.accountId ||
    !workspace.bot_token_enc ||
    !workspace.api_token_enc
  )
    throw new Error("Voice connection unavailable.");
  const options = {
    origin: workspace.chatwoot_base_url,
    token: decryptChatSecret(workspace.api_token_enc, {
      tenantId: w.tenantId,
      workspaceId: w.id,
      purpose: "account_token",
    }),
    allowLocalMock: true,
  };
  const attachment = new ChatwootAttachmentClient({
    ...options,
    mediaOrigins: z
      .array(z.string().url())
      .min(1)
      .max(5)
      .parse(JSON.parse(process.env.CHAT_VOICE_MEDIA_ORIGINS ?? "[]")),
  });
  const note = new ChatwootTranscriptClient({
    ...options,
    token: decryptChatSecret(workspace.bot_token_enc, {
      tenantId: w.tenantId,
      workspaceId: w.id,
      purpose: "bot_token",
    }),
  });
  const scope = { tenantId: w.tenantId, ...input };
  const { secretHash: _secret, ...safeScope } = scope;
  return prepareVoiceTurn(
    { scope: safeScope, data, capability },
    {
      async run(action, extra) {
        const result = await db.rpc("chat_voice_command", {
          p_context: context,
          p_action: action,
          p_input: { ...input, ...z.record(z.unknown()).parse(extra) } as Json,
        });
        if (result.error) throw new Error("Voice storage unavailable.");
        return result.data;
      },
      async load() {
        const result = await db.rpc(
          process.env.CHAT_ACTIONS_ENABLED === "true"
            ? "chat_action_agent_load"
            : "chat_agent_load",
          { p_context: context, p_input: input },
        );
        if (result.error) throw new Error("Voice context unavailable.");
        return result.data;
      },
      download: (raw) => attachment.download(raw),
      post: (raw, check) => note.post(raw, check),
    },
  );
}
