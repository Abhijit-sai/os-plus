import type { CommandActorType, CommandSource, Json } from "@/types/database";

export type DomainEventEnvelope = {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorType: CommandActorType;
  actorId: string | null;
  source: CommandSource;
  correlationId: string;
  payload: Json;
  occurredAt: string;
};
