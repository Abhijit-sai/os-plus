"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { attendanceImportAction, type AttendanceImportState } from "@/features/attendance/import-actions";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AttendanceImportDialog() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<AttendanceImportState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function submitImport(formData: FormData) {
    if (pending) return;
    if (selectedFile) formData.set("file", selectedFile);
    setPending(true);
    try {
      const nextState = await attendanceImportAction(formData);
      setState(nextState);
      if (nextState.status === "success" && formRef.current) {
        delete formRef.current.dataset.unsavedDirty;
      }
    } finally {
      setPending(false);
    }
  }

  const preview = state?.status === "preview" ? state.preview : null;
  const result = state?.status === "success" ? state.result : null;
  const summary = preview ?? result;

  return (
    <Dialog
      className="max-w-4xl"
      description="Preview exact worker-name matches before any attendance is changed."
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setState(null);
          setSelectedFile(null);
        }
      }}
      open={open}
      placement="side"
      preventClose={pending}
      title="Import attendance from Excel"
      trigger={(
        <span className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
          <Upload className="h-4 w-4" />
          Upload Excel
        </span>
      )}
    >
      {({ close }) => <form
        ref={formRef}
        action={submitImport}
        className="space-y-5"
        data-unsaved-guard="true"
        data-preserve-dirty-on-submit="true"
      >
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Only exact worker-name matches are imported.</p>
              <p className="mt-1 text-blue-900">
                Matching ignores case and extra spaces. Unmatched and ambiguous names are skipped; the importer never creates workers. Future dates, blank status cells, and unknown status codes are also skipped and reported.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="attendance-import-file">Attendance report</Label>
          <Input
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={pending}
            id="attendance-import-file"
            name="file"
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.[0] ?? null);
              setState(null);
            }}
            type="file"
          />
          {selectedFile ? <p className="text-sm font-medium">Selected: {selectedFile.name}</p> : null}
          <p className="text-xs text-muted-foreground">Accepted: legacy .xls and .xlsx, up to 5 MB. Upload one report month at a time.</p>
        </div>

        {state ? (
          <div
            className={`rounded-lg border p-4 text-sm ${
              state.status === "error"
                ? "border-red-200 bg-red-50 text-red-950"
                : state.status === "success"
                  ? "border-green-200 bg-green-50 text-green-950"
                  : "border-neutral-200 bg-neutral-50"
            }`}
            role={state.status === "error" ? "alert" : "status"}
          >
            <div className="flex items-start gap-2">
              {state.status === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
              <p className="font-medium">{state.message}</p>
            </div>
          </div>
        ) : null}

        {summary ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">Report month: {summary.reportMonth}</p>
                <p className="text-sm text-muted-foreground">{summary.sourceWorkerCount} worker sections found</p>
              </div>
              {result?.idempotentReplay ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Already imported</span> : null}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Exact matches" value={summary.matchedWorkerCount} />
              <Metric label="New rows" value={summary.insertCount} />
              <Metric label="Updates" value={summary.updateCount} />
              <Metric label="Skipped rows" value={summary.skippedCount} />
            </div>

            {(summary.unmatchedWorkerCount || summary.ambiguousWorkerCount || summary.futureDateCount || summary.blankStatusCount || summary.unknownStatusCount) ? (
              <div className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:grid-cols-2">
                <p>Unmatched workers: <strong>{summary.unmatchedWorkerCount}</strong></p>
                <p>Ambiguous workers: <strong>{summary.ambiguousWorkerCount}</strong></p>
                <p>Future date cells: <strong>{summary.futureDateCount}</strong></p>
                <p>Blank status cells: <strong>{summary.blankStatusCount}</strong></p>
                <p>Unknown status cells: <strong>{summary.unknownStatusCount}</strong></p>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border">
              <div className="grid min-w-[520px] grid-cols-[minmax(160px,1fr)_110px_90px_90px] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Source worker</span><span>Match</span><span>New</span><span>Update</span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {summary.workers.map((worker, index) => (
                  <div key={`${worker.sourceCode ?? "worker"}-${worker.sourceName}-${index}`} className="grid min-w-[520px] grid-cols-[minmax(160px,1fr)_110px_90px_90px] gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{worker.sourceName}</p>
                      <p className="truncate text-xs text-muted-foreground">{worker.sourceCode ? `Code ${worker.sourceCode}` : "No employee code"}</p>
                    </div>
                    <span className={worker.matchState === "matched" ? "text-green-700" : "text-amber-700"}>
                      {worker.matchState === "matched" ? "Exact" : worker.matchState === "ambiguous" ? "Ambiguous" : "Skipped"}
                    </span>
                    <span className="tabular-nums">{worker.insertCount}</span>
                    <span className="tabular-nums">{worker.updateCount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Select the attendance report to begin.</p>
            <p className="mt-1 text-sm text-muted-foreground">Nothing is written during preview.</p>
          </div>
        )}

        {preview ? (
          <>
            <input name="expectedFingerprint" type="hidden" value={preview.fingerprint} />
            <input name="idempotencyKey" type="hidden" value={preview.idempotencyKey} />
          </>
        ) : null}

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t bg-background py-3">
          <Button disabled={pending} onClick={close} type="button" variant="outline">Close</Button>
          {state?.status === "success" ? null : (
            <Button disabled={pending || !selectedFile} name="intent" type="submit" value="preview" variant={preview ? "outline" : "default"}>
              {preview ? "Refresh preview" : "Preview workbook"}
            </Button>
          )}
          {preview ? (
            <Button disabled={pending || preview.insertCount + preview.updateCount === 0} name="intent" type="submit" value="confirm">
              Confirm attendance import
            </Button>
          ) : null}
        </div>
      </form>}
    </Dialog>
  );
}
