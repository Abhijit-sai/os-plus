import { z } from "zod";
const providerId = z.number().int().positive().safe();
export const panelLookupSchema = z
  .object({
    accountId: providerId,
    inboxId: providerId,
    conversationId: providerId,
  })
  .strict();
const envelope = z.object({
  event: z.literal("appContext"),
  data: z.object({
    conversation: z.object({
      id: providerId,
      inbox_id: providerId,
      account_id: providerId.optional(),
    }),
  }),
});
/** Pinned Chatwoot4.18 Frame.vue sends a JSON-string appContext. Its other fields are untrusted and unused. */
export function parsePanelContext(
  raw: unknown,
  origin: string,
  expected: { origin: string; accountId: number },
  fromParent: boolean,
) {
  if (
    !fromParent ||
    origin !== expected.origin ||
    typeof raw !== "string" ||
    raw.length > 262144
  )
    return null;
  try {
    const { conversation } = envelope.parse(JSON.parse(raw)).data;
    if (
      conversation.account_id !== undefined &&
      conversation.account_id !== expected.accountId
    )
      return null;
    return panelLookupSchema.parse({
      accountId: expected.accountId,
      inboxId: conversation.inbox_id,
      conversationId: conversation.id,
    });
  } catch {
    return null;
  }
}
