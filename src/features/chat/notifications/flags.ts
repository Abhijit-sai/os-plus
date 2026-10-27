import "server-only";
export const notificationsEnabled = () =>
  process.env.CHAT_FOUNDATION_ENABLED === "true" &&
  process.env.CHAT_NOTIFICATIONS_ENABLED === "true";
