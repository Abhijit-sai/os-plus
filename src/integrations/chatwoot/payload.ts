import { z } from "zod";

const id = z.number().int().positive().safe();
const sender = z.object({
  id,
  type: z.string().max(40).optional(),
  name: z.string().trim().max(200).nullish(),
  phone_number: z.string().trim().max(40).nullish(),
  email: z.string().trim().max(320).nullish(),
});
const timestamp = z.union([
  z
    .number()
    .finite()
    .nonnegative()
    .max(253402300799)
    .transform((value) => new Date(value * 1000).toISOString()),
  z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString()),
]);
const messageType = z
  .union([
    z.enum(["incoming", "outgoing", "activity", "template"]),
    z.number().int().min(0).max(3),
  ])
  .transform((value) =>
    typeof value === "number"
      ? ["incoming", "outgoing", "activity", "template"][value]
      : value,
  );
const schema = z.object({
  event: z.literal("message_created"),
  id,
  account: z.object({ id }),
  inbox: z.object({ id }),
  conversation: z.object({
    id,
    account_id: id.optional(),
    inbox_id: id,
    status: z.enum(["open", "resolved", "pending", "snoozed"]),
    channel: z.string().max(80).optional(),
    additional_attributes: z
      .object({ type: z.string().max(80).optional() })
      .nullish(),
    contact_inbox: z
      .object({
        contact_id: id,
        inbox_id: id,
        source_id: z.string().min(1).max(512),
      })
      .optional(),
    meta: z.object({ sender }).optional(),
  }),
  message_type: messageType,
  private: z.boolean(),
  content: z.string().max(150000).nullable(),
  content_type: z.string().min(1).max(80),
  created_at: timestamp,
  sender: sender.nullish(),
  content_attributes: z.unknown().optional(),
  attachments: z
    .array(
      z.object({
        id,
        file_type: z.string().max(80),
        data_url: z.string().url().max(4096).optional(),
      }),
    )
    .max(15)
    .default([]),
});
const kinds = {
  "Channel::Whatsapp": "whatsapp",
  "Channel::Instagram": "instagram",
  "Channel::FacebookPage": "facebook",
  "Channel::WebWidget": "website",
} as const;

/** Project bounded provider facts; resolve business identity only after workspace authorization. */
export function parseChatwootMessage(input: unknown) {
  const data = schema.parse(input);
  if (
    (data.conversation.account_id !== undefined &&
      data.conversation.account_id !== data.account.id) ||
    data.conversation.inbox_id !== data.inbox.id
  )
    throw new Error("Invalid chat event.");
  const type = data.message_type;
  const senderType = data.sender?.type?.toLowerCase();
  // Automatic greetings/templates have no human sender. Timing alone would misclassify a fast staff reply.
  const author =
    type === "activity"
      ? "system"
      : type === "incoming"
        ? "customer"
        : senderType === "agent_bot"
          ? "bot"
          : senderType === "user"
            ? "staff"
            : "system";
  const contactId =
    data.conversation.meta?.sender.id ??
    (author === "customer" ? data.sender?.id : undefined);
  if (
    !contactId ||
    (author === "customer" && data.sender && data.sender.id !== contactId)
  )
    throw new Error("Invalid chat event.");
  const ci = data.conversation.contact_inbox;
  if (ci && (ci.contact_id !== contactId || ci.inbox_id !== data.inbox.id))
    throw new Error("Invalid chat event.");
  const profile =
    author === "customer"
      ? (data.sender ?? data.conversation.meta?.sender)
      : data.conversation.meta?.sender;
  const identity = {
    displayName: profile?.name || null,
    phone: profile?.phone_number || null,
    email: profile?.email || null,
    sourceId: ci?.source_id || null,
  };
  const channelKind =
    data.conversation.additional_attributes?.type === "instagram_direct_message"
      ? "instagram"
      : kinds[data.conversation.channel as keyof typeof kinds];
  const source = z
    .object({
      osplus_source_draft_id: z.string().uuid(),
      osplus_source_note_id: id,
    })
    .safeParse(data.content_attributes);
  const sourceDraft =
    author === "staff" && !data.private && source.success
      ? {
          draftId: source.data.osplus_source_draft_id,
          noteId: source.data.osplus_source_note_id,
        }
      : null;
  return {
    ...(sourceDraft ? { sourceDraft } : {}),
    messageId: data.id,
    accountId: data.account.id,
    inboxId: data.inbox.id,
    conversationId: data.conversation.id,
    contactId,
    status: data.conversation.status,
    channelKind: channelKind ?? null,
    author,
    private: data.private,
    content: data.content,
    contentType: data.content_type,
    createdAt: data.created_at,
    staffUserId: author === "staff" ? data.sender!.id : null,
    attachments: data.attachments,
    identity,
  };
}
export type ChatwootMessage = ReturnType<typeof parseChatwootMessage>;
