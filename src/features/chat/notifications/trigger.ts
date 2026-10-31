import "server-only";
/** Optional post-commit work must never change whether a business command succeeded. */
export async function scheduleNotificationCheck(tenantId: string) {
  if (
    process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
    process.env.CHAT_NOTIFICATIONS_ENABLED !== "true"
  )
    return;
  try {
    const { scheduleTenantNotification } = await import("./engine");
    await scheduleTenantNotification(tenantId);
  } catch {
    /* The protected cron will discover durable source records. */
  }
}
