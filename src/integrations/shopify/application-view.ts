import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { openShopifySource } from "./source-crypto.ts";
import { parseShopifyOrderSnapshot } from "./order-hydration.ts";
import { normalizeShopifyDraftLines } from "./draft-preparation.ts";
import { projectShopifySourcePayment } from "./source-payment.ts";
import { shopifyMappingSchema } from "./mapping.ts";
import { shopifyReviewDecisionSchema } from "./release-preparation.ts";
import { ShopifyIntegrationError } from "./errors.ts";
import type { ShopifyApplicationConfig } from "./application-config.ts";
const id=z.string().uuid(),time=z.string().datetime({offset:true});
const sourceSchema=z.object({source:z.object({id,tenant_id:id,connection_id:id,shop_gid:z.string(),order_gid:z.string(),order_id:id}),
  revision:z.object({id,tenant_id:id,source_order_id:id,source_digest:z.string().regex(/^[a-f0-9]{64}$/),sealed_source:z.unknown(),
    source_updated_at:time,completeness:z.enum(["partial","complete"]),review_reasons:z.array(z.string()),source_customer_gid:z.string().nullable()}),
  order:z.object({id,customerId:id.nullable(),status:z.string(),number:z.string()}),
  review:z.object({id,version:z.number().int().positive(),source_revision_id:id,decision:shopifyReviewDecisionSchema}).nullable(),
  state:z.object({latest_case_id:id.nullable(),latest_revision_id:id,accepted_revision_id:id,held:z.boolean(),reasons:z.array(z.string())}).nullable()});
