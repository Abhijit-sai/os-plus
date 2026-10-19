import "server-only";
import { z } from "zod";
import { requireTenantContext } from "@/lib/tenant/context";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { importedShopifyOrdersVisible, projectImportedShopifyOrderSafely } from "@/integrations/shopify/imported-order";
import { canonicalShopDomain } from "@/integrations/shopify/config";

export async function getImportedShopifyOrders(orderId?: string, search?: string) {
  const context = await requireTenantContext();
  // Other tenants/roles never invoke the privileged reader. DB rechecks active
  // membership as well; the browser cannot supply tenant or app authority.
  if (!importedShopifyOrdersVisible(context.tenant.id, context.membership.role)) return [];
  if (orderId && !z.string().uuid().safeParse(orderId).success) return [];
  const { data, error } = await createSupabaseServiceRoleClient().rpc("read_shopify_imported_orders", {
    p_tenant_id: context.tenant.id, p_actor_id: context.membership.clerk_user_id,
    p_domain: canonicalShopDomain(process.env.SHOPIFY_SHOP_DOMAIN ?? ""),
    p_app_ref: z.string().min(1).max(256).parse(process.env.SHOPIFY_CLIENT_ID),
    p_order_id: orderId ?? null, p_search: search?.trim().slice(0, 100) || null,
  }).abortSignal(AbortSignal.timeout(5000));
  if (error) throw new Error("Unable to load imported orders. Please retry.");
  return z.array(z.unknown()).max(50).parse(data).map(row => projectImportedShopifyOrderSafely(row, context.tenant.id));
}
