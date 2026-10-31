"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import {
  previewInquiryAction,
  type PreviewActionResult,
} from "@/features/chat/agent/preview-actions";
import type { ReplyPreview } from "@/features/chat/agent/preview-core";
const field =
  "mt-1 min-h-11 w-full rounded-md border bg-background px-3 py-2 text-base";
export function BotPreview({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition(),
    [feedback, setFeedback] = useState(""),
    [unconfirmed, setUnconfirmed] = useState(false),
    [preview, setPreview] = useState<ReplyPreview | null>(null),
    [history, setHistory] = useState<
      { role: "user" | "assistant"; text: string }[]
    >([]),
    [brand, setBrand] = useState(brands[0]?.id ?? ""),
    [knowledge, setKnowledge] = useState("published"),
    [scenario, setScenario] = useState("information");
  const command = useRef<ReturnType<
      typeof createConfirmedCommand<PreviewActionResult>
    > | null>(null),
    busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const reset = () => {
    setHistory([]);
    setPreview(null);
    setFeedback("");
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link
          className="inline-flex min-h-11 items-center text-sm underline"
          href="/settings/chat"
        >
          Back to Chat setup
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Try the bot</h1>
        <p className="text-muted-foreground">
          Mock preview. Check your knowledge and the guarded reply flow before
          connecting a live model.
        </p>
        <p className="rounded-md border bg-muted/40 p-3 text-sm">
          Live AI is off. These are explicit demonstration scenarios, not
          language-model answers. Nothing is sent to Chatwoot; only a preview
          audit is saved. Use synthetic enquiries.
        </p>
      </header>
      {brands.length === 0 ? (
        <p>Add a brand and save a knowledge pack in Chat setup first.</p>
      ) : (
        <form
          ref={formRef}
          className="space-y-4"
          aria-busy={pending}
          onSubmit={(event) => {
            event.preventDefault();
            if (busy.current) return;
            busy.current = true;
            const form = event.currentTarget,
              data = new FormData(form),
              message = String(data.get("message") ?? "");
            command.current ??= createConfirmedCommand(
              previewInquiryAction,
              () => crypto.randomUUID(),
            );
            setFeedback("");
            setPreview(null);
            start(async () => {
              try {
                const response = await command.current!.run({
                  brandId: brand,
                  knowledge,
                  scenario,
                  message,
                  history,
                });
                setFeedback(response.message);
                setUnconfirmed(!response.ok);
                if (response.ok && "preview" in response && response.preview) {
                  setPreview(response.preview);
                  setHistory((old) =>
                    [
                      ...old,
                      { role: "user" as const, text: message },
                      ...(response.preview?.replyText
                        ? [
                            {
                              role: "assistant" as const,
                              text: response.preview.replyText,
                            },
                          ]
                        : []),
                    ].slice(-20),
                  );
                  form.reset();
                }
              } finally {
                busy.current = false;
              }
            });
          }}
        >
          <fieldset disabled={pending} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Brand
                <select
                  className={field}
                  disabled={unconfirmed}
                  value={brand}
                  onChange={(event) => {
                    setBrand(event.target.value);
                    reset();
                  }}
                >
                  {brands.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                Knowledge
                <select
                  className={field}
                  disabled={unconfirmed}
                  value={knowledge}
                  onChange={(event) => {
                    setKnowledge(event.target.value);
                    reset();
                  }}
                >
                  <option value="published">Latest published version</option>
                  <option value="draft">Latest saved draft</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">
              Demonstration scenario
              <select
                className={field}
                disabled={unconfirmed}
                value={scenario}
                onChange={(event) => {
                  setScenario(event.target.value);
                  reset();
                }}
              >
                <option value="information">Opening-hours information</option>
                <option value="identity">Assistant identity</option>
                <option value="handoff">Needs a person</option>
                <option value="vendor">Supplier enquiry</option>
                <option value="payment_claim">
                  Payment claim — review only
                </option>
                <option value="unsafe_response">
                  Unsafe draft — test the fallback
                </option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Synthetic enquiry
              <textarea
                className={field + " min-h-28"}
                name="message"
                readOnly={unconfirmed}
                required
                maxLength={4000}
                placeholder="Write a fictional enquiry to test this scenario."
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                {pending ? "Preparing preview…" : "Preview draft"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={unconfirmed}
                onClick={() => {
                  reset();
                  formRef.current?.reset();
                }}
              >
                Start a fresh preview
              </Button>
            </div>
          </fieldset>
          <p role="status" aria-live="polite" className="text-sm">
            {feedback}
            {unconfirmed
              ? " Retry this exact preview or reload the page before changing inputs."
              : ""}
          </p>
        </form>
      )}
      {preview ? (
        <section
          className="space-y-3 rounded-lg border p-4"
          aria-labelledby="preview-result"
        >
          <h2 id="preview-result" className="font-semibold">
            {preview.replyText ? "Suggested draft" : "No reply needed"}
          </h2>
          <p className="whitespace-pre-wrap break-words text-base">
            {preview.replyText ??
              "The configured quiet or closing rule kept this preview silent."}
          </p>
          <p className="text-sm text-muted-foreground">
            Knowledge version {preview.knowledgeVersion} · Mock cost $0
          </p>
          {preview.sourceRefs.length > 0 ? (
            <p className="break-words text-sm text-muted-foreground">
              Sources: {preview.sourceRefs.join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}
      {history.length > 0 ? (
        <details className="rounded-lg border p-4">
          <summary className="min-h-11 cursor-pointer font-medium">
            This preview session
          </summary>
          <ol className="space-y-3">
            {history.map((item, index) => (
              <li
                key={index}
                className="whitespace-pre-wrap break-words text-sm"
              >
                <strong>{item.role === "user" ? "Enquiry" : "Draft"}: </strong>
                {item.text}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
