import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { ShopifyProbeConfig } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { readBoundedBody } from "./bounded-body.ts";

const tokenSchema = z.object({
  access_token: z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),
  expires_in: z.number().int().min(61).max(86400),
  scope: z.string().max(8192),
});

// One memory-only, single-flight slot: no tokens in files, DB, logs or DTOs.
// Separate function instances reacquire tokens; this is not durable auth storage.
export function createShopifyTokenProvider(transport: typeof fetch = fetch, now = Date.now) {
  type Slot = { key: string; token?: string; expiresAt?: number; pending?: Promise<string> };
  let current: Slot | null = null;
  return {
    invalidate() { current = null; },
    async getToken(config: ShopifyProbeConfig): Promise<string> {
      const key = createHash("sha256").update(JSON.stringify(config)).digest("hex");
      if (!current || current.key !== key) current = { key };
      const slot = current;
      if (slot.token && (slot.expiresAt ?? 0) > now() + 60000) return slot.token;
      if (slot.pending) return slot.pending;
      slot.pending = (async () => {
        const startedAt = now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await transport(`https://${config.shopDomain}/admin/oauth/access_token`, {
            method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret }),
          });
          if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            if ([400, 401, 403].includes(response.status)) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
            if (response.status === 429) throw new ShopifyIntegrationError("THROTTLED", 60);
            throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
          }
          const bytes = await readBoundedBody(response.body, 32768);
          let payload: unknown;
          try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
          catch { throw new ShopifyIntegrationError("RESPONSE_INVALID"); }
          const parsed = tokenSchema.safeParse(payload);
          if (!parsed.success) throw new ShopifyIntegrationError("RESPONSE_INVALID");
          const scopes = new Set(parsed.data.scope.split(/[,\s]+/));
          for (const scope of ["orders", "customers", "products"]) {
            if (!scopes.has(`read_${scope}`) && !scopes.has(`write_${scope}`)) {
              throw new ShopifyIntegrationError("ACCESS_DENIED");
            }
          }
          slot.expiresAt = startedAt + parsed.data.expires_in * 1000;
          if (slot.expiresAt <= now() + 60000) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
          slot.token = parsed.data.access_token;
          return slot.token;
        } catch (error) {
          slot.token = undefined;
          slot.expiresAt = undefined;
          if (error instanceof ShopifyIntegrationError) throw error;
          throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE", 60);
        } finally { clearTimeout(timeout); }
      })();
      const pending = slot.pending;
      try { return await pending; }
      finally { if (slot.pending === pending) slot.pending = undefined; }
    },
  };
}
