"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { configureAiBudgetAction } from "@/features/chat/agent/budget-actions";
import type { AiBudgetSettings } from "@/features/chat/agent/budget-settings";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { useHydrated } from "./use-hydrated";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass } from "@/components/leads/workspace";
export function ChatAiBudgetSettings({ data }: { data: AiBudgetSettings }) {
  const ready = useHydrated(),
    router = useRouter(),
    [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [command] = useState(() =>
    createConfirmedCommand(
      (input, key) => configureAiBudgetAction(input, key, data.tenantId),
      () => crypto.randomUUID(),
    ),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI spending limit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-prose text-sm text-muted-foreground">
          {data.uncappedDrafts
            ? "Private WhatsApp suggestions are configured without a monthly limit. Enter 0 to pause new spending."
            : "Set a monthly limit in USD for this business. Enter 0 to pause new spending. The month resets in UTC. Calls with unknown costs continue to count against the limit."}
        </p>
        <form
          data-unsaved-guard="true"
          data-preserve-dirty-on-submit="true"
          onSubmit={(event) => {
            event.preventDefault();
            const element = event.currentTarget,
              input = {
                monthlyBudgetUsd: String(
                  new FormData(element).get("monthlyBudgetUsd") ?? "",
                ).trim(),
                version: data.version,
              };
            start(async () => {
              const result = await command.run(input);
              setFeedback(result);
              if (result.ok) {
                delete element.dataset.unsavedDirty;
                router.refresh();
              }
            });
          }}
        >
          <fieldset disabled={!ready || pending} className="space-y-4">
            <label className="block max-w-sm text-sm">
              Monthly AI limit (USD)
              <input
                className={fieldClass}
                name="monthlyBudgetUsd"
                type="text"
                inputMode="decimal"
                required
                pattern="(0|[1-9][0-9]{0,8})([.][0-9]{1,12})?"
                maxLength={22}
                defaultValue={data.monthlyBudgetUsd ?? ""}
                placeholder={data.uncappedDrafts ? "No monthly limit" : "Not configured"}
              />
            </label>
            <Button type="submit">
              {pending ? "Saving…" : "Save AI limit"}
            </Button>
          </fieldset>
        </form>
        {feedback ? (
          <p role={feedback.ok ? "status" : "alert"} className="text-sm">
            {feedback.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
