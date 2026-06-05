"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CustomerMeasurement,
  ItemType,
  ItemTypeMeasurementField,
  Json,
} from "@/types/database";

type MeasurementFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  customerId: string;
  itemTypes: ItemType[];
  measurement?: CustomerMeasurement;
  measurementFields: ItemTypeMeasurementField[];
};

function getMeasurementEntries(measurementData: Json | undefined) {
  if (
    !measurementData ||
    Array.isArray(measurementData) ||
    typeof measurementData !== "object"
  ) {
    return [];
  }

  return Object.entries(measurementData).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

function buildRows({
  entries,
  itemTypeId,
  measurementFields,
}: {
  entries: [string, string][];
  itemTypeId: string;
  measurementFields: ItemTypeMeasurementField[];
}) {
  const standards = itemTypeId
    ? measurementFields
        .filter((field) => field.item_type_id === itemTypeId)
        .sort((a, b) => a.sort_order - b.sort_order)
    : [];
  const entryByKey = new Map(entries);
  const standardRows = standards.map((field) => ({
    key: field.field_key,
    value: entryByKey.get(field.field_key) ?? "",
    standardId: field.id,
    label: field.field_label,
    unit: field.unit,
    helpText: field.help_text,
    isRequired: field.is_required,
  }));
  const standardKeys = new Set(standards.map((field) => field.field_key));
  const extraRows = entries
    .filter(([key]) => !standardKeys.has(key))
    .map(([key, value]) => ({
      key,
      value,
      standardId: null,
      label: "",
      unit: null,
      helpText: null,
      isRequired: false,
    }));
  const blankRows = Array.from({
    length: Math.max(3, 8 - standardRows.length - extraRows.length),
  }).map(() => ({
    key: "",
    value: "",
    standardId: null,
    label: "",
    unit: null,
    helpText: null,
    isRequired: false,
  }));

  return [...standardRows, ...extraRows, ...blankRows];
}

export function CustomerMeasurementForm({
  action,
  customerId,
  itemTypes,
  measurement,
  measurementFields,
}: MeasurementFormProps) {
  const entries = React.useMemo(
    () => getMeasurementEntries(measurement?.measurement_data_json),
    [measurement],
  );
  const [selectedItemTypeId, setSelectedItemTypeId] = React.useState(
    measurement?.item_type_id ?? "",
  );
  const [rows, setRows] = React.useState(() =>
    buildRows({
      entries,
      itemTypeId: measurement?.item_type_id ?? "",
      measurementFields,
    }),
  );
  const standardCount = rows.filter((row) => row.standardId).length;
  const requiredCount = rows.filter(
    (row) => row.standardId && row.isRequired,
  ).length;

  function handleItemTypeChange(itemTypeId: string) {
    setSelectedItemTypeId(itemTypeId);
    setRows((currentRows) =>
      buildRows({
        entries: currentRows
          .map((row) => [row.key.trim(), row.value.trim()] as [string, string])
          .filter(([key, value]) => key && value),
        itemTypeId,
        measurementFields,
      }),
    );
  }

  return (
    <form action={action} className="space-y-5" data-unsaved-guard="true">
      <input type="hidden" name="customerId" value={customerId} />
      {measurement ? (
        <input type="hidden" name="measurementId" value={measurement.id} />
      ) : null}
      <div className="grid gap-2">
        <Label
          htmlFor={
            measurement ? `referenceName-${measurement.id}` : "referenceName"
          }
        >
          Reference name
        </Label>
        <Input
          id={measurement ? `referenceName-${measurement.id}` : "referenceName"}
          name="referenceName"
          defaultValue={measurement?.reference_name ?? ""}
          placeholder="Wedding blouse, May trial, Shirt latest"
        />
      </div>
      <div className="grid gap-2">
        <Label
          htmlFor={measurement ? `itemTypeId-${measurement.id}` : "itemTypeId"}
        >
          Item type
        </Label>
        <select
          id={measurement ? `itemTypeId-${measurement.id}` : "itemTypeId"}
          name="itemTypeId"
          value={selectedItemTypeId}
          onChange={(event) => handleItemTypeChange(event.target.value)}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">General measurement</option>
          {itemTypes.map((itemType) => (
            <option key={itemType.id} value={itemType.id}>
              {itemType.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label
          htmlFor={measurement ? `notes-${measurement.id}` : "measurementNotes"}
        >
          Notes
        </Label>
        <Input
          id={measurement ? `notes-${measurement.id}` : "measurementNotes"}
          name="notes"
          defaultValue={measurement?.notes ?? ""}
          placeholder="Fit preferences, alteration notes"
        />
      </div>
      <div className="grid gap-2">
        <Label
          htmlFor={measurement ? `photoUrl-${measurement.id}` : "photoUrl"}
        >
          Measurement photo URL
        </Label>
        <Input
          id={measurement ? `photoUrl-${measurement.id}` : "photoUrl"}
          name="photoUrl"
          defaultValue={measurement?.photo_url ?? ""}
          placeholder="Upload flow will connect here later"
        />
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Fields</p>
          <p className="text-xs text-muted-foreground">
            {selectedItemTypeId
              ? standardCount
                ? `${standardCount} tenant standard fields${requiredCount ? `, ${requiredCount} required` : ""}. Extra rows stay available for one-off needs.`
                : "No standards are configured for this item type yet. Add custom fields below."
              : "General measurements use custom fields. Select an item type to use tenant standards."}
          </p>
        </div>
        <div className="space-y-2 rounded-md border p-3">
          {rows.map((row, index) => (
            <div
              key={`${row.standardId ?? "extra"}-${index}`}
              className="grid gap-2 sm:grid-cols-2"
            >
              {row.standardId ? (
                <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 text-sm">
                  <input type="hidden" name="measurementKeys" value={row.key} />
                  <span className="min-w-0 truncate font-medium">
                    {row.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {row.unit ? row.unit : null}
                    {row.isRequired ? (
                      <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-medium text-white">
                        required
                      </span>
                    ) : null}
                  </span>
                </div>
              ) : (
                <Input
                  name="measurementKeys"
                  value={row.key}
                  onChange={(event) =>
                    setRows((currentRows) =>
                      currentRows.map((currentRow, rowIndex) =>
                        rowIndex === index
                          ? { ...currentRow, key: event.target.value }
                          : currentRow,
                      ),
                    )
                  }
                  placeholder={index === 0 ? "Chest" : "Extra field"}
                />
              )}
              <Input
                name="measurementValues"
                value={row.value}
                required={row.isRequired}
                onChange={(event) =>
                  setRows((currentRows) =>
                    currentRows.map((currentRow, rowIndex) =>
                      rowIndex === index
                        ? { ...currentRow, value: event.target.value }
                        : currentRow,
                    ),
                  )
                }
                placeholder={
                  row.unit
                    ? `Value in ${row.unit}`
                    : index === 0
                      ? "40"
                      : "Value"
                }
              />
              {row.helpText ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  {row.helpText}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="isDefault"
          type="checkbox"
          defaultChecked={measurement?.is_default ?? false}
          className="h-4 w-4"
        />
        Mark as default for this item type
      </label>
      <Button type="submit">
        {measurement ? "Save measurement" : "Add measurement"}
      </Button>
    </form>
  );
}
