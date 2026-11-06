"use client";

import * as React from "react";
import Link from "next/link";

import { createOrderFormAction, type CreateOrderFormState } from "@/features/orders/actions";
import { Button } from "@/components/ui/button";
import { useActionFeedback } from "@/components/ui/action-feedback-provider";

const initialState: CreateOrderFormState = { ok: false, message: null, reviewOrders: false };

/** Dispatch manually so a recoverable action result does not reset uncontrolled item rows. */
export function CreateOrderForm({ children }: { children: React.ReactNode }) {
  const [state, formAction, pending] = React.useActionState(createOrderFormAction, initialState);
  const submitting = React.useRef(false);
  const actionId = React.useId();
  const feedback = useActionFeedback();
  const startAction = feedback?.startAction;
  const finishAction = feedback?.finishAction;

  React.useEffect(() => {
    if (!pending) submitting.current = false;
    if (!pending || !startAction || !finishAction) return;
    startAction(actionId, "Creating order...");
    return () => finishAction(actionId);
  }, [actionId, finishAction, pending, startAction]);

  return (
    <form
      action={formAction}
      aria-busy={pending}
      className="space-y-6"
      data-unsaved-guard="true"
      data-preserve-dirty-on-submit="true"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || submitting.current || state.reviewOrders) return;
        const data = new FormData(event.currentTarget);
        submitting.current = true;
        React.startTransition(() => formAction(data));
      }}
    >
      {children}
      {state.message ? (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{state.message}</p>
          <p className="mt-1">Your entered details are still here.</p>
          {state.reviewOrders ? (
            <Link className="mt-2 inline-block underline" href="/orders" target="_blank" rel="noopener noreferrer">
              Open the order list before trying again
            </Link>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={pending || state.reviewOrders}>
        {pending ? "Creating order..." : "Create order"}
      </Button>
    </form>
  );
}
