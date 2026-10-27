"use client";
import { useRef, useState, useTransition } from "react";
import { useHydrated } from "@/components/chat/use-hydrated";
import { useRouter } from "next/navigation";
import type { LeadActions } from "@/features/chat/actions/commands";
import type { RequestDetails } from "@/features/chat/actions/schemas";
import { businessActionAction } from "@/features/chat/actions/server-actions";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { Button } from "@/components/ui/button";
import { fieldClass } from "./workspace";

export function LeadBusinessActions({
  data,
  owners,
  onSaved,
}: {
  data: LeadActions;
  owners: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    router = useRouter();
  const ready = useHydrated();
  const command = useRef<ReturnType<
    typeof createConfirmedCommand<
      Awaited<ReturnType<typeof businessActionAction>>
    >
  > | null>(null);
  function submit(
    kind: "request" | "workflow" | "task" | "supplemental",
    body: unknown,
  ) {
    command.current ??= createConfirmedCommand(businessActionAction, () =>
      crypto.randomUUID(),
    );
    setMessage("");
    start(async () => {
      const result = await command.current!.run({ kind, body });
      setMessage(result.message);
      if (result.ok) {
        if (onSaved) onSaved();
        else router.refresh();
      }
    });
  }
  const latest = data.messages[0]?.id;
  return (
    <section aria-label="Requests and follow-up" className="min-w-0 space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Requests and follow-up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review customer details here. Send all customer replies in Chatwoot.
          Operational actions need separate staff approval.
        </p>
      </div>
      {message ? (
        <p role="status" className="rounded-md border p-3 text-sm">
          {message}
        </p>
      ) : null}
      <fieldset disabled={!ready || pending} className="min-w-0 space-y-5">
        {data.configuration.canBook && data.configuration.capability ? (
          <details className="border-b pb-4">
            <summary className="cursor-pointer py-2 font-medium">
              Add a customer request
            </summary>
            <RequestForm
              data={data}
              onSave={(input) =>
                submit("request", {
                  action: "request.save",
                  input: {
                    ...input,
                    leadId: data.leadId,
                    capability: data.configuration.capability,
                  },
                })
              }
            />
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">
            Requests are unavailable until the owner enables this channel and
            publishes booking configuration.
          </p>
        )}
        {data.deliveries.map((d) => (
          <article key={d.id} className="space-y-2 border-b pb-4">
            <h3 className="font-medium">
              {d.kind === "price_image"
                ? "Requested price list"
                : "Neutral review request"}
            </h3>
            <p className="whitespace-pre-wrap break-words text-sm">{d.text}</p>
            {d.assetUrl ? (
              <a
                href={d.assetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
              >
                Preview approved image
              </a>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {d.state === "draft" && !d.eligible
                ? "Waiting for the text reply to be sent or delivery eligibility to be confirmed."
                : d.state.replaceAll("_", " ")}
            </p>
            {d.state === "draft" ? (
              <Button
                type="button"
                size="sm"
                disabled={!d.eligible}
                onClick={() => submit("supplemental", d.id)}
              >
                Approve and send{" "}
                {d.kind === "price_image" ? "image" : "review request"}
              </Button>
            ) : null}
          </article>
        ))}
        {data.requests.map((request) => (
          <article
            key={request.id + ":" + request.version}
            className="space-y-3 border-b pb-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">
                {request.capability === "laundry_pickup"
                  ? "Pickup request"
                  : "Callback request"}
              </h3>
              <span className="text-sm">
                {request.status.replaceAll("_", " ")}
              </span>
            </div>
            <dl className="space-y-1 text-sm">
              {Object.entries(request.details)
                .filter(([, value]) => value !== null && value !== "")
                .map(([key, value]) => (
                  <div key={key} className="break-words">
                    <dt className="inline font-medium capitalize">
                      {key === "timePreference" ? "Preferred time" : key}:{" "}
                    </dt>
                    <dd className="inline">
                      {Array.isArray(value)
                        ? value
                            .map(
                              (key) =>
                                data.configuration.services.find(
                                  (s) => s.key === key,
                                )?.name ?? key,
                            )
                            .join(", ")
                        : value}
                    </dd>
                  </div>
                ))}
            </dl>
            {request.status === "materialized" ? (
              <>
                <p className="text-sm">
                  Recorded in operations. Changes and cancellations need a
                  person to review the operational record.
                </p>
                <Button
                  variant="outline"
                  disabled={!latest}
                  onClick={() =>
                    submit("workflow", {
                      action: "change",
                      input: {
                        id: request.id,
                        version: request.version,
                        messageId: latest,
                      },
                    })
                  }
                >
                  Create change handoff
                </Button>
              </>
            ) : request.status !== "withdrawn" ? (
              <>
                {request.reviewText ? (
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">
                      {request.reviewText}
                    </p>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            request.reviewText!,
                          );
                          setMessage(
                            "Summary copied. Paste and send it in the Chatwoot Reply box, then wait for customer confirmation.",
                          );
                        } catch {
                          setMessage(
                            "Copy was unavailable. Select the summary and copy it into Chatwoot.",
                          );
                        }
                      }}
                    >
                      Copy summary for Chatwoot
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() =>
                      submit("workflow", {
                        action: "review",
                        input: { id: request.id, version: request.version },
                      })
                    }
                  >
                    Prepare confirmation summary
                  </Button>
                )}
                {request.reviewText && request.status === "requested" ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      submit("workflow", {
                        action: "confirm",
                        input: {
                          id: request.id,
                          version: request.version,
                          messageId: String(form.get("messageId")),
                        },
                      });
                    }}
                  >
                    <p className="text-sm">
                      Send the exact summary in Chatwoot first. The customer
                      must then reply with a configured confirmation phrase.
                    </p>
                    <MessageSelect data={data} />
                    <Button type="submit">Record customer confirmation</Button>
                  </form>
                ) : null}
                {request.status === "customer_confirmed" ? (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      submit("workflow", {
                        action: "approve",
                        input: {
                          id: request.id,
                          version: request.version,
                          countryCode:
                            request.capability === "laundry_pickup"
                              ? String(form.get("countryCode")).toUpperCase()
                              : null,
                        },
                      });
                    }}
                  >
                    <p className="text-sm">
                      Customer confirmation recorded. Approval creates{" "}
                      {request.capability === "laundry_pickup"
                        ? "a native pickup request awaiting operational scheduling"
                        : "a follow-up task; it does not reserve an appointment"}
                      .
                    </p>
                    {request.capability === "laundry_pickup" ? (
                      <label className="block text-sm">
                        Confirmed address country (two-letter code)
                        <input
                          name="countryCode"
                          className={fieldClass}
                          required
                          pattern="[A-Za-z]{2}"
                          maxLength={2}
                          placeholder="e.g. IN"
                        />
                      </label>
                    ) : null}
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" required className="mt-1 size-5" />
                      I reviewed the current details and approve creating this
                      operational record.
                    </label>
                    <Button type="submit">
                      Approve and create{" "}
                      {request.capability === "laundry_pickup"
                        ? "pickup request"
                        : "follow-up task"}
                    </Button>
                  </form>
                ) : null}
                <details>
                  <summary className="cursor-pointer py-2 text-sm font-medium">
                    Edit or withdraw pending request
                  </summary>
                  <p className="mb-2 text-sm">
                    Editing clears the prior summary and confirmation.
                  </p>
                  <RequestForm
                    data={data}
                    initial={request.details}
                    onSave={(input) =>
                      submit("request", {
                        action: "request.revise",
                        input: {
                          ...input,
                          id: request.id,
                          version: request.version,
                        },
                      })
                    }
                  />
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() =>
                      submit("request", {
                        action: "request.withdraw",
                        input: { id: request.id, version: request.version },
                      })
                    }
                  >
                    Withdraw pending request
                  </Button>
                </details>
              </>
            ) : null}
          </article>
        ))}
        {!data.requests.length ? (
          <p className="text-sm text-muted-foreground">
            No customer requests recorded.
          </p>
        ) : null}
        {data.totalRequests > data.requests.length ? (
          <p className="text-sm">
            Latest {data.requests.length} of {data.totalRequests} requests.
          </p>
        ) : null}
        <div className="space-y-3">
          <h3 className="font-medium">Team follow-up</h3>
          {data.tasks.map((task) => (
            <article
              key={task.id + ":" + task.version}
              className="space-y-3 border-b pb-4"
            >
              <p className="text-sm font-medium">
                {task.kind === "CHAT_HANDOFF" ? "Customer handoff" : "Callback"}{" "}
                · {task.status.toLowerCase().replaceAll("_", " ")}
              </p>
              <p className="text-sm">
                {task.assignedUserId
                  ? (owners.find((owner) => owner.id === task.assignedUserId)
                      ?.name ?? "Assigned team member")
                  : task.assignedTeamId
                    ? "Assigned team"
                    : "Unassigned — needs a team member"}
              </p>
              {task.reasons.length ? (
                <p className="text-sm">
                  {[
                    ...new Set(
                      task.reasons.map((r) => r.reason.replaceAll("_", " ")),
                    ),
                  ].join(", ")}
                </p>
              ) : null}
              {!["COMPLETED", "CANCELLED"].includes(task.status) ? (
                <>
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit("task", {
                        action: "assign",
                        input: {
                          id: task.id,
                          version: task.version,
                          userId: String(
                            new FormData(event.currentTarget).get("owner"),
                          ),
                          teamId: null,
                        },
                      });
                    }}
                  >
                    <label className="min-w-0 flex-1 text-sm">
                      Assign to
                      <select
                        className={fieldClass}
                        name="owner"
                        required
                        defaultValue={task.assignedUserId ?? ""}
                      >
                        <option value="">Choose a team member</option>
                        {owners.map((owner) => (
                          <option key={owner.id} value={owner.id}>
                            {owner.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="submit"
                      variant="outline"
                      className="self-end"
                    >
                      Assign
                    </Button>
                  </form>
                  <Button
                    variant="outline"
                    onClick={() =>
                      submit("task", {
                        action: "complete",
                        input: { id: task.id, version: task.version },
                      })
                    }
                  >
                    Mark follow-up complete
                  </Button>
                </>
              ) : null}
            </article>
          ))}
          {!data.tasks.length ? (
            <p className="text-sm text-muted-foreground">
              No team follow-up tasks.
            </p>
          ) : null}
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              submit("task", {
                action: "handoff",
                input: {
                  leadId: data.leadId,
                  messageId: String(form.get("messageId")),
                  reason: String(form.get("reason")),
                },
              });
            }}
          >
            <MessageSelect data={data} />
            <label className="block text-sm">
              Reason
              <select className={fieldClass} name="reason">
                {[
                  "staff_requested",
                  "complaint",
                  "payment_claim",
                  "dues",
                  "unreadable",
                  "operational_change",
                ].map((reason) => (
                  <option key={reason} value={reason}>
                    {reason.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" disabled={!latest}>
              Create team handoff
            </Button>
          </form>
        </div>
      </fieldset>
      {pending ? (
        <p role="status" className="text-sm">
          Saving…
        </p>
      ) : null}
    </section>
  );
}
function MessageSelect({
  data,
  onChange,
}: {
  data: LeadActions;
  onChange?: (id: string) => void;
}) {
  return (
    <label className="block min-w-0 text-sm">
      Customer message
      <select
        className={fieldClass + " max-w-full"}
        name="messageId"
        required
        onChange={(event) => onChange?.(event.target.value)}
      >
        {data.messages.map((message) => (
          <option key={message.id} value={message.id}>
            {message.content?.slice(0, 90) || "Customer attachment"} ·{" "}
            {new Date(message.created_at).toLocaleString()}
          </option>
        ))}
      </select>
    </label>
  );
}
function RequestForm({
  data,
  initial,
  onSave,
}: {
  data: LeadActions;
  initial?: RequestDetails;
  onSave: (input: {
    sourceMessageId: string;
    evidence: string;
    details: RequestDetails;
  }) => void;
}) {
  const [source, setSource] = useState(data.messages[0]?.id ?? "");
  const message = data.messages.find((message) => message.id === source);
  const nullable = (form: FormData, key: string) =>
    String(form.get(key) || "").trim() || null;
  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          sourceMessageId: source,
          evidence: String(form.get("evidence") || ""),
          details: {
            name: nullable(form, "name"),
            services: form.getAll("services").map(String),
            area: nullable(form, "area"),
            address: nullable(form, "address"),
            date: nullable(form, "date"),
            window: nullable(form, "window"),
            timePreference: nullable(form, "timePreference"),
          },
        });
      }}
    >
      <MessageSelect data={data} onChange={setSource} />
      <label className="block text-sm">
        Exact customer evidence
        <textarea
          key={source}
          name="evidence"
          className={fieldClass + " min-h-20"}
          required
          maxLength={2000}
          defaultValue={message?.content?.slice(0, 2000) ?? ""}
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Requested services</legend>
        {data.configuration.services.map((service) => (
          <label
            key={service.key}
            className="flex items-center gap-2 py-1 text-sm"
          >
            <input
              type="checkbox"
              className="size-5"
              name="services"
              value={service.key}
              defaultChecked={initial?.services.includes(service.key) ?? false}
            />
            {service.name}
          </label>
        ))}
      </fieldset>
      {(["name", "area", "address", "date", "timePreference"] as const).map(
        (key) => (
          <label key={key} className="block text-sm">
            {
              {
                name: "Customer name",
                area: "Area",
                address: "Customer-confirmed address",
                date: "Requested date",
                timePreference: "Preferred callback time",
              }[key]
            }
            <input
              className={fieldClass}
              name={key}
              type={key === "date" ? "date" : "text"}
              maxLength={2000}
              defaultValue={initial?.[key] ?? ""}
            />
          </label>
        ),
      )}
      <label className="block text-sm">
        Requested pickup window
        <select
          name="window"
          className={fieldClass}
          defaultValue={initial?.window ?? ""}
        >
          <option value="">Not provided</option>
          {data.configuration.windows.map((window) => (
            <option key={window.key} value={window.key}>
              {window.label}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={!source}>
        Save provisional request
      </Button>
    </form>
  );
}
