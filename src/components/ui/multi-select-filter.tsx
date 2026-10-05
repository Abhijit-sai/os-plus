"use client";

import { useId, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Inputs stay in the form, even when the popup is closed or portalled. */
export function MultiSelectFilter({ label, name, options, selected }: {
  label: string;
  name: string;
  options: { id: string; name: string }[];
  selected: string[];
}) {
  const id = useId();
  const [values, setValues] = useState(selected.length ? selected.filter((value) => value !== "__none__") : options.map((option) => option.id));
  const [query, setQuery] = useState("");
  const [unfiltered, setUnfiltered] = useState(!selected.length);
  const [open, setOpen] = useState(false);
  const visibleOptions = options.filter((option) => option.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const allSelected = unfiltered || (options.length > 0 && values.length === options.length && options.every((option) => values.includes(option.id)));
  // All is unfiltered, including historical logs with an unassigned workgroup.
  const submittedValues = allSelected ? [""] : values.length ? values : ["__none__"];
  const summary = allSelected ? "All" : values.length === 1 ? options.find((option) => option.id === values[0])?.name ?? "Unavailable" : `${values.length} selected`;

  return <div className="min-w-0 space-y-1">
    <span id={`${id}-label`} className="text-xs font-medium text-muted-foreground">{label}</span>
    {submittedValues.map((value) => <input key={value} type="hidden" name={name} value={value} />)}
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between gap-2 font-normal" aria-labelledby={`${id}-label ${id}-value`}>
          <span id={`${id}-value`} className="truncate">{summary}</span><ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-background p-2 shadow-lg" aria-label={label}>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></div>
          <div className="flex items-center justify-between border-b py-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setUnfiltered(true); setValues(options.map((option) => option.id)); }}>Select all</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setUnfiltered(false); setValues([]); }}>Clear</Button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {visibleOptions.map((option) => <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-accent">
              <input type="checkbox" className="h-4 w-4 shrink-0 accent-primary" checked={values.includes(option.id)} onChange={(event) => { setUnfiltered(false); setValues((current) => event.target.checked ? [...current, option.id] : current.filter((value) => value !== option.id)); }} />
              <span className="break-words">{option.name}</span>
            </label>)}
            {!visibleOptions.length ? <p className="p-3 text-sm text-muted-foreground">No matches.</p> : null}
          </div>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(false)}>Done · {values.length} selected</Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </div>;
}
