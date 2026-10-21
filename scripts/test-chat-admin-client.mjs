import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { ChatwootAdminClient } from "../src/integrations/chatwoot/admin-client.ts";
async function mock(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run("http://127.0.0.1:" + server.address().port);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
test("mock account verification and inbox sync use pinned API auth and strip remote secrets", async () => {
  const paths = [];
  await mock(
    (req, res) => {
      paths.push(req.url);
      assert.equal(req.headers["api-access-token"], "synthetic-token");
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify(
          req.url.endsWith("/inboxes")
            ? {
                payload: [
                  {
                    id: 4,
                    name: "Example",
                    channel_type: "Channel::Whatsapp",
                    provider_config: { api_key: "never-return" },
                    phone_number: "+919000000001",
                  },
                ],
              }
            : { id: 12, name: "Example account" },
        ),
      );
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "synthetic-token",
        allowLocalMock: true,
      });
      assert.deepEqual(await client.verifyAccount(12), {
        id: 12,
        name: "Example account",
      });
      assert.deepEqual(await client.listInboxes(12), [
        { id: 4, name: "Example", kind: "whatsapp" },
      ]);
    },
  );
  assert.deepEqual(paths, [
    "/api/v1/accounts/12",
    "/api/v1/accounts/12/inboxes",
  ]);
});

test("account mismatch, malformed inbox, redirect, large body and timeout fail safely", async () => {
  for (const scenario of [
    "mismatch",
    "invalid",
    "redirect",
    "large",
    "timeout",
  ]) {
    await mock(
      (req, res) => {
        if (scenario === "timeout") return;
        if (scenario === "redirect") {
          res.writeHead(302, { Location: "http://127.0.0.1:1/private" });
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(
          scenario === "large"
            ? "x".repeat(1048577)
            : JSON.stringify(
                scenario === "mismatch"
                  ? { id: 999, name: "Other" }
                  : { payload: [{ id: "wrong", api_token: "do-not-leak" }] },
              ),
        );
      },
      async (origin) => {
        const client = new ChatwootAdminClient({
          origin,
          token: "private",
          allowLocalMock: true,
          timeoutMs: 100,
        });
        await assert.rejects(
          scenario === "invalid"
            ? client.listInboxes(12)
            : client.verifyAccount(12),
          { message: "Chat connection unavailable." },
        );
      },
    );
  }
});
test("account creation includes a stable reconciliation marker and does not retry an uncertain POST", async () => {
  let creates = 0,
    body;
  await mock(
    (req, res) => {
      assert.equal(req.url, "/platform/api/v1/accounts");
      creates++;
      req.on("data", (chunk) => {
        body = JSON.parse(chunk.toString());
      });
      req.on("end", () => {
        res.end(
          JSON.stringify({
            id: 25,
            name: "Synthetic account",
            custom_attributes: body.custom_attributes,
          }),
        );
      });
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "platform-private",
        allowLocalMock: true,
      });
      const result = await client.createAccount(
        "Synthetic account",
        "10000000-0000-4000-8000-000000000001",
      );
      assert.equal(result.id, 25);
      assert.deepEqual(body.custom_attributes, {
        osplus_provisioning_key: "10000000-0000-4000-8000-000000000001",
      });
    },
  );
  assert.equal(creates, 1);
});

test("failed creation makes one request; reconciliation rejects another workspace's marker", async () => {
  let creates = 0;
  await mock(
    (req, res) => {
      if (req.method === "POST") {
        creates++;
        req.socket.destroy();
        return;
      }
      res.end(
        JSON.stringify({
          id: 25,
          name: "Wrong",
          custom_attributes: {
            osplus_provisioning_key: "20000000-0000-4000-8000-000000000001",
          },
        }),
      );
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "platform-private",
        allowLocalMock: true,
      });
      await assert.rejects(
        client.createAccount(
          "Synthetic",
          "10000000-0000-4000-8000-000000000001",
        ),
      );
      await assert.rejects(
        client.verifyProvisionedAccount(
          25,
          "10000000-0000-4000-8000-000000000001",
        ),
      );
    },
  );
  assert.equal(creates, 1);
});
