"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChatForm, ChatSelect, field } from "./setup-form";
import type { ChatActionResult } from "@/features/chat/actions";
import type { StaffLinkChoices } from "@/features/chat/staff-links";
export type StaffLinkActions = {
  loadStaff: (
    input: unknown,
  ) => Promise<
    { ok: true; choices: StaffLinkChoices } | { ok: false; message: string }
  >;
  linkStaff: (input: unknown, key: string) => Promise<ChatActionResult>;
};
export function StaffLinks({
  scope,
  loadStaff,
  linkStaff,
}: {
  scope: { tenantId: string; workspaceId: string; accountId: number };
} & StaffLinkActions) {
  const [choices, setChoices] = useState<StaffLinkChoices | null>(null),
    [error, setError] = useState<string | null>(null),
    [selected, setSelected] = useState({ profile: "", nativeUser: "" }),
    [pending, start] = useTransition();
  return (
    <details className="rounded-md border p-3">
      <summary className="min-h-11 cursor-pointer text-sm">
        Link staff logins
      </summary>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose an existing OS PLUS staff profile and its matching Chatwoot
          login. This records who replies; it does not change anyone’s role or
          create a login.
        </p>
        <Button
          type="button"
          className="min-h-11"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setChoices(null);
              setSelected({ profile: "", nativeUser: "" });
              try {
                const r = await loadStaff(scope);
                if (r.ok) setChoices(r.choices);
                else setError(r.message);
              } catch {
                setError("Staff could not be loaded. Try again.");
              }
            })
          }
        >
          {pending ? "Loading…" : "Load staff from this account"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {choices && (
          <>
            <ul className="space-y-2 text-sm">
              {choices.profiles
                .filter((p) => p.linkedUserId !== null)
                .map((p) => (
                  <li key={p.id} className="break-words">
                    {p.name} · Linked to Chatwoot user {p.linkedUserId}
                  </li>
                ))}
            </ul>
            {choices.profiles.some((p) => p.linkedUserId === null) &&
            choices.users.length > 0 ? (
              <ChatForm
                label="Verify and link staff login"
                save={(d, key) =>
                  linkStaff(
                    {
                      ...scope,
                      tenantUserId: field(d, "profile"),
                      chatwootUserId: Number(field(d, "nativeUser")),
                    },
                    key,
                  )
                }
                resetOnSuccess
                onResult={(result) => {
                  if (result.ok) setSelected({ profile: "", nativeUser: "" });
                }}
              >
                <div
                  className="grid gap-4 sm:grid-cols-2"
                  onChange={(event) => {
                    if (event.target instanceof HTMLSelectElement) {
                      const { name, value } = event.target;
                      setSelected((previous) => ({
                        ...previous,
                        [name]: value,
                      }));
                    }
                  }}
                >
                  <div className="min-w-0">
                    <ChatSelect label="OS PLUS staff profile" name="profile">
                      <option value="">Choose a staff profile</option>
                      {choices.profiles
                        .filter((p) => p.linkedUserId === null)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.email} ·{" "}
                            {p.role === "owner_admin"
                              ? "Owner/Admin"
                              : "Manager"}
                          </option>
                        ))}
                    </ChatSelect>
                    {selected.profile && (
                      <p className="mt-2 break-all text-sm">
                        {
                          choices.profiles.find(
                            (p) => p.id === selected.profile,
                          )?.email
                        }
                      </p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <ChatSelect label="Chatwoot login" name="nativeUser">
                      <option value="">Choose its matching login</option>
                      {choices.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.email} · {u.role}
                        </option>
                      ))}
                    </ChatSelect>
                    {selected.nativeUser && (
                      <p className="mt-2 break-all text-sm">
                        {
                          choices.users.find(
                            (u) => u.id === Number(selected.nativeUser),
                          )?.email
                        }
                      </p>
                    )}
                  </div>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" required />I checked that these are the
                  same person.
                </label>
              </ChatForm>
            ) : (
              <p className="text-sm">
                No unlinked eligible staff profiles or available Chatwoot
                logins. Reload the list after saving a link.
              </p>
            )}
          </>
        )}
      </div>
    </details>
  );
}
