import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { seedConfigurationDefaultsAction } from "@/features/settings/actions";
import { getSettingsOverview } from "@/features/settings/queries";
import { Button } from "@/components/ui/button";
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
      <p className="text-sm text-muted-foreground">Changes apply to this business only. Your role: {membership.role === "owner_admin" ? "Owner/Admin" : membership.role}.</p>
      <div className="grid gap-2 md:grid-cols-2">
        {settingsCards.map((card) => (
          <Link key={card.href} href={card.href} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">{card.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
            </div>
            {typeof card.count === "number" ? <span className="text-sm tabular-nums text-muted-foreground">{card.count}</span> : null}
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
