// Client-safe commands contain owner choices only, never tenant authority,
// credentials, source money/quantity, SQL, GraphQL or verification attestations.
import { z } from "zod";
const id=z.string().uuid(),version=z.number().int().positive().safe();
export const applicationOrderGid=z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/);
const reason=z.string().trim().min(3).max(1000);
const scope={requestKey:id,connectionId:id};
export const shopifyApplicationCommandSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("connect"),requestKey:id,cutoff:z.string().datetime({offset:true})}).strict(),
  z.object({action:z.literal("authorize_copy"),...scope,expectedRevision:version,orderGid:applicationOrderGid,
    retentionDays:z.number().int().min(1).max(7),reason,consent:z.literal(true)}).strict(),
  z.object({action:z.literal("queue_order"),...scope}).strict(),
  z.object({action:z.literal("run_worker"),...scope}).strict(),
  z.object({action:z.literal("register_webhooks"),...scope}).strict(),
  z.object({action:z.literal("test_webhook"),...scope}).strict(),
  z.object({action:z.literal("purge_expired_source"),...scope}).strict(),
  z.object({action:z.literal("connection_state"),...scope,expectedRevision:version,state:z.enum(["pause","resume","disconnect"])}).strict(),
  z.object({action:z.literal("retry_job"),...scope,jobId:id,reason}).strict(),
  z.object({action:z.literal("save_mapping"),...scope,input:z.unknown()}).strict(),
  z.object({action:z.literal("save_review"),...scope,sourceOrderId:id,sourceRevisionId:id,
    expectedVersion:z.number().int().nonnegative().safe(),decision:z.unknown()}).strict(),
  z.object({action:z.literal("release"),...scope,sourceOrderId:id,reviewId:id}).strict(),
  z.object({action:z.literal("resolve_customer"),...scope,sourceOrderId:id,sourceRevisionId:id,customerId:id,reason}).strict(),
  z.object({action:z.literal("review_change"),...scope,sourceOrderId:id,caseId:id,
    decision:z.enum(["keep_on_hold","keep_os_plus_continue"]),reason}).strict(),
  z.object({action:z.literal("redact_source"),...scope,privacyRequestId:id}).strict(),
  z.object({action:z.literal("privacy_note"),...scope,privacyRequestId:id,reason,
    disposition:z.enum(["under_review","external_followup","business_retention_review"])}).strict(),
]);
export type ShopifyApplicationCommand=z.infer<typeof shopifyApplicationCommandSchema>;
export type ShopifyApplicationActionState={status:"idle"|"success"|"error";message:string;requestKey?:string;orderId?:string};
