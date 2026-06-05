import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function AttendanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("attendance:view");

  return children;
}
