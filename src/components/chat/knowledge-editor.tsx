"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatForm } from "./setup-form";
import type { ChatSetup } from "@/features/chat/queries";
import type { ChatActionResult } from "@/features/chat/actions";

export function KnowledgeEditor({
  brandId,
  packs,
  olderBefore,
  save,
  loadKnowledge,
}: {
  brandId: string;
  packs: ChatSetup["packs"];
  olderBefore: number | null;
  save: (input: unknown, key: string) => Promise<ChatActionResult>;
  loadKnowledge: (input: unknown) => Promise<ChatActionResult>;
}) {
  const [text, setText] = useState(""),
    [loaded, setLoaded] = useState(""),
    [dirty, setDirty] = useState(false),
    id = useId();
  const [older, setOlder] = useState<ChatSetup["packs"]>([]),
    [cursor, setCursor] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const revisions = [
    ...packs,
    ...older.filter((p) => !packs.some((current) => current.id === p.id)),
  ].sort((a, b) => b.version - a.version);
  const next = cursor === undefined ? olderBefore : cursor;
  function saved(result: ChatActionResult) {
    if (result.ok) {
      setOlder([]);
      setCursor(undefined);
    }
  }
  return (
    <div className="space-y-4">
      <label htmlFor={id + "-revision"} className="block text-sm font-medium">
        Load a saved revision
      </label>
      <select
        id={id + "-revision"}
        value={loaded}
        disabled={busy}
        className="min-h-11 w-full rounded-md border bg-background px-3"
        onChange={async (event) => {
          const selected = event.target.value;
          if (
            dirty &&
            !window.confirm(
              "Replace the unsaved editor text with this revision?",
            )
          )
            return;
          if (!selected) {
            setLoaded("");
            setText("");
            setDirty(false);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await loadKnowledge({ brandId, id: selected });
            if (!result.ok || !result.revision) {
              setError(result.message);
              return;
            }
            setLoaded(selected);
            setText(JSON.stringify(result.revision.pack_json, null, 2));
            setDirty(false);
          } catch {
            setError(
              "Knowledge could not be loaded. Your editor text has been preserved.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="">New knowledge pack</option>
        {revisions.map((pack) => (
          <option key={pack.id} value={pack.id}>
            Version {pack.version} · {pack.status}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Loading knowledge…
        </p>
      )}
      <ChatForm
        label="Save new draft revision"
        save={async (_data, key) => {
          if (new TextEncoder().encode(text).length > 240000)
            return {
              ok: false,
              message: "The knowledge pack is too large. Keep it below 240 KB.",
            };
          let pack: unknown;
          try {
            pack = JSON.parse(text);
          } catch {
            return { ok: false, message: "Enter valid JSON before saving." };
          }
          return save({ action: "pack.save", input: { brandId, pack } }, key);
        }}
        onResult={(result) => {
          saved(result);
          if (result.ok) setDirty(false);
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-sm font-medium">
            Knowledge pack JSON
          </label>
          <textarea
            id={id}
            name="knowledge"
            required
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value);
              setDirty(true);
            }}
            spellCheck={false}
            rows={12}
            className="w-full min-w-0 rounded-md border bg-background p-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-ring"
            aria-describedby={id + "-help"}
          />
          <p id={id + "-help"} className="text-sm text-muted-foreground">
            Use this business’s approved facts. Saving creates a draft;
            publication is a separate action. Booking remains unavailable in
            this phase.
          </p>
        </div>
      </ChatForm>
      <ul className="space-y-2">
        {revisions.map((pack) => (
          <li key={pack.id} className="rounded-md border p-3">
            <p className="mb-2 text-sm">
              Version {pack.version} · {pack.status}
            </p>
            {pack.status === "draft" && (
              <ChatForm
                label={"Publish version " + pack.version}
                save={async (_data, key) =>
                  save({ action: "pack.publish", input: { id: pack.id } }, key)
                }
                onResult={saved}
              >
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" required />I reviewed this saved
                  revision and its branch mappings.
                </label>
              </ChatForm>
            )}
          </li>
        ))}
      </ul>
      {next !== null && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="min-h-11"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await loadKnowledge({
                brandId,
                beforeVersion: next,
              });
              if (!result.ok || !result.revisions) {
                setError(result.message);
                return;
              }
              setOlder((previous) => [...previous, ...result.revisions!]);
              setCursor(result.olderBefore ?? null);
            } catch {
              setError("Older revisions could not be loaded. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Load older revisions
        </Button>
      )}
      {revisions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No knowledge pack has been saved or published.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        className="min-h-11"
        onClick={() => {
          if (!dirty || window.confirm("Clear unsaved editor text?")) {
            setText("");
            setLoaded("");
            setDirty(false);
          }
        }}
      >
        Start a blank revision
      </Button>
    </div>
  );
}
