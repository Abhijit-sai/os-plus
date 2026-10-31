import type { AgentContext } from "../agent/context.ts";
import type { Understanding } from "../agent/schemas.ts";
import { mapsPoint, nearestBranch, whatsappLink } from "./links.ts";
/** Code chooses one configured question. These words acknowledge a request, never a booked slot. */
export function actionReply(
  u: Understanding,
  ctx: AgentContext,
): { text: string; reason: string } | null {
  const kinds = new Set(u.signals.map((s) => s.kind)),
    a = ctx.actions,
    prompts = ctx.pack.booking?.prompts;
  if (
    !a ||
    !prompts ||
    u.confidence !== "high" ||
    [...kinds].some((k) =>
      [
        "financial",
        "payment_claim",
        "complaint",
        "cancel",
        "handoff",
        "order_status",
      ].includes(k),
    )
  )
    return null;
  if (kinds.has("location")) {
    const latest =
      ctx.session.messages.filter((m) => m.author === "customer").at(-1)
        ?.content ?? "";
    const urls = latest.match(/https:\/\/[^\s<>]+/g) ?? [];
    const point = urls.length === 1 ? mapsPoint(urls[0]) : null;
    const branch = nearestBranch({
      tenantId: ctx.scope.tenantId,
      brandId: ctx.brandId,
      point,
      area: u.slots.find((s) => s.key === "area")?.value ?? null,
      locations: ctx.locations,
      areas: ctx.pack.areas,
    });
    return {
      text: branch?.mapUrl
        ? [branch.name, branch.address, branch.mapUrl]
            .filter(Boolean)
            .join("\n")
        : prompts.location,
      reason: "location",
    };
  }
  if (!kinds.has("booking") && !kinds.has("confirm")) return null;
  if (ctx.channelKind !== "whatsapp" || !a.verifiedPhone) {
    return a.whatsappNumber
      ? {
          text:
            prompts.whatsappHandoff +
            "\n" +
            whatsappLink({ phone: a.whatsappNumber, ref: a.leadRef }),
          reason: "verified_channel_required",
        }
      : null;
  }
  if (!a.canBook) return null;
  if (a.request?.status === "materialized" || kinds.has("confirm"))
    return { text: prompts.awaitingStaff, reason: "staff_approval_required" };
  const details = {
    ...(a.request?.details ?? {
      services: [],
      name: null,
      address: null,
      date: null,
      window: null,
    }),
    ...Object.fromEntries(u.slots.map((s) => [s.key, s.value])),
  };
  if (u.services.length) details.services = u.services;
  const question = (
    key: "services" | "name" | "address" | "date" | "window",
    options: string[] = [],
  ) => {
    const line =
      prompts[key] + (options.length ? "\n" + options.join("\n") : "");
    const sent = ctx.session.messages.some(
      (m) => (m.author === "bot" || m.author === "staff") && m.content === line,
    );
    return {
      text: sent ? prompts.awaitingStaff : line,
      reason: "request_" + key,
    };
  };
  if (!details.services.length)
    return question(
      "services",
      ctx.pack.services.map((s) => s.name),
    );
  if (ctx.pack.booking?.capability === "laundry_pickup") {
    if (!details.name) return question("name");
    if (!details.address) return question("address");
    if (!details.date) return question("date");
    if (!details.window)
      return question(
        "window",
        ctx.pack.booking.windows?.map((w) => w.label),
      );
  }
  return { text: prompts.awaitingStaff, reason: "staff_approval_required" };
}
