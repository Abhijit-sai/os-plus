import type { LeadView } from "./pii.ts";
import type { LeadFilters } from "./read-schemas.ts";
/** Omitting ownerId preserves automatic assignment. An explicit null deliberately unassigns. */
export function buildLeadEdit(
  lead: LeadView,
  fields: {
    stage: LeadView["stage"];
    ownerId: string;
    notes: string;
    lostReason: string;
  },
) {
  const ownerId = fields.ownerId || null;
  const reasonChanged =
    fields.stage === "lost" &&
    fields.lostReason.trim() !== (lead.lostReason || "");
  const stageChanged = fields.stage !== lead.stage;
  return {
    action: "lead.edit" as const,
    input: {
      leadId: lead.id,
      version: lead.version,
      ...(stageChanged || reasonChanged ? { stage: fields.stage } : {}),
      ...(fields.stage === "lost" && (stageChanged || reasonChanged)
        ? { lostReason: fields.lostReason }
        : {}),
      ...(ownerId !== lead.ownerId ? { ownerId } : {}),
      notes: fields.notes || null,
    },
  };
}
export function replyState(
  lead: Pick<LeadView, "stage" | "waitingSeconds" | "firstReplySeconds">,
) {
  if (lead.stage === "won" || lead.stage === "lost")
    return lead.firstReplySeconds === null ? "closed_unanswered" : "closed";
  return lead.waitingSeconds === null ? "replied" : "waiting";
}
export function needsLookHref(filters: LeadFilters) {
  return (
    "/leads?" +
    new URLSearchParams(
      Object.entries({ ...filters, page: 1, state: "needs_look" })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    )
  );
}
