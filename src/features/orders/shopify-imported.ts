import "server-only";
import { z } from "zod";
import { requireTenantContext } from "@/lib/tenant/context";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { importedShopifyOrdersVisible, projectImportedShopifyOrderSafely, type ImportedShopifyOrder } from "@/integrations/shopify/imported-order";
import { readShopifyDraftPreviews } from "@/integrations/shopify/imported-previews";
import type { ShopifyDraftSetupView } from "@/integrations/shopify/draft-setup";
import { canonicalShopDomain } from "@/integrations/shopify/config";
import { readShopifyCommercialDetails } from "@/integrations/shopify/commercial-order";

export async function getRetainedShopifyBusinessOrder(orderId:string){
  const context=await requireTenantContext();
  if(!importedShopifyOrdersVisible(context.tenant.id,context.membership.role)||!z.string().uuid().safeParse(orderId).success)return null;
  const result=await createSupabaseServiceRoleClient().rpc("read_shopify_retained_business_order",{
    p_tenant_id:context.tenant.id,p_actor_id:context.membership.clerk_user_id,p_order_id:orderId,
    p_domain:canonicalShopDomain(process.env.SHOPIFY_SHOP_DOMAIN??""),p_app_ref:z.string().min(1).max(256).parse(process.env.SHOPIFY_CLIENT_ID),
  }).abortSignal(AbortSignal.timeout(5000));
  if(result.error)throw new Error("Unable to load Shopify order details. Please retry.");
  return result.data?readShopifyCommercialDetails(result.data,{tenantId:context.tenant.id,orderId}):null;
}

export async function getImportedShopifyOrders(orderId?: string, search?: string) {
  const context = await requireTenantContext();
  // Other tenants/roles never invoke the privileged reader. DB rechecks active
  // membership as well; the browser cannot supply tenant or app authority.
  if (!importedShopifyOrdersVisible(context.tenant.id, context.membership.role)) return [];
  if (orderId && !z.string().uuid().safeParse(orderId).success) return [];
  const db = createSupabaseServiceRoleClient();
  const scope = {
    p_tenant_id: context.tenant.id, p_actor_id: context.membership.clerk_user_id,
    p_domain: canonicalShopDomain(process.env.SHOPIFY_SHOP_DOMAIN ?? ""),
    p_app_ref: z.string().min(1).max(256).parse(process.env.SHOPIFY_CLIENT_ID),
  };
  if (orderId) {
    const retained = await db.rpc("read_shopify_retained_order", { ...scope, p_order_id: orderId }).abortSignal(AbortSignal.timeout(5000));
    if (retained.error) throw new Error("Unable to load imported order. Please retry.");
    if (retained.data) return [readShopifyCommercialDetails(retained.data, { tenantId: context.tenant.id, orderId })];
  }
  const { data, error } = await db.rpc("read_shopify_imported_orders", {
    ...scope,
    p_order_id: orderId ?? null, p_search: search?.trim().slice(0, 100) || null,
  }).abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error("Unable to load imported orders. Please retry.");
  return z.array(z.unknown()).max(50).parse(data).map(row => projectImportedShopifyOrderSafely(row, context.tenant.id));
}

// Called only with the same request's permission-checked manager view. The
// retained import has its own expiry; the old pilot reader is not applicable.
export async function getShopifyDraftPreviews(order:ImportedShopifyOrder,view:ShopifyDraftSetupView) {
  const context=await requireTenantContext();
  if(!importedShopifyOrdersVisible(context.tenant.id,context.membership.role)||view.tenantId!==context.tenant.id)return order;
  return readShopifyDraftPreviews(createSupabaseServiceRoleClient(),order,view,AbortSignal.timeout(4000));
}
