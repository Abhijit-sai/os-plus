import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { getCustomersPageData } from "@/features/customers/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function formatDate(date: string | null) {
  if (!date) {
    return "No orders yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export default async function CustomersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { customerRows, search } = await getCustomersPageData(resolvedSearchParams?.q);
  const totalPending = customerRows.reduce((total, row) => total + row.pendingAmount, 0);
  const activeCustomers = customerRows.filter((row) => row.activeOrders > 0).length;
  const measurementReady = customerRows.filter((row) => row.measurementCount > 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Customer profiles, measurement readiness, repeat orders, and pending balances."
        actions={
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="h-4 w-4" />
              Add customer
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Customers shown" value={customerRows.length} hint={search ? `Matching "${search}"` : "Recent customer records"} />
        <MetricCard label="Active customers" value={activeCustomers} hint="Have open orders" />
        <MetricCard label="Pending balance" value={formatMoney(totalPending)} hint={`${measurementReady} with measurements saved`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find customers</CardTitle>
          <CardDescription>
            Search by name or phone. A matching normalized mobile number reuses
            the existing tenant customer instead of creating a duplicate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2">
              <Label htmlFor="q">Name or phone</Label>
              <Input id="q" name="q" defaultValue={search} placeholder="Search customers" />
            </div>
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer workspace</CardTitle>
          <CardDescription>Open a customer to view orders, dues, profile notes, and measurements.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customerRows.map((row) => (
            <Link
              key={row.customer.id}
              href={`/customers/${row.customer.id}`}
              className="block rounded-md border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.customer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.customer.phone ?? "No phone"}{row.customer.email ? ` · ${row.customer.email}` : ""}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{row.orderCount} orders</p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.lastOrderDate)}</p>
                </div>
                <div className="text-sm">
                  <p className={row.pendingAmount > 0 ? "font-medium text-destructive" : "font-medium"}>{formatMoney(row.pendingAmount)}</p>
                  <p className="text-xs text-muted-foreground">{row.activeOrders} active orders</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{row.measurementCount} measurements</p>
                  <p className="text-xs text-muted-foreground">{row.customer.gender?.replace("_", " ") ?? "Gender not set"}</p>
                </div>
              </div>
            </Link>
          ))}
          {!customerRows.length ? <p className="text-sm text-muted-foreground">No customers found.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
