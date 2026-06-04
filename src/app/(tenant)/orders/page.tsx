import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";

import { getOrdersPageData } from "@/features/orders/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/design-system/status-badge";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function formatEnum(value: string) {
  return value.replaceAll("_", " ");
}

function isDueSoon(value: string | null) {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(value);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = (dueDate.getTime() - today.getTime()) / 86_400_000;

  return diffDays >= 0 && diffDays <= 3;
}

function isOverdue(value: string | null) {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(value);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; payment?: string; status?: string; source?: string; view?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { orders, customers, orderItems, stageInstances, search } = await getOrdersPageData(resolvedSearchParams?.q);
  const paymentFilter = resolvedSearchParams?.payment ?? "all";
  const statusFilter = resolvedSearchParams?.status ?? "all";
  const sourceFilter = resolvedSearchParams?.source ?? "all";
  const viewFilter = resolvedSearchParams?.view ?? "active";
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const itemsByOrder = new Map<string, typeof orderItems>();
  const stageInstancesByItem = new Map<string, typeof stageInstances>();

  orderItems.forEach((item) => {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  });

  stageInstances.forEach((stage) => {
    stageInstancesByItem.set(stage.order_item_id, [...(stageInstancesByItem.get(stage.order_item_id) ?? []), stage]);
  });

  const baseFilteredOrders = orders.filter((order) => {
    const matchesPayment = paymentFilter === "all" || order.payment_status === paymentFilter;
    const matchesStatus = statusFilter === "all" || order.order_status === statusFilter;
    const matchesSource = sourceFilter === "all" || order.source === sourceFilter;

    return matchesPayment && matchesStatus && matchesSource;
  });
  const orderHasReadyOrDispatchItem = (orderId: string) =>
    (itemsByOrder.get(orderId) ?? []).some((item) =>
      ["completed", "ready_for_pickup", "ready_for_dispatch", "dispatched"].includes(item.item_status)
    );
  const orderHasDeliveredItem = (orderId: string) =>
    (itemsByOrder.get(orderId) ?? []).some((item) => item.item_status === "delivered");
  const visibleOrders = baseFilteredOrders.filter((order) => {
    if (viewFilter === "all") {
      return true;
    }

    if (viewFilter === "active") {
      return !["completed", "delivered", "cancelled"].includes(order.order_status);
    }

    if (viewFilter === "due_soon") {
      return !["completed", "delivered", "cancelled"].includes(order.order_status) && isDueSoon(order.promised_delivery_date);
    }

    if (viewFilter === "delayed") {
      return !["completed", "delivered", "cancelled"].includes(order.order_status) && isOverdue(order.promised_delivery_date);
    }

    if (viewFilter === "unpaid") {
      return order.payment_status === "unpaid";
    }

    if (viewFilter === "partially_paid") {
      return order.payment_status === "partially_paid";
    }

    if (viewFilter === "ready_dispatch") {
      return orderHasReadyOrDispatchItem(order.id) && !orderHasDeliveredItem(order.id);
    }

    if (viewFilter === "delivered") {
      return ["completed", "delivered"].includes(order.order_status) || orderHasDeliveredItem(order.id);
    }

    return true;
  });

  const productionByOrder = new Map(
    visibleOrders.map((order) => {
      const items = itemsByOrder.get(order.id) ?? [];
      const stageSets = items.map((item) => stageInstancesByItem.get(item.id) ?? []);
      const totalStages = stageSets.reduce((sum, stages) => sum + stages.length, 0);
      const completedStages = stageSets.reduce(
        (sum, stages) => sum + stages.filter((stage) => stage.status === "completed").length,
        0
      );
      const completedItems = items.filter((item) =>
        ["completed", "ready_for_pickup", "ready_for_dispatch", "dispatched", "delivered"].includes(item.item_status)
      ).length;
      const totalUnits = totalStages || items.length;
      const completedUnits = totalStages ? completedStages : completedItems;
      const percent = totalUnits ? Math.round((completedUnits / totalUnits) * 100) : 0;

      return [
        order.id,
        {
          label: totalStages ? `${completedStages}/${totalStages} stages` : `${completedItems}/${items.length} items`,
          percent
        }
      ];
    })
  );

  const openOrders = visibleOrders.filter((order) => !["completed", "delivered", "cancelled"].includes(order.order_status));
  const totalReceivable = visibleOrders.reduce(
    (sum, order) => sum + Math.max(Number(order.total_amount) - Number(order.amount_paid), 0),
    0
  );
  const dueSoonCount = openOrders.filter((order) => isDueSoon(order.promised_delivery_date)).length;
  const overdueCount = openOrders.filter((order) => isOverdue(order.promised_delivery_date)).length;
  const itemCount = visibleOrders.reduce((sum, order) => sum + (itemsByOrder.get(order.id)?.length ?? 0), 0);

  const paymentOptions = Array.from(new Set(orders.map((order) => order.payment_status)));
  const statusOptions = Array.from(new Set(orders.map((order) => order.order_status)));
  const sourceOptions = Array.from(new Set(orders.map((order) => order.source)));
  const hasFilters = Boolean(search) || paymentFilter !== "all" || statusFilter !== "all" || sourceFilter !== "all" || viewFilter !== "active";
  const selectClassName =
    "h-10 rounded-md border border-input bg-background px-3 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const filterFields = [
    { label: "Payment", name: "payment", value: paymentFilter, options: paymentOptions },
    { label: "Status", name: "status", value: statusFilter, options: statusOptions },
    { label: "Source", name: "source", value: sourceFilter, options: sourceOptions }
  ];
  const gridClassName =
    "grid gap-3 lg:grid-cols-[1.15fr_1fr_0.8fr_0.9fr_0.8fr_0.8fr_0.8fr_0.72fr_44px]";
  const buildViewHref = (view: string) => {
    const params = new URLSearchParams();

    if (search) {
      params.set("q", search);
    }

    if (paymentFilter !== "all") {
      params.set("payment", paymentFilter);
    }

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }

    if (sourceFilter !== "all") {
      params.set("source", sourceFilter);
    }

    if (view !== "active") {
      params.set("view", view);
    }

    const query = params.toString();
    return query ? `/orders?${query}` : "/orders";
  };
  const chipOrders = baseFilteredOrders;
  const chipActiveOrders = chipOrders.filter((order) => !["completed", "delivered", "cancelled"].includes(order.order_status));
  const orderChips = [
    { value: "active", label: "Active", count: chipActiveOrders.length, hint: "Open operations" },
    { value: "all", label: "All", count: chipOrders.length, hint: "Current search" },
    { value: "due_soon", label: "Due soon", count: chipActiveOrders.filter((order) => isDueSoon(order.promised_delivery_date)).length, hint: "Next 3 days" },
    { value: "delayed", label: "Delayed", count: chipActiveOrders.filter((order) => isOverdue(order.promised_delivery_date)).length, hint: "Past promised" },
    { value: "unpaid", label: "Unpaid", count: chipOrders.filter((order) => order.payment_status === "unpaid").length, hint: "No payment" },
    { value: "partially_paid", label: "Partially paid", count: chipOrders.filter((order) => order.payment_status === "partially_paid").length, hint: "Balance open" },
    { value: "ready_dispatch", label: "Ready / dispatch", count: chipOrders.filter((order) => orderHasReadyOrDispatchItem(order.id) && !orderHasDeliveredItem(order.id)).length, hint: "Handoff pending" },
    { value: "delivered", label: "Delivered", count: chipOrders.filter((order) => ["completed", "delivered"].includes(order.order_status) || orderHasDeliveredItem(order.id)).length, hint: "Completed handoff" }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        description="Commercial control room for customer orders, payments, dates, and item-level production."
        actions={
          <Button asChild>
            <Link href="/orders/new" className="gap-2">
              <Plus className="h-4 w-4" />
              Create order
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        {orderChips.map((chip) => {
          const selected = viewFilter === chip.value || (!resolvedSearchParams?.view && chip.value === "active");

          return (
            <Link
              key={chip.value}
              href={buildViewHref(chip.value)}
              className={`rounded-[14px] border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted/40 ${
                selected ? "border-primary ring-2 ring-primary/10" : ""
              }`}
            >
              <div className={`mb-3 h-1.5 w-10 rounded-full ${selected ? "bg-primary" : "bg-muted"}`} />
              <p className="text-xs font-medium text-muted-foreground">{chip.label}</p>
              <p className="mt-2 text-2xl font-semibold leading-none">{chip.count}</p>
              <p className="mt-2 text-xs text-muted-foreground">{chip.hint}</p>
            </Link>
          );
        })}
      </div>

      <form>
        <CommandBar className="items-end">
          <div className="min-w-[220px] flex-1">
              <Label htmlFor="q" className="sr-only">
              Order or customer
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                name="q"
                defaultValue={search}
                placeholder="Search order, customer, or phone"
                className="pl-9"
              />
            </div>
          </div>
          <input type="hidden" name="view" value={viewFilter} />
          {filterFields.map((field) => (
            <div key={field.name} className="grid gap-1">
              <Label htmlFor={field.name} className="text-xs text-muted-foreground">
                {field.label}
              </Label>
              <select id={field.name} name={field.name} defaultValue={field.value} className={selectClassName}>
                <option value="all">All</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {formatEnum(option)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <Button type="submit" variant="outline">
            Apply
          </Button>
          {hasFilters ? (
            <Button asChild type="button" variant="ghost">
              <Link href="/orders">Reset</Link>
            </Button>
          ) : null}
        </CommandBar>
      </form>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className={`${gridClassName} border-b px-4 py-3 text-xs font-medium uppercase text-muted-foreground`}>
            <span>Order</span>
            <span>Customer</span>
            <span>Payment</span>
            <span>Production</span>
            <span>Promised</span>
            <span>Source</span>
            <span>Receivable</span>
            <span>Items</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y">
            {visibleOrders.map((order) => {
              const customer = customerById.get(order.customer_id);
              const items = itemsByOrder.get(order.id) ?? [];
              const receivable = Math.max(Number(order.total_amount) - Number(order.amount_paid), 0);
              const production = productionByOrder.get(order.id);
              const promisedTone = isOverdue(order.promised_delivery_date)
                ? "text-destructive"
                : isDueSoon(order.promised_delivery_date)
                  ? "text-amber-700"
                  : "text-foreground";

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className={`${gridClassName} px-4 py-4 text-sm transition-colors hover:bg-muted/40 lg:items-center`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{order.order_number}</p>
                      <StatusBadge value={order.order_status} />
                    </div>
                    {order.reference_order_id ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">Ref {order.reference_order_id}</p>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-medium">{customer?.name ?? "Unknown customer"}</p>
                    <p className="truncate text-xs text-muted-foreground">{customer?.phone ?? "No phone"}</p>
                  </div>

                  <div className="space-y-1">
                    <StatusBadge value={order.payment_status} />
                    <p className="text-xs text-muted-foreground">
                      ₹{formatMoney(order.amount_paid)} / ₹{formatMoney(order.total_amount)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${production?.percent ?? 0}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{production?.label ?? "0/0 items"}</p>
                  </div>

                  <div>
                    <p className={`font-medium ${promisedTone}`}>{formatDate(order.promised_delivery_date)}</p>
                    <p className="text-xs capitalize text-muted-foreground">{formatEnum(order.delivery_type)}</p>
                  </div>

                  <p className="capitalize text-muted-foreground">{formatEnum(order.source)}</p>

                  <div>
                    <p className="font-medium">₹{formatMoney(receivable)}</p>
                    <p className="text-xs text-muted-foreground">Balance</p>
                  </div>

                  <p className="text-muted-foreground">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </p>

                  <div className="hidden justify-end lg:flex">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
          {!visibleOrders.length ? (
            <div className="p-8 text-center">
              <p className="font-medium">No orders found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try changing the search or filter set.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
