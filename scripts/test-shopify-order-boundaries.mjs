import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}
// Architectural regression, backed by executed SQL view/parent-guard tests.
// An intentional future source review must have its own authorized projection;
// it must not reintroduce raw orders into the shared operational/finance readers.
for (const path of files("src")) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    /\.from\("orders"\)\s*\.select\(/,
    `${path}: existing reads must use the guarded view`,
  );
}
for (const path of [
  "orders/queries",
  "finance/queries",
  "dashboard/queries",
  "customers/queries",
  "tracking/queries",
  "communications/actions",
  "attachments/actions",
  "work-units/queries",
]) {
  assert.match(
    readFileSync(`src/features/${path}.ts`, "utf8"),
    /\.from\("local_operational_orders"\)/,
    `${path}: shared draft boundary is required`,
  );
}
for (const path of ["orders/queries", "production/queries"]) {
  assert.match(readFileSync(`src/features/${path}.ts`, "utf8"), /\.from\("operational_orders"\)/, `${path}: released-only operational projection is required`);
  assert.match(readFileSync(`src/features/${path}.ts`, "utf8"), /\.from\("operational_order_items"\)/, `${path}: draft exclusion must precede item pagination`);
}
const runtime = readFileSync("src/features/work-units/queries.ts", "utf8");
assert.doesNotMatch(
  runtime,
  /loadLookupRows[\s\S]*?\(\s*"orders"/,
  "Indirect V2 lookup must not bypass the view",
);
console.log(
  "All existing order readers use the shared draft/finance/public boundary; SQL behavior covered by disposable DB tests.",
);
