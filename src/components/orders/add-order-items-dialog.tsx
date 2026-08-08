"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  addOrderItemsFormAction,
  type FormActionState,
} from "@/features/orders/actions";
import { OrderItemBuilder } from "@/components/orders/order-item-builder";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type {
  CustomerMeasurement,
  ItemType,
  ItemTypeMeasurementField,
  ItemTypeStandardSize,
  OrderStatus,
  Workflow,
} from "@/types/database";

const initialState: FormActionState = {
  ok: false,
  message: null,
};

function AddItemsTrigger() {
  return (
    <span className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
      <Plus className="h-4 w-4" />
      Add items
    </span>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="min-w-32 gap-2">
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Adding items..." : "Add items"}
    </Button>
  );
}

export function AddOrderItemsDialog({
  orderId,
  customerId,
  orderStatus,
  isFullyDelivered,
  productionStarted,
  itemTypes,
  workflows,
  measurements,
  measurementFields,
  standardSizes,
}: {
  orderId: string;
  customerId: string;
  orderStatus: OrderStatus;
  isFullyDelivered: boolean;
  productionStarted: boolean;
  itemTypes: ItemType[];
  workflows: Workflow[];
  measurements: CustomerMeasurement[];
  measurementFields: ItemTypeMeasurementField[];
  standardSizes: ItemTypeStandardSize[];
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [state, setState] = React.useState<FormActionState>(initialState);
  const [idempotencyKey, setIdempotencyKey] = React.useState("");
  const pendingRequestRef = React.useRef(false);
  const blockedReason =
    orderStatus === "cancelled"
      ? "Items cannot be added to a cancelled order."
      : isFullyDelivered
        ? "Items cannot be added after the order is fully delivered."
        : null;

  function handleOpenChange(nextOpen: boolean) {
    if (pending) {
      return;
    }

    if (nextOpen) {
      setState(initialState);
      setIdempotencyKey(crypto.randomUUID());
    }

    setOpen(nextOpen);
  }

  async function formAction(formData: FormData) {
    if (pendingRequestRef.current) {
      return;
    }

    pendingRequestRef.current = true;
    setPending(true);
    setState(initialState);

    try {
      const nextState = await addOrderItemsFormAction(state, formData);
      setState(nextState);

      if (nextState.ok) {
        setOpen(false);
      }
    } finally {
      pendingRequestRef.current = false;
      setPending(false);
    }
  }

  if (blockedReason) {
    return (
      <Button type="button" disabled title={blockedReason} className="gap-2">
        <Plus className="h-4 w-4" />
        Add items
        <span className="sr-only">{blockedReason}</span>
      </Button>
    );
  }

  return (
    <>
      <Dialog
        title="Add items"
        description="Add one or more new production items without changing existing item or payment history."
        placement="side"
        className="max-w-[min(96vw,90rem)]"
        trigger={<AddItemsTrigger />}
        open={open}
        onOpenChange={handleOpenChange}
        preventClose={pending}
      >
        {({ close }) => <form
          action={formAction}
          className="space-y-5"
          data-unsaved-guard="true"
          data-preserve-dirty-on-submit="true"
          aria-busy={pending}
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

          {state.message && !state.ok ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <p className="font-medium">Items were not added</p>
              <p className="mt-1">{state.message}</p>
              <p className="mt-1 text-xs">
                Your item rows are still here. Correct the issue and try again.
              </p>
            </div>
          ) : null}

          {productionStarted ? (
            <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">Production has already started</p>
                <p className="mt-1 text-amber-900">
                  Each new item will start at the first stage of its selected workflow, and the addition will be recorded in item history.
                </p>
              </div>
            </div>
          ) : null}

          <fieldset disabled={pending} className="space-y-5">
            <OrderItemBuilder
              itemTypes={itemTypes}
              workflows={workflows}
              measurements={measurements}
              measurementFields={measurementFields}
              standardSizes={standardSizes}
              selectedCustomerId={customerId}
            />

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background/95 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={close}
              >
                Cancel
              </Button>
              <SubmitButton />
            </div>
          </fieldset>

          {pending ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              Adding items, initializing workflows, and updating order totals. Keep this dialog open.
            </p>
          ) : null}
        </form>}
      </Dialog>
      {state.ok && state.message ? (
        <p
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-900"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {state.message}
        </p>
      ) : null}
    </>
  );
}
