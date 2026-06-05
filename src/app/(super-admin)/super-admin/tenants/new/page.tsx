import { createTenantAction } from "@/features/tenants/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";

const gstTreatmentOptions = [
  { value: "not_applicable", label: "Not applicable" },
  { value: "taxable_exclusive", label: "GST added on top" },
  { value: "taxable_inclusive", label: "GST included in amount" },
  { value: "exempt_or_nil", label: "Exempt / nil rated" },
  { value: "non_gst", label: "Non-GST supply" }
];

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
            <div className="space-y-4 rounded-md border p-4">
              <div>
                <h3 className="font-medium">GST settings</h3>
                <p className="text-sm text-muted-foreground">Optional defaults for accountant-handoff GST reports.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="gstRegistered" type="checkbox" className="h-4 w-4" />
                GST registered
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="legalName">Legal business name</Label>
                  <Input id="legalName" name="legalName" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input id="gstin" name="gstin" placeholder="29ABCDE1234F1Z5" />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="registeredAddress">Registered address</Label>
                  <Input id="registeredAddress" name="registeredAddress" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultSalesGstRate">Default sales GST %</Label>
                  <Input id="defaultSalesGstRate" name="defaultSalesGstRate" type="number" min="0" max="100" step="0.01" defaultValue="0" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultPurchaseGstRate">Default purchase GST %</Label>
                  <Input id="defaultPurchaseGstRate" name="defaultPurchaseGstRate" type="number" min="0" max="100" step="0.01" defaultValue="0" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultOrderGstTreatment">Default order GST treatment</Label>
                  <select
                    id="defaultOrderGstTreatment"
                    name="defaultOrderGstTreatment"
                    defaultValue="not_applicable"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {gstTreatmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultExpenseGstTreatment">Default expense GST treatment</Label>
                  <select
                    id="defaultExpenseGstTreatment"
                    name="defaultExpenseGstTreatment"
                    defaultValue="not_applicable"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {gstTreatmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <Button type="submit">Create tenant</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
