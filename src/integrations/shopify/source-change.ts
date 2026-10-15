import "server-only";

import { createHash } from "node:crypto";
import { parseShopifyOrderSnapshot } from "./order-hydration.ts";

// Hash only order-owned facts. The separately observed CURRENT catalogue is
// enrichment, not evidence that the buyer changed this order. Job/lease clocks
// and updatedAt are freshness fences, not business differences. Arrays whose
// order has no business meaning are canonicalized without collapsing duplicates.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical).sort((a, b) => {
      const left = JSON.stringify(a), right = JSON.stringify(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

export function shopifyMeaningfulSourceDigest(input: unknown): string {
  const snapshot = parseShopifyOrderSnapshot(input);
  const order: Record<string, unknown> = Object.fromEntries(Object.entries(snapshot.order).filter(([key]) => key !== "updatedAt"));
  // Profile fields and nullable catalogue references are current enrichment,
  // not order edits. Retain the buyer identity and order-owned contact/address.
  order.customer = snapshot.order.customer ? { id: snapshot.order.customer.id } : null;
  const enrichment = new Set(["catalogue", "warnings", "image", "product", "variant", "sku", "name", "requiresShipping"]);
  const lines = snapshot.lines.map(line => Object.fromEntries(Object.entries(line).filter(([key]) => !enrichment.has(key))));
  return createHash("sha256").update(JSON.stringify(canonical({
    order, lines, shippingLines: snapshot.shippingLines,
  }))).digest("hex");
}
