import "server-only";

import { z } from "zod";
import { assertShopifyHydrationContext, type ShopifyHydrationContext } from "./hydration-contract.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { createShopifyQueueStore, shopifyJobLeaseSchema } from "./queue-store.ts";
import { createShopifyDraftStore } from "./draft-store.ts";
import { createShopifyOrderHydrator, type ShopifyHydrationResult } from "./order-hydration.ts";
import { sealShopifySource } from "./source-crypto.ts";

const credential = z.object({
  tenantId:z.string().uuid(),connectionId:z.string().uuid(),shopGid:z.string(),appRef:z.string(),
  environment:z.literal("production"),connectionRevision:z.number().int().positive().safe(),
  expiresAt:z.string().datetime({offset:true}),accessToken:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f]+$/),
}).strict();
type Dependencies = {
  queue: ReturnType<typeof createShopifyQueueStore>;
  drafts: ReturnType<typeof createShopifyDraftStore>;
  hydrate: ReturnType<typeof createShopifyOrderHydrator>;
  readCredential(context:ShopifyHydrationContext,signal:AbortSignal):Promise<z.infer<typeof credential>>;
};
type Outcome = {status:"idle"|"draft"|"observed"|"retry"|"fenced"|"unknown";jobId?:string;orderId?:string};

