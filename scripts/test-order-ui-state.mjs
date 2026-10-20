import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function load(path, imports) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, URLSearchParams, require(name) {
    if (name === "react") return React;
    if (name === "react/jsx-runtime") return jsx;
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return loadedModule.exports;
}

const children = ({ children }) => children;
const imports = {
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  "lucide-react": { Route: () => null, Search: () => null, Plus: () => null, ArrowUpRight: () => null },
  "@/components/ui/card": Object.fromEntries(["Card", "CardContent", "CardDescription", "CardHeader", "CardTitle"].map(name => [name, children])),
  "@/components/ui/button": { Button: children },
  "@/components/ui/badge": { Badge: children },
  "@/components/ui/dialog": { Dialog: () => null },
  "@/components/ui/separator": { Separator: () => null },
  "@/components/ui/input": { Input: props => React.createElement("input", props) },
  "@/components/ui/label": { Label: props => React.createElement("label", props) },
  "@/components/layout/command-bar": { CommandBar: children },
  "@/components/layout/page-header": { PageHeader: ({ title }) => React.createElement("h1", null, title) },
  "@/components/dashboard/metric-card": { MetricCard: () => null },
  "@/components/design-system/status-badge": { StatusBadge: ({ value }) => React.createElement("span", { "data-status": value }, value) },
  "@/features/orders/financial-display": { localOrderReceivable: () => 0, matchesLocalPayment: () => false },
  "@/features/orders/delivery-date": { deliveryDayOffset: () => null },
  "@/features/orders/shopify-imported": { getImportedShopifyOrders: async () => [], getRetainedShopifyBusinessOrder: async () => null },
  "@/features/orders/shopify-setup": {},
  "@/features/orders/shopify-setup-actions": {}
};
for (const [path, name] of [
  ["orders/shopify-imported-order", "ShopifyImportedOrder"], ["orders/shopify-draft-setup-form", "ShopifyDraftSetupForm"],
  ["attachments/attachment-panel", "AttachmentPanel"], ["communications/order-message-dialog", "OrderMessageDialog"],
  ["item-types/item-type-icon", "ItemTypeIcon"], ["orders/add-payment-dialog", "AddPaymentDialog"],
  ["orders/shopify-payment-panel", "ShopifyPaymentPanel"], ["orders/add-order-items-dialog", "AddOrderItemsDialog"],
  ["orders/customer-context-sheet", "CustomerContextSheet"], ["orders/edit-order-dialog", "EditOrderDialog"],
  ["production/item-workflow-panel", "ItemWorkflowPanel"]
]) imports[`@/components/${path}`] = { [name]: () => null };

function detailData({ status = "in_progress", stageStatus = "ready_to_start", publicName = "Delivered", final = true,
  current = true, source = "shopify", workflowStatus = "in_progress" } = {}) {
  const arrays = ["payments", "itemTypes", "workflows", "paymentModes", "workflowStages", "workLogs", "workers",
    "workerWorkgroups", "stageWorkgroups", "workgroups", "contributionRules", "contributionCorrections", "itemHistory",
    "customerOrders", "customerOrderItems", "customerMeasurements", "measurementFields", "orderItemAttachments", "orderMessages", "standardSizes"];
  return {
    ...Object.fromEntries(arrays.map(name => [name, []])),
    context: { tenant: {}, membership: { role: "owner_admin" } }, customer: {},
    shopifySummary: { held: false },
    order: { id: "test", source, order_number: "TEST-ONLY", order_status: status, payment_status: "paid",
      delivery_type: "store_pickup", total_amount: 100, amount_paid: 100 },
    items: [{ id: "item", name: "Fixture garment", item_status: status, customer_status_id: "public", quantity: 1, final_price: 100 }],
    workflowInstances: [{ order_item_id: "item", status: workflowStatus, current_stage_instance_id: current ? "final" : null }],
    stageInstances: [
      { id: "first", order_item_id: "item", sequence_number: 1, status: "completed", stage_master_id: "make" },
      { id: "final", order_item_id: "item", sequence_number: 2, status: stageStatus, stage_master_id: "handoff", customer_status_id: "public" }
    ],
    stageMasters: [{ id: "make", name: "Making" }, { id: "handoff", name: publicName }],
    customerStatuses: [{ id: "public", name: publicName, is_final_status: final }]
  };
}
async function renderDetail(options) {
  const { default: Page } = load("../src/app/(tenant)/orders/[orderId]/page.tsx", {
    ...imports, "@/features/orders/queries": { getOrderDetailPageData: async () => detailData(options) }
  });
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ orderId: "test" }) }));
}
function field(html, label) {
  return html.match(new RegExp(`${label}</p>\\s*<p[^>]*>([^<]*)</p>`))?.[1];
}

