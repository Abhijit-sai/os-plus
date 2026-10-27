"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type { NotificationSettings } from "@/features/chat/notifications/schemas";
import {
  configureNotificationAction,
  previewNotificationAction,
} from "@/features/chat/notifications/server-actions";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { useHydrated } from "./use-hydrated";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass } from "@/components/leads/workspace";
type Feedback = {
  ok: boolean;
  message: string;
  code?: string | null;
  version?: number | null;
  expiresAt?: string | null;
};
const eventLabels = {
  booking_request: "New provisional request",
  handoff: "Staff handoff",
  payment_claim: "Payment claim",
  agent_failure: "Reply assistance failure",
  daily_summary: "Daily owner report",
  new_lead: "New enquiry",
};
type Event = keyof typeof eventLabels;
const NotificationTenant = createContext<string | null>(null);
function useNotificationTenant() {
  const tenant = useContext(NotificationTenant);
  if (!tenant) throw new Error("Notification business context unavailable.");
  return tenant;
}
function useSave(onResult: (result: Feedback) => void) {
  const tenantId = useNotificationTenant();
  const [pending, start] = useTransition(),
    hydrated = useHydrated();
  const [command] = useState(() =>
    createConfirmedCommand(
      (input, key) => configureNotificationAction(input, key, tenantId),
      () => crypto.randomUUID(),
    ),
  );
  return {
    disabled: pending || !hydrated,
    pending,
    save: (input: unknown) =>
      start(async () => onResult(await command.run(input))),
  };
}
export function ChatNotificationSettings({
  data,
}: {
  data: NotificationSettings;
}) {
  const router = useRouter(),
    [message, setMessage] = useState("");
  return (
    <NotificationTenant.Provider value={data.tenantId}>
      <Card>
        <CardHeader>
          <CardTitle>Telegram notifications</CardTitle>
          <p className="text-sm text-muted-foreground">
            Owner reports and staff alerts. Chatwoot remains the place to reply
            to customers.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {!data.deliveryEnabled ? (
            <p role="status" className="text-sm">
              Delivery is paused on this installation. You can prepare settings
              and preview reports.
            </p>
          ) : null}
          <Schedule
            key={data.settings.version}
            settings={data.settings}
            onResult={(r) => setMessage(r.message)}
          />
          {message ? (
            <p role="status" className="text-sm">
              {message}
            </p>
          ) : null}
          <CreateTarget onResult={(r) => setMessage(r.message)} />
          {!data.targets.length ? (
            <p className="text-sm text-muted-foreground">
              No destinations yet. Add a label, link the destination, then
              confirm which alerts it may receive.
            </p>
          ) : null}
          {data.targets.map((target) => (
            <Target key={target.id} target={target} brands={data.brands} />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.refresh()}
          >
            Refresh link and delivery status
          </Button>
          {data.deliveries.length ? (
            <section className="space-y-2 border-t pt-5">
              <h3 className="font-medium">Recent deliveries</h3>
              <ul className="space-y-3 text-sm">
                {data.deliveries.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-1 sm:flex-row sm:justify-between"
                  >
                    <span>
                      {d.target} · {eventLabels[d.kind]}
                    </span>
                    <span>
                      {
                        {
                          queued: "Queued",
                          sending: "Receipt pending",
                          sent: "Sent and confirmed",
                          uncertain: "Held — delivery unconfirmed",
                          cancelled: "Cancelled",
                        }[d.status]
                      }
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                Unconfirmed deliveries are held for review and are never
                automatically resent.
              </p>
            </section>
          ) : null}
          <ReportPreview end={data.previewEnd} />
        </CardContent>
      </Card>
    </NotificationTenant.Provider>
  );
}
function Schedule({
  settings,
  onResult,
}: {
  settings: NotificationSettings["settings"];
  onResult: (r: Feedback) => void;
}) {
  const { disabled, pending, save } = useSave(onResult);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          action: "settings",
          input: {
            version: settings.version,
            enabled: f.has("enabled"),
            timezone: String(f.get("timezone")),
            localTime: String(f.get("localTime")),
          },
        });
      }}
    >
      <fieldset
        disabled={disabled}
        aria-busy={pending}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
          />
          Enable this business’s notifications
        </label>
        <label className="space-y-1 text-sm">
          Reporting timezone
          <input
            name="timezone"
            className={fieldClass}
            required
            maxLength={100}
            defaultValue={settings.timezone}
          />
        </label>
        <label className="space-y-1 text-sm">
          Daily report time
          <input
            name="localTime"
            type="time"
            className={fieldClass}
            required
            defaultValue={settings.localTime}
          />
        </label>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Reports cover the period since the previous cutoff and show their
          exact window. A newly enabled destination starts at the next cutoff.
        </p>
        <Button type="submit" className="min-h-11 justify-self-start">
          {pending ? "Saving…" : "Save notification schedule"}
        </Button>
      </fieldset>
    </form>
  );
}
function CreateTarget({ onResult }: { onResult: (r: Feedback) => void }) {
  const id = useRef<string | null>(null),
    form = useRef<HTMLFormElement | null>(null),
    { disabled, pending, save } = useSave((r) => {
      if (r.ok) {
        id.current = null;
        form.current?.reset();
      }
      onResult(r);
    });
  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        id.current ??= crypto.randomUUID();
        const f = new FormData(e.currentTarget);
        save({
          action: "create",
          input: { id: id.current, label: String(f.get("label")) },
        });
      }}
    >
      <fieldset
        disabled={disabled}
        aria-busy={pending}
        className="flex flex-col items-start gap-3 sm:flex-row sm:items-end"
      >
        <label className="w-full space-y-1 text-sm sm:max-w-sm">
          Destination label
          <input
            name="label"
            required
            maxLength={80}
            className={fieldClass}
            placeholder="For example, owner reports"
          />
        </label>
        <Button type="submit" className="min-h-11">
          {pending ? "Adding…" : "Add destination"}
        </Button>
      </fieldset>
    </form>
  );
}
type TargetData = NotificationSettings["targets"][number];
function Target({
  target,
  brands,
}: {
  target: TargetData;
  brands: NotificationSettings["brands"];
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null),
    router = useRouter();
  const code =
    feedback?.code && feedback.version === target.version
      ? feedback.code
      : null;
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="font-medium">{target.label}</h3>
      <p className="text-sm text-muted-foreground">
        {target.linked
          ? (target.kind === "private"
              ? "Private destination"
              : "Staff group") +
            " ending " +
            target.hint +
            (target.active
              ? " · Enabled"
              : target.confirmed
                ? " · Paused"
                : " · Awaiting owner confirmation")
          : "Not linked · Paused"}
      </p>
      <TargetForm
        key={target.id + ":" + target.version}
        target={target}
        brands={brands}
        onResult={setFeedback}
      />
      {code ? (
        <div className="space-y-2">
          <label className="block space-y-1 text-sm">
            Send this command to the platform bot in the intended private chat
            or staff group
            <textarea
              readOnly
              value={"/start " + code}
              className={fieldClass + " min-h-20 break-all"}
              aria-label="One-time Telegram link command"
            />
          </label>
          <p className="text-sm">
            Expires{" "}
            {feedback?.expiresAt
              ? new Date(feedback.expiresAt).toLocaleString()
              : "in 30 minutes"}
            . Keep this code private. Linking alone does not enable delivery.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText("/start " + code);
                setFeedback((f) =>
                  f ? { ...f, message: "Link command copied." } : f,
                );
              } catch {
                setFeedback((f) =>
                  f
                    ? {
                        ...f,
                        message:
                          "Copy was unavailable. Select the command and copy it manually.",
                      }
                    : f,
                );
              }
            }}
          >
            Copy link command
          </Button>
        </div>
      ) : null}
      {feedback?.message &&
      (!feedback.code || feedback.version === target.version) ? (
        <p role="status" className="text-sm">
          {feedback.message}
        </p>
      ) : null}
      {target.expiresAt && !code && !target.linked ? (
        <p className="text-sm">
          A link code is pending. Use the command you already copied, or create
          a replacement.
        </p>
      ) : null}
      {target.linked && !target.confirmed ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => router.refresh()}
        >
          Refresh before confirming
        </Button>
      ) : null}
    </section>
  );
}
function TargetForm({
  target,
  brands,
  onResult,
}: {
  target: TargetData;
  brands: NotificationSettings["brands"];
  onResult: (r: Feedback) => void;
}) {
  const { disabled, pending, save } = useSave(onResult);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          action: "save",
          input: {
            id: target.id,
            version: target.version,
            label: String(f.get("label")),
            events: f.getAll("events"),
            brandIds: f.getAll("brands"),
            active: f.has("active"),
            confirm: f.has("confirm"),
          },
        });
      }}
    >
      <fieldset disabled={disabled} aria-busy={pending} className="space-y-4">
        <label className="block max-w-sm space-y-1 text-sm">
          Label
          <input
            name="label"
            required
            maxLength={80}
            defaultValue={target.label}
            className={fieldClass}
          />
        </label>
        <fieldset className="grid gap-x-6 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">Allowed events</legend>
          {(Object.entries(eventLabels) as [Event, string][]).map(
            ([event, label]) => (
              <label
                key={event}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="events"
                  value={event}
                  defaultChecked={target.events.includes(event)}
                  disabled={
                    event === "daily_summary" && target.kind !== "private"
                  }
                />
                {label}
              </label>
            ),
          )}
        </fieldset>
        <p className="text-sm text-muted-foreground">
          Daily reports require a private owner destination. Staff group alerts
          contain no customer messages, contact details or financial amounts.
        </p>
        {brands.length ? (
          <fieldset className="grid gap-x-6 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">
              Brand filter — leave empty for all brands
            </legend>
            {brands.map((b) => (
              <label
                key={b.id}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="brands"
                  value={b.id}
                  defaultChecked={target.brandIds.includes(b.id)}
                />
                {b.name}
              </label>
            ))}
          </fieldset>
        ) : null}
        {target.linked && !target.confirmed ? (
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" className="mt-1" />I checked
            the destination type and ending above and confirm it is the intended
            recipient.
          </label>
        ) : null}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={target.active}
            disabled={!target.linked}
          />
          Enable selected events for this destination
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="min-h-11">
            {pending ? "Saving…" : "Save destination"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() =>
              save({
                action: "issue",
                input: { id: target.id, version: target.version },
              })
            }
          >
            {target.linked
              ? "Replace link and pause delivery"
              : "Create link code"}
          </Button>
        </div>
        {target.linked ? (
          <p className="text-sm text-muted-foreground">
            Replacing the link immediately pauses delivery and requires fresh
            confirmation.
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
function ReportPreview({ end }: { end: string }) {
  const tenantId = useNotificationTenant();
  const [result, setResult] = useState<{
      ok: boolean;
      message: string;
      text: string | null;
    } | null>(null),
    [pending, start] = useTransition(),
    hydrated = useHydrated();
  const [now] = useState(() => new Date(end));
  return (
    <section className="space-y-3 border-t pt-5">
      <h3 className="font-medium">Preview an owner report</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            try {
              setResult(
                await previewNotificationAction(
                  {
                    windowStart: new Date(
                      String(f.get("start")) + "Z",
                    ).toISOString(),
                    windowEnd: new Date(
                      String(f.get("end")) + "Z",
                    ).toISOString(),
                    brandIds: [],
                  },
                  tenantId,
                ),
              );
            } catch {
              setResult({
                ok: false,
                message: "Check both UTC dates and try again.",
                text: null,
              });
            }
          });
        }}
      >
        <fieldset
          disabled={pending || !hydrated}
          aria-busy={pending}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="space-y-1 text-sm">
            Window start (UTC)
            <input
              type="datetime-local"
              name="start"
              required
              className={fieldClass}
              defaultValue={new Date(now.getTime() - 86400000)
                .toISOString()
                .slice(0, 16)}
            />
          </label>
          <label className="space-y-1 text-sm">
            Window end (UTC)
            <input
              type="datetime-local"
              name="end"
              required
              className={fieldClass}
              defaultValue={now.toISOString().slice(0, 16)}
            />
          </label>
          <Button
            type="submit"
            variant="outline"
            className="min-h-11 justify-self-start"
          >
            {pending ? "Loading…" : "Preview without sending"}
          </Button>
        </fieldset>
      </form>
      {result ? (
        <p role={result.ok ? "status" : "alert"} className="text-sm">
          {result.message}
        </p>
      ) : null}
      {result?.text ? (
        <pre className="max-h-[36rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border p-3 font-sans text-sm">
          {result.text}
        </pre>
      ) : null}
    </section>
  );
}
