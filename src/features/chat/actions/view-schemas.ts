import { z } from "zod";
import { capabilitySchema } from "./rules.ts";
import {
  requestDetailsSchema,
  requestStatusSchema,
  handoffReasonSchema,
} from "./schemas.ts";
const id = z.string().uuid(),
  number = z.number().int().nonnegative().safe(),
  version = number.positive(),
  time = z.string().datetime({ offset: true });
export const workflowSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("review"),
      input: z.object({ id, version }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("confirm"),
      input: z.object({ id, version, messageId: id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      input: z
        .object({
          id,
          version,
          countryCode: z
            .string()
            .regex(/^[A-Z]{2}$/)
            .nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("change"),
      input: z.object({ id, version, messageId: id }).strict(),
    })
    .strict(),
]);
export const workflowReceiptSchema = z
  .object({
    id,
    version,
    status: requestStatusSchema,
    taskId: id.nullable(),
    pickupId: id.nullable(),
    reviewText: z.string().max(6000).nullable(),
  })
  .strict();
export const actionViewSchema = z
  .object({
    deliveries: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["price_image", "review"]),
            state: z.enum(["draft", "sending", "sent", "uncertain"]),
            text: z.string().max(6000),
            assetUrl: z.string().url().max(2048).nullable(),
            sentAt: time.nullable(),
            eligible: z.boolean(),
          })
          .strict(),
      )
      .max(50)
      .default([]),
    requests: z
      .array(
        z
          .object({
            id,
            leadId: id,
            capability: capabilitySchema,
            status: requestStatusSchema,
            details: requestDetailsSchema,
            version,
            revision: version,
            confirmedRevision: version.nullable(),
            sourceMessageId: id,
            evidence: z.string().max(2000),
            taskId: id.nullable(),
            pickupId: id.nullable(),
            createdAt: time,
            updatedAt: time,
            reviewText: z.string().max(6000).nullable(),
          })
          .strict(),
      )
      .max(50),
    tasks: z
      .array(
        z
          .object({
            id,
            taskId: id,
            version,
            kind: z.enum(["CHAT_HANDOFF", "LEAD_FOLLOW_UP"]),
            route: z.enum(["chatwoot", "lead", "team", "unassigned"]),
            status: z.enum([
              "OPEN",
              "ASSIGNED",
              "IN_PROGRESS",
              "BLOCKED",
              "COMPLETED",
              "CANCELLED",
            ]),
            assignedUserId: id.nullable(),
            assignedTeamId: id.nullable(),
            closedAt: time.nullable(),
            reasonCount: number,
            reasons: z
              .array(
                z
                  .object({ reason: handoffReasonSchema, messageId: id })
                  .strict(),
              )
              .max(50),
          })
          .strict(),
      )
      .max(50),
    messages: z
      .array(
        z
          .object({
            id,
            content: z.string().max(150000).nullable(),
            created_at: time,
          })
          .strict(),
      )
      .max(50),
    totalRequests: number,
    totalTasks: number,
  })
  .strict();
export type ActionView = z.infer<typeof actionViewSchema>;
