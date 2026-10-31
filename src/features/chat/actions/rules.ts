import { z } from "zod";
const text = z.string().trim().min(1).max(2000).nullable();
export const capabilitySchema = z.enum(["follow_up_task", "laundry_pickup"]);
const readinessSchema = z
  .object({
    capability: capabilitySchema,
    canBook: z.boolean(),
    channel: z.enum(["whatsapp", "website", "instagram", "facebook"]),
    verifiedPhone: z.boolean(),
    name: text,
    services: z.array(z.string().min(1).max(64)).max(100),
    allowedServices: z.array(z.string().min(1).max(64)).max(100),
    area: text,
    address: text,
    date: text,
    window: text,
    allowedWindows: z.array(z.string().min(1).max(64)).max(50),
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
function validDate(value: string | null, today: string) {
  return (
    value !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value &&
    value >= today
  );
}
/** Readiness is a proposal check, never command authority or a capacity reservation. */
export function bookingReadiness(raw: unknown) {
  const x = readinessSchema.parse(raw),
    missing: string[] = [];
  if (
    new Set(x.services).size !== x.services.length ||
    x.services.some((s) => !x.allowedServices.includes(s))
  )
    throw Error("Unsupported service.");
  if (!x.canBook) missing.push("booking_permission");
  if (x.channel !== "whatsapp" || !x.verifiedPhone)
    missing.push("verified_channel");
  if (!x.services.length) missing.push("service");
  if (x.capability === "laundry_pickup") {
    if (!x.name || x.name.length < 2) missing.push("name");
    if (!x.address) missing.push("address");
    if (!validDate(x.date, x.today)) missing.push("date");
    if (!x.window || !x.allowedWindows.includes(x.window))
      missing.push("window");
  }
  return {
    ready: missing.length === 0,
    missing,
    requiresStaffApproval: true as const,
    reservesAppointment: false as const,
  };
}

const id = z.string().uuid();
const routeSchema = z
  .object({
    tenantId: id,
    chatwootAssigneeId: z.number().int().positive().safe().nullable(),
    staffLinks: z
      .array(
        z
          .object({
            tenantId: id,
            chatwootUserId: z.number().int().positive().safe(),
            userId: id,
          })
          .strict(),
      )
      .max(1000),
    users: z
      .array(
        z
          .object({
            tenantId: id,
            id,
            role: z.enum(["owner_admin", "manager", "viewer", "finance"]),
            status: z.string().max(40),
          })
          .strict(),
      )
      .max(1000),
    leadOwnerId: id.nullable(),
    branchTeamId: id.nullable(),
    teams: z
      .array(z.object({ tenantId: id, id, active: z.boolean() }).strict())
      .max(1000),
  })
  .strict();
export function resolveTaskRoute(raw: unknown) {
  const x = routeSchema.parse(raw);
  const eligible = (userId: string | null) =>
    x.users.some(
      (u) =>
        u.tenantId === x.tenantId &&
        u.id === userId &&
        u.status === "active" &&
        ["owner_admin", "manager"].includes(u.role),
    );
  const mapped = x.staffLinks.filter(
    (l) =>
      l.tenantId === x.tenantId &&
      l.chatwootUserId === x.chatwootAssigneeId &&
      eligible(l.userId),
  );
  if (mapped.length === 1)
    return {
      userId: mapped[0].userId,
      teamId: null,
      source: "chatwoot" as const,
    };
  if (eligible(x.leadOwnerId))
    return { userId: x.leadOwnerId, teamId: null, source: "lead" as const };
  if (
    x.teams.some(
      (t) => t.tenantId === x.tenantId && t.id === x.branchTeamId && t.active,
    )
  )
    return { userId: null, teamId: x.branchTeamId, source: "team" as const };
  return { userId: null, teamId: null, source: "unassigned" as const };
}

const reviewSchema = z
  .object({
    enabled: z.boolean(),
    deliveredAt: z.string().datetime({ offset: true }).nullable(),
    historicalImport: z.boolean(),
    now: z.string().datetime({ offset: true }),
    lastPublicReviewAt: z.string().datetime({ offset: true }).nullable(),
    cooldownDays: z.number().int().min(1).max(3650),
  })
  .strict();
/** Sentiment is deliberately absent. Only a confirmed public receipt starts the cooldown. */
export function reviewEligibility(raw: unknown) {
  const x = reviewSchema.parse(raw),
    now = Date.parse(x.now);
  return (
    x.enabled &&
    !x.historicalImport &&
    x.deliveredAt !== null &&
    Date.parse(x.deliveredAt) <= now &&
    (x.lastPublicReviewAt === null ||
      now - Date.parse(x.lastPublicReviewAt) >= x.cooldownDays * 86400000)
  );
}
const imageSchema = z
  .object({
    requested: z.boolean(),
    textDelivered: z.boolean(),
    alreadyPublic: z.boolean(),
    approvedUrl: z
      .string()
      .url()
      .max(2048)
      .nullable()
      .refine((value) => {
        if (value === null) return true;
        const u = new URL(value);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          !/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|\[)/i.test(
            u.hostname,
          )
        );
      }, "Use an approved HTTPS media origin."),
  })
  .strict();
/** This is an eligibility check, not permission to fetch a URL; transport requires its own origin allowlist. */
export function priceImageEligibility(raw: unknown) {
  const x = imageSchema.parse(raw);
  return (
    x.requested && x.textDelivered && !x.alreadyPublic && x.approvedUrl !== null
  );
}

const operationSchema = z
  .object({
    operation: z.enum(["revise", "confirm", "withdraw", "approve"]),
    status: z.enum([
      "requested",
      "customer_confirmed",
      "materialized",
      "withdrawn",
    ]),
    version: z.number().int().positive(),
    expectedVersion: z.number().int().positive(),
    revision: z.number().int().positive(),
    confirmedRevision: z.number().int().positive().nullable(),
    role: z.enum(["owner_admin", "manager", "viewer", "finance", "webhook"]),
    ready: z.boolean(),
  })
  .strict();
/** The command may apply this effect only after fresh tenant/actor/evidence checks in its transaction. */
export function requestOperation(raw: unknown) {
  const x = operationSchema.parse(raw);
  if (["viewer", "finance"].includes(x.role))
    throw Error("Staff approval/access required.");
  if (x.version !== x.expectedVersion)
    throw Error("Request changed. Reload before approval.");
  if (x.status === "materialized")
    return { effect: "handoff" as const, clearConfirmation: false };
  if (x.status === "withdrawn") throw Error("Request was withdrawn.");
  if (x.operation === "approve") {
    if (!["owner_admin", "manager"].includes(x.role))
      throw Error("Staff approval required.");
    if (
      !x.ready ||
      x.status !== "customer_confirmed" ||
      x.confirmedRevision !== x.revision
    )
      throw Error("Current complete request confirmation required.");
    return { effect: "materialize" as const, clearConfirmation: false };
  }
  if (x.operation === "revise")
    return { effect: "revise" as const, clearConfirmation: true };
  if (x.operation === "confirm")
    return { effect: "confirm" as const, clearConfirmation: false };
  return { effect: "withdraw" as const, clearConfirmation: true };
}
