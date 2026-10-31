import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  accountClient,
  assertChatLiveAccess,
  chatwootOrigin,
} from "./connection";

const scopeSchema = z
  .object({
    tenantId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    accountId: z.number().int().positive().safe(),
  })
  .strict();
const linkSchema = scopeSchema
  .extend({
    tenantUserId: z.string().uuid(),
    chatwootUserId: z.number().int().positive().safe(),
  })
  .strict();
const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().email().max(320),
  clerk_user_id: z.string().trim().min(1).max(200),
  role: z.enum(["owner_admin", "manager"]),
  status: z.literal("active"),
  display_name: z.string().nullable(),
});
const emailKey = (email: string) => email.trim().toLowerCase();
const fingerprint = (profile: z.infer<typeof profileSchema>) =>
  createHash("sha256")
    .update(emailKey(profile.email) + ":" + profile.clerk_user_id)
    .digest("hex");
export type StaffLinkChoices = {
  profiles: {
    id: string;
    name: string;
    email: string;
    role: string;
    linkedUserId: number | null;
  }[];
  users: { id: number; name: string; email: string; role: string }[];
};
async function authorize(actor?: string) {
  const current = await requireSuperAdmin();
  if (
    (actor && current !== actor) ||
    process.env.CHAT_FOUNDATION_ENABLED !== "true"
  )
    throw new Error("Chat setup unavailable.");
  assertChatLiveAccess();
  return current;
}
async function state(scope: z.infer<typeof scopeSchema>) {
  const db = createSupabaseServiceRoleClient();
  const [
    { data: tenant, error: te },
    { data: workspace, error: we },
    { data: members, error: me },
    { data: links, error: le },
  ] = await Promise.all([
    db
      .from("tenants")
      .select("id,status")
      .eq("id", scope.tenantId)
      .maybeSingle(),
    db
      .from("chat_workspaces")
      .select("*")
      .eq("tenant_id", scope.tenantId)
      .eq("id", scope.workspaceId)
      .maybeSingle(),
    db
      .from("tenant_users")
      .select("id,email,clerk_user_id,role,status,display_name")
      .eq("tenant_id", scope.tenantId)
      .eq("status", "active"),
    db
      .from("chat_staff_links")
      .select("tenant_user_id,chatwoot_user_id")
      .eq("tenant_id", scope.tenantId),
  ]);
  if (
    te ||
    we ||
    me ||
    le ||
    !tenant ||
    tenant.status !== "active" ||
    !workspace ||
    workspace.id !== scope.workspaceId ||
    workspace.tenant_id !== scope.tenantId ||
    workspace.status !== "active" ||
    workspace.chatwoot_account_id !== scope.accountId ||
    workspace.chatwoot_base_url !== chatwootOrigin() ||
    !workspace.api_token_enc ||
    !members ||
    members.length > 1000
  )
    throw new Error("Chat workspace unavailable.");
  const profiles = members.flatMap((member) => {
    const parsed = profileSchema.safeParse(member);
    return parsed.success ? [parsed.data] : [];
  });
  return { db, workspace, profiles, links: links ?? [] };
}
export async function getPlatformChatStaffChoices(
  raw: unknown,
): Promise<StaffLinkChoices> {
  const actor = await authorize(),
    scope = scopeSchema.parse(raw),
    s = await state(scope);
  const users = await accountClient(s.workspace).listAccountUsers(
    scope.accountId,
  );
  await authorize(actor);
  const fresh = await state(scope);
  if (fresh.workspace.api_token_enc !== s.workspace.api_token_enc)
    throw new Error("Chat workspace changed; reload.");
  return {
    profiles: fresh.profiles.map((p) => ({
      id: p.id,
      name: p.display_name || p.email,
      email: p.email,
      role: p.role,
      linkedUserId:
        fresh.links.find((l) => l.tenant_user_id === p.id)?.chatwoot_user_id ??
        null,
    })),
    users,
  };
}
export async function configurePlatformChatStaffLink(
  raw: unknown,
  commandKey: string,
) {
  const actor = await authorize(),
    request = linkSchema.parse(raw),
    key = z.string().uuid().parse(commandKey);
  const scope = scopeSchema.parse({
    tenantId: request.tenantId,
    workspaceId: request.workspaceId,
    accountId: request.accountId,
  });
  const s = await state(scope),
    profile = s.profiles.find((p) => p.id === request.tenantUserId);
  if (!profile)
    throw new Error("Choose an active staff profile with a linked login.");
  const input = {
    workspaceId: scope.workspaceId,
    accountId: scope.accountId,
    tenantUserId: profile.id,
    chatwootUserId: request.chatwootUserId,
    profileFingerprint: fingerprint(profile),
  };
  const context = {
    tenantId: scope.tenantId,
    actor: { type: "USER", id: actor },
    source: "OS_PLUS_UI",
    correlationId: randomUUID(),
    idempotencyKey: key,
  };
  const call = async (replayOnly: boolean) => {
    await authorize(actor);
    const { data, error } = await s.db.rpc("chat_staff_link_configure", {
      p_context: { ...context, replayOnly },
      p_input: input,
    });
    if (error) throw new Error("Staff link was not saved.");
    return data === null
      ? null
      : z.object({ id: z.string().uuid() }).strict().parse(data);
  };
  const previous = await call(true);
  if (previous) return previous;
  const users = await accountClient(s.workspace).listAccountUsers(
    scope.accountId,
  );
  const user = users.find((u) => u.id === request.chatwootUserId);
  if (
    !user ||
    emailKey(user.email) !== emailKey(profile.email) ||
    users.filter((u) => emailKey(u.email) === emailKey(profile.email))
      .length !== 1 ||
    s.profiles.filter((p) => emailKey(p.email) === emailKey(profile.email))
      .length !== 1
  )
    throw new Error(
      "The selected logins do not match. No staff link was saved.",
    );
  await authorize(actor);
  const fresh = await state(scope),
    current = fresh.profiles.find((p) => p.id === profile.id);
  if (
    !current ||
    fingerprint(current) !== fingerprint(profile) ||
    fresh.workspace.api_token_enc !== s.workspace.api_token_enc
  )
    throw new Error("Staff or workspace changed; reload.");
  const result = await call(false);
  if (!result) throw new Error("Staff link was not saved.");
  return result;
}
