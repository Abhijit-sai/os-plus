"use client";

import * as React from "react";
import { AlertTriangle, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import type { SalaryWorkflowActionState } from "@/features/salary/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMode, SalaryCalculation, Worker } from "@/types/database";

type SalaryWorkflowAction = (
  previousState: SalaryWorkflowActionState,
  formData: FormData,
) => Promise<SalaryWorkflowActionState>;

type WorkspaceRow = {
  calculation: SalaryCalculation;
  worker: Worker | null;
  warnings: string[];
};

type FilterKey = "all" | "review" | "ready" | "partial" | "paid" | "warnings";

const money = new Intl.NumberFormat("en-IN", { currency: "INR", style: "currency" });

function payable(calculation: SalaryCalculation) {
  return calculation.finalized_payable_amount ?? calculation.final_payable;
}

function due(calculation: SalaryCalculation) {
  return Math.max(
    0,
    Math.round((payable(calculation) - calculation.amount_paid + Number.EPSILON) * 100) / 100,
  );
}

function initialState(key: string): SalaryWorkflowActionState {
  return { idempotencyKey: key, message: null, ok: false };
}

function Notice({ state }: { state: SalaryWorkflowActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={state.ok ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" : "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"}
      role={state.ok ? "status" : "alert"}
    >
      {state.message}
    </div>
  );
}

function statusLabel(calculation: SalaryCalculation) {
  if (calculation.payment_status === "paid") return calculation.finalized_payable_amount === 0 ? "No payment due" : "Paid";
  if (calculation.payment_status === "partially_paid") return "Partially paid";
  return calculation.finalized_payable_amount === null ? "Needs review" : "Ready to pay";
}

export function SalaryPeriodBulkWorkspace({
  finalizeAction,
  finalizeKey,
  paymentAction,
  paymentKey,
  paymentModes,
  periodId,
  periodLabel,
  rows,
  today,
}: {
  finalizeAction: SalaryWorkflowAction;
  finalizeKey: string;
  paymentAction: SalaryWorkflowAction;
  paymentKey: string;
  paymentModes: PaymentMode[];
  periodId: string;
  periodLabel: string;
  rows: WorkspaceRow[];
  today: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"review" | "pay">("review");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [selected, setSelected] = React.useState(() => new Set<string>());
  const [amounts, setAmounts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(({ calculation }) => [calculation.id, String(payable(calculation))])),
  );
  const [notes, setNotes] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(({ calculation }) => [calculation.id, calculation.finalization_note ?? ""])),
  );
  const [paymentAmounts, setPaymentAmounts] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map(({ calculation }) => [calculation.id, String(due(calculation))])),
  );
  const finalizeFormRef = React.useRef<HTMLFormElement>(null);
  const paymentFormRef = React.useRef<HTMLFormElement>(null);
  const [finalizeState, finalizeFormAction, finalizePending] = React.useActionState(finalizeAction, initialState(finalizeKey));
  const [paymentState, paymentFormAction, paymentPending] = React.useActionState(paymentAction, initialState(paymentKey));
  const busy = finalizePending || paymentPending;

  React.useEffect(() => {
    if (!finalizeState.ok) return;
    if (finalizeFormRef.current) delete finalizeFormRef.current.dataset.unsavedDirty;
    router.refresh();
  }, [finalizeState.idempotencyKey, finalizeState.ok, router]);

  React.useEffect(() => {
    if (!paymentState.ok) return;
    if (paymentFormRef.current) delete paymentFormRef.current.dataset.unsavedDirty;
    router.refresh();
  }, [paymentState.idempotencyKey, paymentState.ok, router]);

  const filteredRows = rows.filter(({ calculation, warnings }) => {
    if (filter === "review") return calculation.finalized_payable_amount === null;
    if (filter === "ready") return calculation.finalized_payable_amount !== null && due(calculation) > 0 && calculation.amount_paid === 0;
    if (filter === "partial") return calculation.payment_status === "partially_paid";
    if (filter === "paid") return calculation.payment_status === "paid";
    if (filter === "warnings") return warnings.length > 0;
    return true;
  });
  const eligibleRows = filteredRows.filter(({ calculation }) =>
    mode === "review"
      ? true
      : calculation.finalized_payable_amount !== null && due(calculation) > 0,
  );
  const selectAllRows = eligibleRows.filter(
    ({ calculation }) => mode === "pay" || calculation.finalized_payable_amount === null,
  );
  const allEligibleSelected = selectAllRows.length > 0 && selectAllRows.every(({ calculation }) => selected.has(calculation.id));
  const selectedRows = rows.filter(({ calculation }) => selected.has(calculation.id));
  const serializedRows = JSON.stringify(
    selectedRows.map(({ calculation }) =>
      mode === "review"
        ? {
            calculationId: calculation.id,
            expectedUpdatedAt: calculation.updated_at,
            finalizationNote: notes[calculation.id]?.trim() || null,
            finalizedPayableAmount: Number(amounts[calculation.id]),
          }
        : {
            amount: Number(paymentAmounts[calculation.id]),
            calculationId: calculation.id,
            expectedUpdatedAt: calculation.updated_at,
          },
    ),
  );
  const selectedTotal = selectedRows.reduce(
    (total, { calculation }) => total + Number(mode === "review" ? amounts[calculation.id] : paymentAmounts[calculation.id]),
    0,
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchMode(nextMode: "review" | "pay") {
    setMode(nextMode);
    setSelected(new Set());
    setFilter("all");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 border-b pb-4 md:flex-row md:items-end">
        <div>
          <div className="inline-flex rounded-md border bg-muted/30 p-1" aria-label="Salary period workflow">
            <Button size="sm" type="button" variant={mode === "review" ? "default" : "ghost"} onClick={() => switchMode("review")}>1. Review payables</Button>
            <Button size="sm" type="button" variant={mode === "pay" ? "default" : "ghost"} onClick={() => switchMode("pay")}>2. Record payments</Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "review" ? "Accept system suggestions or edit worker payables before finalizing selected rows." : "Choose workers, confirm individual amounts, then record them using one date and payment mode."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter workers">
          {(["all", "review", "ready", "partial", "paid", "warnings"] as FilterKey[]).map((key) => (
            <Button key={key} size="sm" type="button" variant={filter === key ? "secondary" : "ghost"} onClick={() => { setFilter(key); setSelected(new Set()); }}>
              {key === "all" ? "All" : key === "review" ? "Needs review" : key === "ready" ? "Ready to pay" : key === "partial" ? "Partially paid" : key === "paid" ? "Paid" : "Warnings"}
            </Button>
          ))}
        </div>
      </div>

      <form
        action={mode === "review" ? finalizeFormAction : paymentFormAction}
        className="space-y-4"
        data-preserve-dirty-on-submit="true"
        data-unsaved-guard="true"
        ref={mode === "review" ? finalizeFormRef : paymentFormRef}
      >
        <input name="salaryPeriodId" type="hidden" value={periodId} />
        <input name="idempotencyKey" type="hidden" value={(mode === "review" ? finalizeState.idempotencyKey : paymentState.idempotencyKey) ?? (mode === "review" ? finalizeKey : paymentKey)} />
        <input name="rows" type="hidden" value={serializedRows} />
        {mode === "pay" ? <input name="description" type="hidden" value={`Salary paid for ${periodLabel}`} /> : null}

        {mode === "pay" ? (
          <fieldset className="grid gap-3 rounded-md border bg-muted/20 p-3 disabled:cursor-wait disabled:opacity-60 md:grid-cols-[180px_1fr]" disabled={busy}>
            <div className="grid gap-1"><Label htmlFor="bulkPaymentDate">Payment date</Label><Input id="bulkPaymentDate" name="paymentDate" type="date" defaultValue={today} required /></div>
            <div className="grid gap-1">
              <Label htmlFor="bulkPaymentMode">Payment mode</Label>
              <select id="bulkPaymentMode" name="paymentModeId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
                <option value="">Select mode</option>
                {paymentModes.map((paymentMode) => <option key={paymentMode.id} value={paymentMode.id}>{paymentMode.name}</option>)}
              </select>
            </div>
          </fieldset>
        ) : null}

        <fieldset disabled={busy} className="disabled:cursor-wait disabled:opacity-60">
          <div className="overflow-hidden rounded-md border">
            <div className="hidden grid-cols-[44px_minmax(180px,1.2fr)_110px_120px_150px_180px_110px] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
              <label className="flex h-11 w-11 items-center justify-center"><span className="sr-only">{mode === "review" ? "Select all workers needing review" : "Select all eligible workers"}</span><input aria-label={mode === "review" ? "Select all workers needing review" : "Select all eligible workers"} checked={allEligibleSelected} disabled={selectAllRows.length === 0} onChange={() => setSelected(allEligibleSelected ? new Set() : new Set(selectAllRows.map(({ calculation }) => calculation.id)))} type="checkbox" /></label>
              <span>Worker</span><span>Attendance</span><span>Suggested</span><span>{mode === "review" ? "Final payable" : "Pay now"}</span><span>{mode === "review" ? "Decision note" : "Outstanding"}</span><span>Status</span>
            </div>
            {filteredRows.map(({ calculation, warnings, worker }) => {
              const eligible = mode === "review" ? true : calculation.finalized_payable_amount !== null && due(calculation) > 0;
              const amountChanged = Number(amounts[calculation.id]) !== calculation.final_payable;
              return (
                <div key={calculation.id} className="border-b last:border-b-0">
                  <div className="grid gap-3 px-3 py-3 lg:grid-cols-[44px_minmax(180px,1.2fr)_110px_120px_150px_180px_110px] lg:items-center">
                    <label className="flex h-11 w-11 items-center justify-center"><span className="sr-only">Select {worker?.name ?? "worker"}</span><input aria-label={`Select ${worker?.name ?? "worker"}`} checked={selected.has(calculation.id)} disabled={!eligible} onChange={() => toggle(calculation.id)} type="checkbox" /></label>
                    <div className="min-w-0"><p className="truncate font-medium">{worker?.name ?? "Unknown worker"}</p><p className="text-xs text-muted-foreground">{calculation.wage_type.replaceAll("_", " ")} · {money.format(calculation.wage_amount)}</p></div>
                    <div className="text-sm"><p className="text-xs text-muted-foreground lg:hidden">Attendance</p><p>{calculation.attendance_days} days</p><p className="text-xs text-muted-foreground">{calculation.attendance_hours} hours</p></div>
                    <div className="text-sm font-medium"><p className="text-xs font-normal text-muted-foreground lg:hidden">Suggested</p>{money.format(calculation.final_payable)}</div>
                    {mode === "review" ? (
                      <div><Label className="mb-1 block text-xs lg:hidden" htmlFor={`bulkPayable-${calculation.id}`}>Final payable</Label><Input id={`bulkPayable-${calculation.id}`} aria-label={`Final payable for ${worker?.name ?? "worker"}`} min={calculation.amount_paid} onChange={(event) => { setAmounts((current) => ({ ...current, [calculation.id]: event.target.value })); if (eligible) setSelected((current) => new Set(current).add(calculation.id)); }} required step="0.01" type="number" value={amounts[calculation.id]} /></div>
                    ) : (
                      <div><Label className="mb-1 block text-xs lg:hidden" htmlFor={`bulkPayment-${calculation.id}`}>Pay now</Label><Input id={`bulkPayment-${calculation.id}`} aria-label={`Payment amount for ${worker?.name ?? "worker"}`} disabled={!eligible} max={due(calculation)} min="0.01" onChange={(event) => { setPaymentAmounts((current) => ({ ...current, [calculation.id]: event.target.value })); if (eligible) setSelected((current) => new Set(current).add(calculation.id)); }} required={eligible} step="0.01" type="number" value={paymentAmounts[calculation.id]} /></div>
                    )}
                    {mode === "review" ? (
                      <div><Label className="mb-1 block text-xs lg:hidden" htmlFor={`bulkNote-${calculation.id}`}>Decision note</Label><Input id={`bulkNote-${calculation.id}`} aria-label={`Decision note for ${worker?.name ?? "worker"}`} onChange={(event) => { setNotes((current) => ({ ...current, [calculation.id]: event.target.value })); if (eligible) setSelected((current) => new Set(current).add(calculation.id)); }} placeholder={amountChanged ? "Required for changed amount" : "Optional"} value={notes[calculation.id]} /></div>
                    ) : <span className="text-sm"><span className="block text-xs text-muted-foreground lg:hidden">Outstanding</span>{money.format(due(calculation))}</span>}
                    <span className="w-fit rounded-full bg-muted px-2 py-1 text-xs font-medium">{statusLabel(calculation)}</span>
                  </div>
                  <details className="border-t bg-muted/15 px-3 py-2 text-sm">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-muted-foreground"><ChevronDown className="h-4 w-4" /> Calculation details</summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      <p>Production: {Math.round((calculation.productive_minutes / 60) * 100) / 100} hours</p>
                      <p>Ledger impact: {money.format(calculation.repayment_credit + calculation.manual_adjustment - calculation.advance_deduction - calculation.loan_deduction - calculation.other_deduction)}</p>
                      <p>Paid: {money.format(calculation.amount_paid)}</p>
                    </div>
                    {warnings.length ? <p className="mt-2 flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" /> {warnings.join(", ")}</p> : <p className="mt-2 flex items-center gap-2 text-emerald-800"><Check className="h-4 w-4" /> No review warnings</p>}
                  </details>
                </div>
              );
            })}
            {!filteredRows.length ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No workers match this filter.</p> : null}
          </div>
        </fieldset>

        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-md border bg-background p-3 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium">{selectedRows.length} selected · {money.format(Number.isFinite(selectedTotal) ? selectedTotal : 0)}</p><p className="text-xs text-muted-foreground">The selected rows save together. If one is invalid, none are changed.</p></div>
          <Button disabled={busy || selectedRows.length === 0 || (mode === "pay" && paymentModes.length === 0)} type="submit">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Saving…" : mode === "review" ? `Finalize ${selectedRows.length || "selected"}` : `Pay ${selectedRows.length || "selected"}`}
          </Button>
        </div>
        <Notice state={mode === "review" ? finalizeState : paymentState} />
      </form>
    </div>
  );
}
