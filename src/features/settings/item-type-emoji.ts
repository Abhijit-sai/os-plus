const emojiPattern = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;

export function normalizeItemTypeEmoji(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  const graphemes = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(normalized)];
  if (graphemes.length !== 1 || !emojiPattern.test(normalized) || normalized.length > 16) {
    throw new Error("Choose one emoji, or leave the garment icon blank.");
  }
  return normalized;
}
