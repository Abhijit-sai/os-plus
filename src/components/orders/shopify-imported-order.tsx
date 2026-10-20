import Link from "next/link";
import type { ImportedShopifyOrder } from "@/integrations/shopify/imported-order";
import { ShopifyPaymentPanel } from "@/components/orders/shopify-payment-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CommandBar } from "@/components/layout/command-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ShopifyImagePreview } from "@/components/orders/shopify-image-preview";

const unavailable = { expired: "Test source retention has expired.", partial: "Order details are still being fetched from Shopify.",
  unavailable: "Source details are unavailable. Ask an administrator to check the connection." };

export function ShopifyImportedOrder({ order, embedded=false, setup }: { order: ImportedShopifyOrder;embedded?:boolean;setup?:ReactNode }) {
  return <div className="min-w-0 space-y-5">
    {!embedded&&<PageHeader title={order.number} description="Imported from Shopify · Draft — needs setup"
      actions={<Button asChild variant="outline"><Link href="/orders">Back to orders</Link></Button>}/>}
    {order.availability !== "available" ? <p role="status">{unavailable[order.availability]}</p> : <>
      {!embedded&&<CommandBar><span className="px-2 text-sm">Shopify customer · {order.customer.name}</span>
        <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">Draft — needs setup</span>
        <span className="px-2 text-sm">Payment · {order.payment.statusLabel}</span>
        <span className="px-2 text-sm">Reference order ID · {order.sourceNumber}</span></CommandBar>}
      {!embedded&&setup}
      {!embedded&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard className="min-w-0 break-words" label="Order total" value={`${order.currency} ${order.payment.amounts?.total ?? "—"}`} hint="Shopify-reported"/>
        <MetricCard className="min-w-0 break-words" label="Amount paid" value={`${order.currency} ${order.payment.amounts?.net ?? "—"}`} hint="Shopify net payment · not a local receipt"/>
        <MetricCard label="Production" value="Not started" hint="Complete the pending actions to begin"/>
        <MetricCard label="Garments" value={order.lines.length} hint="Imported line items"/>
      </div>}
      <div className={!embedded?"grid gap-5 xl:grid-cols-2":""}>
      <Card><CardHeader><CardTitle>Commercial summary</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
        <div><h2 className="font-medium">Reference order ID</h2><p>{order.sourceNumber}</p></div>
        <div><h2 className="font-medium">Shopify customer</h2><p>{order.customer.name}</p>
          <p className="break-words text-sm">{order.customer.email}</p><p>{order.customer.phone}</p></div>
        <div><h2 className="font-medium">Shopify status</h2><p>{order.cancelledAt ? "Cancelled" : order.fulfillmentStatus.replaceAll("_", " ").toLowerCase()}</p>
          <p className="text-sm text-muted-foreground">Ordered {new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div>
        {[{ label: "Shipping address", address: order.shippingAddress }, { label: "Billing address", address: order.billingAddress }].map(({ label, address }) =>
          <div key={label}><h2 className="font-medium">{label}</h2><p className="whitespace-pre-line break-words text-sm">{address ?
            [address.firstName, address.lastName].filter(Boolean).join(" ") + "\n" + [address.address1, address.address2, address.city, address.province, address.zip, address.countryCodeV2].filter(Boolean).join(", ") : "Not provided by Shopify"}</p>
            {address?.phone && <p className="text-sm">Contact phone: {address.phone}</p>}</div>)}
        {order.note && <div className="sm:col-span-2"><h2 className="font-medium">Order notes</h2><p className="whitespace-pre-wrap break-words">{order.note}</p></div>}
      </CardContent></Card>
      {!embedded&&<ShopifyPaymentPanel payment={order.payment}/>}
      </div>
      {(!setup||embedded)&&<Card><CardHeader><CardTitle>Items from Shopify</CardTitle></CardHeader><CardContent className="space-y-4">
        {order.lines.map(line => <div key={line.id} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
          <ShopifyImagePreview image={line.image} title={line.title}/>
          <div className="flex flex-wrap justify-between gap-2"><h2 className="font-medium break-words">{line.title}</h2><p>Quantity {line.quantity}</p></div>
          <p className="break-words text-sm text-muted-foreground">{[line.variant, line.sku].filter(Boolean).join(" · ")}</p>
          <p className="text-sm">Original unit price: {line.unitCurrency} {line.unitPrice}</p>
          <p className="text-sm">Current line subtotal after discounts, before tax: {line.unitCurrency} {line.currentLineSubtotal}</p>
          {line.currentQuantity !== line.quantity && <p className="text-sm">Current quantity: {line.currentQuantity}</p>}
          {line.properties.length > 0 && <dl className="space-y-2">{line.properties.map((property, index) => <div key={index} className="break-words text-sm"><dt className="font-medium">{property.name}</dt><dd>{property.value}</dd></div>)}</dl>}
        </div>)}
        {!embedded&&<p className="text-sm text-muted-foreground">No workflow or worker has been assigned by this import. Production setup is a separate team action.</p>}
      </CardContent></Card>}
      <p className="text-sm text-muted-foreground">Shopify source amounts: subtotal {order.currency} {order.subtotal} · discount {order.discount} · shipping {order.shipping} · tax {order.tax}. No local receipt, GST posting or customer message was created.</p>
    </>}
  </div>;
}

export function ShopifyImportedOrderList({ orders }: { orders: ImportedShopifyOrder[] }) {
  if (!orders.length) return null;
  return <Card><CardHeader><CardTitle>Imported from Shopify</CardTitle>
    <p className="text-sm text-muted-foreground">Up to 50 matching imports awaiting production setup. No mapping or release is needed to view an order. These are separate from operational totals below.</p>
  </CardHeader><CardContent className="divide-y">
    {orders.map(order => <Link key={order.id} href={`/orders/${order.id}`} className="flex min-h-11 flex-wrap justify-between gap-3 py-4 hover:underline">
      <div><p className="font-medium">{order.number}{order.availability === "available" ? ` · ${order.sourceNumber}` : ""}</p>
        <p className="text-sm text-muted-foreground">{order.availability === "available" ? order.customer.name : unavailable[order.availability]}</p></div>
      <div className="text-sm">{order.availability === "available" && <p>{order.payment.statusLabel} · {order.payment.currency} {order.payment.amounts.total}</p>}
        <p className="text-muted-foreground">Production not assigned</p></div>
    </Link>)}
  </CardContent></Card>;
}
