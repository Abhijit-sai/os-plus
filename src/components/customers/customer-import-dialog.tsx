"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  customerImportAction,
  type CustomerImportPreview,
  type CustomerImportState,
} from "@/features/customers/import-actions";

type ReviewDecision = "create" | "reuse" | "skip";

function MatchLabel({ state }: { state: CustomerImportPreview["rows"][number]["matchState"] }) {
  const labels = {
    create: "Create",
    invalid: "Invalid",
    reuse_external_id: "Reuse by Shopify ID",
    reuse_phone: "Reuse by phone",
    review_email: "Review email",
  } as const;
  return <span className={state === "invalid" || state === "review_email" ? "font-medium text-amber-700" : "font-medium text-emerald-700"}>{labels[state]}</span>;
}

function ConflictList({ conflicts }: { conflicts: CustomerImportPreview["rows"][number]["conflicts"] }) {
  if (!conflicts.length) return null;
  return (
    <div className="space-y-1 text-xs text-amber-800">
      {conflicts.map((conflict) => (
        <p className="break-words" key={`${conflict.field}-${conflict.sourceValue}`}>
          <span className="font-medium capitalize">{conflict.field}:</span>{" "}
          keep “{conflict.existingValue}”; source has “{conflict.sourceValue}”.
        </p>
      ))}
    </div>
  );
}

