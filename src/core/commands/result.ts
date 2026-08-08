import type { Json } from "@/types/database";

export type CommandResult<T> =
  | {
      ok: true;
      data: T;
      eventIds: string[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      currentState?: unknown;
    };

export type CommandRpcResult = {
  event_ids?: Json;
};

export function getCommandEventIds(value: CommandRpcResult) {
  return Array.isArray(value.event_ids) ? value.event_ids.filter((eventId): eventId is string => typeof eventId === "string") : [];
}

export function getCommandError(error: unknown): CommandResult<never> {
  if (error instanceof Error) {
    return {
      ok: false,
      code: error.message.split(":").at(-1)?.trim() || "COMMAND_FAILED",
      message: error.message
    };
  }

  return {
    ok: false,
    code: "COMMAND_FAILED",
    message: "Command failed."
  };
}
