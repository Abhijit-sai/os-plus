import { test } from "node:test";
import assert from "node:assert/strict";
import { loadServerModule } from "./chat-db-harness/server-adapter.mjs";
const a = "81000000-0000-4000-8000-000000000001",
  b = "81000000-0000-4000-8000-000000000002";
test("stale setup forms cannot save an ID-less role grant or load another business's inboxes", async () => {
  let current = b,
    writes = 0,
    syncs = 0;
  const actions = loadServerModule("src/features/chat/actions.ts", {
    zod: await import("zod"),
    "./queries": {},
    "next/cache": { revalidatePath() {} },
    "./module": {
      requireChatPermission: async () => ({
        context: { tenant: { id: current } },
      }),
    },
    "./commands": {
      configureChat: async () => {
        writes++;
      },
      syncChatInboxes: async () => {
        syncs++;
        return [];
      },
    },
    "./platform-commands": {},
  });
  const input = {
    action: "role.grant",
    input: { role: "viewer", permission: "leads:view", allowed: true },
  };
  assert.equal(
    (await actions.saveChatAction(input, "synthetic-key", a)).ok,
    false,
  );
  assert.equal((await actions.syncChatInboxesAction(a)).ok, false);
  assert.equal(writes, 0);
  assert.equal(syncs, 0);
  current = a;
  assert.equal(
    (await actions.saveChatAction(input, "synthetic-key", a)).ok,
    true,
  );
  assert.equal(writes, 1);
});
test("stale widget requests stop before any inbox lookup", async () => {
  let reads = 0;
  const website = loadServerModule("src/features/chat/website/queries.ts", {
    zod: await import("zod"),
    "../module": {
      requireChatPermission: async () => ({
        context: { tenant: { id: b } },
        db: {
          from() {
            reads++;
            throw Error("No lookup expected");
          },
        },
      }),
    },
    "../connection": {},
    "../../leads/transport": {},
    "./rules": {},
  });
  await assert.rejects(
    website.getWebsiteWidget({
      tenantId: a,
      channelId: "82000000-0000-4000-8000-000000000001",
    }),
    /Business changed/,
  );
  assert.equal(reads, 0);
});
