import fs from "node:fs/promises";
import path from "node:path";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.join(
  process.cwd(),
  "outputs",
  "019fdb69-847e-71c3-9069-b52aa17a1db7",
);
const outputPath = path.join(
  outputDir,
  "OS_PLUS_Phantom_Attendance_All_Cases.xlsx",
);

const reportMonth = "August 2026";
const days = Array.from({ length: 31 }, (_, index) => index + 1);
const futureStatuses = Array.from({ length: 23 }, () => "P");

const workers = [
  {
    code: "QA-DESIGNER",
    name: "Designer",
    statuses: ["P", "A", "HD", "LV", "HL", "WO", "", "XX", ...futureStatuses],
  },
  {
    code: "QA-MAN-1",
    name: "  MAN   1  ",
    statuses: ["PRESENT", "ABSENT", "HALFDAY", "LEAVE", "HOLIDAY", "WEEKOFF", "WEEKLYOFF", "L", ...futureStatuses],
  },
  {
    code: "QA-MAN-2",
    name: "Man 2",
    statuses: ["P", "P", "A", "P", "HD", "P", "LV", "P", ...futureStatuses],
  },
  {
    code: "QA-MAN-3",
    name: "Man 3",
    statuses: ["P", "A", "P", "P", "P", "HD", "P", "P", ...futureStatuses],
  },
  {
    code: "QA-RAVI",
    name: "Ravi",
    statuses: ["WO", "P", "P", "A", "P", "P", "HD", "LV", ...futureStatuses],
  },
  {
    code: "QA-UNMATCHED",
    name: "Ghost Worker QA",
    statuses: ["P", "P", "P", "P", "P", "P", "P", "P", ...futureStatuses],
  },
  {
    code: "QA-DUP-1",
    name: "Duplicate Source QA",
    statuses: ["P", "P", "P", "P", "P", "P", "P", "P", ...futureStatuses],
  },
  {
    code: "QA-DUP-2",
    name: " duplicate   source qa ",
    statuses: ["A", "A", "A", "A", "A", "A", "A", "A", ...futureStatuses],
  },
];

function timeRows(statuses) {
  const checkIn = statuses.map((status) => ["P", "PRESENT", "HD", "HALFDAY"].includes(status) ? "09:00" : "");
  const checkOut = statuses.map((status) => ["HD", "HALFDAY"].includes(status) ? "13:00" : ["P", "PRESENT"].includes(status) ? "17:30" : "");
  const duration = statuses.map((status) => ["HD", "HALFDAY"].includes(status) ? "04:00" : ["P", "PRESENT"].includes(status) ? "08:30" : "");
  return { checkIn, checkOut, duration };
}

const workbook = Workbook.create();
const plan = workbook.worksheets.add("Test Plan");
const reference = workbook.worksheets.add("Worker Reference");
const attendance = workbook.worksheets.add("Attendance Data");

