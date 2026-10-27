import {
  saveChatAction,
  syncChatInboxesAction,
  loadChatKnowledgeAction,
} from "@/features/chat/actions";
import { notFound } from "next/navigation";
import { isMockPreviewEnabled } from "@/features/chat/agent/preview-server";
import {
  ChatAccessError,
  isChatFoundationEnabled,
} from "@/features/chat/module";
import { getChatSetup } from "@/features/chat/queries";
import { ChatSetupPanel } from "@/components/chat/setup-panel";
import { ChatActionSettingsPanel } from "@/components/chat/action-settings";
import { getChatActionSettings } from "@/features/chat/actions/settings";
export default async function ChatSettingsPage() {
  if (!isChatFoundationEnabled()) notFound();
  let data: Awaited<ReturnType<typeof getChatSetup>>;
  try {
    data = await getChatSetup();
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    throw error;
  }
  const actionSettings = await getChatActionSettings();
  return (
    <div className="space-y-6">
      <ChatSetupPanel
        key={data.tenantId}
        data={data}
        previewEnabled={isMockPreviewEnabled()}
        save={saveChatAction}
        sync={syncChatInboxesAction}
        loadKnowledge={loadChatKnowledgeAction}
      />
      {actionSettings ? (
        <ChatActionSettingsPanel data={actionSettings} />
      ) : null}
    </div>
  );
}
