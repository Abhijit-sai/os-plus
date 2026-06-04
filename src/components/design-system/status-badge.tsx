import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

const successTokens = ["paid", "completed", "delivered", "finalized", "active", "present", "ready"];
const warningTokens = ["partial", "draft", "reviewed", "in_progress", "due", "half_day"];
const destructiveTokens = ["overdue", "delayed", "blocked", "cancelled", "absent", "suspended"];

function getVariant(value: string): BadgeProps["variant"] {
  const normalized = value.toLowerCase();

  if (destructiveTokens.some((token) => normalized.includes(token))) {
    return "destructive";
  }

  if (warningTokens.some((token) => normalized.includes(token))) {
    return "warning";
  }

  if (successTokens.some((token) => normalized.includes(token))) {
    return "success";
  }

  return "neutral";
}

export function StatusBadge({ value }: { value: string }) {
  return <Badge variant={getVariant(value)}>{value.replaceAll("_", " ")}</Badge>;
}
