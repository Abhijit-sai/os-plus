import "server-only";
import type { ShopifyProbeActor } from "./probe-config.ts";
import type { createShopifyOAuthService } from "./oauth-service.ts";
import { getShopifyOAuthConfig } from "./oauth.ts";
import { readBoundedBody } from "./bounded-body.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const cookieName = "__Host-osplus-shopify-approval";
const security = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff" };
function cookie(value: string, maxAge: number) {
  return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(request: Request) {
  const matches = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim())
    .filter(v => v.startsWith(cookieName + "="));
  return matches.length === 1 ? matches[0].slice(cookieName.length + 1) : "";
}
export function createShopifyOAuthHandlers(getActor: () => Promise<ShopifyProbeActor | null>,
  service: ReturnType<typeof createShopifyOAuthService>) {
  return {
    async start(request: Request, env: NodeJS.ProcessEnv = process.env) {
      try {
        const actor = await getActor();
        if (!actor) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
        const config = getShopifyOAuthConfig(actor, env);
        if (request.method !== "POST" || request.headers.get("origin") !== config.origin ||
          request.headers.get("sec-fetch-site") === "cross-site" ||
          request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded")
          throw new ShopifyIntegrationError("ACCESS_DENIED");
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15000)]);
        const bytes = await readBoundedBody(request.body, 1024, signal);
        const input = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if ([...input.keys()].length !== 1 || !input.has("shop")) throw new ShopifyIntegrationError("REQUEST_INVALID");
        const approval = await service.begin(actor, input.get("shop")!, signal, env);
        if(request.headers.get("accept")?.includes("application/json"))
          return Response.json({url:approval.url},{headers:{...security,"Set-Cookie":cookie(approval.cookie,600)}});
        return new Response(null, { status: 303, headers: { ...security, Location: approval.url,
          "Set-Cookie": cookie(approval.cookie, 600) } });
      } catch(error) {
        if(error instanceof ShopifyIntegrationError&&error.code==="CONFIGURATION_BUSY")
          return Response.json({code:"APPROVAL_BUSY",error:"An approval or token renewal is already in progress. Wait for it to finish; an interrupted approval can take up to 10 minutes to expire."},
            {status:409,headers:security});
        return Response.json({ error: "Shopify approval could not start. Return to settings and check owner access and connection configuration." },
          { status: 403, headers: security });
      }
    },
    async callback(request: Request, env: NodeJS.ProcessEnv = process.env) {
      try {
        const actor = await getActor();
        if (!actor) throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
        const config = getShopifyOAuthConfig(actor, env), url = new URL(request.url);
        if (request.method !== "GET" || url.origin !== config.origin) throw new ShopifyIntegrationError("ACCESS_DENIED");
        await service.complete(actor, url.searchParams, readCookie(request),
          AbortSignal.any([request.signal, AbortSignal.timeout(25000)]), env);
        return new Response(null, { status: 303, headers: { ...security,
          Location: config.origin + "/settings/shopify?connection=approved", "Set-Cookie": cookie("", 0) } });
      } catch {
        // Fixed local destination; never echo source parameters/codes or use a
        // query-string return URL. Invalid/expired approval must be restarted.
        return new Response(null, { status: 303, headers: { ...security,
          Location: "/settings/shopify?connection=failed", "Set-Cookie": cookie("", 0) } });
      }
    },
  };
}
