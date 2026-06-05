import { updateBusinessProfileAction } from "@/features/settings/actions";
import { getBusinessProfileSettings } from "@/features/settings/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const gstTreatmentOptions = [
  { value: "not_applicable", label: "Not applicable" },
  { value: "taxable_exclusive", label: "GST added on top" },
  { value: "taxable_inclusive", label: "GST included in amount" },
  { value: "exempt_or_nil", label: "Exempt / nil rated" },
  { value: "non_gst", label: "Non-GST supply" }
];

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
          <form action={updateBusinessProfileAction} className="space-y-5">
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
            <div className="space-y-4 rounded-md border p-4">
              <div>
                <h3 className="font-medium">GST settings</h3>
                <p className="text-sm text-muted-foreground">Defaults used later for order, expense, and accountant-handoff GST reports.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="gstRegistered" type="checkbox" defaultChecked={tenant.gst_registered} className="h-4 w-4" />
                GST registered
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="legalName">Legal business name</Label>
                  <Input id="legalName" name="legalName" defaultValue={tenant.legal_name ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input id="gstin" name="gstin" defaultValue={tenant.gstin ?? ""} placeholder="29ABCDE1234F1Z5" />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="registeredAddress">Registered address</Label>
                  <Input id="registeredAddress" name="registeredAddress" defaultValue={tenant.registered_address ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultSalesGstRate">Default sales GST %</Label>
                  <Input
                    id="defaultSalesGstRate"
                    name="defaultSalesGstRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={tenant.default_sales_gst_rate ?? 0}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultPurchaseGstRate">Default purchase GST %</Label>
                  <Input
                    id="defaultPurchaseGstRate"
                    name="defaultPurchaseGstRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue={tenant.default_purchase_gst_rate ?? 0}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultOrderGstTreatment">Default order GST treatment</Label>
                  <select
                    id="defaultOrderGstTreatment"
                    name="defaultOrderGstTreatment"
                    defaultValue={tenant.default_order_gst_treatment ?? "not_applicable"}
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
                    defaultValue={tenant.default_expense_gst_treatment ?? "not_applicable"}
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
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
