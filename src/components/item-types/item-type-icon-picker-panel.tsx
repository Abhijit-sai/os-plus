"use client";

import * as React from "react";
import { Check, RotateCcw, Search } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { EmojiPicker } from "frimousse";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getItemTypeIconColorClass,
  itemTypeEmojiOptions,
  itemTypeIconColorOptions,
  itemTypeLucideSuggestions,
  type ItemTypeIconSelection,
} from "@/features/settings/item-type-icon";
import { cn } from "@/lib/utils";
import { lucideIconNames } from "@/features/settings/lucide-icon-names.generated";

type PickerTab = "suggested" | "emoji" | "icons";
type RecentSelection = ItemTypeIconSelection & { label: string };

const RECENT_STORAGE_KEY = "os-plus:item-type-icon-recent:v1";
export const ICON_RESULT_BATCH_SIZE = 48;

function isRecentSelection(value: unknown): value is RecentSelection {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecentSelection>;
  return (
    typeof candidate.label === "string"
    && (
      (candidate.kind === "emoji" && typeof candidate.emoji === "string")
      || (candidate.kind === "lucide" && typeof candidate.name === "string")
    )
  );
}

function readRecentSelections() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter(isRecentSelection).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function selectionKey(selection: ItemTypeIconSelection) {
  return selection.kind === "emoji" ? `emoji:${selection.emoji}` : `lucide:${selection.name}:${selection.color}`;
}

function saveRecentSelection(selection: RecentSelection) {
  try {
    const next = [selection, ...readRecentSelections().filter((item) => selectionKey(item) !== selectionKey(selection))].slice(0, 8);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A private browser or storage policy can disable localStorage. Selection still works.
  }
}

function matchesItemName(name: string, label: string, keywords: readonly string[]) {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return false;
  return [label, ...keywords].some((candidate) => normalized.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(normalized));
}

function LucidePreview({ name, color = "default", className = "h-5 w-5" }: { name: string; color?: string | null; className?: string }) {
  return <DynamicIcon aria-hidden="true" className={cn(className, getItemTypeIconColorClass(color))} name={name as IconName} />;
}

function ChoiceButton({
  label,
  selected,
  visual,
  onClick,
}: {
  label: string;
  selected: boolean;
  visual: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-center text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "border-foreground bg-muted ring-1 ring-ring",
      )}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
    >
      {visual}
      <span className="w-full truncate">{label}</span>
      {selected ? <Check aria-hidden="true" className="absolute right-1 top-1 h-3.5 w-3.5" /> : null}
    </button>
  );
}

