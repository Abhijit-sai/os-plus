import { Shirt } from "lucide-react";

export function ItemTypeIcon({ emoji, className = "h-4 w-4" }: { emoji: string | null | undefined; className?: string }) {
  return emoji ? <span aria-hidden="true" className="shrink-0 leading-none">{emoji}</span> : <Shirt aria-hidden="true" className={`${className} shrink-0`} />;
}
