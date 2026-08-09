export type ItemTypeIconKind = "emoji" | "lucide";

export type ItemTypeIconSelection = {
  kind: ItemTypeIconKind | null;
  emoji: string | null;
  name: string | null;
  color: string | null;
};

export const itemTypeEmojiOptions = [
  { emoji: "👕", label: "T-shirt or casual top", keywords: ["shirt", "top", "tee", "clothing"] },
  { emoji: "👔", label: "Formal shirt or blazer", keywords: ["formal", "shirt", "blazer", "office"] },
  { emoji: "👗", label: "Dress or gown", keywords: ["dress", "gown", "fashion"] },
  { emoji: "🥻", label: "Saree", keywords: ["saree", "sari", "ethnic"] },
  { emoji: "🧥", label: "Coat or jacket", keywords: ["coat", "jacket", "outerwear"] },
  { emoji: "👖", label: "Trousers or jeans", keywords: ["trouser", "pants", "jeans"] },
  { emoji: "👚", label: "Blouse or top", keywords: ["blouse", "top", "kurti"] },
  { emoji: "🩳", label: "Shorts", keywords: ["shorts", "sportswear"] },
  { emoji: "🩱", label: "Swimwear", keywords: ["swimwear", "swimming"] },
  { emoji: "🥼", label: "Uniform or work coat", keywords: ["uniform", "coat", "medical"] },
  { emoji: "🧣", label: "Scarf or stole", keywords: ["scarf", "stole", "dupatta"] },
  { emoji: "🧦", label: "Socks", keywords: ["socks", "hosiery"] },
  { emoji: "🧢", label: "Cap or headwear", keywords: ["cap", "hat", "headwear"] },
  { emoji: "👜", label: "Handbag or accessory", keywords: ["bag", "handbag", "accessory"] },
  { emoji: "👞", label: "Footwear", keywords: ["shoe", "footwear"] },
  { emoji: "✂️", label: "Alteration or cutting", keywords: ["alteration", "cutting", "tailor", "salon"] },
  { emoji: "🧵", label: "Threadwork or embroidery", keywords: ["thread", "embroidery", "maggam"] },
  { emoji: "🪡", label: "Stitching or handwork", keywords: ["stitching", "needle", "handwork"] },
] as const;

export const itemTypeLucideSuggestions = [
  { name: "washing-machine", label: "Laundry", keywords: ["laundry", "wash", "cleaning"] },
  { name: "shirt", label: "Garment", keywords: ["shirt", "garment", "clothing", "boutique"] },
  { name: "scissors", label: "Cutting or salon", keywords: ["cut", "tailor", "salon", "hair"] },
  { name: "paintbrush", label: "Painting", keywords: ["paint", "painting", "art"] },
  { name: "sparkles", label: "Finishing or beauty", keywords: ["finish", "beauty", "clean"] },
  { name: "utensils", label: "Food or catering", keywords: ["food", "restaurant", "catering"] },
  { name: "cake-slice", label: "Bakery", keywords: ["cake", "bakery", "dessert"] },
  { name: "wrench", label: "Repair or service", keywords: ["repair", "service", "maintenance"] },
  { name: "flower-2", label: "Flowers or decoration", keywords: ["flower", "floral", "decoration"] },
  { name: "package", label: "Product or package", keywords: ["product", "package", "parcel"] },
  { name: "car", label: "Automotive", keywords: ["car", "automotive", "vehicle"] },
  { name: "house", label: "Home service", keywords: ["home", "house", "interior"] },
] as const;

export const itemTypeIconColorOptions = [
  { value: "default", label: "Default", className: "text-foreground", swatchClassName: "bg-foreground" },
  { value: "slate", label: "Slate", className: "text-slate-600 dark:text-slate-300", swatchClassName: "bg-slate-600" },
  { value: "red", label: "Red", className: "text-red-600 dark:text-red-400", swatchClassName: "bg-red-600" },
  { value: "orange", label: "Orange", className: "text-orange-600 dark:text-orange-400", swatchClassName: "bg-orange-600" },
  { value: "amber", label: "Amber", className: "text-amber-600 dark:text-amber-400", swatchClassName: "bg-amber-500" },
  { value: "emerald", label: "Emerald", className: "text-emerald-600 dark:text-emerald-400", swatchClassName: "bg-emerald-600" },
  { value: "blue", label: "Blue", className: "text-blue-600 dark:text-blue-400", swatchClassName: "bg-blue-600" },
  { value: "violet", label: "Violet", className: "text-violet-600 dark:text-violet-400", swatchClassName: "bg-violet-600" },
  { value: "pink", label: "Pink", className: "text-pink-600 dark:text-pink-400", swatchClassName: "bg-pink-600" },
] as const;

const emojiPattern = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/u;
const lucideNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const iconColorValues = new Set<string>(itemTypeIconColorOptions.map((option) => option.value));
const lucideIconNameValues = new Set<string>(lucideIconNames);

export function normalizeItemTypeEmoji(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  const graphemes = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(normalized)];
  if (graphemes.length !== 1 || !emojiPattern.test(normalized) || normalized.length > 16) {
    throw new Error("Choose one emoji, or leave the item icon blank.");
  }
  return normalized;
}

export function normalizeItemTypeIcon(input: {
  kind?: unknown;
  emoji?: unknown;
  name?: unknown;
  color?: unknown;
}): ItemTypeIconSelection {
  const rawKind = typeof input.kind === "string" ? input.kind.trim() : "";
  const inferredKind = rawKind || (typeof input.emoji === "string" && input.emoji.trim() ? "emoji" : "");

  if (!inferredKind) return { kind: null, emoji: null, name: null, color: null };

  if (inferredKind === "emoji") {
    const emoji = normalizeItemTypeEmoji(input.emoji);
    if (!emoji) throw new Error("Choose one emoji, or use the default item icon.");
    return { kind: "emoji", emoji, name: null, color: null };
  }

  if (inferredKind !== "lucide") throw new Error("Choose a supported item icon type.");

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 64 || !lucideNamePattern.test(name) || !lucideIconNameValues.has(name)) {
    throw new Error("Choose a valid icon from the icon library.");
  }

  const color = typeof input.color === "string" && input.color.trim() ? input.color.trim() : "default";
  if (!iconColorValues.has(color)) throw new Error("Choose a supported icon color.");

  return { kind: "lucide", emoji: null, name, color };
}

export function getItemTypeIconColorClass(color: string | null | undefined) {
  return itemTypeIconColorOptions.find((option) => option.value === color)?.className ?? itemTypeIconColorOptions[0].className;
}
import { lucideIconNames } from "./lucide-icon-names.generated.ts";
