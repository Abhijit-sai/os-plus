"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkerMoneyActionState } from "@/features/salary/actions";
import type { PaymentMode, Worker, WorkerLedgerTransactionType } from "@/types/database";

type EntryType = Exclude<WorkerLedgerTransactionType, "salary_paid">;

const entryTypes: Array<{ label: string; value: EntryType }> = [
  { value: "advance_given", label: "Advance given" },
  { value: "loan_given", label: "Loan given" },
  { value: "repayment", label: "Cash repayment received" },
  { value: "deduction", label: "Salary deduction" },
  { value: "adjustment", label: "Salary credit" },
];

const entryHelp: Record<EntryType, string> = {
  advance_given: "Cash paid to the worker now. Increases their advance balance.",
  loan_given: "Cash paid to the worker now. Increases their loan balance.",
  repayment: "Cash returned by the worker. Reduces the selected balance.",
  deduction: "No cash moves now. Reduces the selected balance and is included when you generate or regenerate a pay period containing this date. It never rewrites a finalized payable.",
  adjustment: "No cash moves now. Adds a credit when you generate or regenerate a pay period containing this date. It never rewrites a finalized payable.",
};

const initialState: WorkerMoneyActionState = { idempotencyKey: null, message: null, ok: false };

export function WorkerMoneyEntryForm({
  action,
  defaultDate,
  idempotencyKey,
  paymentModes,
  workers,
}: {
  action: (previousState: WorkerMoneyActionState, formData: FormData) => Promise<WorkerMoneyActionState>;
  defaultDate: string;
  idempotencyKey: string;
  paymentModes: PaymentMode[];
  workers: Worker[];
}) {
  const router = useRouter();
  const [entryType, setEntryType] = React.useState<EntryType>("advance_given");
  const [state, formAction, pending] = React.useActionState(action, initialState);
  const needsAccount = entryType === "deduction" || entryType === "repayment";
  const movesCash = entryType === "advance_given" || entryType === "loan_given" || entryType === "repayment";
  const paymentModeMissing = movesCash && paymentModes.length === 0;

  React.useEffect(() => {
    if (!state.ok) return;
    router.refresh();
  }, [router, state.idempotencyKey, state.ok]);

  return (
    <form action={formAction} className="space-y-4" data-unsaved-guard="true" key={state.ok ? state.idempotencyKey ?? idempotencyKey : idempotencyKey}>
      <input name="idempotencyKey" type="hidden" value={state.idempotencyKey ?? idempotencyKey} />
      <fieldset className="space-y-4 disabled:opacity-70" disabled={pending}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="workerMoneyWorker">Worker</Label>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" id="workerMoneyWorker" name="workerId" required>
            <option value="">Select worker</option>
            {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="workerMoneyType">Entry type</Label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            id="workerMoneyType"
            name="transactionType"
            onChange={(event) => setEntryType(event.target.value as EntryType)}
            value={entryType}
          >
            {entryTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="workerMoneyAmount">Amount</Label>
          <Input id="workerMoneyAmount" min="0.01" name="amount" required step="0.01" type="number" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="workerMoneyDate">Date</Label>
          <Input defaultValue={defaultDate} id="workerMoneyDate" name="transactionDate" required type="date" />
        </div>
        {needsAccount ? (
          <div className="grid gap-2">
            <Label htmlFor="workerMoneyAccount">Balance to reduce</Label>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" id="workerMoneyAccount" name="balanceAccount" required>
              <option value="">Select balance</option>
              <option value="advance">Advance</option>
              <option value="loan">Loan</option>
            </select>
          </div>
        ) : <input name="balanceAccount" type="hidden" value="" />}
        {movesCash ? (
          <div className="grid gap-2">
            <Label htmlFor="workerMoneyMode">Payment mode</Label>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" id="workerMoneyMode" name="paymentModeId" required>
              <option value="">Select mode</option>
              {paymentModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
            </select>
          </div>
        ) : <input name="paymentModeId" type="hidden" value="" />}
        <div className="grid gap-2 md:col-span-2 xl:col-span-3">
          <Label htmlFor="workerMoneyNote">Note</Label>
          <Input id="workerMoneyNote" name="description" placeholder="Purpose or context" />
        </div>
        </div>
        <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[75ch] text-muted-foreground">{entryHelp[entryType]}</p>
          <Button disabled={paymentModeMissing} pendingLabel="Recording entry..." type="submit">Record entry</Button>
        </div>
      </fieldset>
      {paymentModeMissing ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
          Add an active payment mode in Settings before recording this cash movement.
        </div>
      ) : null}
      {state.message && state.ok ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950" role="status">
          {state.message}
        </div>
      ) : null}
      {state.message && !state.ok ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
