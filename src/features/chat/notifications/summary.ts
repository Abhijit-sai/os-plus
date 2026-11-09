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
export function formatDailySummary(raw: unknown, appOrigin: string, phantom?: unknown): string {
  const data = summarySchema.parse(raw),
    link = origin(appOrigin) + "/leads/performance";
  if (phantom !== undefined) return formatPhantomDigest(data, appOrigin, phantom);
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
export function formatInstantAlert(raw: unknown, appOrigin: string, phantom?: unknown): string {
  const data = alertSchema.parse(raw),
    base = origin(appOrigin);
  const context = phantomAlert.safeParse(phantom);
  if (context.success && data.leadId)
    return formatPhantomAlert(data.kind, data.leadId, base, context.data);
  return (
    titles[data.kind] +
    "\n" +
    safe(data.brand) +
    "\n" +
    base +
    (data.leadId ? "/leads/" + data.leadId : "/leads")
  );
}

const briefSchema = z.object({
  category: z.enum(["design", "delivery", "availability"]),
  garment: z.enum(["shirt", "pants", "kurta", "hand-painted", "clothing"]),
  reference: z.enum(["photo", "product", "link", "description"]).nullable(),
  deadline: z.string().max(40).nullable(),
  fit: z.string().max(40).nullable(),
}).strict();
const phantomAlert = z.object({
  customer: z.string().nullable(),
  at: z.string().datetime({ offset: true }),
  reason: z.string().nullable(),
  request: briefSchema.nullable(),
  failure: z.boolean(),
  photo: z.boolean(),
  excerpt: z.string().nullable(),
}).strict();
const workSchema = z.array(z.object({
  leadId: z.string().uuid(),
  customer: z.string().nullable(),
  action: z.enum(["staff", "reply"]),
  lastCustomerAt: z.string().datetime({ offset: true }),
  request: briefSchema.nullable(),
  priority: z.number().int(),
}).strict()).max(5);
const labels = {
  design: "🎨 Designer review",
  delivery: "🚚 Delivery or pickup request",
  availability: "👕 Product or size check",
};
const actions = {
  design: "Review the reference and confirm what can be made.",
  delivery: "Check whether the requested timing is possible.",
  availability: "Check the product and size, then share the next step.",
};
const referenceLabels = {
  photo: "Photo in chat",
  product: "Product link in chat",
  link: "Reference link in chat",
  description: "Design described in chat",
};
const formatTime = (iso: string, timezone = "Asia/Kolkata") =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
const protectedText = (value: string, limit: number) =>
  Array.from(safe(value)
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[link in chat]")
    .replace(/[^\s@]+@[^\s@]+/g, "[contact detail]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[number in chat]"))
    .slice(0, limit).join("");
const leadName = (name: string | null) => name ? protectedText(name, 65) : "Customer";
const briefDetails = (brief: z.infer<typeof briefSchema>) => [
  brief.garment === "hand-painted" ? "Hand-painted piece" : brief.garment,
  brief.reference && referenceLabels[brief.reference],
  brief.fit && protectedText(brief.fit, 40),
  brief.deadline && "Needed by " + protectedText(brief.deadline, 40),
].filter(Boolean).join(" · ");

function formatPhantomAlert(
  kind: z.infer<typeof alertSchema>["kind"],
  leadId: string,
  base: string,
  context: z.infer<typeof phantomAlert>,
) {
  const excerpt = context.excerpt ? protectedText(context.excerpt, 220) : "";
  const payment = kind === "payment_claim" || context.reason === "dues" || context.reason === "payment_claim" ||
    /\b(?:paid|payment|upi|utr|bank|card number)\b/i.test(excerpt);
  const failure = kind === "agent_failure" || context.failure;
  const status = /\b(?:order status|order update|my (?:order|parcel|package)|track|is .+ ready)\b/i.test(excerpt);
  const logistics = /\b(?:pick[ -]?up|collect|deliver(?:y|ed)?|ship(?:ping|ped)?)\b/i.test(excerpt);
  const brief = context.request;
  const [title, next] = failure ? ["⚠️ Reply needs attention", "Read the last message and reply to the customer."]
    : payment ? ["🧾 Payment needs verification", "Check the payment record before replying."]
    : brief ? [labels[brief.category], actions[brief.category]]
    : status ? ["📦 Order status check", "Look up the order and send the customer an update."]
    : logistics ? [labels.delivery, actions.delivery]
    : kind === "booking_request" ? ["📌 Request to confirm", "Check the request details and reply."]
    : ["🙋 Staff reply needed", "Read the enquiry and reply to the customer."];
  return [
    title, leadName(context.customer),
    brief && briefDetails(brief),
    !payment && (excerpt ? `“${excerpt}”` : context.photo ? "Photo attached in chat." : null),
    "", `Next step · ${next}`, "", `Open conversation → ${base}/leads/${leadId}`,
    `${formatTime(context.at)} IST`,
  ].filter((line) => line !== null && line !== false).join("\n");
}

function formatPhantomDigest(data: DailySummary, appOrigin: string, raw: unknown) {
  const base = origin(appOrigin), metrics = data.totals;
  const work = workSchema.safeParse(raw);
  const localDay = new Intl.DateTimeFormat("en-IN", {
    timeZone: data.timezone, weekday: "short", day: "numeric", month: "short",
  }).format(new Date(data.windowEnd));
  const cutoff = formatTime(data.windowEnd, data.timezone);
  const seconds = metrics.medianReplySeconds;
  const speed = seconds === null ? "" : seconds < 60
    ? ` · typical first reply ${Math.round(seconds)}s`
    : ` · typical first reply ${Math.round(seconds / 60)} min`;
  return [
    `📊 Phantom Threads · ${localDay} (through ${cutoff})`,
    "",
    ...(work.success && work.data.length ? ["Needs attention now", ...work.data.flatMap((row) => [
      `• ${leadName(row.customer)} · ${row.request ? briefDetails(row.request) :
        row.action === "staff" ? "Staff follow-up pending" : "Waiting for a reply"}`,
      `  Open → ${base}/leads/${row.leadId}`,
    ]), ""] : work.success ? ["No open follow-ups or waiting replies.", ""] : []),
    metrics.chats === 0 ? "No chats in this reporting window." :
      `💬 ${metrics.chats} chats · ${metrics.customerMessages} customer messages · ${metrics.newLeads} new enquiries`,
    `🤖 ${metrics.botReplies} bot replies · ${metrics.staffReplies} staff replies${speed}`,
    `🙋 ${metrics.handoffs} handed to staff · ${metrics.unansweredChats} first enquiries without a reply`,
    ...(metrics.errors ? [`⚠️ ${metrics.errors} reply errors or fallbacks`] : []),
    "",
    `Open reports → ${base}/leads/performance`,
  ].join("\n");
}
