import "server-only";
import { ChatwootAdminClient } from "@/integrations/chatwoot/admin-client";
import { decryptChatSecret } from "./secrets";
import type { ChatWorkspace } from "@/types/chat";

export function chatwootOrigin() {
  const url = new URL(process.env.CHATWOOT_BASE_URL ?? "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Chat connection unavailable.");
  return url.origin;
}
export function assertChatLiveAccess() {
  // Reading at call time permits immediate shutdown without rebuilding the application.
  if (
    process.env.CHAT_ADMIN_LIVE_ENABLED !== "true" ||
    process.env.CHAT_DRY_RUN !== "false"
  )
    throw new Error("Chat connection is in dry-run mode.");
}
export function accountClient(workspace: ChatWorkspace) {
  assertChatLiveAccess();
  const origin = chatwootOrigin();
  if (
    workspace.chatwoot_base_url !== origin ||
    !workspace.api_token_enc ||
    !workspace.chatwoot_account_id ||
    workspace.status !== "active"
  )
    throw new Error("Chat connection unavailable.");
  const token = decryptChatSecret(workspace.api_token_enc, {
    tenantId: workspace.tenant_id,
    workspaceId: workspace.id,
    purpose: "account_token",
  });
  return new ChatwootAdminClient({ origin, token });
}
export function platformClient() {
  assertChatLiveAccess();
  return new ChatwootAdminClient({
    origin: chatwootOrigin(),
    token: process.env.CHATWOOT_PLATFORM_TOKEN ?? "",
  });
}
