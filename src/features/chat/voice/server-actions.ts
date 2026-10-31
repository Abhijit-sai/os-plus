"use server";
import { revalidatePath } from "next/cache";
import { configureVoice } from "./commands";
export async function configureVoiceAction(
  raw: unknown,
  key: string,
  expectedTenantId: string,
) {
  try {
    const receipt = await configureVoice(raw, key, expectedTenantId);
    revalidatePath("/settings/chat");
    return {
      ok: true,
      message: "Voice settings saved.",
      version: receipt.version,
    };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm this change. Check the selected business and reload before changing other values.",
      version: null,
    };
  }
}
