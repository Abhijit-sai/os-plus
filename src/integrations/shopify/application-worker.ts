import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import { assertShopifyApplicationStage } from "./application-config.ts";
import { canonicalShopDomain } from "./config.ts";
import { readShopifyWorkerContext } from "./worker-context.ts";
import { createShopifyPilotCredentialReader } from "./pilot-credentials.ts";
import { createShopifyQueueStore } from "./queue-store.ts";
import { createShopifyDraftStore } from "./draft-store.ts";
import { createShopifyDraftExecutor } from "./draft-executor.ts";
import { createShopifyOrderHydrator } from "./order-hydration.ts";
import { readShopifyHydrationGraphQL } from "./client.ts";
import { ShopifyIntegrationError } from "./errors.ts";

export async function runShopifyPilotWorker(db:SupabaseClient<Database>,connectionId:string,signal:AbortSignal,
  env:NodeJS.ProcessEnv=process.env,reconcile=false,transport:typeof fetch=fetch){
  assertShopifyApplicationStage("worker",env);
  if(env.SHOPIFY_PILOT_OPERATIONS_ENABLED!=="true")throw new ShopifyIntegrationError("ACCESS_DENIED");
  const binding={tenantId:z.string().uuid().parse(env.SHOPIFY_CONNECTION_TEST_TENANT_ID),connectionId:z.string().uuid().parse(connectionId),
    appRef:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).parse(env.SHOPIFY_CLIENT_ID),environment:"production" as const};
  const {data,error}=await db.rpc("shopify_pilot_policy",{p_tenant_id:binding.tenantId,p_connection_id:binding.connectionId}).abortSignal(signal);
  const policy=z.object({tenant_id:z.string().uuid(),connection_id:z.string().uuid(),order_gid:z.string(),expires_at:z.string().datetime({offset:true})}).safeParse(data);
  if(error||!policy.success||policy.data.tenant_id!==binding.tenantId||policy.data.connection_id!==binding.connectionId||Date.parse(policy.data.expires_at)<=Date.now())
    throw new ShopifyIntegrationError("ACCESS_DENIED");
  const context=await readShopifyWorkerContext(db,binding,signal);
  if(context.shopDomain!==canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??""))throw new ShopifyIntegrationError("ACCESS_DENIED");
  const credentials=createShopifyPilotCredentialReader(transport);
  if(reconcile){
    const token=await credentials(context,signal,env);
    const response=await readShopifyHydrationGraphQL({shopDomain:context.shopDomain,connectionEnvironment:"production",accessToken:token.accessToken,
      query:`query OSPlusPilotWatermark($id: ID!) { shop { id myshopifyDomain } order(id: $id) { id updatedAt } }`,variables:{id:policy.data.order_gid},
      schema:z.object({shop:z.object({id:z.string(),myshopifyDomain:z.string()}),order:z.object({id:z.string(),updatedAt:z.string().datetime({offset:true})}).nullable()}),signal,timeoutMs:5000},context,transport,env);
    if(response.data.shop.id!==context.shopGid||response.data.shop.myshopifyDomain!==context.shopDomain||
      (response.data.order&&response.data.order.id!==policy.data.order_gid))throw new ShopifyIntegrationError("ACCESS_DENIED");
    const observed=await db.rpc("observe_shopify_pilot",{p_tenant_id:binding.tenantId,p_connection_id:binding.connectionId,p_updated_at:response.data.order?.updatedAt??null}).abortSignal(signal);
    if(observed.error)throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
  }
  const queue=createShopifyQueueStore(db);
  const guardedQueue={...queue,async claim(...args:Parameters<typeof queue.claim>){
    const leases=await queue.claim(...args);
    if(leases.some(lease=>lease.orderGid!==policy.data.order_gid))throw new ShopifyIntegrationError("ACCESS_DENIED");
    return leases;
  }};
  return createShopifyDraftExecutor({queue:guardedQueue,drafts:createShopifyDraftStore(db),hydrate:createShopifyOrderHydrator(transport,Date.now,30000),
    readCredential:(ctx,s)=>credentials(ctx,s,env)},Date.now,38000)(context,env,signal);
}
