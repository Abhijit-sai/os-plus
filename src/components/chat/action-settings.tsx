"use client";
import { useRef, useState, useTransition } from "react";
import { useHydrated } from "./use-hydrated";
import type { ChatActionSettings } from "@/features/chat/actions/settings";
import { configureChatActionsAction } from "@/features/chat/actions/server-actions";
import { createConfirmedCommand } from "@/features/leads/confirmed-command";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/leads/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function ChatActionSettingsPanel({
  data,
}: {
  data: ChatActionSettings;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests and reply approval</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enable requests after publishing booking knowledge. Automatic replies
          require your approval of the current knowledge version; operational
          bookings still need staff approval.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {!data.publicDeliveryEnabled ? (
          <p className="text-sm">
            Automatic delivery is disabled on this installation. Saving approval
            keeps the current draft workflow until delivery is enabled.
          </p>
        ) : null}
        {data.channels.map((channel) => (
          <ChannelSettings key={channel.id} channel={channel} data={data} />
        ))}
        {!data.channels.length ? <p>No active inboxes mapped.</p> : null}
      </CardContent>
    </Card>
  );
}
type ChannelProps = {
  channel: ChatActionSettings["channels"][number];
  data: ChatActionSettings;
};
function ChannelSettings({ channel, data }: ChannelProps) {
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-3">
      <ChannelForm
        // Revalidation must discard edits/consent bound to an older settings or pack version.
        key={
          channel.id + ":" + channel.version + ":" + (channel.packId ?? "none")
        }
        channel={channel}
        data={data}
        onMessage={setMessage}
      />
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
function ChannelForm({
  channel,
  data,
  onMessage,
}: ChannelProps & { onMessage: (message: string) => void }) {
  const [pending, start] = useTransition(),
    [mode, setMode] = useState(channel.mode);
  const ready = useHydrated();
  const command = useRef(
    createConfirmedCommand(configureChatActionsAction, () =>
      crypto.randomUUID(),
    ),
  );
  return (
    <form
      data-unsaved-guard="true"
      data-preserve-dirty-on-submit="true"
      className="space-y-3 border-b pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        const form = new FormData(element);
        start(async () => {
          const result = await command.current.run({
            channelId: channel.id,
            version: channel.version,
            mode,
            canBook: form.get("canBook") === "on",
            packId: channel.packId,
            approveAuto: form.get("approveAuto") === "on",
            locationId: String(form.get("locationId") || "") || null,
            teamId: String(form.get("teamId") || "") || null,
          });
          if (result.ok) delete element.dataset.unsavedDirty;
          onMessage(result.message);
          // The action revalidates this page; a second refresh discards its feedback.
        });
      }}
    >
      <h3 className="font-medium">
        {channel.name} · {channel.kind}
      </h3>
      <p className="text-sm">
        {channel.packVersion
          ? "Published knowledge version " + channel.packVersion
          : "Publish knowledge first"}
        {channel.mode === "auto" && !channel.autoApproved
          ? " — current version needs approval"
          : ""}
      </p>
      <fieldset disabled={!ready || pending} className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="canBook"
            className="size-5"
            defaultChecked={channel.canBook}
            disabled={!channel.bookingCapability}
          />
          Allow provisional requests
        </label>
        <label className="block text-sm">
          Reply mode
          <select
            className={fieldClass}
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="off">Off</option>
            <option value="draft">Staff-reviewed drafts</option>
            <option value="auto">Automatic replies with owner approval</option>
          </select>
        </label>
        {mode === "auto" ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              required
              name="approveAuto"
              className="mt-1 size-5"
            />
            I approve automatic replies using knowledge version{" "}
            {channel.packVersion ?? "not published"}. New knowledge versions
            require new approval.
          </label>
        ) : null}
        <details>
          <summary className="cursor-pointer py-2 text-sm font-medium">
            Branch team fallback
          </summary>
          <p className="text-sm">
            Used after an eligible Chatwoot assignee and lead owner. Unresolved
            branches remain unassigned.
          </p>
          <label className="block text-sm">
            Branch
            <select name="locationId" className={fieldClass}>
              <option value="">Keep routing unchanged</option>
              {data.branches
                .filter((branch) => branch.channelId === channel.id)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            Fallback team
            <select name="teamId" className={fieldClass}>
              <option value="">Unassigned</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </details>
        <Button type="submit">
          {pending ? "Saving…" : "Save channel controls"}
        </Button>
      </fieldset>
    </form>
  );
}
