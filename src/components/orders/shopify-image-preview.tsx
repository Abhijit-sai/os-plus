"use client";
import { useState } from "react";
import { safeShopifyImageUrl, type ShopifyImageReference } from "@/integrations/shopify/image-reference";

export function ShopifyImagePreview({ image, title }: { image?: ShopifyImageReference | null; title: string }) {
  const url = safeShopifyImageUrl(image?.url);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return <p className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border bg-muted p-2 text-center text-xs text-muted-foreground">Preview unavailable</p>;
  return <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
    className="block w-24 shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    aria-label={`Open image of ${title} (new tab)`}>
    {/* Direct CDN loading is intentional: no optimizer, download, or stored image copy. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={image?.altText || title} width={96} height={96} loading="lazy" decoding="async"
      referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} className="h-24 w-24 rounded-lg border object-contain" />
    <span className="mt-1 block text-xs underline">View image ↗</span>
    {image?.provenance === "current_catalogue" && <span className="block text-xs text-muted-foreground">Current catalogue</span>}
  </a>;
}
