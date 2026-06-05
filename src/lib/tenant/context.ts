import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentClerkIdentity } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Tenant, TenantUser } from "@/types/database";

type AuthenticatedTenantUser = TenantUser & {
  clerk_user_id: string;
};

export type TenantContext = {
  tenant: Tenant;
  membership: AuthenticatedTenantUser;
  user: {
    userId: string;
    primaryEmail: string | null;
    fullName: string | null;
  };
};

export type TenantMembershipOption = {
  tenant: Tenant;
  membership: AuthenticatedTenantUser;
  user: TenantContext["user"];
};

const selectedTenantCookieName = "os_plus_selected_tenant_id";

async function getLinkedTenantMemberships(identity: NonNullable<Awaited<ReturnType<typeof getCurrentClerkIdentity>>>) {
  const supabase = createSupabaseServiceRoleClient();
  const clerkMemberships = await supabase
    .from("tenant_users")
    .select("*")
    .eq("clerk_user_id", identity.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (clerkMemberships.error) {
    throw new Error(`Unable to resolve tenant memberships: ${clerkMemberships.error.message}`);
  }

  let memberships: AuthenticatedTenantUser[] = (clerkMemberships.data ?? []).filter(
    (membership): membership is AuthenticatedTenantUser => Boolean(membership.clerk_user_id)
  );
  const linkedTenantIds = new Set(memberships.map((membership) => membership.tenant_id));

  if (identity.primaryEmail) {
    const emailMemberships = await supabase
      .from("tenant_users")
      .select("*")
      .is("clerk_user_id", null)
      .eq("email", identity.primaryEmail)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (emailMemberships.error) {
      throw new Error(`Unable to resolve email tenant memberships: ${emailMemberships.error.message}`);
    }

    const rowsToLink = [];
    const emailTenantIds = new Set<string>();

    for (const membership of emailMemberships.data ?? []) {
      if (linkedTenantIds.has(membership.tenant_id) || emailTenantIds.has(membership.tenant_id)) {
        continue;
      }

      rowsToLink.push(membership);
      emailTenantIds.add(membership.tenant_id);
    }

    if (rowsToLink.length) {
      const { error: linkError } = await supabase
        .from("tenant_users")
        .update({ clerk_user_id: identity.userId, updated_by: identity.userId })
        .in(
          "id",
          rowsToLink.map((membership) => membership.id)
        );

      if (linkError) {
        throw new Error(`Unable to link verified email to tenant membership: ${linkError.message}`);
      }
    }

    memberships = [
      ...memberships,
      ...rowsToLink.map((membership): AuthenticatedTenantUser => ({
        ...membership,
        clerk_user_id: identity.userId
      }))
    ];
  }

  return { identity, memberships, supabase };
}

async function getTenantMembershipOptionsByTenantStatus(statuses: Tenant["status"][]): Promise<TenantMembershipOption[]> {
  const identity = await getCurrentClerkIdentity();

  if (!identity) {
    return [];
  }

  const { memberships, supabase } = await getLinkedTenantMemberships(identity);
  const tenantIds = [...new Set(memberships.map((membership) => membership.tenant_id))];

  if (!tenantIds.length) {
    return [];
  }

  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .in("id", tenantIds)
    .in("status", statuses);

  if (tenantError) {
    throw new Error(`Unable to resolve tenants: ${tenantError.message}`);
  }

  const tenantById = new Map((tenants ?? []).map((tenant) => [tenant.id, tenant]));

  return (memberships ?? [])
    .map((membership) => {
      const tenant = tenantById.get(membership.tenant_id);
      return tenant ? { tenant, membership, user: identity } : null;
    })
    .filter((option): option is TenantMembershipOption => Boolean(option));
}

export async function getTenantMembershipOptions(): Promise<TenantMembershipOption[]> {
  return getTenantMembershipOptionsByTenantStatus(["active"]);
}

export async function getInactiveTenantMembershipOptions(): Promise<TenantMembershipOption[]> {
  return getTenantMembershipOptionsByTenantStatus(["inactive", "suspended"]);
}

export async function getTenantContext(): Promise<TenantContext | null> {
  const options = await getTenantMembershipOptions();

  if (!options.length) {
    return null;
  }

  if (options.length === 1) {
    return options[0];
  }

  const selectedTenantId = (await cookies()).get(selectedTenantCookieName)?.value;
  const selectedOption = selectedTenantId ? options.find((option) => option.tenant.id === selectedTenantId) : null;

  if (!selectedOption) {
    return null;
  }

  return selectedOption;
}

export async function requireTenantContext() {
  const context = await getTenantContext();

  if (!context) {
    const options = await getTenantMembershipOptions();

    if (options.length > 1) {
      redirect("/select-tenant");
    }

    const inactiveOptions = await getInactiveTenantMembershipOptions();

    if (inactiveOptions.length) {
      redirect("/inactive-tenant");
    }

    redirect("/no-tenant");
  }

  return context;
}

export { selectedTenantCookieName };
