import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/lib/tenant/context";
import type { TenantVerticalKey } from "@/types/database";

export class TenantVerticalUnavailableError extends Error {
  constructor(tenantId: string, verticalKey: TenantVerticalKey) {
    super(`Tenant ${tenantId} does not have ${verticalKey} vertical enabled`);
    this.name = "TenantVerticalUnavailableError";
  }
}

export async function getTenantVerticalKeys(
  tenantId: string,
): Promise<TenantVerticalKey[]> {
  const supabase = createSupabaseServiceRoleClient();
  const { data: tenantVerticals, error: tenantVerticalsError } = await supabase
    .from("tenant_verticals")
    .select("vertical_definition_id")
    .eq("tenant_id", tenantId)
    .eq("is_enabled", true)
    .order("created_at", { ascending: true });

  if (tenantVerticalsError) {
    throw new Error(
      `Unable to load tenant verticals: ${tenantVerticalsError.message}`,
    );
  }

  const verticalDefinitionIds = [
    ...new Set(
      (tenantVerticals ?? []).map((vertical) => vertical.vertical_definition_id),
    ),
  ];

  if (!verticalDefinitionIds.length) {
    return [];
  }

  const { data: verticalDefinitions, error: verticalDefinitionsError } =
    await supabase
      .from("vertical_definitions")
      .select("key")
      .in("id", verticalDefinitionIds)
      .eq("is_active", true);

  if (verticalDefinitionsError) {
    throw new Error(
      `Unable to load vertical definitions: ${verticalDefinitionsError.message}`,
    );
  }

  return (verticalDefinitions ?? [])
    .map((vertical) => vertical.key)
    .filter(
      (key): key is TenantVerticalKey => key === "boutique" || key === "laundry",
    );
}

export async function getCurrentTenantVerticalKeys(
  context: TenantContext,
): Promise<TenantVerticalKey[]> {
  return getTenantVerticalKeys(context.tenant.id);
}

export async function hasTenantVertical(
  context: TenantContext,
  verticalKey: TenantVerticalKey,
): Promise<boolean> {
  const verticals = await getCurrentTenantVerticalKeys(context);
  return verticals.includes(verticalKey);
}

export async function assertTenantVertical(
  context: TenantContext,
  verticalKey: TenantVerticalKey,
) {
  if (await hasTenantVertical(context, verticalKey)) {
    return;
  }

  throw new TenantVerticalUnavailableError(context.tenant.id, verticalKey);
}
