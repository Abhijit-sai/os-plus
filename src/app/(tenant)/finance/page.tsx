import Link from "next/link";
import type React from "react";
import { Download, Pencil, Plus, ReceiptText } from "lucide-react";

import {
  createExpenseAction,
  createReceivablePayableAction,
  updateExpenseAction,
  updateOrderPaymentAction,
  updateReceivablePayableAction
} from "@/features/finance/actions";
import { getFinancePageData } from "@/features/finance/queries";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/design-system/status-badge";
import { ExpenseGstFields } from "@/components/finance/expense-gst-fields";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { hasPermission } from "@/lib/permissions/roles";
import type { Expense, GstTreatment, OrderPayment, PaymentMode, PaymentStatus, ReceivablePayable, ReceivablePayableStatus, ReceivablePayableType, WorkerLedger } from "@/types/database";

type FinanceTab = "dashboard" | "cashflow" | "receivables" | "payables" | "pl" | "balance" | "gst";
type RangeKey = "today" | "week" | "mtd" | "ytd" | "custom";
type GstReportData = NonNullable<Awaited<ReturnType<typeof getFinancePageData>>["gstReport"]>;
type FinanceOrder = {
  id: string;
  order_number: string;
  reference_order_id: string | null;
  customer_id: string;
  order_date: string;
  gst_treatment: GstTreatment;
  gst_rate: number;
  taxable_amount: number;
  gst_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  promised_delivery_date: string | null;
};

const financeTabs: Array<{ value: FinanceTab; label: string }> = [
  { value: "dashboard", label: "Dashboard" },
  { value: "cashflow", label: "Cashflow" },
  { value: "receivables", label: "Receivables" },
  { value: "payables", label: "Payables" },
  { value: "pl", label: "P&L" },
  { value: "balance", label: "Balance" },
  { value: "gst", label: "GST" }
];

const gstTreatmentLabels: Record<GstTreatment, string> = {
  exempt_or_nil: "Exempt / nil rated",
  non_gst: "Non-GST",
  not_applicable: "Not applicable",
  taxable_exclusive: "GST added on top",
  taxable_inclusive: "GST included in amount"
};

const rangeOptions: Array<{ value: RangeKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
  { value: "custom", label: "Custom" }
];

