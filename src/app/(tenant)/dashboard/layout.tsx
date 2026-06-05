import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("dashboard:view");

  return children;
}
