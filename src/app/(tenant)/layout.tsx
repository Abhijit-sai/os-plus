import { AppShell } from "@/components/layout/app-shell";
import { getCurrentTenantVerticalKeys } from "@/features/verticals/queries";
import { requireTenantContext } from "@/lib/tenant/context";

export default async function TenantLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireTenantContext();
  const verticalKeys = await getCurrentTenantVerticalKeys(context);

  return <AppShell context={context} verticalKeys={verticalKeys}>{children}</AppShell>;
}
