import { createTenantAction } from "@/features/tenants/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GstSettingsFields } from "@/components/settings/gst-settings-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";

export default async function NewTenantPage() {
  await requireSuperAdminPageAccess();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create tenant</h1>
        <p className="text-muted-foreground">
          Create the boutique workspace and optionally pre-authorize the first owner/admin by email.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenant details</CardTitle>
          <CardDescription>Tenant data is never hardcoded; memberships are stored in tenant_users.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTenantAction} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="name">Tenant name</Label>
              <Input id="name" name="name" placeholder="Acme Boutique Pvt Ltd" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" placeholder="acme-boutique" required />
              <p className="text-xs text-muted-foreground">
                Used in URLs and tenant selection. Spaces and uppercase letters will be converted to a lowercase hyphen slug.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" name="storeName" placeholder="Acme Boutique" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="brandColor">Brand color</Label>
              <Input id="brandColor" name="brandColor" defaultValue="#2563eb" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
              <p className="text-xs text-muted-foreground">
                Optional. Upload a PNG, JPG, or WEBP logo up to 2 MB. It appears in tenant branding and customer tracking.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ownerEmail">Owner email</Label>
              <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="owner@example.com" />
            </div>
            <GstSettingsFields summaryDescription="Optional defaults for accountant-handoff GST reports." />
            <Button type="submit">Create tenant</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
