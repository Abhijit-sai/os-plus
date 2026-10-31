import { z } from "zod";
const text = z.string().max(2000).nullable();
const uuid = z.string().uuid();
export const backgroundSchema = z
  .object({
    tenantId: uuid,
    contactId: uuid,
    displayName: text,
    preferredLanguage: z.string().max(40).nullable(),
    customer: z
      .object({
        tenantId: uuid,
        id: uuid,
        verified: z.literal(true),
        name: text,
        addresses: z
          .array(
            z
              .object({ label: text, line: text, area: text, city: text })
              .strict(),
          )
          .max(5),
        orders: z
          .array(
            z
              .object({ status: z.string().max(80), at: z.string().max(40) })
              .strict(),
          )
          .max(20),
        openTasks: z.number().int().nonnegative().safe(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .nullable()
  .default(null);
export const locationsSchema = z
  .array(
    z
      .object({
        tenantId: uuid,
        brandId: uuid,
        code: z.string().min(1).max(100),
        name: z.string().max(200),
        address: text,
        mapUrl: z
          .string()
          .url()
          .max(2048)
          .nullable()
          .refine((value) => {
            if (!value) return true;
            const url = new URL(value);
            return url.protocol === "https:" && !url.username && !url.password;
          }),
        lat: z.number().min(-90).max(90).nullable(),
        lng: z.number().min(-180).max(180).nullable(),
        primary: z.boolean(),
        default: z.boolean(),
      })
      .strict(),
  )
  .max(100)
  .default([]);
