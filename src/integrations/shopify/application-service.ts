import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database,Json } from "../../types/database.ts";
import { getShopifyApplicationConfig,assertShopifyApplicationStage } from "./application-config.ts";
import { shopifyApplicationCommandSchema } from "./application-contract.ts";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import { shopifyApplicationDataSchema,projectShopifyApplication } from "./application-view.ts";
import { createShopifyMappingStore } from "./mapping-store.ts";
import { shopifyMappingCommandSchema } from "./mapping.ts";
import { createShopifyReleaseStore } from "./release-store.ts";
import { shopifyReviewDecisionSchema,prepareShopifyRelease,verifyShopifyReleaseSource } from "./release-preparation.ts";
import { readShopifyWorkerContext } from "./worker-context.ts";
import { createShopifyPilotCredentialReader } from "./pilot-credentials.ts";
import { sealShopifySource } from "./source-crypto.ts";
import type { createShopifyApplicationSource } from "./application-source.ts";
import { registerShopifyPilotWebhooks } from "./webhook-registration.ts";
import { testShopifyWebhookDelivery } from "./webhook-test.ts";

type Db=Pick<SupabaseClient<Database>,"rpc"|"from">;
type Worker=(connectionId:string,signal:AbortSignal,env:NodeJS.ProcessEnv)=>Promise<{status:string;orderId?:string}>;
const knownErrors={SHOPIFY_ACCESS_DENIED:"ACCESS_DENIED",SHOPIFY_STALE_REVISION:"STALE_REVISION",SHOPIFY_IDEMPOTENCY_CONFLICT:"IDEMPOTENCY_CONFLICT",
  SHOPIFY_COPY_APPROVAL_REQUIRED:"REVIEW_REQUIRED",SHOPIFY_CONFIGURATION_BUSY:"CONFIGURATION_BUSY",SHOPIFY_PRIVACY_REVIEW:"REVIEW_REQUIRED",
  SHOPIFY_CUSTOMER_INVALID:"REVIEW_REQUIRED",SHOPIFY_DRAFT_LOCKED:"REVIEW_REQUIRED"} as const;
