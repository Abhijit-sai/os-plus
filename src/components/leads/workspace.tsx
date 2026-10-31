import Link from "next/link";
import { replyState } from "@/features/leads/editor-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { LeadView } from "@/features/leads/pii";
export const fieldClass =
  "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm";
export const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function LeadNavigation({ reports = false }: { reports?: boolean }) {
  return (
    <nav aria-label="Enquiry workspace" className="flex flex-wrap gap-2">
      <Link className={linkClass} href="/leads">
        Enquiries
      </Link>
      <Link className={linkClass} href="/leads/contacts">
        Contacts
      </Link>
      {reports ? (
        <Link className={linkClass} href="/leads/performance">
          Performance
        </Link>
      ) : null}
    </nav>
  );
}
export function duration(seconds: number | null) {
  if (seconds === null) return "No reply yet";
  if (seconds < 60) return "Less than a minute";
  if (seconds < 3600) return Math.floor(seconds / 60) + " min";
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hr";
  return Math.floor(seconds / 86400) + " days";
}
export function money(amount: number | null, currency: string) {
  return amount === null
    ? "Value not estimated"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
}
export function Stage({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize">
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function LeadRows({ items }: { items: LeadView[] }) {
  return (
    <ul className="divide-y">
      {items.map((lead) => (
        <li key={lead.id} className="py-4">
          <Link
            href={"/leads/" + lead.id}
            className="group grid gap-3 rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[1fr_auto]"
          >
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold group-hover:underline">
                  {lead.name}
                </span>
                <Stage value={lead.stage} />
                {lead.hot ? (
                  <span className="text-sm font-medium">High interest</span>
                ) : null}
                {lead.handoff ? (
                  <span className="text-sm font-medium">Needs a person</span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {lead.reference} · {lead.channel} · {lead.kind}
              </p>
              {"gist" in lead && lead.gist ? (
                <p className="line-clamp-2 break-words text-sm">{lead.gist}</p>
              ) : null}
              <p className="text-sm">
                {replyLabel(lead)}
                {lead.ownerId ? " · Assigned" : " · Unassigned"}
              </p>
            </div>
            <div className="text-sm md:text-right">
              <p>{money(lead.estimatedValue, lead.currency)}</p>
              <time
                className="text-muted-foreground"
                dateTime={lead.lastCustomerAt}
              >
                {new Date(lead.lastCustomerAt).toLocaleString("en-IN", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
export function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

export function replyLabel(lead: LeadView) {
  const state = replyState(lead);
  return state === "waiting"
    ? "Waiting " + duration(lead.waitingSeconds)
    : state === "closed_unanswered"
      ? "Closed · no reply recorded"
      : state === "closed"
        ? "Closed"
        : "Reply received";
}
