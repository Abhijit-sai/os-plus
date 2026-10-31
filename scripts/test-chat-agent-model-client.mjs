import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
test("model adapter uses bounded JSON requests, explicit model/provider and exact usage; missing costs stay unknown", async () => {
  const { OpenRouterClient } =
    await import("../src/integrations/openrouter/client.ts");
  let body,
    token,
    hits = 0,
    payload = {
      id: "gen-synthetic",
      model: "test/mock",
      choices: [
        { finish_reason: "stop", message: { content: '{"text":"Preview"}' } },
      ],
      usage: { cost: 0.000123, prompt_tokens: 20, completion_tokens: 10 },
    };
  const server = createServer((req, res) => {
    hits++;
    token = req.headers.authorization;
    let data = "";
    req.on("data", (b) => (data += b));
    req.on("end", () => {
      body = JSON.parse(data);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = new OpenRouterClient({
      origin: "http://127.0.0.1:" + server.address().port,
      token: "synthetic-test-token",
      allowLocalMock: true,
    });
    const input = {
      model: "test/mock",
      provider: "synthetic-provider",
      system: "Return strict JSON.",
      user: "Synthetic inquiry",
      maxTokens: 100,
      maxPrice: { prompt: 1, completion: 2, request: 0 },
      timeoutMs: 1000,
    };
    const result = await client.complete(input);
    assert.deepEqual(result.json, { text: "Preview" });
    assert.equal(result.costUsd, "0.000123000000");
    assert.equal(token, "Bearer synthetic-test-token");
    assert.equal(body.response_format.type, "json_object");
    assert.equal(body.provider.allow_fallbacks, false);
    assert.deepEqual(body.provider.only, ["synthetic-provider"]);
    assert.equal(body.provider.require_parameters, true);
    assert.equal(body.models, undefined);
    payload = {
      ...payload,
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    };
    await assert.rejects(
      client.complete(input),
      (error) =>
        error.costUsd === null &&
        !String(error).includes("synthetic-test-token"),
    );
    payload = {
      ...payload,
      choices: [{ finish_reason: "stop", message: { content: "not JSON" } }],
      usage: { cost: 0.0001 },
    };
    await assert.rejects(
      client.complete(input),
      (error) => error.costUsd === "0.000100000000",
    );
    const live = new OpenRouterClient({ token: "synthetic-test-token" });
    const old = process.env.CHAT_MODEL_LIVE_ENABLED;
    delete process.env.CHAT_MODEL_LIVE_ENABLED;
    try {
      await assert.rejects(live.complete(input));
    } finally {
      if (old === undefined) delete process.env.CHAT_MODEL_LIVE_ENABLED;
      else process.env.CHAT_MODEL_LIVE_ENABLED = old;
    }
    assert.equal(hits, 3);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
