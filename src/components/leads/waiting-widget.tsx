import Link from "next/link";
import { getWaitingLeadCount } from "@/features/leads/queries";
export async function ChatWaitingWidget() {
  const data = await getWaitingLeadCount();
  if (!data) return null;
  return (
    <Link
      href="/leads?state=waiting"
      className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>
        {data.waiting === null
          ? "Enquiry count is temporarily unavailable"
          : data.waiting +
            " " +
            (data.waiting === 1 ? "enquiry is" : "enquiries are") +
            " waiting for a reply"}
      </span>
      <span className="font-medium">Open Leads →</span>
    </Link>
  );
}
