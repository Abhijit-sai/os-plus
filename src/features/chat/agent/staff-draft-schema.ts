import { z } from "zod";
const providerId = z.number().int().positive().safe();
export const staffDraftInputSchema = z
  .object({
    draftId: z.string().uuid(),
    accountId: providerId,
    conversationId: providerId,
    noteId: providerId,
    staffId: providerId,
    content: z
      .string()
      .trim()
      .min(1)
      .max(6000)
      .refine(
        (value) =>
          !/[{}<>\p{Cf}]|\b(?:tenant_id|correlation_id|api[_ -]?key|access[_ -]?token|understanding_json|decision_json)\b|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/iu.test(
            value,
          ),
      ),
    providerMessageId: providerId.optional(),
  })
  .strict();
export const staffDraftRequestSchema = z
  .object({
    type: z.literal("osplus-draft-request"),
    requestId: z.string().uuid(),
    action: z.enum(["claim", "record"]),
    input: staffDraftInputSchema,
  })
  .strict();
