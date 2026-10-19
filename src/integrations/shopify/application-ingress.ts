import "server-only";
import { createHash,createHmac,timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { createShopifyIntakeStore } from "./intake-store.ts";
import { createShopifyIntakeHandler } from "./intake-handler.ts";
import { createShopifyPrivacyStore } from "./privacy-store.ts";
import { createShopifyPrivacyHandler } from "./privacy-handler.ts";
import { shopifyIntakeResultSchema } from "./intake-contract.ts";
import { canonicalShopDomain } from "./config.ts";
import { readBoundedBody } from "./bounded-body.ts";
import { runShopifyPilotWorker } from "./application-worker.ts";
import { runShopifyUnifiedWorker } from "./unified-worker.ts";
import { assertShopifyApplicationStage } from "./application-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const reply=(body:object,status:number)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
const signEnv=(env:NodeJS.ProcessEnv)=>({...env,SHOPIFY_CLIENT_SECRET:env.SHOPIFY_WEBHOOK_SIGNING_SECRET??env.SHOPIFY_CLIENT_SECRET});
function pilotBinding(tenant:string,domain:string,env:NodeJS.ProcessEnv){
  return tenant===env.SHOPIFY_CONNECTION_TEST_TENANT_ID&&domain===canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??"");
}
type BackgroundImport = { schedule: (task: () => Promise<void>) => void;
  run?: typeof runShopifyPilotWorker };
