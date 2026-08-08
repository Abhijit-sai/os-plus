"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUnsavedChanges } from "@/components/layout/unsaved-changes-provider";
import { useActionFeedback } from "@/components/ui/action-feedback-provider";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Dialog({
  trigger,
  title,
  description,
  children,
  className,
  placement = "center",
  open,
  onOpenChange,
  preventClose = false,
  confirmClose,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children:
    | React.ReactNode
    | ((controls: { close: () => void }) => React.ReactNode);
  className?: string;
  placement?: "center" | "side";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preventClose?: boolean;
  confirmClose?: () => boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const { confirmIfUnsavedChanges } = useUnsavedChanges();
  const feedback = useActionFeedback();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const dialogId = React.useId();
  const titleId = React.useId();
  const descriptionId = React.useId();
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const closePrevented = preventClose || Boolean(feedback?.isBusy);
  const openDialog = React.useCallback(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    setOpen(true);
  }, [setOpen]);
  const close = React.useCallback(() => {
    if (closePrevented) {
      return;
    }

    if ((confirmClose ?? confirmIfUnsavedChanges)()) {
      setOpen(false);
    }
  }, [closePrevented, confirmClose, confirmIfUnsavedChanges, setOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      previousFocusRef.current?.focus();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const focusableElements = dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hidden)
        : [];
      (focusableElements[0] ?? dialog)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
        ).filter((element) => !element.hidden);
        if (!focusableElements.length) {
          event.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen]);

  return (
    <>
      {trigger ? (
        <button
          ref={triggerRef}
          type="button"
          className="contents"
          onClick={openDialog}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? dialogId : undefined}
        >
          {trigger}
        </button>
      ) : null}
      {isOpen ? (
        <div
          className={`fixed inset-0 z-50 flex p-4 ${placement === "side" ? "items-stretch justify-end" : "items-center justify-center"}`}
        >
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 cursor-default bg-black/30"
            onClick={close}
            disabled={closePrevented}
          />
          <div
            id={dialogId}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={cn(
              placement === "side"
                ? "relative z-10 h-full w-full max-w-5xl overflow-y-auto rounded-[14px] border bg-background p-5 shadow-2xl"
                : "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] border bg-background p-5 shadow-2xl",
              className,
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold leading-tight">{title}</h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={close}
                aria-label="Close"
                disabled={closePrevented}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {typeof children === "function" ? children({ close }) : children}
          </div>
        </div>
      ) : null}
    </>
  );
}
