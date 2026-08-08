import Link from "next/link";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

import {
  archiveCustomerAddressAction,
  archiveCustomerMeasurementAction,
  createCustomerAddressAction,
  createCustomerMeasurementAction,
  setDefaultCustomerMeasurementAction,
  updateCustomerAction,
  updateCustomerMeasurementAction,
} from "@/features/customers/actions";
import { getCustomerDetailPageData } from "@/features/customers/queries";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { CustomerMeasurementForm } from "@/components/customers/customer-measurement-form";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemTypeMeasurementField, Json } from "@/types/database";

function getMeasurementEntries(measurementData: Json) {
  if (
    !measurementData ||
    Array.isArray(measurementData) ||
    typeof measurementData !== "object"
  ) {
    return [];
  }

  return Object.entries(measurementData).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

function formatMeasurementEntries({
  entries,
  standards,
}: {
  entries: [string, string][];
  standards: ItemTypeMeasurementField[];
}) {
  const standardByKey = new Map(
    standards.map((field) => [field.field_key, field]),
  );
  const standardKeyOrder = new Map(
    standards.map((field, index) => [field.field_key, index]),
  );

  return [...entries]
    .sort(([firstKey], [secondKey]) => {
      const firstIndex =
        standardKeyOrder.get(firstKey) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex =
        standardKeyOrder.get(secondKey) ?? Number.MAX_SAFE_INTEGER;

      if (firstIndex !== secondIndex) {
        return firstIndex - secondIndex;
      }

      return firstKey.localeCompare(secondKey);
    })
    .map(([key, value]) => {
      const standard = standardByKey.get(key);

      return {
        key,
        label: standard?.field_label ?? key,
        unit: standard?.unit ?? null,
        value,
      };
    });
}

function formatDate(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatDateTime(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function ActionTrigger({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <span
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium shadow-sm transition-colors ${
        variant === "outline"
          ? "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      }`}
    >
      {children}
    </span>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const {
    customer,
    customerAddresses,
    customerAttachments,
    itemTypes,
    measurementFields,
    measurements,
    orderHistoryRows,
    summary,
  } = await getCustomerDetailPageData(customerId);
  const itemTypeById = new Map(
    itemTypes.map((itemType) => [itemType.id, itemType]),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={customer.name}
        description={`${customer.phone ?? "No phone"}${customer.email ? ` · ${customer.email}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/customers">
                <ArrowLeft className="h-4 w-4" />
                Customers
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/orders/new?customerId=${customer.id}`}>
                <Plus className="h-4 w-4" />
                Create order
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total orders"
          value={summary.totalOrders}
          hint={`${summary.activeOrders} active`}
        />
        <MetricCard
          label="Total booked"
          value={formatMoney(summary.totalBooked)}
          hint="Order value"
        />
        <MetricCard
          label="Pending balance"
          value={formatMoney(summary.pendingAmount)}
          hint={`${formatMoney(summary.totalPaid)} paid`}
        />
        <MetricCard
          label="Measurements"
          value={summary.measurementCount}
          hint={`${summary.defaultMeasurements} defaults saved`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>
                    Contact details and working notes for repeat orders.
                  </CardDescription>
                </div>
                <Dialog
                  title="Edit customer details"
                  description="Update the customer profile. Changes stay tenant-scoped."
                  trigger={
                    <ActionTrigger variant="outline">
                      <Pencil className="h-4 w-4" />
                      Edit details
                    </ActionTrigger>
                  }
                >
                  <form
                    action={updateCustomerAction}
                    className="space-y-4"
                    data-unsaved-guard="true"
                  >
                    <input
                      type="hidden"
                      name="customerId"
                      value={customer.id}
                    />
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={customer.name}
                        required
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          name="phone"
                          defaultValue={customer.phone ?? ""}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          defaultValue={customer.email ?? ""}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gender">Gender</Label>
                      <select
                        id="gender"
                        name="gender"
                        defaultValue={customer.gender ?? ""}
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
                      <Input
                        id="address"
                        name="address"
                        defaultValue={customer.address ?? ""}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        name="notes"
                        defaultValue={customer.notes ?? ""}
                        placeholder="Fit preferences, relationship notes, reminders"
                      />
                    </div>
                    <Button type="submit">Save details</Button>
                  </form>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Phone
                  </p>
                  <p className="mt-1 font-medium">
                    {customer.phone ?? "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-1 font-medium">
                    {customer.email ?? "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Gender
                  </p>
                  <p className="mt-1 font-medium">
                    {customer.gender?.replace("_", " ") ?? "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Address
                  </p>
                  <p className="mt-1 font-medium">
                    {customer.address ?? "Not set"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 rounded-md border bg-muted/30 px-3 py-2">
                  {customer.notes ?? "No notes saved."}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Saved addresses</CardTitle>
                  <CardDescription>
                    Reusable customer addresses for pickup and delivery.
                  </CardDescription>
                </div>
                <Dialog
                  title="Add customer address"
                  description="Add a tenant-scoped address for this customer."
                  trigger={
                    <ActionTrigger>
                      <Plus className="h-4 w-4" />
                      Add address
                    </ActionTrigger>
                  }
                >
                  <form className="space-y-3" data-unsaved-guard="true">
                    <input type="hidden" name="customerId" value={customer.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="address-label">Label</Label>
                        <Input id="address-label" name="label" placeholder="Home" required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="address-country">Country</Label>
                        <Input id="address-country" name="countryCode" defaultValue="IN" maxLength={2} required />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="address-line-1">Address line 1</Label>
                      <Input id="address-line-1" name="addressLine1" required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="address-line-2">Address line 2</Label>
                      <Input id="address-line-2" name="addressLine2" placeholder="Optional" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="address-area">Area</Label>
                        <Input id="address-area" name="area" placeholder="Optional" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="address-city">City</Label>
                        <Input id="address-city" name="city" placeholder="Optional" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="address-state">State</Label>
                        <Input id="address-state" name="state" placeholder="Optional" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="address-postal-code">Postal code</Label>
                        <Input id="address-postal-code" name="postalCode" placeholder="Optional" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="address-landmark">Landmark</Label>
                      <Input id="address-landmark" name="landmark" placeholder="Optional" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="address-notes">Notes</Label>
                      <Input id="address-notes" name="notes" placeholder="Optional" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="isDefault" className="h-4 w-4 rounded border" />
                      Set as default
                    </label>
                    <Button type="submit" formAction={createCustomerAddressAction}>
                      Add address
                    </Button>
                  </form>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.address ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Legacy profile address</p>
                  <p className="mt-1 text-muted-foreground">{customer.address}</p>
                </div>
              ) : null}
              {customerAddresses.map((address) => (
                <div key={address.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{address.label}</p>
                        {address.is_default ? (
                          <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">default</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {[address.address_line_1, address.address_line_2, address.area, address.city, address.state, address.postal_code].filter(Boolean).join(", ")}
                      </p>
                      {address.landmark ? <p className="mt-1 text-xs text-muted-foreground">Landmark: {address.landmark}</p> : null}
                    </div>
                    <form>
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="addressId" value={address.id} />
                      <Button type="submit" formAction={archiveCustomerAddressAction} size="sm" variant="outline">
                        Archive
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
              {!customer.address && !customerAddresses.length ? (
                <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
              ) : null}
            </CardContent>
          </Card>
          <AttachmentPanel
            attachments={customerAttachments}
            description="Measurement cards, design references, and customer-level documents for internal staff."
            entityId={customer.id}
            entityType="customer"
          />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Order history</CardTitle>
              <CardDescription>
                Commercial history and pending balance for this customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 border-y px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[1fr_0.9fr_0.8fr_0.8fr_0.8fr]">
                <span>Order</span>
                <span>Date</span>
                <span>Status</span>
                <span>Items</span>
                <span>Pending</span>
              </div>
              <div className="divide-y">
                {orderHistoryRows.map((row) => (
                  <Dialog
                    key={row.order.id}
                    title={row.order.order_number}
                    description="Customer order summary"
                    placement="side"
                    trigger={
                      <span className="grid cursor-pointer gap-3 px-4 py-3 text-sm transition hover:bg-muted/50 md:grid-cols-[1fr_0.9fr_0.8fr_0.8fr_0.8fr] md:items-center">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {row.order.order_number}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatMoney(row.totalAmount)} booked
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(row.order.order_date)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatStatus(row.order.order_status)}
                        </span>
                        <span className="text-muted-foreground">
                          {row.itemCount}
                        </span>
                        <span
                          className={
                            row.pendingAmount > 0
                              ? "font-medium text-destructive"
                              : "font-medium"
                          }
                        >
                          {formatMoney(row.pendingAmount)}
                        </span>
                      </span>
                    }
                  >
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricCard
                          label="Order total"
                          value={formatMoney(row.totalAmount)}
                          hint={formatStatus(row.order.payment_status)}
                        />
                        <MetricCard
                          label="Pending"
                          value={formatMoney(row.pendingAmount)}
                          hint={`${formatMoney(row.amountPaid)} paid`}
                        />
                        <MetricCard
                          label="Items"
                          value={row.itemCount}
                          hint={formatStatus(row.order.order_status)}
                        />
                        <MetricCard
                          label="Promised date"
                          value={formatDate(row.order.promised_delivery_date)}
                        />
                      </div>
                      <Card>
                        <CardHeader>
                          <CardTitle>Order details</CardTitle>
                          <CardDescription>
                            Summary from this customer profile.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Order date
                            </p>
                            <p className="mt-1 font-medium">
                              {formatDate(row.order.order_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Delivery type
                            </p>
                            <p className="mt-1 font-medium">
                              {formatStatus(row.order.delivery_type)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Order status
                            </p>
                            <p className="mt-1 font-medium">
                              {formatStatus(row.order.order_status)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              Payment status
                            </p>
                            <p className="mt-1 font-medium">
                              {formatStatus(row.order.payment_status)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      <Button asChild>
                        <Link href={`/orders/${row.order.id}`}>
                          Open full order
                        </Link>
                      </Button>
                    </div>
                  </Dialog>
                ))}
                {!orderHistoryRows.length ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    No orders for this customer yet.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Measurements</CardTitle>
                  <CardDescription>
                    Multiple records are allowed. Keep one default per garment
                    type when useful.
                  </CardDescription>
                </div>
                <Dialog
                  title="Add measurement"
                  description="Create a named measurement record so it is easy to identify later."
                  className="max-w-2xl"
                  trigger={
                    <ActionTrigger>
                      <Plus className="h-4 w-4" />
                      Add measurement
                    </ActionTrigger>
                  }
                >
                  <CustomerMeasurementForm
                    action={createCustomerMeasurementAction}
                    customerId={customer.id}
                    itemTypes={itemTypes}
                    measurementFields={measurementFields}
                  />
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {measurements.map((measurement) => {
                const entries = getMeasurementEntries(
                  measurement.measurement_data_json,
                );
                const itemType = measurement.item_type_id
                  ? itemTypeById.get(measurement.item_type_id)
                  : null;
                const standards = measurement.item_type_id
                  ? measurementFields
                      .filter(
                        (field) =>
                          field.item_type_id === measurement.item_type_id,
                      )
                      .sort((a, b) => a.sort_order - b.sort_order)
                  : [];
                const displayEntries = formatMeasurementEntries({
                  entries,
                  standards,
                });

                return (
                  <div key={measurement.id} className="rounded-md border p-4">
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {measurement.reference_name ??
                            itemType?.name ??
                            "General measurement"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {itemType?.name ?? "General measurement"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {measurement.notes ?? "No notes"}
                        </p>
                      </div>
                      {measurement.is_default ? (
                        <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">
                          default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        Created {formatDateTime(measurement.created_at)}
                      </span>
                      <span>
                        Updated {formatDateTime(measurement.updated_at)}
                      </span>
                    </div>
                    {entries.length ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {displayEntries.map(({ key, label, unit, value }) => (
                          <div
                            key={key}
                            className="rounded-md bg-muted px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{label}</span>
                            <span className="text-muted-foreground">
                              : {value}
                              {unit ? ` ${unit}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No key-value fields saved.
                      </p>
                    )}
                    {measurement.photo_url ? (
                      <p className="mt-3 truncate text-sm text-muted-foreground">
                        Photo: {measurement.photo_url}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {!measurement.is_default ? (
                        <form action={setDefaultCustomerMeasurementAction}>
                          <input
                            type="hidden"
                            name="customerId"
                            value={customer.id}
                          />
                          <input
                            type="hidden"
                            name="measurementId"
                            value={measurement.id}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Make default
                          </Button>
                        </form>
                      ) : null}
                      <form action={archiveCustomerMeasurementAction}>
                        <input
                          type="hidden"
                          name="customerId"
                          value={customer.id}
                        />
                        <input
                          type="hidden"
                          name="measurementId"
                          value={measurement.id}
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Archive
                        </Button>
                      </form>
                      <Dialog
                        title="Edit measurement"
                        description="Update this saved measurement record."
                        className="max-w-2xl"
                        trigger={
                          <ActionTrigger variant="outline">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </ActionTrigger>
                        }
                      >
                        <CustomerMeasurementForm
                          action={updateCustomerMeasurementAction}
                          customerId={customer.id}
                          itemTypes={itemTypes}
                          measurement={measurement}
                          measurementFields={measurementFields}
                        />
                      </Dialog>
                    </div>
                  </div>
                );
              })}
              {!measurements.length ? (
                <p className="text-sm text-muted-foreground">
                  No measurements yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
