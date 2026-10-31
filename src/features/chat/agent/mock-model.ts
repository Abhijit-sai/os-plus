import { z } from "zod";
import { parseKnowledgePack } from "../knowledge-pack.ts";
import { agentMessageSchema } from "./rules.ts";
import type { MockAgentModel } from "./turn.ts";

export const mockScenarioSchema = z.enum([
  "information",
  "identity",
  "handoff",
  "vendor",
  "payment_claim",
  "unsafe_response",
  "booking",
  "confirm",
  "cancel",
  "complaint",
  "financial",
  "location",
  "price_list",
]);
/** Explicit demonstration scenarios, not a real language model or keyword-based production bot. */
export function createMockModel(
  rawScenario: unknown,
  packInput: unknown,
): MockAgentModel {
  const scenario = mockScenarioSchema.parse(rawScenario),
    pack = parseKnowledgePack(packInput);
  return {
    kind: "mock",
    async complete({ stage, context, signal }) {
      signal.throwIfAborted();
      if (stage === "write" || stage === "rewrite")
        return {
          json: {
            text:
              scenario === "unsafe_response"
                ? "Your total is INR 999."
                : "{{FACT:hours}}",
          },
          model: "local-synthetic-mock",
          costUsd: "0",
        };
      const data = z
        .object({ messages: z.array(agentMessageSchema).max(500) })
        .passthrough()
        .parse(context);
      const trigger = data.messages
        .filter((message) => message.author === "customer" && !message.private)
        .at(-1);
      if (!trigger?.content) throw new Error("Mock input unavailable.");
      const signals =
        stage === "classify" &&
        [
          "identity",
          "handoff",
          "vendor",
          "payment_claim",
          "booking",
          "confirm",
          "cancel",
          "complaint",
          "financial",
          "location",
          "price_list",
        ].includes(scenario)
          ? [
              {
                kind: scenario,
                quote: trigger.content.slice(0, 1000),
                messageId: trigger.id,
              },
            ]
          : [];
      const json =
        stage === "classify"
          ? { signals }
          : {
              intent: null,
              confidence: "high",
              services:
                scenario === "booking"
                  ? pack.services
                      .filter((service) =>
                        [service.name, ...service.aliases].some((label) =>
                          trigger
                            .content!.toLowerCase()
                            .includes(label.toLowerCase()),
                        ),
                      )
                      .map((service) => service.key)
                  : [],
              language: pack.brand.languages[0],
              gist: trigger.content.slice(0, 1000),
              signals: [],
              slots:
                scenario === "booking"
                  ? [
                      ...trigger.content.matchAll(
                        /(?:name|address|area|date|window|timePreference)=([^;\n]+)/g,
                      ),
                    ].map((match) => ({
                      key: match[0].slice(0, match[0].indexOf("=")),
                      value: match[1].trim(),
                      quote: match[0],
                      messageId: trigger.id,
                    }))
                  : [],
            };
      return { json, model: "local-synthetic-mock", costUsd: "0" };
    },
  };
}
