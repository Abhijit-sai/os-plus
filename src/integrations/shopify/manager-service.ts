import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { getShopifyManagerConfig } from "./application-config.ts";
import { shopifySaveDraftSetupSchema, shopifyCompleteDraftSetupSchema, shopifyDraftSetupViewSchema } from "./draft-setup.ts";
import { readShopifyWorkerContext } from "./worker-context.ts";
import { createShopifyPilotCredentialReader } from "./pilot-credentials.ts";
import { readShopifyHydrationGraphQL } from "./client.ts";
import { shopifyTimestampInstant } from "./order-hydration.ts";
import { ShopifyIntegrationError } from "./errors.ts";

const completed = z.object({status:z.literal("setup_complete"),orderId:z.string().uuid(),
  sourceRevisionId:z.string().uuid(),itemCount:z.number().int().positive()}).strict();
const failures:Record<string,"ACCESS_DENIED"|"STALE_REVISION"|"IDEMPOTENCY_CONFLICT"|"REVIEW_REQUIRED"|"CONFIGURATION_BUSY"> = {
  SHOPIFY_ACCESS_DENIED:"ACCESS_DENIED",SHOPIFY_STALE_REVISION:"STALE_REVISION",SHOPIFY_IDEMPOTENCY_CONFLICT:"IDEMPOTENCY_CONFLICT",
  SHOPIFY_SOURCE_REVIEW:"REVIEW_REQUIRED",SHOPIFY_SETUP_INCOMPLETE:"REVIEW_REQUIRED",SHOPIFY_CONFIGURATION_INVALID:"REVIEW_REQUIRED",
  SHOPIFY_CUSTOMER_INVALID:"REVIEW_REQUIRED",SHOPIFY_DRAFT_LOCKED:"REVIEW_REQUIRED",SHOPIFY_PRIVACY_REVIEW:"REVIEW_REQUIRED",
  SHOPIFY_CONFIGURATION_BUSY:"CONFIGURATION_BUSY",
};
function fail(message:string):never { throw new ShopifyIntegrationError(failures[message]??"UPSTREAM_UNAVAILABLE"); }
export const shopifySetupSearchSchema = z.object({orderId:z.string().uuid(),kind:z.enum(["customers","itemTypes","workflows","sizes"]),
  search:z.string().trim().max(100),offset:z.number().int().min(0).max(10000)}).strict();
export const shopifySetupOptionsSchema = z.object({rows:z.array(z.object({id:z.string().uuid(),name:z.string(),itemTypeId:z.string().uuid().nullable()}).strict()).max(50),hasMore:z.boolean()}).strict();

