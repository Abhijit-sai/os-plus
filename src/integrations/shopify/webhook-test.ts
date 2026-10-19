import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { assertWebhookRuntime } from "./webhook-registration.ts";
import { readBoundedBody } from "./bounded-body.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";

// A synthetic, signed delivery to our own fixed endpoint, NOT an event sent by
// Shopify. Only IDs are sent. The worker reads the real order from Shopify.
export async function testShopifyWebhookDelivery(actor:ShopifyProbeActor,orderGid:string,requestKey:string,
  checkBinding:()=>Promise<unknown>,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env,transport:typeof fetch=fetch,now=Date.now){
  const config=assertWebhookRuntime(actor,env);
  if(!/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/.test(orderGid)||!z.string().uuid().safeParse(requestKey).success)
    throw new ShopifyIntegrationError("REQUEST_INVALID");
  const body=JSON.stringify({admin_graphql_api_id:orderGid});
  const signature=createHmac("sha256",config.clientSecret).update(body).digest("base64");
  const headers={"Content-Type":"application/json","X-Shopify-Hmac-Sha256":signature,
    "X-Shopify-Shop-Domain":config.shopDomain,"X-Shopify-Topic":"orders/updated",
    "X-Shopify-Webhook-Id":requestKey,"X-Shopify-Event-Id":requestKey,
    "X-Shopify-Triggered-At":new Date(now()).toISOString(),"X-Shopify-API-Version":"2026-10"};
  // Replay the identical delivery to exercise durable deduplication. A receipt
  // does not prove worker completion, deduplication, or a genuine Shopify event.
  for(let attempt=0;attempt<2;attempt++){
    signal.throwIfAborted();await checkBinding();signal.throwIfAborted();
    const deadline=AbortSignal.any([signal,AbortSignal.timeout(6000)]);
    try{
      const response=await transport(`${config.origin}/api/integrations/shopify/orders-webhook`,{
        method:"POST",headers,body,redirect:"error",cache:"no-store",signal:deadline});
      const bytes=await readBoundedBody(response.body,2048,deadline);
      if(response.status!==200||!z.object({status:z.literal("received")}).strict().safeParse(JSON.parse(bytes.toString("utf8"))).success)
        throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");
    }catch{throw new ShopifyIntegrationError("WEBHOOK_SETUP_UNCONFIRMED");}
  }
  return {status:"webhook_test_received"};
}
