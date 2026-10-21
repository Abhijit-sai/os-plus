import {
  saveChatAction,
  syncChatInboxesAction,
  loadChatKnowledgeAction,
} from "@/features/chat/actions";
import { notFound } from "next/navigation";
import {
  ChatAccessError,
  isChatFoundationEnabled,
} from "@/features/chat/module";
import { getChatSetup } from "@/features/chat/queries";
import { ChatSetupPanel } from "@/components/chat/setup-panel";
export default async function ChatSettingsPage() {
  if (!isChatFoundationEnabled()) notFound();
  let data: Awaited<ReturnType<typeof getChatSetup>>;
  try {
    data = await getChatSetup();
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    throw error;
  }
  return (
    <ChatSetupPanel
      key={data.tenantId}
      data={data}
      save={saveChatAction}
      sync={syncChatInboxesAction}
      loadKnowledge={loadChatKnowledgeAction}
    />
  );
}
