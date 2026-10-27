import { z } from "zod";
const count = z.number().int().nonnegative().safe(),
  amount = z.number().finite().nonnegative();
export const notificationEventSchema = z.enum([
  "booking_request",
  "handoff",
  "payment_claim",
  "agent_failure",
  "daily_summary",
  "new_lead",
]);
export const metricsSchema = z
  .object({
    chats: count,
    customerMessages: count,
    botReplies: count,
    staffReplies: count,
    medianReplySeconds: amount.nullable(),
    unansweredChats: count,
    handoffs: count,
    handoffReasons: z.record(
      z.enum([
        "complaint",
        "payment_claim",
        "dues",
        "unreadable",
        "operational_change",
        "staff_requested",
      ]),
      count,
    ),
    requests: count,
    operationalActions: count,
    confirmedBookings: count,
    paymentClaims: count,
    tasks: count,
    newLeads: count,
    wonLeads: count,
    wonEstimatedValue: z
      .array(
        z.object({ currency: z.string().regex(/^[A-Z]{3}$/), amount }).strict(),
      )
      .max(200),
    errors: count,
    cost: z.object({ knownUsd: amount, unsettledCalls: count }).strict(),
  })
  .strict();
export const summarySchema = z
  .object({
    version: z.literal(1),
    localDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    timezone: z.string().min(1).max(100),
    windowStart: z.string().datetime({ offset: true }),
    windowEnd: z.string().datetime({ offset: true }),
    totals: metricsSchema,
    brands: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().max(200),
            metrics: metricsSchema,
          })
          .strict(),
      )
      .max(1000),
    judge: z.object({ status: z.literal("not_evaluated") }).strict(),
  })
  .strict()
  .refine(
    (v) => Date.parse(v.windowStart) < Date.parse(v.windowEnd),
    "Invalid summary window",
  );
export type DailySummary = z.infer<typeof summarySchema>;
function origin(raw: string): string {
  const url = new URL(raw);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(url.hostname)
      ))
  )
    throw new Error("Configure the trusted OS PLUS origin.");
  return url.origin;
}
const safe = (value: string) =>
  value
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .trim();
function lines(m: z.infer<typeof metricsSchema>): string[] {
  return [
    "Chats: " + m.chats + " | Customer messages: " + m.customerMessages,
    "Public replies — bot: " + m.botReplies + " | staff: " + m.staffReplies,
    "Median first reply in window: " +
      (m.medianReplySeconds === null
        ? "unavailable"
        : m.medianReplySeconds + "s") +
      " | unanswered first enquiries: " +
      m.unansweredChats,
    "Handoffs: " +
      m.handoffs +
      (Object.keys(m.handoffReasons).length
        ? " (" +
          Object.entries(m.handoffReasons)
            .map(([k, v]) => k.replaceAll("_", " ") + ": " + v)
            .join(", ") +
          ")"
        : ""),
    "Provisional requests: " +
      m.requests +
      " | Operational actions: " +
      m.operationalActions,
    "Confirmed bookings: " +
      m.confirmedBookings +
      " | Tasks created: " +
      m.tasks,
    "Payment claims: " + m.paymentClaims + " (not verified payments)",
    "New leads: " + m.newLeads + " | Won leads: " + m.wonLeads,
    "Won estimated lead value: " +
      (m.wonEstimatedValue.map((v) => v.currency + " " + v.amount).join("; ") ||
        "unavailable"),
    "Agent errors: " + m.errors,
    "Model cost known: USD " +
      m.cost.knownUsd +
      (m.cost.unsettledCalls
        ? " + " + m.cost.unsettledCalls + " unsettled (total unknown)"
        : ""),
  ];
}
export function formatDailySummary(raw: unknown, appOrigin: string): string {
  const data = summarySchema.parse(raw),
    link = origin(appOrigin) + "/leads/performance";
  const header = [
    "Daily enquiries — " + data.localDate + " (" + safe(data.timezone) + ")",
    "Window: " + data.windowStart + " → " + data.windowEnd,
    ...lines(data.totals),
    "Experience rating: not evaluated (live judge disabled).",
  ];
  let text = header.join("\n");
  const footer = "\nOpen reports: " + link;
  if (data.brands.length > 1) {
    for (const b of data.brands) {
      const section =
        "\n\n" + safe(b.name) + "\n" + lines(b.metrics).join("\n");
      if (Array.from(text + section + footer).length > 4000) {
        text += "\nFurther brand sections omitted; open reports for details.";
        break;
      }
      text += section;
    }
  }
  if (Array.from(text + footer).length > 4096)
    throw new Error("Report exceeds delivery limit.");
  return text + footer;
}
const alertSchema = z
  .object({
    kind: notificationEventSchema.exclude(["daily_summary"]),
    brand: z.string().min(1).max(200),
    leadId: z.string().uuid().nullable(),
  })
  .strict();
const titles = {
  booking_request: "New provisional request",
  handoff: "Staff handoff needed",
  payment_claim: "Payment claim — staff verification needed",
  agent_failure: "Reply assistance needs attention",
  new_lead: "New enquiry",
};
export function formatInstantAlert(raw: unknown, appOrigin: string): string {
  const data = alertSchema.parse(raw),
    base = origin(appOrigin);
  return (
    titles[data.kind] +
    "\n" +
    safe(data.brand) +
    "\n" +
    base +
    (data.leadId ? "/leads/" + data.leadId : "/leads")
  );
}
