import "server-only";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getTenantUsersSettingsPageData() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "tenant_users:manage");
  const supabase = createSupabaseServiceRoleClient();
  const { data: tenantUsers, error } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", context.tenant.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load tenant users: ${error.message}`);
  }

  return {
    context,
    tenantUsers: tenantUsers ?? []
  };
}
