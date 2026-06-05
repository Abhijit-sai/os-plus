import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("settings:view");

  return children;
}
