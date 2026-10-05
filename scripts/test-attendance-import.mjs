import assert from "node:assert/strict";
import * as XLSX from "@e965/xlsx";

import {
  matchAttendanceWorkers,
  normalizeWorkerName,
  parseAttendanceWorkbook,
  resolveAttendanceStatus
} from "../src/features/attendance/import-parser.ts";

// Keep this regression runnable without an untracked private attendance export.
const fixtureRows = [];
for (let workerIndex = 0; workerIndex < 20; workerIndex += 1) {
  fixtureRows.push(
    ["Dept Name", "Synthetic", "Report Month", "August 2026"],
    ["Name", `Synthetic Worker ${workerIndex + 1}`, "Empcode", `${workerIndex + 1}`],
    ["Date", ...Array.from({ length: 31 }, (_, index) => index + 1)],
    [],
    ["In", ...Array(31).fill("09:00")],
    ["Out", ...Array(31).fill("17:08")],
    ["Work", ...Array(31).fill("8.13")],
    [], [],
    ["Status", ...Array(31).fill("P")]
  );
}
const fixtureWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(fixtureWorkbook, XLSX.utils.aoa_to_sheet(fixtureRows), "Attendance");
const workbook = XLSX.write(fixtureWorkbook, { bookType: "xls", type: "buffer" });
const parsed = parseAttendanceWorkbook(workbook, "sample_Attendance_Report.xls", "2026-08-08");

assert.equal(parsed.reportMonth, "2026-08", "the sample report month should be detected");
assert.equal(parsed.sourceWorkers.length, 20, "all worker blocks in the legacy XLS report should be parsed");
assert.equal(normalizeWorkerName("  ANWAR\u00a0  PASHA "), "anwar pasha");
assert.equal(resolveAttendanceStatus("WO"), "holiday");
assert.equal(resolveAttendanceStatus("HL"), "holiday");
assert.equal(resolveAttendanceStatus("LV"), "leave");
assert.equal(resolveAttendanceStatus("unknown"), null);

const firstWorker = parsed.sourceWorkers[0];
assert.ok(firstWorker.sourceName, "the first source worker should have a name");
assert.equal(firstWorker.days.length, 8, "future dates should be excluded from importable days");
assert.equal(firstWorker.futureDateCount, 23, "future source dates should be reported, not imported");
assert.equal(typeof firstWorker.blankStatusCount, "number", "blank status cells must be counted for preview reporting");
assert.equal(firstWorker.days[0]?.attendanceDate, "2026-08-01");
assert.equal(firstWorker.days[0]?.totalHours, 8.13, "import must preserve decimal hours");

const matches = matchAttendanceWorkers(parsed.sourceWorkers.slice(0, 3), [
  { id: "worker-1", name: `  ${firstWorker.sourceName.toLocaleUpperCase("en-IN")} ` },
  { id: "worker-2", name: parsed.sourceWorkers[1].sourceName },
  { id: "worker-3", name: parsed.sourceWorkers[1].sourceName.toLocaleUpperCase("en-IN") }
]);

assert.equal(matches[0]?.matchState, "matched", "normalized exact names should match");
assert.equal(matches[0]?.workerId, "worker-1");
assert.equal(matches[1]?.matchState, "ambiguous", "duplicate normalized profile names must be skipped");
assert.equal(matches[2]?.matchState, "unmatched", "unknown source names must be skipped");

assert.throws(
  () => parseAttendanceWorkbook(Buffer.from("not a workbook"), "attendance.xls", "2026-08-08"),
  /valid Excel workbook/i,
  "invalid workbook bytes should be rejected"
);

function makeDeclaredXlsxEntry({ compressedBytes, localUncompressedBytes, uncompressedBytes }) {
  const resolvedLocalUncompressedBytes = localUncompressedBytes ?? uncompressedBytes;
  const bytes = Buffer.alloc(99);
  bytes.writeUInt32LE(0x04034b50, 0);
  bytes.writeUInt32LE(compressedBytes, 18);
  bytes.writeUInt32LE(resolvedLocalUncompressedBytes, 22);
  bytes.writeUInt32LE(0x02014b50, 31);
  bytes.writeUInt32LE(compressedBytes, 51);
  bytes.writeUInt32LE(uncompressedBytes, 55);
  bytes.writeUInt32LE(0, 73);
  bytes.writeUInt32LE(0x06054b50, 77);
  bytes.writeUInt16LE(1, 85);
  bytes.writeUInt16LE(1, 87);
  bytes.writeUInt32LE(46, 89);
  bytes.writeUInt32LE(31, 93);
  return bytes;
}

assert.throws(
  () => parseAttendanceWorkbook(
    makeDeclaredXlsxEntry({ compressedBytes: 1024, uncompressedBytes: 11 * 1024 * 1024 }),
    "compressed-bomb.xlsx",
    "2026-08-08"
  ),
  /expands beyond 10 MB/i,
  "oversized compressed XLSX entries must be rejected before workbook materialization"
);

assert.throws(
  () => parseAttendanceWorkbook(
    makeDeclaredXlsxEntry({ compressedBytes: 1, uncompressedBytes: 1, localUncompressedBytes: 11 * 1024 * 1024 }),
    "mismatched-local-header.xlsx",
    "2026-08-08"
  ),
  /entry sizes or checksum disagree/i,
  "local ZIP headers must not bypass central-directory expansion limits"
);

assert.throws(
  () => parseAttendanceWorkbook(
    makeDeclaredXlsxEntry({ compressedBytes: 1, uncompressedBytes: 1, localUncompressedBytes: 11 * 1024 * 1024 }),
    "renamed-bomb.xls",
    "2026-08-08"
  ),
  /content is XLSX but the file extension is \.xls/i,
  "renaming a ZIP workbook to .xls must not bypass XLSX archive safety"
);

const validXlsxWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(validXlsxWorkbook, XLSX.utils.aoa_to_sheet([["Valid but empty"]]), "Attendance");
const validXlsxBytes = XLSX.write(validXlsxWorkbook, { bookType: "xlsx", type: "buffer" });
assert.throws(
  () => parseAttendanceWorkbook(validXlsxBytes, "valid-empty.xlsx", "2026-08-08"),
  /does not contain recognizable attendance worker sections/i,
  "a structurally valid bounded XLSX must pass archive preflight and reach attendance-format validation"
);

console.log("Attendance Excel parser and exact-name matching tests passed.");
