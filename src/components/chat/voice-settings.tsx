"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { configureVoiceAction } from "@/features/chat/voice/server-actions";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { useHydrated } from "./use-hydrated";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass } from "@/components/leads/workspace";
type Data = {
  tenantId: string;
  enabled: boolean;
  maxBytes: number;
  maxSeconds: number;
  version: number;
};
type Feedback = { ok: boolean; message: string };
function VoiceForm({
  data,
  onResult,
}: {
  data: Data;
  onResult: (f: Feedback) => void;
}) {
  const [pending, start] = useTransition(),
    ready = useHydrated(),
    router = useRouter();
  const [command] = useState(() =>
    createConfirmedCommand(
      (input, key) => configureVoiceAction(input, key, data.tenantId),
      () => crypto.randomUUID(),
    ),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const input = {
          enabled: form.get("enabled") === "on",
          maxBytes: Math.round(Number(form.get("maxMegabytes")) * 1000000),
          maxSeconds: Number(form.get("maxSeconds")),
          version: data.version,
        };
        start(async () => {
          const result = await command.run(input);
          onResult(result);
          if (result.ok) router.refresh();
        });
      }}
    >
      <fieldset disabled={!ready || pending} className="space-y-4">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            className="size-5"
            type="checkbox"
            name="enabled"
            defaultChecked={data.enabled}
          />
          Enable local voice-note processing for this business
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Maximum recording length (seconds)
            <input
              className={fieldClass}
              name="maxSeconds"
              type="number"
              required
              min={1}
              max={120}
              step={1}
              defaultValue={data.maxSeconds}
            />
          </label>
          <label className="block text-sm">
            Maximum file size (MB)
            <input
              className={fieldClass}
              name="maxMegabytes"
              type="number"
              required
              min={0.1}
              max={10}
              step={0.1}
              defaultValue={data.maxBytes / 1000000}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          One recording per message, up to two minutes and 10 MB. Unclear or
          unsupported recordings go to staff. Bookings still need typed customer
          confirmation and staff approval.
        </p>
        <Button type="submit" disabled={!ready || pending}>
          {pending ? "Saving…" : "Save voice settings"}
        </Button>
      </fieldset>
    </form>
  );
}
export function ChatVoiceSettings({ data }: { data: Data }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Local demo only. Live transcription is disabled. Only the supplied
          synthetic audio fixtures are recognised; arbitrary recordings need
          staff review.
        </p>
        <VoiceForm
          key={data.tenantId + ":" + data.version}
          data={data}
          onResult={setFeedback}
        />
        {feedback ? (
          <p role={feedback.ok ? "status" : "alert"} className="text-sm">
            {feedback.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
