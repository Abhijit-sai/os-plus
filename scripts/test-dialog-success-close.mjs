import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [autoClose, configurationDialogs, attachmentPanel, workflow, measurements, users, locations, teams, communications] = await Promise.all([
  readFile(new URL("../src/components/ui/auto-close-action-dialog.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/settings/configuration-edit-dialogs.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/attachments/attachment-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/workflows/[workflowId]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/measurement-standards/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/users/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/locations/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/teams/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/communications/page.tsx", import.meta.url), "utf8")
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
assert.match(workflow, /AutoCloseActionDialog action=\{updateWorkflowAction\}/);
assert.match(measurements, /AutoCloseActionDialog action=\{updateMeasurementFieldAction\}[\s\S]*?<FieldForm[^>]*\bbare\s*\/>/);
assert.match(measurements, /AutoCloseActionDialog action=\{updateStandardSizeAction\}[\s\S]*?<StandardSizeForm[^>]*\bbare\s*\/>/);
assert.match(measurements, /AutoCloseActionDialog action=\{updateMeasurementFieldAction\}/);
assert.match(measurements, /AutoCloseActionDialog action=\{updateStandardSizeAction\}/);
assert.match(users, /AutoCloseActionDialog action=\{updateTenantUserAction\}/);
assert.match(locations, /AutoCloseActionDialog action=\{updateTenantLocationAction\}/);
assert.match(teams, /AutoCloseActionDialog action=\{updateTeamAction\}/);
assert.match(communications, /AutoCloseActionDialog action=\{updateCommunicationTemplateAction\}/);
assert.match(communications, /AutoCloseActionDialog action=\{updateCommunicationTriggerRuleAction\}/);

console.log("Successful dialog close behavior tests passed.");
