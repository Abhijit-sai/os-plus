"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, RefreshCw } from "lucide-react";

import type { SalaryWorkflowActionState } from "@/features/salary/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMode, SalaryCalculation } from "@/types/database";

type SalaryWorkflowAction = (previousState: SalaryWorkflowActionState, formData: FormData) => Promise<SalaryWorkflowActionState>;

function actionState(idempotencyKey: string): SalaryWorkflowActionState {
  return { idempotencyKey, message: null, ok: false };
}

function ActionNotice({ state }: { state: SalaryWorkflowActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={state.ok ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950" : "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"}
      role={state.ok ? "status" : "alert"}
    >
      {state.message}
    </div>
  );
}

function navigateAfterSuccess(router: ReturnType<typeof useRouter>, returnHref: string) {
  router.replace(returnHref);
  router.refresh();
}

function clearSavedDirtyState(form: HTMLFormElement | null) {
  if (form) delete form.dataset.unsavedDirty;
}

export function SalaryPeriodCreateForm({ action, activeWorkerCount, idempotencyKey }: { action: SalaryWorkflowAction; activeWorkerCount: number; idempotencyKey: string }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = React.useActionState(action, actionState(idempotencyKey));
  const [previewInvalidated, setPreviewInvalidated] = React.useState(false);
  const activeKey = state.idempotencyKey ?? idempotencyKey;

  React.useEffect(() => {
    if (!state.ok || !state.periodId) return;
    clearSavedDirtyState(formRef.current);
    formRef.current?.reset();
    navigateAfterSuccess(router, `/salary/periods/${state.periodId}`);
  }, [router, state.idempotencyKey, state.ok, state.periodId]);

  return (
    <form action={formAction} className="space-y-3" data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={formRef}>
      <input name="idempotencyKey" type="hidden" value={activeKey} />
      <input name="previewFingerprint" type="hidden" value={previewInvalidated ? "" : state.preview?.fingerprint ?? ""} />
      <p className="text-sm text-muted-foreground">
        {activeWorkerCount} active {activeWorkerCount === 1 ? "worker" : "workers"} will receive draft suggestions. Attendance gaps remain flagged for review before payment.
      </p>
      <fieldset className="grid gap-3 disabled:cursor-wait disabled:opacity-60 sm:grid-cols-[1fr_1fr_auto] sm:items-end" disabled={pending || activeWorkerCount === 0}>
        <legend className="sr-only">Create salary period</legend>
        <div className="grid gap-2"><Label htmlFor="periodStart">Start</Label><Input id="periodStart" name="periodStart" type="date" onChange={() => setPreviewInvalidated(Boolean(state.preview))} required /></div>
        <div className="grid gap-2"><Label htmlFor="periodEnd">End</Label><Input id="periodEnd" name="periodEnd" type="date" onChange={() => setPreviewInvalidated(Boolean(state.preview))} required /></div>
        <Button name="intent" onClick={() => setPreviewInvalidated(false)} type="submit" value="preview" variant={state.preview ? "outline" : "default"}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {pending ? "Checking…" : state.preview ? "Refresh preview" : "Preview"}
        </Button>
      </fieldset>
      {state.preview && !previewInvalidated ? (
        <div className="rounded-md border bg-muted/30 p-3 text-sm" role="status">
          <p className="font-medium">Ready to create {state.preview.workerCount} worker suggestions</p>
          <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>{state.preview.attendanceEntryCount} attendance entries across {state.preview.attendanceWorkerCount} workers</span>
            <span>{state.preview.missingAttendanceWorkerCount} workers have no attendance entries in this range</span>
            <span>Suggested total: {new Intl.NumberFormat("en-IN", { currency: "INR", style: "currency" }).format(state.preview.suggestedPayable)}</span>
          </div>
          <Button className="mt-3" disabled={pending} name="intent" type="submit" value="create">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Creating…" : "Confirm and create"}
          </Button>
        </div>
      ) : null}
      {state.preview && previewInvalidated ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          Dates changed after preview. Refresh the preview before creating this period.
        </div>
      ) : null}
      <ActionNotice state={state} />
      {activeWorkerCount === 0 ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">Add or reactivate a worker before creating a salary period.</div> : null}
      {!state.ok && state.periodId ? (
        <Button type="button" variant="outline" onClick={() => navigateAfterSuccess(router, `/salary/periods/${state.periodId}`)}>
          Open overlapping period
        </Button>
      ) : null}
    </form>
  );
}

export function RegenerateSalaryPeriodForm({ action, idempotencyKey, returnHref, salaryPeriodId }: { action: SalaryWorkflowAction; idempotencyKey: string; returnHref: string; salaryPeriodId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = React.useActionState(action, actionState(idempotencyKey));
  const activeKey = state.idempotencyKey ?? idempotencyKey;

  React.useEffect(() => {
    if (!state.ok) return;
    navigateAfterSuccess(router, returnHref);
  }, [returnHref, router, state.idempotencyKey, state.ok]);

  return (
    <form action={formAction} className="space-y-2">
      <input name="salaryPeriodId" type="hidden" value={salaryPeriodId} />
      <input name="idempotencyKey" type="hidden" value={activeKey} />
      <Button disabled={pending} type="submit" size="sm" variant="outline">
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Regenerating…" : "Regenerate"}
      </Button>
      <ActionNotice state={state} />
    </form>
  );
}

export function UpdateSalaryPeriodForm({ action, idempotencyKey, periodEnd, periodStart, returnHref, salaryPeriodId }: {
  action: SalaryWorkflowAction;
  idempotencyKey: string;
  periodEnd: string;
  periodStart: string;
  returnHref: string;
  salaryPeriodId: string;
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = React.useActionState(action, actionState(idempotencyKey));

  React.useEffect(() => {
    if (!state.ok) return;
    clearSavedDirtyState(formRef.current);
    navigateAfterSuccess(router, returnHref);
  }, [returnHref, router, state.idempotencyKey, state.ok]);

  return (
    <details className="rounded-md border bg-background p-2">
      <summary className="cursor-pointer text-sm font-medium">Edit period dates</summary>
      <form action={formAction} className="mt-3 space-y-3" data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={formRef}>
        <input name="salaryPeriodId" type="hidden" value={salaryPeriodId} />
        <input name="idempotencyKey" type="hidden" value={state.idempotencyKey ?? idempotencyKey} />
        <fieldset className="grid gap-2 disabled:cursor-wait disabled:opacity-60 sm:grid-cols-[1fr_1fr_auto] sm:items-end" disabled={pending}>
          <legend className="sr-only">Edit salary period dates</legend>
          <div className="grid gap-1"><Label htmlFor={`editPeriodStart-${salaryPeriodId}`} className="text-xs">Start</Label><Input id={`editPeriodStart-${salaryPeriodId}`} name="periodStart" type="date" defaultValue={periodStart} required /></div>
          <div className="grid gap-1"><Label htmlFor={`editPeriodEnd-${salaryPeriodId}`} className="text-xs">End</Label><Input id={`editPeriodEnd-${salaryPeriodId}`} name="periodEnd" type="date" defaultValue={periodEnd} required /></div>
          <Button size="sm" type="submit">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{pending ? "Updating…" : "Update dates"}</Button>
        </fieldset>
        <p className="text-xs text-muted-foreground">Available only before any worker payable is finalized or paid. Suggestions are recalculated atomically for the new dates.</p>
        <ActionNotice state={state} />
      </form>
    </details>
  );
}

export function SalaryCalculationWorkflow({ calculation, finalizeAction, idempotencyKeys, paymentAction, paymentModes, periodLabel, returnHref, today }: {
  calculation: SalaryCalculation;
  finalizeAction: SalaryWorkflowAction;
  idempotencyKeys: { finalize: string; payment: string };
  paymentAction: SalaryWorkflowAction;
  paymentModes: PaymentMode[];
  periodLabel: string;
  returnHref: string;
  today: string;
}) {
  const router = useRouter();
  const finalizeFormRef = React.useRef<HTMLFormElement>(null);
  const paymentFormRef = React.useRef<HTMLFormElement>(null);
  const [finalizeState, finalizeFormAction, finalizePending] = React.useActionState(finalizeAction, actionState(idempotencyKeys.finalize));
  const [paymentState, paymentFormAction, paymentPending] = React.useActionState(paymentAction, actionState(idempotencyKeys.payment));
  const isFinalized = calculation.finalized_payable_amount !== null;
  const payable = calculation.finalized_payable_amount ?? calculation.final_payable;
  const due = Math.max(0, payable - calculation.amount_paid);
  const noPaymentDue = isFinalized && due <= 0;
  const paymentModesMissing = paymentModes.length === 0;
  const busy = finalizePending || paymentPending;

  React.useEffect(() => {
    if (!finalizeState.ok) return;
    clearSavedDirtyState(finalizeFormRef.current);
    navigateAfterSuccess(router, returnHref);
  }, [finalizeState.idempotencyKey, finalizeState.ok, returnHref, router]);

  React.useEffect(() => {
    if (!paymentState.ok) return;
    clearSavedDirtyState(paymentFormRef.current);
    paymentFormRef.current?.reset();
    navigateAfterSuccess(router, returnHref);
  }, [paymentState.idempotencyKey, paymentState.ok, returnHref, router]);

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border bg-background p-3">
        <div className="mb-3">
          <p className="text-sm font-medium">1. Confirm payable</p>
          <p className="text-xs text-muted-foreground">Review the suggestion, then save the amount actually owed. A decision note is required when the amount changes.</p>
        </div>
        <form action={finalizeFormAction} data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={finalizeFormRef}>
          <input name="salaryCalculationId" type="hidden" value={calculation.id} />
          <input name="idempotencyKey" type="hidden" value={finalizeState.idempotencyKey ?? idempotencyKeys.finalize} />
          <fieldset className="grid gap-2 disabled:cursor-wait disabled:opacity-60 sm:grid-cols-[160px_1fr_auto] sm:items-end" disabled={busy}>
            <legend className="sr-only">Confirm worker salary payable</legend>
            <div className="grid gap-1">
              <Label htmlFor={`finalizedPayableAmount-${calculation.id}`} className="text-xs">Payable amount</Label>
              <Input id={`finalizedPayableAmount-${calculation.id}`} name="finalizedPayableAmount" type="number" min={calculation.amount_paid} step="0.01" defaultValue={payable} required />
              {calculation.amount_paid > 0 ? <span className="text-xs text-muted-foreground">Cannot be lower than the amount already paid.</span> : null}
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`finalizationNote-${calculation.id}`} className="text-xs">Decision note</Label>
              <Input id={`finalizationNote-${calculation.id}`} name="finalizationNote" defaultValue={calculation.finalization_note ?? ""} placeholder="Required when changing the suggestion" />
            </div>
            <Button type="submit" size="sm">
              {finalizePending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {finalizePending ? "Saving…" : isFinalized ? "Update payable" : "Save payable"}
            </Button>
          </fieldset>
        </form>
        <div className="mt-2"><ActionNotice state={finalizeState} /></div>
      </div>

      <div className="rounded-md border bg-background p-3">
        <div className="mb-3">
          <p className="text-sm font-medium">2. Record payment</p>
          <p className="text-xs text-muted-foreground">
            {!isFinalized ? "Save payable in step 1 to unlock payment recording." : noPaymentDue ? "No payment is due for this worker." : "Record money actually paid. It will appear in Salary, Worker details, and Finance."}
          </p>
        </div>
        <form action={paymentFormAction} data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={paymentFormRef}>
          <input name="salaryCalculationId" type="hidden" value={calculation.id} />
          <input name="idempotencyKey" type="hidden" value={paymentState.idempotencyKey ?? idempotencyKeys.payment} />
          <input name="description" type="hidden" value={`Salary paid for ${periodLabel}`} />
          <fieldset className="grid gap-2 disabled:cursor-not-allowed disabled:opacity-60 sm:grid-cols-[140px_150px_1fr_auto] sm:items-end" disabled={busy || !isFinalized || noPaymentDue || paymentModesMissing}>
            <legend className="sr-only">Record salary payment</legend>
            <div className="grid gap-1"><Label htmlFor={`paymentAmount-${calculation.id}`} className="text-xs">Payment amount</Label><Input id={`paymentAmount-${calculation.id}`} name="amount" type="number" min="0.01" max={due} step="0.01" defaultValue={due > 0 ? due : undefined} required /></div>
            <div className="grid gap-1"><Label htmlFor={`paymentDate-${calculation.id}`} className="text-xs">Date</Label><Input id={`paymentDate-${calculation.id}`} name="paymentDate" type="date" defaultValue={today} required /></div>
            <div className="grid gap-1">
              <Label htmlFor={`paymentModeId-${calculation.id}`} className="text-xs">Mode</Label>
              <select id={`paymentModeId-${calculation.id}`} name="paymentModeId" className="h-10 rounded-md border bg-background px-3 text-sm" required>
                <option value="">Select mode</option>
                {paymentModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
              </select>
            </div>
            <Button type="submit" size="sm" variant="outline">
              {paymentPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {paymentPending ? "Recording…" : "Record payment"}
            </Button>
          </fieldset>
        </form>
        {paymentModesMissing && isFinalized && due > 0 ? <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">Add an active payment mode in Settings before recording this payment.</div> : null}
        <div className="mt-2"><ActionNotice state={paymentState} /></div>
      </div>
    </div>
  );
}
