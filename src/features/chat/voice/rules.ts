import { createHash } from "node:crypto";
import { z } from "zod";
export const voiceLimitsSchema = z
  .object({
    maxBytes: z.number().int().min(1024).max(10000000),
    maxSeconds: z.number().int().min(1).max(120),
  })
  .strict();
export type VoiceLimits = z.infer<typeof voiceLimitsSchema>;
export class VoiceUnreadableError extends Error {
  constructor() {
    super("Voice note requires staff review.");
    this.name = "VoiceUnreadableError";
  }
}
const fail = (): never => {
  throw new VoiceUnreadableError();
};
/** Inspect the bytes, not webhook names/MIME/duration. Accept a narrow PCM WAV or single-stream Ogg/Opus container. Ogg CRC/framing/packet duration follows RFC3533/7845; unknown fixtures still fail mock transcription. */
export function inspectVoice(input: Uint8Array, rawLimits: unknown) {
  const limits = voiceLimitsSchema.parse(rawLimits);
  if (!(input instanceof Uint8Array) || input.byteLength > limits.maxBytes)
    fail();
  const b = Buffer.from(input);
  if (b.length < 44 || b.length > limits.maxBytes) fail();
  let durationMs: number, mime: "audio/wav" | "audio/ogg";
  if (
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WAVE"
  ) {
    if (b.readUInt32LE(4) !== b.length - 8) fail();
    let cursor = 12,
      byteRate = 0,
      block = 0,
      dataSize = 0,
      hasFormat = false,
      hasData = false;
    while (cursor + 8 <= b.length) {
      const kind = b.toString("ascii", cursor, cursor + 4),
        size = b.readUInt32LE(cursor + 4),
        start = cursor + 8,
        end = start + size;
      if (end > b.length) fail();
      if (kind === "fmt ") {
        if (hasFormat || size !== 16 || b.readUInt16LE(start) !== 1) fail();
        const channels = b.readUInt16LE(start + 2),
          rate = b.readUInt32LE(start + 4),
          bits = b.readUInt16LE(start + 14);
        byteRate = b.readUInt32LE(start + 8);
        block = b.readUInt16LE(start + 12);
        if (
          ![1, 2].includes(channels) ||
          ![8000, 16000, 24000, 32000, 44100, 48000].includes(rate) ||
          bits !== 16 ||
          block !== channels * 2 ||
          byteRate !== rate * block
        )
          fail();
        hasFormat = true;
      } else if (kind === "data") {
        if (hasData) fail();
        hasData = true;
        dataSize = size;
      }
      cursor = end + (size % 2);
    }
    if (
      cursor !== b.length ||
      !hasFormat ||
      !hasData ||
      dataSize === 0 ||
      dataSize % block !== 0
    )
      fail();
    durationMs = (dataSize * 1000) / byteRate;
    mime = "audio/wav";
  } else if (b.toString("ascii", 0, 4) === "OggS") {
    durationMs = opusDuration(b);
    mime = "audio/ogg";
  } else return fail();
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > limits.maxSeconds * 1000
  )
    fail();
  return {
    bytes: b,
    mime,
    durationMs,
    sha256: createHash("sha256").update(b).digest("hex"),
  };
}

function opusDuration(b: Buffer): number {
  let at = 0,
    sequence = 0,
    serial: number | undefined,
    packets = 0,
    samples = 0,
    lastPacket = 0,
    preskip = 0,
    finalGranule = BigInt(0),
    eos = false;
  while (at < b.length) {
    if (
      eos ||
      at + 27 > b.length ||
      b.toString("ascii", at, at + 4) !== "OggS" ||
      b[at + 4] !== 0
    )
      fail();
    const flags = b[at + 5],
      n = b[at + 26],
      header = at + 27 + n;
    if (header > b.length || (flags & 1) !== 0 || flags > 7) fail();
    if (sequence === 0 ? (flags & 2) === 0 : (flags & 2) !== 0) fail();
    const currentSerial = b.readUInt32LE(at + 14);
    if (serial !== undefined && currentSerial !== serial) fail();
    serial = currentSerial;
    if (b.readUInt32LE(at + 18) !== sequence++) fail();
    let size = 0;
    for (let j = 0; j < n; j++) size += b[at + 27 + j];
    const end = header + size;
    if (end > b.length || n === 0 || b[at + 26 + n] === 255) fail();
    let checksum = 0;
    for (let k = at; k < end; k++) {
      const value = k >= at + 22 && k < at + 26 ? 0 : b[k];
      checksum =
        ((checksum << 8) ^ oggCrcTable[((checksum >>> 24) ^ value) & 255]) >>>
        0;
    }
    if (checksum !== b.readUInt32LE(at + 22)) fail();
    let start = header,
      packetSize = 0;
    for (let j = 0; j < n; j++) {
      packetSize += b[at + 27 + j];
      if (b[at + 27 + j] === 255) continue;
      const p = b.subarray(start, start + packetSize);
      start += packetSize;
      packetSize = 0;
      if (packets === 0) {
        if (
          p.length !== 19 ||
          p.toString("ascii", 0, 8) !== "OpusHead" ||
          p[8] !== 1 ||
          ![1, 2].includes(p[9]) ||
          p[18] !== 0
        )
          fail();
        preskip = p.readUInt16LE(10);
      } else if (packets === 1) {
        if (
          p.length < 16 ||
          p.length > 65536 ||
          p.toString("ascii", 0, 8) !== "OpusTags"
        )
          fail();
      } else {
        if (p.length < 2 || p.length > 65025) fail();
        const config = p[0] >>> 3,
          code = p[0] & 3;
        const frame =
          config >= 16
            ? 120 * (1 << (config & 3))
            : config >= 12
              ? 480 * (1 << (config & 1))
              : [480, 960, 1920, 2880][config & 3];
        const count = code === 0 ? 1 : code === 3 ? p[1] & 63 : 2;
        if (count < 1 || frame * count > 5760) fail();
        lastPacket = frame * count;
        samples += lastPacket;
        if (samples > 48000 * 121) fail();
      }
      packets++;
    }
    const granule = b.readBigUInt64LE(at + 6);
    if (
      granule === BigInt("18446744073709551615") ||
      granule < BigInt(finalGranule) ||
      granule > BigInt(samples)
    )
      fail();
    if (packets <= 2 && granule !== BigInt(0)) fail();
    finalGranule = granule;
    eos = (flags & 4) !== 0;
    at = end;
  }
  if (
    !eos ||
    packets < 3 ||
    finalGranule <= BigInt(preskip) ||
    finalGranule < BigInt(samples - lastPacket)
  )
    fail();
  return ((Number(finalGranule) - preskip) * 1000) / 48000;
}
const oggCrcTable = Array.from({ length: 256 }, (_, n) => {
  let value = (n << 24) >>> 0;
  for (let i = 0; i < 8; i++)
    value = ((value << 1) ^ (value & 0x80000000 ? 0x04c11db7 : 0)) >>> 0;
  return value;
});