function failure(message?:string):never{
  const known=Object.entries(knownErrors).find(([key])=>key===message);
  throw new ShopifyIntegrationError(known?known[1]:"UPSTREAM_UNAVAILABLE");
}
export function createShopifyApplicationService(db:Db,source:ReturnType<typeof createShopifyApplicationSource>,worker:Worker,transport:typeof fetch=fetch,now=Date.now){
  async function read(actor:ShopifyProbeActor,signal:AbortSignal,env:NodeJS.ProcessEnv,search=""){
    const config=getShopifyApplicationConfig(actor,env,"read");
    const {data,error}=await db.rpc("read_shopify_application",{p_tenant_id:actor.tenantId,p_actor_id:actor.userId,p_domain:config.shopDomain,p_app_ref:config.clientId,p_customer_search:search.slice(0,100)}).abortSignal(signal);
    if(error)failure(error.message);
    const parsed=shopifyApplicationDataSchema.parse(data),c=parsed.connection;
    if(c&&(c.tenant_id!==actor.tenantId||c.app_ref!==config.clientId||c.canonical_domain!==config.shopDomain))throw new ShopifyIntegrationError("ACCESS_DENIED");
    // Commands do not decrypt every source before exact receipt recovery.
    return {config,data:parsed};
  }
  return {
    async view(actor:ShopifyProbeActor,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env,search=""){
      const state=await read(actor,signal,env,search);return projectShopifyApplication(state.data,state.config,env,now());
    },
    async execute(actor:ShopifyProbeActor,input:unknown,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env){
      const config=getShopifyApplicationConfig(actor,env),command=shopifyApplicationCommandSchema.parse(input);
      if(command.action==="connect"){
        const cutoff=Date.parse(command.cutoff);
        if(cutoff>now()||cutoff<now()-7*86400000)throw new ShopifyIntegrationError("REQUEST_INVALID");
        const proof=await source(actor,null,signal,env);
        const result=await db.rpc("register_shopify_connection",{p_tenant_id:actor.tenantId,p_actor_id:actor.userId,p_request_key:command.requestKey,
          p_shop_gid:proof.shopGid,p_domain:config.shopDomain,p_app_ref:config.clientId,p_environment:"production",p_cutoff:command.cutoff}).abortSignal(signal);
        if(result.error)failure(result.error.message);
        return {status:"connected"};
      }
      const {data}=await read(actor,signal,env),connection=data.connection;
      if(!connection||connection.id!==command.connectionId)throw new ShopifyIntegrationError("ACCESS_DENIED");
      const binding={tenantId:actor.tenantId,connectionId:connection.id};
      const send=async(action:string,body:Json)=>{
        const result=await db.rpc("command_shopify_application",{p_tenant_id:actor.tenantId,p_connection_id:connection.id,p_actor_id:actor.userId,
          p_request_key:command.requestKey,p_action:action,p_input:body}).abortSignal(signal);
        if(result.error)failure(result.error.message);return result.data;
      };
      if(command.action==="connection_state"){
        const result=await db.rpc("set_shopify_connection_state",{p_tenant_id:actor.tenantId,p_connection_id:connection.id,p_actor_id:actor.userId,
          p_request_key:command.requestKey,p_expected_revision:command.expectedRevision,p_action:command.state}).abortSignal(signal);
        if(result.error)failure(result.error.message);return {status:command.state};
      }
      if(command.action==="privacy_note"){
        await send(command.action,{privacyRequestId:command.privacyRequestId,reason:command.reason,disposition:command.disposition});return {status:"recorded"};
      }
      if(command.action==="purge_expired_source"){
        const result=await db.rpc("purge_expired_shopify_pilot",{p_tenant_id:actor.tenantId,p_connection_id:connection.id,p_actor_id:actor.userId,p_limit:100}).abortSignal(signal);
        if(result.error)failure(result.error.message);return {status:"source_purge_checked"};
      }
      if(command.action==="redact_source"){
        const request=data.privacy.find(r=>r.id===command.privacyRequestId);
        if(!request||request.topic==="customers/data_request")throw new ShopifyIntegrationError("REQUEST_INVALID");
        const result=await db.rpc("redact_shopify_source",{p_tenant_id:actor.tenantId,p_connection_id:connection.id,p_actor_id:actor.userId,
          p_request_id:request.id,p_request_key:command.requestKey,p_limit:100}).abortSignal(signal);
        if(result.error)failure(result.error.message);return {status:"source_redacted_business_review_required"};
      }
      if(command.action==="authorize_copy"){
        assertShopifyApplicationStage("copy",env);
        // Validate encryption provisioning before reading protected source data.
        const packet=sealShopifySource("configuration-check","configuration-check",env);
        const proof=await source(actor,command.orderGid,signal,env);
        if(!proof.sourceCreatedAt)throw new ShopifyIntegrationError("RESPONSE_INVALID");
        await send(command.action,{orderGid:command.orderGid,retentionDays:command.retentionDays,reason:command.reason,consent:true,
          expectedRevision:command.expectedRevision,...proof,keyId:packet.keyId,enableRelease:env.SHOPIFY_RELEASE_ENABLED==="true"});
        return {status:"authorized"};
      }
      if(command.action==="release"){
        // This read is safe even after pause/privacy/configuration changes. Only
        // the exact original owner/key/source/review receipt can be returned.
        const receipt=await db.rpc("recover_shopify_application_release",{p_tenant_id:actor.tenantId,p_connection_id:connection.id,p_actor_id:actor.userId,
          p_request_key:command.requestKey,p_source_order_id:command.sourceOrderId,p_review_id:command.reviewId}).abortSignal(signal);
        if(receipt.error)failure(receipt.error.message);
        if(receipt.data){const saved=z.object({status:z.literal("released"),orderId:z.string().uuid()}).parse(receipt.data);return saved;}
      }
      // Every non-receipt source operation requires a live, named-copy policy.
      if(!data.policy||data.policy.connection_id!==connection.id||Date.parse(data.policy.expires_at)<=now())throw new ShopifyIntegrationError("REVIEW_REQUIRED");
      if(command.action==="register_webhooks"||command.action==="test_webhook"){
        const checkBinding=async()=>{
          const fresh=await read(actor,signal,env),c=fresh.data.connection,p=fresh.data.policy;
          if(!c||c.id!==connection.id||c.status!=="verified"||!c.processing_enabled||!p||
            p.tenant_id!==actor.tenantId||p.connection_id!==c.id||Date.parse(p.expires_at)<=now()||
            !/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/.test(p.order_gid))throw new ShopifyIntegrationError("REVIEW_REQUIRED");
          const context=await readShopifyWorkerContext(db,{...binding,appRef:config.clientId,environment:"production"},signal);
          if(context.shopGid!==c.shop_gid||context.shopDomain!==config.shopDomain)throw new ShopifyIntegrationError("ACCESS_DENIED");
          return {connectionId:c.id,shopGid:c.shop_gid,orderGid:p.order_gid,expiresAt:p.expires_at};
        };
        const expected=await checkBinding();
        const result=await registerShopifyPilotWebhooks(actor,expected,checkBinding,signal,env,transport,now,command.action==="register_webhooks");
        if(command.action==="register_webhooks")return result;
        return testShopifyWebhookDelivery(actor,expected.orderGid,command.requestKey,async()=>{
          if(JSON.stringify(await checkBinding())!==JSON.stringify(expected))throw new ShopifyIntegrationError("REVIEW_REQUIRED");
        },signal,env,transport,now);
      }
      if(command.action==="queue_order"){
        assertShopifyApplicationStage("copy",env);await send(command.action,{});return {status:"queued"};
      }
      if(command.action==="run_worker"){
        assertShopifyApplicationStage("worker",env);return worker(connection.id,signal,env);
      }
      if(command.action==="retry_job"){
        await send(command.action,{jobId:command.jobId,reason:command.reason});return {status:"queued"};
      }
      if(command.action==="save_mapping"){
        await createShopifyMappingStore(db).save(binding,actor.userId,command.requestKey,shopifyMappingCommandSchema.parse(command.input),signal);return {status:"mapping_saved"};
      }
      const selected=data.sources.find(row=>row.source.id===command.sourceOrderId);
      if(!selected||selected.source.order_gid!==data.policy.order_gid)throw new ShopifyIntegrationError("ACCESS_DENIED");
      if(command.action==="resolve_customer"){
        await send(command.action,{sourceOrderId:command.sourceOrderId,sourceRevisionId:command.sourceRevisionId,customerId:command.customerId,reason:command.reason});return {status:"customer_resolved"};
      }
      if(command.action==="save_review"){
        await createShopifyReleaseStore(db).saveReview(binding,actor.userId,command.requestKey,command.sourceOrderId,command.sourceRevisionId,command.expectedVersion,
          shopifyReviewDecisionSchema.parse(command.decision),signal);return {status:"review_saved"};
      }
      if(command.action==="review_change"){
        const state=selected.state;if(!state||state.latest_case_id!==command.caseId)throw new ShopifyIntegrationError("STALE_REVISION");
        const result=await db.rpc("review_shopify_change",{p_tenant_id:actor.tenantId,p_connection_id:connection.id,p_actor_id:actor.userId,p_request_key:command.requestKey,
          p_source_order_id:command.sourceOrderId,p_case_id:command.caseId,p_observed_revision_id:state.latest_revision_id,p_accepted_revision_id:state.accepted_revision_id,p_action:command.decision,p_reason:command.reason}).abortSignal(signal);
        if(result.error)failure(result.error.message);return {status:command.decision};
      }
      assertShopifyApplicationStage("release",env);
      const review=selected.review,revision=selected.revision;
      if(!review||review.id!==command.reviewId||review.source_revision_id!==revision.id||revision.completeness!=="complete")throw new ShopifyIntegrationError("STALE_REVISION");
      const context=await readShopifyWorkerContext(db,{...binding,appRef:config.clientId,environment:"production"},signal);
      const row={id:revision.id,...binding,sourceOrderId:selected.source.id,sourceOrderGid:selected.source.order_gid,shopGid:context.shopGid,
        sourceDigest:revision.source_digest,sourceUpdatedAt:revision.source_updated_at,completeness:"complete" as const,sealedSource:revision.sealed_source};
      const token=await createShopifyPilotCredentialReader(transport,now)(context,signal,env);
      const proof=await verifyShopifyReleaseSource(context,row,token.accessToken,signal,env,transport,now);
      return createShopifyReleaseStore(db).release(binding,actor.userId,command.requestKey,selected.source.id,review.id,
        prepareShopifyRelease(row,context,review.decision,data.mappings,proof,env,now()),signal);
    },
  };
}
