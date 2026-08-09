"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, LoaderCircle } from "lucide-react";

import { ItemTypeIcon } from "@/components/item-types/item-type-icon";
import { Button } from "@/components/ui/button";
import type { ItemTypeIconSelection } from "@/features/settings/item-type-icon";

const LazyItemTypeIconPickerPanel = dynamic(
  () => import("./item-type-icon-picker-panel").then((module) => module.ItemTypeIconPickerPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground" role="status">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Loading icon library...
      </div>
    ),
  },
);

function selectionLabel(selection: ItemTypeIconSelection) {
  if (selection.kind === "emoji" && selection.emoji) return `${selection.emoji} Emoji`;
  if (selection.kind === "lucide" && selection.name) return selection.name.replaceAll("-", " ");
  return "Default garment icon";
}

export function ItemTypeIconPicker({
  defaultValue,
  id,
  itemTypeNameInputId,
}: {
  defaultValue?: Partial<ItemTypeIconSelection>;
  id: string;
  itemTypeNameInputId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [itemTypeName, setItemTypeName] = React.useState("");
  const [selection, setSelection] = React.useState<ItemTypeIconSelection>({
    kind: defaultValue?.kind ?? (defaultValue?.emoji ? "emoji" : null),
    emoji: defaultValue?.emoji ?? null,
    name: defaultValue?.name ?? null,
    color: defaultValue?.color ?? null,
  });
  const submittedValueRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const input = document.getElementById(itemTypeNameInputId);
    if (!(input instanceof HTMLInputElement)) return;

    const updateName = () => setItemTypeName(input.value);
    updateName();
    input.addEventListener("input", updateName);
    return () => input.removeEventListener("input", updateName);
  }, [itemTypeNameInputId]);

  const chooseSelection = (nextSelection: ItemTypeIconSelection) => {
    setSelection(nextSelection);
    submittedValueRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium leading-none">Item icon</legend>
      <input ref={submittedValueRef} type="hidden" name="iconKind" value={selection.kind ?? ""} />
      <input type="hidden" name="iconEmoji" value={selection.emoji ?? ""} />
      <input type="hidden" name="iconName" value={selection.name ?? ""} />
      <input type="hidden" name="iconColor" value={selection.color ?? ""} />

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-11 w-full justify-between px-3 font-normal"
            aria-label={`Choose item icon. Current selection: ${selectionLabel(selection)}`}
          >
            <span className="flex min-w-0 items-center gap-2 capitalize">
              <ItemTypeIcon
                emoji={selection.emoji}
                kind={selection.kind}
                name={selection.name}
                color={selection.color}
                className="h-5 w-5"
              />
              <span className="truncate">{selectionLabel(selection)}</span>
            </span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className="z-50 w-[min(23rem,calc(100vw-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-lg outline-none"
            aria-label="Choose an item icon"
          >
            {open ? (
              <LazyItemTypeIconPickerPanel
                itemTypeName={itemTypeName}
                selection={selection}
                onSelect={(nextSelection) => {
                  chooseSelection(nextSelection);
                  setOpen(false);
                }}
                onUpdate={chooseSelection}
              />
            ) : null}
            <Popover.Arrow className="fill-background" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <p className="text-xs text-muted-foreground">
        Choose from suggestions, search all emoji, or use a Lucide icon with an accessible color.
      </p>
    </fieldset>
  );
}
