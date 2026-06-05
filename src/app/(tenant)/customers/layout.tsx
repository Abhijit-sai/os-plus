import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("customers:view");

  return children;
}
