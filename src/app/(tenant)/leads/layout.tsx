import { notFound } from "next/navigation";
import { requireChatPermission, ChatAccessError } from "@/features/chat/module";
export default async function LeadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireChatPermission("leads:view");
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    throw error;
  }
  return children;
}
