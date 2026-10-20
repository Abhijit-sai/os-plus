import "server-only";

import { z } from "zod";
import type { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ShopifyProbeActor } from "./probe-config.ts";

export async function readShopifyProbeActor(
  userId: string | null,
  tenantId: string | undefined,
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
): Promise<ShopifyProbeActor | null> {
  if (!userId || (tenantId !== undefined && !z.string().uuid().safeParse(tenantId).success)) return null;
  let query = supabase.from("tenant_users")
    .select("tenant_id,clerk_user_id,role,status")
    .eq("clerk_user_id", userId).eq("status", "active");
  // Match the ordinary workspace's single-membership default, without its
  // invitation-linking writes. An explicit (even stale) selection never falls
  // back to a different tenant. Two memberships require explicit selection.
  if (tenantId !== undefined) query = query.eq("tenant_id", tenantId);
  const { data: members, error } = await query.limit(2);
  if (error || members?.length !== 1) return null;
  const member = members[0];
  if (member.clerk_user_id !== userId || member.status !== "active" ||
      !z.string().uuid().safeParse(member.tenant_id).success ||
      (tenantId !== undefined && member.tenant_id !== tenantId)) return null;
  const { data: tenant, error: tenantError } = await supabase.from("tenants")
    .select("id,status").eq("id", member.tenant_id).eq("status", "active").maybeSingle();
  if (tenantError || !tenant || tenant.id !== member.tenant_id || tenant.status !== "active") return null;
  return { userId, tenantId: tenant.id, role: member.role, tenantStatus: tenant.status,
    membershipUserId: member.clerk_user_id ?? "", membershipTenantId: member.tenant_id,
    membershipStatus: member.status };
}
