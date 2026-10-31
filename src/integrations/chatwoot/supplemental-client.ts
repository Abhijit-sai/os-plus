import "server-only";
import { z } from "zod";
import { customerTextSchema } from "../../features/chat/actions/customer-text.ts";
import { ChatwootPublicClient } from "./public-client.ts";
const id = z.number().int().positive().safe();
const schema = z
  .object({
    accountId: id,
    conversationId: id,
    outboxId: z.string().uuid(),
    kind: z.enum(["price_image", "review"]),
    text: z.string().trim().min(1).max(6000),
    assetUrl: z.string().url().max(2048).nullable(),
  })
  .strict();
export async function approvedImage(raw: unknown, allowLocalMock = false) {
  const value = z.string().url().max(2048).parse(raw),
    url = new URL(value);
  const allowed = z
    .array(z.string().url())
    .max(20)
    .parse(JSON.parse(process.env.CHAT_MEDIA_ORIGINS ?? "[]"));
  if (
    !allowed.includes(url.origin) ||
    url.username ||
    url.password ||
    url.hash ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    (url.protocol !== "https:" &&
      !(
        allowLocalMock &&
        url.hostname === "127.0.0.1" &&
        url.protocol === "http:"
      ))
  )
    throw new Error("Approved image unavailable.");
  const response = await fetch(value, {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (
    !response.ok ||
    !response.body ||
    !["image/png", "image/jpeg"].includes(
      response.headers.get("content-type")?.split(";")[0] ?? "",
    )
  ) {
    await response.body?.cancel();
    throw new Error("Approved image unavailable.");
  }
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 5_000_000) throw new Error("Image too large");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks),
    png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const type = response.headers.get("content-type")!.split(";")[0];
  if ((type === "image/png" && !png) || (type === "image/jpeg" && !jpeg))
    throw new Error("Invalid image bytes");
  return { bytes, type, filename: png ? "price-list.png" : "price-list.jpg" };
}
/** The phase implements owned loopback mocks only. No remote asset fetch or production send is enabled. */
export class ChatwootSupplementalClient {
  private origin: string;
  private token: string;
  private mock: boolean;
  private beforePost: (() => Promise<void>) | undefined;
  constructor(options: {
    origin: string;
    token: string;
    allowLocalMock?: boolean;
    beforePost?: () => Promise<void>;
  }) {
    new ChatwootPublicClient(options);
    this.origin = new URL(options.origin).origin;
    this.token = options.token;
    this.mock = options.allowLocalMock === true;
    this.beforePost = options.beforePost;
  }
  async post(raw: unknown) {
    const x = schema.parse(raw);
    if (x.kind === "review") {
      await this.beforePost?.();
      return new ChatwootPublicClient({
        origin: this.origin,
        token: this.token,
        allowLocalMock: this.mock,
      }).post({
        accountId: x.accountId,
        conversationId: x.conversationId,
        outboxId: x.outboxId,
        text: x.text,
      });
    }
    if (
      process.env.CHAT_ACTIONS_ENABLED !== "true" ||
      process.env.CHAT_PUBLIC_REPLY_ENABLED !== "true" ||
      process.env.CHAT_DRY_RUN !== "false" ||
      process.env.CHAT_AGENT_MODEL_MODE !== "mock"
    )
      throw new Error("Image delivery disabled");
    // The same text safety gate used for public replies, without making a network request.
    customerTextSchema.parse(x.text);
    const image = await approvedImage(x.assetUrl, this.mock),
      form = new FormData();
    form.set("content", x.text);
    form.set("message_type", "outgoing");
    form.set("private", "false");
    form.set(
      "content_attributes",
      JSON.stringify({
        osplus_public_outbox_id: x.outboxId,
        osplus_engine: "osplus-v1",
      }),
    );
    form.append(
      "attachments[]",
      new Blob([new Uint8Array(image.bytes)], { type: image.type }),
      image.filename,
    );
    await this.beforePost?.();
    try {
      const response = await fetch(
        this.origin +
          "/api/v1/accounts/" +
          x.accountId +
          "/conversations/" +
          x.conversationId +
          "/messages",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          headers: { "api-access-token": this.token },
          body: form,
        },
      );
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error("No image receipt");
      }
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 131072) throw new Error("Image receipt too large");
          chunks.push(next.value);
        }
      } finally {
        await reader.cancel();
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const receipt = z
        .object({
          id,
          conversation_id: z.literal(x.conversationId),
          private: z.literal(false),
          content: z.literal(x.text),
          content_attributes: z
            .object({ osplus_public_outbox_id: z.literal(x.outboxId) })
            .passthrough(),
          attachments: z
            .array(z.object({ file_type: z.literal("image") }).passthrough())
            .min(1)
            .max(1),
        })
        .parse(JSON.parse(rawBody));
      return { id: receipt.id };
    } catch {
      throw new Error(
        "Image delivery unconfirmed. Do not resend automatically.",
      );
    }
  }
}
