import Link from "next/link";

import {
  correctWorkerMoneyEntryAction,
  finalizeSalaryCalculationsBulkAction,
  generateSalarySuggestionsAction,
  recordSalaryPaymentsBulkAction,
  reverseWorkerMoneyEntryAction,
  updateSalaryPeriodAction,
} from "@/features/salary/actions";
import { getSalaryPeriodWorkspaceData } from "@/features/salary/queries";
import { SalaryPeriodBulkWorkspace } from "@/components/salary/salary-period-bulk-workspace";
import {
  RegenerateSalaryPeriodForm,
  UpdateSalaryPeriodForm,
} from "@/components/salary/salary-workflow-forms";
import { WorkerMoneyCorrectionForms } from "@/components/salary/worker-money-correction-forms";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { hasPermission } from "@/lib/permissions/roles";
import type { SalaryCalculation } from "@/types/database";

const money = new Intl.NumberFormat("en-IN", { currency: "INR", style: "currency" });

function dateLabel(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} to ${formatter.format(new Date(`${end}T00:00:00.000Z`))}`;
}

function displayStatus({ due, finalizedCount, paid, paidCount, workerCount }: { due: number; finalizedCount: number; paid: number; paidCount: number; workerCount: number }) {
  if (workerCount > 0 && paidCount === workerCount) return "Paid";
  if (paid > 0) return "Partially paid";
  if (finalizedCount > 0 && due > 0) return "Ready to pay";
  return "Draft";
}

function warnings(calculation: SalaryCalculation) {
  return [
    calculation.wage_type === "per_piece" || calculation.wage_type === "hybrid" ? "Manual wage review" : null,
    calculation.attendance_days === 0 && calculation.attendance_hours === 0 ? "No attendance input" : null,
    calculation.final_payable === 0 && calculation.gross_suggested_amount > 0 ? "Fully deducted" : null,
    calculation.amount_paid > (calculation.finalized_payable_amount ?? calculation.final_payable) ? "Paid exceeds payable" : null,
  ].filter(Boolean) as string[];
}

export default async function SalaryPeriodWorkspacePage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = await params;
  const data = await getSalaryPeriodWorkspaceData(periodId);
  const { period, ...summary } = data.periodSummary;
  const label = dateLabel(period.period_start, period.period_end);
  const canManage = hasPermission(data.context.membership.role, "salary:manage");
  const canRegenerate =
    period.status === "draft" &&
    data.calculations.every(
      ({ calculation }) =>
        calculation.finalized_payable_amount === null && calculation.amount_paid === 0,
    );
  const returnHref = `/salary/periods/${period.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <PageHeader title="Salary period" description={`${label} · Review everyone, finalize payables, then record payments.`} />
        <Button asChild variant="outline"><Link href="/salary?view=periods">Back to pay periods</Link></Button>
      </div>

      <div className="border-y py-4">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 font-medium">{displayStatus(summary)}</p></div>
          <div><p className="text-xs text-muted-foreground">Workers</p><p className="mt-1 font-medium">{summary.workerCount}</p></div>
          <div><p className="text-xs text-muted-foreground">Reviewed</p><p className="mt-1 font-medium">{summary.finalizedCount}/{summary.workerCount}</p></div>
          <div><p className="text-xs text-muted-foreground">Payable</p><p className="mt-1 font-medium">{money.format(summary.payable)}</p></div>
          <div><p className="text-xs text-muted-foreground">Paid</p><p className="mt-1 font-medium">{money.format(summary.paid)}</p></div>
          <div><p className="text-xs text-muted-foreground">Due</p><p className="mt-1 font-medium">{money.format(summary.due)}</p></div>
        </div>
      </div>

      {canManage && canRegenerate ? (
        <details className="rounded-md border p-4">
          <summary className="cursor-pointer font-medium">Period settings</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Before any payable is finalized or paid, you can change the dates or rebuild suggestions from current attendance and worker settings.
          </p>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
            <RegenerateSalaryPeriodForm
              action={generateSalarySuggestionsAction}
              idempotencyKey={crypto.randomUUID()}
              returnHref={returnHref}
              salaryPeriodId={period.id}
            />
            <UpdateSalaryPeriodForm
              action={updateSalaryPeriodAction}
              idempotencyKey={crypto.randomUUID()}
              periodEnd={period.period_end}
              periodStart={period.period_start}
              returnHref={returnHref}
              salaryPeriodId={period.id}
            />
          </div>
        </details>
      ) : null}

      <SalaryPeriodBulkWorkspace
        key={data.calculations.map(({ calculation }) => `${calculation.id}:${calculation.updated_at}`).join("|")}
        finalizeAction={finalizeSalaryCalculationsBulkAction}
        finalizeKey={crypto.randomUUID()}
        paymentAction={recordSalaryPaymentsBulkAction}
        paymentKey={crypto.randomUUID()}
        paymentModes={data.paymentModes}
        periodId={period.id}
        periodLabel={label}
        rows={data.calculations.map(({ calculation, worker }) => ({ calculation, worker, warnings: warnings(calculation) }))}
        today={new Date().toISOString().slice(0, 10)}
      />

      <details className="rounded-md border p-4">
        <summary className="cursor-pointer font-medium">Period audit and payment history ({data.ledger.length + data.revisions.length})</summary>
        <div className="mt-4 space-y-2 text-sm">
          {data.revisions.map((revision) => (
            <div key={revision.id} className="grid gap-1 border-b pb-2 md:grid-cols-[1fr_auto]">
              <p>Payable decision: {revision.previous_finalized_payable_amount === null ? "Not finalized" : money.format(revision.previous_finalized_payable_amount)} to {money.format(revision.new_finalized_payable_amount)}</p>
              <p className="text-muted-foreground">{revision.created_by ?? "system"} · {new Date(revision.created_at).toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground md:col-span-2">{revision.reason}</p>
            </div>
          ))}
          {data.ledger.map((entry) => (
            <div key={entry.id} className="border-b pb-3">
              <div className="grid gap-1 md:grid-cols-[1fr_auto]">
                <p>{entry.transaction_type.replaceAll("_", " ")} · {money.format(entry.amount)}{entry.reversed_at ? " · Reversed" : ""}</p>
                <p className="text-muted-foreground">{entry.transaction_date} · {entry.created_by ?? "system"}</p>
                {entry.description ? <p className="text-xs text-muted-foreground md:col-span-2">{entry.description}</p> : null}
              </div>
              {canManage && entry.transaction_type === "salary_paid" && !entry.reversed_at ? (
                <details className="mt-3 rounded-md bg-muted/40 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Correct or reverse payment</summary>
                  <WorkerMoneyCorrectionForms
                    correctAction={correctWorkerMoneyEntryAction}
                    entry={entry}
                    idempotencyKey={crypto.randomUUID()}
                    paymentModes={data.paymentModes}
                    reverseAction={reverseWorkerMoneyEntryAction}
                    returnTo="salary"
                  />
                </details>
              ) : null}
            </div>
          ))}
          {!data.ledger.length && !data.revisions.length ? <p className="text-muted-foreground">No saved decisions or payments yet.</p> : null}
        </div>
      </details>
    </div>
  );
}
