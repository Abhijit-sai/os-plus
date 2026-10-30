import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

// Native client submit controls can own their pending state. Both the form and
// control must use the same busy value; implicit and unguarded submits still fail.
function assertNativeButtons(source, filename) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attribute = (opening, name) => opening.attributes.properties.find(
    (entry) => ts.isJsxAttribute(entry) && entry.name.getText(file) === name,
  )?.initializer;
  const expression = (value) => value && ts.isJsxExpression(value)
    ? (value.expression && ts.isIdentifier(value.expression) ? value.expression.text : undefined) : undefined;
  function visit(node) {
    const opening = ts.isJsxElement(node) ? node.openingElement
      : ts.isJsxSelfClosingElement(node) ? node : undefined;
    if (opening?.tagName.getText(file) === "button") {
      const type = attribute(opening, "type");
      const literal = type && ts.isStringLiteral(type) ? type.text : undefined;
      if (literal !== "button") {
        assert.equal(literal, "submit", `${filename} native button needs explicit button or guarded submit type`);
        let ancestor = node.parent;
        while (ancestor && !(ts.isJsxElement(ancestor) && ancestor.openingElement.tagName.getText(file) === "form")) {
          ancestor = ancestor.parent;
        }
        const form = ancestor?.openingElement;
        const hasSpread = (element) => element?.attributes.properties.some(ts.isJsxSpreadAttribute);
        const hasFormOverride = opening.attributes.properties.some(
          (entry) => ts.isJsxAttribute(entry) && entry.name.getText(file) === "form",
        );
        assert.ok(!hasSpread(opening) && !hasSpread(form) && !hasFormOverride,
          `${filename} native submit has ambiguous spread or form ownership`);
        const busy = form && expression(attribute(form, "aria-busy"));
        const handler = form && expression(attribute(form, "onSubmit"));
        assert.ok(busy && handler && busy === expression(attribute(opening, "disabled")),
          `${filename} native submit must be disabled by its enclosing client form busy state`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

// Keep the inventory rule from silently accepting missing or unrelated guards.
assert.throws(() => assertNativeButtons('<button>Save</button>', 'implicit.tsx'));
assert.throws(() => assertNativeButtons('<form onSubmit={send} aria-busy={pending}><button type="submit">Save</button></form>', 'unguarded.tsx'));
assert.throws(() => assertNativeButtons('<form onSubmit={send} aria-busy={pending}><button type="submit" disabled={other}>Save</button></form>', 'unrelated.tsx'));
assertNativeButtons('<form onSubmit={send} aria-busy={pending}><button type="submit" disabled={pending}>Save</button></form>', 'guarded.tsx');
assert.throws(() => assertNativeButtons('<form onSubmit={send} aria-busy={false}><button type="submit" disabled={false}>Save</button></form>', 'constant.tsx'));
assert.throws(() => assertNativeButtons('<form onSubmit={send} aria-busy={pending}><button type="submit" disabled={pending} {...props}>Save</button></form>', 'button-spread.tsx'));
assert.throws(() => assertNativeButtons('<form onSubmit={send} aria-busy={pending} {...props}><button type="submit" disabled={pending}>Save</button></form>', 'form-spread.tsx'));
assert.throws(() => assertNativeButtons('<form onSubmit={send} aria-busy={pending}><button type="submit" disabled={pending} form="anotherForm">Save</button></form>', 'form-owner.tsx'));
assertNativeButtons('<button type="button">Open</button>', 'action.tsx');

const button = read("src/components/ui/button.tsx");
const provider = read("src/components/ui/action-feedback-provider.tsx");
const rootLayout = read("src/app/layout.tsx");
const dialog = read("src/components/ui/dialog.tsx");
const taskQueue = read("src/features/tasks/task-queue-client.tsx");
const laundryCustody = read("src/verticals/laundry/custody/laundry-custody-client.tsx");
const addItemsDialog = read("src/components/orders/add-order-items-dialog.tsx");
const attendanceImportDialog = read("src/components/attendance/attendance-import-dialog.tsx");
const addPaymentDialog = read("src/components/orders/add-payment-dialog.tsx");
const workflowActionDialogs = read("src/components/production/workflow-action-dialogs.tsx");

assert.match(button, /useFormStatus/);
assert.match(button, /LoaderCircle/);
assert.match(button, /pendingLabel/);
assert.match(button, /disabled=\{disabled \|\| isPendingSubmit\}/);
assert.match(button, /startAction/);
assert.match(button, /finishAction/);

assert.match(provider, /inert/);
assert.match(provider, /aria-busy/);
assert.match(provider, /Working/);
assert.match(provider, /addEventListener\("click"/);
assert.match(provider, /window\.location\.href/);
assert.match(provider, /role="status"/);
assert.match(provider, /isBusy/);

assert.match(dialog, /role="dialog"/);
assert.match(dialog, /aria-modal="true"/);
assert.match(dialog, /focusableElements/);
assert.match(dialog, /feedback\?\.isBusy/);
assert.match(taskQueue, /useActionFeedback/);
assert.match(taskQueue, /startAction/);
assert.match(taskQueue, /finishAction/);
assert.match(laundryCustody, /useActionFeedback/);
assert.match(laundryCustody, /startAction/);
assert.match(laundryCustody, /finishAction/);
assert.match(addItemsDialog, /data-preserve-dirty-on-submit="true"/);
assert.match(addItemsDialog, /\{\(\{ close \}\) => <form/);
assert.match(addItemsDialog, /onClick=\{close\}/);
assert.match(attendanceImportDialog, /\{\(\{ close \}\) => <form/);
assert.match(attendanceImportDialog, /onClick=\{close\}/);
assert.match(addPaymentDialog, /data-preserve-dirty-on-submit="true"/);
assert.match(workflowActionDialogs, /data-preserve-dirty-on-submit="true"/);

assert.match(rootLayout, /ActionFeedbackProvider/);

const sourceRoot = path.join(root, "src");
for (const absolutePath of sourceFiles(sourceRoot)) {
  const relativePath = path.relative(root, absolutePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const pendingAwareFragments = [...source.matchAll(/const\s+(\w+)\s*=\s*\(\s*<>[\s\S]*?<\/>(?:\s*)\);/g)]
    .filter((match) => /<(?:Button|SubmitButton)\b/.test(match[0]))
    .map((match) => match[1]);

  for (const match of source.matchAll(/<form\b[\s\S]*?<\/form>/g)) {
    const form = match[0];
    if (!/action=\{|formAction=/.test(form)) continue;
    const hasPendingAwareSubmit = /<(?:Button|SubmitButton)\b/.test(form)
      || pendingAwareFragments.some((fragmentName) => form.includes(`{${fragmentName}}`))
      || (form.includes("{children}")
        && /React\.useActionState/.test(source)
        && /preventClose=\{pending\}/.test(source));
    assert.equal(
      hasPendingAwareSubmit,
      true,
      `${relativePath} contains a server-action form without a pending-aware submit control`,
    );
  }

  assertNativeButtons(source, relativePath);
}

console.log("Global action feedback contract passed");
