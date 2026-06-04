import type { TenantUserRole } from "@/types/database";

export type Permission =
  | "dashboard:view"
  | "orders:view"
  | "orders:manage"
  | "production:view"
  | "production:manage"
  | "customers:view"
  | "customers:manage"
  | "workers:view"
  | "attendance:view"
  | "attendance:manage"
  | "salary:view"
  | "salary:manage"
  | "finance:view"
  | "finance:manage"
  | "reports:view"
  | "settings:view"
  | "settings:manage"
  | "tenant_users:manage";

const rolePermissions: Record<TenantUserRole, Permission[]> = {
  owner_admin: [
    "dashboard:view",
    "orders:view",
    "orders:manage",
    "production:view",
    "production:manage",
    "customers:view",
    "customers:manage",
    "workers:view",
    "attendance:view",
    "attendance:manage",
    "salary:view",
    "salary:manage",
    "finance:view",
    "finance:manage",
    "reports:view",
    "settings:view",
    "settings:manage",
    "tenant_users:manage"
  ],
  manager: [
    "orders:view",
    "orders:manage",
    "production:view",
    "production:manage",
    "customers:view",
    "customers:manage",
    "attendance:view",
    "attendance:manage"
  ],
  finance: [
    "salary:view",
    "salary:manage",
    "finance:view",
    "finance:manage"
  ],
  viewer: ["dashboard:view", "reports:view"]
};

export function hasPermission(role: TenantUserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: TenantUserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}
