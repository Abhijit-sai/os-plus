import { setChannelStaffOnlyAction } from "@/features/chat/channel-off-actions";
import Link from "next/link";
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
import { WebsiteWidget } from "@/components/chat/website-widget";
import { ChatSettingsOverview } from "@/components/chat/settings-overview";
import {
  chatSettingsSections,
  chatSettingsSection,
} from "@/features/chat/settings-navigation";
import { ChatActionSettingsPanel } from "@/components/chat/action-settings";
import { getChatActionSettings } from "@/features/chat/actions/settings";
import { getNotificationSettings } from "@/features/chat/notifications/commands";
import { ChatNotificationSettings } from "@/components/chat/notification-settings";
import { getVoiceSettings } from "@/features/chat/voice/commands";
import { ChatVoiceSettings } from "@/components/chat/voice-settings";
export default async function ChatSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string | string[] }>;
} = {}) {
  if (!isChatFoundationEnabled()) notFound();
  const section = chatSettingsSection((await searchParams)?.section);
  let data: Awaited<ReturnType<typeof getChatSetup>>;
  try {
    data = await getChatSetup();
  } catch (error) {
    if (error instanceof ChatAccessError) notFound();
    throw error;
  }
  const preview = isMockPreviewEnabled();
  const localDemo =
    process.env.CHAT_AGENT_MODEL_MODE === "mock" &&
    process.env.CHAT_MODEL_LIVE_ENABLED !== "true" &&
    process.env.CHAT_TRANSCRIPTION_LIVE_ENABLED !== "true";
  const actionSettings =
    section === "assistance" ? await getChatActionSettings() : null;
  const voiceSettings =
    section === "assistance" ? await getVoiceSettings() : null;
  const notificationSettings =
    section === "notifications" ? await getNotificationSettings() : null;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Chat &amp; Leads settings
        </h2>
        <p className="text-sm text-muted-foreground">
          {data.businessName} · Owner configuration
        </p>
        {localDemo ? (
          <p
            role="status"
            className="max-w-prose rounded-md bg-muted px-3 py-2 text-sm"
          >
            Local demo. Live AI and transcription are disabled; replies use
            synthetic test data.
          </p>
        ) : null}
      </header>
      <div className="grid min-w-0 gap-6 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-8">
        <nav
          aria-label="Chat settings"
          className="flex flex-wrap content-start gap-1 md:flex-col"
        >
          {chatSettingsSections.map((item) => (
            <Link
              key={item.id}
              href={
                item.id === "overview"
                  ? "/settings/chat"
                  : "/settings/chat?section=" + item.id
              }
              aria-current={section === item.id ? "page" : undefined}
              className={
                "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm " +
                (section === item.id
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0" key={data.tenantId + ":" + section}>
          {section === "overview" ? <ChatSettingsOverview data={data} /> : null}
          {section === "business" ||
          section === "channels" ||
          section === "access" ? (
            <ChatSetupPanel
              key={data.tenantId + ":" + section}
              section={section}
              data={data}
              save={saveChatAction}
              sync={syncChatInboxesAction}
              pause={setChannelStaffOnlyAction}
              loadKnowledge={loadChatKnowledgeAction}
            />
          ) : null}
          {section === "website" ? (
            <WebsiteWidget key={"website:" + data.tenantId} data={data} />
          ) : null}
          {section === "assistance" ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Reply assistance</h3>
                <p className="max-w-prose text-sm text-muted-foreground">
                  Choose how suggestions and provisional requests are handled.
                  Sending a reply never approves an operational booking.
                </p>
                {preview ? (
                  <Link
                    className="inline-flex min-h-11 items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                    href="/settings/chat/try"
                  >
                    Try a mock reply
                  </Link>
                ) : null}
              </div>
              {actionSettings ? (
                <ChatActionSettingsPanel data={actionSettings} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Reply controls are not enabled for this installation.
                </p>
              )}
              {voiceSettings ? (
                <details className="border-t pt-4">
                  <summary className="min-h-11 cursor-pointer font-medium">
                    Voice-note limits
                  </summary>
                  <ChatVoiceSettings
                    key={"voice:" + data.tenantId}
                    data={voiceSettings}
                  />
                </details>
              ) : null}
            </div>
          ) : null}
          {section === "notifications" ? (
            notificationSettings ? (
              <ChatNotificationSettings
                key={"notifications:" + data.tenantId}
                data={notificationSettings}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Notifications are not enabled for this installation.
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
