import "server-only";
import { z } from "zod";
import type { ChatwootAdminClient } from "./admin-client.ts";

const inputSchema = z
  .object({
    accountId: z.number().int().positive().safe(),
    existingBotId: z.number().int().positive().safe().nullable().default(null),
    name: z.string().trim().min(1).max(160),
    eventsUrl: z.string().url().max(8192),
    agentUrl: z.string().url().max(8192),
    inboxes: z
      .array(
        z.object({
          id: z.number().int().positive().safe(),
          mode: z.enum(["off", "draft", "auto"]),
        }),
      )
      .max(1000),
  })
  .strict();
export type SetupReceiptStore = {
  assertWrite(stage: string): Promise<void>;
  begin(
    stage: string,
  ): Promise<{ started: boolean; completedId: number | null }>;
  complete(stage: string, id: number, botToken?: string): Promise<void>;
};
/** A committed reservation precedes remote creation. A lost POST is reconciled, never blindly retried. */
export async function provisionChatwootTransport(
  input: unknown,
  platform: ChatwootAdminClient,
  account: ChatwootAdminClient,
  store: SetupReceiptStore,
) {
  const config = inputSchema.parse(input);
  if (new Set(config.inboxes.map((i) => i.id)).size !== config.inboxes.length)
    throw new Error("Duplicate inbox.");
  const bots = (await platform.listAgentBots()).filter(
    (bot) => bot.accountId === config.accountId && bot.url === config.agentUrl,
  );
  if (bots.length > 1) throw new Error("Chat setup needs reconciliation.");
  const botReceipt = await store.begin("bot");
  let bot = bots[0];
  if (
    config.existingBotId !== null &&
    (!bot || bot.id !== config.existingBotId)
  )
    throw new Error("Existing Chat bot needs callback reconciliation.");
  if (!bot) {
    if (!botReceipt.started || botReceipt.completedId !== null)
      throw new Error("Chat setup needs reconciliation.");
    await store.assertWrite("bot");
    bot = await platform.createAgentBot(
      config.accountId,
      config.name,
      config.agentUrl,
    );
  }
  if (botReceipt.completedId !== null && botReceipt.completedId !== bot.id)
    throw new Error("Chat setup needs reconciliation.");
  await store.complete("bot", bot.id, bot.token);

  const hooks = (await account.listWebhooks(config.accountId)).filter(
    (hook) => hook.url === config.eventsUrl,
  );
  if (hooks.length > 1) throw new Error("Chat setup needs reconciliation.");
  const hookReceipt = await store.begin("webhook");
  let hook = hooks[0];
  if (!hook) {
    if (!hookReceipt.started || hookReceipt.completedId !== null)
      throw new Error("Chat setup needs reconciliation.");
    await store.assertWrite("webhook");
    hook = await account.createWebhook(config.accountId, config.eventsUrl);
  }
  if (
    !hook.subscriptions.includes("message_created") ||
    (hookReceipt.completedId !== null && hookReceipt.completedId !== hook.id)
  )
    throw new Error("Chat setup needs reconciliation.");
  await store.complete("webhook", hook.id);
  const attached: number[] = [];
  for (const inbox of config.inboxes.filter((inbox) => inbox.mode !== "off")) {
    const stage = "inbox:" + inbox.id;
    await store.begin(stage);
    const current = await account.getInboxBot(config.accountId, inbox.id);
    // Never replace a separately configured inbox bot.
    if (current !== null && current !== bot.id)
      throw new Error("Inbox already has another bot.");
    if (current === null) {
      await store.assertWrite(stage);
      await account.attachBot(config.accountId, inbox.id, bot.id);
    }
    await store.complete(stage, bot.id);
    attached.push(inbox.id);
  }
  return { botId: bot.id, webhookId: hook.id, attachedInboxIds: attached };
}
