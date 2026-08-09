import fs from "node:fs/promises";
import path from "node:path";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputPath = path.resolve("docs", "OS_PLUS_QA_Test_Matrix.xlsx");

const columns = [
  "Test ID",
  "Priority",
  "Persona",
  "Tenant",
  "Preconditions",
  "Steps",
  "Expected Result",
  "Actual Result",
  "Status",
  "Automation",
  "Notes"
];

const sheets = [
  {
    name: "Tenant Access",
    rows: [
      ["TA-001", "P0", "Owner/Admin", "Phantom Threads", "Owner email is active and verified in Clerk.", "Sign in and open /select-tenant.", "Only active OS PLUS memberships for the verified email are shown.", "", "Not Run", "Manual Clerk OTP", "Use reachable email only after approval."],
      ["TA-002", "P0", "Disabled user", "Phantom Threads", "Membership status is disabled.", "Sign in with disabled user's verified email.", "Tenant is not selectable and tenant routes do not load.", "", "Not Run", "Manual Clerk OTP", "Disabled must never grant access."],
      ["TA-003", "P0", "Multi-business user", "Two active tenants", "Same email has active memberships in two tenants with different roles.", "Open selector, choose Tenant A, then switch business to Tenant B.", "Current tenant, role, and visible modules change to selected business only.", "", "Not Run", "Manual Clerk OTP", "Confirms account switching."],
      ["TA-004", "P1", "No tenant user", "None", "Clerk user has no active OS PLUS membership.", "Sign in and open /dashboard.", "User lands on no-tenant state with no tenant data.", "", "Not Run", "Manual Clerk OTP", "Use test config or approved real email."]
    ]
  },
  {
    name: "Roles Permissions",
    rows: [
      ["RP-001", "P0", "Owner/Admin", "Phantom Threads", "Active owner/admin membership.", "Open Settings > Users.", "User list and add/edit controls are available.", "", "Not Run", "Manual", ""],
      ["RP-002", "P0", "Manager", "Phantom Threads", "Active manager membership.", "Open Salary and Finance routes.", "Restricted modules are hidden or blocked by permission checks.", "", "Not Run", "Manual", ""],
      ["RP-003", "P0", "Finance", "Phantom Threads", "Active finance membership.", "Open Finance and Salary; attempt production action by direct URL/form if possible.", "Finance/salary access works; production mutation is denied.", "", "Not Run", "Manual + Automated", ""],
      ["RP-004", "P1", "Viewer", "Phantom Threads", "Active viewer membership.", "Open dashboard/reports and attempt write actions.", "Read views load where allowed; writes fail with permission errors.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Tenant Isolation",
    rows: [
      ["TI-001", "P0", "Owner/Admin", "Tenant A and Tenant B", "Both tenants have distinct customers/orders/workers.", "Use Tenant A session and request Tenant B customer/order IDs by direct URL.", "Tenant B records return not found or are inaccessible.", "", "Not Run", "Automated", "Cover ID-based pages."],
      ["TI-002", "P0", "Owner/Admin", "Tenant A and Tenant B", "Both tenants have attachments.", "Attempt Tenant B attachment download URL while selected into Tenant A.", "Download route returns not found; no signed URL is issued.", "", "Not Run", "Automated", "Private storage path must remain hidden."],
      ["TI-003", "P0", "Owner/Admin", "Tenant A and Tenant B", "Both tenants have communication templates/messages.", "Switch tenants and open Settings > Communications.", "Only selected tenant settings, queue, and logs appear.", "", "Not Run", "Manual + Automated", ""],
      ["TI-004", "P0", "Public customer", "Public", "Tracking token from Tenant A exists.", "Open token and inspect visible fields.", "Only customer-safe Tenant A order data appears; no internal stages, workers, salary, notes, or private attachments.", "", "Not Run", "Manual + Automated", "Public tracking is token-only."]
    ]
  },
  {
    name: "Customers",
    rows: [
      ["CU-001", "P1", "Manager", "Phantom Threads", "Manager has customers permission.", "Create customer with name only.", "Customer saves with optional phone/email/address blank.", "", "Not Run", "Manual + Automated", ""],
      ["CU-002", "P0", "Manager", "Phantom Threads", "An active customer already has a mobile number.", "Attempt to create another customer using the same normalized Indian mobile in 10-digit, leading 0, +91, or 0091 form.", "Server blocks the duplicate, resolves the existing customer, and the inline order flow selects that customer without losing the order draft.", "", "Not Run", "Manual + Automated", "Application-level normalized mobile guard; mobile remains optional."],
      ["CU-003", "P1", "Manager", "Phantom Threads", "Customer exists with orders.", "Open customer detail.", "Order history and summary are tenant-scoped and accurate.", "", "Not Run", "Manual", ""]
      ,["CU-004", "P0", "Owner/Admin", "Phantom Threads", "CSV and XLSX customer fixtures contain valid Indian, explicit international, country-assisted foreign, ambiguous foreign, blank-name, malformed, and over-limit cases.", "Preview each file, including files larger than 5 MB or 5,000 data rows.", "Valid rows preview without writes; foreign numbers normalize only with explicit/country context; ambiguous phones, blank names, malformed files, and limits are rejected or counted; the invalid/skipped count is visible.", "", "Not Run", "Automated + Manual", "Manager and other roles must not see or execute import."]
      ,["CU-005", "P0", "Owner/Admin", "Phantom Threads", "Tenant contains matching Shopify IDs, normalized phones, exact emails, blank fields, and conflicting populated fields.", "Preview rows covering every matching path and resolve each email-only row as reuse, create separate, or skip.", "Shopify ID wins, then normalized phone; cross-key disagreement is invalid; phone matches always reuse; email-only matches wait for an explicit decision; blank fields can be filled and populated conflicts remain unchanged and visible.", "", "Not Run", "Automated + Manual", "No email address is used as a fake customer name."]
      ,["CU-006", "P0", "Owner/Admin", "Tenant A and Tenant B", "A valid approved preview, foreign tenant IDs, and one intentionally invalid row are available.", "Confirm the batch, retry the same idempotency key, attempt a tampered/foreign target, and force one row failure.", "The valid batch commits once; retry returns the receipt; tenant/tampered rows are rejected; any failure rolls back customers, addresses, identities, metadata, and receipt with no partial import.", "", "Not Run", "Database + Automated", "Database function is service-role-only and revalidates every target."]
      ,["CU-007", "P1", "Owner/Admin", "Phantom Threads", "Rows contain complete/incomplete addresses and Shopify totals, order counts, tags, tax and marketing flags.", "Confirm import, inspect customer/address records, reports, finance, and messaging configuration.", "Complete addresses become structured defaults only when no default exists; incomplete text remains legacy data; metadata is retained read-only; no historical orders/finance entries, report totals, or messaging consent are created.", "", "Not Run", "Database + Manual", "Metadata is a future Shopify-integration foundation only."]
    ]
  },
  {
    name: "Measurements",
    rows: [
      ["ME-001", "P1", "Owner/Admin", "Phantom Threads", "Item type exists.", "Create required measurement fields for item type.", "Fields save and appear in customer measurement forms.", "", "Not Run", "Manual", ""],
      ["ME-002", "P0", "Manager", "Phantom Threads", "Required fields configured.", "Attempt quick-add measurement missing required field.", "Server rejects with required-field message.", "", "Not Run", "Automated", ""],
      ["ME-003", "P1", "Manager", "Phantom Threads", "Standard size exists.", "Create order item using standard size.", "Internal order detail shows fit reference; public tracking does not expose measurements.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Configuration",
    rows: [
      ["CF-001", "P1", "Owner/Admin", "Phantom Threads", "Item types, stages, statuses, workgroups, payment modes, and expense categories exist.", "Edit each master and toggle an active state.", "Each tenant-owned record updates; historical production and finance references remain intact.", "", "Not Run", "Manual + Automated", ""],
      ["CF-002", "P0", "Owner/Admin", "Tenant A and Tenant B", "Tenant B configuration IDs are known.", "Submit Tenant B IDs from Tenant A edit forms.", "Every action rejects or returns not found; no Tenant B record changes.", "", "Not Run", "Automated", ""],
      ["CF-003", "P1", "Owner/Admin", "Phantom Threads", "Worker, workflow, locations, teams, measurement fields, standard sizes, and customer measurements exist.", "Edit each record, replace a workflow stage sequence, repeat with an inactive/foreign stage, then simultaneously activate an inactive workflow while deactivating its sole active stage.", "Valid changes save with tenant/reference validation; workflow create/default/stage writes are atomic; invalid replacement leaves the prior sequence intact; workflow-then-stage locking allows exactly one conflicting state change to commit; existing history remains available.", "", "Not Run", "Database + Manual + Automated", ""],
      ["CF-004", "P0", "Finance", "Phantom Threads", "An order payment exists.", "Open Finance payment correction, change allowed fields, enter a reason, and save.", "One order-locking transaction updates the payment and summary and stores immutable old/new values, actor, and reason without deleting payment history.", "", "Not Run", "Database + Manual", ""],
      ["CF-005", "P0", "System", "All tenants", "Expense-default migration is ready and tenants contain custom or partial categories.", "Apply migration, inspect existing tenants, then create a fresh tenant.", "Each tenant has the ten defaults exactly once by normalized name; custom, renamed, inactive, and deleted history is not overwritten or revived.", "", "Not Run", "Database + Automated", ""]
      ,["CF-006", "P0", "Finance", "Phantom Threads", "An order has an outstanding balance.", "Submit two concurrent payments whose combined value exceeds the balance.", "The order lock serializes both requests; at most one succeeds and payment rows never exceed the order total.", "", "Not Run", "Database", ""]
      ,["CF-007", "P1", "Owner/Admin", "Phantom Threads", "Measurement fields, sizes, measurements, and order history exist.", "Try to change a field key/item type or reassign any existing size/measurement to another item type.", "Creation identities are always immutable while labels, dimensions, notes, order, and active state remain editable; concurrent order creation cannot create an incompatible reference.", "", "Not Run", "Manual + Automated", ""]
      ,["CF-008", "P0", "Owner/Admin", "Phantom Threads", "Active stages and item types exist.", "Configure stage effort modes (assignment-only, units, hours, hybrid), then add compatible per-unit, per-hour, and percentage contribution rules; attempt an incompatible mode change.", "Compatible rules save tenant-safely; the incompatible change is blocked with a recoverable message; active/completed stage snapshots are not rewritten.", "", "Not Run", "Database + Manual + Automated", "Contribution values are analytics-only."]
      ,["CF-009", "P1", "Owner/Admin", "Phantom Threads", "A stage has a saved effort mode.", "Edit its effort mode and save, then reopen the stage.", "The dialog closes on success, visible feedback appears, and reopening shows the persisted mode rather than the prior default. A failed save keeps the editor and entered value open.", "", "Not Run", "Manual + Automated", ""]
      ,["CF-010", "P1", "Owner/Admin", "Phantom Threads", "Blazer stages support per-unit, per-hour, percentage, and no-rate cases.", "Save each rule, review the row summary, reopen one rule, and clear it with No monetary rule.", "Each success exits edit mode and shows a plain-language saved summary; percentage explains the discounted pre-GST pool and allocation basis; clearing hides stale rate input and shows the unconfigured warning.", "", "Not Run", "Manual + Automated", ""]
      ,["CF-011", "P1", "Owner/Admin", "Phantom Threads", "Master, workflow, measurement, user, location, team, and communication configuration records exist.", "Edit each configuration record successfully, then force a validation error in one dialog.", "Every successful edit dialog closes and shows confirmation; pending dialogs cannot close or double-submit; failed dialogs remain open with entered values and visible error feedback; no nested forms are created.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Orders",
    rows: [
      ["OR-001", "P0", "Manager", "Phantom Threads", "Customer, item type, workflow, payment mode exist.", "Create order with two items and partial payment.", "Order number auto-generates; items and payment save under selected tenant.", "", "Not Run", "Manual + Automated", ""],
      ["OR-002", "P1", "Manager", "Phantom Threads", "Order exists.", "Edit item notes, due date, delivery override, and fit reference.", "Allowed fields update; destructive changes are not exposed.", "", "Not Run", "Manual", ""],
      ["OR-003", "P0", "Manager", "Tenant A and Tenant B", "Known Tenant B order ID.", "Open Tenant B order ID from Tenant A session.", "Order detail returns not found or blocked.", "", "Not Run", "Automated", ""],
      ["OR-004", "P0", "Manager", "Phantom Threads", "An active legacy Boutique order exists with payment history; active item types and workflows are configured.", "Open order detail, add two new item rows in one save, and use a customer measurement on one row and a standard size on the other.", "Both items save atomically, each gets its own workflow instance and first ready stage, item history records the addition, totals recalculate from all active items, payments remain unchanged, and production/finance/public tracking refresh.", "", "Not Run", "Manual + Automated", "Run against an unpaid or paid order; a paid order can become partially paid after the total increases."],
      ["OR-005", "P0", "Manager", "Tenant A and Tenant B", "An editable Tenant A order exists; Tenant B IDs and an incompatible measurement or size are known.", "Attempt a multi-row add with one invalid or foreign reference, retry the same valid request key, and attempt rapid duplicate submission.", "Invalid batches roll back completely; tenant and fit-reference mismatches are rejected; an idempotent retry returns the original result; the pending dialog blocks edits, closing, and duplicate submission while preserving rows on error.", "", "Not Run", "Automated + Manual UI", "Also confirm cancelled and fully delivered orders cannot add items."]
    ]
  },
  {
    name: "Production",
    rows: [
      ["PR-001", "P0", "Manager", "Phantom Threads", "Order item has workflow instance and ready stage.", "Start stage with allowed worker.", "Stage starts, work log is created, item history records event.", "", "Not Run", "Manual + Automated", ""],
      ["PR-002", "P0", "Manager", "Phantom Threads", "Worker outside allowed workgroup exists.", "Attempt to start stage with disallowed worker.", "Action rejects worker assignment.", "", "Not Run", "Automated", ""],
      ["PR-003", "P1", "Manager", "Phantom Threads", "In-progress stage exists.", "Complete stage.", "Current stage completes and next stage becomes ready when applicable.", "", "Not Run", "Manual + Automated", ""]
      ,["PR-004", "P0", "Manager", "Phantom Threads", "A ready stage maps to multiple workgroups and eligible active workers; one worker belongs to two eligible groups.", "Open Start stage, add multiple workers, and choose the performed role for each row.", "Every worker-role pair is explicit; duplicate pairs are rejected; the stage and all work logs start atomically.", "", "Not Run", "Database + Manual + Automated", "The same worker may appear in different eligible roles, but not twice in the same role."]
      ,["PR-005", "P0", "Manager", "Phantom Threads", "A unit-tracked stage has item quantity 2.", "Credit 0.6 and 1.4 units to two workers, save, then complete; repeat with 0.25 and with a total other than 2.", "Tenth-unit credits save; completion requires positive credit per worker and an exact 2-unit total; 0.25 and invalid totals roll back.", "", "Not Run", "Database + Automated", ""]
      ,["PR-006", "P0", "Manager", "Phantom Threads", "An hour-tracked stage is ready for five eligible workers.", "Assign five workers, add 1 hour to each using +10m/+1h controls, and complete after about one elapsed hour.", "Total man-hours show 5h while elapsed stage/work-log time remains about 1h; time uses ten-minute increments.", "", "Not Run", "Manual + Automated", "Summed worker effort is intentionally independent of elapsed stage time."]
      ,["PR-007", "P0", "Manager", "Phantom Threads", "A hybrid stage is ready.", "Add multiple workers, enter both units and time, save partial effort, then complete with one worker missing either units or time.", "Partial in-progress saves are allowed; completion requires positive units and time for every worker and exact total units.", "", "Not Run", "Database + Manual + Automated", ""]
      ,["PR-008", "P0", "Manager", "Phantom Threads", "Item has a final after-discount, pre-GST value and item-type/stage rules exist.", "Run per-unit, per-hour, percentage-by-units, and percentage-by-hours cases with multiple workers.", "Fixed rules calculate per worker; percentage creates one pool from item final value and distributes it by credited effort with deterministic paise rounding; allocations sum exactly to the pool.", "", "Not Run", "Automated + Manual", "No per-worker duplication of a percentage pool."]
      ,["PR-009", "P1", "Manager", "Phantom Threads", "A stage has no item-type contribution rule.", "Start, edit, and complete the stage.", "A visible Rate not configured warning appears, production proceeds, and every calculated contribution is ₹0.", "", "Not Run", "Manual + Automated", "Configuration gaps never block production."]
      ,["PR-010", "P0", "Manager", "Phantom Threads", "An in-progress stage has a worker with recorded units or time.", "Remove that worker without a reason, then retry with a reason.", "The first save is rejected atomically; the second soft-removes the active contribution and writes immutable old/new correction audit data.", "", "Not Run", "Database + Manual", "A worker with zero recorded effort may be removed without a reason."]
      ,["PR-011", "P0", "Manager and Owner/Admin", "Phantom Threads", "A completed stage has snapshotted contributions.", "As manager, attempt a direct completed correction; as owner/admin, correct worker effort with a reason.", "Manager is denied server-side; owner/admin succeeds; original completion timestamps and elapsed duration remain unchanged; the audit reason is visible.", "", "Not Run", "Database + Manual + Automated", ""]
      ,["PR-012", "P0", "Owner/Admin", "Phantom Threads", "One stage is not started, one active, one completed; configuration is about to change.", "Change the stage/rate configuration, then inspect all three and start the not-started stage.", "Active/completed stages retain their snapshotted mode, rate, item value, and pool; only the newly started stage uses the new configuration; historical stages are not backfilled.", "", "Not Run", "Database + Automated", ""]
      ,["PR-013", "P0", "Manager", "Tenant A and Tenant B", "Tenant B worker/workgroup/stage IDs are known and a valid Tenant A submission exists.", "Submit foreign IDs, force an invalid row in a multi-worker save, rapidly submit twice, then replay the same idempotency key.", "Foreign references and invalid batches roll back fully; duplicate submission creates one result; an exact replay returns the stored receipt; altered data with the same key is rejected.", "", "Not Run", "Database + Automated", ""]
      ,["PR-014", "P0", "Finance", "Phantom Threads", "Stage contributions exist alongside salary, order, GST, payment, expense, and ledger data.", "Create and correct contributions, then compare all commercial and payroll records before and after.", "Only contribution analytics/audit records change; salary, order totals, GST, payments, expenses, worker ledgers, and finance reports remain identical.", "", "Not Run", "Database + Automated", "Contribution reports remain analytics-only."]
      ,["PR-015", "P1", "Manager", "Phantom Threads", "A unit/hybrid stage has item quantity 2 and two eligible workers.", "Open Start stage, add a second worker, reallocate with -1/-0.1/+0.1/+1, and complete valid effort.", "The first row starts at 2 units, the added row starts at zero, controls never exceed quantity or go below zero, and successful completion returns to the workflow view. Start/save remain open.", "", "Not Run", "Manual + Automated", ""]
      ,["PR-016", "P1", "Owner/Admin", "Phantom Threads", "Both item-type icon migrations are applied and create/edit item-type forms are available.", "Enter item names from boutique, laundry, food, and repair domains; open Suggested, search Emoji and Icons, change skin tone and icon color, reopen recent choices, then choose Default. Inspect order creation, order detail, Production list/board, and workflow detail at 320 px and desktop widths.", "Suggested choices respond to the name and retain recent local choices; all library tabs are keyboard-operable with named 44 px targets; emoji/skin tone and Lucide name/color save and reopen; invalid or mixed values fail server validation without losing input; Default is neutral; public tracking exposes no icon; normal pages do not load the picker catalogue.", "", "Not Run", "Manual + Automated", "Apply migrations 20260809140000 and 20260809150000 first; verify /emoji-data/en/data.json and messages.json return 200."]
      ,["PR-017", "P1", "Manager", "Phantom Threads", "Production contains more than 100 items across several workflows and garment types, including older matching items.", "Select two garment types and one workflow; change search, queue, list/board view, and workflow pane; test both disclosures with keyboard and Escape.", "Predicates apply before the 100-row page limit so older matching items appear; all active URL state is preserved; reset clears filters; malformed/foreign IDs never broaden results; controls announce expanded state and Escape closes them.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Worker Contributions",
    rows: [
      ["WC-001", "P1", "Owner/Admin or Manager", "Phantom Threads", "Completed contribution logs span multiple workers and weeks; one active log exists.", "As owner/admin open the dashboard report; as manager use Production > Worker contributions. Switch between contribution value, units, man-hours, and completed stages.", "Both approved roles can access the report without exposing unrelated dashboard modules; leaderboard and weekly trend use only completed logs, bucket by completion week, keep each metric separate, and show the correct tenant-scoped totals.", "", "Not Run", "Manual + Automated", "No composite efficiency score."],
      ["WC-002", "P1", "Owner/Admin or Manager", "Phantom Threads", "Completed work includes configured and unconfigured contribution snapshots.", "Review report summary and a zero-value worker/stage.", "Configuration coverage shows priced versus completed stages so a missing-rate zero is distinguishable; labels state analytics only and do not imply salary or revenue.", "", "Not Run", "Manual + Automated", ""],
      ["WC-003", "P0", "Owner/Admin or Manager", "Tenant A and Tenant B", "Both tenants have completed contributions.", "Open the report in each tenant using identical date ranges.", "Every leaderboard, trend, and coverage value contains only the current tenant workers and logs.", "", "Not Run", "Database + Automated", ""]
    ]
  },
  {
    name: "Attendance",
    rows: [
      ["AT-001", "P1", "Manager", "Phantom Threads", "Active workers exist.", "Mark daily attendance and save sheet.", "One tenant-scoped attendance row per marked worker/date is saved.", "", "Not Run", "Manual + Automated", ""],
      ["AT-002", "P1", "Manager", "Phantom Threads", "Attendance data exists.", "Open overview with 14-day range and worker filters.", "Charts, regularity, and attention board reflect selected workers only.", "", "Not Run", "Manual", ""],
      ["AT-003", "P0", "Manager", "Tenant A and Tenant B", "Tenant B worker ID known.", "Submit attendance for Tenant B worker ID from Tenant A.", "Action rejects worker ownership mismatch.", "", "Not Run", "Automated", ""],
      ["AT-004", "P0", "Manager", "Phantom Threads", "The supplied sample .xls report is available and some active worker profile names match exactly after normalization.", "Upload the report and preview it.", "Preview writes nothing and shows report month, exact matches, unmatched/ambiguous workers, new/update rows, future dates, blank statuses, and unknown statuses.", "", "Not Run", "Manual + Automated", "Use docs_v2/sample_Attendance_Report.xls."],
      ["AT-005", "P0", "Manager", "Phantom Threads", "Preview contains matched and unmatched source workers.", "Confirm import.", "Only exact normalized active-worker matches are inserted or updated; no worker profiles are created and skipped names remain unchanged.", "", "Not Run", "Database + Automated", "No fuzzy matching."],
      ["AT-006", "P0", "Manager", "Tenant A and Tenant B", "Both tenants contain workers; a workbook name matches only Tenant B.", "Import while selected into Tenant A.", "Tenant B worker and attendance rows are untouched; the source worker is skipped for Tenant A.", "", "Not Run", "Database + Automated", ""],
      ["AT-007", "P0", "Manager", "Phantom Threads", "A worker/date already has manual attendance and a note.", "Preview and confirm a workbook containing that worker/date.", "Preview labels the row as an update; status/time/hours update atomically and the existing free-text note is preserved.", "", "Not Run", "Database + Automated", ""],
      ["AT-008", "P0", "Manager", "Phantom Threads", "A valid preview and idempotency key exist.", "Confirm twice or rapidly double-click confirmation.", "The second request returns the stored receipt and creates no duplicate attendance or import receipt.", "", "Not Run", "Database + Manual UI", ""],
      ["AT-009", "P0", "Manager", "Phantom Threads", "A workbook contains a future date, blank status, unknown status, and duplicate normalized worker name.", "Preview and confirm.", "Those rows/workers are explicitly reported and skipped; valid exact matches still import.", "", "Not Run", "Automated", ""],
      ["AT-010", "P0", "Manager", "Phantom Threads", "A confirmed batch contains a tampered/invalid referenced row.", "Execute confirmation through the database contract.", "The complete transaction rolls back and no partial attendance/import receipt remains.", "", "Not Run", "Database", ""],
      ["AT-011", "P0", "System", "Phantom Threads", "A confirmed attendance import receipt exists.", "Attempt direct update and direct delete as service role, then delete its parent test tenant through approved cleanup.", "Direct mutation is rejected as immutable; approved parent cascade cleanup remains possible.", "", "Not Run", "Database", ""],
      ["AT-012", "P0", "System", "Phantom Threads", "Adversarial .xlsx fixtures contain oversized expansion, unsafe ratios, local/central header mismatches, renamed extensions, or excessive entries/sheets/rows/columns/cells.", "Preview each fixture.", "Every unsafe workbook is rejected before worksheet materialization via signature/header checks and hard-capped inflation; no receipt is written; valid .xls and .xlsx structures still reach format validation.", "", "Not Run", "Automated", ""]
    ]
  },
  {
    name: "Platform UX",
    rows: [
      ["UX-001", "P1", "Any authorized user", "Phantom Threads", "A server mutation is available.", "Click its submit CTA.", "The CTA immediately shows a spinner and action-specific pending label and is disabled until completion.", "", "Not Run", "Manual + Automated", ""],
      ["UX-002", "P0", "Any authorized user", "Phantom Threads", "A slow mutation is available.", "Submit, then attempt another CTA, navigation, dialog close, Escape, and rapid resubmit.", "Conflicting interaction is blocked, focused pending dialogs cannot close, and only one mutation is accepted.", "", "Not Run", "Manual UI", ""],
      ["UX-003", "P1", "Any authorized user", "Phantom Threads", "An internal route link is available.", "Click the link on desktop and mobile widths.", "A visible Opening page progress state appears and clears after navigation or the fail-safe timeout.", "", "Not Run", "Manual UI", ""],
      ["UX-004", "P1", "Manager", "Phantom Threads", "A recoverable validation failure can be triggered in add-items or attendance import.", "Submit invalid data.", "Error feedback is visible, the draft remains available, and retry succeeds without duplicate submission.", "", "Not Run", "Manual + Automated", ""],
      ["UX-005", "P1", "Keyboard user", "Phantom Threads", "Any shared dialog is available.", "Open it, tab through controls, press Shift+Tab at the first control, close it, and repeat during a pending save.", "Focus stays inside the modal, accessible name/description are exposed, focus returns to the trigger, and pending dialogs cannot close.", "", "Not Run", "Manual + Automated", ""],
      ["UX-006", "P0", "Boutique user", "Boutique-only tenant", "The user has a role that would otherwise permit Tasks.", "Open /tasks directly and attempt a Task server action.", "Both read and mutation paths reject access because Laundry is not enabled; Tasks remains hidden in navigation.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Salary",
    rows: [
      ["SA-001", "P1", "Finance", "Phantom Threads", "Attendance and workers exist.", "Create salary period and generate suggestions.", "Suggestions derive from tenant workers, attendance, work logs, and ledger only.", "", "Not Run", "Manual + Automated", ""],
      ["SA-002", "P0", "Finance", "Phantom Threads", "Existing active salary period.", "Create overlapping salary period.", "Action rejects overlap with clear message.", "", "Not Run", "Automated", ""],
      ["SA-003", "P1", "Finance", "Phantom Threads", "Salary calculation exists.", "Finalize payable and record partial payment.", "Final payable is preserved; salary_paid ledger entry appears in Finance rollup.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Finance",
    rows: [
      ["FI-001", "P1", "Finance", "Phantom Threads", "Expense category and payment mode exist.", "Create expense.", "Expense saves under selected tenant and appears in finance timeline.", "", "Not Run", "Manual + Automated", ""],
      ["FI-002", "P1", "Finance", "Phantom Threads", "Customer/order payments and salary payments exist.", "Open Finance overview.", "Cash in/out, salary expense rollup, dues, and P&L are consistent.", "", "Not Run", "Manual", ""],
      ["FI-003", "P0", "Manager", "Phantom Threads", "Manager lacks finance permission.", "Attempt finance write action.", "Action is denied.", "", "Not Run", "Automated", ""]
    ]
  },
  {
    name: "Attachments",
    rows: [
      ["AD-001", "P1", "Manager", "Phantom Threads", "Customer exists.", "Upload JPG attachment on customer profile.", "Attachment saves in private bucket and appears as thumbnail/gallery item.", "", "Not Run", "Manual", ""],
      ["AD-002", "P0", "Manager", "Tenant A and Tenant B", "Tenant B attachment ID known.", "Open download URL from Tenant A session.", "No signed URL is issued.", "", "Not Run", "Automated", ""],
      ["AD-003", "P0", "Public customer", "Public", "Customer-visible and internal attachments exist.", "Open public tracking.", "Internal/private attachments do not appear.", "", "Not Run", "Manual + Automated", ""]
      ,["AD-004", "P1", "Manager", "Phantom Threads", "An attachment-capable internal record is open.", "Save one uploaded file and one external URL; repeat with an invalid submission.", "Each success closes and resets the add dialog and the new card appears; invalid input stays open with data and error feedback; duplicate save is blocked while pending.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Communications",
    rows: [
      ["CO-001", "P0", "Owner/Admin", "Phantom Threads", "Settings access.", "Create template with blocked variable such as {{worker_name}}.", "Action rejects unsafe variable.", "", "Not Run", "Automated", ""],
      ["CO-002", "P1", "Manager", "Phantom Threads", "Order has customer phone/email.", "Queue manual tracking link dry-run.", "Message queue and log are tenant-scoped and marked dry-run.", "", "Not Run", "Manual + Automated", ""],
      ["CO-003", "P0", "Owner/Admin", "Phantom Threads", "Communication channel settings open.", "Attempt to set live mode.", "Action rejects live sending in MVP slice.", "", "Not Run", "Automated", ""]
    ]
  },
  {
    name: "Public Tracking",
    rows: [
      ["PT-001", "P0", "Public customer", "Public", "Valid tracking token exists.", "Open /track/[token].", "Page loads without Clerk and shows tenant branding, order dates, item names, and customer-safe statuses.", "", "Not Run", "Manual + Automated", ""],
      ["PT-002", "P0", "Public customer", "Public", "Invalid/random token.", "Open /track/random-token.", "Page returns not found.", "", "Not Run", "Automated", ""],
      ["PT-003", "P0", "Public customer", "Public", "Order has measurements, workers, stage names, notes, salary, private attachments.", "Open tracking token.", "None of those internal fields appear in payload or UI.", "", "Not Run", "Manual + Automated", "Regression for 2026-06-04 hardening patch."]
    ]
  },
  {
    name: "Deployment Smoke",
    rows: [
      ["DS-001", "P0", "Owner/Admin", "Preview", "Preview deployment and env vars configured.", "Open sign-in, selector, dashboard, orders, customers, production, finance.", "All routes return 200 for authorized user.", "", "Not Run", "Manual", ""],
      ["DS-002", "P0", "System", "Preview", "Migrations applied.", "Run typecheck, lint, and production build.", "All commands pass.", "", "Not Run", "Automated", ""],
      ["DS-003", "P1", "Owner/Admin", "Clean boutique tenant", "Fresh pilot tenant exists.", "Run one order from setup through tracking and dry-run communication.", "Pilot loop completes without cross-tenant leakage or role surprises.", "", "Not Run", "Manual", ""]
    ]
  }
];

const workbook = Workbook.create();

function writeSheet(sheetConfig) {
  const sheet = workbook.worksheets.add(sheetConfig.name);
  sheet.showGridLines = false;
  const data = [columns, ...sheetConfig.rows];
  const range = sheet.getRangeByIndexes(0, 0, data.length, columns.length);
  range.values = data;
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: "#D8DEE4" };
  sheet.getRangeByIndexes(0, 0, 1, columns.length).format = {
    fill: "#1F2937",
    font: { bold: true, color: "#F9FAFB" }
  };
  sheet.getRangeByIndexes(1, 0, sheetConfig.rows.length, columns.length).format = {
    fill: "#F8FAFC",
    font: { color: "#111827" }
  };
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A:A").format.columnWidthPx = 88;
  sheet.getRange("B:B").format.columnWidthPx = 70;
  sheet.getRange("C:D").format.columnWidthPx = 120;
  sheet.getRange("E:G").format.columnWidthPx = 260;
  sheet.getRange("H:H").format.columnWidthPx = 160;
  sheet.getRange("I:I").format.columnWidthPx = 95;
  sheet.getRange("J:J").format.columnWidthPx = 130;
  sheet.getRange("K:K").format.columnWidthPx = 190;
  sheet.getRangeByIndexes(1, 0, sheetConfig.rows.length, columns.length).format.autofitRows();
  sheet.getRangeByIndexes(0, 0, 1, columns.length).format.rowHeightPx = 28;
  sheet.tables.add(`A1:K${data.length}`, true, `${sheetConfig.name.replace(/[^A-Za-z0-9]/g, "")}Table`);
}

for (const sheetConfig of sheets) {
  writeSheet(sheetConfig);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
