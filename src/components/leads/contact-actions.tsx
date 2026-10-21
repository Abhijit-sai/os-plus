"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { saveLeadAction } from "@/features/leads/actions";
import type { projectContact } from "@/features/leads/pii";
import { Button } from "@/components/ui/button";
import { fieldClass } from "./workspace";
type Contact = ReturnType<typeof projectContact>;
function useCommand() {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    command = useRef<ReturnType<typeof createConfirmedCommand> | null>(null),
    router = useRouter();
  return {
    pending,
    message,
    run: (input: unknown) => {
      command.current ??= createConfirmedCommand(saveLeadAction, () =>
        crypto.randomUUID(),
      );
      setMessage("");
      start(async () => {
        const result = await command.current!.run(input);
        setMessage(result.message);
        if (result.ok) {
          router.refresh();
        }
      });
    },
  };
}
export function CustomerContactActions({
  contact,
  matches,
}: {
  contact: Contact;
  matches: { id: string; name: string }[];
}) {
  const command = useCommand(),
    phone =
      contact.identities.find((i) => i.kind === "phone" && i.verified)?.value ||
      "";
  return (
    <div className="space-y-5">
      {matches.length ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            command.run({
              action: "contact.link",
              input: {
                contactId: contact.id,
                customerId: new FormData(event.currentTarget).get("customerId"),
              },
            });
          }}
        >
          <label className="block text-sm">
            Exact phone match
            <select
              className={fieldClass}
              name="customerId"
              disabled={command.pending}
            >
              {matches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={command.pending}>Link existing customer</Button>
        </form>
      ) : null}
      <details>
        <summary className="cursor-pointer py-3 font-medium">
          Create or reuse customer
        </summary>
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget),
              country = String(form.get("countryCode") || "")
                .trim()
                .toUpperCase();
            command.run({
              action: "contact.convert",
              input: {
                contactId: contact.id,
                name: form.get("name"),
                phone: form.get("phone") || null,
                email: form.get("email") || null,
                ...(country ? { countryCode: country } : {}),
              },
            });
          }}
        >
          <p className="text-sm text-muted-foreground">
            A matching customer phone reuses the existing record. Other customer
            details stay unchanged.
          </p>
          <label className="block text-sm">
            Customer name
            <input
              className={fieldClass}
              name="name"
              minLength={2}
              maxLength={200}
              required
              defaultValue={
                contact.name === "Unnamed contact" ? "" : contact.name
              }
              disabled={command.pending}
            />
          </label>
          <label className="block text-sm">
            Phone, including country code
            <input
              className={fieldClass}
              name="phone"
              type="tel"
              maxLength={40}
              defaultValue={phone}
              disabled={command.pending}
            />
          </label>
          <label className="block text-sm">
            Country, if using a national number
            <input
              className={fieldClass}
              name="countryCode"
              maxLength={2}
              placeholder="Two-letter country code"
              disabled={command.pending}
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              className={fieldClass}
              name="email"
              type="email"
              maxLength={320}
              disabled={command.pending}
            />
          </label>
          <Button disabled={command.pending}>
            {command.pending ? "Saving…" : "Save customer link"}
          </Button>
        </form>
      </details>
      {command.message ? (
        <p role="status" className="text-sm">
          {command.message}
        </p>
      ) : null}
    </div>
  );
}
export function MergeContactActions({
  contact,
  candidates,
  total,
}: {
  contact: Contact;
  candidates: Contact[];
  total: number;
}) {
  const command = useCommand(),
    [selected, setSelected] = useState(""),
    [reviewed, setReviewed] = useState(false);
  const other = candidates.find((c) => c.id === selected);
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Merge only after confirming both records belong to the same person. This
        contact remains the main record. Customer links must agree.
      </p>
      <form className="flex flex-wrap gap-2">
        <label className="min-w-0 flex-1 text-sm">
          Find another contact
          <input className={fieldClass} name="mergeQ" maxLength={100} />
        </label>
        <Button type="submit" variant="outline">
          Find
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Showing up to 50 of {total} contacts. Refine the name or phone search if
        needed.
      </p>
      <label className="block text-sm">
        Contact to merge into this record
        <select
          className={fieldClass}
          value={selected}
          onChange={(event) => {
            setSelected(event.target.value);
            setReviewed(false);
          }}
          disabled={command.pending}
        >
          <option value="">Choose a contact</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ·{" "}
              {c.identities.find((i) => i.kind === "phone")?.value ||
                "No verified phone"}
            </option>
          ))}
        </select>
      </label>
      {other ? (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p>
            {other.name} → {contact.name}
          </p>
          <p>
            {other.linked
              ? "The selected contact is linked to a customer."
              : "The selected contact has no customer link."}
          </p>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I reviewed both records and their identities
          </label>
        </div>
      ) : null}
      <Button
        variant="outline"
        disabled={command.pending || !reviewed || !other}
        onClick={() => {
          if (other)
            command.run({
              action: "contact.merge",
              input: {
                fromId: other.id,
                toId: contact.id,
                fromVersion: other.version,
                toVersion: contact.version,
              },
            });
        }}
      >
        {command.pending ? "Merging…" : "Merge reviewed contact"}
      </Button>
      {command.message ? (
        <p role="status" className="text-sm">
          {command.message}
        </p>
      ) : null}
    </div>
  );
}
export function SplitContactAction({ mergeId }: { mergeId: string }) {
  const command = useCommand();
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={command.pending}
        onClick={() =>
          command.run({ action: "contact.split", input: { mergeId } })
        }
      >
        {command.pending ? "Restoring…" : "Undo this merge"}
      </Button>
      {command.message ? (
        <p role="status" className="text-sm">
          {command.message}
        </p>
      ) : null}
    </div>
  );
}
