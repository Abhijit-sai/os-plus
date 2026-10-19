import "server-only";
import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "../../types/database.ts";
import {assertShopifyApplicationStage} from "./application-config.ts";
import {canonicalShopDomain} from "./config.ts";
import {readShopifyWorkerContext} from "./worker-context.ts";
import {createShopifyPilotCredentialReader} from "./pilot-credentials.ts";
import {createShopifyQueueStore} from "./queue-store.ts";
import {createShopifyDraftStore} from "./draft-store.ts";
import {createShopifyDraftExecutor} from "./draft-executor.ts";
import {createShopifyOrderHydrator} from "./order-hydration.ts";
import {ShopifyIntegrationError} from "./errors.ts";

export async function readUnifiedPolicy(db:Pick<SupabaseClient<Database>,"rpc">,connectionId:string,signal:AbortSignal,env:NodeJS.ProcessEnv){
  if(env.VERCEL_ENV!=="production"||env.SHOPIFY_DEPLOYMENT_ENV!=="production"||env.SHOPIFY_PILOT_OPERATIONS_ENABLED!=="true")throw new ShopifyIntegrationError("ACCESS_DENIED");
  const result=await db.rpc("read_shopify_unified_policy",{p_tenant_id:z.string().uuid().parse(env.SHOPIFY_CONNECTION_TEST_TENANT_ID),
    p_connection_id:z.string().uuid().parse(connectionId),p_domain:canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??""),
    p_app_ref:z.string().min(1).max(256).parse(env.SHOPIFY_CLIENT_ID)}).abortSignal(signal);
  if(result.error)throw new ShopifyIntegrationError("ACCESS_DENIED");
  if(result.data===null)return null;
  const policy=z.object({connectionId:z.string().uuid(),automaticEnabled:z.boolean()}).strict().parse(result.data);
  if(policy.connectionId!==connectionId)throw new ShopifyIntegrationError("ACCESS_DENIED");return policy;
}
export async function runShopifyUnifiedWorker(db:SupabaseClient<Database>,connectionId:string,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env,transport:typeof fetch=fetch){
  assertShopifyApplicationStage("worker",env);
  if(env.SHOPIFY_UNIFIED_ORDERS_ENABLED!=="true"||env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED!=="true"||!await readUnifiedPolicy(db,connectionId,signal,env))throw new ShopifyIntegrationError("ACCESS_DENIED");
  const context=await readShopifyWorkerContext(db,{tenantId:z.string().uuid().parse(env.SHOPIFY_CONNECTION_TEST_TENANT_ID),connectionId,
    appRef:z.string().min(1).parse(env.SHOPIFY_CLIENT_ID),environment:"production"},signal);
  if(context.shopDomain!==canonicalShopDomain(env.SHOPIFY_SHOP_DOMAIN??""))throw new ShopifyIntegrationError("ACCESS_DENIED");
  const credentials=createShopifyPilotCredentialReader(transport),hydrate=createShopifyOrderHydrator(transport,Date.now,30000);
  return createShopifyDraftExecutor({queue:createShopifyQueueStore(db),drafts:createShopifyDraftStore(db,{retainBusinessDetails:true}),
    readCredential:(ctx,s)=>credentials(ctx,s,env),
    async resolveContext(ctx,lease,s){
      const result=await db.rpc("shopify_authorized_cutoff",{p_tenant:ctx.tenantId,p_connection:ctx.connectionId,p_order_gid:lease.orderGid,p_default:ctx.importCreatedAtCutoff}).abortSignal(s);
      if(result.error)throw new ShopifyIntegrationError("ACCESS_DENIED");
      return {...ctx,importCreatedAtCutoff:z.string().datetime({offset:true}).parse(result.data)};
    },
    async hydrate(...args){const result=await hydrate(...args);
      // Do not create reference-less placeholders before duplicate matching is
      // possible. Incomplete source stays a visible retryable import job.
      if(result.status==="review")throw new ShopifyIntegrationError("GRAPHQL_INCOMPLETE");return result;
    },
  },Date.now,38000)(context,env,signal);
}
