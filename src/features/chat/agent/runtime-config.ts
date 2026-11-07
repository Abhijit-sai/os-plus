import "server-only";
import { liveDraftPilotSchema, type LiveDraftPilot } from "./live-draft-pilot.ts";
import { liveModelConfigSchema, type LiveModelConfig } from "./live-model.ts";

const pilotModel = "google/gemini-3.8-flash";

export function selectAgentRuntime(
  env: Record<string, string | undefined>,
  chatOrigin: string,
): { kind: "mock" } | { kind: "live"; config: LiveModelConfig; pilot?: LiveDraftPilot } | null {
  if (env.CHAT_AGENT_ENABLED !== "true") return null;
  if (env.CHAT_AGENT_MODEL_MODE === "mock")
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(chatOrigin).hostname,
    )
      ? { kind: "mock" }
      : null;
  const mode = env.CHAT_AGENT_MODEL_MODE;
  if (
    (mode !== "live" && mode !== "live-pilot") ||
    env.CHAT_MODEL_LIVE_ENABLED !== "true" ||
    env.CHAT_DRY_RUN !== "false"
  )
    return null;
  if (!env.OPENROUTER_API_KEY?.trim())
    throw new Error("Model configuration unavailable.");

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
    Object.values(config.models).some((model) => model !== pilotModel) ||
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
