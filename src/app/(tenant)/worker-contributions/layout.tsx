import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function WorkerContributionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("worker_contributions:view");

  return children;
}
