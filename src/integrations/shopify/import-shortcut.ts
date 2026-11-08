import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenant/context";
import { isShopifyConnectionScreenEnabled } from "./connection-screen";
import { isShopifyImportReady } from "./unified-contract";
import { createShopifyUnifiedService } from "./unified-service";

export async function canOpenShopifyImport({ tenant, membership, user }: TenantContext): Promise<boolean> {
  if (membership.role !== "owner_admin" || !isShopifyConnectionScreenEnabled(tenant.id) ||
      process.env.SHOPIFY_UNIFIED_ORDERS_ENABLED !== "true" ||
      process.env.SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED !== "true") return false;

  try {
    const service = createShopifyUnifiedService(createSupabaseServiceRoleClient());
    const workspace = await service.view({
      userId: user.userId,
      tenantId: tenant.id,
      tenantStatus: tenant.status,
      membershipUserId: membership.clerk_user_id,
      membershipTenantId: membership.tenant_id,
      membershipStatus: membership.status,
      role: membership.role,
    }, AbortSignal.timeout(2500));
    return isShopifyImportReady(workspace);
  } catch {
    // An unavailable integration must not block access to Orders.
    return false;
  }
}
