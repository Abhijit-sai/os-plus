import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import * as zod from "zod";
import * as permissions from "../src/features/chat/permissions.ts";
import * as schemas from "../src/features/chat/schemas.ts";
import { loadServerModule } from "./chat-db-harness/server-adapter.mjs";
const tenant = "84000000-0000-4000-8000-000000000001";
const channel = "84000000-0000-4000-8000-000000000002";
async function scenario(run) {
  const names = ["CHAT_FOUNDATION_ENABLED", "CHAT_ACTIONS_ENABLED"];
  const old = Object.fromEntries(names.map((k) => [k, process.env[k]]));
  process.env.CHAT_FOUNDATION_ENABLED = "true";
  process.env.CHAT_ACTIONS_ENABLED = "false";
  const calls = [],
    invalidations = [];
  let role = "owner_admin",
    enabled = true;
  const db = {
    from(table) {
      const data = table === "tenant_modules" ? { is_enabled: enabled } : [];
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle: async () => ({ data, error: null }),
        then(resolve, reject) {
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, input) {
      calls.push(JSON.parse(JSON.stringify({ name, ...input })));
      return { data: { id: channel, version: 1 }, error: null };
    },
  };
  try {
    const guard = loadServerModule("src/features/chat/module.ts", {
      "@/lib/tenant/context": {
        requireTenantContext: async () => ({
          tenant: { id: tenant, status: "active" },
          membership: {
            tenant_id: tenant,
            clerk_user_id: "synthetic-owner",
            role,
            status: "active",
          },
        }),
      },
      "@/lib/supabase/server": { createSupabaseServiceRoleClient: () => db },
      "./permissions": permissions,
    });
    const context = loadServerModule("src/core/command-context/server.ts", {});
    const action = loadServerModule(
      "src/features/chat/channel-off-actions.ts",
      {
        zod,
        "./module": guard,
        "./schemas": schemas,
        "@/core/command-context/server": context,
        "next/cache": { revalidatePath: (p) => invalidations.push(p) },
      },
    ).setChannelStaffOnlyAction;
    await run({
      action,
      calls,
      invalidations,
      setRole(v) {
        role = v;
      },
      setEnabled(v) {
        enabled = v;
      },
    });
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("owner can switch a channel off while advanced actions stay disabled, with no booking or routing", () =>
  scenario(async ({ action, calls, invalidations }) => {
    const key = randomUUID();
    const result = await action(
      { channelId: channel, version: 0 },
      key,
      tenant,
    );
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "chat_action_configure");
    assert.equal(calls[0].p_context.tenantId, tenant);
    assert.equal(calls[0].p_context.actor.id, "synthetic-owner");
    assert.equal(calls[0].p_context.idempotencyKey, key);
    assert.deepEqual(calls[0].p_input, {
      channelId: channel,
      version: 0,
      mode: "off",
      canBook: false,
      packId: null,
      approveAuto: false,
      locationId: null,
      teamId: null,
    });
    assert.deepEqual(invalidations, ["/settings/chat"]);
    assert.equal(process.env.CHAT_ACTIONS_ENABLED, "false");
  }));
test("Off-only action rejects other roles, disabled setup, stale business and attempts to enable modes", () =>
  scenario(async ({ action, calls, setRole, setEnabled }) => {
    for (const role of ["manager", "viewer", "finance"]) {
      setRole(role);
      assert.equal(
        (await action({ channelId: channel, version: 0 }, randomUUID(), tenant))
          .ok,
        false,
      );
    }
    setRole("owner_admin");
    setEnabled(false);
    assert.equal(
      (await action({ channelId: channel, version: 0 }, randomUUID(), tenant))
        .ok,
      false,
    );
    setEnabled(true);
    assert.equal(
      (
        await action(
          { channelId: channel, version: 0 },
          randomUUID(),
          "84000000-0000-4000-8000-000000000009",
        )
      ).ok,
      false,
    );
    for (const input of [
      { channelId: channel, version: 0, mode: "auto" },
      { channelId: channel, version: 0, canBook: true },
      { channelId: channel, version: -1 },
    ]) {
      assert.equal((await action(input, randomUUID(), tenant)).ok, false);
    }
    assert.equal(calls.length, 0);
  }));
