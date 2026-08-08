import Link from "next/link";

import {
  archiveTenantLocationAction,
  createTenantLocationAction,
  updateTenantLocationAction,
} from "@/features/settings/actions";
import { getTenantLocations } from "@/features/settings/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import type { TenantLocationType } from "@/types/database";

const locationTypes: Array<{ value: TenantLocationType; label: string }> = [
  { value: "store", label: "Store" },
  { value: "workshop", label: "Workshop" },
  { value: "warehouse", label: "Warehouse" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
];

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

export default async function TenantLocationsSettingsPage() {
  const locations = await getTenantLocations();

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add location</CardTitle>
          <CardDescription>
            Stores, workshops, warehouses, and offices used by V2 operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTenantLocationAction} className="space-y-4" data-unsaved-guard="true">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" placeholder="KPHB" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="KPHB Store" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="locationType">Type</Label>
              <select id="locationType" name="locationType" defaultValue="store" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {locationTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input id="addressLine1" name="addressLine1" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input id="addressLine2" name="addressLine2" placeholder="Optional" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="area">Area</Label>
                <Input id="area" name="area" placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" placeholder="Hyderabad" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="state">State</Label>
                <Input id="state" name="state" placeholder="TS" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="postalCode">Postal code</Label>
                <Input id="postalCode" name="postalCode" placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="countryCode">Country</Label>
                <Input id="countryCode" name="countryCode" defaultValue="IN" maxLength={2} required />
              </div>
            </div>
            <Button type="submit">Add location</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Locations</CardTitle>
              <CardDescription>{locations.length} tenant locations configured.</CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings">Back to settings</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {locations.map((location) => (
            <div key={location.id} className="rounded-md border p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{location.name}</p>
                    <Badge variant="outline">{location.code}</Badge>
                    <Badge variant="neutral">{formatType(location.location_type)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[location.address_line_1, location.area, location.city, location.state, location.postal_code].filter(Boolean).join(", ") || "No address saved"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog title="Edit location" description="Existing operational records keep this location reference." trigger={<span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">Edit</span>}>
                    <form action={updateTenantLocationAction} className="space-y-4" data-unsaved-guard="true">
                      <input type="hidden" name="locationId" value={location.id} />
                      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor={`edit-code-${location.id}`}>Code</Label><Input id={`edit-code-${location.id}`} name="code" defaultValue={location.code} required /></div><div className="space-y-1"><Label htmlFor={`edit-name-${location.id}`}>Name</Label><Input id={`edit-name-${location.id}`} name="name" defaultValue={location.name} required /></div></div>
                      <div className="space-y-1"><Label htmlFor={`edit-type-${location.id}`}>Type</Label><select id={`edit-type-${location.id}`} name="locationType" defaultValue={location.location_type} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{locationTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
                      <div className="space-y-1"><Label htmlFor={`edit-address1-${location.id}`}>Address line 1</Label><Input id={`edit-address1-${location.id}`} name="addressLine1" defaultValue={location.address_line_1 ?? ""} /></div>
                      <div className="space-y-1"><Label htmlFor={`edit-address2-${location.id}`}>Address line 2</Label><Input id={`edit-address2-${location.id}`} name="addressLine2" defaultValue={location.address_line_2 ?? ""} /></div>
                      <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor={`edit-area-${location.id}`}>Area</Label><Input id={`edit-area-${location.id}`} name="area" defaultValue={location.area ?? ""} /></div><div className="space-y-1"><Label htmlFor={`edit-city-${location.id}`}>City</Label><Input id={`edit-city-${location.id}`} name="city" defaultValue={location.city ?? ""} /></div></div>
                      <div className="grid gap-3 sm:grid-cols-3"><div className="space-y-1"><Label htmlFor={`edit-state-${location.id}`}>State</Label><Input id={`edit-state-${location.id}`} name="state" defaultValue={location.state ?? ""} /></div><div className="space-y-1"><Label htmlFor={`edit-postal-${location.id}`}>Postal code</Label><Input id={`edit-postal-${location.id}`} name="postalCode" defaultValue={location.postal_code ?? ""} /></div><div className="space-y-1"><Label htmlFor={`edit-country-${location.id}`}>Country</Label><Input id={`edit-country-${location.id}`} name="countryCode" defaultValue={location.country_code} maxLength={2} required /></div></div>
                      <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={location.is_active} className="h-4 w-4" />Active</label>
                      <Button type="submit">Save location</Button>
                    </form>
                  </Dialog>
                  <form action={archiveTenantLocationAction}><input type="hidden" name="locationId" value={location.id} /><Button type="submit" variant="outline" size="sm">Archive</Button></form>
                </div>
              </div>
            </div>
          ))}
          {!locations.length ? <p className="text-sm text-muted-foreground">No locations configured yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
