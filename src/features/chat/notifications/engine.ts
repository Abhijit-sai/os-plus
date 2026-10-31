import "server-only";
import { z } from "zod";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { TelegramClient } from "@/integrations/telegram/client";
import { runNotificationBatch } from "./worker";
import { runPlatformAlert } from "./platform-worker";
import { notificationsEnabled } from "./flags";
const deliveryEnabled = () =>
  notificationsEnabled() &&
  process.env.CHAT_DRY_RUN === "false" &&
  (process.env.CHAT_TELEGRAM_MOCK_ENABLED === "true" ||
    process.env.CHAT_TELEGRAM_LIVE_ENABLED === "true");
function client() {
  if (process.env.CHAT_TELEGRAM_MOCK_ENABLED === "true") {
    if (!process.env.CHAT_TELEGRAM_MOCK_ORIGIN)
      throw new Error("Local notification transport not configured.");
    return new TelegramClient({
      origin: process.env.CHAT_TELEGRAM_MOCK_ORIGIN,
      allowLocalMock: true,
    });
  }
  return new TelegramClient();
}
export async function notifyTenant(tenantId: string) {
  if (!deliveryEnabled()) return;
  const db = createSupabaseServiceRoleClient(),
    transport = client();
  const result = await runNotificationBatch(
    tenantId,
    {
      async run(context, action, input) {
        const result = await db.rpc("chat_notification_dispatch", {
          p_context: context,
          p_action: action,
          p_input: input,
        });
        if (result.error)
          throw new Error("Notification processing unavailable.");
        return result.data;
      },
      send: (input) => transport.send(input),
    },
    process.env.CHAT_APP_ORIGIN ?? "",
  );
  if (result.held > 0)
    try {
      await notifyPlatformFailure(tenantId);
    } catch {
      /* Operator transport may also be held. */
    }
}
export async function notifyPlatformFailure(tenantId?: string) {
  if (process.env.CHAT_PLATFORM_ALERTS_ENABLED !== "true" || !deliveryEnabled())
    return;
  // With no resolved tenant or durable store, do not fall back to an untracked external send.
  if (!tenantId) {
    console.warn(
      "Chat notification schedule unavailable; operator delivery not attempted.",
    );
    return;
  }
  const db = createSupabaseServiceRoleClient(),
    transport = client();
  await runPlatformAlert(
    tenantId,
    {
      async run(context, action, input) {
        const result = await db.rpc("chat_platform_alert", {
          p_context: context,
          p_action: action,
          p_input: input,
        });
        if (result.error)
          throw new Error("Operator alert storage unavailable.");
        return result.data;
      },
      send: (input) => transport.send(input),
    },
    process.env.TELEGRAM_PLATFORM_ALERT_CHAT_ID ?? "",
  );
}
export async function notificationTick() {
  if (!deliveryEnabled()) return;
  const result = await createSupabaseServiceRoleClient().rpc(
    "chat_notification_tenants",
    { p_limit: 5 },
  );
  if (result.error) throw new Error("Notification schedule unavailable.");
  const tenants = z.array(z.string().uuid()).max(5).parse(result.data);
  for (const tenant of tenants) {
    try {
      await notifyTenant(tenant);
    } catch {
      try {
        await notifyPlatformFailure(tenant);
      } catch {
        /* Operator transport may also be unavailable. */
      }
    }
  }
}
/** Optional post-response work must not obscure a committed business receipt. */
export async function scheduleTenantNotification(tenantId: string) {
  if (!notificationsEnabled()) return;
  try {
    const { after } = await import("next/server");
    after(async () => {
      try {
        await notifyTenant(tenantId);
      } catch {
        try {
          await notifyPlatformFailure(tenantId);
        } catch {
          /* Protected health check remains the recovery surface. */
        }
      }
    });
  } catch {
    /* Cron is the durable fallback if no Next request scope exists in a harness. */
  }
}
