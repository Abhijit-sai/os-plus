import Link from "next/link";

import { createCustomerAction } from "@/features/customers/actions";
import { getCustomerPhoneSuggestions } from "@/features/customers/queries";
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

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams?: Promise<{ phone?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { suggestions, phone } = await getCustomerPhoneSuggestions(
    resolvedSearchParams?.phone,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Add customer</h2>
        <p className="text-muted-foreground">
          Create a reusable customer profile. Phone helps suggestions, but
          duplicates remain allowed.
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Phone suggestions</CardTitle>
            <CardDescription>
              Check for similar phone numbers before creating a new customer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={phone}
                  placeholder="Enter at least 3 digits"
                />
              </div>
              <Button type="submit" variant="outline">
                Check
              </Button>
            </form>
            <div className="space-y-2">
              {suggestions.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="block rounded-md border p-3 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium">{customer.name}</span>
                  <span className="block text-muted-foreground">
                    {customer.phone ?? "No phone"}
                  </span>
                </Link>
              ))}
              {phone.length >= 3 && !suggestions.length ? (
                <p className="text-sm text-muted-foreground">
                  No matching customers found.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Customer profile</CardTitle>
            <CardDescription>
              Name is required. Everything else can be filled as the
              relationship grows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={createCustomerAction}
              className="space-y-5"
              data-unsaved-guard="true"
            >
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ananya Sharma"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  name="phone"
                  defaultValue={phone}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Not set</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="not_specified">Not specified</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" placeholder="Optional" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" placeholder="Optional" />
              </div>
              <Button type="submit">Create customer</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
