"use server";
import { revalidatePath } from "next/cache";
import { configureAiBudget } from "./budget-settings";
export async function configureAiBudgetAction(
  raw: unknown,
  key: string,
  expectedTenantId: string,
) {
  try {
    await configureAiBudget(raw, key, expectedTenantId);
    revalidatePath("/settings/chat");
    return { ok: true, message: "Monthly AI limit saved." };
  } catch {
    return {
      ok: false,
      uncertain: true,
      message:
        "We could not confirm this change. Reload the selected business before changing the limit again.",
    };
  }
}
