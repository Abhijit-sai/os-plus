import { z } from "zod";

const identifier = z
  .number()
  .int()
  .safe()
  .refine((n) => n !== 0 && Math.abs(n) < 2 ** 52);
const linkUpdateSchema = z
  .object({
    update_id: z.number().int().nonnegative().safe(),
    message: z
      .object({
        message_id: z.number().int().positive().safe(),
        date: z.number().int().nonnegative().safe(),
        chat: z
          .object({
            id: identifier,
            type: z.enum(["private", "group", "supergroup"]),
          })
          .passthrough(),
        from: z
          .object({
            id: identifier.refine((n) => n > 0),
            is_bot: z.literal(false),
          })
          .passthrough(),
        text: z.string().max(256),
      })
      .passthrough(),
  })
  .passthrough();

export type TelegramLink = {
  updateId: number;
  chatId: string;
  senderId: string;
  chatType: "private" | "group" | "supergroup";
  code: string;
};

/** A secret code authorizes a claim, never an active subscription. Ignore relayed commands. */
export function parseTelegramLink(input: unknown): TelegramLink | null {
  const parsed = linkUpdateSchema.safeParse(input);
  if (!parsed.success) return null;
  const { update_id: updateId, message } = parsed.data;
  if (
    ["edited_message", "channel_post", "edited_channel_post"].some(
      (key) => key in parsed.data,
    )
  )
    return null;
  if (
    [
      "sender_chat",
      "forward_origin",
      "forward_date",
      "forward_from",
      "forward_from_chat",
      "via_bot",
    ].some((key) => key in message)
  )
    return null;
  if (message.chat.type === "private" && message.chat.id !== message.from.id)
    return null;
  const match = /^\/start(?:@[A-Za-z0-9_]{5,32})? ([A-Za-z0-9_-]{43})$/.exec(
    message.text,
  );
  if (!match) return null;
  return {
    updateId,
    chatId: String(message.chat.id),
    senderId: String(message.from.id),
    chatType: message.chat.type,
    code: match[1],
  };
}

export const summaryScheduleSchema = z
  .object({
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        if (/^[+-]/.test(value)) return false;
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Choose a named timezone."),
    localTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  })
  .strict();

/** Latest eligible local date, not an elapsed-24h bucket. SQL resolves the actual DST cutoff. */
export function latestSummaryDate(
  at: string,
  timezone: string,
  localTime: string,
): string {
  const config = summaryScheduleSchema.parse({ timezone, localTime });
  const instant = new Date(z.string().datetime({ offset: true }).parse(at));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const date = part("year") + "-" + part("month") + "-" + part("day");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const wallEpoch = (at: number) => {
    const p = formatter.formatToParts(new Date(at)),
      value = (k: string) => Number(p.find((x) => x.type === k)!.value);
    return Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
  };
  const wall = Date.parse(date + "T" + config.localTime + ":00Z");
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const probe = wall + hours * 3600000;
      return wallEpoch(probe) - probe;
    }),
  );
  const candidates = [...offsets].map((offset) => wall - offset);
  const exact = candidates.filter((candidate) => wallEpoch(candidate) === wall);
  // Match the database's later occurrence on a fold; a skipped wall time resolves forward.
  const cutoff = Math.max(...(exact.length ? exact : candidates));
  if (instant.getTime() >= cutoff) return date;
  // Calendar subtraction deliberately avoids 23/25-hour DST day lengths.
  return new Date(Date.parse(date + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
}
