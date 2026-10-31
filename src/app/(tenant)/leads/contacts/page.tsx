import Link from "next/link";
import { z } from "zod";
import { getContacts } from "@/features/leads/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LeadNavigation,
  Metric,
  fieldClass,
  linkClass,
} from "@/components/leads/workspace";
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let data: Awaited<ReturnType<typeof getContacts>>;
  try {
    data = await getContacts(await searchParams);
  } catch (error) {
    if (error instanceof z.ZodError)
      return (
        <div className="space-y-4">
          <PageHeader title="Check your contact filters" />
          <Link className={linkClass} href="/leads/contacts">
            Clear filters
          </Link>
        </div>
      );
    throw error;
  }
  const pageLink = (page: number) =>
    "/leads/contacts?" +
    new URLSearchParams(
      Object.entries({ ...data.filters, page })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="People behind your enquiries. Review identities before linking or combining records."
      />
      <LeadNavigation reports={data.permissions.reports} />
      <section
        className="grid gap-3 sm:grid-cols-2"
        aria-label="Contact counters"
      >
        <Metric label="Matching contacts" value={data.total} />
        <Metric label="Linked to customers" value={data.linked} />
      </section>
      {!data.permissions.pii ? (
        <p className="rounded-md border p-3 text-sm">
          Contact details are hidden by your business settings.
        </p>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Find contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            {data.permissions.pii ? (
              <label className="text-sm">
                Name or verified phone
                <input
                  className={fieldClass}
                  name="q"
                  defaultValue={data.filters.q}
                  maxLength={100}
                />
              </label>
            ) : null}
            <label className="text-sm">
              Segment
              <select
                className={fieldClass}
                name="segment"
                defaultValue={data.filters.segment || ""}
              >
                <option value="">Active contacts</option>
                <option value="linked">Linked customers</option>
                <option value="unlinked">Not linked yet</option>
                <option value="merged">Merged records</option>
              </select>
            </label>
            <div className="flex gap-2">
              <Button>Search</Button>
              <Link className={linkClass} href="/leads/contacts">
                Clear
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact records</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.items.map((c) => (
              <li className="py-4" key={c.id}>
                <Link
                  className="grid gap-2 rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[1fr_auto]"
                  href={"/leads/contacts/" + c.id}
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    {data.permissions.pii ? (
                      <p className="break-words text-sm text-muted-foreground">
                        {c.identities.find((i) => i.kind === "phone")?.value ||
                          "No verified phone on file"}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-sm">
                    <p>
                      {c.merged
                        ? "Merged record"
                        : c.linked
                          ? "Linked customer"
                          : "Not linked"}
                    </p>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={c.lastSeenAt}
                    >
                      Last seen{" "}
                      {new Date(c.lastSeenAt).toLocaleDateString("en-IN", {
                        timeZone: "UTC",
                      })}
                    </time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {!data.items.length ? (
            <p className="py-6 text-sm">
              No contacts match these filters. Connected inbox enquiries create
              contacts automatically.
            </p>
          ) : null}
          <nav
            className="mt-4 flex flex-wrap items-center gap-3"
            aria-label="Contact pages"
          >
            {data.page > 1 ? (
              <Link className={linkClass} href={pageLink(data.page - 1)}>
                Previous
              </Link>
            ) : null}
            <span className="text-sm">
              Page {data.page} of {Math.max(1, Math.ceil(data.total / 50))}
            </span>
            {data.page * 50 < data.total ? (
              <Link className={linkClass} href={pageLink(data.page + 1)}>
                Next
              </Link>
            ) : null}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
