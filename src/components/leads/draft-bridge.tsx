"use client";
import { useEffect } from "react";
import { staffDraftRequestSchema } from "@/features/chat/agent/staff-draft-schema";
import { staffDraftAction } from "@/features/chat/agent/staff-draft-actions";
/** Existing origin-bound, authenticated enquiry-card frame; no tokens leave OS PLUS. */
export function DraftBridge({
  origin,
  accountId,
}: {
  origin: string;
  accountId: number;
}) {
  useEffect(() => {
    if (window.parent === window) return;
    let active = true;
    const listener = async (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== origin) return;
      const parsed = staffDraftRequestSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.input.accountId !== accountId) return;
      const { requestId, action, input } = parsed.data;
      const result = await staffDraftAction(action, input);
      if (active)
        window.parent.postMessage(
          { type: "osplus-draft-response", requestId, ...result },
          origin,
        );
    };
    window.addEventListener("message", listener);
    window.parent.postMessage(
      { type: "osplus-draft-ready", version: 1 },
      origin,
    );
    return () => {
      active = false;
      window.removeEventListener("message", listener);
    };
  }, [origin, accountId]);
  return null;
}
