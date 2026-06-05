import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("finance:view");

  return children;
}
