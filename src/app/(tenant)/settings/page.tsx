import Link from "next/link";

import { seedConfigurationDefaultsAction } from "@/features/settings/actions";
import { getSettingsOverview } from "@/features/settings/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

export default async function SettingsPage() {
  const {
    context: { tenant, membership },
    itemTypes,
    stages,
    customerStatuses,
    workgroups,
    paymentModes,
    expenseCategories,
    measurementFields,
    communicationTemplates,
    tenantUsers,
    tenantLocations,
    teams
  } = await getSettingsOverview();

  const settingsCards = [
    { href: "/settings/business-profile", title: "Business profile", count: tenant.store_name, description: "Store name and brand color" },
    { href: "/settings/users", title: "Users and roles", count: tenantUsers.length, description: "Internal profiles and module access" },
    { href: "/settings/locations", title: "Locations", count: tenantLocations.length, description: "Stores, workshops, and operational sites" },
    { href: "/settings/teams", title: "Teams", count: teams.length, description: "Operational assignment groups" },
    { href: "/settings/item-types", title: "Item types", count: itemTypes.length, description: "Products such as shirts and blazers" },
    { href: "/settings/stages", title: "Stages", count: stages.length, description: "Internal production stage master" },
    {
      href: "/settings/customer-statuses",
      title: "Customer statuses",
      count: customerStatuses.length,
      description: "Safe customer-facing status labels"
    },
    { href: "/settings/workgroups", title: "Workgroups", count: workgroups.length, description: "Worker capability groups" },
    { href: "/settings/workflows", title: "Workflows", count: "Build", description: "Sequential item-level production flows" },
    {
      href: "/settings/measurement-standards",
      title: "Measurement standards",
      count: measurementFields.length,
      description: "Default fields by garment type"
    },
    {
      href: "/settings/communications",
      title: "Communications",
      count: communicationTemplates.length,
      description: "WhatsApp and email transaction alerts"
    },
    { href: "/settings/payment-modes", title: "Payment modes", count: paymentModes.length, description: "Cash, UPI, bank, card" },
    {
      href: "/settings/expense-categories",
      title: "Expense categories",
      count: expenseCategories.length,
      description: "Operational expense buckets"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Tenant-scoped configuration for {tenant.store_name}.</p>
        </div>
        <Dialog
          title="Seed default settings?"
          description="This adds missing starter records for item types, stages, customer statuses, workgroups, payment modes, and expense categories."
          trigger={<span className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent">Seed defaults</span>}
        >
          <form action={seedConfigurationDefaultsAction} className="space-y-4" data-unsaved-guard="true">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Existing active settings are kept. OS PLUS only creates defaults that are missing, so this is intended for setup or repair, not day-to-day use.
            </div>
            <Button type="submit">Confirm seed defaults</Button>
          </form>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{tenant.store_name}</CardTitle>
          <CardDescription>
            Tenant slug: {tenant.slug} · Role: {membership.role.replace("_", " ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md border" style={{ backgroundColor: tenant.brand_color ?? "#2563eb" }} />
            <span className="text-sm text-muted-foreground">{tenant.brand_color ?? "Default blue"}</span>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle className="text-lg">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{card.count}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
