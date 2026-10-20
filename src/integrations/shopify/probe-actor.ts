import "server-only";

import { cookies } from "next/headers";
import { getCurrentClerkUserId } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { selectedTenantCookieName } from "@/lib/tenant/context";
import type { ShopifyProbeActor } from "./probe-config.ts";
import { readShopifyProbeActor } from "./probe-actor-reader.ts";

// Deliberately does not call getTenantContext: that helper can link invitations.
// Diagnostics must neither claim an invitation nor change any database row.
export async function getShopifyProbeActor(): Promise<ShopifyProbeActor | null> {
  const userId = await getCurrentClerkUserId();
  if (!userId) return null;
  const tenantId = (await cookies()).get(selectedTenantCookieName)?.value;
  return readShopifyProbeActor(userId, tenantId, createSupabaseServiceRoleClient());
}
