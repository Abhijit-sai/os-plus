import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { runAgentTurn } from "../../src/features/chat/agent/turn.ts";
import { brands, benchCases, benchRequest } from "./fixtures.mjs";
export async function runBenchCase(fixture) {
  const request = benchRequest(fixture),
    calls = [],
    model = {
      kind: "mock",
      async complete({ stage, signal }) {
        calls.push(stage);
        if (fixture.name === "model_down")
          throw new Error("PRIVATE_PROVIDER_FAILURE_SENTINEL");
        if (fixture.name === "model_timeout")
          return new Promise((resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => reject(new Error("Synthetic timeout")),
              { once: true },
            );
          });
        let json;
        if (stage === "understand")
          json = {
            intent: null,
            services: [],
            language: "en",
            gist: "Synthetic inquiry",
            confidence: "high",
            signals: [],
            slots: [],
          };
        else if (stage === "classify")
          json = {
            signals: [
              "identity",
              "payment_claim",
              "booking",
              "financial",
              "bad_evidence",
            ].includes(fixture.name)
              ? [
                  {
                    kind:
                      fixture.name === "bad_evidence"
                        ? "payment_claim"
                        : fixture.name,
                    quote:
                      fixture.name === "bad_evidence"
                        ? "I paid another business"
                        : fixture.text,
                    messageId: request.scope.triggerMessageId,
                  },
                ]
              : [],
          };
        else
          json = {
            text:
              fixture.name === "unsafe_money"
                ? "Your total is INR 999."
                : fixture.name === "unsafe_promise"
                  ? "Your booking is confirmed."
                  : "{{FACT:hours}}",
          };
        return { json, model: "ch10-local-mock", costUsd: "0" };
      },
    };
  const started = performance.now();
  if (fixture.name.startsWith("foreign_")) {
    await assert.rejects(runAgentTurn(request, model));
    assert.deepEqual(calls, []);
    return {
      brand: fixture.brand,
      case: fixture.name,
      status: "pass",
      outcome: "rejected_scope",
      modelCalls: 0,
      costUsd: "0",
      localMs: performance.now() - started,
    };
  }
  const result = await runAgentTurn(request, model),
    locked = request.data.pack.body.locked;
  assert.equal(result.mode, "draft");
  assert.equal(result.costUsd, "0");
  const other = brands[1 - fixture.index];
  assert.ok(!JSON.stringify(result).includes(other.name));
  assert.ok(!JSON.stringify(result).includes(other.hours));
  assert.ok(
    !JSON.stringify(result).includes("PRIVATE_PROVIDER_FAILURE_SENTINEL"),
  );
  assert.ok(!(result.replyText ?? "").includes("{{"));
  if (["closing", "quiet", "newer"].includes(fixture.name)) {
    assert.equal(result.outcome, "silent");
    assert.equal(result.replyText, null);
    assert.deepEqual(calls, []);
  } else if (fixture.name === "hours") {
    assert.equal(result.outcome, "drafted");
    assert.equal(result.replyText, brands[fixture.index].hours);
    assert.deepEqual(result.provenance, [
      { kind: "knowledge", version: fixture.index + 1, reference: "hours" },
    ]);
  } else if (fixture.name === "identity") {
    assert.equal(result.replyText, locked.identityReply);
    assert.ok(!calls.includes("write"));
  } else if (fixture.name === "payment_claim") {
    assert.equal(result.outcome, "handoff");
    assert.equal(result.replyText, locked.paymentClaimReply);
    assert.ok(!calls.includes("write"));
  } else {
    assert.equal(result.replyText, locked.handoffLine);
    assert.equal(result.decision.handoff, true);
    if (["unsafe_money", "unsafe_promise"].includes(fixture.name))
      assert.equal(calls.filter((stage) => stage === "rewrite").length, 1);
    if (["booking", "financial"].includes(fixture.name))
      assert.ok(!calls.includes("write"));
  }
  return {
    brand: fixture.brand,
    case: fixture.name,
    status: "pass",
    outcome: result.outcome,
    modelCalls: calls.length,
    costUsd: "0",
    localMs: performance.now() - started,
  };
}
export async function runBench() {
  const cases = [];
  for (const fixture of benchCases) cases.push(await runBenchCase(fixture));
  return {
    kind: "offline-deterministic-guard-bench",
    modelQualityEvaluated: false,
    productionLatencyEvaluated: false,
    createdAt: new Date().toISOString(),
    total: cases.length,
    passed: cases.length,
    costUsd: "0",
    cases,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = await runBench();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
