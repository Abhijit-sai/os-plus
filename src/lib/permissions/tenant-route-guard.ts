import "server-only";

import { redirect } from "next/navigation";

import {
  getDefaultTenantRoute,
  hasPermission,
  type Permission,
} from "@/lib/permissions/roles";
import { requireTenantContext } from "@/lib/tenant/context";

export async function requireTenantRoutePermission(permission: Permission) {
  const context = await requireTenantContext();

  if (!hasPermission(context.membership.role, permission)) {
    redirect(getDefaultTenantRoute(context.membership.role));
  }

  return context;
}
