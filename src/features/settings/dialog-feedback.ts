import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

const safeMessages = new Set([
  "A location with this code already exists.",
  "A team with this code already exists.",
  "This field key already exists for the selected item type.",
  "This size name already exists for the selected item type.",
  "This email is already mapped to this tenant.",
  "Field key must include at least one letter or number.",
  "Add at least one dimension value for this size.",
  "Location does not belong to this tenant.",
  "Team does not belong to this tenant.",
  "Tenant user does not belong to this tenant.",
  "Item type does not belong to this tenant.",
  "Selected item type does not belong to this tenant.",
  "One or more selected stages are inactive or do not belong to this tenant.",
  "Selected stage or workgroup does not belong to this tenant.",
  "Template does not belong to this tenant or channel.",
  "Choose an item type before making this the default workflow.",
  "A workflow cannot include the same stage more than once.",
]);

/** Send actionable validation, never database details, across the server boundary. */
export function settingsDialogFailure(error: unknown) {
  unstable_rethrow(error);
  let message = "Unable to save right now. Please try again.";
  if (error instanceof z.ZodError) {
    const issue = error.issues[0];
    message = issue && !/^(Expected |Invalid )/.test(issue.message)
      ? issue.message
      : `Review the ${issue?.path.join(" ") || "required"} field.`;
  } else if (error instanceof Error) {
    if (safeMessages.has(error.message)) message = error.message;
    else if (error.message.startsWith("These dimensions are not active standards")) message = "Choose active measurement dimensions for this item type.";
    else if (error.message.startsWith("These variables are not allowed in customer messages")) message = "Use only approved customer-message variables.";
  }
  return { ok: false, message };
}