export function CustomerImportDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<CustomerImportState | null>(null);
  const [lastPreview, setLastPreview] = useState<CustomerImportPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, ReviewDecision>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const preview = state?.status === "preview" ? state.preview : lastPreview;
  const unresolvedReviews = useMemo(
    () => preview?.rows.filter((row) => row.matchState === "review_email" && !reviewDecisions[String(row.rowNumber)]).length ?? 0,
    [preview, reviewDecisions],
  );
  const visibleRows = useMemo(() => {
    if (!preview) return [];
    const reviewRows = preview.rows.filter((row) => row.matchState === "review_email");
    const otherRows = preview.rows.filter((row) => row.matchState !== "review_email").slice(0, 200);
    return [...reviewRows, ...otherRows].sort((left, right) => left.rowNumber - right.rowNumber);
  }, [preview]);

  async function submitImport(formData: FormData) {
    if (pending) return;
    if (selectedFile) formData.set("file", selectedFile);
    formData.set("reviewDecisions", JSON.stringify(reviewDecisions));
    setPending(true);
    try {
      const nextState = await customerImportAction(formData);
      setState(nextState);
      if (nextState.status === "preview") {
        setLastPreview(nextState.preview);
        setReviewDecisions({});
      }
      if (nextState.status === "success") {
        delete formRef.current?.dataset.unsavedDirty;
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      className="max-w-6xl"
      description="Preview every match and conflict before customer profiles are changed."
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setState(null);
          setLastPreview(null);
          setSelectedFile(null);
          setReviewDecisions({});
        }
      }}
      open={open}
      placement="side"
      preventClose={pending}
      title="Import customers"
      trigger={(
        <span className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
          <Upload className="h-4 w-4" />
          Import file
        </span>
      )}
    >
      {({ close }) => (
        <form
          ref={formRef}
          action={submitImport}
          className="space-y-5"
          data-preserve-dirty-on-submit="true"
          data-unsaved-guard="true"
        >
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-semibold">Nothing is written until you confirm.</p>
            <p className="mt-1 max-w-[72ch] text-blue-900">
              Shopify ID is checked first, then normalized phone. Existing profile fields are never overwritten. Email-only matches wait for your decision, and source marketing flags do not enable messaging.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-import-file">Customer file</Label>
            <Input
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={pending}
              id="customer-import-file"
              name="file"
              onChange={(event) => {
                setSelectedFile(event.currentTarget.files?.[0] ?? null);
                setState(null);
                setLastPreview(null);
                setReviewDecisions({});
              }}
              type="file"
            />
            <p className="text-xs text-muted-foreground">CSV or XLSX, up to 5 MB and 5,000 customer rows.</p>
          </div>

          {state ? (
            <div
              className={`rounded-lg border p-4 text-sm ${state.status === "error" ? "border-red-200 bg-red-50 text-red-950" : state.status === "success" ? "border-green-200 bg-green-50 text-green-950" : "border-neutral-200 bg-neutral-50"}`}
              role={state.status === "error" ? "alert" : "status"}
            >
              <div className="flex items-start gap-2">
                {state.status === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                <p className="font-medium">{state.message}</p>
              </div>
              {state.status === "success" ? (
                <p className="mt-2 text-green-900">
                  {state.result.updatedCount} reused profiles filled, {state.result.addressCount} structured addresses added, {state.result.invalidCount} invalid and {state.result.skippedCount} skipped.
                </p>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-2 divide-x divide-y bg-muted/30 sm:grid-cols-5 sm:divide-y-0">
                  {[
                    ["Rows", preview.sourceRowCount],
                    ["Create", preview.createCount],
                    ["Reuse", preview.reuseCount],
                    ["Review", preview.reviewCount],
                    ["Invalid / skipped", preview.invalidCount + preview.skippedCount],
                  ].map(([label, value]) => (
                    <div className="px-3 py-3" key={label}>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {unresolvedReviews > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
                  Choose Create, Reuse, or Skip for {unresolvedReviews} email-only {unresolvedReviews === 1 ? "match" : "matches"} before confirming.
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-lg border">
                <div className="grid min-w-[900px] grid-cols-[70px_minmax(190px,1.2fr)_minmax(170px,1fr)_170px_minmax(220px,1.3fr)] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Row</span><span>Source customer</span><span>Phone / email</span><span>Match</span><span>Review</span>
                </div>
                <div className="max-h-[46vh] overflow-y-auto">
                  {visibleRows.map((row) => (
                    <div className="grid min-w-[900px] grid-cols-[70px_minmax(190px,1.2fr)_minmax(170px,1fr)_170px_minmax(220px,1.3fr)] gap-3 border-b px-3 py-3 text-sm last:border-b-0" key={row.rowNumber}>
                      <span className="tabular-nums text-muted-foreground">{row.rowNumber}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.shopifyCustomerId ? `Shopify ${row.shopifyCustomerId}` : "No Shopify ID"}</p>
                      </div>
                      <div className="min-w-0 text-xs">
                        <p className="truncate">{row.phone ?? "No phone"}</p>
                        <p className="truncate text-muted-foreground">{row.email ?? "No email"}</p>
                      </div>
                      <MatchLabel state={row.matchState} />
                      <div className="min-w-0">
                        {row.matchState === "review_email" ? (
                          <div className="space-y-1">
                            <label className="sr-only" htmlFor={`review-${row.rowNumber}`}>Decision for row {row.rowNumber}</label>
                            <select
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              disabled={pending}
                              id={`review-${row.rowNumber}`}
                              onChange={(event) => setReviewDecisions((current) => ({ ...current, [String(row.rowNumber)]: event.target.value as ReviewDecision }))}
                              value={reviewDecisions[String(row.rowNumber)] ?? ""}
                            >
                              <option value="">Choose action</option>
                              <option value="reuse">Reuse {row.existingCustomerName ?? "existing customer"}</option>
                              <option value="create">Create separate customer</option>
                              <option value="skip">Skip this row</option>
                            </select>
                            <p className="truncate text-xs text-muted-foreground">Matches {row.existingCustomerEmail}</p>
                            <ConflictList conflicts={row.conflicts} />
                          </div>
                        ) : row.invalidReasons.length ? (
                          <p className="text-xs text-amber-800">{row.invalidReasons.join(" ")}</p>
                        ) : row.conflicts.length ? (
                          <ConflictList conflicts={row.conflicts} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Ready</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {preview.rows.length > visibleRows.length ? <p className="text-xs text-muted-foreground">Showing every email decision plus the first 200 other rows. All {preview.rows.length} rows are validated and included in the counts.</p> : null}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Select a customer export to begin.</p>
              <p className="mt-1 text-sm text-muted-foreground">The preview identifies duplicates and conflicts before any save.</p>
            </div>
          )}

          {preview ? (
            <>
              <input name="expectedFileFingerprint" type="hidden" value={preview.fileFingerprint} />
              <input name="expectedPreviewFingerprint" type="hidden" value={preview.previewFingerprint} />
              <input name="idempotencyKey" type="hidden" value={preview.idempotencyKey} />
            </>
          ) : null}

          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-3">
            <Button disabled={pending} onClick={close} type="button" variant="outline">Close</Button>
            {state?.status === "success" ? null : (
              <Button disabled={pending || !selectedFile} name="intent" pendingLabel="Preparing preview..." type="submit" value="preview" variant={preview ? "outline" : "default"}>
                {preview ? "Refresh preview" : "Preview file"}
              </Button>
            )}
            {preview && state?.status !== "success" ? (
              <Button disabled={pending || unresolvedReviews > 0 || preview.createCount + preview.reuseCount + preview.reviewCount === 0} name="intent" pendingLabel="Importing customers..." type="submit" value="confirm">
                Confirm customer import
              </Button>
            ) : null}
          </div>
        </form>
      )}
    </Dialog>
  );
}
