"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemType, ItemTypeMeasurementField, ItemTypeStandardSize, Json } from "@/types/database";

type StandardSizeFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  itemTypes: ItemType[];
  fields: ItemTypeMeasurementField[];
  initialItemTypeId?: string;
  standardSize?: ItemTypeStandardSize;
};

function getMeasurementRecord(measurementData: Json | undefined) {
  if (!measurementData || Array.isArray(measurementData) || typeof measurementData !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(measurementData).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

export function StandardSizeForm({ action, fields, initialItemTypeId, itemTypes, standardSize }: StandardSizeFormProps) {
  const [selectedItemTypeId, setSelectedItemTypeId] = React.useState(standardSize?.item_type_id ?? initialItemTypeId ?? "");
  const valuesByKey = React.useMemo(
    () => getMeasurementRecord(standardSize?.measurement_data_json),
    [standardSize]
  );
  const fieldsForItemType = React.useMemo(
    () =>
      fields
        .filter((field) => field.item_type_id === selectedItemTypeId && field.is_active)
        .sort((a, b) => a.sort_order - b.sort_order),
    [fields, selectedItemTypeId]
  );

  return (
    <form action={action} className="space-y-4" data-unsaved-guard="true">
      {standardSize ? <input type="hidden" name="standardSizeId" value={standardSize.id} /> : null}
      {standardSize ? <input type="hidden" name="itemTypeId" value={standardSize.item_type_id} /> : null}
      <div className="grid gap-2">
        <Label htmlFor={standardSize ? `size-item-type-${standardSize.id}` : "size-item-type"}>Item type</Label>
        <select
          id={standardSize ? `size-item-type-${standardSize.id}` : "size-item-type"}
          name={standardSize ? undefined : "itemTypeId"}
          value={selectedItemTypeId}
          onChange={(event) => setSelectedItemTypeId(event.target.value)}
          disabled={Boolean(standardSize)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          required
        >
          <option value="">Select item type</option>
          {itemTypes.map((itemType) => (
            <option key={itemType.id} value={itemType.id}>
              {itemType.name}
            </option>
          ))}
        </select>
        {standardSize ? <p className="text-xs text-muted-foreground">Item type is fixed to preserve size and order history. Create a new size for another item type.</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div className="grid gap-2">
          <Label htmlFor={standardSize ? `size-label-${standardSize.id}` : "size-label"}>Size name</Label>
          <Input
            id={standardSize ? `size-label-${standardSize.id}` : "size-label"}
            name="sizeLabel"
            defaultValue={standardSize?.size_label ?? ""}
            placeholder="XS, S, M, L, 38"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={standardSize ? `size-sort-${standardSize.id}` : "size-sort"}>Sort order</Label>
          <Input
            id={standardSize ? `size-sort-${standardSize.id}` : "size-sort"}
            name="sortOrder"
            type="number"
            min="0"
            defaultValue={standardSize?.sort_order ?? 0}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">Dimensions</p>
          <p className="text-xs text-muted-foreground">
            {selectedItemTypeId
              ? fieldsForItemType.length
                ? "Fill the values that define this size for the selected item type."
                : "Add measurement fields for this item type before creating size templates."
              : "Select an item type to load its dimension fields."}
          </p>
        </div>
        {fieldsForItemType.length ? (
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
              <span>Dimension</span>
              <span>Value</span>
            </div>
            <div className="divide-y">
              {fieldsForItemType.map((field) => (
                <div key={field.id} className="grid grid-cols-[minmax(0,1fr)_160px] gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <input type="hidden" name="measurementKeys" value={field.field_key} />
                    <span className="truncate text-sm font-medium">{field.field_label}</span>
                    {field.unit ? <span className="shrink-0 text-xs text-muted-foreground">{field.unit}</span> : null}
                  </div>
                  <Input
                    name="measurementValues"
                    defaultValue={valuesByKey[field.field_key] ?? ""}
                    placeholder={field.unit ? `In ${field.unit}` : "Value"}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {selectedItemTypeId ? "No active dimensions configured for this item type." : "No item type selected."}
          </p>
        )}
      </div>
      {standardSize ? (
        <label className="flex items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={standardSize.is_active} className="h-4 w-4" />
          Active
        </label>
      ) : null}
      <Button type="submit" disabled={!fieldsForItemType.length}>
        {standardSize ? "Save size" : "Add size"}
      </Button>
    </form>
  );
}
