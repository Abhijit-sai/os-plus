import { z } from "zod";
import {
  leadKindSchema,
  leadStageSchema,
  leadClocks,
  isHotLead,
} from "./rules.ts";
const id = z.string().uuid(),
  time = z.string().datetime({ offset: true }),
  text = z.string().max(150000).nullable();
export const leadReadSchema = z.object({
  display_name: z.string().max(200).nullable().optional(),
  hot: z.boolean().optional(),
  id,
  ref_code: z.string().regex(/^[2-9A-HJKMNP-Z]{5}$/),
  brand_id: id,
  location_id: id.nullable(),
  channel_id: id,
  contact_id: id,
  customer_id: id.nullable(),
  owner_tenant_user_id: id.nullable(),
  conversation_id: id,
  channel_kind: z.enum(["website", "whatsapp", "instagram", "facebook"]),
  kind: leadKindSchema,
  stage: leadStageSchema,
  intent: z.string().max(64).nullable(),
  services: z.array(z.string()).max(100),
  area: text,
  gist: text,
  lost_reason: text.optional(),
  notes: text,
  handoff: z.boolean(),
  est_value: z.coerce.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  first_customer_at: time,
  last_customer_at: time,
  first_response_at: time.nullable(),
  first_human_response_at: time.nullable(),
  last_reply_at: time.nullable(),
  closed_at: time.nullable(),
  version: z.number().int().positive(),
});
/** Whitelist at the server boundary. Free text cannot be reliably anonymised with regex:
 * hiding a phone label while sending messages/notes still leaks the same person's identity. */
export function projectLead(
  input: unknown,
  policy: {
    pii: boolean;
    now: string;
    hotHours?: number;
    hotIntents?: string[];
  },
) {
  const row = leadReadSchema.parse(input);
  const clocks = leadClocks({
    stage: row.stage,
    firstCustomerAt: row.first_customer_at,
    lastCustomerAt: row.last_customer_at,
    firstResponseAt: row.first_response_at,
    firstHumanResponseAt: row.first_human_response_at,
    lastReplyAt: row.last_reply_at,
    now: policy.now,
  });
  return {
    id: row.id,
    reference: row.ref_code,
    brandId: row.brand_id,
    locationId: row.location_id,
    channelId: row.channel_id,
    contactId: row.contact_id,
    ownerId: row.owner_tenant_user_id,
    channel: row.channel_kind,
    kind: row.kind,
    stage: row.stage,
    intent: row.intent,
    handoff: row.handoff,
    estimatedValue: row.est_value,
    currency: row.currency,
    firstCustomerAt: row.first_customer_at,
    lastCustomerAt: row.last_customer_at,
    closedAt: row.closed_at,
    version: row.version,
    ...clocks,
    hot:
      row.hot ??
      (policy.hotHours && policy.hotIntents
        ? isHotLead({
            stage: row.stage,
            kind: row.kind,
            intent: row.intent,
            lastCustomerAt: row.last_customer_at,
            now: policy.now,
            hotHours: policy.hotHours,
            hotIntents: policy.hotIntents,
          })
        : false),
    name: policy.pii ? row.display_name || "Unnamed contact" : "Contact hidden",
    ...(policy.pii
      ? {
          customerId: row.customer_id,
          lostReason: row.lost_reason ?? null,
          notes: row.notes,
          gist: row.gist,
          area: row.area,
          services: row.services,
        }
      : {}),
  };
}
export type LeadView = ReturnType<typeof projectLead>;

const contactReadSchema = z.object({
  linked: z.boolean().optional(),
  merged: z.boolean().optional(),
  id,
  display_name: z.string().max(200).nullable(),
  customer_id: id.nullable(),
  merged_into: id.nullable(),
  first_seen_at: time,
  last_seen_at: time,
  notes: text,
  version: z.number().int().positive(),
});
const identityReadSchema = z.object({
  kind: z.enum([
    "phone",
    "chatwoot_contact",
    "instagram",
    "facebook",
    "web_visitor",
  ]),
  value: z.string().max(600),
  verified: z.boolean(),
});
export function projectContact(
  input: unknown,
  identities: unknown,
  pii: boolean,
) {
  const row = contactReadSchema.parse(input);
  return {
    id: row.id,
    name: pii ? row.display_name || "Unnamed contact" : "Contact hidden",
    linked: row.linked ?? row.customer_id !== null,
    merged: row.merged ?? row.merged_into !== null,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    version: row.version,
    identities: pii ? z.array(identityReadSchema).parse(identities) : [],
    ...(pii
      ? {
          customerId: row.customer_id,
          mergedInto: row.merged_into,
          notes: row.notes,
        }
      : {}),
  };
}
export function projectMessage(input: unknown, pii: boolean) {
  const row = z
    .object({
      id,
      author: z.enum(["customer", "staff", "bot", "system"]),
      private: z.boolean(),
      content: text,
      transcript: z.string().max(6000).nullable().optional(),
      created_at: time,
    })
    .parse(input);
  // Staff notes and transport/system errors are not a public conversation mirror.
  if (row.private || row.author === "system") return null;
  return {
    id: row.id,
    author: row.author,
    at: row.created_at,
    content: pii ? row.content : null,
    ...(pii && row.transcript ? { transcript: row.transcript } : {}),
  };
}
export function projectHistory(input: unknown) {
  const row = z
    .object({
      id,
      kind: z.string().max(100),
      at: time,
      actor_type: z.enum(["USER", "SYSTEM", "AGENT", "WEBHOOK"]),
    })
    .parse(input);
  return { id: row.id, kind: row.kind, at: row.at, actor: row.actor_type };
}
