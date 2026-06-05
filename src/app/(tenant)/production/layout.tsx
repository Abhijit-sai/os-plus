import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function ProductionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("production:view");

  return children;
}
