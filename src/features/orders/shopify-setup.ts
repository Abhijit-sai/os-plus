import "server-only";
import { getShopifyProbeActor } from "@/integrations/shopify/probe-actor";
import { importedShopifyOrdersVisible } from "@/integrations/shopify/imported-order";
import { createShopifyManagerService } from "@/integrations/shopify/manager-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function getShopifyManagerSetup(orderId:string){
  const actor=await getShopifyProbeActor();
  if(!actor||!importedShopifyOrdersVisible(actor.tenantId,actor.role))return null;
  return createShopifyManagerService(createSupabaseServiceRoleClient()).view(actor,orderId,AbortSignal.timeout(6000));
}
