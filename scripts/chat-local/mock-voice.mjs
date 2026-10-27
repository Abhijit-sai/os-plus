/** Explicit owned-local voice demonstration, not speech recognition. No live adapter/key is configured. */
export function mockVoiceEnvironment(enabled, env) {
  if (!enabled) return {};
  if (
    env.CHATWOOT_BASE_URL !== "https://localhost:4444" ||
    env.CHATWOOT_BROWSER_ORIGIN !== "http://localhost:4141"
  )
    throw Error("Mock voice requires the owned Chatwoot environment.");
  return {
    CHAT_VOICE_ENABLED: "true",
    CHAT_TRANSCRIPTION_MODE: "mock",
    CHAT_TRANSCRIPTION_LIVE_ENABLED: "false",
    CHAT_MODEL_TRANSCRIBE: "",
    CHAT_MODEL_LIVE_ENABLED: "false",
    CHAT_VOICE_MEDIA_MOCK_ENABLED: "true",
    CHAT_VOICE_MEDIA_ORIGINS: JSON.stringify([
      "http://localhost:4141",
      "https://localhost:4444",
    ]),
  };
}
