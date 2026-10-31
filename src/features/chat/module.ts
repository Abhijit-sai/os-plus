import "server-only";
import { requireTenantContext } from "@/lib/tenant/context";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { canUseChat, type ChatPermission } from "./permissions";

export class ChatAccessError extends Error {
  constructor(message = "Chat access is not available for this account.") {
    super(message);
    this.name = "ChatAccessError";
  }
}

export function isChatFoundationEnabled() {
  return process.env.CHAT_FOUNDATION_ENABLED === "true";
}

export async function requireChatPermission(permission: ChatPermission) {
  if (!isChatFoundationEnabled())
    throw new ChatAccessError("Chat setup is not available.");
  const context = await requireTenantContext();
  const db = createSupabaseServiceRoleClient();
  const [module, grants] = await Promise.all([
    db
      .from("tenant_modules")
      .select("is_enabled")
      .eq("tenant_id", context.tenant.id)
      .eq("module_key", "chat_leads")
      .maybeSingle(),
    db
      .from("chat_role_permissions")
      .select("tenant_id,role,permission,allowed")
      .eq("tenant_id", context.tenant.id),
  ]);
  if (module.error || grants.error)
    throw new Error("Chat access could not be checked. Try again later.");
  if (
    !canUseChat(
      {
        tenantId: context.tenant.id,
        tenantActive: context.tenant.status === "active",
        moduleEnabled: module.data?.is_enabled === true,
        membership: {
          tenantId: context.membership.tenant_id,
          status: context.membership.status,
          role: context.membership.role,
        },
        grants: (grants.data ?? []).map((row) => ({
          tenantId: row.tenant_id,
          role: row.role,
          permission: row.permission,
          allowed: row.allowed,
        })),
      },
      permission,
    )
  )
    throw new ChatAccessError();
  return { context, db };
}

export async function isTenantChatEnabled(tenantId: string) {
  if (!isChatFoundationEnabled()) return false;
  const { data, error } = await createSupabaseServiceRoleClient()
    .from("tenant_modules")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .eq("module_key", "chat_leads")
    .maybeSingle();
  // The additive entry remains hidden if the migration has not been installed.
  return !error && data?.is_enabled === true;
}
