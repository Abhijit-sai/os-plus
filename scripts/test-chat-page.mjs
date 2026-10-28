import assert from "node:assert/strict";
import { test } from "node:test";
import { loadServerModule } from "./chat-db-harness/server-adapter.mjs";
const guard = loadServerModule("src/features/chat/module.ts", {
  "@/lib/tenant/context": {},
  "@/lib/supabase/server": {},
  "./permissions": {},
});
const marker = new Error("NEXT_NOT_FOUND");
function page(failure) {
  return loadServerModule("src/app/(tenant)/settings/chat/page.tsx", {
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "next/link": {},
    "@/components/chat/website-widget": {},
    "@/components/chat/settings-overview": {},
    "@/features/chat/settings-navigation": {
      chatSettingsSection: () => "overview",
    },
    "@/features/chat/actions": {},
    "@/features/chat/agent/preview-server": {
      isMockPreviewEnabled: () => false,
    },
    "next/navigation": {
      notFound: () => {
        throw marker;
      },
    },
    "@/features/chat/module": { ...guard, isChatFoundationEnabled: () => true },
    "@/features/chat/queries": {
      getChatSetup: async () => {
        throw failure;
      },
    },
    "@/components/chat/setup-panel": {},
    "@/components/chat/action-settings": {},
    "@/features/chat/notifications/commands": {
      getNotificationSettings: async () => null,
    },
    "@/components/chat/notification-settings": {},
    "@/features/chat/voice/commands": { getVoiceSettings: async () => null },
    "@/components/chat/voice-settings": {},
    "@/features/chat/actions/settings": {
      getChatActionSettings: async () => null,
    },
  }).default;
}
test("Chat page converts expected authorization denial into notFound", async () => {
  const denial = new guard.ChatAccessError();
  await assert.rejects(page(denial)(), (error) => error === marker);
});
test("Chat page preserves unexpected storage failures for operational diagnosis", async () => {
  const failure = new Error("Unexpected storage failure");
  await assert.rejects(page(failure)(), (error) => error === failure);
});

test("permission-query outages propagate through the real guard and page as safe operational errors", async () => {
  const saved = process.env.CHAT_FOUNDATION_ENABLED;
  process.env.CHAT_FOUNDATION_ENABLED = "true";
  try {
    for (const failedTable of ["tenant_modules", "chat_role_permissions"]) {
      const db = {
        from(table) {
          const result = {
            data: table === "tenant_modules" ? { is_enabled: true } : [],
            error:
              table === failedTable
                ? { message: "PRIVATE_DATABASE_DETAIL" }
                : null,
          };
          const query = {
            select() {
              return query;
            },
            eq() {
              return query;
            },
            maybeSingle() {
              return Promise.resolve(result);
            },
            then(resolve, reject) {
              return Promise.resolve(result).then(resolve, reject);
            },
          };
          return query;
        },
      };
      const actual = loadServerModule("src/features/chat/module.ts", {
        "@/lib/tenant/context": {
          requireTenantContext: async () => ({
            tenant: { id: "tenant", status: "active" },
            membership: {
              tenant_id: "tenant",
              status: "active",
              role: "owner_admin",
            },
          }),
        },
        "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
        "./permissions": { canUseChat: () => true },
      });
      const actualPage = loadServerModule(
        "src/app/(tenant)/settings/chat/page.tsx",
        {
          "react/jsx-runtime": { jsx: () => null },
          "next/link": {},
          "@/components/chat/website-widget": {},
          "@/components/chat/settings-overview": {},
          "@/features/chat/settings-navigation": {
            chatSettingsSection: () => "overview",
          },
          "@/features/chat/actions": {},
          "@/features/chat/agent/preview-server": {
            isMockPreviewEnabled: () => false,
          },
          "next/navigation": {
            notFound: () => {
              throw marker;
            },
          },
          "@/features/chat/module": actual,
          "@/features/chat/queries": {
            getChatSetup: () =>
              actual.requireChatPermission("chat_settings:manage"),
          },
          "@/components/chat/setup-panel": {},
          "@/components/chat/action-settings": {},
          "@/features/chat/notifications/commands": {
            getNotificationSettings: async () => null,
          },
          "@/components/chat/notification-settings": {},
          "@/features/chat/voice/commands": {
            getVoiceSettings: async () => null,
          },
          "@/components/chat/voice-settings": {},
          "@/features/chat/actions/settings": {
            getChatActionSettings: async () => null,
          },
        },
      ).default;
      await assert.rejects(
        actualPage(),
        (error) =>
          error !== marker &&
          !(error instanceof actual.ChatAccessError) &&
          error.message ===
            "Chat access could not be checked. Try again later.",
      );
    }
  } finally {
    if (saved === undefined) delete process.env.CHAT_FOUNDATION_ENABLED;
    else process.env.CHAT_FOUNDATION_ENABLED = saved;
  }
});