const receivablePayableTypes: Array<{ value: ReceivablePayableType; label: string }> = [
  { value: "receivable", label: "Receivable" },
  { value: "payable", label: "Payable" }
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: string | null) {
  if (!date) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDecimal(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(amount);
}

function getDueBalance(entry: Pick<ReceivablePayable, "amount" | "amount_settled">) {
  return Math.max(Number(entry.amount) - Number(entry.amount_settled ?? 0), 0);
}

function getDerivedDueStatus(entry: Pick<ReceivablePayable, "amount" | "amount_settled" | "due_date" | "status">): ReceivablePayableStatus {
  if (entry.status === "cancelled") {
    return "cancelled";
  }

  const settled = Number(entry.amount_settled ?? 0);
  const amount = Number(entry.amount);

  if (settled >= amount) {
    return "paid";
  }

  if (settled > 0) {
    return "partially_paid";
  }

  if (entry.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${entry.due_date}T00:00:00`);

    if (due.getTime() < today.getTime()) {
      return "overdue";
    }
  }

  return "open";
}

function getRangeBounds(range: RangeKey, start?: string, end?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "today") {
    return { start: today, end: today };
  }

  if (range === "week") {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return { start: monday, end: today };
  }

  if (range === "mtd") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: today };
  }

  if (range === "custom" && start && end) {
    return { start: new Date(`${start}T00:00:00`), end: new Date(`${end}T00:00:00`) };
  }

  return { start: new Date(now.getFullYear(), 0, 1), end: today };
}

function isInRange(date: string | null, range: ReturnType<typeof getRangeBounds>) {
  if (!date) {
    return false;
  }

  const value = new Date(`${date}T00:00:00`);
  return value >= range.start && value <= range.end;
}

function FinanceDialogButton({
  children,
  variant = "outline"
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <span
      className={`inline-flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-medium ${
        variant === "default"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : variant === "ghost"
            ? "hover:bg-accent hover:text-accent-foreground"
            : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function buildFinanceHref({
  gstIncludeNonGst,
  tab,
  range,
  start,
  end
}: {
  gstIncludeNonGst?: boolean;
  tab: FinanceTab;
  range: RangeKey;
  start?: string;
  end?: string;
}) {
  const params = new URLSearchParams({ tab, range });

  if (tab === "gst" && gstIncludeNonGst) {
    params.set("gstIncludeNonGst", "true");
  }

  if (range === "custom") {
    if (start) {
      params.set("start", start);
    }

    if (end) {
      params.set("end", end);
    }
  }

  return `/finance?${params.toString()}`;
}

function buildGstExportHref({
  end,
  includeNonGst,
  start
}: {
  end: string;
  includeNonGst: boolean;
  start: string;
}) {
  const params = new URLSearchParams({ end, includeNonGst: String(includeNonGst), start });
  return `/api/finance/gst-report/export?${params.toString()}`;
}

function buildGstInclusionHref({
  includeNonGst,
  range,
  start,
  end
}: {
  includeNonGst: boolean;
  range: RangeKey;
  start?: string;
  end?: string;
}) {
  const params = new URLSearchParams({ gstIncludeNonGst: String(includeNonGst), range, tab: "gst" });

  if (range === "custom") {
    if (start) {
      params.set("start", start);
    }

    if (end) {
      params.set("end", end);
    }
  }

  return `/finance?${params.toString()}`;
}

function AddExpenseDialog({
  defaultExpenseGstRate,
  defaultExpenseGstTreatment,
  expenseCategories,
  gstRegistered,
  paymentModes
}: {
  defaultExpenseGstRate: number;
  defaultExpenseGstTreatment: GstTreatment;
  expenseCategories: Array<{ id: string; name: string }>;
  gstRegistered: boolean;
  paymentModes: PaymentMode[];
}) {
  return (
    <Dialog
      title="Add expense"
      description="Record operational spend. Recurring expenses are not part of MVP yet."
      trigger={
        <FinanceDialogButton>
          <Plus className="h-4 w-4" />
          Expense
        </FinanceDialogButton>
      }
    >
      <form action={createExpenseAction} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="expenseDate">Expense date</Label>
          <Input id="expenseDate" name="expenseDate" type="date" defaultValue={todayIsoDate()} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="categoryId">Category</Label>
          <select id="categoryId" name="categoryId" className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">No category</option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paymentModeId">Payment mode</Label>
          <select id="paymentModeId" name="paymentModeId" className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">No payment mode</option>
            {paymentModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paidTo">Paid to</Label>
          <Input id="paidTo" name="paidTo" placeholder="Vendor, worker, landlord..." />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="Optional note" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="receiptUrl">Receipt URL</Label>
          <Input id="receiptUrl" name="receiptUrl" placeholder="Optional" />
        </div>
        <ExpenseGstFields
          defaultGstRate={defaultExpenseGstRate}
          defaultGstTreatment={defaultExpenseGstTreatment}
          gstRegistered={gstRegistered}
        />
        <Button type="submit">Add expense</Button>
      </form>
    </Dialog>
  );
}

function AddManualDueDialog() {
  return (
    <Dialog
      title="Add manual due"
      description="Track non-order receivables and payables. Order receivables are automatic."
      trigger={
        <FinanceDialogButton variant="default">
          <ReceiptText className="h-4 w-4" />
          Due
        </FinanceDialogButton>
      }
    >
      <form action={createReceivablePayableAction} className="space-y-4">
        <ManualDueFields />
        <Button type="submit">Add record</Button>
      </form>
    </Dialog>
  );
}

function ManualDueFields({ entry }: { entry?: ReceivablePayable }) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `entryType-${entry.id}` : "type"}>Type</Label>
        <select id={entry ? `entryType-${entry.id}` : "type"} name="type" defaultValue={entry?.type} className="h-10 rounded-md border bg-background px-3 text-sm" required>
          {receivablePayableTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `partyName-${entry.id}` : "partyName"}>Party name</Label>
        <Input id={entry ? `partyName-${entry.id}` : "partyName"} name="partyName" defaultValue={entry?.party_name ?? ""} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `rpAmount-${entry.id}` : "rpAmount"}>Total amount</Label>
        <Input id={entry ? `rpAmount-${entry.id}` : "rpAmount"} name="amount" type="number" min="0.01" step="0.01" defaultValue={entry?.amount} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `amountSettled-${entry.id}` : "amountSettled"}>Amount settled</Label>
        <Input id={entry ? `amountSettled-${entry.id}` : "amountSettled"} name="amountSettled" type="number" min="0" step="0.01" defaultValue={entry?.amount_settled ?? 0} />
        <p className="text-xs text-muted-foreground">Received for receivables, paid for payables. Balance is calculated automatically.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `dueDate-${entry.id}` : "dueDate"}>Due date</Label>
        <Input id={entry ? `dueDate-${entry.id}` : "dueDate"} name="dueDate" type="date" defaultValue={entry?.due_date ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `settledAt-${entry.id}` : "settledAt"}>Settlement date</Label>
        <Input id={entry ? `settledAt-${entry.id}` : "settledAt"} name="settledAt" type="date" defaultValue={entry?.settled_at ?? ""} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={entry ? `rpDescription-${entry.id}` : "rpDescription"}>Description</Label>
        <Input id={entry ? `rpDescription-${entry.id}` : "rpDescription"} name="description" defaultValue={entry?.description ?? ""} placeholder="Optional note" />
      </div>
    </>
  );
}

function EditManualDueDialog({ entry }: { entry: ReceivablePayable }) {
  return (
    <Dialog
      title="Edit manual due"
      description="Update amount, settled amount, due date, and notes. Status is derived automatically."
      trigger={
        <FinanceDialogButton variant="ghost">
          <Pencil className="h-4 w-4" />
          Edit
        </FinanceDialogButton>
      }
    >
      <form action={updateReceivablePayableAction} className="space-y-4">
        <input type="hidden" name="entryId" value={entry.id} />
        <ManualDueFields entry={entry} />
        <Button type="submit">Save due</Button>
      </form>
    </Dialog>
  );
}

