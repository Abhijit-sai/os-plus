import Link from "next/link";
import { needsLookHref } from "@/features/leads/editor-state";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLeadPerformance } from "@/features/leads/queries";
import { ChatAccessError } from "@/features/chat/module";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LeadNavigation,
  LeadRows,
  Metric,
  fieldClass,
  linkClass,
  duration,
} from "@/components/leads/workspace";
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let data: Awaited<ReturnType<typeof getLeadPerformance>>;
  try {
    data = await getLeadPerformance(await searchParams);
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    if (error instanceof z.ZodError)
      return (
        <div className="space-y-4">
          <PageHeader title="Check your performance filters" />
          <Link className={linkClass} href="/leads/performance">
            Clear filters
          </Link>
        </div>
      );
    throw error;
  }
  const pageLink = (page: number) =>
    "/leads/performance?" +
    new URLSearchParams(
      Object.entries({ ...data.filters, page })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Enquiry performance"
        description="Owner report · all captured history in the selected business filters."
      />
      <LeadNavigation reports />
      <Card>
        <CardHeader>
          <CardTitle>Report scope</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(["brands", "branches", "channels"] as const).map((key, i) => (
              <label className="text-sm" key={key}>
                {["Brand", "Branch", "Channel"][i]}
                <select
                  className={fieldClass}
                  name={["brandId", "locationId", "channelId"][i]}
                  defaultValue={
                    [
                      data.filters.brandId,
                      data.filters.locationId,
                      data.filters.channelId,
                    ][i] || ""
                  }
                >
                  <option value="">All {key}</option>
                  {data.options[key].map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <Button>Apply scope</Button>
          </form>
        </CardContent>
      </Card>
      <section
        aria-label="Team performance counters"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Metric
          label="Median first human reply"
          value={
            data.medianFirstHumanSeconds === null
              ? "No replies yet"
              : duration(data.medianFirstHumanSeconds)
          }
        />
        <Metric label="Waiting" value={data.counters.waiting} />
        <Metric label="Unassigned" value={data.counters.unassigned} />
        <Metric label="Needs a person" value={data.counters.handoff} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Team activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            {data.publicStaffReplies} public staff replies in matched
            conversations. Private notes and assistant messages are excluded.
            Owned is open workload; won is the current assigned owner won
            enquiries.
          </p>
          <ul className="divide-y">
            {data.people.map((person) => (
              <li
                key={person.id}
                className="grid gap-3 py-4 md:grid-cols-[minmax(10rem,1fr)_repeat(4,minmax(5rem,1fr))]"
              >
                <div className="min-w-0 break-words">
                  <p className="font-medium">{person.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {person.status}
                  </p>
                </div>
                {[
                  ["Public replies", person.replies],
                  ["Open owned", person.owned],
                  ["Won", person.won],
                  [
                    "After-hours replies",
                    person.afterHours === null
                      ? "Not configured"
                      : person.afterHours,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {!data.people.length ? (
            <p className="text-sm">No mapped team activity yet.</p>
          ) : null}
          {data.unmappedStaffReplies ? (
            <p className="mt-4 text-sm">
              {data.unmappedStaffReplies} public staff replies have no OS PLUS
              staff mapping. Map staff before comparing individual performance.
            </p>
          ) : null}
          {data.afterHoursUnknownReplies ? (
            <p className="mt-4 text-sm">
              After-hours reporting is unavailable for{" "}
              {data.afterHoursUnknownReplies} replies without a published brand
              reporting schedule. Existing descriptive opening hours are not
              treated as a reporting schedule.
            </p>
          ) : null}
          <nav
            className="mt-4 flex flex-wrap items-center gap-3"
            aria-label="Team report pages"
          >
            {data.page > 1 ? (
              <Link className={linkClass} href={pageLink(data.page - 1)}>
                Previous team members
              </Link>
            ) : null}
            <span className="text-sm">
              Page {data.page} of{" "}
              {Math.max(1, Math.ceil(data.peopleCount / 50))}
            </span>
            {data.page * 50 < data.peopleCount ? (
              <Link className={linkClass} href={pageLink(data.page + 1)}>
                Next team members
              </Link>
            ) : null}
          </nav>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Needs a look · {data.needsLookCount}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadRows items={data.needsLook} />
          {!data.needsLook.length ? (
            <p className="text-sm">
              No enquiries need attention in this scope.
            </p>
          ) : null}
          {data.needsLookCount > data.needsLook.length ? (
            <Link className={linkClass} href={needsLookHref(data.filters)}>
              Open enquiry queue
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
