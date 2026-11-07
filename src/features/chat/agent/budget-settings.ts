import "server-only";
import { z } from "zod";
import { requireChatPermission } from "../module";
import { createUserCommandContext } from "@/core/command-context/server";
import { commandKeySchema } from "../schemas";
import { usd } from "./budget";
const version = z.number().int().nonnegative().max(2147483646);
const readSchema = z
  .object({ monthlyBudgetUsd: usd.nullable(), version })
  .strict();
const saveSchema = z.object({ monthlyBudgetUsd: usd, version }).strict();
export async function getAiBudgetSettings() {
  const mode = process.env.CHAT_AGENT_MODEL_MODE;
  if (mode !== "live" && mode !== "live-pilot") return null;
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const result = await db.rpc("chat_ai_budget_settings", {
    p_context: { ...createUserCommandContext(context) },
    p_input: {},
  });
  if (result.error) throw new Error("AI budget unavailable.");
  return { ...readSchema.parse(result.data), tenantId: context.tenant.id };
}
export async function configureAiBudget(
  raw: unknown,
  key: string,
  expectedTenantId: string,
) {
  const input = saveSchema.parse(raw),
    { context, db } = await requireChatPermission("chat_settings:manage");
  if (z.string().uuid().parse(expectedTenantId) !== context.tenant.id)
    throw new Error(
      "Reload the selected business before changing its AI limit.",
    );
  const result = await db.rpc("chat_ai_budget_settings", {
    p_context: {
      ...createUserCommandContext(context, {
        idempotencyKey: commandKeySchema.parse(key),
      }),
    },
    p_input: input,
  });
  if (result.error) throw new Error("AI budget not confirmed.");
  return readSchema.parse(result.data);
}
export type AiBudgetSettings = NonNullable<
  Awaited<ReturnType<typeof getAiBudgetSettings>>
>;
