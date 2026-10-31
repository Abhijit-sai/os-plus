import "server-only";
import { z } from "zod";
const sendSchema = z
  .object({
    chatId: z
      .string()
      .regex(/^-?[1-9][0-9]{0,15}$/)
      .refine((v) => Math.abs(Number(v)) < 2 ** 52),
    text: z
      .string()
      .min(1)
      .refine((v) => Array.from(v).length <= 4096),
  })
  .strict();
/** One persisted claim permits one POST. Lost/invalid receipts must be held by the caller. */
export class TelegramClient {
  private origin: string;
  private local: boolean;
  constructor(options: { origin?: string; allowLocalMock?: boolean } = {}) {
    const url = new URL(options.origin ?? "https://api.telegram.org");
    this.local =
      options.allowLocalMock === true &&
      url.hostname === "127.0.0.1" &&
      url.protocol === "http:";
    if (
      (!this.local && url.origin !== "https://api.telegram.org") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      throw new Error("Telegram transport unavailable.");
    this.origin = url.origin;
  }
  async send(raw: unknown): Promise<{ messageId: number }> {
    if (
      process.env.CHAT_FOUNDATION_ENABLED !== "true" ||
      process.env.CHAT_NOTIFICATIONS_ENABLED !== "true" ||
      process.env.CHAT_DRY_RUN !== "false" ||
      (this.local
        ? process.env.CHAT_TELEGRAM_MOCK_ENABLED !== "true"
        : process.env.CHAT_TELEGRAM_LIVE_ENABLED !== "true")
    )
      throw new Error("Telegram delivery disabled.");
    const input = sendSchema.parse(raw);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !/^[0-9]+:[A-Za-z0-9_-]{8,200}$/.test(token))
      throw new Error("Telegram transport unavailable.");
    try {
      const response = await fetch(
        this.origin + "/bot" + token + "/sendMessage",
        {
          method: "POST",
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: input.chatId,
            text: input.text,
            link_preview_options: { is_disabled: true },
          }),
        },
      );
      if (!response.ok || !response.body) throw new Error("No receipt");
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 32768) throw new Error("Receipt too large");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel();
      }
      const receipt = z
        .object({
          ok: z.literal(true),
          result: z.object({
            message_id: z.number().int().positive().safe(),
            chat: z.object({
              id: z
                .number()
                .int()
                .safe()
                .refine((v) => String(v) === input.chatId),
            }),
            text: z.literal(input.text),
          }),
        })
        .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      return { messageId: receipt.result.message_id };
    } catch {
      // Never include request URLs, provider descriptions or original exceptions: they may contain tokens.
      throw new Error(
        "Telegram delivery unconfirmed. Do not resend automatically.",
      );
    }
  }
}
