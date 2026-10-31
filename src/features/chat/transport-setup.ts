import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  accountClient,
  platformClient,
  assertChatLiveAccess,
} from "./connection";
import { encryptChatSecret } from "./secrets";
import { validWebhookSecret } from "./ingress";
import { provisionChatwootTransport } from "@/integrations/chatwoot/onboarding";
import type { Json } from "@/types/database";

/** Platform-only setup entry; no browser action exposes credentials or permits tenant self-provisioning. */
export async function setupChatwootTransport(input: unknown) {
  const actor = await requireSuperAdmin();
  const request = z
    .object({
      tenantId: z.string().uuid(),
      webhookSecret: z.string().min(32).max(512),
    })
    .strict()
    .parse(input);
  if (process.env.CHAT_FOUNDATION_ENABLED !== "true")
    throw new Error("Chat setup unavailable.");
  assertChatLiveAccess();
  const db = createSupabaseServiceRoleClient();
  const { data: w, error } = await db
    .from("chat_workspaces")
    .select("*")
    .eq("tenant_id", request.tenantId)
    .maybeSingle();
  if (
    error ||
    !w ||
    !w.chatwoot_account_id ||
    !validWebhookSecret(request.webhookSecret, w.webhook_secret_hash)
  )
    throw new Error("Chat workspace unavailable.");
  const origin = new URL(process.env.CHAT_WEBHOOK_ORIGIN ?? "");
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Chat webhook origin unavailable.");
  const prefix =
    origin.origin + "/api/chat/webhooks/chatwoot/" + w.workspace_key;
  const eventsUrl =
      prefix + "/events?token=" + encodeURIComponent(request.webhookSecret),
    agentUrl =
      prefix + "/agent?token=" + encodeURIComponent(request.webhookSecret);
  const { data: channels, error: channelError } = await db
    .from("chat_channels")
    .select("chatwoot_inbox_id,agent_mode")
    .eq("tenant_id", w.tenant_id)
    .eq("workspace_id", w.id)
    .eq("is_active", true);
  if (channelError) throw new Error("Chat inboxes unavailable.");
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({ accountId: w.chatwoot_account_id, eventsUrl, agentUrl }),
    )
    .digest("hex");
  const call = async (
    action: "begin" | "complete" | "check",
    stage: string,
    extra: Record<string, Json> = {},
  ) => {
    if (
      (await requireSuperAdmin()) !== actor ||
      process.env.CHAT_FOUNDATION_ENABLED !== "true"
    )
      throw new Error("Chat setup unavailable.");
    assertChatLiveAccess();
    const { data, error: rpcError } = await db.rpc("chat_transport_setup", {
      p_context: {
        tenantId: w.tenant_id,
        actor: { type: "USER", id: actor },
        source: "OS_PLUS_UI",
        correlationId: randomUUID(),
      },
      p_action: action,
      p_input: {
        workspaceId: w.id,
        secretHash: w.webhook_secret_hash,
        requestHash,
        stage,
        ...extra,
      },
    });
    if (rpcError) throw new Error("Chat setup needs reconciliation.");
    return data;
  };
  return provisionChatwootTransport(
    {
      accountId: w.chatwoot_account_id,
      existingBotId: w.agent_bot_id,
      name: "OS PLUS Assistant",
      eventsUrl,
      agentUrl,
      inboxes: (channels ?? []).map((c) => ({
        id: c.chatwoot_inbox_id,
        mode: c.agent_mode,
      })),
    },
    platformClient(),
    accountClient(w),
    {
      async assertWrite(stage) {
        await call("check", stage);
      },
      async begin(stage) {
        return z
          .object({
            started: z.boolean(),
            completedId: z.number().int().positive().safe().nullable(),
          })
          .parse(await call("begin", stage));
      },
      async complete(stage, id, botToken) {
        const extra: Record<string, Json> = { remoteId: id };
        if (botToken)
          extra.botTokenEnc = encryptChatSecret(botToken, {
            tenantId: w.tenant_id,
            workspaceId: w.id,
            purpose: "bot_token",
          });
        await call("complete", stage, extra);
      },
    },
  );
}
