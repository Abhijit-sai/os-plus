"use server";
import { getChatKnowledge } from "./queries";
import type { KnowledgePack } from "./knowledge-pack";
import type { ChatSetup } from "./queries";
import { revalidatePath } from "next/cache";
import { configureChat, syncChatInboxes } from "./commands";
import { configurePlatformChat } from "./platform-commands";
import type { ChatInbox } from "@/integrations/chatwoot/admin-client";

export type ChatActionResult = {
  ok: boolean;
  message: string;
  webhooks?: { events: string; agent: string };
  inboxes?: ChatInbox[];
  revision?: { id: string; pack_json: KnowledgePack };
  revisions?: ChatSetup["packs"];
  olderBefore?: number | null;
};
export async function saveChatAction(
  input: unknown,
  key: string,
): Promise<ChatActionResult> {
  try {
    await configureChat(input, key);
    revalidatePath("/settings/chat");
    return { ok: true, message: "Changes saved." };
  } catch {
    return {
      ok: false,
      message:
        "Changes were not saved. Check the entered values and your access, then try again.",
    };
  }
}
export async function syncChatInboxesAction(): Promise<ChatActionResult> {
  try {
    return {
      ok: true,
      message:
        "Inboxes loaded. Choose a brand and branch before saving a mapping.",
      inboxes: await syncChatInboxes(),
    };
  } catch {
    return {
      ok: false,
      message:
        "Inboxes could not be loaded. Ask your platform administrator to check the connection.",
    };
  }
}
export async function savePlatformChatAction(
  input: unknown,
  key: string,
): Promise<ChatActionResult> {
  try {
    const result = await configurePlatformChat(input, key);
    revalidatePath("/super-admin/chat-workspaces");
    return { ok: !result.needsReview, ...result };
  } catch {
    return {
      ok: false,
      message:
        "Workspace changes were not saved. Check the setup and access, then try again. For an uncertain account creation, reconcile the existing account first.",
    };
  }
}

export async function loadChatKnowledgeAction(
  input: unknown,
): Promise<ChatActionResult> {
  try {
    return {
      ok: true,
      message: "Knowledge loaded.",
      ...(await getChatKnowledge(input)),
    };
  } catch {
    return {
      ok: false,
      message:
        "Knowledge could not be loaded. Check your access and try again.",
    };
  }
}
