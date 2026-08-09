import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { normalizeItemTypeEmoji } from "../src/features/settings/item-type-emoji.ts";

assert.equal(normalizeItemTypeEmoji(" 👔 "), "👔");
assert.equal(normalizeItemTypeEmoji(""), null);
assert.equal(normalizeItemTypeEmoji("👨‍👩‍👧‍👦"), "👨‍👩‍👧‍👦");
assert.equal(normalizeItemTypeEmoji("🇮🇳"), "🇮🇳");
assert.throws(() => normalizeItemTypeEmoji("A"), /one emoji/i);
assert.throws(() => normalizeItemTypeEmoji("👔🥻"), /one emoji/i);

const [migration, actions, query, filters, production, tracking] = await Promise.all([
  readFile(new URL("../supabase/migrations/20260809140000_item_type_emoji.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/features/settings/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/production/queries.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/production/production-filter-bar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/production/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(public)/track/[trackingToken]/page.tsx", import.meta.url), "utf8")
]);

assert.match(migration, /add column if not exists icon_emoji text/i);
assert.match(actions, /icon_emoji: parsed\.iconEmoji/);
assert.match(query, /from\("item_types"\).*eq\("tenant_id", context\.tenant\.id\)/s);
assert.match(filters, /name="itemTypeId"/);
assert.match(filters, /selectedWorkflowIds\.map/);
assert.match(production, /matchesItemType/);
assert.match(production, /addItemTypeParams/);
assert.doesNotMatch(tracking, /icon_emoji|ItemTypeIcon/);

console.log("Item-type emoji and production filter tests passed.");
