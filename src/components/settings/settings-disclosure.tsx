"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsDisclosure({
  title,
  description,
  status,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn("group rounded-xl border bg-background", className)}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold">
            {title}
          </span>
          {description ? (
            <span className="mt-1 block text-sm font-normal text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        {status ? (
          <span className="shrink-0 text-xs font-medium">{status}</span>
        ) : null}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
      </summary>
      <div className="space-y-5 border-t p-4 sm:p-5">{children}</div>
    </details>
  );
}
