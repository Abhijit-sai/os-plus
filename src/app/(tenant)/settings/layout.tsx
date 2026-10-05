import { requireTenantRoutePermission } from "@/lib/permissions/tenant-route-guard";
import { SettingsNavigation } from "@/components/settings/settings-navigation";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTenantRoutePermission("settings:view");

  return <div className="mx-auto w-full max-w-6xl min-w-0"><SettingsNavigation />{children}</div>;
}
