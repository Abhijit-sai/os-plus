"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { getShopifyApplicationConfig } from "@/integrations/shopify/application-config";
import { createShopifyApplicationService } from "@/integrations/shopify/application-service";
import { createShopifyApplicationSource } from "@/integrations/shopify/application-source";
import { runShopifyPilotWorker } from "@/integrations/shopify/application-worker";
import { ShopifyIntegrationError } from "@/integrations/shopify/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ShopifyApplicationActionState } from "@/integrations/shopify/application-contract";

const messages:Record<string,string>={
  AUTHENTICATION_REQUIRED:"Sign in again to continue.",ACCESS_DENIED:"This action requires the active Test tenant owner and enabled pilot gates.",
  REQUEST_INVALID:"Check the required fields and try again.",REVIEW_REQUIRED:"This needs owner review. Check copy approval, customer, mappings, source holds and expiry.",
  STALE_REVISION:"The order or settings changed. Refresh, review the latest version, then try again.",
  IDEMPOTENCY_CONFLICT:"This retry key belongs to different choices. Refresh before starting a new action.",
  RELEASE_DISABLED:"Release is not enabled. The draft has not entered production.",CONFIGURATION_BUSY:"Another change is in progress. Retry shortly.",
  SOURCE_CHANGED:"Shopify changed since this review. Refresh the source and review it again.",
  CONFIGURATION_INVALID:"Private Shopify configuration is incomplete. Ask the administrator to check the readiness list.",
  INTAKE_DISABLED:"Webhook intake and automatic creation must both be enabled for this Test pilot.",
  WEBHOOK_SIGNING_MISMATCH:"The webhook signing override differs from this Shopify app secret. Ask the administrator to correct the server configuration; do not share secrets here.",
  WEBHOOK_CONFIGURATION_CONFLICT:"Existing webhook subscriptions differ from this one-order Test setup. Nothing was replaced or removed. Ask the administrator to review them.",
  WEBHOOK_SETUP_REQUIRED:"Register Test webhooks first, then run the signed-delivery test.",
  WEBHOOK_SETUP_UNCONFIRMED:"Webhook setup or delivery could not be confirmed. Retry the same action; existing subscriptions and deliveries are checked before reuse.",
};
export async function shopifyApplicationAction(_previous:ShopifyApplicationActionState,form:FormData):Promise<ShopifyApplicationActionState>{
  try{
    const actor=await getShopifyProbeActor();if(!actor)throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
    const config=getShopifyApplicationConfig(actor),requestHeaders=await headers();
    if(requestHeaders.get("origin")!==config.origin||requestHeaders.get("sec-fetch-site")==="cross-site")throw new ShopifyIntegrationError("ACCESS_DENIED");
    const raw=form.get("command");if(typeof raw!=="string"||Buffer.byteLength(raw)>128000)throw new ShopifyIntegrationError("REQUEST_INVALID");
    let input:unknown;try{input=JSON.parse(raw);}catch{throw new ShopifyIntegrationError("REQUEST_INVALID");}
    const db=createSupabaseServiceRoleClient();
    const service=createShopifyApplicationService(db,createShopifyApplicationSource(),(id,signal,env)=>runShopifyPilotWorker(db,id,signal,env));
    const result=await service.execute(actor,input,AbortSignal.timeout(53000));
    revalidatePath("/settings/shopify");
    if(["retry","unknown","fenced"].includes(result.status))return {status:"error",message:"No completion was confirmed. Keep the same choices, check job health and retry safely."};
    return {status:"success",message:result.status==="released"?"Released to production in this Test tenant. No local payment or message was created.":
      result.status==="webhooks_ready"?"All three order webhook subscriptions verified for the approved Test order. Run Test signed delivery next.":
      result.status==="webhook_test_received"?"Synthetic signed delivery and replay received. This is not a real Shopify event or proof of import completion. Check Health & privacy for completed processing, then open the imported order.":
      result.status==="draft"?"Draft copied. Map and review it before releasing production work.":
      result.status==="idle"?"No pending job. Queue the approved order first.":
      result.status==="authorized"?"One-order Test copy approved. Use Copy approved order, then Process queued copy.":
      result.status==="connected"?"Store linked with imports still disabled. Approve the named Test copy next.":
      result.status==="source_redacted_business_review_required"?"Source redaction recorded. Business records still need a separate retention review.":"Saved. Review the updated state below.",
      ...("orderId" in result&&typeof result.orderId==="string"?{orderId:result.orderId}:{})};
  }catch(error){
    const code=error instanceof ShopifyIntegrationError?error.code:error instanceof Error&&error.name==="ZodError"?"REQUEST_INVALID":"UPSTREAM_UNAVAILABLE";
    return {status:"error",message:messages[code]??"Completion could not be confirmed. Keep the same choices and retry; do not create a second copy."};
  }
}
