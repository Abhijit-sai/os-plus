import { z } from "zod";
import type { AgentMessage } from "./rules.ts";
export const ledgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionStartedAt: z.string().datetime({ offset: true }),
    requestOpen: z.boolean(),
    vendorQuietUntil: z.string().datetime({ offset: true }).nullable(),
    language: z.string().min(2).max(40).nullable().default(null),
    handoff: z.boolean().default(false),
  })
  .strict();
export type InquiryLedger = z.infer<typeof ledgerSchema>;

/** Only public replies establish something actually said. Private suggestions never start vendor quiet. */
export function inquiryLedger(
  raw: unknown,
  session: { band: string; startedAt: string; messages: AgentMessage[] },
  vendorReply: string,
  quietMinutes: number,
): InquiryLedger {
  const initial = ledgerSchema.parse({
    schemaVersion: 1,
    sessionStartedAt: session.startedAt,
    requestOpen: false,
    vendorQuietUntil: null,
  });
  const stored = z.object({}).strict().safeParse(raw).success
    ? initial
    : ledgerSchema.parse(raw);
  const next =
    session.band === "fresh"
      ? initial
      : { ...stored, sessionStartedAt: session.startedAt };
  const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase();
  const vendor = session.messages
    .filter(
      (m) =>
        !m.private &&
        (m.author === "staff" || m.author === "bot") &&
        normalize(m.content ?? "") === normalize(vendorReply),
    )
    .at(-1);
  if (vendor)
    next.vendorQuietUntil = new Date(
      Date.parse(vendor.at) + quietMinutes * 60000,
    ).toISOString();
  return next;
}
