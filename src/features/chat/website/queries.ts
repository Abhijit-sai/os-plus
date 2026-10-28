import "server-only";
import { z } from "zod";
import { requireChatPermission } from "../module";
import { accountClient } from "../connection";
import { chatwootBrowserUrl } from "../../leads/transport";
import { websiteWidgetSnippet } from "./rules";
export async function getWebsiteWidget(input: unknown) {
  const request = z
    .object({ tenantId: z.string().uuid(), channelId: z.string().uuid() })
    .strict()
    .parse(input);
  const { context, db } = await requireChatPermission("chat_settings:manage");
  if (context.tenant.id !== request.tenantId) throw Error("Business changed.");
  const channel = await db
    .from("chat_channels")
    .select("id,workspace_id,brand_id,chatwoot_inbox_id")
    .eq("tenant_id", request.tenantId)
    .eq("id", request.channelId)
    .eq("kind", "website")
    .eq("is_active", true)
    .maybeSingle();
  if (channel.error || !channel.data)
    throw Error("Website channel unavailable.");
  const c = channel.data;
  const [workspace, brand] = await Promise.all([
    db
      .from("chat_workspaces")
      .select("*")
      .eq("tenant_id", request.tenantId)
      .eq("id", c.workspace_id)
      .eq("status", "active")
      .maybeSingle(),
    db
      .from("chat_brands")
      .select("id")
      .eq("tenant_id", request.tenantId)
      .eq("id", c.brand_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (
    workspace.error ||
    brand.error ||
    !workspace.data ||
    !brand.data ||
    !workspace.data.chatwoot_account_id
  )
    throw Error("Website channel unavailable.");
  const w = workspace.data;
  const provider = await accountClient(w).websiteInbox(
    w.chatwoot_account_id!,
    c.chatwoot_inbox_id,
  );
  // Recheck scope and channel after network I/O; a stale A tab must never return B's installation code.
  const fresh = await requireChatPermission("chat_settings:manage");
  if (fresh.context.tenant.id !== request.tenantId)
    throw Error("Business changed.");
  const [current, currentWorkspace, currentBrand] = await Promise.all([
    fresh.db
      .from("chat_channels")
      .select("id")
      .eq("tenant_id", request.tenantId)
      .eq("id", c.id)
      .eq("workspace_id", w.id)
      .eq("brand_id", c.brand_id)
      .eq("chatwoot_inbox_id", c.chatwoot_inbox_id)
      .eq("kind", "website")
      .eq("is_active", true)
      .maybeSingle(),
    fresh.db
      .from("chat_workspaces")
      .select("id")
      .eq("tenant_id", request.tenantId)
      .eq("id", w.id)
      .eq("status", "active")
      .eq("chatwoot_account_id", w.chatwoot_account_id!)
      .eq("chatwoot_base_url", w.chatwoot_base_url)
      .maybeSingle(),
    fresh.db
      .from("chat_brands")
      .select("id")
      .eq("tenant_id", request.tenantId)
      .eq("id", c.brand_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (
    [current, currentWorkspace, currentBrand].some(
      (row) => row.error || !row.data,
    )
  )
    throw Error("Website channel changed.");
  const origin = new URL(
    chatwootBrowserUrl(
      { baseUrl: w.chatwoot_base_url, accountId: w.chatwoot_account_id! },
      process.env.CHATWOOT_BROWSER_ORIGIN,
    ),
  ).origin;
  return {
    channelId: c.id,
    tenantId: request.tenantId,
    name: provider.name,
    preChatEnabled: provider.preChatEnabled,
    snippet: websiteWidgetSnippet({
      origin,
      websiteToken: provider.websiteToken,
      allowLocal:
        process.env.CHAT_AGENT_MODEL_MODE === "mock" &&
        process.env.CHAT_MODEL_LIVE_ENABLED !== "true",
    }),
    settingsUrl:
      origin +
      "/app/accounts/" +
      w.chatwoot_account_id +
      "/settings/inboxes/" +
      c.chatwoot_inbox_id,
  };
}
