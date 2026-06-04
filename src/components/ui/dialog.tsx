"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Dialog({
  trigger,
  title,
  description,
  children,
  className,
  placement = "center",
  open,
  onOpenChange
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode | ((controls: { close: () => void }) => React.ReactNode);
  className?: string;
  placement?: "center" | "side";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const close = React.useCallback(() => setOpen(false), [setOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen]);

  return (
    <>
      <button type="button" className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {isOpen ? (
        <div className={`fixed inset-0 z-50 flex p-4 ${placement === "side" ? "items-stretch justify-end" : "items-center justify-center"}`}>
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 cursor-default bg-black/30"
            onClick={close}
          />
          <div
            className={cn(
              placement === "side"
                ? "relative z-10 h-full w-full max-w-5xl overflow-y-auto rounded-[14px] border bg-background p-5 shadow-2xl"
                : "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] border bg-background p-5 shadow-2xl",
              className
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold leading-tight">{title}</h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close">
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