// Dormant orchestration, not a route or scheduler. Production callers must use
// fresh installed-store DB/credential attestations, never browser input. One
// lease per tick keeps runtime bounded. Domain completion belongs exclusively
// to the atomic importer, never to this worker or an external workflow.
export function createShopifyDraftExecutor(deps:Dependencies,now=Date.now,budgetMs=50_000) {
  if (!Number.isInteger(budgetMs) || budgetMs<1 || budgetMs>50_000) throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
  return async function run(context:ShopifyHydrationContext,env:NodeJS.ProcessEnv=process.env,signal?:AbortSignal):Promise<Outcome> {
    assertShopifyHydrationContext(context,env);
    if (env.SHOPIFY_EXECUTOR_ENABLED!=="true" || env.SHOPIFY_DRAFT_IMPORT_ENABLED!=="true") throw new ShopifyIntegrationError("CONFIGURATION_INVALID");
    // Validate source-key provisioning before touching the queue. No output.
    sealShopifySource("configuration-check","configuration-check",env);
    const binding={tenantId:context.tenantId,connectionId:context.connectionId,appRef:context.appRef,environment:context.environment};
    const controller=new AbortController();
    const externalAbort=()=>controller.abort();
    signal?.addEventListener("abort",externalAbort,{once:true});
    if(signal?.aborted) controller.abort();
    let rejectDeadline:(reason:ShopifyIntegrationError)=>void=()=>{};
    const deadline=new Promise<never>((_,reject)=>{rejectDeadline=reject;});
    const expire=()=>{controller.abort();rejectDeadline(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE"));};
    controller.signal.addEventListener("abort",()=>rejectDeadline(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE")),{once:true});
    const timer=setTimeout(expire,budgetMs);
    const bounded=<T>(operation:()=>Promise<T>)=>{
      if(controller.signal.aborted) throw new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE");
      return Promise.race([Promise.resolve().then(operation),deadline]);
    };
    let lease:z.infer<typeof shopifyJobLeaseSchema>|undefined;
    let source:ShopifyHydrationResult|undefined;
    let partialObservedAt:string|undefined;
    let hydrationStarted=false;
    try {
      const claimed=await bounded(()=>deps.queue.claim(binding,1,controller.signal));
      if(!claimed.length) return {status:"idle"};
      if(claimed.length!==1) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      lease=shopifyJobLeaseSchema.parse(claimed[0]);
      if(lease.tenantId!==context.tenantId || lease.connectionId!==context.connectionId || lease.connectionRevision!==context.revision || Date.parse(lease.leaseExpiresAt)<=now())
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      const token=credential.safeParse(await bounded(()=>deps.readCredential(context,controller.signal)));
      if(!token.success || token.data.tenantId!==context.tenantId || token.data.connectionId!==context.connectionId || token.data.shopGid!==context.shopGid ||
        token.data.appRef!==context.appRef || token.data.connectionRevision!==context.revision || Date.parse(token.data.expiresAt)<=now()+45_000)
        throw new ShopifyIntegrationError("ACCESS_DENIED");
      hydrationStarted=true;
      source=await bounded(()=>deps.hydrate(context,lease!,token.data.accessToken,controller.signal,env));
      if(source.status==="ineligible") throw new ShopifyIntegrationError("REQUEST_INVALID");
      partialObservedAt=source.status==="review"?new Date(now()).toISOString():undefined;
      const input=source;
      const saved=await bounded(()=>input.status==="complete" ? deps.drafts.importSnapshot(input.snapshot,context,lease!,controller.signal,env,now()) :
        deps.drafts.importPartialEnvelope(input,context,lease!,controller.signal,partialObservedAt!,env,now()));
      if(!saved || saved.tenantId!==context.tenantId) throw new ShopifyIntegrationError("RESPONSE_INVALID");
      return {status:saved.status,jobId:lease.jobId,orderId:saved.orderId};
    } catch(error) {
      if(!lease || lease.tenantId!==context.tenantId || lease.connectionId!==context.connectionId) return {status:"unknown"};
      // The failure response can have been lost after domain commit. Recover
      // the exact original intent first; never hydrate anew or complete a job
      // independently. Cleanup has its own bounded budget (<=3 seconds).
      const cleanup=new AbortController();
      let rejectCleanup:(reason:ShopifyIntegrationError)=>void=()=>{};
      const cleanupDeadline=new Promise<never>((_,reject)=>{rejectCleanup=reject;});
      const cleanupTimer=setTimeout(()=>{cleanup.abort();rejectCleanup(new ShopifyIntegrationError("UPSTREAM_UNAVAILABLE"));},3000);
      const clean=<T>(op:()=>Promise<T>)=>Promise.race([Promise.resolve().then(op),cleanupDeadline]);
      try {
        if(source && source.status!=="ineligible") {
          const input=source;
          const recovered=await clean(()=>input.status==="complete" ? deps.drafts.recoverCommittedSnapshot(input.snapshot,context,lease!,cleanup.signal,env,now()) :
            deps.drafts.recoverPartialEnvelope(input,context,lease!,cleanup.signal,partialObservedAt!,env,now()));
          if(recovered && recovered.tenantId===context.tenantId) return {status:recovered.status,jobId:lease.jobId,orderId:recovered.orderId};
        }
        const code=error instanceof ShopifyIntegrationError?error.code:"UPSTREAM_UNAVAILABLE";
        const failure=code==="THROTTLED"?"THROTTLED":["AUTHENTICATION_REQUIRED","SHOP_INACTIVE"].includes(code)?"AUTH_REQUIRED":
          code==="ACCESS_DENIED" && hydrationStarted?"SCOPE_REQUIRED":
          ["ACCESS_DENIED","REQUEST_INVALID","RESPONSE_INVALID","CONFIGURATION_INVALID","UPSTREAM_REJECTED","API_VERSION_MISMATCH","SOURCE_UNAVAILABLE"].includes(code)?"VALIDATION_REQUIRED":"TRANSIENT";
        const delay=failure==="THROTTLED" ? (error instanceof ShopifyIntegrationError?error.retryAfterSeconds??60:60) : null;
        const changed=await clean(()=>deps.queue.update(binding,lease!,"fail",failure,delay,cleanup.signal));
        return {status:changed?"retry":"fenced",jobId:lease.jobId};
      } catch {
        return {status:"unknown",jobId:lease.jobId};
      } finally {clearTimeout(cleanupTimer);cleanup.abort();}
    } finally {
      clearTimeout(timer);controller.abort();signal?.removeEventListener("abort",externalAbort);
    }
  };
}
