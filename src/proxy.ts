import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/industries(.*)", "/sign-in(.*)", "/sign-up(.*)", "/track(.*)"]);
// External POSTs use raw Shopify HMAC or the worker bearer secret, not Clerk.
// Exact paths only. Owner commands, exports and diagnostics remain protected.
const isShopifyIngress=(request:Request)=>request.method==="POST"&&[
  "/api/integrations/shopify/orders-webhook","/api/integrations/shopify/privacy-webhook",
  "/api/integrations/shopify/uninstall-webhook","/api/integrations/shopify/worker",
].includes(new URL(request.url).pathname);

// Only these two POST endpoints authenticate through their workspace URL secret.
const isChatIngress = (request: Request) => request.method === "POST" &&
  /^\/api\/chat\/webhooks\/chatwoot\/[a-zA-Z0-9_-]{32,128}\/(events|agent)$/.test(new URL(request.url).pathname);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)&&!isShopifyIngress(req)&&!isChatIngress(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"]
};
