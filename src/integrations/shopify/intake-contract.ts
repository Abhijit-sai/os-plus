import { z } from "zod";

export const shopifyOrderTopics = ["orders/create", "orders/updated", "orders/cancelled"] as const;
export const shopifyOrderGid = z.string().regex(/^gid:\/\/shopify\/Order\/[1-9][0-9]{0,31}$/);
export const shopifyIntakeConnectionSchema = z.object({
  id: z.string().uuid(), tenant_id: z.string().uuid(),
  shop_gid: z.string().regex(/^gid:\/\/shopify\/Shop\/[1-9][0-9]{0,31}$/),
  canonical_domain: z.string(), app_ref: z.string(), environment: z.literal("production"),
  api_version: z.literal("2026-10"), status: z.enum(["verified", "paused"]),
  intake_enabled: z.literal(true), verified_at: z.string().datetime({ offset: true }),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type ShopifyIntakeConnection = z.infer<typeof shopifyIntakeConnectionSchema>;

// An ID-only envelope: never persist the full webhook/customer payload.
export const shopifyIntakeEnvelopeSchema = z.object({
  topic: z.enum(shopifyOrderTopics), deliveryId: z.string().uuid(),
  eventId: z.string().uuid().nullable(), triggeredAt: z.string().datetime({ offset: true }).nullable(),
  apiVersion: z.literal("2026-10"), bodySha256: z.string().regex(/^[0-9a-f]{64}$/),
  orderGid: shopifyOrderGid,
}).strict();
export type ShopifyIntakeEnvelope = z.infer<typeof shopifyIntakeEnvelopeSchema>;
export const shopifyIntakeResultSchema = z.object({
  status: z.enum(["accepted", "duplicate", "conflict", "ignored"]), receiptId: z.string().uuid(),
}).strict();
export type ShopifyIntakeResult = z.infer<typeof shopifyIntakeResultSchema>;
