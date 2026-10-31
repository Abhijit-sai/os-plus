"use server";
import { revalidatePath } from "next/cache";
import { runLeadCommand } from "./commands";
export type LeadActionResult = {
  ok: boolean;
  message: string;
  id?: string;
  customerId?: string;
  mergeId?: string;
};
export async function saveLeadAction(
  input: unknown,
  key: string,
): Promise<LeadActionResult> {
  try {
    const saved = await runLeadCommand(input, key);
    revalidatePath("/leads", "layout");
    return {
      ok: true,
      message: "Changes saved.",
      id: saved.id,
      customerId: saved.customerId,
      mergeId: saved.mergeId,
    };
  } catch {
    return {
      ok: false,
      message:
        "Changes were not saved. Check your access and inputs, or reload if someone changed this record.",
    };
  }
}

export async function loadPanelLeadAction(input: unknown) {
  try {
    const { getPanelLead } = await import("./queries");
    const data = await getPanelLead(input);
    return data
      ? { ok: true as const, data, message: "" }
      : {
          ok: false as const,
          message:
            "No captured enquiry is available for this conversation yet.",
        };
  } catch {
    return {
      ok: false as const,
      message:
        "Open Leads in OS PLUS to check your current business and access.",
    };
  }
}
