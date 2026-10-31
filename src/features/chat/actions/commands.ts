import "server-only";
import { z } from "zod";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "../module";
import { commandKeySchema } from "../schemas";
import {
  chatRequestCommandSchema,
  chatTaskCommandSchema,
  requestReceiptSchema,
  taskReceiptSchema,
} from "./schemas";
import {
  workflowSchema,
  workflowReceiptSchema,
  actionViewSchema,
} from "./view-schemas";
import { parseKnowledgePack } from "../knowledge-pack";
import { accountClient } from "../connection";
import { deliverHandoffLabel } from "./label-worker";
import { scheduleNotificationCheck } from "../notifications/trigger";
export const chatActionsEnabled = () =>
  process.env.CHAT_ACTIONS_ENABLED === "true";
function enabled() {
  if (!chatActionsEnabled())
    throw new Error("Request controls are not available.");
}
export async function runRequestCommand(raw: unknown, key: string) {
  enabled();
  const request = chatRequestCommandSchema.parse(raw);
  const { context, db } = await requireChatPermission("leads:manage");
  const response = await db.rpc("chat_action_command", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_action: request.action,
    p_input: request.input,
  });
  if (response.error) throw new Error("Request not saved.");
  const receipt = requestReceiptSchema.parse(response.data);
  await scheduleNotificationCheck(context.tenant.id);
  return receipt;
}
export async function runRequestWorkflow(raw: unknown, key: string) {
  enabled();
  const request = workflowSchema.parse(raw);
  const { context, db } = await requireChatPermission("leads:manage");
  const response = await db.rpc("chat_request_workflow", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_action: request.action,
    p_input: request.input,
  });
  if (response.error) throw new Error("Request workflow not saved.");
  const receipt = workflowReceiptSchema.parse(response.data);
  if (request.action === "change")
    await deliverHandoffLabel(
      { ...createUserCommandContext(context) },
      { requestId: request.input.id },
      { tenantId: context.tenant.id },
    );
  await scheduleNotificationCheck(context.tenant.id);
  return receipt;
}
export async function runChatTask(raw: unknown, key: string) {
  enabled();
  const request = chatTaskCommandSchema.parse(raw);
  const { context, db } = await requireChatPermission("leads:manage");
  let assigneeChatwootId: number | null = null;
  if (request.action === "handoff") {
    try {
      const targetResponse = await db.rpc("chat_task_target", {
        p_context: { ...createUserCommandContext(context) },
        p_input: { leadId: request.input.leadId },
      });
      if (targetResponse.error) throw new Error("Routing unavailable");
      const target = z
        .object({
          workspaceId: z.string().uuid(),
          accountId: z.number().int().positive().safe(),
          conversationId: z.number().int().positive().safe(),
          inboxId: z.number().int().positive().safe(),
        })
        .strict()
        .parse(targetResponse.data);
      const workspace = await db
        .from("chat_workspaces")
        .select("*")
        .eq("tenant_id", context.tenant.id)
        .eq("id", target.workspaceId)
        .maybeSingle();
      if (workspace.error || !workspace.data)
        throw new Error("Workspace unavailable");
      assigneeChatwootId = (
        await accountClient(workspace.data).conversationRouting(
          target.accountId,
          target.conversationId,
          target.inboxId,
        )
      ).assigneeId;
    } catch {
      /* Provider unavailable: retain durable lead/branch/unassigned fallback rather than drop a handoff. */
    }
  }
  const response = await db.rpc("chat_task_command", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_action: request.action,
    p_input:
      request.action === "handoff"
        ? { ...request.input, assigneeChatwootId }
        : request.input,
  });
  if (response.error) throw new Error("Task not saved.");
  const receipt = taskReceiptSchema.parse(response.data);
  if (request.action === "handoff")
    await deliverHandoffLabel(
      { ...createUserCommandContext(context) },
      { leadId: request.input.leadId },
      { tenantId: context.tenant.id },
    );
  await scheduleNotificationCheck(context.tenant.id);
  return receipt;
}
export async function getLeadActions(raw: unknown) {
  if (!chatActionsEnabled()) return null;
  const leadId = z.string().uuid().parse(raw),
    { context, db } = await requireChatPermission("leads:manage"),
    tenantId = context.tenant.id;
  const result = await db.rpc("chat_action_read", {
    p_context: { ...createUserCommandContext(context) },
    p_input: { leadId },
  });
  if (result.error) throw new Error("Request controls could not be loaded.");
  const view = actionViewSchema.parse(result.data);
  const lead = await db
    .from("leads")
    .select("channel_id,brand_id,conversation_id")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .single();
  if (lead.error) throw new Error("Enquiry unavailable.");
  const [channel, pack] = await Promise.all([
    db
      .from("chat_channels")
      .select("can_book,kind")
      .eq("tenant_id", tenantId)
      .eq("id", lead.data.channel_id)
      .single(),
    db
      .from("chat_knowledge_packs")
      .select("pack_json")
      .eq("tenant_id", tenantId)
      .eq("brand_id", lead.data.brand_id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (channel.error || pack.error)
    throw new Error("Request options unavailable.");
  const knowledge = pack.data ? parseKnowledgePack(pack.data.pack_json) : null;
  return {
    ...view,
    leadId,
    configuration: {
      capability: knowledge?.booking?.capability ?? null,
      services:
        knowledge?.services.map((s) => ({ key: s.key, name: s.name })) ?? [],
      windows: knowledge?.booking?.windows ?? [],
      canBook: channel.data.can_book,
      kind: channel.data.kind,
    },
  };
}
export type LeadActions = NonNullable<
  Awaited<ReturnType<typeof getLeadActions>>
>;
