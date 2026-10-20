"use server";
import {headers} from "next/headers";
import {revalidatePath} from "next/cache";
import {getShopifyProbeActor} from "@/integrations/shopify/probe-actor";
import {assertUnifiedRuntime,createShopifyUnifiedService} from "@/integrations/shopify/unified-service";
import {createSupabaseServiceRoleClient} from "@/lib/supabase/server";
import {ShopifyIntegrationError} from "@/integrations/shopify/errors";
import type {UnifiedActionState} from "@/integrations/shopify/unified-contract";

export async function shopifyUnifiedAction(_previous:UnifiedActionState,form:FormData):Promise<UnifiedActionState>{
  try{
    const actor=await getShopifyProbeActor();if(!actor)throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
    const config=assertUnifiedRuntime(actor,process.env),h=await headers();
    if(h.get("origin")!==config.origin||h.get("sec-fetch-site")==="cross-site")throw new ShopifyIntegrationError("ACCESS_DENIED");
    const raw=form.get("command");if(typeof raw!=="string"||Buffer.byteLength(raw)>4096)throw new ShopifyIntegrationError("REQUEST_INVALID");
    let input:unknown;try{input=JSON.parse(raw);}catch{throw new ShopifyIntegrationError("REQUEST_INVALID");}
    const result=await createShopifyUnifiedService(createSupabaseServiceRoleClient()).execute(actor,input,AbortSignal.timeout(48000));
    revalidatePath("/orders");revalidatePath("/settings/shopify");return result;
  }catch(error){
    const code=error instanceof ShopifyIntegrationError?error.code:error instanceof Error&&error.name==="ZodError"?"REQUEST_INVALID":"UNKNOWN";
    const messages:Record<string,string>={
      REQUEST_INVALID:"Choose valid dates: up to 31 days, ending no later than today (India time).",
      ORDER_HISTORY_SCOPE_REQUIRED:"Shopify has not granted access to orders older than 60 days. Choose a recent range or ask the store administrator to grant history access.",
      ACCESS_DENIED:"The verified Test connection and active owner access are required. No production tenant is enabled.",
      AUTHENTICATION_REQUIRED:"Sign in again to continue.",
      STALE_REVISION:"This preview expired or the connection changed. Preview the date range again before importing.",
      IDEMPOTENCY_CONFLICT:"This request no longer matches the original action. Refresh and preview again; existing orders will not be duplicated.",
      WEBHOOK_SETUP_REQUIRED:"Automatic sync setup is not ready yet. Date-range imports remain available.",
      CONNECTION_UNAVAILABLE:"An administrator needs to connect this Test tenant to the Shopify store first.",
      MANUAL_CLEANUP_REQUIRED:"Confirm manual cleanup of temporary payloads after 24 hours before importing. Imported orders and customers will remain.",
      CONFIGURATION_INVALID:"The Test import configuration is incomplete. Ask the administrator to check its credentials and import settings; n8n is not required for manual imports.",
    };
    return {status:"error",message:messages[code]??"The result could not be confirmed. Retry the same action; duplicate protection remains active."};
  }
}
