"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { getShopifyManagerConfig } from "@/integrations/shopify/application-config";
import { createShopifyManagerService } from "@/integrations/shopify/manager-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ShopifyIntegrationError } from "@/integrations/shopify/errors";
import { resolveShopifyTenantEnvironment } from "@/integrations/shopify/tenant-credentials";
import { shopifyDraftSetupMissing, shopifyStartDraftSetupSchema, type ShopifyDraftActionState } from "@/integrations/shopify/draft-setup";

async function authorized() {
  const actor=await getShopifyProbeActor();
  if(!actor)throw new ShopifyIntegrationError("AUTHENTICATION_REQUIRED");
  const db=createSupabaseServiceRoleClient();
  const env=await resolveShopifyTenantEnvironment(db,actor.tenantId,actor.userId,AbortSignal.timeout(5000));
  const config=getShopifyManagerConfig(actor,env),h=await headers();
  if(h.get("origin")!==config.origin||h.get("sec-fetch-site")==="cross-site")throw new ShopifyIntegrationError("ACCESS_DENIED");
  return {actor,service:createShopifyManagerService(db)};
}
function message(error:unknown){
  const code=error instanceof ShopifyIntegrationError?error.code:error instanceof Error&&error.name==="ZodError"?"REQUEST_INVALID":"UNKNOWN";
  const messages:Record<string,string>={
    AUTHENTICATION_REQUIRED:"Sign in again. If your OS Plus session is active, ask the owner to reauthorize Shopify in Settings. Your draft has not been submitted.",
    ACCESS_DENIED:"An active owner or manager with Shopify access for this business is required. Your draft has not been submitted.",
    STALE_REVISION:"This order or its setup changed. Refresh the order and review the latest choices.",
    SOURCE_CHANGED:"Shopify changed since this draft was imported. Sync the latest order before completing setup.",
    SOURCE_UNAVAILABLE:"The Shopify order could not be verified. The order remains a draft.",
    IDEMPOTENCY_CONFLICT:"This retry no longer matches the saved action. Refresh before making new changes.",
    CONFIGURATION_BUSY:"A workflow is being edited. Wait briefly and retry the same action.",
    REVIEW_REQUIRED:"Setup cannot be completed yet. Check customer, garment type and workflow. Cancelled, refunded, non-physical or non-INR orders need separate handling.",
    REQUEST_INVALID:"Check the form fields and try again.",
  };
  return messages[code]??"Completion could not be confirmed. Retry the same action safely; do not create another order.";
}
export async function shopifyDraftSetupAction(_previous:ShopifyDraftActionState,form:FormData):Promise<ShopifyDraftActionState>{
  let saved:Pick<ShopifyDraftActionState,"setupId"|"version">|undefined;
  try{
    const {actor,service}=await authorized(),raw=form.get("command"),action=form.get("action");
    if(typeof raw!=="string"||Buffer.byteLength(raw)>128000)throw new ShopifyIntegrationError("REQUEST_INVALID");
    let input:unknown;try{input=JSON.parse(raw);}catch{throw new ShopifyIntegrationError("REQUEST_INVALID");}
    const signal=AbortSignal.timeout(25000);
    if(action==="save"){
      const result=await service.save(actor,input,signal);
      revalidatePath("/orders");
      return {status:"saved",message:"Draft saved. No production work has started.",...result};
    }
    if(action==="start"){
      const {connectionId,completionRequestKey,...command}=shopifyStartDraftSetupSchema.parse(input);
      if(shopifyDraftSetupMissing(command.choices).length)throw new ShopifyIntegrationError("REVIEW_REQUIRED");
      const receipt=await service.save(actor,command,signal,undefined,connectionId);
      saved=receipt;
      input={orderId:command.orderId,connectionId,setupId:receipt.setupId,requestKey:completionRequestKey};
    }else if(action!=="complete")throw new ShopifyIntegrationError("REQUEST_INVALID");
    const result=await service.complete(actor,input,signal);
    revalidatePath("/orders");revalidatePath(`/orders/${result.orderId}`);revalidatePath("/production");
    return {status:"complete",message:"Setup complete. The order is ready for your team's normal workflow.",orderId:result.orderId};
  }catch(error){return {status:"error",message:message(error),...saved};}
}
export async function searchShopifySetupOptions(input:unknown){
  try{
    const {actor,service}=await authorized();
    return {status:"success" as const,...await service.search(actor,input,AbortSignal.timeout(5000))};
  }catch(error){return {status:"error" as const,message:message(error)};}
}

export async function assignShopifyOrderDelivery(orderId:string,_previous:string,form:FormData):Promise<string>{
  const delivery=z.enum(["store_pickup","self_delivery","courier"]).safeParse(form.get("deliveryType"));
  if(!delivery.success||!z.string().uuid().safeParse(orderId).success)return "Choose a delivery method.";

  const actor=await getShopifyProbeActor();
  if(!actor||!['owner_admin','manager'].includes(actor.role))return "An active owner or manager is required.";

  const {data,error}=await createSupabaseServiceRoleClient().rpc("assign_shopify_order_delivery",{
    p_tenant_id:actor.tenantId,p_order_id:orderId,p_actor_id:actor.userId,p_delivery_type:delivery.data,
  }).abortSignal(AbortSignal.timeout(5000));
  if(error)return "Delivery could not be assigned. Refresh the order and try again.";
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return data?"Delivery method assigned.":"This order already has a delivery method.";
}
