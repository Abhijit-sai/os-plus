"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import {
  addSetupRecord,
  saveSetupProfile,
  type SetupResult,
} from "@/features/onboarding/actions";
import { businessTypes, openingDays } from "@/features/onboarding/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const initialResult: SetupResult = { ok: false, message: "" };
export const selectClass =
  "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

export function SetupFeedback({ result }: { result: SetupResult }) {
  if (!result.message) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={
        result.ok ? "text-sm text-emerald-800" : "text-sm text-destructive"
      }
    >
      {result.message}
    </p>
  );
}

type Hours = { days: string[]; opens: string; closes: string };
type Profile = {
  businessType?: string;
  description?: string;
  hours?: Hours | null;
};

export function BoutiqueProfileForm({
  tenantId,
  storeName,
  saved,
}: {
  tenantId: string;
  storeName: string;
  saved: Profile | null;
}) {
  const [result, submit, pending] = useActionState(
    saveSetupProfile.bind(null, tenantId),
    initialResult,
  );
  const [name, setName] = useState(storeName);
  const [type, setType] = useState(saved?.businessType ?? businessTypes[0]);
  const [description, setDescription] = useState(saved?.description ?? "");
  const [showHours, setShowHours] = useState(saved?.hours !== null);
  const [opens, setOpens] = useState(saved?.hours?.opens ?? "10:00");
  const [closes, setCloses] = useState(saved?.hours?.closes ?? "19:00");
  const [days, setDays] = useState(
    saved?.hours?.days ?? openingDays.slice(0, 6),
  );

  return (
    <form action={submit} className="space-y-5" data-unsaved-guard="true">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Boutique name
          <Input
            name="storeName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={65}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Business type
          <select
            name="businessType"
            className={selectClass}
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {businessTypes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Short description{" "}
        <span className="text-xs font-normal text-muted-foreground">
          Optional
        </span>
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={300}
          rows={2}
          placeholder="Custom occasionwear and everyday tailoring"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Opening hours</h3>
            <p className="text-sm text-muted-foreground">
              Use the same hours for the days you select.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowHours(!showHours)}
          >
            {showHours ? "Set later" : "Add hours"}
          </Button>
        </div>
        {showHours ? (
          <>
            <input type="hidden" name="setHours" value="yes" />
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">Opening days</legend>
              {openingDays.map((day) => (
                <label
                  key={day}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:bg-emerald-50"
                >
                  <input
                    type="checkbox"
                    name="days"
                    value={day}
                    checked={days.includes(day)}
                    onChange={(event) =>
                      setDays(
                        event.target.checked
                          ? [...days, day]
                          : days.filter((entry) => entry !== day),
                      )
                    }
                  />
                  {day}
                </label>
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <label className="grid gap-2 text-sm">
                Opens
                <Input
                  name="opens"
                  type="time"
                  value={opens}
                  onChange={(event) => setOpens(event.target.value)}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm">
                Closes
                <Input
                  name="closes"
                  type="time"
                  value={closes}
                  onChange={(event) => setCloses(event.target.value)}
                  required
                />
              </label>
            </div>
          </>
        ) : null}
      </div>
      <Button disabled={pending}>
        {pending ? "Saving…" : "Save and continue"}
      </Button>
      <SetupFeedback result={result} />
    </form>
  );
}

export function AddSetupRecordForm({
  tenantId,
  kind,
  suggestions = [],
  groups = [],
}: {
  tenantId: string;
  kind: "garment" | "workgroup" | "worker";
  suggestions?: string[];
  groups?: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const defaultGroups = groups.length === 1 ? [groups[0].id] : [];
  const [selectedGroups, setSelectedGroups] = useState<string[]>(defaultGroups);
  const [result, submit, pending] = useActionState(
    async (previous: SetupResult, formData: FormData) => {
      const next = await addSetupRecord(tenantId, kind, previous, formData);
      if (next.ok) {
        setName("");
        setSelectedGroups(defaultGroups);
      }
      return next;
    },
    initialResult,
  );

  return (
    <form action={submit} className="space-y-3">
      {suggestions.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Suggested names">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={name === suggestion}
              className="aria-pressed:bg-emerald-50"
              onClick={() => setName(suggestion)}
            >
              <Plus className="mr-1 size-3" />
              {suggestion}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid min-w-36 flex-1 gap-2 text-sm font-medium">
          {kind === "worker"
            ? "Worker name"
            : kind === "garment"
              ? "Garment name"
              : "Workgroup name"}
          <Input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              kind === "worker"
                ? "e.g. Asha"
                : kind === "garment"
                  ? "e.g. Anarkali"
                  : "e.g. Production"
            }
            required
            minLength={2}
            maxLength={65}
          />
        </label>
        <Button disabled={pending}>
          {pending ? "Adding…" : `Add ${kind}`}
        </Button>
      </div>
      {kind === "worker" ? (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm font-medium">
            Workgroups this person can cover
          </legend>
          {groups.map((group) => (
            <label
              key={group.id}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-[:checked]:bg-emerald-50"
            >
              <input
                type="checkbox"
                name="workgroupIds"
                value={group.id}
                checked={selectedGroups.includes(group.id)}
                onChange={(event) =>
                  setSelectedGroups(
                    event.target.checked
                      ? [...selectedGroups, group.id]
                      : selectedGroups.filter((id) => id !== group.id),
                  )
                }
              />
              {group.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <SetupFeedback result={result} />
    </form>
  );
}
