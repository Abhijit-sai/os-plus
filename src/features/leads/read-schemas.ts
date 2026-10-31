import { z } from "zod";
import { leadStageSchema } from "./rules.ts";
const optionalId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);
const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().max(100).optional(),
);
export const leadFiltersSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(20000).default(1),
    brandId: optionalId,
    locationId: optionalId,
    channelId: optionalId,
    ownerId: optionalId,
    contactId: optionalId,
    stage: z.preprocess(
      (value) => (value === "" ? undefined : value),
      leadStageSchema.optional(),
    ),
    state: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z
        .enum(["waiting", "hot", "unassigned", "handoff", "needs_look"])
        .optional(),
    ),
    q: optionalText,
  })
  .strict();
export const crmPermissionsSchema = z
  .object({ pii: z.boolean(), manage: z.boolean(), reports: z.boolean() })
  .strict();
const count = z.number().int().nonnegative().safe();
export const leadPageReadSchema = z.object({
  items: z.array(z.unknown()).max(50),
  total: count,
  counters: z
    .object({
      open: count,
      awaitingFirstReply: count,
      waiting: count,
      hot: count,
      unassigned: count,
      handoff: count,
    })
    .strict(),
  pipeline: z.array(
    z
      .object({
        currency: z.string().regex(/^[A-Z]{3}$/),
        amount: z.coerce.number().finite().nonnegative(),
        known: count,
      })
      .strict(),
  ),
  permissions: crmPermissionsSchema,
  page: z.number().int().positive(),
  asOf: z.string().datetime({ offset: true }),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export const contactFiltersSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(20000).default(1),
    q: optionalText,
    segment: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(["linked", "unlinked", "merged"]).optional(),
    ),
  })
  .strict();
export const contactPageReadSchema = z.object({
  items: z.array(z.unknown()).max(50),
  total: count,
  linked: count,
  page: z.number().int().positive(),
  permissions: crmPermissionsSchema,
  asOf: z.string().datetime({ offset: true }),
});
