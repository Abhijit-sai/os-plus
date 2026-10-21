import Link from "next/link";
import { z } from "zod";
import { getLeadInbox } from "@/features/leads/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LeadNavigation,
  LeadRows,
  Metric,
  fieldClass,
  linkClass,
  money,
} from "@/components/leads/workspace";
import type { LeadFilters } from "@/features/leads/read-schemas";
function href(filters: LeadFilters, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page }))
    if (value !== undefined) params.set(key, String(value));
  return "/leads?" + params;
}
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let data: Awaited<ReturnType<typeof getLeadInbox>>;
  try {
    data = await getLeadInbox(await searchParams);
  } catch (error) {
    if (error instanceof z.ZodError)
      return (
        <div className="space-y-4">
          <PageHeader
            title="Check your enquiry filters"
            description="Choose a valid stage, business filter or page."
          />
          <Link className={linkClass} href="/leads">
            Clear filters
          </Link>
        </div>
      );
    throw error;
  }
  const { filters, options, counters } = data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiries"
        description="Prioritise conversations, keep an owner and follow each enquiry through to a customer."
        actions={
          data.permissions.manage ? (
            <Link
              className={linkClass}
              href="/chat"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Chats ↗
            </Link>
          ) : undefined
        }
      />
      <LeadNavigation reports={data.permissions.reports} />
      {!data.permissions.pii ? (
        <p className="rounded-md border p-3 text-sm">
          Read-only access. Contact details and conversation text are hidden by
          your business settings.
        </p>
      ) : null}
      <section
        aria-label="Enquiry counters"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Metric label="Open enquiries" value={counters.open} />
        <Metric
          label="Awaiting first reply"
          value={counters.awaitingFirstReply}
        />
        <Metric label="High interest" value={counters.hot} />
        <Metric
          label="Open pipeline"
          value={
            data.pipeline.length
              ? data.pipeline.map((p) => (
                  <p key={p.currency}>{money(p.amount, p.currency)}</p>
                ))
              : "Not estimated"
          }
        />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Find enquiries</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              Search {data.permissions.pii ? "name or reference" : "reference"}
              <input
                className={fieldClass}
                name="q"
                maxLength={100}
                defaultValue={filters.q}
              />
            </label>
            {(["brands", "branches", "channels", "owners"] as const).map(
              (key, i) => (
                <label className="text-sm" key={key}>
                  {["Brand", "Branch", "Channel", "Owner"][i]}
                  <select
                    className={fieldClass}
                    name={["brandId", "locationId", "channelId", "ownerId"][i]}
                    defaultValue={
                      [
                        filters.brandId,
                        filters.locationId,
                        filters.channelId,
                        filters.ownerId,
                      ][i] || ""
                    }
                  >
                    <option value="">All {key}</option>
                    {options[key].map((o) => (
                      <option value={o.id} key={o.id}>
                        {o.name || "Unnamed"}
                      </option>
                    ))}
                  </select>
                </label>
              ),
            )}
            <label className="text-sm">
              Stage
              <select
                className={fieldClass}
                name="stage"
                defaultValue={filters.stage || ""}
              >
                <option value="">All stages</option>
                {["new", "engaged", "booked", "in_progress", "won", "lost"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm">
              Priority
              <select
                className={fieldClass}
                name="state"
                defaultValue={filters.state || ""}
              >
                <option value="">All enquiries</option>
                <option value="needs_look">Needs a look</option>
                <option value="waiting">Waiting for a reply</option>
                <option value="hot">High interest</option>
                <option value="unassigned">Unassigned</option>
                <option value="handoff">Needs a person</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit">Apply filters</Button>
              <Link className={linkClass} href="/leads">
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {data.total} {data.total === 1 ? "enquiry" : "enquiries"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.items.length ? (
            <LeadRows items={data.items} />
          ) : (
            <div className="space-y-2 py-8">
              <h3 className="font-medium">
                {data.total
                  ? "No enquiries on this page"
                  : "No enquiries match yet"}
              </h3>
              <p className="text-sm text-muted-foreground">
                New enquiries appear after customers message a connected inbox.
                Try clearing your filters.
              </p>
            </div>
          )}
          <nav
            aria-label="Enquiry pages"
            className="mt-4 flex flex-wrap items-center gap-3"
          >
            {filters.page > 1 ? (
              <Link
                className={linkClass}
                href={href(filters, filters.page - 1)}
              >
                Previous
              </Link>
            ) : null}
            <span className="text-sm">
              Page {filters.page} of {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            {filters.page * 50 < data.total ? (
              <Link
                className={linkClass}
                href={href(filters, filters.page + 1)}
              >
                Next
              </Link>
            ) : null}
          </nav>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Counters reflect the selected filters. Unknown values remain
        unestimated; currencies are shown separately. Times are UTC.
      </p>
    </div>
  );
}
