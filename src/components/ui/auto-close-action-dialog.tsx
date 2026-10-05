"use client";

import * as React from "react";
import { unstable_rethrow } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { useActionFeedback } from "@/components/ui/action-feedback-provider";

type ActionState = {
  message: string | null;
  ok: boolean;
};

export type AutoCloseDialogAction = (
  formData: FormData,
) => void | ActionState | Promise<void | ActionState>;

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
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showState, setShowState] = React.useState(false);
  const [state, setState] = React.useState(initialState);
  const [pending, setPending] = React.useState(false);
  const pendingRef = React.useRef(false);
  const feedback = useActionFeedback();
  const actionId = React.useId();
  async function formAction(formData: FormData) {
    setShowState(true);
    let nextState: ActionState;

    try {
      const actionState = await action(formData);
      nextState = actionState ?? { message: successMessage, ok: true };
    } catch (error) {
      unstable_rethrow(error);
      nextState = { message: actionErrorMessage(error), ok: false };
    }

    if (nextState.ok) {
      if (formRef.current) delete formRef.current.dataset.unsavedDirty;
      setOpen(false);
      setNotice(nextState.message);
      setShowState(false);
    }

    setState(nextState);
  }

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
        <form onSubmit={(event) => {
          event.preventDefault();
          if (pendingRef.current) return;
          const formData = new FormData(event.currentTarget);
          pendingRef.current = true;
          setPending(true);
          feedback?.startAction(actionId, "Saving changes...");
          // A native React form action resets uncontrolled fields even for an error result.
          // Submit explicitly so a recoverable failure retains the complete local draft.
          React.startTransition(async () => {
            try { await formAction(formData); }
            finally { pendingRef.current = false; setPending(false); feedback?.finishAction(actionId); }
          });
        }} className={formClassName} data-preserve-dirty-on-submit="true" data-unsaved-guard="true" ref={formRef}>
          <fieldset className="contents" disabled={pending}>
            {children}
          </fieldset>
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
