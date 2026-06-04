import { updateBusinessProfileAction } from "@/features/settings/actions";
import { getBusinessProfileSettings } from "@/features/settings/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function BusinessProfilePage() {
  const { tenant } = await getBusinessProfileSettings();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Business profile</h2>
        <p className="text-muted-foreground">Tenant branding basics used across the app shell and customer tracking.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{tenant.name}</CardTitle>
          <CardDescription>Update customer-facing store identity.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateBusinessProfileAction} encType="multipart/form-data" className="space-y-5">
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
              <div>
                <p className="text-sm font-medium">Current branding</p>
                <p className="text-xs text-muted-foreground">{tenant.slug}</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Business name</Label>
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
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
              <p className="text-xs text-muted-foreground">Optional. PNG, JPG, or WEBP up to 2 MB. Leave blank to keep the current logo.</p>
            </div>
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