test("ready/in-progress/paused/blocked final stages do not announce delivery on local or Shopify orders", async () => {
  for (const source of ["walk_in", "shopify"]) {
    for (const stageStatus of ["ready_to_start", "in_progress", "paused", "blocked"]) {
      const html = await renderDetail({ source, stageStatus });
      assert.equal(field(html, "Public status"), "in progress", `${source}: ${stageStatus}`);
      assert.ok(!html.includes('data-status="Delivered"'));
      assert.ok(html.includes('data-status="in_progress"'), "Keep the warning badge's enum token");
      assert.equal(field(html, "Internal stage"), "Delivered");
    }
  }
});
test("completed delivery has a completed internal stage, not Not started", async () => {
  const html = await renderDetail({ status: "delivered", stageStatus: "completed", current: false, workflowStatus: "completed" });
  assert.equal(field(html, "Internal stage"), "Completed");
  assert.equal(field(html, "Public status"), "Delivered");
});
test("ordinary non-final public labels survive while work is in progress", async () => {
  const html = await renderDetail({ publicName: "Being stitched", final: false, stageStatus: "in_progress" });
  assert.equal(field(html, "Public status"), "Being stitched");
});
test("a final custom label is withheld until the item is actually delivered", async () => {
  assert.equal(field(await renderDetail({ publicName: "Picked up" }), "Public status"), "in progress");
  assert.equal(field(await renderDetail({ status: "delivered", publicName: "Picked up", stageStatus: "completed", current: false }), "Public status"), "Picked up");
});
test("finished production without final delivery status says Completed internally without claiming delivery", async () => {
  const html = await renderDetail({ status: "completed", publicName: "Ready for collection", final: false,
    stageStatus: "completed", current: false, workflowStatus: "completed" });
  assert.equal(field(html, "Internal stage"), "Completed");
  assert.equal(field(html, "Public status"), "Ready for collection");
});
test("completed stage names cannot manufacture delivered state", async () => {
  const html = await renderDetail({ status: "completed", publicName: "Delivery preparation", final: false,
    stageStatus: "completed", current: false, workflowStatus: "completed" });
  assert.ok(!html.includes('data-status="delivered"'));
  assert.equal(field(html, "Public status"), "Delivery preparation");
});
test("a stale pointer to a completed stage does not make it active again", async () => {
  const html = await renderDetail({ status: "delivered", stageStatus: "completed", current: true, workflowStatus: "completed" });
  assert.equal(field(html, "Internal stage"), "Completed");
});
test("unstarted work stays Not started; skipped work does not announce delivery", async () => {
  const unstarted = await renderDetail({ status: "not_started", stageStatus: "not_started", current: false, workflowStatus: "not_started", final: false, publicName: "Order confirmed" });
  assert.equal(field(unstarted, "Internal stage"), "Not started");
  const skipped = await renderDetail({ status: "completed", stageStatus: "skipped", current: false, workflowStatus: "completed" });
  assert.equal(field(skipped, "Internal stage"), "Completed");
  assert.equal(field(skipped, "Public status"), "completed");
});

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const match = findElement(child, predicate);
    if (match) return match;
  }
  return null;
}
async function filterForm(params) {
  const { default: Page } = load("../src/app/(tenant)/orders/page.tsx", {
    ...imports, "@/features/orders/queries": { getOrdersPageData: async () => ({
      page: 1, hasNextPage: false, orders: [], customers: [], orderItems: [], stageInstances: [],
      search: params.q ?? "", shopifySummaries: [], shopifyCommercialSummaries: []
    }) }
  });
  return findElement(await Page({ searchParams: Promise.resolve(params) }), node => node.type === "form");
}
test("Reset and browser navigation remount uncontrolled controls for every changed URL filter", async () => {
  const reset = await filterForm({});
  const filtered = await filterForm({ q: "Fixture", payment: "paid", status: "draft", source: "shopify", view: "all" });
  assert.notEqual(filtered.key, reset.key, "React must not reuse the stale uncontrolled form on Reset");
  assert.equal((await filterForm({})).key, reset.key);
  for (const [name, value] of Object.entries({ q: "Fixture", payment: "paid", status: "draft", source: "shopify", view: "all" })) {
    assert.notEqual((await filterForm({ [name]: value })).key, reset.key, name);
  }
  assert.equal(findElement(reset, node => node.props.name === "q").props.defaultValue, "");
  for (const name of ["payment", "status", "source"]) {
    assert.equal(findElement(reset, node => node.props.name === name).props.defaultValue, "all");
  }
});
