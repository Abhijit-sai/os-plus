import assert from "node:assert/strict";
import { test } from "node:test";
import * as zod from "zod";
import * as crypto from "node:crypto";
import { loadServerModule } from "./chat-db-harness/server-adapter.mjs";
const tenant = "85000000-0000-4000-8000-000000000001",
  workspace = "85000000-0000-4000-8000-000000000002",
  profile = "85000000-0000-4000-8000-000000000003",
  link = "85000000-0000-4000-8000-000000000004";
async function scenario(run) {
  const names = [
    "CHAT_FOUNDATION_ENABLED",
    "CHAT_ADMIN_LIVE_ENABLED",
    "CHAT_DRY_RUN",
    "CHATWOOT_BASE_URL",
    "OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS",
  ];
  const old = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    CHAT_FOUNDATION_ENABLED: "true",
    CHAT_ADMIN_LIVE_ENABLED: "true",
    CHAT_DRY_RUN: "false",
  });
  let actor = "platform-owner",
    nativeEmail = "staff@example.invalid",
    nativeWait = () => {},
    role = "manager";
  const calls = [];
  const w = {
    id: workspace,
    tenant_id: tenant,
    chatwoot_account_id: 12,
    status: "active",
    chatwoot_base_url: "https://chat.example.invalid",
    api_token_enc: "synthetic-encrypted",
  };
  const db = {
    from(table) {
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        maybeSingle: async () => ({
          data:
            table === "chat_workspaces" ? w : { id: tenant, status: "active" },
          error: null,
        }),
        then(resolve, reject) {
          return Promise.resolve({
            data:
              table === "tenant_users"
                ? [
                    {
                      id: profile,
                      email: "staff@example.invalid",
                      clerk_user_id: "linked-manager",
                      role,
                      status: "active",
                      display_name: "Synthetic staff",
                    },
                  ]
                : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
    async rpc(name, args) {
      calls.push(JSON.parse(JSON.stringify({ name, ...args })));
      return {
        data: args.p_context.replayOnly ? null : { id: link },
        error: null,
      };
    },
  };
  try {
    const connection = loadServerModule("src/features/chat/connection.ts", {
      "@/integrations/chatwoot/admin-client": {
        ChatwootAdminClient: class {
          constructor() {}
          async listAccountUsers() {
            nativeWait();
            return [
              {
                id: 3,
                name: "Synthetic staff",
                email: nativeEmail,
                role: "agent",
              },
            ];
          }
        },
      },
      "./secrets": { decryptChatSecret: () => "synthetic-token" },
    });
    process.env.CHATWOOT_BASE_URL = "https://chat.example.invalid";
    process.env.OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS =
      "platform-owner,different-platform-owner";
    const auth = loadServerModule("src/lib/auth/super-admin.ts", {
      "@clerk/nextjs/server": { auth: async () => ({ userId: actor }) },
      "next/navigation": {},
    });
    const core = loadServerModule("src/features/chat/staff-links.ts", {
      zod,
      "node:crypto": crypto,
      "@/lib/auth/super-admin": auth,
      "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
      "./connection": connection,
    });
    await run({
      core,
      calls,
      setEmail: (v) => (nativeEmail = v),
      setActor: (v) => (actor = v),
      setRole: (v) => (role = v),
      onNative: (f) => (nativeWait = f),
    });
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
test("platform staff link requires explicit matching active profile and exact account membership", () =>
  scenario(async ({ core, calls }) => {
    const result = await core.configurePlatformChatStaffLink(
      {
        tenantId: tenant,
        workspaceId: workspace,
        accountId: 12,
        tenantUserId: profile,
        chatwootUserId: 3,
      },
      crypto.randomUUID(),
    );
    assert.equal(result.id, link);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].p_context.replayOnly, true);
    assert.equal(calls[1].name, "chat_staff_link_configure");
    assert.equal(calls[1].p_input.tenantUserId, profile);
    assert.equal(calls[1].p_input.chatwootUserId, 3);
    assert.equal(calls[1].p_context.actor.id, "platform-owner");
    assert.equal(
      JSON.stringify(result).includes("staff@example.invalid"),
      false,
    );
  }));

test("identity mismatch, forbidden profile, foreign scope and revoked platform access cannot commit", () =>
  scenario(async ({ core, calls, setEmail, setActor, setRole, onNative }) => {
    const request = {
      tenantId: tenant,
      workspaceId: workspace,
      accountId: 12,
      tenantUserId: profile,
      chatwootUserId: 3,
    };
    setEmail("other@example.invalid");
    await assert.rejects(
      core.configurePlatformChatStaffLink(request, crypto.randomUUID()),
    );
    assert.equal(calls.filter((c) => !c.p_context.replayOnly).length, 0);
    setEmail("staff@example.invalid");
    setRole("viewer");
    await assert.rejects(
      core.configurePlatformChatStaffLink(request, crypto.randomUUID()),
    );
    setRole("finance");
    await assert.rejects(
      core.configurePlatformChatStaffLink(request, crypto.randomUUID()),
    );
    setRole("manager");
    await assert.rejects(
      core.configurePlatformChatStaffLink(
        { ...request, accountId: 99 },
        crypto.randomUUID(),
      ),
    );
    await assert.rejects(
      core.configurePlatformChatStaffLink(
        { ...request, tenantUserId: link },
        crypto.randomUUID(),
      ),
    );
    onNative(() => setActor("different-platform-owner"));
    await assert.rejects(
      core.configurePlatformChatStaffLink(request, crypto.randomUUID()),
    );
    assert.equal(calls.filter((c) => !c.p_context.replayOnly).length, 0);
  }));
test("call-time setup shutdown after native verification prevents any staff-link write", () =>
  scenario(async ({ core, calls, onNative }) => {
    onNative(() => (process.env.CHAT_DRY_RUN = "true"));
    await assert.rejects(
      core.configurePlatformChatStaffLink(
        {
          tenantId: tenant,
          workspaceId: workspace,
          accountId: 12,
          tenantUserId: profile,
          chatwootUserId: 3,
        },
        crypto.randomUUID(),
      ),
    );
    assert.equal(calls.filter((c) => !c.p_context.replayOnly).length, 0);
  }));

test("the actual platform permission guard rejects signed-out and ordinary staff callers before discovery", () =>
  scenario(async ({ core, calls, setActor }) => {
    for (const user of [null, "ordinary-manager"]) {
      setActor(user);
      await assert.rejects(
        core.getPlatformChatStaffChoices({
          tenantId: tenant,
          workspaceId: workspace,
          accountId: 12,
        }),
      );
      await assert.rejects(
        core.configurePlatformChatStaffLink(
          {
            tenantId: tenant,
            workspaceId: workspace,
            accountId: 12,
            tenantUserId: profile,
            chatwootUserId: 3,
          },
          crypto.randomUUID(),
        ),
      );
    }
    assert.equal(calls.length, 0);
  }));
