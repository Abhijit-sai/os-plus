"use server";
import { revalidatePath } from "next/cache";
import { configureNotification, previewNotificationSummary } from "./commands";
export async function configureNotificationAction(
  raw: unknown,
  key: string,
  expectedTenantId: string,
) {
  try {
    const receipt = await configureNotification(raw, key, expectedTenantId);
    revalidatePath("/settings/chat");
    return {
      ok: true,
      message: receipt.code
        ? "Link code prepared. Use it within 30 minutes, then refresh and confirm the destination."
        : "Notification settings saved.",
      ...receipt,
    };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm this change. Check the selected business, then retry the same change or reload to check its saved state.",
      id: null,
      version: null,
      code: null,
      expiresAt: null,
    };
  }
}
export async function previewNotificationAction(
  raw: unknown,
  expectedTenantId: string,
) {
  try {
    return {
      ok: true,
      message: "Preview only. Nothing was saved or sent.",
      ...(await previewNotificationSummary(raw, expectedTenantId)),
    };
  } catch {
    return {
      ok: false,
      message:
        "The preview could not be loaded. Check the selected business and reporting window, then reload and try again.",
      text: null,
      summary: null,
    };
  }
}
