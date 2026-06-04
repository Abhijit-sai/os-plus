import "server-only";

import { assertPermission } from "@/lib/permissions/roles";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireTenantContext } from "@/lib/tenant/context";

export async function getCommunicationsSettingsPageData() {
  const context = await requireTenantContext();
  assertPermission(context.membership.role, "settings:view");
  const supabase = createSupabaseServiceRoleClient();

  const [channelSettings, templates, triggerRules, recentMessages, messageLogs] = await Promise.all([
    supabase
      .from("communication_channel_settings")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("channel"),
    supabase
      .from("communication_templates")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("communication_trigger_rules")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("trigger_type"),
    supabase
      .from("communication_message_queue")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("communication_message_logs")
      .select("*")
      .eq("tenant_id", context.tenant.id)
      .order("created_at", { ascending: false })
      .limit(40)
  ]);

  for (const result of [channelSettings, templates, triggerRules, recentMessages, messageLogs]) {
    if (result.error) {
      throw new Error(`Unable to load communication settings: ${result.error.message}`);
    }
  }

  return {
    context,
    channelSettings: channelSettings.data ?? [],
    templates: templates.data ?? [],
    triggerRules: triggerRules.data ?? [],
    recentMessages: recentMessages.data ?? [],
    messageLogs: messageLogs.data ?? []
  };
}
