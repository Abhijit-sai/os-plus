import { z } from "zod";
import { parseKnowledgePack } from "./knowledge-pack";
import "server-only";
import { requireChatPermission, isChatFoundationEnabled } from "./module";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin";

export async function getChatSetup() {
  const { context, db } = await requireChatPermission("chat_settings:manage"),
    tenantId = context.tenant.id;
  const [brands, branches, mappings, channels, grants, workspace] =
    await Promise.all([
      db
        .from("chat_brands")
        .select("id,name,slug,persona_name")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .order("name"),
      db
        .from("tenant_locations")
        .select("id,name,code")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("name"),
      db
        .from("chat_brand_locations")
        .select("brand_id,location_id")
        .eq("tenant_id", tenantId),
      db
        .from("chat_channels")
        .select(
          "id,workspace_id,brand_id,default_location_id,chatwoot_inbox_id,name,kind,agent_mode,is_active",
        )
        .eq("tenant_id", tenantId),
      db
        .from("chat_role_permissions")
        .select("role,permission,allowed")
        .eq("tenant_id", tenantId),
      db
        .from("chat_workspaces")
        .select("id,status")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);
  if (
    [brands, branches, mappings, channels, grants, workspace].some(
      (result) => result.error,
    )
  )
    throw new Error("Chat setup could not be loaded.");
  const histories = await Promise.all(
    (brands.data ?? []).map(async (brand) => {
      const [recent, published] = await Promise.all([
        knowledgePage(db, tenantId, brand.id),
        db
          .from("chat_knowledge_packs")
          .select("id,brand_id,version,status")
          .eq("tenant_id", tenantId)
          .eq("brand_id", brand.id)
          .eq("status", "published")
          .maybeSingle(),
      ]);
      if (published.error)
        throw new Error("Knowledge history could not be loaded.");
      const active = published.data;
      return {
        brandId: brand.id,
        olderBefore: recent.olderBefore,
        revisions:
          active && !recent.revisions.some((r) => r.id === active.id)
            ? [...recent.revisions, active]
            : recent.revisions,
      };
    }),
  );
  return {
    histories: histories.map(({ brandId, olderBefore }) => ({
      brandId,
      olderBefore,
    })),
    tenantId,
    businessName: context.tenant.store_name,
    brands: brands.data ?? [],
    branches: branches.data ?? [],
    mappings: mappings.data ?? [],
    packs: histories.flatMap((h) => h.revisions),
    channels: channels.data ?? [],
    grants: grants.data ?? [],
    workspace: workspace.data,
  };
}
const knowledgeRequest = z.union([
  z
    .object({
      brandId: z.string().uuid(),
      beforeVersion: z.number().int().positive().optional(),
    })
    .strict(),
  z.object({ brandId: z.string().uuid(), id: z.string().uuid() }).strict(),
]);
type ChatDb = Awaited<ReturnType<typeof requireChatPermission>>["db"];
async function knowledgePage(
  db: ChatDb,
  tenantId: string,
  brandId: string,
  beforeVersion?: number,
) {
  let query = db
    .from("chat_knowledge_packs")
    .select("id,brand_id,version,status")
    .eq("tenant_id", tenantId)
    .eq("brand_id", brandId);
  if (beforeVersion !== undefined) query = query.lt("version", beforeVersion);
  const { data, error } = await query
    .order("version", { ascending: false })
    .limit(20);
  if (error) throw new Error("Knowledge history could not be loaded.");
  const revisions = data ?? [];
  return {
    revisions,
    olderBefore: revisions.length === 20 ? revisions[19].version : null,
  };
}
export async function getChatKnowledge(input: unknown) {
  const request = knowledgeRequest.parse(input);
  const { context, db } = await requireChatPermission("chat_settings:manage"),
    tenantId = context.tenant.id;
  const brand = await db
    .from("chat_brands")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", request.brandId)
    .is("deleted_at", null)
    .maybeSingle();
  if (brand.error || !brand.data) throw new Error("Knowledge unavailable.");
  if ("id" in request) {
    const { data, error } = await db
      .from("chat_knowledge_packs")
      .select("id,pack_json")
      .eq("tenant_id", tenantId)
      .eq("brand_id", request.brandId)
      .eq("id", request.id)
      .maybeSingle();
    if (error || !data) throw new Error("Knowledge unavailable.");
    return {
      revision: { id: data.id, pack_json: parseKnowledgePack(data.pack_json) },
    };
  }
  return knowledgePage(db, tenantId, request.brandId, request.beforeVersion);
}
export type ChatSetup = Awaited<ReturnType<typeof getChatSetup>>;

export async function getPlatformChatSetup() {
  await requireSuperAdmin();
  if (!isChatFoundationEnabled())
    throw new Error("Chat setup is not available.");
  const db = createSupabaseServiceRoleClient();
  // The platform administrator is explicitly allowed to list tenants and workspace status.
  const [tenants, workspaces, modules] = await Promise.all([
    db.from("tenants").select("id,name").eq("status", "active").order("name"),
    db
      .from("chat_workspaces")
      .select(
        "tenant_id,id,status,chatwoot_account_id,provisioning_attempted_at",
      ),
    db
      .from("tenant_modules")
      .select("tenant_id,is_enabled")
      .eq("module_key", "chat_leads"),
  ]);
  if (tenants.error || workspaces.error || modules.error)
    throw new Error("Chat setup could not be loaded.");
  return (tenants.data ?? []).map((tenant) => ({
    ...tenant,
    workspace: workspaces.data?.find((w) => w.tenant_id === tenant.id) ?? null,
    enabled:
      modules.data?.find((m) => m.tenant_id === tenant.id)?.is_enabled === true,
  }));
}