export function ItemTypeIconPickerPanel({
  itemTypeName,
  selection,
  onSelect,
  onUpdate,
}: {
  itemTypeName: string;
  selection: ItemTypeIconSelection;
  onSelect: (selection: ItemTypeIconSelection) => void;
  onUpdate: (selection: ItemTypeIconSelection) => void;
}) {
  const [tab, setTab] = React.useState<PickerTab>("suggested");
  const [iconSearch, setIconSearch] = React.useState("");
  const [iconLimit, setIconLimit] = React.useState(ICON_RESULT_BATCH_SIZE);
  const [iconColor, setIconColor] = React.useState(selection.kind === "lucide" ? selection.color ?? "default" : "default");
  const [recent, setRecent] = React.useState<RecentSelection[]>(() => readRecentSelections());

  const choose = (nextSelection: RecentSelection) => {
    saveRecentSelection(nextSelection);
    setRecent(readRecentSelections());
    onSelect({ kind: nextSelection.kind, emoji: nextSelection.emoji, name: nextSelection.name, color: nextSelection.color });
  };

  const suggestedEmoji = React.useMemo(() => {
    const matches = itemTypeEmojiOptions.filter((option) => matchesItemName(itemTypeName, option.label, option.keywords));
    return (matches.length ? matches : itemTypeEmojiOptions).slice(0, 8);
  }, [itemTypeName]);

  const suggestedIcons = React.useMemo(() => {
    const matches = itemTypeLucideSuggestions.filter((option) => matchesItemName(itemTypeName, option.label, option.keywords));
    return (matches.length ? matches : itemTypeLucideSuggestions).slice(0, 8);
  }, [itemTypeName]);

  const filteredIconNames = React.useMemo(() => {
    const search = iconSearch.toLowerCase().trim().replaceAll(" ", "-");
    return search ? lucideIconNames.filter((name) => name.includes(search)) : lucideIconNames;
  }, [iconSearch]);
  const visibleIconNames = filteredIconNames.slice(0, iconLimit);

  const changeIconColor = (color: string) => {
    setIconColor(color);
    if (selection.kind === "lucide" && selection.name) {
      onUpdate({ kind: "lucide", emoji: null, name: selection.name, color });
    }
  };

  const tabs: Array<{ value: PickerTab; label: string }> = [
    { value: "suggested", label: "Suggested" },
    { value: "emoji", label: "Emoji" },
    { value: "icons", label: "Icons" },
  ];

  return (
    <div className="overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b px-3 pt-2">
        <div className="flex" role="tablist" aria-label="Item icon libraries">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              className={cn(
                "min-h-11 border-b-2 border-transparent px-3 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                tab === item.value && "border-foreground font-medium text-foreground",
              )}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 px-2 text-muted-foreground"
          onClick={() => onSelect({ kind: null, emoji: null, name: null, color: null })}
        >
          <RotateCcw aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Default
        </Button>
      </div>

      {tab === "suggested" ? (
        <div role="tabpanel" className="max-h-[min(25rem,calc(100vh-8rem))] space-y-4 overflow-y-auto p-3">
          {recent.length ? (
            <section className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {recent.map((item) => (
                  <ChoiceButton
                    key={selectionKey(item)}
                    label={item.label}
                    selected={selectionKey(selection) === selectionKey(item)}
                    visual={item.kind === "emoji" ? <span className="text-xl leading-none">{item.emoji}</span> : <LucidePreview name={item.name ?? "shirt"} color={item.color} />}
                    onClick={() => choose(item)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">Suggestions</h3>
              <p className="text-xs text-muted-foreground">
                {itemTypeName ? `Matched to “${itemTypeName}”.` : "Popular choices across different businesses."}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {suggestedEmoji.map((item) => (
                <ChoiceButton
                  key={item.emoji}
                  label={item.label}
                  selected={selection.kind === "emoji" && selection.emoji === item.emoji}
                  visual={<span className="text-xl leading-none">{item.emoji}</span>}
                  onClick={() => choose({ kind: "emoji", emoji: item.emoji, name: null, color: null, label: item.label })}
                />
              ))}
              {suggestedIcons.map((item) => (
                <ChoiceButton
                  key={item.name}
                  label={item.label}
                  selected={selection.kind === "lucide" && selection.name === item.name}
                  visual={<LucidePreview name={item.name} color={iconColor} />}
                  onClick={() => choose({ kind: "lucide", emoji: null, name: item.name, color: iconColor, label: item.label })}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "emoji" ? (
        <div role="tabpanel" className="p-2">
          <EmojiPicker.Root
            columns={6}
            emojibaseUrl="/emoji-data"
            skinTone="none"
            className="flex h-[22rem] flex-col"
            onEmojiSelect={({ emoji, label }) => choose({ kind: "emoji", emoji, name: null, color: null, label })}
          >
            <div className="flex items-center gap-2 border-b p-2">
              <EmojiPicker.Search className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              <EmojiPicker.SkinToneSelector
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Change emoji skin tone"
              />
            </div>
            <EmojiPicker.Viewport className="relative flex-1 overflow-y-auto outline-none">
              <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                Loading emoji...
              </EmojiPicker.Loading>
              <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                No emoji found.
              </EmojiPicker.Empty>
              <EmojiPicker.List
                className="select-none pb-2"
                components={{
                  CategoryHeader: ({ category, ...props }) => (
                    <div className="sticky top-0 z-10 bg-background px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground" {...props}>
                      {category.label}
                    </div>
                  ),
                  Row: ({ children, ...props }) => <div className="flex justify-center px-1" {...props}>{children}</div>,
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-md text-xl hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-accent"
                      title={emoji.label}
                      {...props}
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>
          </EmojiPicker.Root>
        </div>
      ) : null}

      {tab === "icons" ? (
        <div role="tabpanel" className="space-y-3 p-3">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={iconSearch}
              className="h-10 pl-9"
              placeholder="Search icons"
              aria-label="Search icons"
              onChange={(event) => {
                setIconSearch(event.target.value);
                setIconLimit(ICON_RESULT_BATCH_SIZE);
              }}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">Icon color</legend>
            <div className="flex flex-wrap gap-2">
              {itemTypeIconColorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={iconColor === option.value}
                  title={option.label}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    iconColor === option.value && "ring-2 ring-ring ring-offset-2",
                  )}
                  onClick={() => changeIconColor(option.value)}
                >
                  <span className={cn("h-5 w-5 rounded-full", option.swatchClassName)} />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="max-h-[18rem] overflow-y-auto pr-1">
            {visibleIconNames.length ? (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {visibleIconNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "flex h-11 w-11 items-center justify-center justify-self-center rounded-md border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selection.kind === "lucide" && selection.name === name && "border-foreground bg-muted ring-1 ring-ring",
                    )}
                    aria-label={name.replaceAll("-", " ")}
                    aria-pressed={selection.kind === "lucide" && selection.name === name}
                    title={name.replaceAll("-", " ")}
                    onClick={() => choose({ kind: "lucide", emoji: null, name, color: iconColor, label: name.replaceAll("-", " ") })}
                  >
                    <LucidePreview name={name} color={iconColor} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No icons found.</p>
            )}
            {visibleIconNames.length < filteredIconNames.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setIconLimit((value) => value + ICON_RESULT_BATCH_SIZE)}
              >
                Show more ({filteredIconNames.length - visibleIconNames.length} remaining)
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
