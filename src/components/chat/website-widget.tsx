"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ChatSetup } from "@/features/chat/queries";
import { loadWebsiteWidgetAction } from "@/features/chat/website/actions";
export function WebsiteWidget({ data }: { data: ChatSetup }) {
  const channels = data.channels.filter(
    (c) => c.kind === "website" && c.is_active,
  );
  const [selected, setSelected] = useState(
    channels.length === 1 ? channels[0].id : "",
  );
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof loadWebsiteWidgetAction>
  > | null>(null);
  const [copied, setCopied] = useState(false),
    [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold">Website widget</h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Add a Chatwoot chat bubble to a business website. Visitor enquiries
          will appear in Chats and create leads in OS PLUS.
        </p>
      </header>
      {!channels.length ? (
        <div className="space-y-3">
          <p className="text-sm">
            First create a Website inbox in Chatwoot, then connect it to the
            correct brand here.
          </p>
          <Link
            className="inline-flex min-h-11 items-center text-sm underline"
            href="/settings/chat?section=channels"
          >
            Connect a website channel
          </Link>
        </div>
      ) : (
        <>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setResult(null);
              setCopied(false);
              start(async () => {
                setResult(
                  await loadWebsiteWidgetAction({
                    tenantId: data.tenantId,
                    channelId: selected,
                  }),
                );
              });
            }}
          >
            <label
              htmlFor="website-channel"
              className="block text-sm font-medium"
            >
              Website inbox
            </label>
            <select
              id="website-channel"
              value={selected}
              disabled={pending}
              onChange={(event) => {
                setSelected(event.target.value);
                setResult(null);
                setCopied(false);
              }}
              className="min-h-11 w-full rounded-md border bg-background px-3"
              required
            >
              <option value="" disabled>
                Choose a connected website inbox
              </option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ·{" "}
                  {data.brands.find((b) => b.id === c.brand_id)?.name ??
                    "Brand unavailable"}
                </option>
              ))}
            </select>
            <Button
              className="min-h-11"
              type="submit"
              disabled={pending || !selected}
            >
              {pending ? "Loading…" : "Get installation code"}
            </Button>
          </form>
          {result && !result.ok ? (
            <p role="alert" className="text-sm text-destructive">
              {result.message}
            </p>
          ) : null}
          {result?.ok ? (
            <section
              className="space-y-3"
              aria-label="Website installation code"
            >
              <p className="text-sm font-medium">{result.widget.name}</p>
              <label htmlFor="website-snippet" className="block text-sm">
                Paste this once before the closing body tag on your website.
              </label>
              <textarea
                id="website-snippet"
                readOnly
                value={result.widget.snippet}
                rows={10}
                className="w-full min-w-0 rounded-md border bg-muted p-3 font-mono text-xs"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.widget.snippet);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied" : "Copy code"}
              </Button>
              <p role="status" className="text-sm text-muted-foreground">
                {copied
                  ? "Installation code copied."
                  : "You can also select and copy the code above."}
              </p>
              <p className="text-sm text-muted-foreground">
                This code contains the public website inbox identifier. It
                contains no account API or signing key. Use it only on the
                intended business’s site.
              </p>
              <a
                href={result.widget.settingsUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-11 items-center text-sm font-medium underline"
              >
                Open this inbox’s settings in Chatwoot
                <span className="sr-only"> (new tab)</span>
              </a>
              <p className="text-sm">
                Pre-chat form:{" "}
                {result.widget.preChatEnabled ? "enabled" : "not enabled"}.
                Configure its fields in Chatwoot.
              </p>
            </section>
          ) : null}
        </>
      )}
      <section
        className="space-y-3 border-t pt-5"
        aria-labelledby="website-prechat"
      >
        <h4 id="website-prechat" className="font-medium">
          Before visitors start a chat
        </h4>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            In Chatwoot, open Settings → Inboxes → your Website inbox → Pre Chat
            Form.
          </li>
          <li>
            Ask for a name and, when needed, a phone with its country code. Keep
            general questions available without a phone.
          </li>
          <li>
            A website phone number is unverified. It cannot expose customer
            history or confirm an operational booking. Staff approval and the
            verified-channel flow still apply.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">
          Use a test page first. Check the correct brand and branch in Leads,
          then reply from Chats. Configure allowed website domains in Chatwoot
          before public installation.
        </p>
      </section>
    </div>
  );
}
