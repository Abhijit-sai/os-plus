import { inspectVoice, VoiceUnreadableError } from "./rules.ts";
import { syntheticVoiceFixture } from "./mock-fixtures.ts";
import { createHash } from "node:crypto";
import { syntheticOpusBase64 } from "./opus-fixture.ts";
/** No live adapter exists here. A key, live flag or arbitrary recording cannot enable a paid call. */
export async function transcribeSyntheticVoice(
  bytes: Uint8Array,
  limits: unknown,
  languages: readonly string[],
) {
  if (
    process.env.CHAT_VOICE_ENABLED !== "true" ||
    process.env.CHAT_TRANSCRIPTION_MODE !== "mock" ||
    process.env.CHAT_TRANSCRIPTION_LIVE_ENABLED === "true"
  )
    throw new VoiceUnreadableError();
  const audio = inspectVoice(bytes, limits);
  for (const kind of ["information", "booking", "confirmation"] as const) {
    const fixture = syntheticVoiceFixture(kind);
    const allowedHashes = [
      createHash("sha256").update(fixture.bytes).digest("hex"),
      ...(kind === "information"
        ? [
            createHash("sha256")
              .update(Buffer.from(syntheticOpusBase64, "base64"))
              .digest("hex"),
          ]
        : []),
    ];
    if (
      allowedHashes.includes(audio.sha256) &&
      languages.includes(fixture.language)
    )
      return {
        text: fixture.text,
        language: fixture.language,
        kind,
        model: "local-synthetic-voice",
        costUsd: "0" as const,
        sha256: audio.sha256,
        durationMs: audio.durationMs,
        bytes: bytes.byteLength,
      };
  }
  throw new VoiceUnreadableError();
}
