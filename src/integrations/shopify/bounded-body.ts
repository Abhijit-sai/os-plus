import "server-only";

import { ShopifyIntegrationError } from "./errors.ts";

// Enforce a byte cap even when Content-Length is missing or dishonest.
// Deadline/abort ownership stays with the HTTP caller.
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Buffer> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ShopifyIntegrationError("BODY_TOO_LARGE");
      }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks, length);
  } finally {
    reader.releaseLock();
  }
}
