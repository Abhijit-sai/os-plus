import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("reports:view");

  return children;
}
