import "server-only";
import { z } from "zod";
const requestSchema = z
  .object({
    accountId: z.number().int().positive().safe(),
    conversationId: z.number().int().positive().safe(),
    draftId: z.string().uuid(),
    triggerProviderId: z.number().int().positive().safe().optional(),
    knowledgeVersion: z.number().int().positive().optional(),
    text: z.string().trim().min(1).max(6000),
  })
  .strict();
export const draftMarker = "💬 Suggested reply";
export class ChatwootMessageClient {
  private origin: string;
  private token: string;
  private mock: boolean;
  constructor(options: {
    origin: string;
    token: string;
    allowLocalMock?: boolean;
  }) {
    const origin = new URL(options.origin);
    this.mock =
      options.allowLocalMock === true &&
      origin.protocol === "http:" &&
      origin.hostname === "127.0.0.1";
    if (
      (!this.mock && origin.protocol !== "https:") ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new Error("Draft transport unavailable.");
    this.origin = origin.origin;
    this.token = z.string().min(1).max(8192).parse(options.token);
  }
  /** Pinned4.18 Messages::MessageBuilder persists private/content_attributes; no public-message method exists here. */
  async postPrivateDraft(raw: unknown): Promise<{ id: number }> {
    if (
      process.env.CHAT_DRY_RUN !== "false" ||
      (!this.mock && process.env.CHAT_DRAFT_DELIVERY_ENABLED !== "true")
    )
      throw new Error("Draft delivery disabled.");
    const input = requestSchema.parse(raw),
      content = draftMarker + "\n\n" + input.text;
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
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          headers: {
            "api-access-token": this.token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content,
            message_type: "outgoing",
            private: true,
            content_attributes: {
              osplus_draft_id: input.draftId,
              osplus_engine: "osplus-v1",
              ...(input.triggerProviderId
                ? { osplus_trigger_message_id: input.triggerProviderId }
                : {}),
              ...(input.knowledgeVersion
                ? { osplus_knowledge_version: input.knowledgeVersion }
                : {}),
            },
          }),
        },
      );
      if (!response.body) throw new Error("Missing receipt");
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 131072) throw new Error("Receipt too large");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      if (!response.ok) throw new Error("Delivery unavailable");
      const receipt = z
        .object({
          id: z.number().int().positive().safe(),
          content: z.literal(content),
          private: z.literal(true),
          content_attributes: z
            .object({ osplus_draft_id: z.literal(input.draftId) })
            .passthrough(),
        })
        .strip()
        .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      return { id: receipt.id };
    } catch {
      // The provider may already have saved the note. A caller must retain its claim and reconcile, never resend blindly.
      throw new Error("Private draft delivery is unconfirmed.");
    }
  }
}
