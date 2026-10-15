import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { readBoundedBody } from "./bounded-body.ts";
import { canonicalShopDomain, SHOPIFY_API_VERSION } from "./config.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { shopifyIntakeConnectionSchema, shopifyIntakeEnvelopeSchema, shopifyIntakeResultSchema,
  shopifyOrderGid, type ShopifyIntakeConnection, type ShopifyIntakeEnvelope,
  type ShopifyIntakeResult } from "./intake-contract.ts";

export type ShopifyIntakeDependencies = {
  findConnection: (shopDomain: string, appRef: string, signal: AbortSignal) => Promise<ShopifyIntakeConnection | null>;
  receive: (connection: ShopifyIntakeConnection, envelope: ShopifyIntakeEnvelope,
    signal: AbortSignal) => Promise<ShopifyIntakeResult>;
};
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: object, status: number) => Response.json(body, { status, headers });
const payloadSchema = z.object({ admin_graphql_api_id: shopifyOrderGid });

async function beforeAbort<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
  let cancel: () => void = () => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE"));
    signal.addEventListener("abort", cancel, { once: true });
  });
  try { return await Promise.race([operation(), interrupted]); }
  finally { signal.removeEventListener("abort", cancel); }
}

// Not wired to a Next route yet. Migration, connection setup and privacy gates
// must be approved before exposing this endpoint or subscribing Shopify.
export function createShopifyIntakeHandler(dependencies: ShopifyIntakeDependencies, timeoutMs = 4000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 4000) {
    throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  }
  return async function handle(request: Request, env: NodeJS.ProcessEnv = process.env): Promise<Response> {
    if (request.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
    if (env.SHOPIFY_INTAKE_ENABLED !== "true") return reply({ error: "INTAKE_DISABLED" }, 503);
    const appRef = env.SHOPIFY_CLIENT_ID ?? "";
    const secret = env.SHOPIFY_CLIENT_SECRET ?? "";
    if (env.VERCEL_ENV !== "production" || env.SHOPIFY_DEPLOYMENT_ENV !== "production" ||
      env.SHOPIFY_API_VERSION !== SHOPIFY_API_VERSION || !/^[A-Za-z0-9_-]{1,256}$/.test(appRef) || /[\s\x00-\x1f\x7f]/.test(appRef) ||
      !secret || secret.length > 4096 || /[\s\x00-\x1f\x7f]/.test(secret)) {
      return reply({ error: "CONFIGURATION_INVALID" }, 503);
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" ||
        ![null, "identity"].includes(request.headers.get("content-encoding"))) {
        throw new ShopifyIntegrationError("REQUEST_INVALID");
      }
      const body = await readBoundedBody(request.body, 2 * 1024 * 1024, controller.signal);
      const signature = request.headers.get("x-shopify-hmac-sha256") ?? "";
      // Buffer's permissive base64 decoder is not a signature validator.
      if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) throw new ShopifyIntegrationError("ACCESS_DENIED");
      const supplied = Buffer.from(signature, "base64");
      const computed = createHmac("sha256", secret).update(body).digest();
      if (supplied.length !== computed.length || supplied.toString("base64") !== signature ||
        !timingSafeEqual(supplied, computed)) throw new ShopifyIntegrationError("ACCESS_DENIED");
      // No connection lookup or JSON interpretation before raw-body verification.
      const domain = canonicalShopDomain(request.headers.get("x-shopify-shop-domain") ?? "");
      let json: unknown;
      try { json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)); }
      catch { throw new ShopifyIntegrationError("REQUEST_INVALID"); }
      const payload = payloadSchema.safeParse(json);
      if (!payload.success) throw new ShopifyIntegrationError("REQUEST_INVALID");
      // Use the string GraphQL ID, not the potentially precision-lost numeric id.
      const parsed = shopifyIntakeEnvelopeSchema.safeParse({
        topic: request.headers.get("x-shopify-topic"), deliveryId: request.headers.get("x-shopify-webhook-id"),
        eventId: request.headers.get("x-shopify-event-id"), triggeredAt: request.headers.get("x-shopify-triggered-at"),
        apiVersion: request.headers.get("x-shopify-api-version"),
        bodySha256: createHash("sha256").update(body).digest("hex"), orderGid: payload.data.admin_graphql_api_id,
      });
      if (!parsed.success) throw new ShopifyIntegrationError("REQUEST_INVALID");
      const connection = shopifyIntakeConnectionSchema.safeParse(
        await beforeAbort(() => dependencies.findConnection(domain, appRef, controller.signal), controller.signal));
      if (!connection.success || connection.data.canonical_domain !== domain || connection.data.app_ref !== appRef) {
        throw new ShopifyIntegrationError("CONNECTION_UNAVAILABLE");
      }
      // receive must commit receipt AND request generation in one transaction.
      const result = shopifyIntakeResultSchema.parse(await beforeAbort(
        () => dependencies.receive(connection.data, parsed.data, controller.signal), controller.signal));
      if (result.status === "conflict") return reply({ error: "DELIVERY_CONFLICT" }, 409);
      return reply({ status: "received" }, 200); // Receipt only, never "order created".
    } catch (error) {
      const code = error instanceof ShopifyIntegrationError ? error.code : "UPSTREAM_UNAVAILABLE";
      const status = code === "ACCESS_DENIED" ? 401 : code === "BODY_TOO_LARGE" ? 413 :
        ["REQUEST_INVALID", "SHOP_DOMAIN_INVALID"].includes(code) ? 400 : 503;
      return reply({ error: code }, status);
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
    }
  };
}
