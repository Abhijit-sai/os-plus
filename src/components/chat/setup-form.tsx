"use client";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChatActionResult } from "@/features/chat/actions";

export function ChatForm({
  children,
  label,
  save,
  onResult,
  resetOnSuccess = false,
}: {
  children: ReactNode;
  label: string;
  save: (data: FormData, key: string) => Promise<ChatActionResult>;
  onResult?: (result: ChatActionResult) => void;
  resetOnSuccess?: boolean;
}) {
  const [pending, start] = useTransition(),
    [result, setResult] = useState<ChatActionResult | null>(null);
  const busy = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  return (
    <form
      className="space-y-4"
      data-unsaved-guard="true"
      data-preserve-dirty-on-submit="true"
      onInvalidCapture={(event) => {
        let node = (event.target as HTMLElement).parentElement;
        while (node) {
          if (node instanceof HTMLDetailsElement) node.open = true;
          node = node.parentElement;
        }
      }}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy.current) return;
        busy.current = true;
        const form = event.currentTarget,
          data = new FormData(form);
        const fingerprint = JSON.stringify(Array.from(data.entries()));
        if (attempt.current?.fingerprint !== fingerprint)
          attempt.current = { fingerprint, key: crypto.randomUUID() };
        const commandKey = attempt.current.key;
        setResult(null);
        start(async () => {
          try {
            const response = await save(data, commandKey);
            setResult(response);
            onResult?.(response);
            if (response.ok) {
              delete form.dataset.unsavedDirty;
              attempt.current = null;
              if (resetOnSuccess) form.reset();
            }
          } catch {
            setResult({
              ok: false,
              message:
                "Changes were not saved. Check the entered values and try again.",
            });
          } finally {
            busy.current = false;
          }
        });
      }}
    >
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {children}
        <Button className="min-h-11" type="submit" disabled={pending}>
          {pending ? "Saving…" : label}
        </Button>
      </fieldset>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={result.ok ? "text-sm" : "text-sm text-destructive"}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}
export function ChatInput({
  label,
  name,
  value,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  value?: string;
  type?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        autoComplete={type === "password" ? "new-password" : "off"}
      />
    </div>
  );
}
export function ChatSelect({
  label,
  name,
  children,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  children: ReactNode;
  required?: boolean;
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </div>
  );
}
export function ChatSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
export const field = (data: FormData, key: string) =>
  String(data.get(key) ?? "");
