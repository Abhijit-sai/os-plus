import "server-only";

import { z } from "zod";
import { assertShopifyProbeActor, type ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { readBoundedBody } from "./bounded-body.ts";
import type { createShopifyConnectionTester } from "./connection-test.ts";

type Dependencies = {
  getActor: () => Promise<ShopifyProbeActor | null>;
  testConnection: ReturnType<typeof createShopifyConnectionTester>;
};
const bodySchema = z.object({}).strict();
const noStoreHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: object, status: number) => Response.json(body, { status, headers: noStoreHeaders });

export function createShopifyProbeHandler(dependencies: Dependencies) {
  return async function handle(request: Request, env: NodeJS.ProcessEnv = process.env) {
    if (request.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
    // Compare to configured canonical host, never a client-controlled Host header.
    let origin: URL;
    try {
      origin = new URL(env.SHOPIFY_APPLICATION_ORIGIN ?? "");
      if (origin.protocol !== "https:" || origin.username || origin.password || origin.port ||
        origin.pathname !== "/" || origin.search || origin.hash) throw new Error();
    } catch { return reply({ error: "CONFIGURATION_INVALID" }, 503); }
    if (request.headers.get("origin") !== origin.origin ||
      request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "ACCESS_DENIED" }, 403);
    try {
      const actor = await dependencies.getActor();
      if (!actor) return reply({ error: "AUTHENTICATION_REQUIRED" }, 401);
      assertShopifyProbeActor(actor);
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
        return reply({ error: "REQUEST_INVALID" }, 400);
      }
      const bytes = await readBoundedBody(request.body, 1024);
      let json: unknown;
      try { json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { return reply({ error: "REQUEST_INVALID" }, 400); }
      // Shop, tenant, credentials, environment and query are never browser inputs.
      if (!bodySchema.safeParse(json).success) return reply({ error: "REQUEST_INVALID" }, 400);
      return reply(await dependencies.testConnection(actor, env), 200);
    } catch (error) {
      const code = error instanceof ShopifyIntegrationError ? error.code : "UPSTREAM_UNAVAILABLE";
      const status = code === "ACCESS_DENIED" ? 403 : code === "BODY_TOO_LARGE" ? 413 : 503;
      return reply({ error: code }, status);
    }
  };
}
