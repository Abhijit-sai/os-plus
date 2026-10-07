import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { createShopifyConnectionTester } from "@/integrations/shopify/connection-test";
import { createShopifyProbeHandler } from "@/integrations/shopify/probe-handler";

export const runtime = "nodejs";
export const maxDuration = 30;
const handle = createShopifyProbeHandler({
  getActor: getShopifyProbeActor,
  testConnection: createShopifyConnectionTester(),
});

// Remains behind Clerk middleware; no new public-route exception.
export async function POST(request: Request) { return handle(request); }
