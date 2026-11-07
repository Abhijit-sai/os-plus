import "server-only";
import { z } from "zod";
import { customerTextSchema } from "../../features/chat/actions/customer-text.ts";
const id = z.number().int().positive().safe();
const schema = z
  .object({
    accountId: id,
    conversationId: id,
    outboxId: z.string().uuid(),
    text: customerTextSchema,
  })
  .strict();
/** A persisted outbox claim must precede this one attempt. */
export class ChatwootPublicClient {
  private origin: string;
  private token: string;
  private liveAccountId: number | undefined;
  constructor(options: {
    origin: string;
    token: string;
    allowLocalMock?: boolean;
    liveAccountId?: number;
  }) {
    const url = new URL(options.origin);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (!local && options.liveAccountId === undefined) ||
      (!["https:"].includes(url.protocol) &&
        !(
          options.liveAccountId === undefined &&
          options.allowLocalMock === true &&
          url.hostname === "127.0.0.1" &&
          url.protocol === "http:"
        )) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error("Public transport unavailable.");
    this.origin = url.origin;
    this.token = z.string().min(1).max(8192).parse(options.token);
    this.liveAccountId = id.optional().parse(options.liveAccountId);
  }
  async post(raw: unknown): Promise<{ id: number }> {
    const input = schema.parse(raw);
    const allowed = this.liveAccountId === undefined
      ? process.env.CHAT_ACTIONS_ENABLED === "true" &&
        process.env.CHAT_PUBLIC_REPLY_ENABLED === "true" &&
        process.env.CHAT_AGENT_MODEL_MODE === "mock"
      : this.liveAccountId === input.accountId &&
        process.env.CHAT_AGENT_ENABLED === "true" &&
        process.env.CHAT_DRAFT_DELIVERY_ENABLED === "true" &&
        process.env.CHAT_AGENT_MODEL_MODE === "live-scoped";
    if (!allowed || process.env.CHAT_DRY_RUN !== "false")
      throw new Error("Public delivery disabled.");
    try {
      const response = await fetch(
        this.origin +
          "/api/v1/accounts/" +
          input.accountId +
          "/conversations/" +
          input.conversationId +
          "/messages",
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
          headers: {
            "api-access-token": this.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: input.text,
            message_type: "outgoing",
            private: false,
            content_attributes: {
              osplus_public_outbox_id: input.outboxId,
              osplus_engine: "osplus-v1",
            },
          }),
        },
      );
      if (!response.body) throw new Error("Missing receipt");
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const item = await reader.read();
          if (item.done) break;
          size += item.value.byteLength;
          if (size > 131072) throw new Error("Receipt too large");
          chunks.push(item.value);
        }
      } finally {
        await reader.cancel();
      }
      if (!response.ok) throw new Error("No public receipt");
      const receipt = z
        .object({
          id,
          conversation_id: z.literal(input.conversationId),
          private: z.literal(false),
          content: z.literal(input.text),
          content_attributes: z
            .object({ osplus_public_outbox_id: z.literal(input.outboxId) })
            .passthrough(),
        })
        .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      return { id: receipt.id };
    } catch {
      throw new Error(
        "Public delivery unconfirmed. Do not resend automatically.",
      );
    }
  }
}
