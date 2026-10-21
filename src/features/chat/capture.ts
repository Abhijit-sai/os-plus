import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { captureIdentities } from "../leads/rules";
import type { IngressDependencies } from "./ingress";

export function chatCaptureDependencies(
  schedule: IngressDependencies["after"],
): IngressDependencies {
  const db = createSupabaseServiceRoleClient();
  return {
    after: schedule,
    async workspace(key) {
      const { data: w, error } = await db
        .from("chat_workspaces")
        .select("*")
        .eq("workspace_key", key)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw new Error("Capture unavailable");
      if (!w || !w.chatwoot_account_id) return null;
      const [tenant, module] = await Promise.all([
        db.from("tenants").select("status").eq("id", w.tenant_id).maybeSingle(),
        db
          .from("tenant_modules")
          .select("is_enabled")
          .eq("tenant_id", w.tenant_id)
          .eq("module_key", "chat_leads")
          .maybeSingle(),
      ]);
      if (tenant.error || module.error) throw new Error("Capture unavailable");
      if (tenant.data?.status !== "active" || !module.data?.is_enabled)
        return null;
      return {
        id: w.id,
        tenantId: w.tenant_id,
        accountId: z.coerce
          .number()
          .int()
          .positive()
          .safe()
          .parse(w.chatwoot_account_id),
        secretHash: w.webhook_secret_hash,
      };
    },
    async channel(w, inboxId) {
      const { data: c, error } = await db
        .from("chat_channels")
        .select("id,kind,agent_mode")
        .eq("tenant_id", w.tenantId)
        .eq("workspace_id", w.id)
        .eq("chatwoot_inbox_id", inboxId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw new Error("Capture unavailable");
      return c ? { id: c.id, kind: c.kind, mode: c.agent_mode } : null;
    },
    async capture(w, c, kind, message) {
      const profile = captureIdentities({
        workspaceId: w.id,
        channelId: c.id,
        kind: c.kind,
        contactId: message.contactId,
        ...message.identity,
      });
      const { error } = await db.rpc("chat_capture", {
        p_context: {
          tenantId: w.tenantId,
          actor: { type: "WEBHOOK", id: "chatwoot" },
          source: "WEBHOOK",
          correlationId: randomUUID(),
        },
        p_kind: kind,
        p_input: {
          workspaceId: w.id,
          secretHash: w.secretHash,
          channelId: c.id,
          message,
          identity: {
            displayName: profile.displayName,
            sourceId: message.identity.sourceId,
            phoneE164:
              profile.identities.find((i) => i.kind === "phone")?.value ?? null,
          },
        },
      });
      if (error) throw new Error("Capture unavailable");
    },
    async issue(w, code) {
      const { error } = await db.rpc("chat_capture_issue", {
        p_context: {
          tenantId: w.tenantId,
          actor: { type: "WEBHOOK", id: "chatwoot" },
          source: "WEBHOOK",
          correlationId: randomUUID(),
        },
        p_input: { workspaceId: w.id, secretHash: w.secretHash, code },
      });
      if (error) throw new Error("Capture health unavailable");
    },
  };
}
