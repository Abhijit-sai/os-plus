"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import {
  recordOrderPaymentFormAction,
  type FormActionState,
} from "@/features/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMode } from "@/types/database";

const initialState: FormActionState = {
  ok: false,
  message: null,
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    amount,
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function PaymentDialogButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
      {children}
    </span>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Recording..." : "Record payment"}
    </Button>
  );
}

export function AddPaymentDialog({
  orderId,
  outstandingAmount,
  paymentModes,
}: {
  orderId: string;
  outstandingAmount: number;
  paymentModes: PaymentMode[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<FormActionState>(initialState);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setState(initialState);
    }

    setOpen(nextOpen);
  }

  async function formAction(formData: FormData) {
    const nextState = await recordOrderPaymentFormAction(state, formData);
    setState(nextState);

    if (nextState.ok) {
      setOpen(false);
    }
  }

  return (
    <Dialog
      title="Add payment"
      description={`Outstanding amount: ₹${formatMoney(outstandingAmount)}`}
      trigger={<PaymentDialogButton>Add payment</PaymentDialogButton>}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <form action={formAction} className="space-y-4" data-unsaved-guard="true" data-preserve-dirty-on-submit="true">
        <input type="hidden" name="orderId" value={orderId} />
        {state.message ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.message}
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor={`paymentAmount-${orderId}`}>Amount</Label>
          <Input
            id={`paymentAmount-${orderId}`}
            name="amount"
            type="number"
            min="0.01"
            max={outstandingAmount}
            step="0.01"
            required
          />
          <p className="text-xs text-muted-foreground">
            Outstanding: ₹{formatMoney(outstandingAmount)}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentModeId-${orderId}`}>Payment mode</Label>
          <select
            id={`paymentModeId-${orderId}`}
            name="paymentModeId"
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">No payment mode</option>
            {paymentModes.map((paymentMode) => (
              <option key={paymentMode.id} value={paymentMode.id}>
                {paymentMode.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentDate-${orderId}`}>Payment date</Label>
          <Input
            id={`paymentDate-${orderId}`}
            name="paymentDate"
            type="date"
            defaultValue={todayIsoDate()}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`referenceNumber-${orderId}`}>Reference number</Label>
          <Input
            id={`referenceNumber-${orderId}`}
            name="referenceNumber"
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`paymentNotes-${orderId}`}>Notes</Label>
          <Input
            id={`paymentNotes-${orderId}`}
            name="notes"
            placeholder="Optional"
          />
        </div>
        <SubmitButton />
      </form>
    </Dialog>
  );
}
