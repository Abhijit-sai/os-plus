export const chatSettingsSections = [
  { id: "overview", label: "Overview" },
  { id: "business", label: "Business knowledge" },
  { id: "channels", label: "Channels" },
  { id: "website", label: "Website widget" },
  { id: "assistance", label: "Reply assistance" },
  { id: "notifications", label: "Notifications" },
  { id: "access", label: "Access" },
] as const;
export type ChatSettingsSection = (typeof chatSettingsSections)[number]["id"];
export function chatSettingsSection(value: unknown): ChatSettingsSection {
  return (
    chatSettingsSections.find((section) => section.id === value)?.id ??
    "overview"
  );
}
