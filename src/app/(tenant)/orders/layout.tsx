import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("orders:view");

  return children;
}
