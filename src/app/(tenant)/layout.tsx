import { AppShell } from "@/components/layout/app-shell";
import { requireTenantContext } from "@/lib/tenant/context";

export default async function TenantLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const context = await requireTenantContext();

  return <AppShell context={context}>{children}</AppShell>;
}