plan.showGridLines = false;
plan.getRange("A1:F1").merge();
plan.getRange("A1").values = [["OS PLUS — Phantom Threads Attendance Import Test Plan"]];
plan.getRange("A1:F1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  rowHeightPx: 34,
};
plan.getRange("A2:B6").values = [
  ["Tenant", "Phantom Threads Test"],
  ["Report month", reportMonth],
  ["Known active workers", 5],
  ["Source worker sections", workers.length],
  ["Safety", "Preview first. Confirm only after reviewing exact matches and skipped rows."],
];
plan.getRange("A2:A6").format = { fill: "#E5E7EB", font: { bold: true } };
plan.getRange("A8:F21").values = [
  ["Case", "Source", "Condition", "Expected preview", "Confirm behavior", "Notes"],
  ["LIVE-AT-01", "Designer", "Exact active-worker match", "Exact", "Rows eligible", "Covers standard exact matching."],
  ["LIVE-AT-02", "MAN 1", "Case and repeated-space normalization", "Exact → Man 1", "Rows eligible", "Must not create a new worker."],
  ["LIVE-AT-03", "Ghost Worker QA", "No active profile", "Skipped / unmatched", "No rows written", "Confirms exact-name-only matching."],
  ["LIVE-AT-04", "Duplicate Source QA ×2", "Duplicate normalized source name", "Ambiguous (2)", "No rows written", "Two source blocks differ only by case/spacing."],
  ["LIVE-AT-05", "Designer + Man 1", "P/A/HD/LV/HL/WO and long aliases", "Known statuses accepted", "Mapped tenant attendance", "WO/WEEKOFF/WEEKLYOFF map to Holiday."],
  ["LIVE-AT-06", "Designer day 7", "Blank status", "Blank status +1", "Skipped", "No attendance row is written."],
  ["LIVE-AT-07", "Designer day 8", "Unknown code XX", "Unknown status +1", "Skipped", "No attendance row is written."],
  ["LIVE-AT-08", "All sections days 9–31", "Future dates as of 2026-08-08", "Future cells 184", "Skipped", "Recalculate expectation if run after 2026-08-08."],
  ["LIVE-AT-09", "Matched sections", "Times and durations", "09:00/17:30 and 8.5h; half-day 4h", "Typed values saved", "Absent/leave/holiday rows have blank times."],
  ["LIVE-AT-10", "Whole workbook", "Preview-only action", "5 exact, 1 unmatched, 2 ambiguous", "No write before confirm", "Source worker count should be 8."],
  ["LIVE-AT-11", "Man 3 day 1", "Existing attendance row, if pre-seeded manually", "Update count +1", "Existing note preserved", "Optional setup for update-path validation."],
  ["LIVE-AT-12", "Same confirmation", "Duplicate submission/idempotency", "Single receipt", "No duplicate rows", "Covered automatically; UI must block repeat clicks."],
  ["LIVE-AT-13", "Upload in Fundry Laundry", "Wrong tenant with zero workers", "0 exact; no confirmable rows", "No write", "Confirms tenant isolation without exposing Phantom profiles."],
];
plan.getRange("A8:F8").format = {
  fill: "#1D4ED8",
  font: { bold: true, color: "#FFFFFF" },
};
plan.getRange("A8:F21").format.wrapText = true;
plan.getRange("A8:F21").format.borders = {
  insideHorizontal: { style: "thin", color: "#D1D5DB" },
  bottom: { style: "thin", color: "#9CA3AF" },
};
plan.getRange("A:A").format.columnWidthPx = 100;
plan.getRange("B:B").format.columnWidthPx = 165;
plan.getRange("C:C").format.columnWidthPx = 220;
plan.getRange("D:E").format.columnWidthPx = 190;
plan.getRange("F:F").format.columnWidthPx = 250;
plan.getRange("A2:F21").format.autofitRows();
plan.freezePanes.freezeRows(8);
plan.tables.add("A8:F21", true, "AttendanceCasesTable");

reference.showGridLines = false;
reference.getRange("A1:D1").merge();
reference.getRange("A1").values = [["Worker Reference — observed in Phantom Threads Test"]];
reference.getRange("A1:D1").format = {
  fill: "#111827",
  font: { bold: true, color: "#FFFFFF", size: 15 },
  rowHeightPx: 32,
};
reference.getRange("A3:D11").values = [
  ["Source name", "Current profile", "Expected match", "Purpose"],
  ["Designer", "Designer", "Exact", "Exact-name status mapping"],
  ["  MAN   1  ", "Man 1", "Exact", "NFKC/case/space normalization"],
  ["Man 2", "Man 2", "Exact", "Insert-path coverage"],
  ["Man 3", "Man 3", "Exact", "Optional update-path coverage"],
  ["Ravi", "Ravi", "Exact", "Holiday and leave aliases"],
  ["Ghost Worker QA", "None", "Unmatched", "Must be skipped; never create worker"],
  ["Duplicate Source QA", "None", "Ambiguous", "First normalized duplicate source section"],
  [" duplicate   source qa ", "None", "Ambiguous", "Second normalized duplicate source section"],
];
reference.getRange("A3:D3").format = {
  fill: "#1D4ED8",
  font: { bold: true, color: "#FFFFFF" },
};
reference.getRange("A3:D11").format.borders = {
  insideHorizontal: { style: "thin", color: "#D1D5DB" },
  bottom: { style: "thin", color: "#9CA3AF" },
};
reference.getRange("A:D").format.wrapText = true;
reference.getRange("A:A").format.columnWidthPx = 190;
reference.getRange("B:B").format.columnWidthPx = 150;
reference.getRange("C:C").format.columnWidthPx = 120;
reference.getRange("D:D").format.columnWidthPx = 260;
reference.getRange("A3:D11").format.autofitRows();
reference.freezePanes.freezeRows(3);
reference.tables.add("A3:D11", true, "WorkerReferenceTable");