export function createShopifyManagerService(db:Pick<SupabaseClient<Database>,"rpc"|"from">,transport:typeof fetch=fetch,now=Date.now){
  const credentials=createShopifyPilotCredentialReader(transport,now);
  const scope=(actor:ShopifyProbeActor,env:NodeJS.ProcessEnv,mode:"read"|"operate"="operate")=>{
    const config=getShopifyManagerConfig(actor,env,mode);
    return {p_tenant_id:actor.tenantId,p_actor_id:actor.userId,p_domain:config.shopDomain,p_app_ref:config.clientId};
  };
  async function view(actor:ShopifyProbeActor,orderId:string,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env){
    const args=scope(actor,env,"read");z.string().uuid().parse(orderId);
    const result=await db.rpc("read_shopify_manager_draft_setup",{...args,p_order_id:orderId}).abortSignal(signal);
    if(result.error)fail(result.error.message);
    if(result.data===null)return null;
    const value=shopifyDraftSetupViewSchema.parse(result.data);
    if(value.tenantId!==actor.tenantId||value.orderId!==orderId)throw new ShopifyIntegrationError("ACCESS_DENIED");
    return value;
  }
  return {view,
    async search(actor:ShopifyProbeActor,input:unknown,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env){
      const args=scope(actor,env,"read"),command=shopifySetupSearchSchema.parse(input);
      const result=await db.rpc("search_shopify_setup_options",{...args,p_order_id:command.orderId,p_kind:command.kind,p_search:command.search,p_offset:command.offset}).abortSignal(signal);
      if(result.error)fail(result.error.message);
      return shopifySetupOptionsSchema.parse(result.data);
    },
    async save(actor:ShopifyProbeActor,input:unknown,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env){
      const args=scope(actor,env),command=shopifySaveDraftSetupSchema.parse(input);
      const state=await view(actor,command.orderId,signal,env);
      if(!state)throw new ShopifyIntegrationError("ACCESS_DENIED");
      // Do not pre-reject old versions: the SQL command first recovers an exact
      // successful save receipt, then fences any new intent against latest state.
      const result=await db.rpc("save_shopify_manager_draft_setup",{...args,p_connection_id:state.connectionId,
        p_order_id:command.orderId,p_source_revision_id:command.sourceRevisionId,p_expected_version:command.expectedVersion,
        p_request_key:command.requestKey,p_choices:command.choices}).abortSignal(signal);
      if(result.error)fail(result.error.message);
      return z.object({setupId:z.string().uuid(),version:z.number().int().positive().safe()}).strict().parse(result.data);
    },
    async complete(actor:ShopifyProbeActor,input:unknown,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env){
      const args=scope(actor,env),command=shopifyCompleteDraftSetupSchema.parse(input);
      const intent={...args,p_connection_id:command.connectionId,p_order_id:command.orderId,p_setup_id:command.setupId,p_request_key:command.requestKey};
      const recovered=await db.rpc("recover_shopify_manager_setup",intent).abortSignal(signal);
      if(recovered.error)fail(recovered.error.message);
      if(recovered.data!==null){const receipt=completed.parse(recovered.data);
        if(receipt.orderId!==command.orderId)throw new ShopifyIntegrationError("ACCESS_DENIED");return receipt;}
      const state=await view(actor,command.orderId,signal,env);
      if(!state||state.connectionId!==command.connectionId)throw new ShopifyIntegrationError("ACCESS_DENIED");
      if(!state.current||state.setupId!==command.setupId)throw new ShopifyIntegrationError("STALE_REVISION");
      const context=await readShopifyWorkerContext(db,{tenantId:actor.tenantId,connectionId:state.connectionId,appRef:args.p_app_ref,environment:"production"},signal);
      if(context.shopDomain!==args.p_domain||context.shopGid!==state.shopGid)throw new ShopifyIntegrationError("ACCESS_DENIED");
      const token=await credentials(context,signal,env);
      const proof=await readShopifyHydrationGraphQL({shopDomain:context.shopDomain,connectionEnvironment:"production",accessToken:token.accessToken,
        query:`query OSPlusManagerFreshness($id: ID!) { shop { id myshopifyDomain } order(id: $id) { id updatedAt } }`,variables:{id:state.sourceOrderGid},
        schema:z.object({shop:z.object({id:z.string(),myshopifyDomain:z.string()}),order:z.object({id:z.string(),updatedAt:z.string().datetime({offset:true})}).nullable()}),
        signal,timeoutMs:10000},context,transport,env);
      if(proof.data.shop.id!==state.shopGid||proof.data.shop.myshopifyDomain!==args.p_domain||!proof.data.order||proof.data.order.id!==state.sourceOrderGid)
        throw new ShopifyIntegrationError("SOURCE_UNAVAILABLE");
      if(shopifyTimestampInstant(proof.data.order.updatedAt)!==shopifyTimestampInstant(state.sourceUpdatedAt))throw new ShopifyIntegrationError("SOURCE_CHANGED");
      const result=await db.rpc("complete_shopify_manager_setup",{...intent,p_connection_revision:context.revision,
        p_source_updated_at:proof.data.order.updatedAt,p_verified_at:new Date(now()).toISOString()}).abortSignal(signal);
      if(result.error)fail(result.error.message);
      const receipt=completed.parse(result.data);
      if(receipt.orderId!==command.orderId)throw new ShopifyIntegrationError("ACCESS_DENIED");
      return receipt;
    },
  };
}
