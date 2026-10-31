import { z } from "zod";
import {
  agentMessageSchema,
  compareMessages,
  type AgentMessage,
} from "./rules.ts";

/** D040 defaults apply only when not explicitly configured; historical messages/ledgers stay intact. */
export const sessionPolicySchema = z
  .object({
    continueMinutes: z.number().int().min(1).max(1440).default(30),
    freshHours: z.number().int().min(1).max(168).default(24),
  })
  .strict()
  .refine(
    (value) => value.continueMinutes < value.freshHours * 60,
    "Fresh interval must exceed continuing interval.",
  );
const inputSchema = z
  .object({
    triggerId: z.string().uuid(),
    messages: z.array(agentMessageSchema).min(1).max(500),
    policy: sessionPolicySchema.default({}),
  })
  .strict();

export function sliceSession(raw: unknown): {
  band: "continuing" | "resumed" | "fresh";
  messages: AgentMessage[];
  startedAt: string;
} {
  const input = inputSchema.parse(raw);
  const messages = input.messages
    .filter((m) => !m.private && m.author !== "system")
    .sort(compareMessages);
  const index = messages.findIndex(
    (m) => m.id === input.triggerId && m.author === "customer",
  );
  if (index < 0 || new Set(messages.map((m) => m.id)).size !== messages.length)
    throw new Error("Invalid session history.");
  const current = messages[index],
    previous = messages[index - 1];
  const gap = previous
    ? Date.parse(current.at) - Date.parse(previous.at)
    : Infinity;
  const freshMs = input.policy.freshHours * 3600000;
  const band =
    gap > freshMs
      ? "fresh"
      : gap >= input.policy.continueMinutes * 60000
        ? "resumed"
        : "continuing";
  let start = index;
  while (
    start > 0 &&
    Date.parse(messages[start].at) - Date.parse(messages[start - 1].at) <=
      freshMs
  )
    start--;
  return {
    band,
    messages: messages.slice(start, index + 1),
    startedAt: messages[start].at,
  };
}
