import { mockSuggestionEnvironment } from "./mock-suggestions.mjs";
/** Explicit owned local QA only; no model key, no remote channel and no automatic channel signoff. */
export function mockActionEnvironment(enabled, suggestions, transport) {
  if (!enabled)
    return {
      CHAT_ACTIONS_ENABLED: "false",
      CHAT_PUBLIC_REPLY_ENABLED: "false",
      CHAT_MEDIA_ORIGINS: "[]",
    };
  if (!suggestions)
    throw new Error("Mock actions require explicit mock suggestions.");
  mockSuggestionEnvironment(true, transport);
  return {
    CHAT_ACTIONS_ENABLED: "true",
    CHAT_PUBLIC_REPLY_ENABLED: "true",
    CHAT_MEDIA_ORIGINS: JSON.stringify(["https://localhost:4444"]),
  };
}
