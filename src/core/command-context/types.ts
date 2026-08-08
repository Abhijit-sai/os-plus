import type { CommandActorType, CommandSource } from "@/types/database";

export type CommandContext = {
  tenantId: string;
  actor: {
    type: CommandActorType;
    id: string | null;
  };
  source: CommandSource;
  correlationId: string;
  idempotencyKey?: string;
};
