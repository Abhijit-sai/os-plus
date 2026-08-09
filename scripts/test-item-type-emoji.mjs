import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { normalizeItemTypeEmoji } from "../src/features/settings/item-type-emoji.ts";

assert.equal(normalizeItemTypeEmoji(" 👔 "), "👔");
assert.equal(normalizeItemTypeEmoji(""), null);
assert.equal(normalizeItemTypeEmoji("👨‍👩‍👧‍👦"), "👨‍👩‍👧‍👦");
assert.equal(normalizeItemTypeEmoji("🇮🇳"), "🇮🇳");
assert.throws(() => normalizeItemTypeEmoji("A"), /one emoji/i);
assert.throws(() => normalizeItemTypeEmoji("👔🥻"), /one emoji/i);

const [migration, actions, query, filters, production, tracking, orderItemBuilder] = await Promise.all([
  readFile(new URL("../supabase/migrations/20260809140000_item_type_emoji.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/features/settings/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/production/queries.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/production/production-filter-bar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/production/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(public)/track/[trackingToken]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/orders/order-item-builder.tsx", import.meta.url), "utf8")
]);

assert.match(migration, /add column if not exists icon_emoji text/i);
assert.match(actions, /icon_emoji: parsed\.iconEmoji/);
assert.match(query, /from\("item_types"\).*eq\("tenant_id", context\.tenant\.id\)/s);
assert.match(query, /if \(!parsedFilters\.success\)[\s\S]*itemsQuery = itemsQuery\.eq\("id", impossibleId\)/);
assert.match(query, /itemsQuery = itemsQuery\.in\("item_type_id"/);
assert.match(query, /itemsQuery = itemsQuery\.in\("workflow_id"/);
assert.ok(query.indexOf('in("item_type_id"') < query.indexOf(".limit(100)"), "garment filtering must occur before pagination");
assert.ok(query.indexOf('in("workflow_id"') < query.indexOf(".limit(100)"), "workflow filtering must occur before pagination");
assert.match(query, /Promise\.all\(\[\s*itemsQuery,/);
assert.match(filters, /name="itemTypeId"/);
assert.match(filters, /selectedWorkflowIds\.map/);
assert.match(filters, /aria-expanded=\{workflowOpen\}/);
assert.match(filters, /aria-expanded=\{itemTypeOpen\}/);
assert.match(filters, /aria-haspopup="dialog"/);
assert.equal((filters.match(/role="dialog"/g) ?? []).length, 2);
assert.match(filters, /event\.key === "Escape"/);
assert.match(filters, /workflowTriggerRef\.current\?\.focus\(\)/);
assert.match(filters, /itemTypeTriggerRef\.current\?\.focus\(\)/);
assert.match(production, /matchesItemType/);
assert.match(production, /addItemTypeParams/);
assert.doesNotMatch(tracking, /icon_emoji|ItemTypeIcon/);
assert.match(orderItemBuilder, /\{itemType\.icon_emoji \?\? "👕"\} \{itemType\.name\}/);

console.log("Item-type emoji and production filter tests passed.");
