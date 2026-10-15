import "server-only";

import { ShopifyIntegrationError } from "./errors.ts";

// Enforce a byte cap even when Content-Length is missing or dishonest.
// Deadline/abort ownership stays with the HTTP caller.
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, maxBytes: number, signal?: AbortSignal): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      if (signal?.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      const chunk = await reader.read();
      if (signal?.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) {
        // A stream's underlying cancel callback can itself hang. Initiate
        // cleanup, but never let it hold the bounded HTTP failure response.
        void reader.cancel().catch(() => undefined);
        throw new ShopifyIntegrationError("BODY_TOO_LARGE");
      }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks, length);
  } finally {
    signal?.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
