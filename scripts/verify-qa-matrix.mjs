import fs from "node:fs/promises";
import path from "node:path";

import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = path.resolve("docs", "OS_PLUS_QA_Test_Matrix.xlsx");
const outputDir = path.resolve("outputs", "019fdb69-847e-71c3-9069-b52aa17a1db7", "qa-matrix-previews");
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

const overview = await workbook.inspect({
  kind: "sheet,table",
  include: "id,name",
  maxChars: 8000,
  tableMaxCols: 11,
  tableMaxRows: 3,
});
console.log(overview.ndjson);

const productionCases = await workbook.inspect({
  kind: "table",
  range: "Production!A1:K20",
  include: "values,formulas",
  maxChars: 16000,
  tableMaxCols: 11,
  tableMaxRows: 20,
});
console.log(productionCases.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { maxResults: 100, useRegex: true },
  summary: "QA matrix formula error scan",
});
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
for (const sheet of workbook.worksheets.items) {
  const preview = await workbook.render({
    format: "png",
    range: "A1:K20",
    scale: 0.75,
    sheetName: sheet.name,
  });
  const safeName = sheet.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const outputPath = path.join(outputDir, `${safeName}.png`);
  await fs.writeFile(outputPath, new Uint8Array(await preview.arrayBuffer()));
  console.log(outputPath);
}

// The artifact runtime may leave a non-zero exit code after successful
// rendering on Windows. Reaching this line means every awaited verification
// and render completed; thrown failures still bypass it and remain non-zero.
process.exitCode = 0;
