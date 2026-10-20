import "server-only";
import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "../../types/database.ts";
import type {ShopifyProbeActor} from "./probe-config.ts";
import {getShopifyApplicationConfig} from "./application-config.ts";
import {createShopifyApplicationSource} from "./application-source.ts";
import {createShopifyImportPreviewReader} from "./import-preview.ts";
import {createShopifyImportPreviewService} from "./import-preview-service.ts";
import {unifiedCommandSchema,unifiedWorkspaceSchema,unifiedImportReceiptSchema,type UnifiedActionState,type UnifiedWorkspace} from "./unified-contract.ts";
import {runShopifyUnifiedWorker} from "./unified-worker.ts";
import {ShopifyIntegrationError} from "./errors.ts";
import {registerShopifyUnifiedWebhooks} from "./webhook-registration.ts";

export function assertUnifiedRuntime(actor:ShopifyProbeActor,env:NodeJS.ProcessEnv){
  const config=getShopifyApplicationConfig(actor,env);
  if(env.SHOPIFY_UNIFIED_ORDERS_ENABLED!=="true"||env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED!=="true")throw new ShopifyIntegrationError("ACCESS_DENIED");
  return config;
}
function fail(message:string):never{
  throw new ShopifyIntegrationError(message==="SHOPIFY_STALE_REVISION"?"STALE_REVISION":message==="SHOPIFY_IDEMPOTENCY_CONFLICT"?"IDEMPOTENCY_CONFLICT":
    message==="SHOPIFY_ACCESS_DENIED"?"ACCESS_DENIED":"UPSTREAM_UNAVAILABLE");
}
function workerConfigured(env:NodeJS.ProcessEnv){
  // Endpoint configuration is NOT proof that an external schedule is running.
  return env.SHOPIFY_SCHEDULED_WORKER_ENABLED==="true"&&/^[A-Za-z0-9_-]{32,256}$/.test(env.SHOPIFY_WORKER_SECRET??"");
}
export function createShopifyUnifiedService(db:SupabaseClient<Database>,transport:typeof fetch=fetch,now=Date.now){
  const previewSource=createShopifyImportPreviewService(db,createShopifyImportPreviewReader(transport,now));
  async function view(actor:ShopifyProbeActor,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env):Promise<UnifiedWorkspace>{
    const config=assertUnifiedRuntime(actor,env);
    const result=await db.rpc("read_shopify_unified_workspace",{p_tenant_id:actor.tenantId,p_actor_id:actor.userId,p_domain:config.shopDomain,p_app_ref:config.clientId}).abortSignal(signal);
    if(result.error)fail(result.error.message);
    return {...unifiedWorkspaceSchema.parse(result.data),workerConfigured:workerConfigured(env)};
  }
  return {view,
    async execute(actor:ShopifyProbeActor,input:unknown,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env):Promise<UnifiedActionState>{
      const config=assertUnifiedRuntime(actor,env),command=unifiedCommandSchema.parse(input),state=await view(actor,signal,env),c=state.connection;
      if(!c)throw new ShopifyIntegrationError("CONNECTION_UNAVAILABLE");
      if(command.action==="automatic"&&command.enabled&&!workerConfigured(env))
        throw new ShopifyIntegrationError("WEBHOOK_SETUP_REQUIRED");
      if((command.action==="enable"||command.action==="import"||command.action==="process")&&
        !workerConfigured(env)&&command.manualCleanupAcknowledged!==true)
        throw new ShopifyIntegrationError("MANUAL_CLEANUP_REQUIRED");
      const args={p_tenant_id:actor.tenantId,p_connection_id:c.id,p_actor_id:actor.userId,p_domain:config.shopDomain,p_app_ref:config.clientId};
      if(command.action==="enable"){
        const proof=await createShopifyApplicationSource(transport,now)(actor,null,signal,env);
        if(proof.shopGid!==c.shopGid)throw new ShopifyIntegrationError("ACCESS_DENIED");
        const result=await db.rpc("enable_shopify_unified_imports",{...args,p_request_key:command.requestKey,p_expected_revision:c.revision,p_consent:command.consent}).abortSignal(signal);
        if(result.error)fail(result.error.message);
        const latest=await view(actor,signal,env);
        return {status:"success",message:"Connection verified. Choose a date range to import. Automatic sync is a separate step below.",view:latest,
          continueProcessing:(latest.connection?.pending??0)>0};
      }
      if(!c.unified)throw new ShopifyIntegrationError("ACCESS_DENIED");
      if(command.action==="cleanup"){
        const result=await db.rpc("purge_expired_shopify_raw",{p_tenant_id:actor.tenantId,p_connection_id:c.id,
          p_shop_domain:config.shopDomain,p_app_ref:config.clientId,p_limit:100}).abortSignal(signal);
        if(result.error)fail(result.error.message);
        const receipt=z.object({redactedCount:z.number().int().min(0).max(100),hasMore:z.boolean()}).strict().parse(result.data);
        return {status:"success",message:`Removed ${receipt.redactedCount} expired raw payloads. Imported orders and customers are unchanged. ${receipt.hasMore?"More expired payloads remain; run cleanup again.":"No more expired payloads remain. Payloads less than 24 hours old are not removed."}`,view:state};
      }
      if(command.action==="preview"){
        const result=await previewSource(actor,{connectionId:c.id,shopGid:c.shopGid},{from:command.from,through:command.through},signal,env);
        let saved:{previewId:string;expiresAt:string}|null=null;
        if(result.complete){
          const persisted=await db.rpc("save_shopify_import_preview",{...args,p_request_key:command.requestKey,p_start:result.window.start,p_end:result.window.endExclusive,p_rows:result.rows}).abortSignal(signal);
          if(persisted.error)fail(persisted.error.message);
          saved=z.object({previewId:z.string().uuid(),expiresAt:z.string().datetime({offset:true})}).strict().parse(persisted.data);
        }
        return {status:"success",message:result.complete?"Preview ready. Only new orders will be imported; matching references are left unchanged.":"This range has more than 2,000 orders. Choose a smaller range; nothing has been imported.",
          preview:{previewId:saved?.previewId??null,expiresAt:saved?.expiresAt??null,complete:result.complete,from:command.from,through:command.through,
            rows:result.rows.map(row=>({orderGid:row.orderGid,reference:row.reference,amount:row.amount,currency:row.currency,financialStatus:row.financialStatus,status:row.status,orderIds:row.orderIds}))},view:state};
      }
      if(command.action==="import"){
        const result=await db.rpc("commit_shopify_import_preview",{...args,p_preview_id:command.previewId,p_request_key:command.requestKey}).abortSignal(signal);
        if(result.error)fail(result.error.message);
        const receipt=unifiedImportReceiptSchema.parse(result.data);
        return {status:"success",message:"Import accepted. Orders will appear in the normal Orders table as drafts. Existing matches were not changed.",receipt,
          view:await view(actor,signal,env),continueProcessing:receipt.rows.some(x=>x.status==="queued"||x.status==="already_queued")};
      }
      if(command.action==="process"){
        const result=await runShopifyUnifiedWorker(db,c.id,signal,env,transport),latest=await view(actor,signal,env);
        return {status:"success",message:result.status==="draft"||result.status==="observed"?"Order synced. You can open it in Orders.":
          result.status==="idle"?"No import is ready to process now. Any waiting retries are still retained.":"An import needs a retry or review. No duplicate order was created.",
          view:latest,continueProcessing:(result.status==="draft"||result.status==="observed")&&(latest.connection?.pending??0)>0};
      }
      let verifiedAt:string|null=null;
      if(command.enabled){
        const check=async()=>{const fresh=(await view(actor,signal,env)).connection;
          if(!fresh||fresh.id!==c.id||!fresh.unified||fresh.status!=="verified")throw new ShopifyIntegrationError("ACCESS_DENIED");
          return {connectionId:fresh.id,shopGid:fresh.shopGid,revision:fresh.revision,pilotOrderGid:fresh.pilotOrderGid};};
        const proof=await registerShopifyUnifiedWebhooks(actor,await check(),check,signal,env,transport,now);verifiedAt=proof.verifiedAt;
      }
      const result=await db.rpc("set_shopify_unified_automatic",{...args,p_request_key:command.requestKey,p_enabled:command.enabled,p_verified_at:verifiedAt}).abortSignal(signal);
      if(result.error)fail(result.error.message);
      return {status:"success",message:command.enabled?"Automatic Shopify sync is enabled for Phantom Threads Test only.":"Automatic sync is off. Existing orders are unchanged.",view:await view(actor,signal,env)};
    },
  };
}
