import { z } from "zod";
import { sessionPolicySchema } from "./agent/session.ts";
import { reportingScheduleSchema } from "../leads/reporting-hours.ts";

const text = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => !/\{\{|\}\}|\$\{/.test(value),
    "Replace template placeholders before saving.",
  );
const key = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const url = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  }, "Use an HTTPS link without embedded credentials.");
const strings = z.array(text).max(100);
const service = z
  .object({
    key,
    name: text,
    aliases: strings,
    turnaround: z
      .object({
        min: z.number().finite().nonnegative(),
        max: z.number().finite().nonnegative(),
        unit: z.enum(["hours", "days"]),
      })
      .strict()
      .refine(
        (value) => value.max >= value.min,
        "Maximum must be at least minimum.",
      )
      .optional(),
  })
  .strict();

export const knowledgePackSchema = z
  .object({
    schemaVersion: z.literal(1),
    agent: z
      .object({
        session: sessionPolicySchema.optional(),
        indicativeLabel: text.optional(),
      })
      .strict()
      .optional(),
    crm: z
      .object({
        reportingSchedule: reportingScheduleSchema.optional(),
        intentPriorities: z.record(key, z.number().int().min(0).max(10000)),
        hotIntents: z.array(key).max(100).optional(),
        typicalBasket: z
          .object({
            amount: z.number().finite().nonnegative().max(1_000_000_000),
            currency: z.string().regex(/^[A-Z]{3}$/),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict()
      .optional(),
    brand: z
      .object({
        displayName: text,
        personaName: text,
        oneLiner: text,
        languages: z
          .array(z.string().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/))
          .min(1)
          .max(20),
        latinScriptOnly: z.boolean(),
        localAcknowledgements: strings,
      })
      .strict(),
    hours: z
      .object({
        default: text,
        byDay: z
          .object({
            mon: text.optional(),
            tue: text.optional(),
            wed: text.optional(),
            thu: text.optional(),
            fri: text.optional(),
            sat: text.optional(),
            sun: text.optional(),
          })
          .strict()
          .optional(),
        onlyWhenAsked: strings.optional(),
      })
      .strict(),
    services: z.array(service).min(1).max(100),
    prices: z
      .array(
        z
          .object({
            serviceKey: key,
            label: text,
            amount: z.number().finite().nonnegative().max(1_000_000_000),
            unit: text,
          })
          .strict(),
      )
      .max(500),
    priceListImageUrl: url.optional(),
    media: z.object({ priceListCaption: text }).strict().optional(),
    booking: z
      .object({
        capability: z.enum(["laundry_pickup", "follow_up_task"]),
        windows: z
          .array(z.object({ key, label: text }).strict())
          .max(50)
          .optional(),
        minimumOrder: text.nullable().optional(),
        express: z.boolean().optional(),
        prompts: z
          .object({
            services: text,
            name: text,
            address: text,
            date: text,
            window: text,
            awaitingStaff: text,
            whatsappHandoff: text,
            location: text,
          })
          .strict()
          .optional(),
        confirmation: z
          .object({
            intro: text,
            labels: z
              .object({
                name: text,
                services: text,
                address: text,
                date: text,
                window: text,
                timePreference: text,
              })
              .strict(),
            phrases: z
              .array(
                text.refine(
                  (value) => value.length <= 80,
                  "Use a short exact phrase.",
                ),
              )
              .min(1)
              .max(50)
              .refine(
                (values) =>
                  new Set(values.map((value) => value.toLowerCase())).size ===
                  values.length,
                "Confirmation phrases must be unique.",
              ),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    areas: z
      .array(
        z
          .object({ locationCode: text, served: strings, postalCodes: strings })
          .strict(),
      )
      .max(100),
    policies: z
      .array(z.object({ topic: text, answer: text }).strict())
      .max(100),
    handoffTopics: strings,
    locked: z
      .object({
        paymentClaimReply: text,
        paymentClaimAgain: text,
        identityReply: text,
        vendorReply: text,
        unreadableHandoff: text,
        handoffLine: text,
        turnaroundCaution: text,
      })
      .strict(),
    review: z
      .object({
        enabled: z.boolean().default(false),
        text: text.optional(),
        url,
        cooldownDays: z.number().int().min(1).max(3650),
      })
      .strict()
      .optional(),
    style: z
      .object({
        maxQuestionsPerTurn: z.literal(1),
        endInformationalWithNextStep: z.literal(true),
        noFiller: z.literal(true),
        pushy: z.literal(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((pack, ctx) => {
    if (
      pack.crm?.hotIntents?.some(
        (intent) => pack.crm?.intentPriorities[intent] === undefined,
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["crm", "hotIntents"],
        message: "Declare each high-interest intent in intent priorities.",
      });
    const unique = (values: string[], path: string) => {
      if (
        new Set(values.map((value) => value.toLowerCase())).size !==
        values.length
      ) {
        ctx.addIssue({
          code: "custom",
          path: [path],
          message: "Keys must be unique.",
        });
      }
    };
    unique(
      pack.services.map((value) => value.key),
      "services",
    );
    unique(
      pack.areas.map((value) => value.locationCode),
      "areas",
    );
    unique(pack.brand.languages, "brand");
    unique(pack.booking?.windows?.map((value) => value.key) ?? [], "booking");
    const serviceKeys = new Set(pack.services.map((value) => value.key));
    pack.prices.forEach((price, index) => {
      if (!serviceKeys.has(price.serviceKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["prices", index, "serviceKey"],
          message: "Select a declared service.",
        });
      }
    });
  });

export type KnowledgePack = z.infer<typeof knowledgePackSchema>;

/** Validation is shared by saves and reads; publishing adds tenant-owned branch checks. */
export function parseKnowledgePack(input: unknown): KnowledgePack {
  return knowledgePackSchema.parse(input);
}

/** The caller resolves this context from the selected tenant and brand, never from form data. */
export function validateKnowledgePublication(
  input: unknown,
  context: {
    locationCodes: readonly string[];
    capabilities: readonly ("laundry_pickup" | "follow_up_task")[];
  },
): KnowledgePack {
  const pack = parseKnowledgePack(input);
  const codes = new Set(
    context.locationCodes.map((code) => code.toLowerCase()),
  );
  if (pack.areas.some((area) => !codes.has(area.locationCode.toLowerCase()))) {
    throw new Error("Select an active branch mapped to this brand.");
  }
  if (pack.booking && !context.capabilities.includes(pack.booking.capability)) {
    throw new Error("This booking capability is not enabled.");
  }
  return pack;
}
