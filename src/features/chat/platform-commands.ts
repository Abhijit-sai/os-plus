import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isChatFoundationEnabled } from "./module";
import { commandKeySchema, platformChatSchema } from "./schemas";
import {
  chatwootOrigin,
  platformClient,
  assertChatLiveAccess,
} from "./connection";
import { ChatwootAdminClient } from "@/integrations/chatwoot/admin-client";
import { encryptChatSecret } from "./secrets";
import type { Json } from "@/types/database";

function webhookUrls(workspaceKey: string, secret: string) {
  const origin = new URL(process.env.CHAT_WEBHOOK_ORIGIN ?? "");
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Webhook origin unavailable.");
  return {
    events:
      origin.origin +
      "/api/chat/webhooks/chatwoot/" +
      workspaceKey +
      "/events?token=" +
      secret,
    agent:
      origin.origin +
      "/api/chat/webhooks/chatwoot/" +
      workspaceKey +
      "/agent?token=" +
      secret,
  };
}
export async function configurePlatformChat(
  input: unknown,
  commandKey: string,
): Promise<{
  webhooks?: { events: string; agent: string };
  message: string;
  needsReview?: boolean;
}> {
  const actor = await requireSuperAdmin();
  if (!isChatFoundationEnabled()) throw new Error("Chat setup unavailable.");
  const request = platformChatSchema.parse(input),
    key = commandKeySchema.parse(commandKey);
  const db = createSupabaseServiceRoleClient(),
    tenantId = request.tenantId;
  const context = {
    tenantId,
    actor: { type: "USER", id: actor },
    source: "OS_PLUS_UI",
    correlationId: randomUUID(),
  };
  const call = async (action: string, payload: Json, suffix = "") => {
    // Re-check platform authority after network waits as well as at entry.
    if ((await requireSuperAdmin()) !== actor)
      throw new Error("Chat access unavailable.");
    const result = await db.rpc("chat_platform_configure", {
      p_context: { ...context, idempotencyKey: key + suffix },
      p_action: action,
      p_input: payload,
    });
    if (result.error) throw new Error("Workspace configuration was not saved.");
    return z
      .object({
        id: z.string().uuid(),
        claimed: z.boolean().optional(),
        replayed: z.boolean().optional(),
      })
      .parse(result.data);
  };
  if (request.action === "workspace.prepare") {
    const secret = randomBytes(32).toString("base64url"),
      workspaceKey = randomBytes(24).toString("base64url");
    const urls = webhookUrls(workspaceKey, secret);
    const prepared = await call("workspace.prepare", {
      id: randomUUID(),
      origin: chatwootOrigin(),
      workspaceKey,
      secretHash: createHash("sha256").update(secret).digest("hex"),
    });
    if (prepared.replayed)
      return {
        message:
          "Workspace was already prepared. Reload and replace its setup URLs if you did not receive them.",
      };
    return {
      webhooks: urls,
      message:
        "Workspace prepared. Save these setup URLs securely; they are shown once. Webhook delivery becomes available in the next phase.",
    };
  }
  const { data: workspace, error } = await db
    .from("chat_workspaces")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !workspace || workspace.chatwoot_base_url !== chatwootOrigin())
    throw new Error("Chat workspace unavailable.");
  if (request.action === "workspace.rotate") {
    const secret = randomBytes(32).toString("base64url"),
      urls = webhookUrls(workspace.workspace_key, secret);
    const rotated = await call("workspace.rotate", {
      id: workspace.id,
      secretHash: createHash("sha256").update(secret).digest("hex"),
    });
    if (rotated.replayed)
      return {
        message:
          "Setup URLs were already replaced. Reload and replace them again if you did not receive them.",
      };
    return {
      webhooks: urls,
      message: "Setup URLs replaced. Previous URLs no longer authenticate.",
    };
  }
  if (request.action === "workspace.create") {
    const client = platformClient(); // Validate live-call protection before reserving an attempt.
    const reserved = await call("workspace.reserve", { id: workspace.id });
    if (!reserved.claimed)
      return {
        needsReview: true,
        message:
          "A creation attempt is already recorded. Reconcile the account before continuing.",
      };
    try {
      const account = await client.createAccount(
        request.name,
        workspace.provisioning_key,
      );
      await call(
        "workspace.record",
        { id: workspace.id, accountId: account.id },
        ":record",
      );
      return {
        message:
          "Account created. Link its administrator API token to finish setup.",
      };
    } catch {
      return {
        needsReview: true,
        message:
          "Creation outcome needs review. Check Chatwoot for the account and link it here; another create attempt is blocked.",
      };
    }
  }
  if (request.action === "workspace.link") {
    const tokenHash = createHash("sha256").update(request.token).digest("hex");
    const receipt = await db.rpc("chat_platform_configure", {
      p_context: { ...context, idempotencyKey: key, replayOnly: true },
      p_action: "workspace.link",
      p_input: { id: workspace.id, accountId: request.accountId, tokenHash },
    });
    if (receipt.error)
      throw new Error("Workspace configuration was not saved.");
    if (receipt.data !== null) {
      z.object({ id: z.string().uuid() }).parse(receipt.data);
      return { message: "Chatwoot account was already verified and linked." };
    }
    assertChatLiveAccess();
    if (workspace.provisioning_attempted_at)
      await platformClient().verifyProvisionedAccount(
        request.accountId,
        workspace.provisioning_key,
      );
    const client = new ChatwootAdminClient({
      origin: chatwootOrigin(),
      token: request.token,
    });
    await client.verifyAccount(request.accountId);
    const encrypted = encryptChatSecret(request.token, {
      tenantId,
      workspaceId: workspace.id,
      purpose: "account_token",
    });
    await call("workspace.link", {
      id: workspace.id,
      accountId: request.accountId,
      apiTokenEnc: encrypted,
      tokenHash,
    });
    return { message: "Chatwoot account verified and linked." };
  }
  if (request.action === "module.set")
    await call("module.set", { enabled: request.enabled });
  else await call("workspace.suspend", { id: workspace.id });
  return { message: "Workspace settings saved." };
}
