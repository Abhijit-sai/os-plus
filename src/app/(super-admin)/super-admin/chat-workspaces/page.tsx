import { connectPlatformChatTransportAction } from "@/features/chat/transport-actions";
import { savePlatformChatAction } from "@/features/chat/actions";
import { notFound } from "next/navigation";
import { isChatFoundationEnabled } from "@/features/chat/module";
import { getPlatformChatSetup } from "@/features/chat/queries";
import { PlatformChatPanel } from "@/components/chat/platform-panel";
export default async function ChatWorkspacesPage() {
  if (!isChatFoundationEnabled()) notFound();
  return (
    <PlatformChatPanel
      tenants={await getPlatformChatSetup()}
      save={savePlatformChatAction}
      connect={connectPlatformChatTransportAction}
    />
  );
}