function EditExpenseDialog({
  defaultExpenseGstRate,
  defaultExpenseGstTreatment,
  expense,
  expenseCategories,
  gstRegistered,
  paymentModes
}: {
  defaultExpenseGstRate: number;
  defaultExpenseGstTreatment: GstTreatment;
  expense: Expense;
  expenseCategories: Array<{ id: string; name: string }>;
  gstRegistered: boolean;
  paymentModes: PaymentMode[];
}) {
  return (
    <Dialog
      title="Edit expense"
      description="Update operational expense details."
      trigger={
        <FinanceDialogButton variant="ghost">
          <Pencil className="h-4 w-4" />
        </FinanceDialogButton>
      }
    >
      <form action={updateExpenseAction} className="space-y-4">
        <input type="hidden" name="expenseId" value={expense.id} />
        <div className="grid gap-2">
          <Label htmlFor={`expenseDate-${expense.id}`}>Expense date</Label>
          <Input id={`expenseDate-${expense.id}`} name="expenseDate" type="date" defaultValue={expense.expense_date} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`categoryId-${expense.id}`}>Category</Label>
          <select id={`categoryId-${expense.id}`} name="categoryId" defaultValue={expense.category_id ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">No category</option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`amount-${expense.id}`}>Amount</Label>
          <Input id={`amount-${expense.id}`} name="amount" type="number" min="0.01" step="0.01" defaultValue={expense.amount} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentModeId-${expense.id}`}>Payment mode</Label>
          <select id={`paymentModeId-${expense.id}`} name="paymentModeId" defaultValue={expense.payment_mode_id ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">No payment mode</option>
            {paymentModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paidTo-${expense.id}`}>Paid to</Label>
          <Input id={`paidTo-${expense.id}`} name="paidTo" defaultValue={expense.paid_to ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`description-${expense.id}`}>Description</Label>
          <Input id={`description-${expense.id}`} name="description" defaultValue={expense.description ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`receiptUrl-${expense.id}`}>Receipt URL</Label>
          <Input id={`receiptUrl-${expense.id}`} name="receiptUrl" defaultValue={expense.receipt_url ?? ""} />
        </div>
        <ExpenseGstFields
          defaultGstRate={defaultExpenseGstRate}
          defaultGstTreatment={defaultExpenseGstTreatment}
          expense={expense}
          gstRegistered={gstRegistered}
        />
        <Button type="submit">Save expense</Button>
      </form>
    </Dialog>
  );
}

function EditOrderPaymentDialog({ payment, paymentModes }: { payment: OrderPayment; paymentModes: PaymentMode[] }) {
  return (
    <Dialog
      title="Edit order payment"
      description="Update a customer payment while keeping the order payment summary in sync."
      trigger={
        <FinanceDialogButton variant="ghost">
          <Pencil className="h-4 w-4" />
        </FinanceDialogButton>
      }
    >
      <form action={updateOrderPaymentAction} className="space-y-4">
        <input type="hidden" name="paymentId" value={payment.id} />
        <div className="grid gap-2">
          <Label htmlFor={`paymentAmount-${payment.id}`}>Amount</Label>
          <Input id={`paymentAmount-${payment.id}`} name="amount" type="number" min="0.01" step="0.01" defaultValue={payment.amount} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentMode-${payment.id}`}>Payment mode</Label>
          <select id={`paymentMode-${payment.id}`} name="paymentModeId" defaultValue={payment.payment_mode_id ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">No payment mode</option>
            {paymentModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentDate-${payment.id}`}>Payment date</Label>
          <Input id={`paymentDate-${payment.id}`} name="paymentDate" type="date" defaultValue={payment.payment_date} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`referenceNumber-${payment.id}`}>Reference number</Label>
          <Input id={`referenceNumber-${payment.id}`} name="referenceNumber" defaultValue={payment.reference_number ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentNotes-${payment.id}`}>Notes</Label>
          <Input id={`paymentNotes-${payment.id}`} name="notes" defaultValue={payment.notes ?? ""} />
        </div>
        <Button type="submit">Save payment</Button>
      </form>
    </Dialog>
  );
}

function CashMovementList({
  defaultExpenseGstRate,
  defaultExpenseGstTreatment,
  events,
  expenses,
  orderPayments,
  expenseCategories,
  gstRegistered,
  paymentModes,
  canManageFinance
}: {
  defaultExpenseGstRate: number;
  defaultExpenseGstTreatment: GstTreatment;
  events: Array<{
    id: string;
    source: "order_payment" | "expense" | "manual_due" | "salary_payment";
    type: string;
    date: string;
    title: string;
    detail: string;
    amount: number;
  }>;
  expenses: Expense[];
  orderPayments: OrderPayment[];
  expenseCategories: Array<{ id: string; name: string }>;
  gstRegistered: boolean;
  paymentModes: PaymentMode[];
  canManageFinance: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Movement</CardTitle>
        <CardDescription>Actual money movement only: order payments, salary payments, manual settlements, expenses, and payable settlements.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {events.map((event) => {
            const expense = event.source === "expense" ? expenses.find((entry) => entry.id === event.id) : null;
            const payment = event.source === "order_payment" ? orderPayments.find((entry) => entry.id === event.id) : null;

            return (
              <div key={`${event.type}-${event.id}`} className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[1fr_120px_140px_44px] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{event.title}</p>
                    <StatusBadge value={event.type} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(event.date)} · {event.detail}
                  </p>
                </div>
                <p className="text-xs uppercase text-muted-foreground">{event.type}</p>
                <p className={`font-semibold sm:text-right ${event.amount < 0 ? "text-destructive" : "text-emerald-700"}`}>{formatMoney(event.amount)}</p>
                {canManageFinance ? (
                  <div className="flex justify-start sm:justify-end">
                    {expense ? (
                      <EditExpenseDialog
                        defaultExpenseGstRate={defaultExpenseGstRate}
                        defaultExpenseGstTreatment={defaultExpenseGstTreatment}
                        expense={expense}
                        expenseCategories={expenseCategories}
                        gstRegistered={gstRegistered}
                        paymentModes={paymentModes}
                      />
                    ) : null}
                    {payment ? <EditOrderPaymentDialog payment={payment} paymentModes={paymentModes} /> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {!events.length ? <p className="p-4 text-sm text-muted-foreground">No cash movement in this range.</p> : null}
      </CardContent>
    </Card>
  );
}

function OrderReceivablesTable({ orderReceivables }: { orderReceivables: Array<{ order: FinanceOrder; outstanding: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Receivables</CardTitle>
        <CardDescription>Derived automatically from order total minus actual order payments.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {orderReceivables.map(({ order, outstanding }) => (
            <div key={order.id} className="px-4 py-3">
              <div className="grid gap-3 md:grid-cols-[1fr_150px] md:items-center">
                <div>
                  <p className="font-medium">{order.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.payment_status.replace("_", " ")} · Paid {formatMoney(order.amount_paid)} of {formatMoney(order.total_amount)} · Promised {formatDate(order.promised_delivery_date)}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold">{formatMoney(outstanding)}</p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/orders/${order.id}`}>Record payment</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!orderReceivables.length ? <p className="p-4 text-sm text-muted-foreground">No unpaid order balances.</p> : null}
      </CardContent>
    </Card>
  );
}

