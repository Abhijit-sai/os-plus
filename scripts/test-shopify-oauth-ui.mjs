import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const code = ts.transpileModule(readFileSync(new URL("../src/components/settings/shopify-approval-form.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const testModule = { exports: {} };
vm.runInNewContext(code, { module: testModule, exports: testModule.exports, require(name) {
  if (name === "react") return React; if (name === "react/jsx-runtime") return jsx; throw Error(name);
} });
test("approval form asks only for the shop, labels its redirect and never asks tenants to paste credentials", () => {
  const html = renderToStaticMarkup(React.createElement(testModule.exports.ShopifyApprovalForm, {}));
  assert.match(html, /Shopify store domain/); assert.match(html, /Connect Shopify/);
  assert.match(html, /approve access on Shopify/);
  assert.match(html, /name="shop"/);
  assert.ok(!/name="tenant|client_secret|password|access_token/.test(html));
  const bound = renderToStaticMarkup(React.createElement(testModule.exports.ShopifyApprovalForm,
    { shopDomain: "fictional.myshopify.com", hasCredential: true, result: "failed" }));
  assert.match(bound, /readOnly=""/); assert.match(bound, /Reauthorize Shopify/);
  assert.match(bound, /role="alert"/); assert.match(bound, /No import was started/);
});