attendance.showGridLines = false;
let startRow = 0;
for (const worker of workers) {
  const rowNumber = startRow + 1;
  const { checkIn, checkOut, duration } = timeRows(worker.statuses);
  attendance.getRangeByIndexes(startRow, 0, 10, 32).values = [
    ["Dept Name", "QA", "Report Month", reportMonth, ...Array(28).fill("")],
    ["Empcode", worker.code, "Name", worker.name, ...Array(28).fill("")],
    ["Date", ...days],
    ["Shift", ...Array(31).fill("General")],
    ["In Time", ...checkIn],
    ["Out Time", ...checkOut],
    ["Work Duration", ...duration],
    ["Overtime", ...Array(31).fill("")],
    ["Late", ...Array(31).fill("")],
    ["Status", ...worker.statuses],
  ];

  attendance.getRange(`A${rowNumber}:AF${rowNumber}`).format = {
    fill: "#111827",
    font: { bold: true, color: "#FFFFFF" },
  };
  attendance.getRange(`A${rowNumber + 1}:AF${rowNumber + 1}`).format = {
    fill: "#E5E7EB",
    font: { bold: true, color: "#111827" },
  };
  attendance.getRange(`A${rowNumber + 2}:AF${rowNumber + 2}`).format = {
    fill: "#DBEAFE",
    font: { bold: true, color: "#1E3A8A" },
  };
  attendance.getRange(`A${rowNumber + 9}:AF${rowNumber + 9}`).format = {
    fill: "#F3F4F6",
    font: { bold: true, color: "#111827" },
  };
  attendance.getRange(`A${rowNumber}:AF${rowNumber + 9}`).format.borders = {
    insideHorizontal: { style: "thin", color: "#E5E7EB" },
    bottom: { style: "thin", color: "#9CA3AF" },
  };
  attendance.getRange(`A${rowNumber}:A${rowNumber + 9}`).format.font = { bold: true };
  startRow += 11;
}

attendance.getRange("A:A").format.columnWidthPx = 108;
attendance.getRange("B:AF").format.columnWidthPx = 50;
attendance.getRange(`A1:AF${startRow}`).format = {
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
attendance.getRange(`A1:A${startRow}`).format.horizontalAlignment = "left";
attendance.getRange(`A1:AF${startRow}`).format.rowHeightPx = 24;
attendance.freezePanes.freezeColumns(1);

await fs.mkdir(outputDir, { recursive: true });

const planCheck = await workbook.inspect({
  kind: "table",
  sheetId: "Test Plan",
  range: "A1:F21",
  include: "values,formulas",
  tableMaxRows: 21,
  tableMaxCols: 6,
  maxChars: 7000,
});
console.log(planCheck.ndjson);

const dataCheck = await workbook.inspect({
  kind: "region",
  sheetId: "Attendance Data",
  range: "A1:AF21",
  tableMaxRows: 21,
  tableMaxCols: 10,
  maxChars: 5000,
});
console.log(dataCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["Test Plan", "Worker Reference", "Attendance Data"]) {
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: sheetName === "Attendance Data" ? 0.8 : 1.2,
    format: "png",
  });
  await fs.writeFile(
    path.join(outputDir, `${sheetName.replaceAll(" ", "-").toLowerCase()}.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
