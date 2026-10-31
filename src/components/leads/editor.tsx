"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { buildLeadEdit } from "@/features/leads/editor-state";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { saveLeadAction } from "@/features/leads/actions";
import type { LeadView } from "@/features/leads/pii";
import { Button } from "@/components/ui/button";
import { fieldClass } from "./workspace";
export function LeadEditor({
  lead,
  owners,
  onSaved,
}: {
  lead: LeadView;
  owners: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [stage, setStage] = useState(lead.stage),
    command = useRef<ReturnType<typeof createConfirmedCommand> | null>(null),
    router = useRouter();
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        command.current ??= createConfirmedCommand(saveLeadAction, () =>
          crypto.randomUUID(),
        );
        setMessage("");
        start(async () => {
          const result = await command.current!.run(
            buildLeadEdit(lead, {
              stage,
              ownerId: String(form.get("ownerId") || ""),
              notes: String(form.get("notes") || ""),
              lostReason: String(form.get("lostReason") || ""),
            }),
          );
          setMessage(result.message);
          if (result.ok) {
            if (onSaved) onSaved();
            else router.refresh();
          }
        });
      }}
    >
      <label className="block text-sm">
        Stage
        <select
          className={fieldClass}
          name="stage"
          value={stage}
          disabled={pending}
          onChange={(event) =>
            setStage(event.target.value as LeadView["stage"])
          }
        >
          {["new", "engaged", "booked", "in_progress", "won", "lost"].map(
            (s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </label>
      {stage === "lost" ? (
        <label className="block text-sm">
          Reason for closing
          <textarea
            className={fieldClass}
            name="lostReason"
            required
            defaultValue={lead.lostReason || ""}
            maxLength={1000}
            disabled={pending}
          />
        </label>
      ) : null}
      <label className="block text-sm">
        Owner
        <select
          className={fieldClass}
          name="ownerId"
          defaultValue={lead.ownerId || ""}
          disabled={pending}
        >
          <option value="">Unassigned</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Internal enquiry notes
        <textarea
          className={fieldClass + " min-h-28"}
          name="notes"
          maxLength={10000}
          defaultValue={"notes" in lead ? lead.notes || "" : ""}
          disabled={pending}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save enquiry"}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}
