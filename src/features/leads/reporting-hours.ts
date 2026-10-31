import { z } from "zod";
export const reportingScheduleSchema = z
  .object({
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          if (/^[+-]/.test(value)) return false;
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Choose a named reporting timezone, such as Asia/Kolkata.")
      .transform(
        (value) =>
          new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions()
            .timeZone,
      ),
    intervals: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(7),
            startMinute: z.number().int().min(0).max(1439),
            endMinute: z.number().int().min(1).max(1440),
          })
          .strict()
          .refine(
            (w) => w.endMinute > w.startMinute,
            "Split overnight hours at midnight.",
          ),
      )
      .min(1)
      .max(56),
  })
  .strict()
  .superRefine((value, ctx) => {
    const sorted = value.intervals.toSorted(
      (a, b) => a.day - b.day || a.startMinute - b.startMinute,
    );
    for (let i = 1; i < sorted.length; i++)
      if (
        sorted[i].day === sorted[i - 1].day &&
        sorted[i].startMinute < sorted[i - 1].endMinute
      )
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["intervals"],
          message: "Reporting windows must not overlap.",
        });
  });
/** Reporting only, never booking permission or a promise that a branch is open. */
export function isOutsideReportingHours(
  at: string,
  input: unknown,
): boolean | null {
  if (input === undefined || input === null) return null;
  const schedule = reportingScheduleSchema.parse(input);
  const date = z.string().datetime({ offset: true }).parse(at);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  const day =
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
      parts.find((p) => p.type === "weekday")!.value,
    ) + 1;
  const minute =
    Number(parts.find((p) => p.type === "hour")!.value) * 60 +
    Number(parts.find((p) => p.type === "minute")!.value);
  return !schedule.intervals.some(
    (w) => w.day === day && minute >= w.startMinute && minute < w.endMinute,
  );
}
