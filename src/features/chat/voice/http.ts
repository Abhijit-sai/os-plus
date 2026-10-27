import { z } from "zod";
import { VoiceUnreadableError } from "./rules.ts";
export function voiceTransportEnabled() {
  if (
    process.env.CHAT_VOICE_ENABLED !== "true" ||
    process.env.CHAT_TRANSCRIPTION_MODE !== "mock" ||
    process.env.CHAT_VOICE_MEDIA_MOCK_ENABLED !== "true" ||
    process.env.CHAT_TRANSCRIPTION_LIVE_ENABLED === "true"
  )
    throw new VoiceUnreadableError();
}
export function localVoiceOrigin(raw: string, allow: boolean | undefined) {
  const u = new URL(raw);
  if (
    allow !== true ||
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw new VoiceUnreadableError();
  return u.origin;
}
export async function boundedVoiceBody(response: Response, max: number) {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new VoiceUnreadableError();
  }
  const length = response.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > max)) {
    await response.body.cancel();
    throw new VoiceUnreadableError();
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > max) throw new VoiceUnreadableError();
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}
export const positiveProviderId = z.number().int().positive().safe();
