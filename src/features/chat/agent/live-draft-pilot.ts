import { createHash } from "node:crypto";
import { z } from "zod";
import { agentScopeSchema, buildAgentContext, type AgentScope } from "./context.ts";

export const liveDraftPilotSchema = z
  .object({
    scope: agentScopeSchema,
    brandId: z.string().uuid(),
    packVersion: z.number().int().positive(),
    packSha256: z.string().regex(/^[a-f0-9]{64}$/),
    message: z.string().min(1).max(1000),
    displayName: z.string().min(1).max(100).nullable(),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type LiveDraftPilot = z.infer<typeof liveDraftPilotSchema>;

export function pilotKnowledgeHash(pack: unknown): string {
  const canonical = JSON.stringify(pack, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : value,
  );
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function allowsPilotScope(pilot: LiveDraftPilot, scope: AgentScope, now = Date.now()): boolean {
  return Date.parse(pilot.expiresAt) > now &&
    (Object.keys(pilot.scope) as (keyof AgentScope)[]).every((key) => pilot.scope[key] === scope[key]);
}

/** A scope match alone is insufficient: check every field projected to the provider. */
export function allowsPilotContext(pilot: LiveDraftPilot, scope: AgentScope, raw: unknown, now = Date.now()): boolean {
  if (!allowsPilotScope(pilot, scope, now)) return false;
  const ctx = buildAgentContext(scope, raw);
  const [message] = ctx.allPublicMessages;
  return (
    ctx.channelKind === "website" &&
    ctx.agentMode === "draft" &&
    ctx.brandId === pilot.brandId &&
    ctx.packVersion === pilot.packVersion &&
    pilotKnowledgeHash(ctx.pack) === pilot.packSha256 &&
    ctx.actions === null &&
    ctx.locations.length === 0 &&
    !ctx.ledger.requestOpen &&
    !ctx.pendingVoice &&
    !ctx.incompleteVoice &&
    (ctx.background?.customer ?? null) === null &&
    (ctx.background?.displayName ?? null) === pilot.displayName &&
    [null, "en"].includes(ctx.background?.preferredLanguage ?? null) &&
    ctx.allPublicMessages.length === 1 &&
    message.id === scope.triggerMessageId &&
    message.author === "customer" &&
    message.content === pilot.message &&
    message.inputSource !== "voice" &&
    !message.voicePending &&
    message.originalContent == null
  );
}
