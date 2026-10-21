import { z } from "zod";
import { normalizeCustomerPhone } from "../customers/phone.ts";
import { leadKindSchema, leadStageSchema } from "./rules.ts";

const id = z.string().uuid(),
  version = z.number().int().positive().safe();
const edit = z
  .object({
    leadId: id,
    version,
    stage: leadStageSchema.optional(),
    lostReason: z.string().trim().min(1).max(1000).optional(),
    ownerId: id.nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
    kind: leadKindSchema.optional(),
    intent: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/)
      .optional(),
  })
  .strict()
  .refine(
    (value) => value.stage !== "lost" || !!value.lostReason,
    "Explain why this lead was lost.",
  )
  .refine(
    (value) =>
      ["stage", "ownerId", "notes", "kind", "intent"].some(
        (key) => key in value,
      ),
    "Choose a change.",
  );
const record = z
  .object({
    leadId: id,
    version,
    orderId: id.nullable().optional(),
    bookingType: z
      .enum(["laundry_pickup_request", "task"])
      .nullable()
      .optional(),
    bookingId: id.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.bookingType) === Boolean(value.bookingId),
    "Choose a complete booking reference.",
  )
  .refine(
    (value) => "orderId" in value || "bookingType" in value,
    "Choose a record.",
  );
export const leadCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("contact.convert"),
      input: z
        .object({
          contactId: id,
          name: z.string().trim().min(2).max(200),
          phone: z.string().trim().max(40).nullable().optional(),
          email: z.string().trim().email().max(320).nullable().optional(),
          countryCode: z
            .string()
            .regex(/^[A-Z]{2}$/)
            .optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("contact.link"),
      input: z.object({ contactId: id, customerId: id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("contact.merge"),
      input: z
        .object({
          fromId: id,
          toId: id,
          fromVersion: version,
          toVersion: version,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("contact.split"),
      input: z.object({ mergeId: id }).strict(),
    })
    .strict(),
  z.object({ action: z.literal("lead.edit"), input: edit }).strict(),
  z.object({ action: z.literal("lead.record"), input: record }).strict(),
]);
export function prepareLeadCommand(input: unknown) {
  const request = leadCommandSchema.parse(input);
  if (request.action !== "contact.convert") return request;
  const { countryCode, phone, ...value } = request.input;
  const normalized = phone ? normalizeCustomerPhone(phone, countryCode) : null;
  if (phone && !normalized)
    throw new Error("Enter a valid phone number with its country code.");
  return {
    action: request.action,
    input: {
      ...value,
      phone: normalized?.displayPhone ?? null,
      phoneE164: normalized?.e164 ?? null,
    },
  };
}
export const refreshInputSchema = z
  .object({ leadId: id.optional(), afterId: id.optional() })
  .strict()
  .refine(
    (value) => !value.leadId || !value.afterId,
    "Choose a lead or a batch cursor.",
  );
export const refreshResultSchema = z
  .object({
    scanned: z.number().int().min(0).max(100),
    updated: z.number().int().min(0).max(100),
    nextAfterId: id.nullable(),
  })
  .strict();
