import Link from "next/link";
import { getCurrentClerkUserId } from "@/lib/auth/super-admin";
import { getChatPanelConfig } from "@/features/leads/queries";
import { DraftBridge } from "@/components/leads/draft-bridge";
import { PanelHost } from "@/components/leads/panel-host";
import { linkClass } from "@/components/leads/workspace";
export const dynamic = "force-dynamic";
export default async function ChatPanelPage() {
  // Public GET serves only a fallback shell. No lead data is read until both the
  // Clerk session and tenant permission are verified again by the lookup action.
  let config: Awaited<ReturnType<typeof getChatPanelConfig>> | null = null;
  if (await getCurrentClerkUserId()) {
    try {
      config = await getChatPanelConfig();
    } catch {
      config = null;
    }
  }
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-sm font-semibold">OS PLUS · Enquiry card</h1>
      {config && process.env.CHAT_STAFF_DRAFT_SEND_ENABLED === "true" ? (
        <DraftBridge origin={config.origin} accountId={config.accountId} />
      ) : null}
      {config ? (
        <PanelHost
          key={config.origin + ":" + config.accountId}
          config={config}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            Open OS PLUS to sign in, select your business and check your access.
            No enquiry details are available in this frame.
          </p>
          <Link
            className={linkClass}
            href="/leads"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Leads in OS PLUS ↗
          </Link>
        </div>
      )}
    </main>
  );
}
