"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Columns3, GitBranch, List, Search } from "lucide-react";

import { ItemTypeIcon } from "@/components/item-types/item-type-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkflowOption = {
  id: string;
  name: string;
};

type ItemTypeOption = {
  id: string;
  name: string;
  icon_emoji: string | null;
};

type ProductionFilterBarProps = {
  allItemTypesHref: string;
  activeView: "list" | "board";
  allWorkflowsHref: string;
  boardHref: string;
  clearSearchHref: string;
  listHref: string;
  queueFilter: string;
  resetHref: string;
  itemTypes: ItemTypeOption[];
  search: string;
  selectedItemTypeIds: string[];
  selectedItemTypeLabel: string;
  selectedWorkflowIds: string[];
  selectedWorkflowLabel: string;
  workflows: WorkflowOption[];
};

export function ProductionFilterBar({
  activeView,
  allItemTypesHref,
  allWorkflowsHref,
  boardHref,
  clearSearchHref,
  listHref,
  queueFilter,
  resetHref,
  itemTypes,
  selectedItemTypeIds,
  selectedItemTypeLabel,
  search,
  selectedWorkflowIds,
  selectedWorkflowLabel,
  workflows
}: ProductionFilterBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [itemTypeOpen, setItemTypeOpen] = useState(false);
  const workflowRef = useRef<HTMLDivElement>(null);
  const itemTypeRef = useRef<HTMLDivElement>(null);
  const workflowTriggerRef = useRef<HTMLButtonElement>(null);
  const itemTypeTriggerRef = useRef<HTMLButtonElement>(null);
  const workflowPopupId = useId();
  const itemTypePopupId = useId();
  const selectedWorkflowSet = new Set(selectedWorkflowIds);
  const selectedItemTypeSet = new Set(selectedItemTypeIds);
  const hasActiveFilters = Boolean(search) || queueFilter !== "active" || selectedWorkflowIds.length > 0 || selectedItemTypeIds.length > 0;

  useEffect(() => {
    if (!workflowOpen && !itemTypeOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!workflowRef.current?.contains(event.target as Node)) {
        setWorkflowOpen(false);
      }
      if (!itemTypeRef.current?.contains(event.target as Node)) {
        setItemTypeOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (workflowOpen) {
          workflowTriggerRef.current?.focus();
        } else if (itemTypeOpen) {
          itemTypeTriggerRef.current?.focus();
        }
        setWorkflowOpen(false);
        setItemTypeOpen(false);
      }
    };


    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [workflowOpen, itemTypeOpen]);

  return (
    <div className="rounded-[14px] border bg-card p-2 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={activeView === "list" ? "default" : "outline"}>
            <Link href={listHref} className="gap-2">
              <List className="h-4 w-4" />
              List
            </Link>
          </Button>
          <Button asChild size="sm" variant={activeView === "board" ? "default" : "outline"}>
            <Link href={boardHref} className="gap-2">
              <Columns3 className="h-4 w-4" />
              Board
            </Link>
          </Button>
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          {searchOpen ? (
            <form className="flex min-w-[220px] flex-1 items-center justify-end gap-2 sm:max-w-[460px]">
              <Label htmlFor="q" className="sr-only">
                Search production
              </Label>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={search}
                  placeholder="Search item, order, customer, stage"
                  className="h-9 pl-9"
                  autoFocus
                />
              </div>
              <input type="hidden" name="queue" value={queueFilter} />
              {activeView === "board" ? <input type="hidden" name="view" value="board" /> : null}
              {selectedWorkflowIds.map((workflowId) => (
                <input key={workflowId} type="hidden" name="workflowId" value={workflowId} />
              ))}
              {selectedItemTypeIds.map((itemTypeId) => (
                <input key={itemTypeId} type="hidden" name="itemTypeId" value={itemTypeId} />
              ))}
              <Button type="submit" size="sm">
                Apply
              </Button>
              {search ? (
                <Button asChild type="button" size="sm" variant="ghost">
                  <Link href={clearSearchHref}>Clear</Link>
                </Button>
              ) : null}
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={search ? "default" : "outline"}
              className="gap-2"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
              {search ? <span className="max-w-[180px] truncate">{search}</span> : <span className="sr-only">Search</span>}
            </Button>
          )}

          <div ref={workflowRef} className="relative">
            <Button ref={workflowTriggerRef} type="button" size="sm" variant="outline" className="gap-2" aria-expanded={workflowOpen} aria-controls={workflowPopupId} aria-haspopup="dialog" onClick={() => setWorkflowOpen((open) => !open)}>
              <GitBranch className="h-4 w-4" />
              <span className="max-w-[180px] truncate">{selectedWorkflowLabel}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${workflowOpen ? "rotate-180" : ""}`} />
            </Button>
            {workflowOpen ? (
              <form id={workflowPopupId} role="dialog" aria-label="Filter by workflow" className="absolute right-0 z-20 mt-2 w-72 rounded-[12px] border bg-background p-3 shadow-xl">
                {activeView === "board" ? <input type="hidden" name="view" value="board" /> : null}
                {search ? <input type="hidden" name="q" value={search} /> : null}
                {queueFilter !== "active" ? <input type="hidden" name="queue" value={queueFilter} /> : null}
                {selectedItemTypeIds.map((itemTypeId) => (
                  <input key={itemTypeId} type="hidden" name="itemTypeId" value={itemTypeId} />
                ))}
                <div className="space-y-2">
                  {workflows.map((workflow) => (
                    <label key={workflow.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        name="workflowId"
                        value={workflow.id}
                        defaultChecked={selectedWorkflowSet.has(workflow.id)}
                        className="h-4 w-4 accent-black"
                      />
                      <span className="truncate">{workflow.name}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <Button asChild size="sm" variant={selectedWorkflowIds.length ? "ghost" : "default"}>
                    <Link href={allWorkflowsHref}>All</Link>
                  </Button>
                  <Button type="submit" size="sm">
                    Apply
                  </Button>
                </div>
              </form>
            ) : null}
          </div>

          <div ref={itemTypeRef} className="relative">
            <Button ref={itemTypeTriggerRef} type="button" size="sm" variant="outline" className="gap-2" aria-expanded={itemTypeOpen} aria-controls={itemTypePopupId} aria-haspopup="dialog" onClick={() => setItemTypeOpen((open) => !open)}>
              <ItemTypeIcon emoji={null} />
              <span className="max-w-[180px] truncate">{selectedItemTypeLabel}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${itemTypeOpen ? "rotate-180" : ""}`} />
            </Button>
            {itemTypeOpen ? (
              <form id={itemTypePopupId} role="dialog" aria-label="Filter by garment type" className="absolute right-0 z-20 mt-2 w-72 rounded-[12px] border bg-background p-3 shadow-xl">
                {activeView === "board" ? <input type="hidden" name="view" value="board" /> : null}
                {search ? <input type="hidden" name="q" value={search} /> : null}
                {queueFilter !== "active" ? <input type="hidden" name="queue" value={queueFilter} /> : null}
                {selectedWorkflowIds.map((workflowId) => (
                  <input key={workflowId} type="hidden" name="workflowId" value={workflowId} />
                ))}
                <div className="space-y-2">
                  {itemTypes.map((itemType) => (
                    <label key={itemType.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        name="itemTypeId"
                        value={itemType.id}
                        defaultChecked={selectedItemTypeSet.has(itemType.id)}
                        className="h-4 w-4 accent-black"
                      />
                      <ItemTypeIcon emoji={itemType.icon_emoji} />
                      <span className="truncate">{itemType.name}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <Button asChild size="sm" variant={selectedItemTypeIds.length ? "ghost" : "default"}>
                    <Link href={allItemTypesHref}>All</Link>
                  </Button>
                  <Button type="submit" size="sm">Apply</Button>
                </div>
              </form>
            ) : null}
          </div>

          {hasActiveFilters ? (
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href={resetHref}>Reset</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
