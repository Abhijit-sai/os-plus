import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/industries(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/track(.*)",
]);
// External POSTs use raw Shopify HMAC or the worker bearer secret, not Clerk.
// Exact paths only. Owner commands, exports and diagnostics remain protected.
const isShopifyIngress = (request: Request) =>
  request.method === "POST" &&
  [
    "/api/integrations/shopify/orders-webhook",
    "/api/integrations/shopify/privacy-webhook",
    "/api/integrations/shopify/uninstall-webhook",
    "/api/integrations/shopify/worker",
  ].includes(new URL(request.url).pathname);

// Only these two POST endpoints authenticate through their workspace URL secret.
const isChatIngress = (request: Request) =>
  request.method === "POST" &&
  /^\/api\/chat\/webhooks\/chatwoot\/[a-zA-Z0-9_-]{32,128}\/(events|agent)$/.test(
    new URL(request.url).pathname,
  );

// Exact maintenance POSTs use their dedicated bearer secrets; Telegram uses its secret-token header.
const isChatMaintenance = (request: Request) =>
  request.method === "POST" &&
  [
    "/api/chat/cron/stages",
    "/api/chat/cron/hourly",
    "/api/chat/webhooks/telegram",
  ].includes(new URL(request.url).pathname);

// Only the GET fallback shell is public; panel POST/actions and all lead reads remain authenticated.
const isChatPanelShell = (request: Request) =>
  request.method === "GET" && new URL(request.url).pathname === "/chat/panel";

export default clerkMiddleware(async (auth, req) => {
  if (
    !isPublicRoute(req) &&
    !isShopifyIngress(req) &&
    !isChatIngress(req) &&
    !isChatMaintenance(req) &&
    !isChatPanelShell(req)
  ) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
