import "server-only";

import { z } from "zod";
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ShopifyProbeActor } from "./probe-config.ts";

export async function readShopifyProbeActor(
  userId: string | null,
  tenantId: string | undefined,
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
): Promise<ShopifyProbeActor | null> {
  if (!userId || !tenantId || !z.string().uuid().safeParse(tenantId).success) return null;
  const { data: members, error } = await supabase.from("tenant_users")
    .select("tenant_id,clerk_user_id,role,status")
    .eq("tenant_id", tenantId).eq("clerk_user_id", userId).eq("status", "active").limit(2);
  if (error || members?.length !== 1) return null;
  const { data: tenant, error: tenantError } = await supabase.from("tenants")
    .select("id,status").eq("id", tenantId).eq("status", "active").maybeSingle();
  if (tenantError || !tenant) return null;
  const member = members[0];
  return { userId, tenantId: tenant.id, role: member.role, tenantStatus: tenant.status,
    membershipUserId: member.clerk_user_id ?? "", membershipTenantId: member.tenant_id,
    membershipStatus: member.status };
}
