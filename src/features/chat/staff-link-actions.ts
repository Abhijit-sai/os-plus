"use server";
import { revalidatePath } from "next/cache";
import type { ChatActionResult } from "./actions";
import {
  configurePlatformChatStaffLink,
  getPlatformChatStaffChoices,
  type StaffLinkChoices,
} from "./staff-links";
export async function loadPlatformChatStaffAction(
  input: unknown,
): Promise<
  { ok: true; choices: StaffLinkChoices } | { ok: false; message: string }
> {
  try {
    return { ok: true, choices: await getPlatformChatStaffChoices(input) };
  } catch {
    return {
      ok: false,
      message: "Staff could not be loaded. Check account access and reload.",
    };
  }
}
export async function linkPlatformChatStaffAction(
  input: unknown,
  key: string,
): Promise<ChatActionResult> {
  try {
    await configurePlatformChatStaffLink(input, key);
    revalidatePath("/super-admin/chat-workspaces");
    return {
      ok: true,
      message:
        "Staff login verified and linked. Reload the staff list to check it.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Staff link was not saved. Choose matching active logins from this business and Chatwoot account, then reload.",
    };
  }
}
