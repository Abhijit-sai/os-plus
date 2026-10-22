import "server-only";
import { z } from "zod";
import { createUserCommandContext } from "@/core/command-context/server";
import { requireChatPermission } from "../module";
import { runMockPreview } from "./preview-core";
import type { Json } from "@/types/database";

export function isMockPreviewEnabled() {
  return process.env.CHAT_MOCK_PREVIEW_ENABLED === "true";
}
export async function previewInquiry(input: unknown, key: string) {
  if (!isMockPreviewEnabled()) throw new Error("Preview unavailable.");
  const { context, db } = await requireChatPermission("chat_settings:manage");
  const commandContext = createUserCommandContext(context, {
    idempotencyKey: key,
  });
  return runMockPreview(input, key, {
    async authorize() {
      return commandContext;
    },
    async load(tenantId, brandId, status) {
      const brand = await db
        .from("chat_brands")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("id", brandId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (brand.error || !brand.data) throw new Error("Preview unavailable.");
      const pack = await db
        .from("chat_knowledge_packs")
        .select("tenant_id,brand_id,version,pack_json")
        .eq("tenant_id", tenantId)
        .eq("brand_id", brandId)
        .eq("status", status)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pack.error || !pack.data)
        throw new Error("Selected knowledge unavailable.");
      const settings = await db
        .from("chat_settings")
        .select("default_currency")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (settings.error || !settings.data)
        throw new Error("Preview settings unavailable.");
      return {
        currency: settings.data.default_currency,
        tenantId: pack.data.tenant_id,
        brandId: pack.data.brand_id,
        version: pack.data.version,
        body: pack.data.pack_json,
      };
    },
    async command(ctx, action, body) {
      const { data, error } = await db.rpc("chat_agent_command", {
        p_context: ctx as Json,
        p_action: action,
        p_input: body as Json,
      });
      if (error) throw new Error("Preview could not be recorded.");
      return data === null
        ? null
        : z
            .object({ id: z.string().uuid(), result: z.unknown().optional() })
            .strict()
            .parse(data);
    },
  });
}
