"use client";

import * as React from "react";

import { Dialog } from "@/components/ui/dialog";

export type AutoCloseDialogAction = (formData: FormData) => void | Promise<void>;

type ActionState = {
  message: string | null;
  ok: boolean;
};

const initialState: ActionState = { message: null, ok: false };

function actionErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Unable to save these changes. Review the fields and try again.";
}

export function AutoCloseActionDialog({
  action,
  children,
  className,
  description,
  formClassName = "space-y-4",
  successMessage = "Changes saved.",
  title,
  trigger,
}: {
  action: AutoCloseDialogAction;
  children: React.ReactNode;
  className?: string;
  description?: string;
  formClassName?: string;
  successMessage?: string;
  title: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showState, setShowState] = React.useState(false);
  const [state, formAction, pending] = React.useActionState(async (_previousState: ActionState, formData: FormData) => {
    setShowState(true);
    let nextState: ActionState;

    try {
      await action(formData);
      nextState = { message: successMessage, ok: true };
    } catch (error) {
      nextState = { message: actionErrorMessage(error), ok: false };
    }

    if (nextState.ok) {
      setOpen(false);
      setNotice(nextState.message);
      setShowState(false);
    }

    return nextState;
  }, initialState);

  return (
    <div className="inline-flex items-center gap-2">
      <Dialog
        className={className}
        description={description}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setNotice(null);
            setShowState(false);
          }
          setOpen(nextOpen);
        }}
        open={open}
        preventClose={pending}
        title={title}
        trigger={trigger}
      >
        <form action={formAction} className={formClassName} data-unsaved-guard="true">
          {children}
          {showState && state.message && !state.ok ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {state.message}
            </div>
          ) : null}
        </form>
      </Dialog>
      {notice ? <span className="text-xs text-emerald-700" role="status">{notice}</span> : null}
    </div>
  );
}