export function createShopifyApplicationIngress(db:SupabaseClient<Database>,background?:BackgroundImport){
  return {
    orders(request:Request,env:NodeJS.ProcessEnv=process.env){
      if(env.SHOPIFY_PILOT_OPERATIONS_ENABLED!=="true"||env.SHOPIFY_TEST_COPY_ENABLED!=="true")return Promise.resolve(reply({error:"INTAKE_DISABLED"},503));
      const store=createShopifyIntakeStore(db);
      return createShopifyIntakeHandler({async findConnection(domain,app,signal){
        const c=await store.findConnection(domain,app,signal);return c&&pilotBinding(c.tenant_id,domain,env)?c:null;
      },async receive(connection,envelope,signal){
        const unified=env.SHOPIFY_UNIFIED_ORDERS_ENABLED==="true";
        const {data,error}=await db.rpc(unified?"receive_shopify_unified_event":"receive_shopify_pilot_event",{p_tenant_id:connection.tenant_id,p_connection_id:connection.id,
          p_envelope:{...envelope,connectionRevision:connection.revision}}).abortSignal(signal);
        if(error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
        const result=shopifyIntakeResultSchema.parse(data);
        if(background&&env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED==="true"&&connection.status==="verified"&&
          (result.status==="accepted"||result.status==="duplicate")){
          // Receipt is durable before scheduling. Never run for ignored/foreign
          // orders; the worker independently rechecks binding, policy and lease.
          // Duplicate delivery may recover a previously interrupted worker.
          background.schedule(async()=>{
            try{await (background.run??(unified?runShopifyUnifiedWorker:runShopifyPilotWorker))(db,connection.id,AbortSignal.timeout(45000),env);}
            catch{console.error("Shopify automatic import deferred; queued job retained for worker retry.");}
          });
        }
        return result;
      }})(request,signEnv(env));
    },
    privacy(request:Request,env:NodeJS.ProcessEnv=process.env){
      const store=createShopifyPrivacyStore(db);
      return createShopifyPrivacyHandler({async findConnection(domain,app,signal){
        const c=await store.findConnection(domain,app,signal);return c&&pilotBinding(c.tenantId,domain,env)?c:null;
      },receive:store.receive})(request,signEnv(env));
    },
    async uninstall(request:Request,env:NodeJS.ProcessEnv=process.env){
      if(request.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
      if(env.SHOPIFY_UNINSTALL_ENABLED!=="true"||env.VERCEL_ENV!=="production"||env.SHOPIFY_DEPLOYMENT_ENV!=="production"||env.SHOPIFY_API_VERSION!=="2026-10")return reply({error:"CONFIGURATION_INVALID"},503);
      try{
        const secret=signEnv(env).SHOPIFY_CLIENT_SECRET;
        if(!secret||secret.length>4096||/[\s\x00-\x1f\x7f]/.test(secret)||!env.SHOPIFY_CLIENT_ID)throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
        if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json"||![null,"identity"].includes(request.headers.get("content-encoding")))throw new ShopifyIntegrationError("REQUEST_INVALID");
        const signal=AbortSignal.any([request.signal,AbortSignal.timeout(4000)]),bytes=await readBoundedBody(request.body,2097152,signal);
        const signature=request.headers.get("x-shopify-hmac-sha256")??"";
        if(!/^[A-Za-z0-9+/]{43}=$/.test(signature)||!timingSafeEqual(Buffer.from(signature,"base64"),createHmac("sha256",secret).update(bytes).digest()))throw new ShopifyIntegrationError("ACCESS_DENIED");
        if(request.headers.get("x-shopify-topic")!=="app/uninstalled"||request.headers.get("x-shopify-api-version")!=="2026-10")throw new ShopifyIntegrationError("REQUEST_INVALID");
        const delivery=z.string().uuid().parse(request.headers.get("x-shopify-webhook-id")),domain=canonicalShopDomain(request.headers.get("x-shopify-shop-domain")??"");
        // Quote numeric tokens before parsing so the store id remains lossless.
        const raw=new TextDecoder("utf-8",{fatal:true}).decode(bytes).replace(/("(?:[^"\\]|\\.)*")|(-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/g,(token,stringToken:string|undefined)=>stringToken?token:JSON.stringify(token));
        const payload=z.object({id:z.string().regex(/^[1-9][0-9]{0,31}$/),myshopify_domain:z.string()}).parse(JSON.parse(raw));
        const binding=await createShopifyPrivacyStore(db).findConnection(domain,env.SHOPIFY_CLIENT_ID,signal);
        if(!binding||!pilotBinding(binding.tenantId,domain,env)||payload.myshopify_domain!==domain||binding.shopGid!==`gid://shopify/Shop/${payload.id}`)throw new ShopifyIntegrationError("ACCESS_DENIED");
        const result=await db.rpc("uninstall_shopify_pilot",{p_tenant_id:binding.tenantId,p_connection_id:binding.connectionId,p_shop_gid:binding.shopGid,p_delivery_id:delivery,p_body_sha256:createHash("sha256").update(bytes).digest("hex")}).abortSignal(signal);
        if(result.error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");return reply({status:"received"},200);
      }catch(error){const code=error instanceof ShopifyIntegrationError?error.code:"REQUEST_INVALID";return reply({error:code},code==="ACCESS_DENIED"?401:code==="BODY_TOO_LARGE"?413:code==="UPSTREAM_UNAVAILABLE"?503:400);}
    },
    async worker(request:Request,env:NodeJS.ProcessEnv=process.env){
      if(request.method!=="POST")return reply({error:"METHOD_NOT_ALLOWED"},405);
      const secret=env.SHOPIFY_WORKER_SECRET??"",supplied=request.headers.get("authorization")??"";
      if(!/^[A-Za-z0-9_-]{32,256}$/.test(secret))return reply({error:"CONFIGURATION_INVALID"},503);
      const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(supplied);
      if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply({error:"AUTHENTICATION_REQUIRED"},401);
      if(env.SHOPIFY_SCHEDULED_WORKER_ENABLED!=="true")return reply({error:"INTAKE_DISABLED"},503);
      try{
        // Includes cleanup: a Preview or disabled pilot must not even read the
        // shared database. Do not defer these checks to the import executor.
        if(env.VERCEL_ENV!=="production"||env.SHOPIFY_DEPLOYMENT_ENV!=="production"||env.SHOPIFY_API_VERSION!=="2026-10"||env.SHOPIFY_PILOT_OPERATIONS_ENABLED!=="true")throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
        if(env.SHOPIFY_UNIFIED_ORDERS_ENABLED!=="true")assertShopifyApplicationStage("worker",env);
        z.string().uuid().parse(env.SHOPIFY_CONNECTION_TEST_TENANT_ID);
        z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).parse(env.SHOPIFY_CLIENT_ID);
        canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??"");
        const signal=AbortSignal.any([request.signal,AbortSignal.timeout(53000)]);
        if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")throw new ShopifyIntegrationError("REQUEST_INVALID");
        const bytes=await readBoundedBody(request.body,1024,signal);
        z.object({}).strict().parse(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)));
        const {data,error}=await db.from("shopify_connections").select("id").eq("tenant_id",env.SHOPIFY_CONNECTION_TEST_TENANT_ID??"")
          .eq("app_ref",env.SHOPIFY_CLIENT_ID??"").eq("canonical_domain",canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??"")).eq("environment","production").limit(2).abortSignal(signal);
        if(error||!data||data.length!==1)throw new ShopifyIntegrationError("CONNECTION_UNAVAILABLE");
        if(env.SHOPIFY_UNIFIED_ORDERS_ENABLED==="true"){
          // Retention cleanup is independent of synchronization switches. It
          // redacts expired raw payloads, never retained business order records.
          const purged=await db.rpc("purge_expired_shopify_raw",{p_tenant_id:env.SHOPIFY_CONNECTION_TEST_TENANT_ID!,p_connection_id:data[0].id,
            p_shop_domain:canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??""),p_app_ref:env.SHOPIFY_CLIENT_ID!,p_limit:100}).abortSignal(signal);
          if(purged.error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
          const contacts=await db.rpc("purge_shopify_privacy_contacts",{p_tenant_id:env.SHOPIFY_CONNECTION_TEST_TENANT_ID!,p_connection_id:data[0].id,p_limit:100}).abortSignal(signal);
          if(contacts.error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
          if(env.SHOPIFY_SYNC_ENABLED!=="true")return reply({status:"raw_cleanup_checked"},200);
          return reply(await runShopifyUnifiedWorker(db,data[0].id,signal,env),200);
        }
        const purged=await db.rpc("purge_expired_shopify_pilot",{p_tenant_id:env.SHOPIFY_CONNECTION_TEST_TENANT_ID!,p_connection_id:data[0].id,p_limit:100}).abortSignal(signal);
        if(purged.error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
        const contacts=await db.rpc("purge_shopify_privacy_contacts",{p_tenant_id:env.SHOPIFY_CONNECTION_TEST_TENANT_ID!,p_connection_id:data[0].id,p_limit:100}).abortSignal(signal);
        if(contacts.error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
        if(z.object({status:z.literal("expired_source_purge")}).safeParse(purged.data).success)return reply({status:"expired_source_purge",businessDispositionRequired:true},200);
        const result=await runShopifyPilotWorker(db,data[0].id,signal,env,true);return reply(result,200);
      }catch(error){return reply({error:error instanceof ShopifyIntegrationError?error.code:"REQUEST_INVALID"},503);}
    },
  };
}
