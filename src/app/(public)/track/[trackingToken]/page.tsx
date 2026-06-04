import { getPublicTrackingPageData } from "@/features/tracking/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function titleCase(value: string) {
  return formatStatus(value)
    .split(" ")
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

export default async function TrackingPage({
  params
}: {
  params: Promise<{ trackingToken: string }>;
}) {
  const { trackingToken } = await params;
  const { tenant, order, items, customerStatuses, itemTypes } = await getPublicTrackingPageData(trackingToken);
  const statusById = new Map(customerStatuses.map((status) => [status.id, status]));
  const itemTypeById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
  const completedItems = items.filter((item) => {
    const customerStatus = item.customer_status_id ? statusById.get(item.customer_status_id) : null;
    return customerStatus?.is_final_status || item.item_status === "completed" || item.item_status === "delivered";
  }).length;
  const progressPercent = items.length ? Math.round((completedItems / items.length) * 100) : 0;
  const deliveredItems = items.filter((item) => item.item_status === "delivered").length;
  const publicOrderStatus =
    items.length && deliveredItems === items.length
      ? "delivered"
      : deliveredItems > 0
        ? "partially delivered"
        : completedItems === items.length && items.length
          ? "ready"
          : formatStatus(order.order_status);

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-md border bg-background p-5">
          <div className="flex items-center gap-3">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logo_url} alt={tenant.store_name} className="h-11 w-11 rounded-md object-cover" />
            ) : (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-md text-sm font-semibold text-white"
                style={{ backgroundColor: tenant.brand_color ?? "#2563eb" }}
              >
                {tenant.store_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Order tracking</p>
              <h1 className="text-xl font-semibold">{tenant.store_name}</h1>
            </div>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>{order.order_number}</CardTitle>
            <CardDescription>{titleCase(publicOrderStatus)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="font-medium">Order date</p>
                <p className="text-muted-foreground">{formatDate(order.order_date)}</p>
              </div>
              <div>
                <p className="font-medium">Expected delivery</p>
                <p className="text-muted-foreground">{formatDate(order.promised_delivery_date)}</p>
              </div>
              <div>
                <p className="font-medium">Delivery type</p>
                <p className="text-muted-foreground">{formatStatus(order.delivery_type)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium">Overall progress</p>
                <p className="text-muted-foreground">{progressPercent}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: tenant.brand_color ?? "#2563eb" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>Latest item updates from the boutique.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => {
              const customerStatus = item.customer_status_id ? statusById.get(item.customer_status_id)?.name : null;
              const itemType = itemTypeById.get(item.item_type_id)?.name;
              return (
                <div key={item.id} className="rounded-md border p-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {itemType ?? "Item"} · Qty {item.quantity}
                      </p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {customerStatus ?? titleCase(item.item_status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p className="text-muted-foreground">Expected {formatDate(item.expected_completion_date)}</p>
                    <p className="text-muted-foreground">
                      Delivery {item.delivery_type_override ? formatStatus(item.delivery_type_override) : formatStatus(order.delivery_type)}
                    </p>
                  </div>
                  {item.final_photo_url ? (
                    <div className="mt-3 overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.final_photo_url} alt={item.name} className="h-auto w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!items.length ? <p className="text-sm text-muted-foreground">No public item updates are available yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
