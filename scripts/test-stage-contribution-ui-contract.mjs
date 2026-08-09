import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const [editor, actions, contributionHelpers, panel, queries, settingsPage, ruleEditor] = await Promise.all([
  read("src/components/production/stage-contribution-editor.tsx"),
  read("src/features/production/contribution-actions.ts"),
  read("src/features/production/contributions.ts"),
  read("src/components/production/item-workflow-panel.tsx"),
  read("src/features/production/queries.ts"),
  read("src/app/(tenant)/settings/item-types/[itemTypeId]/contributions/page.tsx"),
  read("src/components/settings/contribution-rule-list.tsx"),
]);

assert.match(editor, /Performed role/, "worker rows must record the performed workgroup role");
assert.match(editor, /\[-10, "−10m"\]/, "time controls must support ten-minute decrements");
assert.match(editor, /\[10, "\+10m"\]/, "time controls must support ten-minute increments");
assert.match(editor, /\[-0\.1, "−0\.1"\]/, "unit controls must support tenth-unit decrements");
assert.match(editor, /\[0\.1, "\+0\.1"\]/, "unit controls must support tenth-unit increments");
assert.match(editor, /newRow\(itemQuantity\)/, "the first unit-tracked assignment must default to the complete item quantity");
assert.match(editor, /operation === "complete"[\s\S]*?setOpen\(false\)/, "successful completion must close only the contribution editor");
assert.match(editor, /Total man-hours/, "the editor must show summed man-hours separately");
assert.match(editor, /Rate not configured/, "missing rates must warn without blocking production");
assert.match(editor, /preventClose=\{pending\}/, "pending saves must prevent dialog closure");
assert.match(editor, /idempotencyKey/, "submissions must carry an idempotency key");
assert.match(editor, /const nextState = await stageContributionAction[\s\S]*?nextState\.ok[\s\S]*?setIdempotencyKey\(crypto\.randomUUID\(\)\)/, "a successful save must rotate the idempotency key before a different operation");
assert.match(editor, /expectedRevision/, "edits must carry an optimistic contribution revision");
assert.match(editor, /canCorrectCompleted/, "completed corrections must be capability-gated");
assert.match(editor, /Actual elapsed/, "completed stages must distinguish elapsed time from summed man-hours");
assert.match(editor, /Total credited units[\s\S]*?itemQuantity/i, "completed summaries must compare credited units with item quantity");
assert.match(actions, /assertPermission\(context\.membership\.role, "production:manage"\)/, "actions must enforce production permission");
assert.match(actions, /p_tenant_id: context\.tenant\.id/, "all contribution RPC calls must be tenant scoped");
assert.match(actions, /context\.membership\.role === "owner_admin"/, "only owner-admin may authorize completed corrections");
assert.match(actions, /assignmentSchema/, "assignment references and effort must be server validated");
assert.match(actions, /stageContributionDatabaseErrorMessage/, "server actions must translate structured database errors");
assert.match(contributionHelpers, /STALE_CONTRIBUTION_REVISION/, "stale editors must receive recoverable feedback");
assert.match(actions, /`\/production\/items\/\$\{itemId\}\/workflow`/, "production detail must be revalidated after success");
assert.match(actions, /`\/orders\/\$\{order\.data\.order_id\}`/, "order detail must be revalidated after success");
assert.match(panel, /StageContributionEditor/, "workflow stages must use the multi-worker contribution editor");
assert.match(panel, /stageInstance\.status === "ready_to_start" \|\| stageInstance\.effort_tracking_mode_snapshot !== null/, "legacy completed stages must not expose contribution backfill");
assert.doesNotMatch(panel, /startStageAction|completeStageAction/, "the public workflow UI must not use legacy non-atomic stage actions");
assert.match(queries, /item_stage_contribution_corrections/, "workflow detail must load correction audit records");
assert.match(settingsPage, /Contribution rules/, "item types must expose contribution configuration");
assert.match(ruleEditor, /No contribution value configured/, "saved rules must have a plain-language unconfigured summary");
assert.match(ruleEditor, /of the discounted pre-GST item value/, "percentage rules must explain their calculation basis");
assert.match(ruleEditor, /setEditing\(false\)/, "a successful rule save must return to the saved summary");
assert.match(ruleEditor, /selection === "none"[\s\S]*?setRateValue\(""\)/, "selecting no rule must clear the stale rate field");
const workerPage = await read("src/app/(tenant)/dashboard/workers/page.tsx");
const contributionLayout = await read("src/app/(tenant)/worker-contributions/layout.tsx");
assert.match(workerPage, /key: workerId[\s\S]*?label:/i, "chart series must use stable worker IDs rather than duplicate-prone names");
assert.match(workerPage, /basePath/i, "worker contribution filters must support the manager-accessible route");
assert.match(contributionLayout, /worker_contributions:view/i);

console.log("Stage contribution UI, pending-state, permission, and tenant-boundary contracts passed.");
