import "server-only";
import { z } from "zod";
import {
  voiceTransportEnabled,
  localVoiceOrigin,
  boundedVoiceBody,
  positiveProviderId as id,
} from "../../features/chat/voice/http.ts";
const inputSchema = z
  .object({
    accountId: id,
    conversationId: id,
    providerMessageId: id,
    jobId: z.string().uuid(),
    text: z.string().trim().min(1).max(6000),
  })
  .strict();
export const transcriptMarker = "Automatic voice transcript — local mock";
/** Separate from suggestion drafts: a transcript is private derived customer input, never a reply button. */
export class ChatwootTranscriptClient {
  private origin: string;
  private token: string;
  constructor(options: {
    origin: string;
    token: string;
    allowLocalMock?: boolean;
  }) {
    this.origin = localVoiceOrigin(options.origin, options.allowLocalMock);
    this.token = z.string().min(1).max(8192).parse(options.token);
  }
  async post(raw: unknown, beforePost: () => Promise<void>) {
    voiceTransportEnabled();
    if (process.env.CHAT_DRY_RUN !== "false")
      throw new Error("Private transcript delivery disabled.");
    const input = inputSchema.parse(raw),
      content = transcriptMarker + "\n\n" + input.text;
    await beforePost();
    voiceTransportEnabled();
    if (process.env.CHAT_DRY_RUN !== "false")
      throw new Error("Private transcript delivery disabled.");
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
            content,
            message_type: "outgoing",
            private: true,
            content_attributes: {
              osplus_voice_job_id: input.jobId,
              osplus_voice_source_message_id: input.providerMessageId,
              osplus_mock: true,
            },
          }),
        },
      );
      const receipt = z
        .object({
          id,
          conversation_id: z.literal(input.conversationId),
          account_id: z.literal(input.accountId).optional(),
          content: z.literal(content),
          private: z.literal(true),
          content_attributes: z
            .object({
              osplus_voice_job_id: z.literal(input.jobId),
              osplus_voice_source_message_id: z.literal(
                input.providerMessageId,
              ),
            })
            .passthrough(),
        })
        .parse(
          JSON.parse(
            (await boundedVoiceBody(response, 131072)).toString("utf8"),
          ),
        );
      return { id: receipt.id };
    } catch {
      throw new Error("Private transcript receipt is unconfirmed.");
    }
  }
}
