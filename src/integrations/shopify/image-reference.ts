// Shared browser/server guard. These are external references, never uploads or
// requests through the application's image optimizer.
export type ShopifyImageReference = { url: string; altText: string | null; provenance: "order" | "current_catalogue" };
export function safeShopifyImageUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 4096) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname === "cdn.shopify.com" &&
      !url.username && !url.password && !url.port && !url.hash ? url.href : null;
  } catch { return null; }
}
