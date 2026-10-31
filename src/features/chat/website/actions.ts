"use server";
import { getWebsiteWidget } from "./queries";
export async function loadWebsiteWidgetAction(input: unknown) {
  try {
    return { ok: true as const, widget: await getWebsiteWidget(input) };
  } catch {
    return {
      ok: false as const,
      message:
        "Website code could not be loaded. Check the selected business and active channel, then try again.",
    };
  }
}
