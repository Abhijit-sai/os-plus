"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { useActionFeedback } from "@/components/ui/action-feedback-provider";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  pendingLabel?: string;
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join(" ");
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function getPendingLabel(children: React.ReactNode) {
  const label = getNodeText(children).replace(/\s+/g, " ").trim();
  const verb = label.split(" ")[0]?.toLowerCase();
  const labels: Record<string, string> = {
    add: "Adding...",
    apply: "Applying...",
    archive: "Archiving...",
    complete: "Completing...",
    confirm: "Confirming...",
    create: "Creating...",
    delete: "Deleting...",
    filter: "Filtering...",
    finalize: "Finalizing...",
    generate: "Generating...",
    import: "Importing...",
    map: "Mapping...",
    mark: "Marking...",
    open: "Opening...",
    queue: "Queueing...",
    record: "Recording...",
    remove: "Removing...",
    save: "Saving...",
    seed: "Seeding...",
    send: "Sending...",
    start: "Starting...",
    update: "Updating...",
  };

  return labels[verb] ?? "Working...";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, disabled, pendingLabel, type, variant, size, asChild = false, ...props }, ref) => {
    const { pending } = useFormStatus();
    const feedback = useActionFeedback();
    const actionId = React.useId();
    const isPendingSubmit = !asChild && type === "submit" && pending;
    const resolvedPendingLabel = pendingLabel ?? getPendingLabel(children);

    React.useEffect(() => {
      if (!feedback || !isPendingSubmit) {
        return;
      }

      feedback.startAction(actionId, resolvedPendingLabel);
      return () => feedback.finishAction(actionId);
    }, [actionId, feedback, isPendingSubmit, resolvedPendingLabel]);

    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        disabled={disabled || isPendingSubmit}
        aria-busy={isPendingSubmit || undefined}
        {...props}
      >
        {isPendingSubmit ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {resolvedPendingLabel}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button };
