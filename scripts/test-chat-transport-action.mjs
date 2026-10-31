import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ChatwootAdminClient } from "../src/integrations/chatwoot/admin-client.ts";
import { provisionChatwootTransport } from "../src/integrations/chatwoot/onboarding.ts";
import {
  encryptChatSecret,
  decryptChatSecret,
} from "../src/features/chat/secrets.ts";
import { validWebhookSecret } from "../src/features/chat/ingress.ts";
import { loadServerModule } from "./chat-db-harness/server-adapter.mjs";
import * as zod from "zod";

const tenant = "83000000-0000-4000-8000-000000000001";
const other = "83000000-0000-4000-8000-000000000002";
const secret = "synthetic-webhook-secret-" + "x".repeat(32);
async function scenario(run) {
  const values = {
    CHAT_FOUNDATION_ENABLED: "true",
    CHAT_ADMIN_LIVE_ENABLED: "true",
    CHAT_DRY_RUN: "false",
    CHATWOOT_BASE_URL: "https://chat.example.invalid",
    CHAT_WEBHOOK_ORIGIN: "https://app.example.invalid",
    CHATWOOT_PLATFORM_TOKEN: "synthetic-platform",
    CHAT_SECRETS_ACTIVE_VERSION: "v1",
    CHAT_SECRETS_KEYS: JSON.stringify({
      v1: randomBytes(32).toString("base64"),
    }),
    OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS: "synthetic-platform-owner",
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, values);
  const networkCalls = [],
    calls = [],
    writes = [],
    receipts = new Map(),
    bots = [],
    hooks = [],
    invalidations = [];
  let actor = "synthetic-platform-owner",
    moduleEnabled = true,
    loseBotReply = false,
    revokeOnDiscovery = false;
  const workspace = {
    id: randomUUID(),
    tenant_id: tenant,
    chatwoot_base_url: values.CHATWOOT_BASE_URL,
    workspace_key: "synthetic-workspace-key-" + "k".repeat(32),
    webhook_secret_hash: createHash("sha256").update(secret).digest("hex"),
    chatwoot_account_id: 12,
    status: "active",
    agent_bot_id: null,
  };
  workspace.api_token_enc = encryptChatSecret("synthetic-account", {
    tenantId: tenant,
    workspaceId: workspace.id,
    purpose: "account_token",
  });
  const db = {
    from(table) {
      const filters = {};
      const query = {
        select() {
          return query;
        },
        eq(key, value) {
          filters[key] = value;
          return query;
        },
        maybeSingle: async () => ({
          data: filters.tenant_id === tenant ? workspace : null,
          error: null,
        }),
        then(resolve, reject) {
          return Promise.resolve({
            data:
              table === "chat_channels"
                ? [{ chatwoot_inbox_id: 4, agent_mode: "off" }]
                : [],
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, { p_context, p_action, p_input }) {
      assert.equal(name, "chat_transport_setup");
      assert.equal(p_context.tenantId, tenant);
      assert.equal(p_context.actor.id, "synthetic-platform-owner");
      assert.equal(p_input.workspaceId, workspace.id);
      calls.push(p_action);
      if (!moduleEnabled)
        return { data: null, error: { message: "PRIVATE_STORAGE_DETAIL" } };
      const receipt = receipts.get(p_input.stage);
      if (p_action === "begin") {
        if (!receipt) receipts.set(p_input.stage, { id: null });
        return {
          data: { started: !receipt, completedId: receipt?.id ?? null },
          error: null,
        };
      }
      if (p_action === "complete") {
        receipts.set(p_input.stage, { id: p_input.remoteId });
        if (p_input.stage === "bot") {
          workspace.agent_bot_id = p_input.remoteId;
          workspace.bot_token_enc = p_input.botTokenEnc;
        }
      }
      return { data: {}, error: null };
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith(values.CHATWOOT_BASE_URL + "/"));
    const path = new URL(url).pathname;
    networkCalls.push(path);
    if (options.method === "GET" && revokeOnDiscovery) actor = null;
    if (options.method === "POST") writes.push(path);
    const body = options.body ? JSON.parse(options.body) : null;
    if (path === "/platform/api/v1/agent_bots") {
      if (body) bots.push({ id: 31, ...body, access_token: "synthetic-bot" });
      if (body && loseBotReply) {
        loseBotReply = false;
        throw Error("PRIVATE_PROVIDER_DETAIL");
      }
      return Response.json(body ? bots.at(-1) : bots);
    }
    assert.equal(path, "/api/v1/accounts/12/webhooks");
    if (body) hooks.push({ id: 41, ...body.webhook });
    return Response.json({
      payload: body ? { webhook: hooks.at(-1) } : { webhooks: hooks },
    });
  };
  try {
    const auth = loadServerModule("src/lib/auth/super-admin.ts", {
      "@clerk/nextjs/server": { auth: async () => ({ userId: actor }) },
      "next/navigation": {},
    });
    const connection = loadServerModule("src/features/chat/connection.ts", {
      "@/integrations/chatwoot/admin-client": { ChatwootAdminClient },
      "./secrets": { decryptChatSecret },
    });
    const setup = loadServerModule("src/features/chat/transport-setup.ts", {
      zod,
      "node:crypto": await import("node:crypto"),
      "@/lib/auth/super-admin": auth,
      "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
      "./connection": connection,
      "./secrets": { encryptChatSecret },
      "./ingress": { validWebhookSecret },
      "@/integrations/chatwoot/onboarding": { provisionChatwootTransport },
    });
    const action = loadServerModule("src/features/chat/transport-actions.ts", {
      "./transport-setup": setup,
      "next/cache": { revalidatePath: (path) => invalidations.push(path) },
    }).connectPlatformChatTransportAction;
    await run({
      action,
      workspace,
      networkCalls,
      writes,
      calls,
      invalidations,
      receipts,
      loseBotResponse() {
        loseBotReply = true;
      },
      revokeDuringDiscovery() {
        revokeOnDiscovery = true;
      },
      setActor(value) {
        actor = value;
      },
      setModule(value) {
        moduleEnabled = value;
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("platform connection action reaches audited transport setup and never attaches an off inbox", () =>
  scenario(async ({ action, workspace, writes, invalidations }) => {
    const result = await action({ tenantId: tenant, webhookSecret: secret });
    assert.equal(result.ok, true);
    assert.deepEqual(writes, [
      "/platform/api/v1/agent_bots",
      "/api/v1/accounts/12/webhooks",
    ]);
    assert.deepEqual(invalidations, ["/super-admin/chat-workspaces"]);
    assert.equal(Object.keys(result).sort().join(","), "message,ok");
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.equal(
      decryptChatSecret(workspace.bot_token_enc, {
        tenantId: tenant,
        workspaceId: workspace.id,
        purpose: "bot_token",
      }),
      "synthetic-bot",
    );
  }));
test("non-platform callers and disabled execution gates cannot reach transport", () =>
  scenario(async ({ action, setActor, networkCalls, calls, invalidations }) => {
    for (const actor of [
      null,
      "synthetic-owner-admin",
      "synthetic-manager",
      "synthetic-viewer",
      "synthetic-finance",
    ]) {
      setActor(actor);
      assert.equal(
        (await action({ tenantId: tenant, webhookSecret: secret })).ok,
        false,
      );
    }
    setActor("synthetic-platform-owner");
    for (const [name, disabled] of [
      ["CHAT_FOUNDATION_ENABLED", "false"],
      ["CHAT_DRY_RUN", "true"],
      ["CHAT_ADMIN_LIVE_ENABLED", "false"],
      ["CHATWOOT_PLATFORM_TOKEN", ""],
    ]) {
      const saved = process.env[name];
      process.env[name] = disabled;
      try {
        assert.equal(
          (await action({ tenantId: tenant, webhookSecret: secret })).ok,
          false,
        );
      } finally {
        process.env[name] = saved;
      }
    }
    assert.equal(networkCalls.length, 0);
    assert.equal(calls.length, 0);
    assert.equal(invalidations.length, 0);
  }));

test("wrong workspace, secret and malformed input cannot write or expose setup material", () =>
  scenario(async ({ action, writes, networkCalls, calls }) => {
    for (const input of [
      { tenantId: other, webhookSecret: secret },
      {
        tenantId: tenant,
        webhookSecret: "different-synthetic-secret-" + "z".repeat(32),
      },
      {
        tenantId: tenant,
        webhookSecret: secret,
        actor: "synthetic-platform-owner",
      },
      { tenantId: "invalid", webhookSecret: secret },
      { tenantId: tenant, webhookSecret: "short" },
    ]) {
      const result = await action(input);
      assert.equal(result.ok, false);
      assert.equal(Object.keys(result).sort().join(","), "message,ok");
      assert.ok(!JSON.stringify(result).includes(secret));
    }
    assert.equal(writes.length, 0);
    assert.equal(networkCalls.length, 0);
    assert.equal(calls.length, 0);
  }));

test("lost provider response is reconciled without a second bot and completed setup replays safely", () =>
  scenario(async ({ action, loseBotResponse, writes, invalidations }) => {
    loseBotResponse();
    const first = await action({ tenantId: tenant, webhookSecret: secret });
    assert.equal(first.ok, false);
    assert.ok(!JSON.stringify(first).includes("PRIVATE_PROVIDER_DETAIL"));
    assert.equal(invalidations.length, 0);
    assert.equal(writes.length, 1);
    assert.equal(
      (await action({ tenantId: tenant, webhookSecret: secret })).ok,
      true,
    );
    assert.deepEqual(writes, [
      "/platform/api/v1/agent_bots",
      "/api/v1/accounts/12/webhooks",
    ]);
    assert.equal(
      (await action({ tenantId: tenant, webhookSecret: secret })).ok,
      true,
    );
    assert.equal(writes.length, 2);
  }));

test("module denial and platform access revoked during discovery prevent every external write", async () => {
  for (const mode of ["module-disabled", "platform-revoked"]) {
    await scenario(
      async ({
        action,
        setModule,
        revokeDuringDiscovery,
        writes,
        invalidations,
      }) => {
        if (mode === "module-disabled") setModule(false);
        else revokeDuringDiscovery();
        const result = await action({
          tenantId: tenant,
          webhookSecret: secret,
        });
        assert.equal(result.ok, false);
        assert.ok(!JSON.stringify(result).includes("PRIVATE_STORAGE_DETAIL"));
        assert.ok(!JSON.stringify(result).includes(secret));
        assert.equal(writes.length, 0);
        assert.equal(invalidations.length, 0);
      },
    );
  }
});
