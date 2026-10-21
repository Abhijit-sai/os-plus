import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getContactDetail } from "@/features/leads/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  LeadNavigation,
  LeadRows,
  linkClass,
  money,
} from "@/components/leads/workspace";
import {
  CustomerContactActions,
  MergeContactActions,
  SplitContactAction,
} from "@/components/leads/contact-actions";
export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ contactId: string }>;
  searchParams: Promise<{ mergeQ?: string }>;
}) {
  const { contactId } = await params;
  if (!z.string().uuid().safeParse(contactId).success) notFound();
  const { mergeQ } = await searchParams;
  if (mergeQ !== undefined && !z.string().max(100).safeParse(mergeQ).success)
    notFound();
  const data = await getContactDetail(contactId, mergeQ);
  if (!data) notFound();
  const { contact: c, permissions: p } = data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={
          c.merged
            ? "Merged contact record"
            : c.linked
              ? "Linked to a customer"
              : "Enquiry contact"
        }
      />
      <LeadNavigation reports={p.reports} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Identity and preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!p.pii ? (
                <p className="text-sm">
                  Contact details and preferences are hidden by your business
                  settings.
                </p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {c.identities.map((i, index) => (
                      <li
                        key={index}
                        className="break-words rounded-md border p-3 text-sm"
                      >
                        <p className="font-medium capitalize">
                          {i.kind.replaceAll("_", " ")}
                        </p>
                        <p>
                          {i.kind === "phone"
                            ? i.value
                            : "Connected " +
                              i.kind.replaceAll("_", " ") +
                              " identity"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {i.verified
                            ? "Verified channel identity"
                            : "Unverified claim"}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm">
                    Preferred language: {data.language || "Not recorded"}
                  </p>
                  {"notes" in c && c.notes ? (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {c.notes}
                    </p>
                  ) : null}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                First seen{" "}
                {new Date(c.firstSeenAt).toLocaleString("en-IN", {
                  timeZone: "UTC",
                })}{" "}
                UTC · Last seen{" "}
                {new Date(c.lastSeenAt).toLocaleString("en-IN", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </p>
              {c.merged && "mergedInto" in c && c.mergedInto ? (
                <Link
                  className={linkClass}
                  href={"/leads/contacts/" + c.mergedInto}
                >
                  Open main contact
                </Link>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{data.leadCount} enquiries</CardTitle>
            </CardHeader>
            <CardContent>
              {data.leads.length ? (
                <LeadRows items={data.leads} />
              ) : (
                <p className="text-sm">No enquiries on this record.</p>
              )}
              {data.leadCount > data.leads.length ? (
                <Link className={linkClass} href={"/leads?contactId=" + c.id}>
                  View all enquiries
                </Link>
              ) : null}
            </CardContent>
          </Card>
          {data.customer ? (
            <Card>
              <CardHeader>
                <CardTitle>Customer orders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link
                  className="font-medium underline"
                  href={"/customers/" + data.customer.id}
                >
                  {data.customer.name}
                </Link>
                <p className="text-sm">
                  Booked order value{" "}
                  {data.lifetime.length
                    ? data.lifetime
                        .map((x) => money(x.amount, x.currency))
                        .join(" · ")
                    : "not recorded"}
                </p>
                <ul className="divide-y">
                  {data.orders.map((o) => (
                    <li
                      key={o.id}
                      className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                    >
                      <Link className="underline" href={"/orders/" + o.id}>
                        {o.order_number}
                      </Link>
                      <span className="capitalize">
                        {o.status.replaceAll("_", " ")}
                      </span>
                      <span>{money(o.total, o.currency)}</span>
                    </li>
                  ))}
                </ul>
                {data.orderCount > data.orders.length ? (
                  <p className="text-xs text-muted-foreground">
                    Latest {data.orders.length} of {data.orderCount} orders.
                    Open the customer for full history.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Booked value excludes draft and cancelled orders. It is not a
                  payment collection total.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
        <aside className="space-y-6">
          {p.manage && !c.merged && !c.linked ? (
            <Card>
              <CardHeader>
                <CardTitle>Link a customer</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomerContactActions
                  contact={c}
                  matches={data.matchingCustomers}
                />
              </CardContent>
            </Card>
          ) : null}
          {p.manage && !c.merged ? (
            <Card>
              <CardHeader>
                <CardTitle>Review duplicate contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <MergeContactActions
                  key={c.version}
                  contact={c}
                  candidates={data.candidates}
                  total={data.candidateTotal}
                />
              </CardContent>
            </Card>
          ) : null}
          {p.manage && data.merges.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Merge history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Undo is available only while the merged records have no later
                  changes.
                </p>
                {data.merges.map((m) => (
                  <div className="space-y-2 rounded-md border p-3" key={m.id}>
                    <p className="text-sm">
                      Merged{" "}
                      {new Date(m.at).toLocaleString("en-IN", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </p>
                    {m.splitAt ? (
                      <p className="text-sm">Already restored</p>
                    ) : (
                      <SplitContactAction mergeId={m.id} />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {!p.manage ? (
            <Card>
              <CardContent className="pt-4 text-sm">
                Read-only access. Customer links and contact merges are managed
                by your business team.
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
