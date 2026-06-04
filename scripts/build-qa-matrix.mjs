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
      ["CU-002", "P1", "Manager", "Phantom Threads", "Existing customer has phone.", "Create another customer with similar phone.", "Suggestions appear, but duplicate creation remains allowed.", "", "Not Run", "Manual", ""],
      ["CU-003", "P1", "Manager", "Phantom Threads", "Customer exists with orders.", "Open customer detail.", "Order history and summary are tenant-scoped and accurate.", "", "Not Run", "Manual", ""]
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
    name: "Orders",
    rows: [
      ["OR-001", "P0", "Manager", "Phantom Threads", "Customer, item type, workflow, payment mode exist.", "Create order with two items and partial payment.", "Order number auto-generates; items and payment save under selected tenant.", "", "Not Run", "Manual + Automated", ""],
      ["OR-002", "P1", "Manager", "Phantom Threads", "Order exists.", "Edit item notes, due date, delivery override, and fit reference.", "Allowed fields update; destructive changes are not exposed.", "", "Not Run", "Manual", ""],
      ["OR-003", "P0", "Manager", "Tenant A and Tenant B", "Known Tenant B order ID.", "Open Tenant B order ID from Tenant A session.", "Order detail returns not found or blocked.", "", "Not Run", "Automated", ""]
    ]
  },
  {
    name: "Production",
    rows: [
      ["PR-001", "P0", "Manager", "Phantom Threads", "Order item has workflow instance and ready stage.", "Start stage with allowed worker.", "Stage starts, work log is created, item history records event.", "", "Not Run", "Manual + Automated", ""],
      ["PR-002", "P0", "Manager", "Phantom Threads", "Worker outside allowed workgroup exists.", "Attempt to start stage with disallowed worker.", "Action rejects worker assignment.", "", "Not Run", "Automated", ""],
      ["PR-003", "P1", "Manager", "Phantom Threads", "In-progress stage exists.", "Complete stage.", "Current stage completes and next stage becomes ready when applicable.", "", "Not Run", "Manual + Automated", ""]
    ]
  },
  {
    name: "Attendance",
    rows: [
      ["AT-001", "P1", "Manager", "Phantom Threads", "Active workers exist.", "Mark daily attendance and save sheet.", "One tenant-scoped attendance row per marked worker/date is saved.", "", "Not Run", "Manual + Automated", ""],
      ["AT-002", "P1", "Manager", "Phantom Threads", "Attendance data exists.", "Open overview with 14-day range and worker filters.", "Charts, regularity, and attention board reflect selected workers only.", "", "Not Run", "Manual", ""],
      ["AT-003", "P0", "Manager", "Tenant A and Tenant B", "Tenant B worker ID known.", "Submit attendance for Tenant B worker ID from Tenant A.", "Action rejects worker ownership mismatch.", "", "Not Run", "Automated", ""]
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
  sheet.getRangeByIndexes(0, 0, data.length, columns.length).format.rowHeightPx = 42;
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
