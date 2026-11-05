import "server-only";
import { liveModelConfigSchema, type LiveModelConfig } from "./live-model.ts";
export function selectAgentRuntime(
  env: Record<string, string | undefined>,
  chatOrigin: string,
): { kind: "mock" } | { kind: "live"; config: LiveModelConfig } | null {
  if (env.CHAT_AGENT_ENABLED !== "true") return null;
  if (env.CHAT_AGENT_MODEL_MODE === "mock")
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(chatOrigin).hostname,
    )
      ? { kind: "mock" }
      : null;
  if (
    env.CHAT_AGENT_MODEL_MODE !== "live" ||
    env.CHAT_MODEL_LIVE_ENABLED !== "true" ||
    env.CHAT_DRY_RUN !== "false"
  )
    return null;
  if (!env.OPENROUTER_API_KEY?.trim())
    throw new Error("Model configuration unavailable.");
  return {
    kind: "live",
    config: liveModelConfigSchema.parse({
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
    }),
  };
}
