import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getChatEntry } from "@/features/leads/queries";
import { ChatAccessError } from "@/features/chat/module";
export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  let target: string | null;
  try {
    target = await getChatEntry((await searchParams).leadId);
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    throw error;
  }
  if (target) redirect(target);
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Chats are not connected yet</h2>
      <p>
        Your platform administrator needs to connect this business to Chatwoot.
      </p>
      <Link className="underline" href="/leads">
        Return to enquiries
      </Link>
    </div>
  );
}
