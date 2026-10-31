import "server-only";
import { z } from "zod";
import {
  voiceTransportEnabled,
  localVoiceOrigin,
  boundedVoiceBody,
  positiveProviderId as id,
} from "../../features/chat/voice/http.ts";
import {
  inspectVoice,
  VoiceUnreadableError,
  voiceLimitsSchema,
} from "../../features/chat/voice/rules.ts";
const scopeSchema = voiceLimitsSchema
  .extend({
    accountId: id,
    conversationId: id,
    providerMessageId: id,
    attachmentId: id,
  })
  .strict();
/** Local-only CH8 adapter. Read account-scoped provider facts; never fetch a webhook-supplied URL. */
export class ChatwootAttachmentClient {
  private origin: string;
  private token: string;
  private mediaOrigins: string[];
  constructor(options: {
    origin: string;
    token: string;
    mediaOrigins: string[];
    allowLocalMock?: boolean;
  }) {
    this.origin = localVoiceOrigin(options.origin, options.allowLocalMock);
    this.token = z.string().min(1).max(8192).parse(options.token);
    this.mediaOrigins = z
      .array(z.string())
      .min(1)
      .max(5)
      .parse(options.mediaOrigins)
      .map((x) => localVoiceOrigin(x, options.allowLocalMock));
  }
  async download(raw: unknown) {
    voiceTransportEnabled();
    const scope = scopeSchema.parse(raw);
    try {
      const response = await fetch(
        this.origin +
          "/api/v1/accounts/" +
          scope.accountId +
          "/conversations/" +
          scope.conversationId +
          "/messages?before=" +
          (scope.providerMessageId + 1),
        {
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
          headers: { "api-access-token": this.token },
        },
      );
      const body = z
        .object({
          // Ordinary text history may omit attachments. Validate the selected audio message in full below.
          payload: z.array(z.object({ id }).passthrough()).max(100),
        })
        .parse(
          JSON.parse(
            (await boundedVoiceBody(response, 1000000)).toString("utf8"),
          ),
        );
      const msg = z.object({
        id, private: z.boolean(), message_type: z.union([z.number(), z.string()]),
        attachments: z.array(z.object({
          id, account_id: id, message_id: id, file_type: z.string(), data_url: z.string().url().max(8192),
        })).max(15),
      }).parse(body.payload.find((m) => m.id === scope.providerMessageId));
      if (
        !msg ||
        msg.private ||
        ![0, "incoming"].includes(msg.message_type) ||
        msg.attachments.length !== 1
      )
        throw new VoiceUnreadableError();
      const attachment = msg.attachments[0];
      if (
        attachment.id !== scope.attachmentId ||
        attachment.account_id !== scope.accountId ||
        attachment.message_id !== scope.providerMessageId ||
        attachment.file_type !== "audio"
      )
        throw new VoiceUnreadableError();
      const url = new URL(attachment.data_url);
      if (
        !this.mediaOrigins.includes(url.origin) ||
        url.username ||
        url.password ||
        url.hash ||
        url.search ||
        !/^\/rails\/active_storage\/blobs\/(?:redirect|proxy)\/[a-zA-Z0-9_=-]+\/[^/]+$/.test(
          url.pathname,
        )
      )
        throw new VoiceUnreadableError();
      // Pinned Rails/Chatwoot exposes a same-origin proxy route; do not follow a blob redirect to arbitrary storage.
      url.pathname = url.pathname.replace("/blobs/redirect/", "/blobs/proxy/");
      voiceTransportEnabled();
      const media = await fetch(url, {
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const type = media.headers.get("content-type")?.split(";")[0].trim();
      if (
        !["audio/wav", "audio/x-wav", "audio/ogg", "application/ogg", "audio/opus"].includes(
          type ?? "",
        )
      ) {
        await media.body?.cancel();
        throw new VoiceUnreadableError();
      }
      const bytes = await boundedVoiceBody(media, scope.maxBytes);
      voiceTransportEnabled();
      const checked = inspectVoice(bytes, {
        maxBytes: scope.maxBytes,
        maxSeconds: scope.maxSeconds,
      });
      if (
        (checked.mime === "audio/wav" &&
          !["audio/wav", "audio/x-wav"].includes(type!)) ||
        (checked.mime === "audio/ogg" &&
          !["audio/ogg", "application/ogg", "audio/opus"].includes(type!))
      )
        throw new VoiceUnreadableError();
      return checked;
    } catch {
      throw new VoiceUnreadableError();
    }
  }
}
