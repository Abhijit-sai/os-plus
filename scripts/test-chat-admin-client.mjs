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

test("conversation labels are read and merged before replacement; duplicates are removed", async () => {
  let labels = ["existing"],
    reads = 0;
  await mock(
    async (req, res) => {
      assert.equal(req.headers["api-access-token"], "synthetic-token");
      assert.equal(req.url, "/api/v1/accounts/12/conversations/8/labels");
      if (req.method === "GET") {
        reads++;
        res.end(JSON.stringify({ payload: labels }));
      } else {
        let body = "";
        for await (const chunk of req) body += chunk;
        labels = JSON.parse(body).labels;
        res.end(JSON.stringify({ payload: labels }));
      }
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "synthetic-token",
        allowLocalMock: true,
      });
      await client.addLabels(12, 8, ["new", "existing"]);
    },
  );
  assert.equal(reads, 1);
  assert.deepEqual(labels, ["existing", "new"]);
});

test("onboarding API helpers validate bot scope, project user data and accept an empty attachment response", async () => {
  const calls = [];
  await mock(
    async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      calls.push([req.method, req.url, body ? JSON.parse(body) : null]);
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/platform/api/v1/users")
        res.end(
          JSON.stringify({
            id: 21,
            email: "staff@example.invalid",
            name: "Synthetic staff",
            access_token: "discard-user-token",
          }),
        );
      else if (req.url === "/platform/api/v1/agent_bots")
        res.end(
          JSON.stringify(
            req.method === "GET"
              ? [
                  {
                    id: 31,
                    name: "OS PLUS",
                    account_id: 12,
                    outgoing_url: "https://app.example.invalid/hook",
                    access_token: "synthetic-bot-token",
                  },
                ]
              : {
                  id: 31,
                  name: "OS PLUS",
                  account_id: 12,
                  outgoing_url: "https://app.example.invalid/hook",
                  access_token: "synthetic-bot-token",
                },
          ),
        );
      else if (req.url === "/api/v1/accounts/12/webhooks")
        res.end(
          JSON.stringify(
            req.method === "GET"
              ? {
                  payload: {
                    webhooks: [
                      {
                        id: 41,
                        url: "https://app.example.invalid/events",
                        subscriptions: ["message_created"],
                      },
                    ],
                  },
                }
              : {
                  payload: {
                    webhook: {
                      id: 41,
                      url: "https://app.example.invalid/events",
                      subscriptions: ["message_created"],
                    },
                  },
                },
          ),
        );
      else if (req.url.endsWith("/agent_bot"))
        res.end(JSON.stringify({ agent_bot: null }));
      else if (req.url.endsWith("/set_agent_bot")) res.end();
      else {
        res.statusCode = 404;
        res.end("{}");
      }
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "synthetic-token",
        allowLocalMock: true,
      });
      const user = await client.createUser(
        "Synthetic staff",
        "staff@example.invalid",
      );
      assert.deepEqual(user, {
        id: 21,
        name: "Synthetic staff",
        email: "staff@example.invalid",
      });
      assert.equal((await client.listAgentBots())[0].accountId, 12);
      assert.equal(
        (
          await client.createAgentBot(
            12,
            "OS PLUS",
            "https://app.example.invalid/hook",
          )
        ).id,
        31,
      );
      assert.equal((await client.listWebhooks(12))[0].id, 41);
      assert.equal(
        (await client.createWebhook(12, "https://app.example.invalid/events"))
          .id,
        41,
      );
      assert.equal(await client.getInboxBot(12, 4), null);
      await client.attachBot(12, 4, 31);
    },
  );
  assert.deepEqual(calls.at(-1), [
    "POST",
    "/api/v1/accounts/12/inboxes/4/set_agent_bot",
    { agent_bot: 31 },
  ]);
  assert.deepEqual(
    calls.find((c) => c[0] === "POST" && c[1].endsWith("/webhooks"))[2],
    {
      webhook: {
        url: "https://app.example.invalid/events",
        subscriptions: ["message_created"],
      },
    },
  );
});

test("pinned live Chatwoot returns an empty object for an unassigned inbox bot", async () => {
  for (const [body, expected] of [
    [{}, null],
    [{ agent_bot: null }, null],
    [{ agent_bot: { id: 42, name: "Local bot" } }, 42],
  ]) {
    await mock(
      (req, res) => res.end(JSON.stringify(body)),
      async (origin) => {
        const client = new ChatwootAdminClient({
          origin,
          token: "synthetic-only",
          allowLocalMock: true,
        });
        assert.equal(await client.getInboxBot(12, 4), expected);
      },
    );
  }
  await mock(
    (req, res) => res.end(JSON.stringify({ unexpected: true })),
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "synthetic-only",
        allowLocalMock: true,
      });
      await assert.rejects(
        () => client.getInboxBot(12, 4),
        /Chat connection unavailable/,
      );
    },
  );
});

test("conversation routing validates account, inbox and conversation and never returns provider credentials", async () => {
  await mock(
    (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          id: 4,
          account_id: 12,
          inbox_id: 8,
          meta: { assignee: { id: 22, access_token: "never-return" } },
        }),
      );
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "synthetic-token",
        allowLocalMock: true,
      });
      assert.deepEqual(await client.conversationRouting(12, 4, 8), {
        assigneeId: 22,
      });
      await assert.rejects(
        client.conversationRouting(12, 4, 99),
        /unavailable/,
      );
    },
  );
});

test("handoff label merge preserves unrelated observed labels and reconciles an already applied label without another POST", async () => {
  let labels = ["urgent", "existing-label"],
    posts = 0;
  await mock(
    async (req, res) => {
      if (req.method === "POST") {
        let data = "";
        for await (const b of req) data += b;
        labels = JSON.parse(data).labels;
        posts++;
      }
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ payload: labels }));
    },
    async (origin) => {
      const client = new ChatwootAdminClient({
        origin,
        token: "synthetic-token",
        allowLocalMock: true,
      });
      await client.mergeConversationLabel(901, 1, "osplus-handoff");
      assert.deepEqual(labels, ["urgent", "existing-label", "osplus-handoff"]);
      await client.mergeConversationLabel(901, 1, "osplus-handoff");
      assert.equal(posts, 1);
    },
  );
});


test("staff discovery is scoped to the exact account and strips tokens; mismatches fail closed", async () => {
  for (const mismatch of [false, true]) {
    await mock((req,res)=>{
      assert.equal(req.url,"/api/v1/accounts/12/agents");
      res.end(JSON.stringify([{id:3,account_id:mismatch?99:12,name:"Synthetic staff",email:"staff@example.invalid",role:"agent",confirmed:true,access_token:"never-return"}]));
    },async origin=>{
      const client=new ChatwootAdminClient({origin,token:"synthetic-token",allowLocalMock:true});
      if(mismatch) await assert.rejects(client.listAccountUsers(12),{message:"Chat connection unavailable."});
      else assert.deepEqual(await client.listAccountUsers(12),[{id:3,name:"Synthetic staff",email:"staff@example.invalid",role:"agent"}]);
    });
  }
});
