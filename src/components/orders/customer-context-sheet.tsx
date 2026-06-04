"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";

import { StatusBadge } from "@/components/design-system/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Customer, CustomerMeasurement, Json, Order, OrderItem } from "@/types/database";

type CustomerContextOrder = Pick<
  Order,
  | "id"
  | "order_number"
  | "order_date"
  | "promised_delivery_date"
  | "total_amount"
  | "amount_paid"
  | "payment_status"
  | "order_status"
>;

type CustomerContextOrderItem = Pick<OrderItem, "id" | "order_id">;

function getMeasurementEntries(measurementData: Json) {
  if (!measurementData || Array.isArray(measurementData) || typeof measurementData !== "object") {
    return [];
  }

  return Object.entries(measurementData).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function CustomerContextSheet({
  customer,
  measurements,
  orders,
  orderItems,
  currentOrderId
}: {
  customer: Customer | null;
  measurements: CustomerMeasurement[];
  orders: CustomerContextOrder[];
  orderItems: CustomerContextOrderItem[];
  currentOrderId: string;
}) {
  const [open, setOpen] = useState(false);
  const itemCountByOrder = useMemo(() => {
    const counts = new Map<string, number>();

    orderItems.forEach((item) => {
      counts.set(item.order_id, (counts.get(item.order_id) ?? 0) + 1);
    });

    return counts;
  }, [orderItems]);
  const totalSpend = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const totalReceivable = orders.reduce(
    (sum, order) => sum + Math.max(Number(order.total_amount) - Number(order.amount_paid), 0),
    0
  );

  if (!customer) {
    return <span>Unknown customer</span>;
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
      >
        {customer.name}
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close customer context"
            className="absolute inset-0 cursor-default bg-black/20"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-muted-foreground">Customer</p>
                <h2 className="mt-1 truncate text-xl font-semibold">{customer.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{customer.phone ?? "No phone"} · {customer.email ?? "No email"}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Orders</p>
                  <p className="mt-2 text-xl font-semibold">{orders.length}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Total value</p>
                  <p className="mt-2 text-xl font-semibold">₹{formatMoney(totalSpend)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Receivable</p>
                  <p className="mt-2 text-xl font-semibold">₹{formatMoney(totalReceivable)}</p>
                </div>
              </div>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Profile</h3>
                  <p className="text-sm text-muted-foreground">Read-only customer context for this tenant.</p>
                </div>
                <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="font-medium">Gender</p>
                    <p className="capitalize text-muted-foreground">{customer.gender?.replaceAll("_", " ") ?? "Not set"}</p>
                  </div>
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-muted-foreground">{customer.address ?? "Not set"}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="font-medium">Notes</p>
                    <p className="text-muted-foreground">{customer.notes ?? "No notes"}</p>
                  </div>
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Existing measurements</h3>
                    <p className="text-sm text-muted-foreground">Latest saved records for production reference.</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/customers/${customer.id}`}>Open all</Link>
                  </Button>
                </div>

                <div className="space-y-2">
                  {measurements.slice(0, 4).map((measurement) => {
                    const entries = getMeasurementEntries(measurement.measurement_data_json).slice(0, 6);

                    return (
                      <div key={measurement.id} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{measurement.reference_name ?? "Measurement"}</p>
                            <p className="text-xs text-muted-foreground">Updated {formatDate(measurement.updated_at.slice(0, 10))}</p>
                          </div>
                          {measurement.is_default ? <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-xs text-white">default</span> : null}
                        </div>
                        {entries.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {entries.map(([key, value]) => (
                              <div key={key} className="rounded-md bg-muted px-2 py-1 text-xs">
                                <span className="font-medium">{key}</span>
                                <span className="text-muted-foreground">: {value}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">No fields saved.</p>
                        )}
                      </div>
                    );
                  })}
                  {!measurements.length ? <p className="rounded-md border p-3 text-sm text-muted-foreground">No measurements saved for this customer.</p> : null}
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Recent orders</h3>
                    <p className="text-sm text-muted-foreground">Latest tenant-scoped orders for this customer.</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/customers/${customer.id}`}>Open profile</Link>
                  </Button>
                </div>

                <div className="space-y-2">
                  {orders.map((order) => {
                    const receivable = Math.max(Number(order.total_amount) - Number(order.amount_paid), 0);

                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="block rounded-md border p-3 transition-colors hover:bg-muted/40"
                        onClick={() => setOpen(false)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{order.order_number}</p>
                            {order.id === currentOrderId ? (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Current</span>
                            ) : null}
                          </div>
                          <p className="text-sm font-medium">₹{formatMoney(order.total_amount)}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge value={order.order_status} />
                          <StatusBadge value={order.payment_status} />
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                          <p>Ordered {formatDate(order.order_date)}</p>
                          <p>Promised {formatDate(order.promised_delivery_date)}</p>
                          <p>
                            {itemCountByOrder.get(order.id) ?? 0} item
                            {(itemCountByOrder.get(order.id) ?? 0) === 1 ? "" : "s"} · ₹{formatMoney(receivable)} due
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                  {!orders.length ? <p className="rounded-md border p-3 text-sm text-muted-foreground">No previous orders found.</p> : null}
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
