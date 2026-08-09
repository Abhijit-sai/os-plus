import type { TenantUserRole } from "@/types/database";

export type Permission =
  | "dashboard:view"
  | "orders:view"
  | "orders:manage"
  | "production:view"
  | "production:manage"
  | "tasks:view"
  | "tasks:manage"
  | "laundry:view"
  | "laundry:manage"
  | "customers:view"
  | "customers:manage"
  | "customer_imports:manage"
  | "workers:view"
  | "worker_contributions:view"
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

export const rolePermissions: Record<TenantUserRole, Permission[]> = {
  owner_admin: [
    "dashboard:view",
    "orders:view",
    "orders:manage",
    "production:view",
    "production:manage",
    "tasks:view",
    "tasks:manage",
    "laundry:view",
    "laundry:manage",
    "customers:view",
    "customers:manage",
    "customer_imports:manage",
    "workers:view",
    "worker_contributions:view",
    "attendance:view",
    "attendance:manage",
    "salary:view",
    "salary:manage",
    "finance:view",
    "finance:manage",
    "reports:view",
    "settings:view",
    "settings:manage",
    "tenant_users:manage",
  ],
  manager: [
    "orders:view",
    "orders:manage",
    "production:view",
    "production:manage",
    "tasks:view",
    "tasks:manage",
    "laundry:view",
    "laundry:manage",
    "customers:view",
    "customers:manage",
    "attendance:view",
    "attendance:manage",
    "worker_contributions:view",
  ],
  finance: ["tasks:view", "tasks:manage", "salary:view", "salary:manage", "finance:view", "finance:manage"],
  viewer: ["reports:view"],
};

export function hasPermission(role: TenantUserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export function assertPermission(role: TenantUserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

export function getDefaultTenantRoute(role: TenantUserRole) {
  const defaultRoutes: Record<TenantUserRole, string> = {
    owner_admin: "/dashboard",
    manager: "/orders",
    finance: "/finance",
    viewer: "/reports",
  };

  return defaultRoutes[role];
}

export function getDefaultTenantRouteLabel(role: TenantUserRole) {
  const defaultRouteLabels: Record<TenantUserRole, string> = {
    owner_admin: "Dashboard",
    manager: "Orders",
    finance: "Finance",
    viewer: "Reports",
  };

  return defaultRouteLabels[role];
}
