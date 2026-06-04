import Link from "next/link";

import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";

export default async function SuperAdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSuperAdminPageAccess();

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/super-admin/tenants" className="font-semibold">
            OS PLUS Super Admin
          </Link>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Tenant app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
