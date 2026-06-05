import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function WorkersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("workers:view");

  return children;
}
