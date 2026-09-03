"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkerMoneyActionState } from "@/features/salary/actions";
import type { PaymentMode, WorkerLedger } from "@/types/database";

type WorkerMoneyFormAction = (
  previousState: WorkerMoneyActionState,
  formData: FormData,
) => Promise<WorkerMoneyActionState>;

const initialState: WorkerMoneyActionState = { idempotencyKey: null, message: null, ok: false };

function ActionNotice({ state }: { state: WorkerMoneyActionState }) {
  if (!state.message) return null;

  if (state.ok) {
    return <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950" role="status">{state.message}</div>;
  }

  return <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{state.message}</div>;
}

function CorrectionForm({
  action,
  entry,
  idempotencyKey,
  paymentModes,
  returnTo,
}: {
  action: WorkerMoneyFormAction;
  entry: WorkerLedger;
  idempotencyKey: string;
  paymentModes: PaymentMode[];
  returnTo: "finance" | "salary";
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const movesCash = ["advance_given", "loan_given", "repayment", "salary_paid"].includes(entry.transaction_type);
  const needsAccount = entry.transaction_type === "deduction" || entry.transaction_type === "repayment";

  React.useEffect(() => {
    if (!state.ok) return;
    if (formRef.current) delete formRef.current.dataset.unsavedDirty;
    router.refresh();
  }, [router, state.idempotencyKey, state.ok]);

  return (
    <form action={formAction} className="space-y-3 rounded-md border bg-background p-3" data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={formRef}>
      <input name="entryId" type="hidden" value={entry.id} />
      <input name="idempotencyKey" type="hidden" value={state.idempotencyKey ?? idempotencyKey} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <p className="text-sm font-medium">Correct with a replacement</p>
      <fieldset className="grid gap-3 disabled:opacity-70 sm:grid-cols-2" disabled={pending}>
        <div className="grid gap-1">
          <Label htmlFor={`correctAmount-${entry.id}`}>Amount</Label>
          <Input defaultValue={entry.amount} id={`correctAmount-${entry.id}`} min="0.01" name="amount" required step="0.01" type="number" />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`correctDate-${entry.id}`}>Date</Label>
          <Input defaultValue={entry.transaction_date} id={`correctDate-${entry.id}`} name="transactionDate" required type="date" />
        </div>
        {needsAccount ? (
          <div className="grid gap-1">
            <Label htmlFor={`correctAccount-${entry.id}`}>Balance</Label>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={entry.balance_account ?? ""} id={`correctAccount-${entry.id}`} name="balanceAccount" required>
              <option value="">Select</option>
              <option value="advance">Advance</option>
              <option value="loan">Loan</option>
            </select>
          </div>
        ) : <input name="balanceAccount" type="hidden" value="" />}
        {movesCash ? (
          <div className="grid gap-1">
            <Label htmlFor={`correctMode-${entry.id}`}>Payment mode</Label>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={entry.payment_mode_id ?? ""} id={`correctMode-${entry.id}`} name="paymentModeId" required>
              <option value="">Select</option>
              {paymentModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
            </select>
          </div>
        ) : <input name="paymentModeId" type="hidden" value="" />}
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor={`correctNote-${entry.id}`}>Note</Label>
          <Input defaultValue={entry.description ?? ""} id={`correctNote-${entry.id}`} name="description" />
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <Label htmlFor={`correctReason-${entry.id}`}>Correction reason</Label>
          <Input id={`correctReason-${entry.id}`} minLength={3} name="correctionReason" required />
        </div>
        <div className="sm:col-span-2">
          <Button pendingLabel="Saving correction..." size="sm" type="submit">Save correction</Button>
        </div>
      </fieldset>
      <ActionNotice state={state} />
    </form>
  );
}

function ReversalForm({
  action,
  entry,
  returnTo,
}: {
  action: WorkerMoneyFormAction;
  entry: WorkerLedger;
  returnTo: "finance" | "salary";
}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = React.useActionState(action, initialState);

  React.useEffect(() => {
    if (!state.ok) return;
    if (formRef.current) delete formRef.current.dataset.unsavedDirty;
    router.refresh();
  }, [router, state.idempotencyKey, state.ok]);

  return (
    <form action={formAction} className="space-y-3 rounded-md border bg-background p-3" data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={formRef}>
      <input name="entryId" type="hidden" value={entry.id} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <p className="text-sm font-medium">Reverse without replacement</p>
      <p className="text-xs text-muted-foreground">The original remains in history but stops affecting balances, salary, and Finance.</p>
      <fieldset className="space-y-3 disabled:opacity-70" disabled={pending}>
        <div className="grid gap-1">
          <Label htmlFor={`reverseReason-${entry.id}`}>Reversal reason</Label>
          <Input id={`reverseReason-${entry.id}`} minLength={3} name="correctionReason" required />
        </div>
        <Button pendingLabel="Reversing entry..." size="sm" type="submit" variant="outline">Reverse entry</Button>
      </fieldset>
      <ActionNotice state={state} />
    </form>
  );
}

export function WorkerMoneyCorrectionForms({
  correctAction,
  entry,
  idempotencyKey,
  paymentModes,
  reverseAction,
  returnTo,
}: {
  correctAction: WorkerMoneyFormAction;
  entry: WorkerLedger;
  idempotencyKey: string;
  paymentModes: PaymentMode[];
  reverseAction: WorkerMoneyFormAction;
  returnTo: "finance" | "salary";
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <CorrectionForm action={correctAction} entry={entry} idempotencyKey={idempotencyKey} paymentModes={paymentModes} returnTo={returnTo} />
      <ReversalForm action={reverseAction} entry={entry} returnTo={returnTo} />
    </div>
  );
}
