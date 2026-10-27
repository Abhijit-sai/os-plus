import type { AgentContext } from "./context.ts";
import type { Understanding } from "./schemas.ts";
import { actionReply } from "../actions/reply-plan.ts";

type Plan =
  | { kind: "locked"; text: string | null; handoff: boolean; reason: string }
  | { kind: "information"; handoff: false; reason: "information" };
const same = (a: string, b: string) =>
  a.normalize("NFKC").trim().toLowerCase() ===
  b.normalize("NFKC").trim().toLowerCase();

export const hasPublicReply = (ctx: AgentContext, text: string) =>
  ctx.session.messages.some(
    (m) =>
      (m.author === "bot" || m.author === "staff") &&
      same(m.content ?? "", text),
  );

/** Observations can request staff review; only transactional commands establish operational truth. */
export function choosePlan(
  understanding: Understanding,
  ctx: AgentContext,
): Plan {
  const flags = new Set(understanding.signals.map((signal) => signal.kind));
  const previous = ctx.session.messages
    .filter((m) => m.author === "bot" || m.author === "staff")
    .map((m) => m.content ?? "");
  const locked = (text: string, handoff: boolean, reason: string): Plan => ({
    kind: "locked",
    text: previous.some((old) => same(old, text)) ? null : text,
    handoff,
    reason,
  });
  if (flags.has("payment_claim"))
    return locked(
      previous.some((old) => same(old, ctx.pack.locked.paymentClaimReply))
        ? ctx.pack.locked.paymentClaimAgain
        : ctx.pack.locked.paymentClaimReply,
      true,
      "payment_review",
    );
  if (
    understanding.confidence === "low" ||
    ctx.pack.handoffTopics.some((topic) =>
      ctx.session.messages.some(
        (m) =>
          m.author === "customer" &&
          (m.content ?? "")
            .normalize("NFKC")
            .toLowerCase()
            .includes(topic.normalize("NFKC").trim().toLowerCase()),
      ),
    ) ||
    [...flags].some((kind) =>
      ["financial", "order_status", "complaint", "handoff", "cancel"].includes(
        kind,
      ),
    )
  )
    return locked(ctx.pack.locked.handoffLine, true, "person_required");
  if (flags.has("identity"))
    return locked(ctx.pack.locked.identityReply, false, "identity");
  if (flags.has("unreadable"))
    return locked(ctx.pack.locked.unreadableHandoff, true, "unreadable");
  if (flags.has("vendor"))
    return locked(ctx.pack.locked.vendorReply, false, "vendor");
  const action = actionReply(understanding, ctx);
  if (action) return locked(action.text, false, action.reason);
  if (flags.has("booking") || flags.has("confirm"))
    return locked(ctx.pack.locked.handoffLine, true, "person_required");
  return { kind: "information", handoff: false, reason: "information" };
}
