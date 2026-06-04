import { cn } from "@/lib/utils";

export function CommandBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-[14px] border bg-background p-2 shadow-sm", className)}>
      {children}
    </div>
  );
}
