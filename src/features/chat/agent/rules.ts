import { z } from "zod";

const instant = z.string().datetime({ offset: true });
export const agentMessageSchema = z
  .object({
    id: z.string().uuid(),
    providerId: z.number().int().positive().safe(),
    author: z.enum(["customer", "staff", "bot", "system"]),
    private: z.boolean(),
    content: z.string().max(150000).nullable(),
    at: instant,
  })
  .strict();
export type AgentMessage = z.infer<typeof agentMessageSchema>;
const preflightSchema = z
  .object({
    now: instant,
    triggerId: z.string().uuid(),
    messages: z.array(agentMessageSchema).max(500),
    quietUntil: instant.nullable(),
    openRequest: z.boolean(),
    acknowledgements: z.array(z.string().min(1).max(200)).max(100),
  })
  .strict();
const acknowledgement = (text: string) =>
  text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[.!！。]+$/u, "")
    .trim();
export const compareMessages = (a: AgentMessage, b: AgentMessage) =>
  Date.parse(a.at) - Date.parse(b.at) || a.providerId - b.providerId;

/** A burst is one request: a final "thanks" cannot hide its unanswered question. */
export function preflight(raw: unknown): {
  reason: "closing" | "quiet" | "superseded" | null;
} {
  const input = preflightSchema.parse(raw);
  const messages = input.messages
    .filter((message) => !message.private)
    .sort(compareMessages);
  if (
    new Set(messages.map((m) => m.id)).size !== messages.length ||
    messages.some((m) => Date.parse(m.at) > Date.parse(input.now) + 300000)
  )
    throw new Error("Invalid agent history.");
  const trigger = messages.find((message) => message.id === input.triggerId);
  if (!trigger || trigger.author !== "customer")
    throw new Error("Invalid agent trigger.");
  const customers = messages.filter((message) => message.author === "customer");
  if (customers.at(-1)?.id !== trigger.id) return { reason: "superseded" };
  if (input.quietUntil && Date.parse(input.quietUntil) > Date.parse(input.now))
    return { reason: "quiet" };
  const lastReply = messages
    .filter(
      (message) =>
        (message.author === "staff" || message.author === "bot") &&
        compareMessages(message, trigger) < 0,
    )
    .at(-1);
  const unanswered = customers.filter(
    (message) => !lastReply || compareMessages(message, lastReply) > 0,
  );
  const closing =
    !input.openRequest &&
    unanswered.length > 0 &&
    unanswered.every((message) =>
      input.acknowledgements.some(
        (word) =>
          acknowledgement(word) === acknowledgement(message.content ?? ""),
      ),
    );
  return { reason: closing ? "closing" : null };
}
