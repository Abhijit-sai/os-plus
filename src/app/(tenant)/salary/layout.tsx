import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function SalaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("salary:view");

  return children;
}
