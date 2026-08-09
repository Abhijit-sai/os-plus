import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [autoClose, configurationDialogs, attachmentPanel] = await Promise.all([
  readFile(new URL("../src/components/ui/auto-close-action-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/settings/configuration-edit-dialogs.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/attachments/attachment-panel.tsx", import.meta.url), "utf8")
]);

assert.match(autoClose, /await action\(formData\)/);
assert.match(autoClose, /nextState\.ok[\s\S]*setOpen\(false\)/);
assert.match(autoClose, /preventClose=\{pending\}/);
assert.match(autoClose, /!state\.ok/);
assert.doesNotMatch(configurationDialogs, /<Dialog\b/);
assert.equal((configurationDialogs.match(/<AutoCloseActionDialog\b/g) ?? []).length, 5);
assert.match(attachmentPanel, /<AutoCloseActionDialog[\s\S]*action=\{createAttachmentAction\}/);
assert.match(attachmentPanel, /successMessage="Attachment saved\."/);
assert.match(attachmentPanel, /name="file"/);
assert.match(attachmentPanel, /name="fileUrl"/);

console.log("Successful dialog close behavior tests passed.");
