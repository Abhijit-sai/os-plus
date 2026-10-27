import { z } from "zod";
import { capabilitySchema } from "./rules.ts";
const id = z.string().uuid(),
  version = z.number().int().positive().safe();
const text = z.string().trim().min(1).max(2000).nullable();
const service = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
export const requestDetailsSchema = z
  .object({
    name: text,
    services: z
      .array(service)
      .max(100)
      .refine(
        (values) => new Set(values).size === values.length,
        "Choose each service once.",
      ),
    area: text,
    address: text,
    date: text,
    window: text,
    timePreference: text,
  })
  .strict();
export const requestStatusSchema = z.enum([
  "requested",
  "customer_confirmed",
  "materialized",
  "withdrawn",
]);
const evidence = {
  sourceMessageId: id,
  evidence: z.string().trim().min(1).max(2000),
};
export const chatRequestCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request.save"),
      input: z
        .object({
          leadId: id,
          capability: capabilitySchema,
          ...evidence,
          details: requestDetailsSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request.revise"),
      input: z
        .object({ id, version, ...evidence, details: requestDetailsSchema })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request.withdraw"),
      input: z.object({ id, version }).strict(),
    })
    .strict(),
]);
export const handoffReasonSchema = z.enum([
  "complaint",
  "payment_claim",
  "dues",
  "unreadable",
  "operational_change",
  "staff_requested",
]);
export const chatTaskCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("handoff"),
      input: z
        .object({ leadId: id, messageId: id, reason: handoffReasonSchema })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("assign"),
      input: z
        .object({ id, version, userId: id.nullable(), teamId: id.nullable() })
        .strict()
        .refine(
          (value) => (value.userId === null) !== (value.teamId === null),
          "Choose one team or team member.",
        ),
    })
    .strict(),
  z
    .object({
      action: z.literal("complete"),
      input: z.object({ id, version }).strict(),
    })
    .strict(),
]);
export const requestReceiptSchema = z
  .object({ id, version, status: requestStatusSchema, duplicate: z.boolean() })
  .strict();
export const taskReceiptSchema = z
  .object({
    id,
    taskId: id,
    version,
    route: z.enum(["chatwoot", "lead", "team", "unassigned"]),
  })
  .strict();
export type RequestDetails = z.infer<typeof requestDetailsSchema>;
