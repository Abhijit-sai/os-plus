import fs from "node:fs/promises";
import path from "node:path";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs", "019fdb69-847e-71c3-9069-b52aa17a1db7");
const headers = [
  "Customer ID", "First Name", "Last Name", "Email", "Accepts Email Marketing",
  "Default Address Company", "Default Address Address1", "Default Address Address2",
  "Default Address City", "Default Address Province Code", "Default Address Country Code",
  "Default Address Zip", "Default Address Phone", "Phone", "Accepts SMS Marketing",
  "Total Spent", "Total Orders", "Note", "Tax Exempt", "Tags", "Accepts WhatsApp Marketing",
];

const baselineRows = [
  ["QA-BASE-PHONE", "QA Import", "Phone Existing", "qa.import.phone@example.invalid", "no", "", "10 Test Road", "", "Hyderabad", "TS", "IN", "500001", "", "+91 98765 41001", "no", 25, 1, "Synthetic import baseline", "no", "qa-baseline", "no"],
  ["QA-BASE-EMAIL", "QA Import", "Email Existing", "qa.import.email@example.invalid", "no", "", "", "", "", "", "IN", "", "", "+91 98765 41003", "no", 0, 0, "Synthetic email review baseline", "no", "qa-baseline", "no"],
];

const allCaseRows = [
  ["QA-BASE-PHONE", "Changed", "External Conflict", "changed@example.invalid", "yes", "", "99 Conflict Street", "", "Hyderabad", "TS", "IN", "500001", "", "+91 98765 41001", "yes", 999, 9, "Must not overwrite populated fields", "yes", "qa-conflict", "yes"],
  ["", "QA Reuse", "By Phone", "qa.reuse.phone@example.invalid", "no", "", "", "", "", "", "IN", "", "", "09876541003", "no", 0, 0, "Should reuse phone baseline", "no", "", "no"],
  ["", "QA Review", "By Email", "qa.import.email@example.invalid", "no", "", "", "", "", "", "IN", "", "", "", "no", 0, 0, "Requires explicit decision", "no", "", "no"],
  ["QA-US-001", "QA United", "States", "qa.us@example.invalid", "no", "", "20 Market Street", "", "San Francisco", "CA", "US", "94105", "", "(415) 555-2671", "no", 0, 0, "Country-assisted US national number", "no", "international", "no"],
  ["QA-GB-001", "QA United", "Kingdom", "qa.gb@example.invalid", "no", "", "5 King Street", "", "London", "", "GB", "SW1A 1AA", "", "0044 20 7946 0958", "no", 0, 0, "Explicit international prefix", "no", "international", "no"],
  ["QA-INCOMPLETE-ADDRESS", "QA Incomplete", "Address", "qa.incomplete@example.invalid", "no", "", "", "Suite 4", "London", "", "GB", "", "", "", "no", 0, 0, "Address retained as legacy text", "no", "address", "no"],
  ["QA-BLANK-NAME", "", "", "blank.name@example.invalid", "no", "", "", "", "", "", "IN", "", "", "", "no", 0, 0, "Skipped because name is blank", "no", "invalid", "no"],
  ["QA-AMBIGUOUS-PHONE", "QA Ambiguous", "Phone", "qa.ambiguous@example.invalid", "no", "", "", "", "", "", "", "", "", "4155552671", "no", 0, 0, "Invalid without country context", "no", "invalid", "no"],
  ["QA-PHONE-CONFLICT", "QA Phone", "Conflict", "qa.phone.conflict@example.invalid", "no", "", "", "", "", "", "US", "", "+44 20 7946 0958", "+1 415 555 2672", "no", 0, 0, "Invalid because phone columns disagree", "no", "invalid", "no"],
  ["QA-DUP-PHONE-1", "QA Duplicate", "Phone One", "qa.dup.phone1@example.invalid", "no", "", "", "", "", "", "IN", "", "", "+91 98765 41002", "no", 0, 0, "Both duplicate source phones invalid", "no", "invalid", "no"],
  ["QA-DUP-PHONE-2", "QA Duplicate", "Phone Two", "qa.dup.phone2@example.invalid", "no", "", "", "", "", "", "IN", "", "", "0091 98765 41002", "no", 0, 0, "Both duplicate source phones invalid", "no", "invalid", "no"],
  ["QA-DUP-ID", "QA Duplicate", "ID One", "qa.dup.id1@example.invalid", "no", "", "", "", "", "", "IN", "", "", "", "no", 0, 0, "Both duplicate source IDs invalid", "no", "invalid", "no"],
  ["QA-DUP-ID", "QA Duplicate", "ID Two", "qa.dup.id2@example.invalid", "no", "", "", "", "", "", "IN", "", "", "", "no", 0, 0, "Both duplicate source IDs invalid", "no", "invalid", "no"],
  ["QA-BAD-EMAIL", "QA Invalid", "Email", "not-an-email", "no", "", "", "", "", "", "IN", "", "", "", "no", 0, 0, "Invalid email", "no", "invalid", "no"],
];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeFixture(name, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const csvPath = path.join(outputDir, `${name}.csv`);
  const xlsxPath = path.join(outputDir, `${name}.xlsx`);
  await fs.writeFile(csvPath, `${csv}\r\n`, "utf8");

  const workbook = await Workbook.fromCSV(csv, { sheetName: "Customers" });
  const sheet = workbook.worksheets.getItem("Customers");
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  const used = sheet.getUsedRange();
  used.format.wrapText = true;
  used.format.borders = { preset: "inside", style: "thin", color: "#D8DEE4" };
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = {
    fill: "#1F2937",
    font: { bold: true, color: "#F9FAFB" },
  };
  used.format.autofitColumns();
  sheet.getRange("A:U").format.columnWidthPx = 150;
  sheet.getRange("A:A").format.columnWidthPx = 200;
  sheet.getRange("B:C").format.columnWidthPx = 175;
  sheet.getRange("D:D").format.columnWidthPx = 220;
  sheet.getRange("F:M").format.columnWidthPx = 190;
  sheet.getRange("R:R").format.columnWidthPx = 240;
  used.format.autofitRows();
  sheet.getRange("1:1").format.rowHeightPx = 52;
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(xlsxPath);
  return { csvPath, xlsxPath, workbook };
}

await fs.mkdir(outputDir, { recursive: true });
for (const fixture of [
  ["OS_PLUS_Customer_Import_Baseline", baselineRows],
  ["OS_PLUS_Customer_Import_All_Cases", allCaseRows],
]) {
  const { csvPath, workbook, xlsxPath } = await writeFixture(fixture[0], fixture[1]);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { maxResults: 50, useRegex: true },
    summary: `${fixture[0]} formula error scan`,
  });
  console.log(errors.ndjson);
  const preview = await workbook.render({ format: "png", range: "A1:U16", scale: 0.65, sheetName: "Customers" });
  await fs.writeFile(path.join(outputDir, `${fixture[0]}.png`), new Uint8Array(await preview.arrayBuffer()));
  console.log(csvPath);
  console.log(xlsxPath);
}

// The artifact runtime may leave a non-zero exit code after successful
// rendering on Windows. Reaching this line means every awaited export,
// inspection, and render completed; thrown failures still bypass it.
process.exitCode = 0;
