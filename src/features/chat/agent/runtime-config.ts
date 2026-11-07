import "server-only";
import { z } from "zod";
import { liveDraftPilotSchema, type LiveDraftPilot } from "./live-draft-pilot.ts";
import { liveModelConfigSchema, type LiveModelConfig } from "./live-model.ts";

const draftModel = "google/gemini-3.8-flash";
const scopedConfig: LiveModelConfig = {
  models: { understand: draftModel, classify: draftModel, write: draftModel },
  provider: "google-vertex/global",
  maxPrice: { prompt: "0.75", completion: "3.75", request: "0" },
};
const channelScopeSchema = z
  .object({
    tenantId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    channelId: z.string().uuid(),
    accountId: z.number().int().positive().safe(),
    inboxId: z.number().int().positive().safe(),
    brandId: z.string().uuid(),
    startsAt: z.string().datetime({ offset: true }),
  })
  .strict();
type ChannelScope = z.infer<typeof channelScopeSchema>;

export function matchesScopedDraftChannel(
  scope: ChannelScope,
  workspace: { tenantId: string; id: string; accountId: number },
  channel: { id: string; kind: string; mode: string },
  inboxId: number,
): boolean {
  return (
    channel.mode === "draft" &&
    channel.kind === "whatsapp" &&
    workspace.tenantId === scope.tenantId &&
    workspace.id === scope.workspaceId &&
    workspace.accountId === scope.accountId &&
    channel.id === scope.channelId &&
    inboxId === scope.inboxId
  );
}

export function selectAgentRuntime(
  env: Record<string, string | undefined>,
  chatOrigin: string,
): { kind: "mock" } | { kind: "live"; config: LiveModelConfig; pilot?: LiveDraftPilot; channelScope?: ChannelScope } | null {
  if (env.CHAT_AGENT_ENABLED !== "true") return null;
  if (env.CHAT_AGENT_MODEL_MODE === "mock")
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(chatOrigin).hostname,
    )
      ? { kind: "mock" }
      : null;
  const mode = env.CHAT_AGENT_MODEL_MODE;
  if (
    (mode !== "live" && mode !== "live-pilot" && mode !== "live-scoped") ||
    env.CHAT_MODEL_LIVE_ENABLED !== "true" ||
    env.CHAT_DRY_RUN !== "false"
  )
    return null;
  if (!env.OPENROUTER_API_KEY?.trim())
    throw new Error("Model configuration unavailable.");

  if (mode === "live-scoped") {
    const channelScope = channelScopeSchema.parse(
      JSON.parse(env.CHAT_LIVE_DRAFT_CHANNEL_SCOPE ?? "null"),
    );
    return { kind: "live", config: scopedConfig, channelScope };
  }

  const config = liveModelConfigSchema.parse({
    models: {
      understand: env.CHAT_MODEL_UNDERSTAND,
      classify: env.CHAT_MODEL_CLASSIFY,
      write: env.CHAT_MODEL_WRITE,
    },
    provider: env.CHAT_MODEL_PROVIDER,
    maxPrice: {
      prompt: env.CHAT_MODEL_MAX_PROMPT_USD_PER_MILLION,
      completion: env.CHAT_MODEL_MAX_COMPLETION_USD_PER_MILLION,
      request: env.CHAT_MODEL_MAX_REQUEST_USD,
    },
  });
  if (mode === "live") return { kind: "live", config };
  if (
    Object.values(config.models).some((model) => model !== draftModel) ||
    config.provider !== "google-vertex/global" ||
    config.maxPrice.prompt !== "0.75" ||
    config.maxPrice.completion !== "3.75" ||
    config.maxPrice.request !== "0"
  )
    throw new Error("Pilot model configuration unavailable.");
  const pilot = liveDraftPilotSchema.parse(
    JSON.parse(env.CHAT_LIVE_DRAFT_PILOT_JSON ?? "null"),
  );
  return { kind: "live", config, pilot };
}
