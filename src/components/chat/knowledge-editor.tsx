"use client";
import { useId, useState } from "react";
import { z } from "zod";
const editableFactsSchema = z
  .object({
    brand: z.object({ oneLiner: z.string() }).passthrough(),
    hours: z.object({ default: z.string() }).passthrough(),
  })
  .passthrough();
function editableFacts(text: string) {
  try {
    const parsed = editableFactsSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
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
  const facts = editableFacts(text);
  const updateFact = (
    part: "brand" | "hours",
    key: "oneLiner" | "default",
    value: string,
  ) => {
    if (!facts) return;
    setText(
      JSON.stringify(
        { ...facts, [part]: { ...facts[part], [key]: value } },
        null,
        2,
      ),
    );
    setDirty(true);
  };
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
        {facts ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor={id + "-description"}
                className="block text-sm font-medium"
              >
                What your business does
              </label>
              <textarea
                id={id + "-description"}
                required
                disabled={busy}
                rows={2}
                value={facts.brand.oneLiner}
                onChange={(event) =>
                  updateFact("brand", "oneLiner", event.target.value)
                }
                className="w-full rounded-md border bg-background p-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={id + "-hours"}
                className="block text-sm font-medium"
              >
                Opening hours
              </label>
              <textarea
                id={id + "-hours"}
                required
                disabled={busy}
                rows={2}
                value={facts.hours.default}
                onChange={(event) =>
                  updateFact("hours", "default", event.target.value)
                }
                className="w-full rounded-md border bg-background p-3 text-sm"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Other saved services, prices, languages and reply safeguards are
              preserved. Review the full configuration below before changing
              them.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Load a saved revision to update business facts. A first
            configuration needs the full reviewed business setup below.
          </p>
        )}
        <details className="border-t pt-3" open={!facts}>
          <summary className="min-h-11 cursor-pointer text-sm font-medium">
            Advanced business configuration
          </summary>
          <div className="space-y-1.5">
            <label htmlFor={id} className="block text-sm font-medium">
              Full configuration (JSON)
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
              publication is a separate action. Operational bookings still
              require verified details and staff approval.
            </p>
          </div>
        </details>
      </ChatForm>
      <details className="border-t pt-3">
        <summary className="min-h-11 cursor-pointer font-medium">
          Revision history and publication
        </summary>
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
                    save(
                      { action: "pack.publish", input: { id: pack.id } },
                      key,
                    )
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
      </details>
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
