import Link from "next/link";
import type { ChatSetup } from "@/features/chat/queries";
export function ChatSettingsOverview({ data }: { data: ChatSetup }) {
  const active = data.channels.filter((channel) => channel.is_active);
  const published = new Set(
    data.packs
      .filter((pack) => pack.status === "published")
      .map((pack) => pack.brand_id),
  );
  return (
    <div className="space-y-8">
      <section aria-labelledby="chat-daily-work" className="space-y-3">
        <h3 id="chat-daily-work" className="text-lg font-semibold">
          Your team’s workspace
        </h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Reply and assign conversations in Chats. Track enquiries, follow-ups
          and customers in Leads.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/chat"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Chats <span className="sr-only">(new tab)</span>
          </Link>
          <Link
            href="/leads"
            className="inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Open Leads
          </Link>
        </div>
      </section>
      <section aria-labelledby="chat-setup-status" className="space-y-2">
        <h3 id="chat-setup-status" className="text-lg font-semibold">
          Business setup
        </h3>
        <dl className="divide-y">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <dt className="font-medium">Connected channels</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {active.length
                  ? active.length + " mapped to this business"
                  : "No active channel mappings yet"}
              </dd>
            </div>
            <Link
              href="/settings/chat?section=channels"
              className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Manage channels
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <dt className="font-medium">Business knowledge</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                {published.size} of {data.brands.length} brands with published
                facts
              </dd>
            </div>
            <Link
              href="/settings/chat?section=business"
              className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Review knowledge
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <dt className="font-medium">Website chat</dt>
              <dd className="mt-1 text-sm text-muted-foreground">
                Install your website inbox’s chat bubble.
              </dd>
            </div>
            <Link
              href="/settings/chat?section=website"
              className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
            >
              Get website code
            </Link>
          </div>
        </dl>
      </section>
      <p className="max-w-prose text-sm text-muted-foreground">
        Inbox members, assignments and the visitor pre-chat form are managed in
        Chatwoot. OS PLUS manages your business facts, enquiry permissions and
        reply safeguards.
      </p>
    </div>
  );
}
