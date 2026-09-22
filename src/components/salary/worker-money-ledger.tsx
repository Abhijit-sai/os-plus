import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkerMoneyCorrectionForms } from "@/components/salary/worker-money-correction-forms";
import type { WorkerMoneyActionState } from "@/features/salary/actions";
import { summarizeWorkerMoney } from "@/features/salary/worker-money";
import type { PaymentMode, Worker, WorkerLedger, WorkerLedgerTransactionType } from "@/types/database";

const typeLabels: Record<WorkerLedgerTransactionType, string> = {
  advance_given: "Advance given",
  loan_given: "Loan given",
  repayment: "Cash repayment",
  deduction: "Salary deduction",
  adjustment: "Salary credit",
  salary_paid: "Salary paid",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 2, style: "currency" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatAuditTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function isCashType(type: WorkerLedgerTransactionType) {
  return type === "advance_given" || type === "loan_given" || type === "repayment" || type === "salary_paid";
}

function effectLabel(entry: WorkerLedger) {
  if (entry.transaction_type === "advance_given") return "Cash out · advance balance increases";
  if (entry.transaction_type === "loan_given") return "Cash out · loan balance increases";
  if (entry.transaction_type === "repayment") return `Cash in · ${entry.balance_account ?? "unallocated"} balance reduces`;
  if (entry.transaction_type === "deduction") return `No cash · salary and ${entry.balance_account ?? "unallocated"} balance reduce`;
  if (entry.transaction_type === "adjustment") return "No cash · salary payable increases";
  return "Cash out · salary settles";
}

export function WorkerMoneyLedger({
  canManage,
  correctAction,
  entries,
  paymentModes,
  reverseAction,
  returnTo,
  workers,
}: {
  canManage: boolean;
  correctAction: (previousState: WorkerMoneyActionState, formData: FormData) => Promise<WorkerMoneyActionState>;
  entries: WorkerLedger[];
  paymentModes: PaymentMode[];
  reverseAction: (previousState: WorkerMoneyActionState, formData: FormData) => Promise<WorkerMoneyActionState>;
  returnTo: "finance" | "salary";
  workers: Worker[];
}) {
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const paymentModeById = new Map(paymentModes.map((mode) => [mode.id, mode]));
  const summary = summarizeWorkerMoney(entries);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Advance balance</p><p className="mt-1 font-semibold">{formatMoney(summary.advanceBalance)}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Loan balance</p><p className="mt-1 font-semibold">{formatMoney(summary.loanBalance)}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">All-time cash out</p><p className="mt-1 font-semibold">{formatMoney(summary.cashOut)}</p><p className="mt-1 text-xs text-muted-foreground">Salary, advances, and loans</p></div>
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">All-time cash returned</p><p className="mt-1 font-semibold">{formatMoney(summary.cashIn)}</p><p className="mt-1 text-xs text-muted-foreground">Worker repayments</p></div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger history</CardTitle>
          <CardDescription>Original and corrected entries remain visible. Reversed entries no longer affect balances or Finance.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {entries.map((entry) => {
              const movesCash = isCashType(entry.transaction_type);
              return (
                <div className="px-4 py-4" key={entry.id}>
                  <div className="grid gap-3 text-sm md:grid-cols-[1.2fr_1fr_140px_120px] md:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{workerById.get(entry.worker_id)?.name ?? "Unknown worker"}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${entry.reversed_at ? "bg-muted text-muted-foreground" : "bg-neutral-950 text-white"}`}>{entry.reversed_at ? "Reversed" : typeLabels[entry.transaction_type]}</span>
                        {entry.corrected_from_entry_id ? <span className="text-xs text-muted-foreground">Corrected entry</span> : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{effectLabel(entry)}</p>
                      {entry.description ? <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p> : null}
                      {entry.reversal_reason ? <p className="mt-2 text-xs text-amber-800">Correction reason: {entry.reversal_reason}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Recorded by {entry.created_by ?? "system"} · {formatAuditTimestamp(entry.created_at)}
                        {entry.corrected_from_entry_id ? ` · Corrects ${entry.corrected_from_entry_id}` : ""}
                        {entry.reversed_at ? ` · Reversed by ${entry.reversed_by ?? "system"} · ${formatAuditTimestamp(entry.reversed_at)}` : ""}
                      </p>
                    </div>
                    <div>
                      <p>{formatDate(entry.transaction_date)}</p>
                      <p className="text-xs text-muted-foreground">{movesCash ? paymentModeById.get(entry.payment_mode_id ?? "")?.name ?? "Payment mode not recorded" : "Non-cash entry"}</p>
                    </div>
                    <p className="font-semibold md:text-right">{formatMoney(entry.amount)}</p>
                    <p className="text-xs text-muted-foreground md:text-right">{entry.balance_account ? `${entry.balance_account} balance` : entry.transaction_type}</p>
                  </div>

                  {canManage && !entry.reversed_at ? (
                    <details className="mt-3 rounded-md bg-muted/40 p-3">
                      <summary className="cursor-pointer text-sm font-medium">Correct or reverse</summary>
                      <WorkerMoneyCorrectionForms
                        correctAction={correctAction}
                        entry={entry}
                        idempotencyKey={crypto.randomUUID()}
                        paymentModes={paymentModes}
                        reverseAction={reverseAction}
                        returnTo={returnTo}
                      />
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!entries.length ? <p className="p-4 text-sm text-muted-foreground">No worker ledger entries match this view.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
