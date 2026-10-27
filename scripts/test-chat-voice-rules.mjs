import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectVoice } from "../src/features/chat/voice/rules.ts";
function wave(seconds = 1) {
  const data = Buffer.alloc(seconds * 16000);
  for (let i = 0; i < data.length / 2; i++)
    data.writeInt16LE(Math.round(1000 * Math.sin(i / 8)), i * 2);
  const b = Buffer.alloc(44 + data.length);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data.length, 40);
  data.copy(b, 44);
  return b;
}
export { wave };
test("a bounded PCM voice fixture has duration measured from its audio bytes", () => {
  const audio = inspectVoice(wave(), { maxBytes: 10000000, maxSeconds: 120 });
  assert.equal(audio.mime, "audio/wav");
  assert.equal(audio.durationMs, 1000);
  assert.match(audio.sha256, /^[a-f0-9]{64}$/);
});

test("voice limits reject corrupt, forged-rate, overlong and over-budget audio before transcription", () => {
  for (const bytes of [Buffer.from("audio"), wave(121), Buffer.alloc(10000001)])
    assert.throws(() =>
      inspectVoice(bytes, { maxBytes: 10000000, maxSeconds: 120 }),
    );
  const forged = wave();
  forged.writeUInt32LE(1, 28);
  assert.throws(() =>
    inspectVoice(forged, { maxBytes: 10000000, maxSeconds: 120 }),
  );
  assert.throws(() =>
    inspectVoice(wave(), { maxBytes: 1024, maxSeconds: 120 }),
  );
});
test("mock transcription recognizes only known synthetic bytes and honours live/disabled switches", async () => {
  const { transcribeSyntheticVoice } =
    await import("../src/features/chat/voice/transcriber.ts");
  const { syntheticVoiceFixture } =
    await import("../src/features/chat/voice/mock-fixtures.ts");
  const old = { ...process.env };
  try {
    process.env.CHAT_VOICE_ENABLED = "true";
    process.env.CHAT_TRANSCRIPTION_MODE = "mock";
    const fixture = syntheticVoiceFixture("information");
    assert.equal(
      (
        await transcribeSyntheticVoice(
          fixture.bytes,
          { maxBytes: 10000000, maxSeconds: 120 },
          ["en"],
        )
      ).text,
      fixture.text,
    );
    const unknown = Buffer.from(fixture.bytes);
    unknown[100] ^= 1;
    await assert.rejects(
      transcribeSyntheticVoice(
        unknown,
        { maxBytes: 10000000, maxSeconds: 120 },
        ["en"],
      ),
    );
    process.env.CHAT_TRANSCRIPTION_MODE = "live";
    await assert.rejects(
      transcribeSyntheticVoice(
        fixture.bytes,
        { maxBytes: 10000000, maxSeconds: 120 },
        ["en"],
      ),
    );
    process.env.CHAT_TRANSCRIPTION_MODE = "mock";
    process.env.CHAT_VOICE_ENABLED = "false";
    await assert.rejects(
      transcribeSyntheticVoice(
        fixture.bytes,
        { maxBytes: 10000000, maxSeconds: 120 },
        ["en"],
      ),
    );
  } finally {
    for (const k of ["CHAT_VOICE_ENABLED", "CHAT_TRANSCRIPTION_MODE"])
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
  }
});

test("Ogg/Opus duration is checked from packet timing and authenticated pages, not MIME metadata", async () => {
  const { syntheticOpusBase64 } =
    await import("../src/features/chat/voice/opus-fixture.ts");
  const bytes = Buffer.from(syntheticOpusBase64, "base64");
  const result = inspectVoice(bytes, { maxBytes: 10000000, maxSeconds: 120 });
  assert.equal(result.mime, "audio/ogg");
  assert.equal(result.durationMs, 1000);
  const bad = Buffer.from(bytes);
  bad[bad.length - 1] ^= 1;
  assert.throws(() =>
    inspectVoice(bad, { maxBytes: 10000000, maxSeconds: 120 }),
  );
  assert.throws(() =>
    inspectVoice(bytes.subarray(0, bytes.length - 1), {
      maxBytes: 10000000,
      maxSeconds: 120,
    }),
  );
});
