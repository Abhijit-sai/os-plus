/** Synthetic tones, not speech. Hash-bound local fixtures must never claim acoustic accuracy. */
export function syntheticVoiceFixture(
  kind: "information" | "booking" | "confirmation" = "information",
) {
  const frequency = kind === "information" ? 8 : kind === "booking" ? 11 : 14,
    data = Buffer.alloc(16000);
  for (let i = 0; i < 8000; i++)
    data.writeInt16LE(Math.round(1000 * Math.sin(i / frequency)), i * 2);
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
  return {
    bytes: b,
    text:
      kind === "information"
        ? "CH8 synthetic information: What are your opening hours?"
        : kind === "booking"
          ? "CH8 synthetic booking: Please arrange a callback."
          : "yes",
    language: "en",
    kind,
  };
}
