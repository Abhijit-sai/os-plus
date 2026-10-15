import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { canonicalShopDomain } from "./config.ts";
import { readBoundedBody } from "./bounded-body.ts";
import { sealShopifySource } from "./source-crypto.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const decimalId = z.string().regex(/^[1-9][0-9]{0,31}$/);
const payloadSchema = z.object({ shop_id: decimalId, shop_domain: z.string(),
  customer: z.object({ id: decimalId.optional(), email: z.string().max(1024).nullable().optional(),
    phone: z.string().max(1024).nullable().optional() }).optional(),
  orders_to_redact: z.array(decimalId).max(5000).optional(),
  orders_requested: z.array(decimalId).max(5000).optional(),
});
const bindingSchema = z.object({ tenantId: z.string().uuid(), connectionId: z.string().uuid(),
  shopGid: z.string().regex(/^gid:\/\/shopify\/Shop\/[1-9][0-9]{0,31}$/), shopDomain: z.string(),
  appRef: z.string(), environment: z.literal("production"), verifiedAt: z.string().datetime({ offset: true }) }).strict();
type Binding = z.infer<typeof bindingSchema>;
export type ShopifyPrivacyInput = Binding & { topic: string; deliveryId: string; bodySha256: string;
  customerGid: string | null; orderGids: string[]; sealedContact: ReturnType<typeof sealShopifySource> };
type Dependencies = {
  findConnection(domain: string, appRef: string, signal: AbortSignal): Promise<Binding | null>;
  receive(input: ShopifyPrivacyInput, signal: AbortSignal): Promise<unknown>;
};

// Quote numeric JSON tokens outside strings BEFORE parsing. IDs above 2^53 are
// never allowed through JSON.parse's lossy number path. Schemas reject decimals,
// exponents, negative IDs and arbitrary body-supplied tenant authority.
export function parseShopifyPrivacyPayload(body: string) {
  const quoted = body.replace(/("(?:[^"\\]|\\.)*")|(-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/g,
    (token, stringToken: string | undefined) => stringToken ? token : JSON.stringify(token));
  try { return payloadSchema.parse(JSON.parse(quoted)); }
  catch { throw new ShopifyIntegrationError("REQUEST_INVALID"); }
}

export function createShopifyPrivacyHandler(dependencies: Dependencies, timeoutMs = 4000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 4000) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return async (request: Request, env: NodeJS.ProcessEnv = process.env) => {
    const reply = (body: object, status: number) => Response.json(body, { status, headers: {
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    if (request.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
    // Separate compliance gate, never tied to order intake, token or sync flags.
    if (env.SHOPIFY_PRIVACY_ENABLED !== "true" || env.VERCEL_ENV !== "production" || env.SHOPIFY_DEPLOYMENT_ENV !== "production")
      return reply({ error: "CONFIGURATION_INVALID" }, 503);
    const secret = env.SHOPIFY_CLIENT_SECRET ?? "";
    const appRef = env.SHOPIFY_CLIENT_ID ?? "";
    if (!secret || secret.length > 4096 || /[\s\x00-\x1f\x7f]/.test(secret) || !/^[A-Za-z0-9_-]{1,256}$/.test(appRef))
      return reply({ error: "CONFIGURATION_INVALID" }, 503);
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    let interrupted: (() => void) | undefined;
    const withDeadline = async <T,>(operation: () => Promise<T>): Promise<T> => {
      if (controller.signal.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      const timeout = new Promise<never>((_resolve, reject) => {
        interrupted = () => reject(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE"));
        controller.signal.addEventListener("abort", interrupted, { once: true });
      });
      try { return await Promise.race([operation(), timeout]); }
      finally { if (interrupted) controller.signal.removeEventListener("abort", interrupted); }
    };
    try {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" ||
        ![null, "identity"].includes(request.headers.get("content-encoding"))) throw new ShopifyIntegrationError("REQUEST_INVALID");
      const bytes = await readBoundedBody(request.body, 2 * 1024 * 1024, controller.signal);
      const signature = request.headers.get("x-shopify-hmac-sha256") ?? "";
      if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) throw new ShopifyIntegrationError("ACCESS_DENIED");
      const expected = createHmac("sha256", secret).update(bytes).digest();
      const supplied = Buffer.from(signature, "base64");
      if (supplied.length !== 32 || supplied.toString("base64") !== signature || !timingSafeEqual(expected, supplied))
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      const topic = z.enum(["customers/data_request", "customers/redact", "shop/redact"]).parse(request.headers.get("x-shopify-topic"));
      const deliveryId = z.string().uuid().parse(request.headers.get("x-shopify-webhook-id"));
      const domain = canonicalShopDomain(request.headers.get("x-shopify-shop-domain") ?? "");
      const payload = parseShopifyPrivacyPayload(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      if (canonicalShopDomain(payload.shop_domain) !== domain) throw new ShopifyIntegrationError("ACCESS_DENIED");
      const parsed = bindingSchema.safeParse(await withDeadline(() => dependencies.findConnection(domain, appRef, controller.signal)));
      if (!parsed.success || parsed.data.shopDomain !== domain || parsed.data.appRef !== appRef ||
        parsed.data.shopGid !== `gid://shopify/Shop/${payload.shop_id}`) throw new ShopifyIntegrationError("ACCESS_DENIED");
      const binding = parsed.data;
      const bodySha256 = createHash("sha256").update(bytes).digest("hex");
      const contact = topic === "shop/redact" ? {} : { email: payload.customer?.email ?? null, phone: payload.customer?.phone ?? null };
      const sealedContact = sealShopifySource(JSON.stringify(contact), JSON.stringify([
        "shopify-privacy", binding.tenantId, binding.connectionId, deliveryId, bodySha256 ]), env);
      const input: ShopifyPrivacyInput = { ...binding, topic, deliveryId, bodySha256,
        customerGid: payload.customer?.id ? `gid://shopify/Customer/${payload.customer.id}` : null,
        orderGids: [...new Set((topic === "customers/data_request" ? payload.orders_requested : payload.orders_to_redact) ?? [])]
          .map((value) => `gid://shopify/Order/${value}`), sealedContact };
      const result = z.object({ status: z.literal("received"), requestId: z.string().uuid() }).strict()
        .parse(await withDeadline(() => dependencies.receive(input, controller.signal)));
      return reply(result, 200); // Durable receipt, never fulfilment/export status.
    } catch (error) {
      const code = error instanceof ShopifyIntegrationError ? error.code : error instanceof z.ZodError ? "REQUEST_INVALID" : "UPSTREAM_UNAVAILABLE";
      return reply({ error: code }, code === "ACCESS_DENIED" ? 401 : code === "BODY_TOO_LARGE" ? 413 : code === "REQUEST_INVALID" || code === "SHOP_DOMAIN_INVALID" ? 400 : 503);
    } finally { clearTimeout(timer); request.signal.removeEventListener("abort", abort); }
  };
}
