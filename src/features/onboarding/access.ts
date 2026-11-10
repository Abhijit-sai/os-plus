import "server-only";

import { notFound } from "next/navigation";
import { hasTenantVertical } from "@/features/verticals/queries";
import { requireTenantContext } from "@/lib/tenant/context";

export async function requireBoutiqueOwner(expectedTenantId?: string) {
  const context = await requireTenantContext();
  if (
    context.membership.role !== "owner_admin" ||
    (expectedTenantId && expectedTenantId !== context.tenant.id) ||
    !(await hasTenantVertical(context, "boutique"))
  ) {
    notFound();
  }
  return context;
}
