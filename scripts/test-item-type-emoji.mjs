import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

import {
  itemTypeEmojiOptions,
  itemTypeIconColorOptions,
  normalizeItemTypeIcon,
} from "../src/features/settings/item-type-icon.ts";

assert.ok(itemTypeEmojiOptions.length >= 12, "suggestions should retain the current useful garment choices");
assert.equal(new Set(itemTypeEmojiOptions.map((option) => option.emoji)).size, itemTypeEmojiOptions.length);
assert.equal(new Set(itemTypeIconColorOptions.map((option) => option.value)).size, itemTypeIconColorOptions.length);

assert.deepEqual(
  normalizeItemTypeIcon({ kind: "emoji", emoji: " 👔 ", name: null, color: null }),
  { kind: "emoji", emoji: "👔", name: null, color: null },
);
assert.deepEqual(
  normalizeItemTypeIcon({ kind: "lucide", emoji: null, name: "washing-machine", color: "blue" }),
  { kind: "lucide", emoji: null, name: "washing-machine", color: "blue" },
);
assert.deepEqual(
  normalizeItemTypeIcon({ kind: null, emoji: null, name: null, color: null }),
  { kind: null, emoji: null, name: null, color: null },
);
assert.throws(
  () => normalizeItemTypeIcon({ kind: "emoji", emoji: "👔🥻", name: null, color: null }),
  /one emoji/i,
);
assert.throws(
  () => normalizeItemTypeIcon({ kind: "lucide", emoji: null, name: "Not Valid!", color: "blue" }),
  /valid icon/i,
);
assert.throws(
  () => normalizeItemTypeIcon({ kind: "lucide", emoji: null, name: "not-a-real-lucide-icon", color: "blue" }),
  /valid icon/i,
);
assert.throws(
  () => normalizeItemTypeIcon({ kind: "lucide", emoji: null, name: "shirt", color: "rainbow" }),
  /icon color/i,
);

const [
  migration,
  actions,
  query,
  filters,
  production,
  tracking,
  orderItemBuilder,
  picker,
  pickerPanel,
  itemTypeIcon,
  itemTypesPage,
  configurationDialogs,
  packageJson,
  emojiData,
  emojiMessages,
  lucideCatalog,
] = await Promise.all([
  readFile(new URL("../supabase/migrations/20260809150000_item_type_icon_picker.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/features/settings/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/production/queries.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/production/production-filter-bar.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/production/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(public)/track/[trackingToken]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/orders/order-item-builder.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/item-types/item-type-icon-picker.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/item-types/item-type-icon-picker-panel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/item-types/item-type-icon.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/(tenant)/settings/item-types/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/settings/configuration-edit-dialogs.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../public/emoji-data/en/data.json", import.meta.url), "utf8"),
  readFile(new URL("../public/emoji-data/en/messages.json", import.meta.url), "utf8"),
  readFile(new URL("../src/features/settings/lucide-icon-names.generated.ts", import.meta.url), "utf8"),
]);

assert.match(migration, /add column if not exists icon_kind text/i);
assert.match(migration, /add column if not exists icon_name text/i);
assert.match(migration, /add column if not exists icon_color text/i);
assert.match(migration, /update public\.item_types[\s\S]*icon_kind = 'emoji'/i);
assert.match(migration, /item_types_icon_selection_check/i);
assert.match(actions, /icon_kind: parsed\.icon\.kind/);
assert.match(actions, /icon_name: parsed\.icon\.name/);
assert.match(actions, /icon_color: parsed\.icon\.color/);
assert.match(query, /select\("id, name, icon_emoji, icon_kind, icon_name, icon_color"\)/);
assert.match(query, /if \(!parsedFilters\.success\)[\s\S]*itemsQuery = itemsQuery\.eq\("id", impossibleId\)/);
assert.ok(query.indexOf('in("item_type_id"') < query.indexOf(".limit(100)"), "garment filtering must occur before pagination");
assert.ok(query.indexOf('in("workflow_id"') < query.indexOf(".limit(100)"), "workflow filtering must occur before pagination");
assert.match(query, /Promise\.all\(\[\s*itemsQuery,/);
assert.match(filters, /name="itemTypeId"/);
assert.match(filters, /aria-haspopup="dialog"/);
assert.match(production, /matchesItemType/);
assert.doesNotMatch(tracking, /icon_emoji|icon_kind|icon_name|icon_color|ItemTypeIcon/);
assert.match(orderItemBuilder, /itemType\.icon_kind === "emoji" && itemType\.icon_emoji \? itemType\.icon_emoji : "👕"/);
assert.doesNotMatch(orderItemBuilder, /<option[\s\S]*?<ItemTypeIcon/);

assert.match(picker, /dynamic\([\s\S]*\(\) => import\("\.\/item-type-icon-picker-panel"\)/);
assert.match(picker, /open \? \([\s\S]*<LazyItemTypeIconPickerPanel/);
assert.match(picker, /@radix-ui\/react-popover/);
assert.match(picker, /Popover\.Content[\s\S]*bg-background[\s\S]*text-foreground/);
assert.doesNotMatch(picker, /bg-popover|text-popover-foreground/);
assert.match(picker, /name="iconKind"/);
assert.match(picker, /name="iconEmoji"/);
assert.match(picker, /name="iconName"/);
assert.match(picker, /name="iconColor"/);
assert.match(picker, /dispatchEvent\(new Event\("input", \{ bubbles: true \}\)\)/);
assert.doesNotMatch(picker, /from "frimousse"/);
assert.doesNotMatch(picker, /lucide-react\/dynamic/);

assert.match(pickerPanel, /from "frimousse"/);
assert.match(pickerPanel, /lucide-react\/dynamic/);
assert.match(pickerPanel, /emojibaseUrl="\/emoji-data"/);
assert.match(pickerPanel, /skinTone="none"/);
assert.doesNotMatch(pickerPanel, /bg-popover/);
assert.match(pickerPanel, /Suggested/);
assert.match(pickerPanel, /Emoji/);
assert.match(pickerPanel, /Icons/);
assert.match(pickerPanel, /Search icons/);
assert.match(pickerPanel, /SkinToneSelector/);
assert.match(pickerPanel, /localStorage/);
assert.doesNotMatch(pickerPanel, /Upload/);
assert.match(pickerPanel, /ICON_RESULT_BATCH_SIZE/);
assert.match(pickerPanel, /lucideIconNames\.filter/);

assert.match(itemTypeIcon, /LazyLucideIcon/);
assert.match(itemTypeIcon, /kind === "lucide"/);
assert.match(itemTypesPage, /<ItemTypeIconPicker/);
assert.match(configurationDialogs, /<ItemTypeIconPicker/);

const parsedPackage = JSON.parse(packageJson);
assert.equal(parsedPackage.dependencies.frimousse, "^0.3.0");
assert.ok(parsedPackage.dependencies["@radix-ui/react-popover"]);
assert.ok(parsedPackage.devDependencies["emojibase-data"]);
assert.ok(JSON.parse(emojiData).length > 1000, "self-hosted emoji data should contain the full catalogue");
assert.ok(JSON.parse(emojiMessages).groups.length > 1, "self-hosted emoji category labels should be present");
assert.match(lucideCatalog, /"washing-machine"/);
assert.match(lucideCatalog, /"shirt"/);
await access(new URL("../public/emoji-data/en/data.json", import.meta.url));

console.log("Item-type emoji/icon picker and production filter tests passed.");
