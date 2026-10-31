import { readFileSync, statSync } from "node:fs";
import { formatDailySummary } from "../src/features/chat/notifications/summary.ts";
// Write-free/offline preview of an authorized report snapshot. No DB, model, bot or env key is read.
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--input" || args[2] !== "--origin")
  throw new Error(
    "Usage: node --experimental-strip-types scripts/preview-chat-summary.mjs --input report.json --origin https://your-os-plus-domain",
  );
if (statSync(args[1]).size > 2000000) throw new Error("Report is too large.");
try {
  process.stdout.write(
    formatDailySummary(JSON.parse(readFileSync(args[1], "utf8")), args[3]) +
      "\n",
  );
} catch {
  throw new Error(
    "Report preview unavailable. Check the report snapshot and trusted origin.",
  );
}
