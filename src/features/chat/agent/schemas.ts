import { z } from "zod";
import { parseKnowledgePack } from "../knowledge-pack.ts";
import { agentMessageSchema } from "./rules.ts";

const shortText = z.string().trim().min(1).max(2000);
const evidence = { messageId: z.string().uuid(), quote: shortText };
export const signalKindSchema = z.enum([
  "vendor",
  "payment_claim",
  "identity",
  "unreadable",
  "booking",
  "complaint",
  "order_status",
  "financial",
  "confirm",
  "cancel",
  "handoff",
]);
export const understandingSchema = z
  .object({
    intent: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/)
      .nullable(),
    services: z.array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)).max(100),
    language: z.string().min(2).max(40),
    gist: shortText,
    confidence: z.enum(["high", "low"]),
    signals: z
      .array(z.object({ kind: signalKindSchema, ...evidence }).strict())
      .max(20),
    slots: z
      .array(
        z
          .object({
            key: z.enum(["area", "preference", "time"]),
            value: shortText,
            ...evidence,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type Understanding = z.infer<typeof understandingSchema>;

/** Models supply observations, never record IDs, booking truth, consent or authority. */
export function validateUnderstanding(
  raw: unknown,
  sessionInput: unknown,
  packInput: unknown,
): Understanding {
  const understanding = understandingSchema.parse(raw);
  const pack = parseKnowledgePack(packInput);
  const session = z.array(agentMessageSchema).max(500).parse(sessionInput);
  if (
    (understanding.language &&
      !pack.brand.languages.includes(understanding.language)) ||
    (understanding.intent !== null &&
      pack.crm?.intentPriorities[understanding.intent] === undefined) ||
    understanding.services.some(
      (key) => !pack.services.some((service) => service.key === key),
    ) ||
    new Set(understanding.services).size !== understanding.services.length
  )
    throw new Error("Unsupported model observation.");
  for (const fact of [...understanding.signals, ...understanding.slots]) {
    const message = session.find((item) => item.id === fact.messageId);
    if (
      !message ||
      message.private ||
      message.author !== "customer" ||
      !message.content?.includes(fact.quote) ||
      ("value" in fact && !fact.quote.includes(fact.value))
    )
      throw new Error("Model observation lacks customer evidence.");
  }
  return understanding;
}
