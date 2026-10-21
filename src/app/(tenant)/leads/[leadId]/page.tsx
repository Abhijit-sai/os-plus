import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getLeadDetail } from "@/features/leads/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  LeadNavigation,
  Stage,
  Metric,
  linkClass,
  duration,
  replyLabel,
  money,
} from "@/components/leads/workspace";
import { LeadEditor } from "@/components/leads/editor";
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  if (!z.string().uuid().safeParse(leadId).success) notFound();
  const data = await getLeadDetail(leadId);
  if (!data) notFound();
  const { lead, permissions } = data;
  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.name}
        description={"Enquiry " + lead.reference + " · " + lead.channel}
        actions={
          permissions.manage ? (
            <Link
              className={linkClass}
              href={"/chat?leadId=" + lead.id}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Chatwoot ↗
            </Link>
          ) : undefined
        }
      />
      <LeadNavigation reports={permissions.reports} />
      <div className="flex flex-wrap items-center gap-3">
        <Stage value={lead.stage} />
        <span className="text-sm capitalize">{lead.kind}</span>
        {lead.hot ? <span>High interest</span> : null}
        {lead.handoff ? <span>Needs a person</span> : null}
        <Link
          className="text-sm underline"
          href={"/leads/contacts/" + lead.contactId}
        >
          Open contact
        </Link>
      </div>
      <section
        aria-label="Enquiry clocks"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric label="Current wait" value={replyLabel(lead)} />
        <Metric label="First reply" value={duration(lead.firstReplySeconds)} />
        <Metric
          label="First human reply"
          value={duration(lead.firstHumanReplySeconds)}
        />
        <Metric
          label="Estimated value"
          value={money(lead.estimatedValue, lead.currency)}
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Read-only mirror. Staff reply in Chatwoot.
              </p>
            </CardHeader>
            <CardContent>
              {!permissions.pii ? (
                <p className="mb-4 text-sm">
                  Conversation text is hidden by your business access settings.
                </p>
              ) : null}
              <ol className="space-y-4">
                {data.messages.map((m) => (
                  <li key={m.id} className="rounded-md border p-3">
                    <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {m.author === "bot" ? "Assistant" : m.author}
                      </span>
                      <time dateTime={m.at}>
                        {new Date(m.at).toLocaleString("en-IN", {
                          timeZone: "UTC",
                        })}{" "}
                        UTC
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {m.content ??
                        (permissions.pii
                          ? "Attachment or non-text message. Open Chatwoot to view."
                          : "Message text hidden")}
                    </p>
                  </li>
                ))}
              </ol>
              {!data.messages.length ? (
                <p>No public messages captured yet.</p>
              ) : null}
              {data.messageCount > data.messages.length ? (
                <p className="mt-4 text-sm">
                  Showing the latest {data.messages.length} of{" "}
                  {data.messageCount} public messages. Open Chatwoot for the
                  full conversation.
                </p>
              ) : null}
            </CardContent>
          </Card>
          {data.draft ? (
            <Card>
              <CardHeader>
                <CardTitle>Unsent suggestion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap break-words">
                  {data.draft.text}
                </p>
                {data.draft.knowledgeVersion ? (
                  <p className="mt-3 text-xs">
                    Knowledge version {data.draft.knowledgeVersion}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-muted-foreground">
                  Review and send only in Chatwoot.
                </p>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {data.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="font-medium">
                      {h.kind.replaceAll("_", " ").replaceAll(".", " ")}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {h.actor.toLowerCase()} ·{" "}
                      {new Date(h.at).toLocaleString("en-IN", {
                        timeZone: "UTC",
                      })}{" "}
                      UTC
                    </p>
                  </li>
                ))}
              </ol>
              {data.historyCount > data.history.length ? (
                <p className="mt-3 text-xs">
                  Latest {data.history.length} of {data.historyCount} recorded
                  events.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {permissions.manage ? "Manage enquiry" : "Enquiry details"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {permissions.manage ? (
                <LeadEditor
                  key={lead.version}
                  lead={lead}
                  owners={data.owners}
                />
              ) : (
                <p className="text-sm">
                  Read-only access. Your business owner controls changes and
                  contact visibility.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer and bookings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                {"customerId" in lead && lead.customerId
                  ? "This contact is linked to a customer."
                  : "Review the contact before linking or creating a customer."}
              </p>
              <Link
                className={linkClass}
                href={"/leads/contacts/" + lead.contactId}
              >
                Review contact
              </Link>
              <p className="text-muted-foreground">
                Chat booking actions will be available with the agent actions
                phase. Existing orders and customers remain in their OS PLUS
                modules.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
