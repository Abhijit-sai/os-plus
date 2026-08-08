import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

const violations = [];
for (const absolutePath of sourceFiles(path.join(root, "src", "app"))) {
  const source = fs.readFileSync(absolutePath, "utf8");
  if (/^[\s\r\n]*["']use client["'];/.test(source)) continue;

  if (/import\s*\{[^}]*\bbuttonVariants\b[^}]*\}\s*from\s*["']@\/components\/ui\/button["']/.test(source)) {
    violations.push(path.relative(root, absolutePath));
  }
}

assert.deepEqual(
  violations,
  [],
  `Server modules must not import buttonVariants through the client Button boundary: ${violations.join(", ")}`,
);

console.log("Client/server UI boundary contract passed");
