import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export default async function TenantsPage() {
  await requireSuperAdminPageAccess();

  const supabase = createSupabaseServiceRoleClient();
  const { data: tenants, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load tenants: ${error.message}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground">Manual tenant creation for MVP onboarding.</p>
        </div>
        <Button asChild>
          <Link href="/super-admin/tenants/new">Create tenant</Link>
        </Button>
      </div>
      <div className="grid gap-4">
        {tenants?.map((tenant) => (
          <Card key={tenant.id}>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-lg">{tenant.name}</CardTitle>
                <CardDescription>
                  {tenant.store_name} · {tenant.slug} · {tenant.status}
                </CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href={`/super-admin/tenants/${tenant.id}`}>Edit tenant</Link>
              </Button>
            </CardHeader>
          </Card>
        ))}
        {!tenants?.length ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">No tenants created yet.</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
