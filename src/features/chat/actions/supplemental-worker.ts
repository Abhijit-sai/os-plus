import "server-only";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "../module";
import { chatwootOrigin } from "../connection";
import { decryptChatSecret } from "../secrets";
import { ChatwootSupplementalClient } from "@/integrations/chatwoot/supplemental-client";
import type { Json } from "@/types/database";
const targetSchema = z
  .object({
    status: z.literal("claimed"),
    id: z.string().uuid(),
    kind: z.enum(["price_image", "review"]),
    text: z.string().min(1).max(6000),
    assetUrl: z.string().url().nullable(),
    workspaceId: z.string().uuid(),
    accountId: z.number().int().positive().safe(),
    conversationId: z.number().int().positive().safe(),
  })
  .strict();
function enabled() {
  if (
    process.env.CHAT_ACTIONS_ENABLED !== "true" ||
    process.env.CHAT_PUBLIC_REPLY_ENABLED !== "true" ||
    process.env.CHAT_DRY_RUN !== "false" ||
    process.env.CHAT_AGENT_MODEL_MODE !== "mock"
  )
    throw new Error("Local supplemental delivery unavailable.");
  const origin = chatwootOrigin();
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname))
    throw new Error("Local transport required");
  return origin;
}
export async function sendSupplemental(
  context: Json,
  input: Record<string, Json>,
  tenantId: string,
) {
  const origin = enabled(),
    db = createSupabaseServiceRoleClient();
  const call = async (action: string, extra: Record<string, Json> = {}) => {
    const r = await db.rpc("chat_supplemental_command", {
      p_context: context,
      p_action: action,
      p_input: { ...input, ...extra },
    });
    if (r.error) throw new Error("Supplemental receipt unavailable");
    return r.data;
  };
  const claim = z
    .object({ status: z.string() })
    .passthrough()
    .parse(await call("claim"));
  if (claim.status !== "claimed") return { status: claim.status };
  const data = targetSchema.parse(claim);
  let providerMessageId: number | undefined;
  try {
    const row = await db
      .from("chat_workspaces")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", data.workspaceId)
      .eq("status", "active")
      .single();
    if (
      row.error ||
      row.data.chatwoot_base_url !== origin ||
      row.data.chatwoot_account_id !== data.accountId ||
      !row.data.bot_token_enc
    )
      throw new Error("Supplemental transport unavailable");
    const token = decryptChatSecret(row.data.bot_token_enc, {
      tenantId,
      workspaceId: data.workspaceId,
      purpose: "bot_token",
    });
    const verify = async () => {
      enabled();
      const target = targetSchema.parse(await call("target"));
      if (JSON.stringify(target) !== JSON.stringify(data))
        throw new Error("Supplemental changed");
    };
    await verify();
    providerMessageId = (
      await new ChatwootSupplementalClient({
        origin,
        token,
        beforePost: verify,
      }).post({
        accountId: data.accountId,
        conversationId: data.conversationId,
        outboxId: data.id,
        kind: data.kind,
        text: data.text,
        assetUrl: data.assetUrl,
      })
    ).id;
    try {
      await call("record", { providerMessageId });
    } catch {
      await call("record", { providerMessageId });
    }
    return { status: "sent" };
  } catch {
    try {
      await call("uncertain", providerMessageId ? { providerMessageId } : {});
    } catch {
      /* Held claim prevents duplicate public sends. */
    }
    return { status: "uncertain" };
  }
}
export async function approveSupplemental(raw: unknown) {
  enabled();
  const id = z.string().uuid().parse(raw),
    { context } = await requireChatPermission("leads:manage");
  return sendSupplemental(
    { ...createUserCommandContext(context) },
    { id },
    context.tenant.id,
  );
}
export async function prepareSupplementals(
  context: Json,
  input: Record<string, string>,
  cap: { runId: string; leaseToken: string },
  tenantId: string,
  auto: boolean,
) {
  if (process.env.CHAT_ACTIONS_ENABLED !== "true") return;
  const db = createSupabaseServiceRoleClient();
  for (const kind of ["price_image", "review"]) {
    const body = { ...input, ...cap, kind },
      result = await db.rpc("chat_supplemental_command", {
        p_context: context,
        p_action: "prepare",
        p_input: body,
      });
    if (result.error) continue;
    const receipt = z
      .object({ status: z.string(), id: z.string().uuid().optional() })
      .strict()
      .parse(result.data);
    if (auto && receipt.status === "draft" && receipt.id)
      await sendSupplemental(context, { ...body, id: receipt.id }, tenantId);
  }
}
