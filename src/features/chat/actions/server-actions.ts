"use server";
import { revalidatePath } from "next/cache";
import { runRequestCommand, runRequestWorkflow, runChatTask } from "./commands";
export async function saveChatRequestAction(input: unknown, key: string) {
  try {
    const receipt = await runRequestCommand(input, key);
    revalidatePath("/leads", "layout");
    return {
      ok: true,
      message: receipt.duplicate
        ? "This request already exists."
        : "Request saved.",
      ...receipt,
    };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm this request. Retry the same change or reload to check its saved state.",
    };
  }
}
export async function requestWorkflowAction(input: unknown, key: string) {
  try {
    const receipt = await runRequestWorkflow(input, key);
    revalidatePath("/leads", "layout");
    return {
      ok: true,
      message:
        receipt.status === "materialized"
          ? "Operational action recorded. Check its current status below."
          : "Request updated.",
      ...receipt,
    };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm this action. Retry the same change or reload to check the latest request and operational status.",
    };
  }
}
export async function chatTaskAction(input: unknown, key: string) {
  try {
    const receipt = await runChatTask(input, key);
    revalidatePath("/leads", "layout");
    return { ok: true, message: "Task updated.", ...receipt };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm this task change. Retry the same change or reload to check its current status.",
    };
  }
}

export async function businessActionAction(raw: unknown, key: string) {
  const { z } = await import("zod");
  const request = z
    .object({
      kind: z.enum(["request", "workflow", "task", "supplemental"]),
      body: z.unknown(),
    })
    .strict()
    .parse(raw);
  if (request.kind === "supplemental") {
    try {
      const { approveSupplemental } = await import("./supplemental-worker");
      const result = await approveSupplemental(request.body);
      revalidatePath("/leads", "layout");
      return {
        ok: result.status === "sent",
        uncertain: result.status !== "sent",
        message:
          result.status === "sent"
            ? "Sent in Chatwoot."
            : "Delivery is unconfirmed. Reload to check; do not send a duplicate.",
      };
    } catch {
      return {
        ok: false,
        uncertain: true,
        message:
          "Delivery could not be confirmed. Reload to check current eligibility and delivery status.",
      };
    }
  }
  if (request.kind === "request")
    return saveChatRequestAction(request.body, key);
  if (request.kind === "workflow")
    return requestWorkflowAction(request.body, key);
  return chatTaskAction(request.body, key);
}

export async function configureChatActionsAction(input: unknown, key: string) {
  try {
    const { configureChatActions } = await import("./settings");
    const result = await configureChatActions(input, key);
    revalidatePath("/settings/chat");
    return { ok: true, message: "Channel controls saved.", ...result };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm these channel controls. Retry the same change or reload to check the current approval.",
    };
  }
}
