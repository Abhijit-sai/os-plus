import "server-only";

import type { TenantContext } from "@/lib/tenant/context";
import type { CommandSource } from "@/types/database";
import type { CommandContext } from "@/core/command-context/types";

export function createUserCommandContext(
  context: TenantContext,
  options?: {
    source?: CommandSource;
    correlationId?: string;
    idempotencyKey?: string | null;
  }
): CommandContext {
  return {
    tenantId: context.tenant.id,
    actor: {
      type: "USER",
      id: context.membership.clerk_user_id
    },
    source: options?.source ?? "OS_PLUS_UI",
    correlationId: options?.correlationId ?? crypto.randomUUID(),
    idempotencyKey: options?.idempotencyKey ?? undefined
  };
}
