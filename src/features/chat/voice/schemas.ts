import { z } from "zod";
import { voiceLimitsSchema } from "./rules.ts";
import { positiveProviderId as id } from "./http.ts";
export const voiceSettingsSchema = voiceLimitsSchema
  .extend({ enabled: z.boolean(), version: z.number().int().positive() })
  .strict();
export const voiceTargetSchema = voiceLimitsSchema
  .extend({
    status: z.string().min(1).max(40),
    jobId: z.string().uuid(),
    accountId: id,
    conversationId: id,
    providerMessageId: id,
    attachmentId: id,
    languages: z.array(z.string().min(2).max(40)).min(1).max(100),
    text: z.string().min(1).max(6000).optional(),
  })
  .strict();
export const voiceStatusSchema = z
  .object({ status: z.string().min(1).max(40) })
  .passthrough();
