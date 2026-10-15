import type { ShopifyPaymentDisplay } from "@/integrations/shopify/source-payment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function money(amount: string, currency: string) {
  const negative = amount.startsWith("-");
  const [whole, fraction] = (negative ? amount.slice(1) : amount).split(".");
  const grouped = new Intl.NumberFormat("en-IN").format(BigInt(whole));
  return `${currency} ${negative ? "−" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}
function observed(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

export function ShopifyPaymentPanel({ payment }: { payment: ShopifyPaymentDisplay }) {
  return <Card>
    <CardHeader>
      <CardTitle>Shopify payment summary</CardTitle>
      <CardDescription>Read-only source facts. Excluded from OS PLUS cash, receivables and GST totals.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {payment.availability === "unavailable" ? <p className="text-sm" role="status">Payment details are unavailable because no complete, verified source snapshot could be read. Ask the owner to check the connection and source access; do not assume a zero payment.</p> : <>
        <div>
          <p className="font-medium">{payment.statusLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Observed {observed(payment.observedAt)} IST · not a live Shopify balance</p>
        </div>
        {payment.validation === "review" ? <p className="rounded-md border border-destructive/30 p-3 text-sm" role="alert">The reported status or payment totals need owner review. Values below are Shopify-reported facts, not verified cash receipts.</p> : null}
        {payment.productionHeld ? <p className="text-sm">Production is held for owner review. This is the latest source observation, not a change to the accepted OS PLUS items or production value.</p> : null}
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ["Shopify order total", payment.amounts.total],
            ["Received · Shopify-reported", payment.amounts.received],
            ["Refunded · Shopify-reported", payment.amounts.refunded],
            ["Net payment · received less refunds", payment.amounts.net],
            ["Outstanding · Shopify-reported", payment.amounts.outstanding],
          ] as const).map(([label, amount]) => <div key={label} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words text-base font-medium tabular-nums">{money(amount, payment.currency)}</dd>
          </div>)}
        </dl>
        <p className="text-xs text-muted-foreground">The Shopify total includes source shipping and tax where applicable; it is separate from production merchandise value. Negative outstanding means Shopify reports money due back to the customer. Authorization or pending status is not confirmation of captured payment.</p>
        {payment.presentmentCurrency !== payment.currency ? <details className="text-sm">
          <summary className="cursor-pointer py-2">Buyer currency · {payment.presentmentCurrency}</summary>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            {Object.entries(payment.presentmentAmounts).map(([label, amount]) => <div key={label} className="min-w-0">
              <dt className="capitalize text-muted-foreground">{label}</dt>
              <dd className="break-words tabular-nums">{money(amount, payment.presentmentCurrency)}</dd>
            </div>)}
          </dl>
        </details> : null}
      </>}
    </CardContent>
  </Card>;
}