const choice=z.object({id,name:z.string()});
export const shopifyApplicationDataSchema=z.object({
  connection:z.object({id,tenant_id:id,canonical_domain:z.string(),shop_gid:z.string(),app_ref:z.string(),environment:z.literal("production"),
    status:z.enum(["pending","verified","paused","disconnected"]),revision:z.number().int().positive(),import_created_at_cutoff:time,
    processing_enabled:z.boolean(),release_enabled:z.boolean()}).nullable(),
  policy:z.object({tenant_id:id,connection_id:id,order_gid:z.string(),expires_at:time,reason:z.string()}).nullable(),
  mappings:z.array(shopifyMappingSchema).max(500),sources:z.array(sourceSchema).max(50),
  jobs:z.array(z.object({id,orderGid:z.string(),requested:z.number(),completed:z.number(),attempts:z.number(),error:z.string().nullable(),deadLetteredAt:time.nullable(),nextAttemptAt:time,leaseExpiresAt:time.nullable()})).max(100),
  privacy:z.array(z.object({id,topic:z.enum(["customers/data_request","customers/redact","shop/redact"]),receivedAt:time,dueAt:time,customerGid:z.string().nullable(),orderGids:z.array(z.string())})).max(100),
  history:z.array(z.object({id,action:z.string(),created_at:time,detail:z.record(z.unknown()),result:z.record(z.unknown())})).max(100),
  itemTypes:z.array(choice).max(500),workflows:z.array(choice.extend({itemTypeId:id.nullable()})).max(500),sizes:z.array(choice.extend({itemTypeId:id})).max(500),customers:z.array(choice).max(101),
});
export type ShopifyApplicationData=z.infer<typeof shopifyApplicationDataSchema>;
// No raw RPC/JSON spread into JSX. In particular sealed_source, access tokens,
// full address/contact, verification proof and lease tokens never leave server.
export function projectShopifyApplication(raw:unknown,config:ShopifyApplicationConfig,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
  const parsed=shopifyApplicationDataSchema.safeParse(raw);
  if(!parsed.success)throw new ShopifyIntegrationError("RESPONSE_INVALID");
  const data=parsed.data,c=data.connection;
  if(c&&(c.tenant_id!==config.tenantId||c.app_ref!==config.clientId||c.canonical_domain!==config.shopDomain))throw new ShopifyIntegrationError("ACCESS_DENIED");
  if(data.policy&&(!c||data.policy.tenant_id!==config.tenantId||data.policy.connection_id!==c.id))throw new ShopifyIntegrationError("ACCESS_DENIED");
  if(data.mappings.some(m=>m.tenant_id!==config.tenantId||m.connection_id!==c?.id))throw new ShopifyIntegrationError("ACCESS_DENIED");
  const policyActive=!!data.policy&&Date.parse(data.policy.expires_at)>now;
  const sources=data.sources.map(row=>{
    const s=row.source,r=row.revision;
    if(!c||s.tenant_id!==config.tenantId||s.connection_id!==c.id||s.shop_gid!==c.shop_gid||r.tenant_id!==config.tenantId||r.source_order_id!==s.id||row.order.id!==s.order_id)
      throw new ShopifyIntegrationError("ACCESS_DENIED");
    const common={id:s.id,orderId:s.order_id,orderGid:s.order_gid,number:row.order.number,orderStatus:row.order.status,customerId:row.order.customerId,
      revisionId:r.id,sourceUpdatedAt:r.source_updated_at,reviewReasons:r.review_reasons,review:row.review?{id:row.review.id,version:row.review.version,
        current:row.review.source_revision_id===r.id,decision:row.review.decision}:null,state:row.state};
    if(!policyActive||r.completeness!=="complete")return {...common,sourceStatus:!policyActive?"expired" as const:"partial" as const,lines:[],payment:null,customerName:null};
    // Redacted packets must remain visibly unavailable, never treated as guest.
    if(!z.object({ciphertext:z.string()}).safeParse(r.sealed_source).success)return {...common,sourceStatus:"redacted" as const,lines:[],payment:null,customerName:null};
    const plaintext=openShopifySource(r.sealed_source,JSON.stringify([s.tenant_id,c.id,s.shop_gid,s.order_gid,r.source_digest]),env);
    if(createHash("sha256").update(plaintext).digest("hex")!==r.source_digest)throw new ShopifyIntegrationError("RESPONSE_INVALID");
    let envelope:unknown;try{envelope=JSON.parse(plaintext);}catch{throw new ShopifyIntegrationError("RESPONSE_INVALID");}
    const value=z.object({kind:z.literal("shopify_draft_input"),schemaVersion:z.literal(1),tenantId:id,connectionId:id,shopGid:z.string(),sourceOrderGid:z.string(),sourceSnapshot:z.unknown()}).parse(envelope);
    if(value.tenantId!==s.tenant_id||value.connectionId!==c.id||value.shopGid!==s.shop_gid||value.sourceOrderGid!==s.order_gid)throw new ShopifyIntegrationError("ACCESS_DENIED");
    const source=parseShopifyOrderSnapshot(value.sourceSnapshot);
    if(source.tenantId!==s.tenant_id||source.connectionId!==c.id||source.shopGid!==s.shop_gid||source.order.id!==s.order_gid||Date.parse(source.order.updatedAt)!==Date.parse(r.source_updated_at))throw new ShopifyIntegrationError("ACCESS_DENIED");
    const normalized=normalizeShopifyDraftLines(source);
    return {...common,sourceStatus:"complete" as const,customerName:[source.order.customer?.firstName,source.order.customer?.lastName].filter(Boolean).join(" ")||null,
      lines:source.lines.map((line,index)=>({id:line.id,title:line.title,variantGid:line.variant?.id??null,sku:normalized.lines[index].originalSku,
        quantity:line.quantity,colour:normalized.lines[index].colour.value,size:normalized.lines[index].size.value})),
      payment:projectShopifySourcePayment(source,row.state?.held??false)};
  });
  return {shopDomain:config.shopDomain,connection:c?{id:c.id,status:c.status,revision:c.revision,processingEnabled:c.processing_enabled,releaseEnabled:c.release_enabled,cutoff:c.import_created_at_cutoff}:null,
    policy:data.policy?{orderGid:data.policy.order_gid,expiresAt:data.policy.expires_at,active:policyActive,reason:data.policy.reason}:null,
    sources,mappings:data.mappings.map(m=>({id:m.id,variantGid:m.variant_gid,sku:m.sku,classification:m.classification,itemTypeId:m.item_type_id,workflowId:m.workflow_id,standardSizeId:m.standard_size_id,isActive:m.is_active,revision:m.revision})),
    jobs:data.jobs.map(job=>({...job,leaseActive:!!job.leaseExpiresAt&&Date.parse(job.leaseExpiresAt)>now})),privacy:data.privacy,history:data.history.map(a=>({id:a.id,action:a.action,at:a.created_at,reason:typeof a.detail.reason==="string"?a.detail.reason:null,
      disposition:typeof a.detail.disposition==="string"?a.detail.disposition:null})),itemTypes:data.itemTypes,workflows:data.workflows,sizes:data.sizes,customers:data.customers.slice(0,100),customersTruncated:data.customers.length>100};
}
export type ShopifyApplicationView=ReturnType<typeof projectShopifyApplication>;
