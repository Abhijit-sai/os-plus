import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { getShopifyApplicationConfig } from "@/integrations/shopify/application-config";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { shopifyApplicationDataSchema,projectShopifyApplication } from "@/integrations/shopify/application-view";
import { openShopifySource } from "@/integrations/shopify/source-crypto";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
export async function GET(request:Request){
  try{
    const actor=await getShopifyProbeActor();if(!actor)throw Error();
    const config=getShopifyApplicationConfig(actor);
    if(request.headers.get("sec-fetch-site")==="cross-site"||(request.headers.has("origin")&&request.headers.get("origin")!==config.origin))throw Error();
    const id=z.string().uuid().parse(new URL(request.url).searchParams.get("request")),db=createSupabaseServiceRoleClient(),signal=AbortSignal.timeout(6000);
    const {data,error}=await db.rpc("read_shopify_application",{p_tenant_id:actor.tenantId,p_actor_id:actor.userId,p_domain:config.shopDomain,p_app_ref:config.clientId}).abortSignal(signal);
    if(error)throw Error();
    const parsed=shopifyApplicationDataSchema.parse(data),view=projectShopifyApplication(data,config),privacy=view.privacy.find(r=>r.id===id);
    if(!privacy||!view.connection)throw Error();
    const locator=await db.rpc("read_shopify_privacy_review",{p_tenant_id:actor.tenantId,p_connection_id:view.connection.id,p_actor_id:actor.userId,p_request_id:id}).abortSignal(signal);
    if(locator.error)throw Error();
    const privateLocator=z.object({id:z.string().uuid(),tenantId:z.string().uuid(),connectionId:z.string().uuid(),deliveryId:z.string().uuid(),bodySha256:z.string().regex(/^[a-f0-9]{64}$/),sealedContact:z.unknown()}).parse(locator.data);
    if(privateLocator.id!==id||privateLocator.tenantId!==actor.tenantId||privateLocator.connectionId!==view.connection.id)throw Error();
    const contact=z.object({ciphertext:z.string()}).safeParse(privateLocator.sealedContact).success?
      z.object({email:z.string().max(1024).nullable().optional(),phone:z.string().max(1024).nullable().optional()}).parse(JSON.parse(openShopifySource(privateLocator.sealedContact,
        JSON.stringify(["shopify-privacy",actor.tenantId,view.connection.id,privateLocator.deliveryId,privateLocator.bodySha256]),process.env))):null;
    // Exact locators only. Email/phone-only requests require manual identity
    // resolution, never a same-phone guess that exports another buyer's data.
    const selected=new Set(parsed.sources.filter(row=>privacy.orderGids.includes(row.source.order_gid)||(privacy.customerGid!==null&&row.revision.source_customer_gid===privacy.customerGid)).map(row=>row.source.id));
    const packageData={kind:"owner_privacy_review_package",version:1,generatedAt:new Date().toISOString(),fulfilled:false,request:privacy,contact,
      sourceOrders:view.sources.filter(row=>selected.has(row.id)),
      limitations:["Not a completed data-subject response or erasure.","Contact-only locators require a separate identity and business-record review.",
        "Local customer, attachment, finance and production retention/export decisions must be reviewed before fulfilment.","Expired or redacted source copies are unavailable."]};
    const logged=await db.rpc("command_shopify_application",{p_tenant_id:actor.tenantId,p_connection_id:view.connection.id,p_actor_id:actor.userId,p_request_key:randomUUID(),p_action:"privacy_note",
      p_input:{privacyRequestId:id,reason:"Owner privacy review package downloaded. Business disposition and subject response remain pending.",disposition:"external_followup"}}).abortSignal(signal);
    if(logged.error)throw Error();
    return Response.json(packageData,{headers:{...privateHeaders,"Content-Disposition":`attachment; filename="shopify-privacy-review-${id}.json"`}});
  }catch{return Response.json({error:"ACCESS_DENIED"},{status:403,headers:privateHeaders});}
}