function ManualDueTable({
  title,
  description,
  entries,
  orderById,
  canManageFinance
}: {
  title: string;
  description: string;
  entries: ReceivablePayable[];
  orderById: Map<string, FinanceOrder>;
  canManageFinance: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {entries.map((entry) => {
            const order = entry.linked_order_id ? orderById.get(entry.linked_order_id) : null;
            const derivedStatus = getDerivedDueStatus(entry);
            const balance = getDueBalance(entry);
            const settledLabel = entry.type === "receivable" ? "received" : "paid";

            return (
              <div key={entry.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_150px_110px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.party_name}</p>
                    <StatusBadge value={derivedStatus} />
                  </div>
                  <p className="text-muted-foreground">
                    Due {formatDate(entry.due_date)}
                    {order ? ` · ${order.order_number}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Total {formatMoney(entry.amount)} · {formatMoney(entry.amount_settled ?? 0)} {settledLabel} · {formatMoney(balance)} balance
                  </p>
                  {entry.description ? <p className="truncate text-muted-foreground">{entry.description}</p> : null}
                </div>
                <div className="lg:text-right">
                  <p className="font-semibold">{formatMoney(balance)}</p>
                  <p className="text-xs text-muted-foreground">Balance</p>
                </div>
                {canManageFinance ? (
                  <div className="flex justify-start lg:justify-end">
                    <EditManualDueDialog entry={entry} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {!entries.length ? <p className="p-4 text-sm text-muted-foreground">No records in this view.</p> : null}
      </CardContent>
    </Card>
  );
}

function ProfitAndLossView({
  orderRevenue,
  cashCollected,
  expenseTotal,
  operatingProfit,
  expenseBreakdown,
  bookedOrdersCount
}: {
  orderRevenue: number;
  cashCollected: number;
  expenseTotal: number;
  operatingProfit: number;
  expenseBreakdown: Array<[string, number]>;
  bookedOrdersCount: number;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Operating P&amp;L</CardTitle>
          <CardDescription>Simple MVP view: order value booked in the range minus recorded operating expenses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Operating revenue</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(orderRevenue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{bookedOrdersCount} booked orders</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Operating expenses</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(expenseTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Actual expense records</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Operating profit</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(operatingProfit)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Before payroll/tax accounting</p>
            </div>
          </div>
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Cash collected in range</span>
              <span className="font-medium">{formatMoney(cashCollected)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Collections stay in Cashflow. P&amp;L uses booked order value so owners can separate sales from cash timing.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expense Mix</CardTitle>
          <CardDescription>Recorded spend by category for this range.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {expenseBreakdown.map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">{category}</p>
              <p className="font-medium">{formatMoney(amount)}</p>
            </div>
          ))}
          {!expenseBreakdown.length ? <p className="text-sm text-muted-foreground">No expenses in this range.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function BalanceView({
  rangeNetCash,
  openOrderReceivables,
  openManualReceivables,
  openPayables,
  simplePosition,
  receivableCount,
  payableCount
}: {
  rangeNetCash: number;
  openOrderReceivables: number;
  openManualReceivables: number;
  openPayables: number;
  simplePosition: number;
  receivableCount: number;
  payableCount: number;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Simple Balance</CardTitle>
          <CardDescription>Owner-useful position from range net cash, open receivables, and open payables.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Range net cash</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(rangeNetCash)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Order receivables</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(openOrderReceivables)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Manual receivables</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(openManualReceivables)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Payables</p>
              <p className="mt-1 text-xl font-semibold">{formatMoney(openPayables)}</p>
            </div>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">Simple owner position</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(simplePosition)}</p>
            <p className="mt-2 text-xs text-muted-foreground">This is not a bank balance or statutory balance sheet; it is a practical cash-plus-dues snapshot for day-to-day control.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Open Obligations</CardTitle>
          <CardDescription>Unsettled money expected in and out.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span className="text-muted-foreground">Open receivable records</span>
            <span className="font-medium">{receivableCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span className="text-muted-foreground">Open payable records</span>
            <span className="font-medium">{payableCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span className="text-muted-foreground">Net dues position</span>
            <span className="font-medium">{formatMoney(openOrderReceivables + openManualReceivables - openPayables)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GstReportView({
  endDate,
  includeNonGst,
  range,
  report,
  startDate,
  urlEnd,
  urlStart
}: {
  endDate: string;
  includeNonGst: boolean;
  range: RangeKey;
  report: GstReportData;
  startDate: string;
  urlEnd?: string;
  urlStart?: string;
}) {
  const customerById = new Map(report.customers.map((customer) => [customer.id, customer]));
  const outputGst = report.orders.reduce((total, order) => total + Number(order.gst_amount), 0);
  const taxableSales = report.orders.reduce((total, order) => total + Number(order.taxable_amount), 0);
  const claimableInputGst = report.expenses
    .filter((expense) => expense.input_gst_status === "claimable")
    .reduce((total, expense) => total + Number(expense.gst_amount), 0);
  const reviewInputGst = report.expenses
    .filter((expense) => expense.input_gst_status === "needs_review")
    .reduce((total, expense) => total + Number(expense.gst_amount), 0);
  const netPayable = Math.max(outputGst - claimableInputGst, 0);
  const tenantProfileIssues = [
    !report.context.tenant.gst_registered ? "Tenant is not marked GST registered." : null,
    !report.context.tenant.gstin ? "GSTIN is missing." : null,
    !report.context.tenant.legal_name ? "Legal business name is missing." : null,
    !report.context.tenant.registered_address ? "Registered address is missing." : null
  ].filter((issue): issue is string => Boolean(issue));
  const expenseExceptions = report.expenses.flatMap((expense) => {
    const issues: string[] = [];
    const isTaxable = expense.gst_treatment === "taxable_exclusive" || expense.gst_treatment === "taxable_inclusive";

    if (isTaxable && expense.input_gst_status === "needs_review") {
      issues.push("Input GST needs accountant review.");
    }

    if (isTaxable && !expense.vendor_invoice_number) {
      issues.push("Missing vendor invoice number.");
    }

    if (isTaxable && !expense.vendor_invoice_date) {
      issues.push("Missing vendor invoice date.");
    }

    if (isTaxable && expense.input_gst_status === "claimable" && !expense.vendor_gstin) {
      issues.push("Claimable input GST without vendor GSTIN.");
    }

    return issues.map((issue) => ({ expense, issue }));
  });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>GST report</CardTitle>
              <CardDescription>Accountant-handoff summary for {formatDate(startDate)} to {formatDate(endDate)}.</CardDescription>
            </div>
            <Button asChild>
              <Link href={buildGstExportHref({ end: endDate, includeNonGst, start: startDate })} className="gap-2">
                <Download className="h-4 w-4" />
                Download XLSX
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Output GST" value={formatMoney(outputGst)} hint={`${report.orders.length} order records`} />
            <MetricCard label="Input GST claimable" value={formatMoney(claimableInputGst)} hint="Only claimable expenses" />
            <MetricCard label="Net GST payable" value={formatMoney(netPayable)} hint="Before accountant review" />
            <MetricCard label="Input GST review" value={formatMoney(reviewInputGst)} hint="Needs review" />
            <MetricCard label="Taxable sales" value={formatMoney(taxableSales)} hint="From order GST snapshots" />
          </div>
          <div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-2">
            <div>
              <p className="font-medium">Business confirmation</p>
              <p className="text-muted-foreground">{report.context.tenant.legal_name ?? report.context.tenant.name}</p>
              <p className="text-muted-foreground">GSTIN: {report.context.tenant.gstin ?? "Not set"}</p>
              <p className="text-muted-foreground">Address: {report.context.tenant.registered_address ?? "Not set"}</p>
            </div>
            <div>
              <p className="font-medium">Before handoff</p>
              <p className="text-muted-foreground">Confirm the GSTIN, legal name, registered address, and period with the accountant.</p>
              <p className="text-muted-foreground">The XLSX is a handoff workbook, not direct GST portal upload.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <span className="font-medium">Rows shown</span>
            <Button asChild size="sm" variant={!includeNonGst ? "default" : "outline"}>
              <Link href={buildGstInclusionHref({ end: urlEnd, includeNonGst: false, range, start: urlStart })}>GST only</Link>
            </Button>
            <Button asChild size="sm" variant={includeNonGst ? "default" : "outline"}>
              <Link href={buildGstInclusionHref({ end: urlEnd, includeNonGst: true, range, start: urlStart })}>Include non-GST</Link>
            </Button>
            <span className="text-muted-foreground">
              {includeNonGst ? "Showing GST and non-GST transactions in the view and export." : "Showing only transactions where GST amount is recorded."}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Output GST</CardTitle>
            <CardDescription>GST collected from orders in the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Treatment</th>
                  <th className="px-3 py-2 text-right font-medium">GST</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((order) => (
                  <tr key={order.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link href={`/orders/${order.id}`} className="font-medium underline-offset-4 hover:underline">
                        {order.order_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDate(order.order_date)}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{customerById.get(order.customer_id)?.name ?? "Unknown"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {gstTreatmentLabels[order.gst_treatment]} · {formatDecimal(order.gst_rate)}%
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(order.gst_amount)}</td>
                  </tr>
                ))}
                {!report.orders.length ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={4}>
                      No orders in this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input GST</CardTitle>
            <CardDescription>GST paid on expenses, separated by claim/review status.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Expense</th>
                  <th className="px-3 py-2 font-medium">Invoice</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">GST</th>
                </tr>
              </thead>
              <tbody>
                {report.expenses.map((expense) => (
                  <tr key={expense.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium">{expense.paid_to ?? "Expense"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(expense.expense_date)}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {expense.vendor_invoice_number ?? "No invoice"}
                      {expense.vendor_gstin ? <p className="text-xs">{expense.vendor_gstin}</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={expense.input_gst_status} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(expense.gst_amount)}</td>
                  </tr>
                ))}
                {!report.expenses.length ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={4}>
                      No expenses in this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review exceptions</CardTitle>
          <CardDescription>Resolve these before handing the workbook to an accountant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tenantProfileIssues.map((issue) => (
            <div key={issue} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium">Tenant profile</p>
              <p className="text-muted-foreground">{issue}</p>
            </div>
          ))}
          {expenseExceptions.map(({ expense, issue }) => (
            <div key={`${expense.id}-${issue}`} className="rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{expense.paid_to ?? expense.vendor_invoice_number ?? "Expense"}</p>
                <span className="text-muted-foreground">{formatMoney(expense.amount)}</span>
              </div>
              <p className="text-muted-foreground">{issue}</p>
            </div>
          ))}
          {!tenantProfileIssues.length && !expenseExceptions.length ? <p className="text-sm text-muted-foreground">No GST review exceptions for this period.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function FinancePage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string; range?: string; start?: string; end?: string; gstIncludeNonGst?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = financeTabs.some((tab) => tab.value === resolvedSearchParams?.tab) ? (resolvedSearchParams?.tab as FinanceTab) : "dashboard";
  const activeRange = rangeOptions.some((range) => range.value === resolvedSearchParams?.range) ? (resolvedSearchParams?.range as RangeKey) : "mtd";
  const customStart = resolvedSearchParams?.start;
  const customEnd = resolvedSearchParams?.end;
  const gstIncludeNonGst = resolvedSearchParams?.gstIncludeNonGst === "true";
  const range = getRangeBounds(activeRange, customStart, customEnd);
  const gstStartDate = toDateInputValue(range.start);
  const gstEndDate = toDateInputValue(range.end);
  const { context, expenses, receivablesPayables, expenseCategories, paymentModes, orderPayments, orders, salaryPayments, gstReport } = await getFinancePageData({
    gstEndDate,
    gstIncludeNonGst,
    gstStartDate
  });
  const canManageFinance = hasPermission(context.membership.role, "finance:manage");
  const defaultExpenseGstRate = Number(context.tenant.default_purchase_gst_rate ?? 0);
  const defaultExpenseGstTreatment = context.tenant.default_expense_gst_treatment ?? "not_applicable";
  const gstRegistered = Boolean(context.tenant.gst_registered);
  const categoryById = new Map(expenseCategories.map((category) => [category.id, category]));
  const paymentModeById = new Map(paymentModes.map((mode) => [mode.id, mode]));
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const manualReceivablesPayables = receivablesPayables.filter((entry) => !(entry.type === "receivable" && entry.linked_order_id));
  const activeManualDues = manualReceivablesPayables.filter((entry) => getDerivedDueStatus(entry) !== "cancelled");
  const visibleExpenses = expenses.filter((expense) => isInRange(expense.expense_date, range));
  const visiblePayments = orderPayments.filter((payment) => isInRange(payment.payment_date, range));
  const visibleSalaryPayments = salaryPayments.filter((payment) => isInRange(payment.transaction_date, range));
  const visibleOrders = orders.filter((order) => isInRange(order.order_date, range));
  const visibleSettledManualDues = activeManualDues
    .filter((entry) => Number(entry.amount_settled ?? 0) > 0)
    .filter((entry) => isInRange(entry.settled_at ?? entry.updated_at.slice(0, 10), range));
  const orderReceivables = orders
    .map((order) => ({
      order,
      outstanding: Math.max(order.total_amount - order.amount_paid, 0)
    }))
    .filter((entry) => entry.outstanding > 0);
  const collected = visiblePayments.reduce((total, payment) => total + payment.amount, 0);
  const expensesTotal = visibleExpenses.reduce((total, expense) => total + expense.amount, 0);
  const salaryPaidTotal = visibleSalaryPayments.reduce((total, payment) => total + payment.amount, 0);
  const manualReceivableSettled = visibleSettledManualDues.filter((entry) => entry.type === "receivable").reduce((total, entry) => total + Number(entry.amount_settled ?? 0), 0);
  const manualPayableSettled = visibleSettledManualDues.filter((entry) => entry.type === "payable").reduce((total, entry) => total + Number(entry.amount_settled ?? 0), 0);
  const cashIn = collected + manualReceivableSettled;
  const cashOut = expensesTotal + salaryPaidTotal + manualPayableSettled;
  const netCash = cashIn - cashOut;
  const openManualReceivables = activeManualDues.filter((entry) => entry.type === "receivable").reduce((total, entry) => total + getDueBalance(entry), 0);
  const openOrderReceivables = orderReceivables.reduce((total, entry) => total + entry.outstanding, 0);
  const openReceivables = openManualReceivables + openOrderReceivables;
  const openManualPayables = activeManualDues.filter((entry) => entry.type === "payable").reduce((total, entry) => total + getDueBalance(entry), 0);
  const orderRevenue = visibleOrders.reduce((total, order) => total + Number(order.total_amount), 0);
  const operatingProfit = orderRevenue - expensesTotal - salaryPaidTotal;
  const simpleOwnerPosition = netCash + openReceivables - openManualPayables;
  const overdueManualDues = activeManualDues.filter((entry) => getDerivedDueStatus(entry) === "overdue");
  const manualReceivables = activeManualDues.filter((entry) => entry.type === "receivable");
  const manualPayables = activeManualDues.filter((entry) => entry.type === "payable");
  const openManualReceivableCount = manualReceivables.filter((entry) => getDueBalance(entry) > 0).length;
  const openManualPayableCount = manualPayables.filter((entry) => getDueBalance(entry) > 0).length;
  const overdueReceivables = manualReceivables.filter((entry) => getDerivedDueStatus(entry) === "overdue");
  const overduePayables = manualPayables.filter((entry) => getDerivedDueStatus(entry) === "overdue");
  const recentCashEvents = [
    ...visiblePayments.map((payment) => ({
      id: payment.id,
      source: "order_payment" as const,
      type: "collection",
      date: payment.payment_date,
      title: orderById.get(payment.order_id)?.order_number ?? "Order payment",
      detail: payment.payment_mode_id ? paymentModeById.get(payment.payment_mode_id)?.name ?? "Unknown mode" : "No payment mode",
      amount: payment.amount
    })),
    ...visibleExpenses.map((expense) => ({
      id: expense.id,
      source: "expense" as const,
      type: "expense",
      date: expense.expense_date,
      title: expense.paid_to || (expense.category_id ? categoryById.get(expense.category_id)?.name : null) || "Expense",
      detail: expense.payment_mode_id ? paymentModeById.get(expense.payment_mode_id)?.name ?? "Unknown mode" : "No payment mode",
      amount: -expense.amount
    })),
    ...visibleSalaryPayments.map((payment: WorkerLedger) => ({
      id: payment.id,
      source: "salary_payment" as const,
      type: "salary",
      date: payment.transaction_date,
      title: "Salary paid",
      detail: payment.payment_mode_id ? paymentModeById.get(payment.payment_mode_id)?.name ?? "Unknown mode" : "No payment mode",
      amount: -payment.amount
    })),
    ...visibleSettledManualDues.map((entry) => ({
      id: entry.id,
      source: "manual_due" as const,
      type: entry.type === "receivable" ? "manual receipt" : "manual payment",
      date: entry.settled_at ?? entry.updated_at.slice(0, 10),
      title: entry.party_name,
      detail: `${entry.type} settlement`,
      amount: entry.type === "receivable" ? Number(entry.amount_settled ?? 0) : -Number(entry.amount_settled ?? 0)
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const expenseBreakdown = Array.from(
    visibleExpenses.reduce((groups, expense) => {
      const key = expense.category_id ? categoryById.get(expense.category_id)?.name ?? "Unknown" : "Uncategorized";
      groups.set(key, (groups.get(key) ?? 0) + expense.amount);
      return groups;
    }, new Map<string, number>(salaryPaidTotal ? [["Salary", salaryPaidTotal]] : []))
  ).sort((a, b) => b[1] - a[1]);
  const cashflowRows = recentCashEvents.slice(0, activeTab === "dashboard" ? 8 : 50);
  const attentionItems = [
    ...overdueReceivables.slice(0, 4).map((entry) => ({ id: entry.id, label: "Overdue receivable", title: entry.party_name, amount: getDueBalance(entry), status: getDerivedDueStatus(entry) })),
    ...overduePayables.slice(0, 4).map((entry) => ({ id: entry.id, label: "Overdue payable", title: entry.party_name, amount: getDueBalance(entry), status: getDerivedDueStatus(entry) })),
    ...orderReceivables.slice(0, 4).map(({ order, outstanding }) => ({ id: order.id, label: "Order balance", title: order.order_number, amount: outstanding, status: order.payment_status }))
  ].slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader title="Finance" description="Operational cash, receivables, payables, GST capture, and owner snapshots." />

      <CommandBar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {financeTabs.map((tab) => (
            <Button key={tab.value} asChild size="sm" variant={activeTab === tab.value ? "default" : "outline"}>
              <Link href={buildFinanceHref({ gstIncludeNonGst, tab: tab.value, range: activeRange, start: customStart, end: customEnd })}>{tab.label}</Link>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageFinance ? (
            <>
              <AddExpenseDialog
                defaultExpenseGstRate={defaultExpenseGstRate}
                defaultExpenseGstTreatment={defaultExpenseGstTreatment}
                expenseCategories={expenseCategories}
                gstRegistered={gstRegistered}
                paymentModes={paymentModes}
              />
              <AddManualDueDialog />
            </>
          ) : null}
        </div>
      </CommandBar>

      <CommandBar className="justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {rangeOptions.map((option) => (
            <Button key={option.value} asChild size="sm" variant={activeRange === option.value ? "default" : "outline"}>
              <Link href={buildFinanceHref({ gstIncludeNonGst, tab: activeTab, range: option.value, start: customStart, end: customEnd })}>{option.label}</Link>
            </Button>
          ))}
        </div>
        <form action="/finance" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value={activeTab} />
          <input type="hidden" name="range" value="custom" />
          {activeTab === "gst" && gstIncludeNonGst ? <input type="hidden" name="gstIncludeNonGst" value="true" /> : null}
          <Input name="start" type="date" defaultValue={customStart ?? todayIsoDate()} className="h-9 w-[150px]" aria-label="Custom start date" />
          <Input name="end" type="date" defaultValue={customEnd ?? todayIsoDate()} className="h-9 w-[150px]" aria-label="Custom end date" />
          <Button size="sm" type="submit" variant={activeRange === "custom" ? "default" : "outline"}>
            Apply
          </Button>
        </form>
      </CommandBar>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Cash in" value={formatMoney(cashIn)} hint={`${visiblePayments.length} order payments + manual receipts`} />
        <MetricCard label="Cash out" value={formatMoney(cashOut)} hint={`${visibleExpenses.length} expenses + ${visibleSalaryPayments.length} salary payments`} />
        <MetricCard label="Net cash" value={formatMoney(netCash)} hint={`${formatDate(gstStartDate)} to ${formatDate(gstEndDate)}`} />
        <MetricCard label="Receivables" value={formatMoney(openReceivables)} hint="Order + manual balances" />
        <MetricCard label="Payables" value={formatMoney(openManualPayables)} hint={`${manualPayables.length} manual payable records`} />
      </div>

      {activeTab === "dashboard" ? (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Owner Snapshot</CardTitle>
                <CardDescription>Range cash and open obligations without accounting-system complexity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Cash in</p>
                    <p className="mt-1 text-xl font-semibold">{formatMoney(cashIn)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Cash out</p>
                    <p className="mt-1 text-xl font-semibold">{formatMoney(cashOut)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Simple position</p>
                    <p className="mt-1 text-xl font-semibold">{formatMoney(simpleOwnerPosition)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Cash in / out</span>
                    <span>{formatMoney(cashIn)} / {formatMoney(cashOut)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-foreground" style={{ width: `${cashIn + cashOut ? Math.max((cashIn / (cashIn + cashOut)) * 100, 4) : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <CashMovementList
              defaultExpenseGstRate={defaultExpenseGstRate}
              defaultExpenseGstTreatment={defaultExpenseGstTreatment}
              events={cashflowRows}
              expenses={expenses}
              orderPayments={orderPayments}
              expenseCategories={expenseCategories}
              gstRegistered={gstRegistered}
              paymentModes={paymentModes}
              canManageFinance={canManageFinance}
            />
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Attention Items</CardTitle>
                <CardDescription>Overdue dues and order balances that need owner attention.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {overdueManualDues.length ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-medium">Overdue manual dues</p>
                    <p className="mt-1 text-sm text-muted-foreground">{overdueManualDues.length} record needs review.</p>
                  </div>
                ) : null}
                {attentionItems.map((item) => (
                  <div key={`${item.label}-${item.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{item.title}</p>
                        <StatusBadge value={item.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                    <p className="font-semibold">{formatMoney(item.amount)}</p>
                  </div>
                ))}
                {!attentionItems.length ? <p className="text-sm text-muted-foreground">No attention items right now.</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
                <CardDescription>Spend by category in the selected range.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {expenseBreakdown.map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between gap-3 text-sm">
                    <p className="text-muted-foreground">{category}</p>
                    <p className="font-medium">{formatMoney(amount)}</p>
                  </div>
                ))}
                {!expenseBreakdown.length ? <p className="text-sm text-muted-foreground">No expenses in this range.</p> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "cashflow" ? (
        <CashMovementList
          defaultExpenseGstRate={defaultExpenseGstRate}
          defaultExpenseGstTreatment={defaultExpenseGstTreatment}
          events={cashflowRows}
          expenses={expenses}
          orderPayments={orderPayments}
          expenseCategories={expenseCategories}
          gstRegistered={gstRegistered}
          paymentModes={paymentModes}
          canManageFinance={canManageFinance}
        />
      ) : null}

      {activeTab === "receivables" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <OrderReceivablesTable orderReceivables={orderReceivables} />
          <ManualDueTable title="Manual Receivables" description="Non-order receivables with settled amount and derived balance." entries={manualReceivables} orderById={orderById} canManageFinance={canManageFinance} />
        </div>
      ) : null}

      {activeTab === "payables" ? (
        <ManualDueTable title="Manual Payables" description="Operational payables with paid amount, balance, overdue status, and settlement actions." entries={manualPayables} orderById={orderById} canManageFinance={canManageFinance} />
      ) : null}

      {activeTab === "pl" ? (
        <ProfitAndLossView
          orderRevenue={orderRevenue}
          cashCollected={cashIn}
          expenseTotal={expensesTotal}
          operatingProfit={operatingProfit}
          expenseBreakdown={expenseBreakdown}
          bookedOrdersCount={visibleOrders.length}
        />
      ) : null}

      {activeTab === "balance" ? (
        <BalanceView
          rangeNetCash={netCash}
          openOrderReceivables={openOrderReceivables}
          openManualReceivables={openManualReceivables}
          openPayables={openManualPayables}
          simplePosition={simpleOwnerPosition}
          receivableCount={orderReceivables.length + openManualReceivableCount}
          payableCount={openManualPayableCount}
        />
      ) : null}

      {activeTab === "gst" && gstReport ? (
        <GstReportView
          endDate={gstEndDate}
          includeNonGst={gstIncludeNonGst}
          range={activeRange}
          report={gstReport}
          startDate={gstStartDate}
          urlEnd={customEnd}
          urlStart={customStart}
        />
      ) : null}

      <Separator />
      <p className="text-xs text-muted-foreground">
        Finance remains operational: order collections stay in order payments, manual dues stay separate, and GST capture is accountant-handoff first.
      </p>
    </div>
  );
}
