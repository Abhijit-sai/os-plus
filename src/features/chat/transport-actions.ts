"use server";

import { revalidatePath } from "next/cache";
import type { ChatActionResult } from "./actions";
import { setupChatwootTransport } from "./transport-setup";

export async function connectPlatformChatTransportAction(
  input: unknown,
): Promise<ChatActionResult> {
  try {
    await setupChatwootTransport(input);
    revalidatePath("/super-admin/chat-workspaces");
    return { ok: true, message: "Chatwoot webhooks connected." };
  } catch {
    return {
      ok: false,
      message:
        "The Chatwoot connection was not saved. Check the setup secret and access. Reconcile any pending setup before trying again.",
    };
  }
}
