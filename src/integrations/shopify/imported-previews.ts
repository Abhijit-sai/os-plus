import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.ts";
import type { ShopifyDraftSetupView } from "./draft-setup.ts";
import { shopifyTimestampInstant } from "./order-hydration.ts";
import { projectImportedShopifyOrderSafely, withShopifyImageReferences, type ImportedShopifyOrder } from "./imported-order.ts";

// Display-only enrichment AFTER the live membership/store-checked manager read.
// Exact tenant/source/revision filters, and expiry before decryption. No source
// persistence, Shopify fetch, image optimizer, or retention extension.
export async function readShopifyDraftPreviews(db:Pick<SupabaseClient<Database>,"from">,order:ImportedShopifyOrder,
  authorizedView:ShopifyDraftSetupView,signal:AbortSignal,env:NodeJS.ProcessEnv=process.env,clock:()=>number=Date.now):Promise<ImportedShopifyOrder>{
  const view=authorizedView,now=clock();
  if(order.availability!=="available"||view.orderId!==order.id||view.sourceOrderGid!==order.sourceOrderGid||
    shopifyTimestampInstant(view.sourceUpdatedAt)!==shopifyTimestampInstant(order.updatedAt))return order;
  try{
    const retention=await db.from("shopify_commercial_details").select("raw_expires_at")
      .eq("tenant_id",view.tenantId).eq("source_order_id",view.sourceOrderId).eq("revision_id",view.sourceRevisionId)
      .gt("raw_expires_at",new Date(now).toISOString()).abortSignal(signal).maybeSingle();
    if(retention.error||!retention.data)return order;
    const source=await db.from("shopify_source_revisions").select("source_digest,source_updated_at,observed_at,completeness,sealed_source")
      .eq("tenant_id",view.tenantId).eq("source_order_id",view.sourceOrderId).eq("id",view.sourceRevisionId)
      .eq("source_digest",view.sourceDigest).abortSignal(signal).maybeSingle();
    if(source.error||!source.data)return order;
    const row=source.data;
    const temporary=projectImportedShopifyOrderSafely({tenantId:view.tenantId,orderId:view.orderId,number:order.number,
      connectionId:view.connectionId,shopGid:view.shopGid,sourceOrderGid:view.sourceOrderGid,
      sourceDigest:row.source_digest,sourceUpdatedAt:row.source_updated_at,observedAt:row.observed_at,
      completeness:row.completeness,expiresAt:retention.data.raw_expires_at,sealedSource:row.sealed_source},view.tenantId,env,clock());
    return withShopifyImageReferences(order,temporary);
  }catch{
    // Optional previews may fail, expire, be redacted or lose their old key.
    // None of these may hide the retained order or block manager editing.
    return order;
  }
}
