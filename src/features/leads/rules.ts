import { z } from "zod";
import { normalizeCustomerPhone } from "../customers/phone.ts";

export const leadStageSchema = z.enum([
  "new",
  "engaged",
  "booked",
  "in_progress",
  "won",
  "lost",
]);
export type LeadStage = z.infer<typeof leadStageSchema>;
export const leadKindSchema = z.enum(["sales", "service", "spam"]);
const moment = z.string().datetime({ offset: true });
const progression = {
  new: 0,
  engaged: 1,
  booked: 2,
  in_progress: 3,
  won: 4,
  lost: 4,
} as const;
const stageInput = z
  .object({
    stage: leadStageSchema,
    kind: leadKindSchema,
    lastCustomerAt: moment,
    now: moment,
    lostAfterDays: z.number().int().min(1).max(365),
    booking: z
      .object({ confirmed: z.boolean(), active: z.boolean() })
      .optional(),
    order: z
      .object({
        status: z.string().min(1),
        paymentStatus: z.string().min(1),
        isDraft: z.boolean(),
      })
      .optional(),
  })
  .strict();

/** Evidence is loaded server-side from an explicitly linked tenant-owned record.
 * A customer's unrelated history and production completion are not delivery. */
export function decideLeadStage(input: unknown): {
  stage: LeadStage;
  reason: string | null;
} {
  const lead = stageInput.parse(input);
  if (lead.stage === "won" || lead.stage === "lost" || lead.kind !== "sales")
    return { stage: lead.stage, reason: null };
  const order =
    lead.order && !lead.order.isDraft && lead.order.status !== "cancelled"
      ? lead.order
      : null;
  let next: LeadStage = lead.stage;
  let reason: string | null = null;
  if (order) {
    next =
      order.paymentStatus === "paid" || order.status === "delivered"
        ? "won"
        : "in_progress";
    reason = next === "won" ? "linked_order_paid_or_delivered" : "linked_order";
  } else if (lead.booking?.confirmed) {
    next = "booked";
    reason = "confirmed_booking";
  }
  if (
    !order &&
    !lead.booking?.active &&
    !lead.booking?.confirmed &&
    (lead.stage === "new" || lead.stage === "engaged") &&
    Date.parse(lead.now) - Date.parse(lead.lastCustomerAt) >=
      lead.lostAfterDays * 86400000
  )
    return { stage: "lost", reason: "customer_silence" };
  return progression[next] > progression[lead.stage]
    ? { stage: next, reason }
    : { stage: lead.stage, reason: null };
}

const identityInput = z
  .object({
    workspaceId: z.string().uuid(),
    channelId: z.string().uuid(),
    kind: z.enum(["whatsapp", "instagram", "facebook", "website"]),
    contactId: z.number().int().positive().safe(),
    sourceId: z.string().trim().min(1).max(512).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    email: z.string().trim().max(320).nullable().optional(),
    displayName: z.string().trim().max(200).nullable().optional(),
  })
  .strict();
export type CaptureIdentity = {
  kind: "phone" | "chatwoot_contact" | "instagram" | "facebook" | "web_visitor";
  value: string;
  verified: boolean;
};

/** Unverified profile claims are metadata, never identity keys.
 * Provider source identifiers are scoped; equal Page/visitor ids need not be one person. */
export function captureIdentities(input: unknown) {
  const value = identityInput.parse(input);
  const identities: CaptureIdentity[] = [
    {
      kind: "chatwoot_contact",
      value: value.workspaceId + ":" + value.contactId,
      verified: true,
    },
  ];
  if (value.sourceId && value.kind !== "whatsapp")
    identities.push({
      kind: value.kind === "website" ? "web_visitor" : value.kind,
      value: value.channelId + ":" + value.sourceId,
      verified: true,
    });
  const phone = value.phone ? normalizeCustomerPhone(value.phone) : null;
  const sourcePhone =
    value.kind === "whatsapp" &&
    value.sourceId &&
    /^\+?[1-9][0-9]{7,14}$/.test(value.sourceId)
      ? normalizeCustomerPhone("+" + value.sourceId.replace(/^\+/, ""))
      : null;
  if (phone && sourcePhone?.e164 === phone.e164)
    identities.push({ kind: "phone", value: phone.e164, verified: true });
  return {
    identities,
    displayName: value.displayName || null,
    claimedPhone: value.phone || null,
    claimedEmail: value.email || null,
  };
}

const intentKey = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
export function mergeLeadIntent(input: unknown) {
  const { current, incoming, priorities } = z
    .object({
      current: intentKey.nullable(),
      incoming: intentKey.nullable(),
      priorities: z.record(intentKey, z.number().int().min(0).max(10000)),
    })
    .strict()
    .parse(input);
  if (incoming === null || priorities[incoming] === undefined) return current;
  if (
    current !== null &&
    (priorities[current] === undefined ||
      priorities[incoming] <= priorities[current])
  )
    return current;
  return incoming;
}

export function estimateLeadValue(input: unknown) {
  const money = z.number().finite().nonnegative().max(1_000_000_000);
  const { kind, orderAmounts, typicalBasket } = z
    .object({
      kind: leadKindSchema,
      orderAmounts: z.array(money).max(100000),
      typicalBasket: money.nullable(),
    })
    .strict()
    .parse(input);
  if (kind !== "sales") return null;
  if (!orderAmounts.length) return typicalBasket;
  const sorted = orderAmounts.toSorted((a, b) => a - b),
    middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) * 50) / 100;
}

/** Public reply clocks count bot and human separately; private/system activity is excluded upstream. */
export function leadClocks(input: unknown) {
  const value = z
    .object({
      stage: leadStageSchema,
      firstCustomerAt: moment,
      lastCustomerAt: moment,
      firstResponseAt: moment.nullable(),
      firstHumanResponseAt: moment.nullable(),
      lastReplyAt: moment.nullable(),
      now: moment,
    })
    .strict()
    .parse(input);
  const active = value.stage !== "won" && value.stage !== "lost";
  const seconds = (from: string, to: string) =>
    Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);
  const waiting =
    active &&
    (!value.lastReplyAt ||
      Date.parse(value.lastReplyAt) < Date.parse(value.lastCustomerAt));
  return {
    awaitingFirstReply: active && value.firstResponseAt === null,
    firstReplySeconds: value.firstResponseAt
      ? seconds(value.firstCustomerAt, value.firstResponseAt)
      : null,
    firstHumanReplySeconds: value.firstHumanResponseAt
      ? seconds(value.firstCustomerAt, value.firstHumanResponseAt)
      : null,
    waitingSeconds: waiting ? seconds(value.lastCustomerAt, value.now) : null,
  };
}

/** CHAT-D037: hot is configured interest plus recency; no inferred business taxonomy. */
export function isHotLead(input: unknown) {
  const value = z
    .object({
      stage: leadStageSchema,
      kind: leadKindSchema,
      intent: intentKey.nullable(),
      hotIntents: z.array(intentKey).max(100),
      lastCustomerAt: moment,
      now: moment,
      hotHours: z.number().int().min(1).max(720),
    })
    .strict()
    .parse(input);
  const elapsed = Date.parse(value.now) - Date.parse(value.lastCustomerAt);
  return (
    value.kind === "sales" &&
    value.stage !== "won" &&
    value.stage !== "lost" &&
    value.intent !== null &&
    value.hotIntents.includes(value.intent) &&
    elapsed >= 0 &&
    elapsed < value.hotHours * 3600000
  );
}
