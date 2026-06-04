"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Columns3, GitBranch, List, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkflowOption = {
  id: string;
  name: string;
};

type ProductionFilterBarProps = {
  activeView: "list" | "board";
  allWorkflowsHref: string;
  boardHref: string;
  clearSearchHref: string;
  listHref: string;
  queueFilter: string;
  resetHref: string;
  search: string;
  selectedWorkflowIds: string[];
  selectedWorkflowLabel: string;
  workflows: WorkflowOption[];
};

export function ProductionFilterBar({
  activeView,
  allWorkflowsHref,
  boardHref,
  clearSearchHref,
  listHref,
  queueFilter,
  resetHref,
  search,
  selectedWorkflowIds,
  selectedWorkflowLabel,
  workflows
}: ProductionFilterBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const workflowRef = useRef<HTMLDivElement>(null);
  const selectedWorkflowSet = new Set(selectedWorkflowIds);
  const hasActiveFilters = Boolean(search) || queueFilter !== "active" || selectedWorkflowIds.length > 0;

  useEffect(() => {
    if (!workflowOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!workflowRef.current?.contains(event.target as Node)) {
        setWorkflowOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [workflowOpen]);

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
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => setWorkflowOpen((open) => !open)}>
              <GitBranch className="h-4 w-4" />
              <span className="max-w-[180px] truncate">{selectedWorkflowLabel}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${workflowOpen ? "rotate-180" : ""}`} />
            </Button>
            {workflowOpen ? (
              <form className="absolute right-0 z-20 mt-2 w-72 rounded-[12px] border bg-background p-3 shadow-xl">
                {activeView === "board" ? <input type="hidden" name="view" value="board" /> : null}
                {search ? <input type="hidden" name="q" value={search} /> : null}
                {queueFilter !== "active" ? <input type="hidden" name="queue" value={queueFilter} /> : null}
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
