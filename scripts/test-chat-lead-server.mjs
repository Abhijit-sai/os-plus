import assert from "node:assert/strict";
import { test } from "node:test";
test("server conversion prepares validated platform phones; clients cannot submit their own canonical or tenant identity", async () => {
  const { prepareLeadCommand } =
    await import("../src/features/leads/schemas.ts");
  const id = "50000000-0000-4000-8000-000000000001";
  const prepared = prepareLeadCommand({
    action: "contact.convert",
    input: { contactId: id, name: "  New Customer ", phone: "9876543210" },
  });
  assert.equal(prepared.input.phoneE164, "+919876543210");
  assert.equal(prepared.input.name, "New Customer");
  assert.throws(() =>
    prepareLeadCommand({
      action: "contact.convert",
      input: { contactId: id, name: "A" },
    }),
  );
  assert.throws(() =>
    prepareLeadCommand({
      action: "contact.convert",
      input: { contactId: id, name: "Example", phone: "garbage" },
    }),
  );
  assert.throws(() =>
    prepareLeadCommand({
      action: "contact.convert",
      input: { contactId: id, name: "Example", phoneE164: "+919876543210" },
    }),
  );
  assert.throws(() =>
    prepareLeadCommand({
      action: "contact.convert",
      input: { contactId: id, name: "Example", tenantId: id },
    }),
  );
});

test("refresh HTTP boundary is disabled by default, authenticates exactly, validates bounded input and creates system context", async () => {
  const { handleLeadRefresh } =
    await import("../src/features/leads/refresh-handler.ts");
  const id = "50000000-0000-4000-8000-000000000001",
    secret = "synthetic-only-" + "a".repeat(40);
  const body = { tenantId: id, leadId: id };
  const calls = [];
  const deps = {
    refresh: async (ctx, input) => {
      calls.push({ ctx, input });
      return { scanned: 1, updated: 1, nextAfterId: null };
    },
  };
  const request = (value = body, token = secret) =>
    new Request("https://app.example.invalid/api/chat/cron/stages", {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      body: JSON.stringify(value),
    });
  assert.equal((await handleLeadRefresh(request(), deps, {})).status, 404);
  const env = {
    CHAT_FOUNDATION_ENABLED: "true",
    CHAT_LEAD_REFRESH_ENABLED: "true",
    CHAT_LEAD_REFRESH_SECRET: secret,
  };
  assert.equal(
    (await handleLeadRefresh(request(body, "wrong"), deps, env)).status,
    404,
  );
  assert.equal(
    (await handleLeadRefresh(request({ ...body, actor: "owner" }), deps, env))
      .status,
    400,
  );
  assert.equal(
    (await handleLeadRefresh(request({ tenantId: "bad" }), deps, env)).status,
    400,
  );
  assert.equal(
    (
      await handleLeadRefresh(
        request({ ...body, extra: "a".repeat(2000) }),
        deps,
        env,
      )
    ).status,
    400,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handleLeadRefresh(request(), deps, env)).status, 200);
  assert.equal(calls[0].ctx.tenantId, id);
  assert.deepEqual(calls[0].ctx.actor, {
    type: "SYSTEM",
    id: "chat-stage-refresh",
  });
  assert.deepEqual(calls[0].input, { leadId: id });
  env.CHAT_LEAD_REFRESH_ENABLED = "false";
  assert.equal((await handleLeadRefresh(request(), deps, env)).status, 404);
});
