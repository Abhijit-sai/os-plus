import { z } from "zod";
import { summaryScheduleSchema } from "./rules.ts";
import { notificationEventSchema } from "./summary.ts";
const id = z.string().uuid(),
  version = z.number().int().positive().safe(),
  label = z.string().trim().min(1).max(80);
export const notificationCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      input: z.object({ id, label }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("issue"),
      input: z.object({ id, version }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("save"),
      input: z
        .object({
          id,
          version,
          label,
          events: z.array(notificationEventSchema).max(6),
          brandIds: z.array(id).max(100),
          active: z.boolean(),
          confirm: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("settings"),
      input: summaryScheduleSchema
        .extend({ version, enabled: z.boolean() })
        .strict(),
    })
    .strict(),
]);
const timestamp = z.string().datetime({ offset: true });
export const notificationReadSchema = z
  .object({
    settings: z
      .object({
        version,
        enabled: z.boolean(),
        timezone: z.string().min(1).max(100),
        localTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
      })
      .strict(),
    targets: z
      .array(
        z
          .object({
            id,
            version,
            label,
            active: z.boolean(),
            events: z.array(notificationEventSchema),
            brandIds: z.array(id),
            linked: z.boolean(),
            confirmed: z.boolean(),
            kind: z.enum(["private", "group", "supergroup"]).nullable(),
            hint: z
              .string()
              .regex(/^[0-9]{1,4}$/)
              .nullable(),
            expiresAt: timestamp.nullable(),
          })
          .strict(),
      )
      .max(1000),
    deliveries: z
      .array(
        z
          .object({
            id,
            target: z.string().max(80),
            kind: notificationEventSchema,
            status: z.enum([
              "queued",
              "sending",
              "sent",
              "uncertain",
              "cancelled",
            ]),
            at: timestamp,
            sentAt: timestamp.nullable(),
          })
          .strict(),
      )
      .max(20),
    brands: z
      .array(z.object({ id, name: z.string().max(200) }).strict())
      .max(1000),
  })
  .strict();
export const notificationReceiptSchema = z.object({ id, version }).strict();
export const previewInputSchema = z
  .object({
    windowStart: timestamp,
    windowEnd: timestamp,
    brandIds: z.array(id).max(100),
  })
  .strict()
  .refine(
    (v) =>
      Date.parse(v.windowStart) < Date.parse(v.windowEnd) &&
      Date.parse(v.windowEnd) - Date.parse(v.windowStart) <= 31 * 86400000,
    "Choose a reporting window of up to 31 days.",
  );
export type NotificationSettings = z.infer<typeof notificationReadSchema> & {
  deliveryEnabled: boolean;
  tenantId: string;
  previewEnd: string;
};
