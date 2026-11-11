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
import { SettingsDisclosure } from "@/components/settings/settings-disclosure";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { fieldClass } from "@/components/leads/workspace";
type Feedback = {
  ok: boolean;
  message: string;
  code?: string | null;
  version?: number | null;
  expiresAt?: string | null;
  uncertain?: boolean;
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
    save: (input: unknown, form?: HTMLFormElement) =>
      start(async () => {
        const result = await command.run(input);
        if (result.ok && form) delete form.dataset.unsavedDirty;
        onResult(result);
      }),
  };
}
export function ChatNotificationSettings({
  data,
}: {
  data: NotificationSettings;
}) {
  const router = useRouter();
  const [scheduleFeedback, setScheduleFeedback] = useState<Feedback | null>(
    null,
  );
  const [createFeedback, setCreateFeedback] = useState<Feedback | null>(null);
  const active = data.targets.filter((target) => target.active).length;
  const needsAttention = data.targets.filter(
    (target) => !target.linked || !target.confirmed,
  ).length;
  const latest = data.deliveries[0];
  const pendingDeliveries = data.deliveries.filter(
    (delivery) =>
      delivery.status === "queued" ||
      delivery.status === "sending" ||
      delivery.status === "uncertain",
  ).length;

  return (
    <NotificationTenant.Provider value={data.tenantId}>
      <div className="space-y-7">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold tracking-tight">
              Telegram notifications
            </h3>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {data.deliveryEnabled && data.settings.enabled
                ? "Delivery enabled"
                : "Delivery paused"}
            </span>
          </div>
          <p className="max-w-prose text-sm text-muted-foreground">
            Choose who receives business alerts and daily owner reports.
          </p>
        </header>

        {!data.deliveryEnabled ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Delivery is paused on this installation. You can still prepare
            destinations and preview reports.
          </p>
        ) : null}

        <SettingsDisclosure
          title="Delivery schedule"
          description={
            data.settings.enabled
              ? "Daily report at " +
                data.settings.localTime +
                " · " +
                data.settings.timezone
              : "Business notifications are paused"
          }
          status={data.settings.enabled ? "On" : "Off"}
          defaultOpen={!data.settings.enabled}
        >
          <Schedule
            key={data.settings.version}
            settings={data.settings}
            onResult={setScheduleFeedback}
          />
          <SaveFeedback feedback={scheduleFeedback} />
        </SettingsDisclosure>

        <section aria-labelledby="telegram-destinations" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 id="telegram-destinations" className="font-semibold">
                Recipients
              </h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.targets.length
                  ? active +
                    " enabled" +
                    (needsAttention
                      ? " · " + needsAttention + " need setup"
                      : "")
                  : "Connect a private Telegram account or a staff group."}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 gap-2"
              onClick={() => router.refresh()}
            >
              <RefreshCw className="size-4" aria-hidden /> Refresh status
            </Button>
          </div>

          {data.targets.map((target) => (
            <Target
              key={target.id}
              target={target}
              brands={data.brands}
              deliveryEnabled={data.deliveryEnabled && data.settings.enabled}
            />
          ))}

          <SettingsDisclosure
            title="Add a recipient"
            description="Connect another Telegram account or staff group."
            defaultOpen={!data.targets.length}
          >
            <CreateTarget onResult={setCreateFeedback} />
            <SaveFeedback feedback={createFeedback} />
          </SettingsDisclosure>
        </section>

        <section
          aria-label="Delivery history and report preview"
          className="space-y-3 border-t pt-5"
        >
          <SettingsDisclosure
            title="Delivery history"
            description={
              latest
                ? latest.target +
                  " · " +
                  (latest.isSetupTest
                    ? "Setup test"
                    : eventLabels[latest.kind]) +
                  " · " +
                  deliveryLabels[latest.status]
                : "Sent messages and pending delivery receipts appear here."
            }
            status={
              pendingDeliveries ? pendingDeliveries + " to check" : undefined
            }
          >
            {data.deliveries.length ? (
              <ul className="divide-y">
                {data.deliveries.map((delivery) => (
                  <li
                    key={delivery.id}
                    className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {delivery.target}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {delivery.isSetupTest
                          ? "Setup test"
                          : eventLabels[delivery.kind]}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {deliveryLabels[delivery.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No delivery receipts yet.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Unconfirmed deliveries are held for review and are never
              automatically resent.
            </p>
          </SettingsDisclosure>
          <SettingsDisclosure
            title="Preview a daily report"
            description="Review a reporting window before sending anything."
          >
            <ReportPreview end={data.previewEnd} />
          </SettingsDisclosure>
        </section>
      </div>
    </NotificationTenant.Provider>
  );
}

const deliveryLabels = {
  queued: "Queued",
  sending: "Receipt pending",
  sent: "Sent and confirmed",
  uncertain: "Held for review",
  cancelled: "Cancelled",
};

function SaveFeedback({ feedback }: { feedback: Feedback | null }) {
  if (!feedback?.message) return null;
  return (
    <div className="space-y-2">
      <p role={feedback.ok ? "status" : "alert"} className="text-sm">
        {feedback.message}
      </p>
      {feedback.uncertain ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Reload page to check saved changes
        </Button>
      ) : null}
    </div>
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
      data-unsaved-guard="true"
      data-preserve-dirty-on-submit="true"
      onSubmit={(e) => {
        e.preventDefault();
        const element = e.currentTarget;
        const f = new FormData(element);
        save(
          {
            action: "settings",
            input: {
              version: settings.version,
              enabled: f.has("enabled"),
              timezone: String(f.get("timezone")),
              localTime: String(f.get("localTime")),
            },
          },
          element,
        );
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
      data-unsaved-guard="true"
      data-preserve-dirty-on-submit="true"
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        id.current ??= crypto.randomUUID();
        const element = e.currentTarget;
        const f = new FormData(element);
        save(
          {
            action: "create",
            input: { id: id.current, label: String(f.get("label")) },
          },
          element,
        );
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
  deliveryEnabled,
}: {
  target: TargetData;
  brands: NotificationSettings["brands"];
  deliveryEnabled: boolean;
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const router = useRouter();
  // The action revalidates this page. Keep feedback outside the versioned form.
  const command = useSave(setFeedback);
  const code =
    feedback?.code && feedback.version === target.version
      ? feedback.code
      : null;
  const state = !target.linked
    ? "Link account"
    : !target.confirmed
      ? "Confirm account"
      : target.active
        ? "Enabled"
        : "Paused";
  const description = target.linked
    ? (target.kind === "private" ? "Private account" : "Staff group") +
      " ending " +
      target.hint +
      " · " +
      target.events.length +
      " alert types"
    : "Waiting for a Telegram account to connect";
  const testReady =
    deliveryEnabled &&
    target.active &&
    target.confirmed &&
    target.kind === "private" &&
    target.events.includes("new_lead");

  return (
    <SettingsDisclosure
      title={target.label}
      description={description}
      status={
        <span className="inline-flex items-center gap-1.5">
          {target.active ? (
            <CheckCircle2 className="size-3.5" aria-hidden />
          ) : null}
          {state}
        </span>
      }
      defaultOpen={!target.confirmed}
    >
      {!target.linked ? (
        <section className="space-y-3" aria-label="Link this Telegram account">
          <div>
            <h5 className="text-sm font-semibold">Connect Telegram</h5>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              Create a one-time command and ask the recipient to send it to the
              bot from the account they want to connect.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={command.disabled}
            onClick={() =>
              command.save({
                action: "issue",
                input: { id: target.id, version: target.version },
              })
            }
          >
            {command.pending ? "Preparing…" : "Create link code"}
          </Button>
          {target.expiresAt && !code ? (
            <p className="text-sm text-muted-foreground">
              A link command is pending. Use the command you copied, or create a
              replacement.
            </p>
          ) : null}
          {code ? (
            <div className="space-y-3 rounded-lg bg-muted/40 p-3">
              <label className="grid gap-2 text-sm font-medium">
                One-time Telegram link command
                <textarea
                  readOnly
                  value={"/start " + code}
                  className={fieldClass + " min-h-20 break-all"}
                  aria-label="One-time Telegram link command"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Expires{" "}
                {feedback?.expiresAt
                  ? new Date(feedback.expiresAt).toLocaleString()
                  : "in 30 minutes"}
                . Keep this command private.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText("/start " + code);
                      setFeedback((value) =>
                        value
                          ? { ...value, message: "Link command copied." }
                          : value,
                      );
                    } catch {
                      setFeedback((value) =>
                        value
                          ? {
                              ...value,
                              message:
                                "Select the command and copy it manually.",
                            }
                          : value,
                      );
                    }
                  }}
                >
                  Copy link command
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.refresh()}
                >
                  Check for connection
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <TargetForm
        key={target.id + ":" + target.version}
        target={target}
        brands={brands}
        command={command}
      />

      <SaveFeedback
        feedback={
          feedback && (!feedback.code || feedback.version === target.version)
            ? feedback
            : null
        }
      />

      {target.linked ? (
        <section className="space-y-3 border-t pt-4" aria-label="Test delivery">
          <div>
            <h5 className="text-sm font-semibold">Test delivery</h5>
            <p className="mt-1 text-sm text-muted-foreground">
              {!deliveryEnabled
                ? "Delivery is paused. Enable business notifications before sending a test."
                : !target.confirmed
                  ? "Confirm this account and save your settings first."
                  : !target.active
                    ? "Enable this recipient and save your settings first."
                    : target.kind !== "private"
                      ? "Setup tests are available for private accounts."
                      : !target.events.includes("new_lead")
                        ? "Select New enquiry and save your settings to enable the setup test."
                        : "Send a labelled setup message to this recipient. One test is available every 15 minutes."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={command.disabled || !testReady}
            onClick={() =>
              command.save({
                action: "test",
                input: { id: target.id, version: target.version },
              })
            }
          >
            {command.pending ? "Working…" : "Send setup test"}
          </Button>
        </section>
      ) : null}

      {target.linked ? (
        <details className="border-t pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Reconnect this Telegram account
          </summary>
          <div className="space-y-3 pb-1">
            <p className="max-w-prose text-sm text-muted-foreground">
              A replacement command pauses this recipient’s alerts. The newly
              connected account must be confirmed again.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={command.disabled}
              onClick={() =>
                command.save({
                  action: "issue",
                  input: { id: target.id, version: target.version },
                })
              }
            >
              Replace link and pause delivery
            </Button>
          </div>
        </details>
      ) : null}
    </SettingsDisclosure>
  );
}

function TargetForm({
  target,
  brands,
  command,
}: {
  target: TargetData;
  brands: NotificationSettings["brands"];
  command: ReturnType<typeof useSave>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form
      data-unsaved-guard="true"
      data-preserve-dirty-on-submit="true"
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        command.save(
          {
            action: "save",
            input: {
              id: target.id,
              version: target.version,
              label: String(form.get("label")),
              events: form.getAll("events"),
              brandIds: form.getAll("brands"),
              active: form.has("active"),
              confirm: form.has("confirm"),
            },
          },
          element,
        );
      }}
    >
      <fieldset
        disabled={command.disabled}
        aria-busy={command.pending}
        className="space-y-5"
      >
        {target.linked && !target.confirmed ? (
          <section
            className="space-y-3 rounded-lg border border-ring/20 bg-muted/40 p-4"
            aria-label="Confirm the new recipient"
          >
            <div className="flex items-start gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div>
                <h5 className="text-sm font-semibold">
                  Confirm the new recipient
                </h5>
                <p className="mt-1 text-sm text-muted-foreground">
                  Telegram connected a{" "}
                  {target.kind === "private"
                    ? "private account"
                    : "staff group"}{" "}
                  ending {target.hint}. Check that it belongs to the person you
                  intend to notify.
                </p>
              </div>
            </div>
            <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="confirm"
                className="mt-1 size-4 shrink-0"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I checked this account and confirm it is the intended recipient.
            </label>
          </section>
        ) : null}

        <label className="grid max-w-md gap-2 text-sm font-medium">
          Recipient label
          <input
            name="label"
            required
            maxLength={80}
            defaultValue={target.label}
            className={fieldClass}
          />
        </label>

        <fieldset className="space-y-3 border-t pt-4">
          <legend className="text-sm font-semibold">Alerts to send</legend>
          <div className="grid gap-x-5 sm:grid-cols-2">
            {(Object.entries(eventLabels) as [Event, string][]).map(
              ([event, label]) => (
                <label
                  key={event}
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-sm has-[:disabled]:cursor-default has-[:disabled]:text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={event}
                    defaultChecked={target.events.includes(event)}
                    className="size-4"
                    disabled={
                      event === "daily_summary" && target.kind !== "private"
                    }
                  />
                  {label}
                </label>
              ),
            )}
          </div>
          <p className="max-w-prose text-xs text-muted-foreground">
            Daily reports are available to private owner accounts. Group alerts
            exclude customer messages, contact details, and financial amounts.
          </p>
        </fieldset>

        {brands.length ? (
          <fieldset className="space-y-2 border-t pt-4">
            <legend className="text-sm font-semibold">Brands to include</legend>
            <p className="text-xs text-muted-foreground">
              Leave all unchecked to include every brand.
            </p>
            <div className="flex flex-wrap gap-x-6">
              {brands.map((brand) => (
                <label
                  key={brand.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="brands"
                    value={brand.id}
                    defaultChecked={target.brandIds.includes(brand.id)}
                    className="size-4"
                  />
                  {brand.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="space-y-2 border-t pt-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium has-[:disabled]:cursor-default has-[:disabled]:text-muted-foreground">
            <input
              type="checkbox"
              name="active"
              defaultChecked={target.active}
              className="size-4"
              disabled={!target.linked || (!target.confirmed && !confirmed)}
            />
            Enable selected events for this destination
          </label>
          {!target.linked ? (
            <p className="text-xs text-muted-foreground">
              Link Telegram above before enabling delivery.
            </p>
          ) : !target.confirmed && !confirmed ? (
            <p className="text-xs text-muted-foreground">
              Confirm the recipient above to enable alerts.
            </p>
          ) : null}
          <Button type="submit" className="min-h-11">
            {command.pending
              ? "Saving…"
              : !target.confirmed && confirmed
                ? "Confirm and save destination"
                : "Save destination"}
          </Button>
        </div>
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
    <section className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const element = e.currentTarget;
          const f = new FormData(element);
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
