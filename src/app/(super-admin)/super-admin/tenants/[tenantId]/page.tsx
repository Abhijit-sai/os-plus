import { notFound } from "next/navigation";

import { updateTenantAction } from "@/features/tenants/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export default async function TenantDetailPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireSuperAdminPageAccess();

  const { tenantId } = await params;
  const supabase = createSupabaseServiceRoleClient();

  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();

  if (tenantError) {
    throw new Error(`Unable to load tenant: ${tenantError.message}`);
  }

  if (!tenant) {
    notFound();
  }

  const { data: users, error: usersError } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  if (usersError) {
    throw new Error(`Unable to load tenant users: ${usersError.message}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="text-muted-foreground">{tenant.store_name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenant profile</CardTitle>
          <CardDescription>{tenant.slug}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-md border p-3">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logo_url} alt={tenant.store_name} className="h-14 w-14 rounded-md object-cover" />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-md text-sm font-semibold text-white"
                style={{ backgroundColor: tenant.brand_color ?? "#2563eb" }}
              >
                {tenant.store_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="text-sm">
              <p className="font-medium">{tenant.store_name}</p>
              <p className="text-muted-foreground">Slug is fixed: {tenant.slug}</p>
            </div>
          </div>
          <form action={updateTenantAction} encType="multipart/form-data" className="space-y-4">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Tenant name</Label>
                <Input id="name" name="name" defaultValue={tenant.name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storeName">Store name</Label>
                <Input id="storeName" name="storeName" defaultValue={tenant.store_name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brandColor">Brand color</Label>
                <Input id="brandColor" name="brandColor" defaultValue={tenant.brand_color ?? "#2563eb"} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={tenant.status}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
              <p className="text-xs text-muted-foreground">Optional. PNG, JPG, or WEBP up to 2 MB. Leave blank to keep the current logo.</p>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p className="text-muted-foreground">Created: {new Date(tenant.created_at).toLocaleString()}</p>
              <p className="text-muted-foreground">Updated: {new Date(tenant.updated_at).toLocaleString()}</p>
            </div>
            <Button type="submit">Save tenant</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tenant users</CardTitle>
          <CardDescription>Clerk identities mapped to this tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users?.map((user) => (
            <div key={user.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{user.clerk_user_id}</p>
              <p className="text-muted-foreground">
                {user.role} · {user.status}
              </p>
            </div>
          ))}
          {!users?.length ? <p className="text-sm text-muted-foreground">No tenant users yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
