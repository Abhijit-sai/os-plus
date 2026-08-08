import "server-only";

import type { CommandContext } from "@/core/command-context/types";
import { getCommandError, getCommandEventIds, type CommandResult } from "@/core/commands/result";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type StartWorkUnitStageCommandInput = {
  stageInstanceId: string;
  workerId: string;
  notes?: string | null;
};

export type CompleteWorkUnitStageCommandInput = {
  stageInstanceId: string;
  notes?: string | null;
};

export type StartWorkUnitStageCommandData = {
  workUnitId: string;
  stageInstanceId: string;
  workLogId: string;
};

export type CompleteWorkUnitStageCommandData = {
  workUnitId: string;
  stageInstanceId: string;
  nextStageInstanceId: string | null;
};

function asRecord(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Command returned an invalid result.");
  }

  return value;
}

export async function startWorkUnitStageCommand(
  commandContext: CommandContext,
  input: StartWorkUnitStageCommandInput
): Promise<CommandResult<StartWorkUnitStageCommandData>> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const result = await supabase.rpc("start_work_unit_stage_command", {
      p_tenant_id: commandContext.tenantId,
      p_actor_type: commandContext.actor.type,
      p_actor_id: commandContext.actor.id,
      p_source: commandContext.source,
      p_correlation_id: commandContext.correlationId,
      p_idempotency_key: commandContext.idempotencyKey ?? null,
      p_stage_instance_id: input.stageInstanceId,
      p_worker_id: input.workerId,
      p_notes: input.notes ?? null
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    const data = asRecord(result.data);
    const workUnitId = data.work_unit_id;
    const stageInstanceId = data.stage_instance_id;
    const workLogId = data.work_log_id;

    if (typeof workUnitId !== "string" || typeof stageInstanceId !== "string" || typeof workLogId !== "string") {
      throw new Error("StartWorkUnitStage returned incomplete identifiers.");
    }

    return {
      ok: true,
      data: {
        workUnitId,
        stageInstanceId,
        workLogId
      },
      eventIds: getCommandEventIds(data)
    };
  } catch (error) {
    return getCommandError(error);
  }
}

export async function completeWorkUnitStageCommand(
  commandContext: CommandContext,
  input: CompleteWorkUnitStageCommandInput
): Promise<CommandResult<CompleteWorkUnitStageCommandData>> {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const result = await supabase.rpc("complete_work_unit_stage_command", {
      p_tenant_id: commandContext.tenantId,
      p_actor_type: commandContext.actor.type,
      p_actor_id: commandContext.actor.id,
      p_source: commandContext.source,
      p_correlation_id: commandContext.correlationId,
      p_idempotency_key: commandContext.idempotencyKey ?? null,
      p_stage_instance_id: input.stageInstanceId,
      p_notes: input.notes ?? null
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    const data = asRecord(result.data);
    const workUnitId = data.work_unit_id;
    const stageInstanceId = data.stage_instance_id;
    const nextStageInstanceId = data.next_stage_instance_id;

    if (
      typeof workUnitId !== "string" ||
      typeof stageInstanceId !== "string" ||
      (typeof nextStageInstanceId !== "string" && nextStageInstanceId !== null)
    ) {
      throw new Error("CompleteWorkUnitStage returned incomplete identifiers.");
    }

    return {
      ok: true,
      data: {
        workUnitId,
        stageInstanceId,
        nextStageInstanceId
      },
      eventIds: getCommandEventIds(data)
    };
  } catch (error) {
    return getCommandError(error);
  }
}
