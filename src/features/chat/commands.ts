import "server-only";
import { z } from "zod";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "./module";
import { configureChatSchema, commandKeySchema } from "./schemas";
import { validateKnowledgePublication } from "./knowledge-pack";
import { accountClient } from "./connection";

export async function configureChat(input: unknown, commandKey: string) {
  const request = configureChatSchema.parse(input),
    key = commandKeySchema.parse(commandKey);
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const tenantId = context.tenant.id;
  const ctx = createUserCommandContext(context, { idempotencyKey: key });
  // Authorize first, then recover a completed receipt before draft-state or remote checks.
  const receipt = await db.rpc("chat_configure", {
    p_context: { ...ctx, replayOnly: true },
    p_action: request.action,
    p_input: request.input,
  });
  if (receipt.error) throw new Error("Chat configuration was not saved.");
  if (receipt.data !== null)
    return z.object({ id: z.string().uuid() }).parse(receipt.data);
  if (
    request.action === "pack.save" &&
    Buffer.byteLength(JSON.stringify(request.input.pack), "utf8") > 240000
  )
    throw new Error("Knowledge pack is too large.");
  if (request.action === "pack.publish") {
    const { data: pack, error } = await db
      .from("chat_knowledge_packs")
      .select("brand_id,pack_json")
      .eq("tenant_id", tenantId)
      .eq("id", request.input.id)
      .eq("status", "draft")
      .maybeSingle();
    if (error || !pack) throw new Error("Draft unavailable.");
    const [mapping, locations] = await Promise.all([
      db
        .from("chat_brand_locations")
        .select("location_id")
        .eq("tenant_id", tenantId)
        .eq("brand_id", pack.brand_id),
      db
        .from("tenant_locations")
        .select("id,code")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("deleted_at", null),
    ]);
    if (mapping.error || locations.error)
      throw new Error("Branch configuration unavailable.");
    validateKnowledgePublication(pack.pack_json, {
      locationCodes: (locations.data ?? [])
        .filter((l) => mapping.data?.some((m) => m.location_id === l.id))
        .map((l) => l.code),
      capabilities: [],
    });
  }
  if (request.action === "channel.map") {
    const { data: workspace, error } = await db
      .from("chat_workspaces")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", request.input.workspaceId)
      .maybeSingle();
    if (error || !workspace) throw new Error("Workspace unavailable.");
    const inboxes = await accountClient(workspace).listInboxes(
      workspace.chatwoot_account_id!,
    );
    const inbox = inboxes.find((item) => item.id === request.input.inboxId);
    if (!inbox || inbox.kind !== request.input.kind)
      throw new Error("Inbox unavailable.");
    request.input.name = inbox.name; // A submitted inbox name is never account authority.
  }
  const result = await db.rpc("chat_configure", {
    p_context: { ...ctx },
    p_action: request.action,
    p_input: request.input,
  });
  if (result.error) throw new Error("Chat configuration was not saved.");
  return z.object({ id: z.string().uuid() }).parse(result.data);
}
export async function syncChatInboxes() {
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const { data: workspace, error } = await db
    .from("chat_workspaces")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .maybeSingle();
  if (error || !workspace) throw new Error("Chat workspace unavailable.");
  const inboxes = await accountClient(workspace).listInboxes(
    workspace.chatwoot_account_id!,
  );
  await requireChatPermission("chat_settings:manage");
  return inboxes;
}
