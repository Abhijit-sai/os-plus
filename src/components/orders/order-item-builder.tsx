"use client";

import * as React from "react";
import { Info, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerMeasurement, ItemTypeMeasurementField, ItemTypeStandardSize, Json } from "@/types/database";

type Option = {
  id: string;
  name: string;
  icon_emoji?: string | null;
  description?: string | null;
  item_type_id?: string | null;
};

type MeasurementOption = Pick<
  CustomerMeasurement,
  "id" | "customer_id" | "item_type_id" | "reference_name" | "measurement_data_json" | "notes" | "is_default" | "updated_at"
>;

type MeasurementFieldStandard = Pick<
  ItemTypeMeasurementField,
  "id" | "item_type_id" | "field_key" | "field_label" | "unit" | "sort_order" | "is_required" | "help_text"
>;

type StandardSizeOption = Pick<
  ItemTypeStandardSize,
  "id" | "item_type_id" | "size_label" | "measurement_data_json" | "sort_order" | "is_active" | "updated_at"
>;

const deliveryOptions = [
  { value: "store_pickup", label: "Store pickup" },
  { value: "self_delivery", label: "Self delivery" },
  { value: "courier", label: "Courier" }
];

function createRowId() {
  return `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getMeasurementEntries(measurementData: Json) {
  if (!measurementData || Array.isArray(measurementData) || typeof measurementData !== "object") {
    return [];
  }

  return Object.entries(measurementData).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

function buildMeasurementLabel({
  itemTypeName,
  measurement,
  updatedAt
}: {
  itemTypeName?: string | null;
  measurement: Pick<MeasurementOption, "reference_name" | "is_default">;
  updatedAt?: string | null;
}) {
  const baseLabel = measurement.reference_name?.trim() || itemTypeName || "Measurement";
  const parts = [baseLabel];

  if (measurement.is_default) {
    parts.push("default");
  }

  if (itemTypeName && baseLabel !== itemTypeName) {
    parts.push(itemTypeName);
  }

  if (updatedAt) {
    parts.push(`updated ${formatDateTime(updatedAt)}`);
  }

  return parts.join(" · ");
}

function buildStandardSizeLabel(size: Pick<StandardSizeOption, "size_label" | "updated_at">) {
  return `${size.size_label} · standard size · updated ${formatDateTime(size.updated_at)}`;
}

function formatMeasurementEntries({
  entries,
  standards
}: {
  entries: [string, string][];
  standards: MeasurementFieldStandard[];
}) {
  const standardByKey = new Map(standards.map((field) => [field.field_key, field]));
  const standardKeyOrder = new Map(standards.map((field, index) => [field.field_key, index]));

  return [...entries]
    .sort(([firstKey], [secondKey]) => {
      const firstIndex = standardKeyOrder.get(firstKey) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = standardKeyOrder.get(secondKey) ?? Number.MAX_SAFE_INTEGER;

      if (firstIndex !== secondIndex) {
        return firstIndex - secondIndex;
      }

      return firstKey.localeCompare(secondKey);
    })
    .map(([key, value]) => {
      const standard = standardByKey.get(key);

      return {
        key,
        label: standard?.field_label ?? key,
        unit: standard?.unit ?? null,
        value
      };
    });
}

function formatDateTime(date: string | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(date));
}

function QuickAddMeasurementDialog({
  customerId,
  itemTypeId,
  itemTypeName,
  standards,
  onCreated
}: {
  customerId: string;
  itemTypeId: string;
  itemTypeName: string;
  standards: MeasurementFieldStandard[];
  onCreated: (measurement: MeasurementOption) => void;
}) {
  const [referenceName, setReferenceName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [rows, setRows] = React.useState(() => {
    const standardRows = standards.map((field) => ({ key: field.field_key, value: "", standard: field }));
    const extraRows = Array.from({ length: Math.max(3, 6 - standardRows.length) }).map(() => ({ key: "", value: "", standard: null }));
    return [...standardRows, ...extraRows];
  });
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  async function save(close: () => void) {
    setError(null);
    const measurementData = rows.reduce<Record<string, string>>((accumulator, row) => {
      const key = row.key.trim();
      const value = row.value.trim();

      if (key && value) {
        accumulator[key] = value;
      }

      return accumulator;
    }, {});

    if (!Object.keys(measurementData).length) {
      setError("Add at least one measurement field.");
      return;
    }

    const missingRequiredField = rows.find((row) => row.standard?.is_required && !row.value.trim());

    if (missingRequiredField?.standard) {
      setError(`Add ${missingRequiredField.standard.field_label} before saving this ${itemTypeName} measurement.`);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/customer-measurements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerId,
          itemTypeId,
          referenceName: referenceName.trim() || null,
          notes: notes.trim() || null,
          isDefault,
          measurementData
        })
      });
      const payload = (await response.json()) as { measurement?: MeasurementOption; error?: string };

      if (!response.ok || !payload.measurement) {
        throw new Error(payload.error ?? "Unable to add measurement.");
      }

      onCreated(payload.measurement);
      setReferenceName("");
      setNotes("");
      setIsDefault(false);
      setRows([
        ...standards.map((field) => ({ key: field.field_key, value: "", standard: field })),
        ...Array.from({ length: Math.max(3, 6 - standards.length) }).map(() => ({ key: "", value: "", standard: null }))
      ]);
      close();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to add measurement.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      title="Add measurement"
      description={`Save a ${itemTypeName} measurement and link it to this item.`}
      trigger={
        <span className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
          Add measurement
        </span>
      }
      className="max-w-2xl"
    >
      {({ close }) => (
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor={`quick-reference-${itemTypeId}`}>Reference name</Label>
            <Input
              id={`quick-reference-${itemTypeId}`}
              value={referenceName}
              onChange={(event) => setReferenceName(event.target.value)}
              placeholder="Wedding blouse, May trial, latest"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`quick-notes-${itemTypeId}`}>Notes</Label>
            <Input
              id={`quick-notes-${itemTypeId}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Fit notes or alteration context"
            />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Fields</p>
              <p className="text-xs text-muted-foreground">
                {standards.length
                  ? `${standards.length} tenant standard fields${standards.some((field) => field.is_required) ? ", required fields marked" : ""}.`
                  : `No ${itemTypeName} standards yet. Add the fields needed for this measurement.`}
              </p>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              {rows.map((row, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-2">
                  {row.standard ? (
                    <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{row.standard.field_label}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {row.standard.unit ? row.standard.unit : null}
                        {row.standard.is_required ? (
                          <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-medium text-white">
                            required
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : (
                    <Input
                      value={row.key}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((currentRow, rowIndex) =>
                            rowIndex === index ? { ...currentRow, key: event.target.value } : currentRow
                          )
                        )
                      }
                      placeholder={index === 0 ? "Chest" : "Extra field"}
                    />
                  )}
                  <Input
                    value={row.value}
                    required={row.standard?.is_required ?? false}
                    onChange={(event) =>
                      setRows((current) =>
                        current.map((currentRow, rowIndex) =>
                          rowIndex === index ? { ...currentRow, value: event.target.value } : currentRow
                        )
                      )
                    }
                    placeholder={row.standard?.unit ? `Value in ${row.standard.unit}` : index === 0 ? "40" : "Value"}
                  />
                  {row.standard?.help_text ? (
                    <p className="text-xs text-muted-foreground sm:col-span-2">{row.standard.help_text}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} className="h-4 w-4" />
            Mark as default for {itemTypeName}
          </label>
          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => save(close)} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save and select"}
            </Button>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function OrderItemBuilder({
  itemTypes,
  workflows,
  measurements,
  measurementFields,
  standardSizes,
  selectedCustomerId
}: {
  itemTypes: Option[];
  workflows: Option[];
  measurements: MeasurementOption[];
  measurementFields: MeasurementFieldStandard[];
  standardSizes: StandardSizeOption[];
  selectedCustomerId?: string;
}) {
  const [rowIds, setRowIds] = React.useState(["row_1"]);
  const [availableMeasurementRecords, setAvailableMeasurementRecords] = React.useState(measurements);
  const [activeCustomerId, setActiveCustomerId] = React.useState(selectedCustomerId ?? "");
  const [itemTypeByRowId, setItemTypeByRowId] = React.useState<Record<string, string>>({});
  const [fitReferenceByRowId, setFitReferenceByRowId] = React.useState<Record<string, string>>({});
  const itemTypeById = React.useMemo(() => new Map(itemTypes.map((itemType) => [itemType.id, itemType])), [itemTypes]);

  React.useEffect(() => {
    function handleCustomerSelection(event: Event) {
      const customerId = (event as CustomEvent<{ customerId: string | null }>).detail?.customerId ?? "";
      setActiveCustomerId(customerId);
      setFitReferenceByRowId((current) =>
        Object.fromEntries(Object.entries(current).filter(([, value]) => !value.startsWith("customer:")))
      );
    }

    window.addEventListener("osplus:customer-selected", handleCustomerSelection);
    return () => window.removeEventListener("osplus:customer-selected", handleCustomerSelection);
  }, []);

  function addRow() {
    setRowIds((current) => [...current, createRowId()]);
  }

  function removeRow(rowId: string) {
    setRowIds((current) => (current.length === 1 ? current : current.filter((id) => id !== rowId)));
    setItemTypeByRowId((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    setFitReferenceByRowId((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="hidden grid-cols-[1.1fr_1fr_1fr_80px_110px_110px_150px_150px_120px_44px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium uppercase text-muted-foreground lg:grid">
          <span>Item</span>
          <span>Type</span>
          <span className="flex items-center gap-1">
            Workflow
            <Dialog
              title="Choosing a workflow"
              description="Pick the production path that should be created for this item. You can change or correct workflow details later."
              trigger={
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted">
                  <Info className="h-3.5 w-3.5" />
                </span>
              }
            >
              <div className="space-y-3">
                {workflows.map((workflow) => (
                  <div key={workflow.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{workflow.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{workflow.description || "No summary added yet."}</p>
                  </div>
                ))}
              </div>
            </Dialog>
          </span>
          <span>Qty</span>
          <span>Unit price</span>
          <span>Discount</span>
          <span>Expected</span>
          <span>Delivery</span>
          <span>Color</span>
          <span className="sr-only">Delete</span>
        </div>
        <div className="divide-y">
          {rowIds.map((rowId, index) => {
            const selectedItemTypeId = itemTypeByRowId[rowId] ?? "";
            const availableWorkflows = workflows.filter(
              (workflow) =>
                !workflow.item_type_id ||
                !selectedItemTypeId ||
                workflow.item_type_id === selectedItemTypeId,
            );
            const availableStandardSizes = selectedItemTypeId
              ? standardSizes.filter((size) => size.item_type_id === selectedItemTypeId)
              : [];
            const availableMeasurements = availableMeasurementRecords.filter(
              (measurement) =>
                measurement.customer_id === activeCustomerId &&
                (!selectedItemTypeId || !measurement.item_type_id || measurement.item_type_id === selectedItemTypeId)
            );
            const selectedFitReference = fitReferenceByRowId[rowId] ?? "";
            const selectedMeasurementId = selectedFitReference.startsWith("customer:") ? selectedFitReference.replace("customer:", "") : "";
            const selectedStandardSizeId = selectedFitReference.startsWith("standard:") ? selectedFitReference.replace("standard:", "") : "";
            const selectedMeasurement = availableMeasurements.find((measurement) => measurement.id === selectedMeasurementId) ?? null;
            const selectedStandardSize = availableStandardSizes.find((size) => size.id === selectedStandardSizeId) ?? null;
            const selectedMeasurementEntries = selectedMeasurement ? getMeasurementEntries(selectedMeasurement.measurement_data_json) : [];
            const selectedStandardSizeEntries = selectedStandardSize ? getMeasurementEntries(selectedStandardSize.measurement_data_json) : [];
            const standardsForItemType = selectedItemTypeId
              ? measurementFields.filter((field) => field.item_type_id === selectedItemTypeId).sort((a, b) => a.sort_order - b.sort_order)
              : [];
            const selectedMeasurementStandards = selectedMeasurement?.item_type_id
              ? measurementFields
                  .filter((field) => field.item_type_id === selectedMeasurement.item_type_id)
                  .sort((a, b) => a.sort_order - b.sort_order)
              : [];
            const selectedMeasurementDisplayEntries = formatMeasurementEntries({
              entries: selectedMeasurementEntries,
              standards: selectedMeasurementStandards
            });
            const selectedStandardSizeDisplayEntries = formatMeasurementEntries({
              entries: selectedStandardSizeEntries,
              standards: standardsForItemType
            });

            return (
              <div key={rowId} className="space-y-3 p-3">
                <input type="hidden" name="itemRowId" value={rowId} />
                <div className="flex items-center justify-between gap-3 lg:hidden">
                  <p className="text-sm font-medium">Item {index + 1}</p>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(rowId)} disabled={rowIds.length === 1} aria-label="Delete item row">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_80px_110px_110px_150px_150px_120px_44px] lg:gap-2">
                <div className="grid gap-1">
                  <Label htmlFor={`itemName_${rowId}`} className="text-xs text-muted-foreground lg:sr-only">
                    Item
                  </Label>
                  <Input id={`itemName_${rowId}`} name={`itemName_${rowId}`} placeholder="Enter item description" required={index === 0} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`itemTypeId_${rowId}`} className="text-xs text-muted-foreground lg:sr-only">
                    Type
                  </Label>
                  <select
                    id={`itemTypeId_${rowId}`}
                    name={`itemTypeId_${rowId}`}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    required={index === 0}
                    onChange={(event) => {
                      setItemTypeByRowId((current) => ({ ...current, [rowId]: event.target.value }));
                      setFitReferenceByRowId((current) => ({ ...current, [rowId]: "" }));
                    }}
                  >
                    <option value="">Select type</option>
                    {itemTypes.map((itemType) => (
                      <option key={itemType.id} value={itemType.id}>
                        {itemType.icon_emoji ?? "👕"} {itemType.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor={`workflowId_${rowId}`} className="flex items-center gap-1 text-xs text-muted-foreground lg:sr-only">
                    Workflow
                    <Dialog
                      title="Choosing a workflow"
                      description="Pick the production path that should be created for this item. You can change or correct workflow details later."
                      trigger={
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted">
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      }
                    >
                      <div className="space-y-3">
                        {availableWorkflows.map((workflow) => (
                          <div key={workflow.id} className="rounded-md border p-3">
                            <p className="text-sm font-medium">{workflow.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{workflow.description || "No summary added yet."}</p>
                          </div>
                        ))}
                      </div>
                    </Dialog>
                  </Label>
                  <select id={`workflowId_${rowId}`} name={`workflowId_${rowId}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required={index === 0}>
                    <option value="">Select workflow</option>
                    {availableWorkflows.map((workflow) => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground lg:sr-only">Qty</Label>
                  <Input name={`itemQuantity_${rowId}`} type="number" min="1" defaultValue="1" aria-label="Quantity" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground lg:sr-only">Unit price</Label>
                  <Input name={`itemUnitPrice_${rowId}`} type="number" min="0" step="0.01" defaultValue="0" aria-label="Unit price" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground lg:sr-only">Discount</Label>
                  <Input name={`itemDiscountAmount_${rowId}`} type="number" min="0" step="0.01" defaultValue="0" aria-label="Discount" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground lg:sr-only">Expected</Label>
                  <Input name={`expectedCompletionDate_${rowId}`} type="date" aria-label="Expected completion" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground lg:sr-only">Delivery</Label>
                  <select name={`deliveryTypeOverride_${rowId}`} className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Delivery override">
                    <option value="">Use order delivery</option>
                    {deliveryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground lg:sr-only">Color</Label>
                  <Input name={`itemColor_${rowId}`} placeholder="Optional" aria-label="Color" />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(rowId)} disabled={rowIds.length === 1} aria-label="Delete item row" className="hidden lg:inline-flex">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input name={`itemDescription_${rowId}`} placeholder="Description or styling details" />
                <Input name={`itemNotes_${rowId}`} placeholder="Internal item notes" />
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-start">
                  <div>
                    <Label htmlFor={`fitReference_${rowId}`}>Fit reference</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Standard sizes come from the item type. Customer measurements appear after customer selection.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        id={`fitReference_${rowId}`}
                        name={`fitReference_${rowId}`}
                        className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                        disabled={!selectedItemTypeId || (!availableStandardSizes.length && !availableMeasurements.length)}
                        value={selectedFitReference}
                        onChange={(event) => setFitReferenceByRowId((current) => ({ ...current, [rowId]: event.target.value }))}
                      >
                        <option value="">
                          {!selectedItemTypeId
                            ? "Select item type first"
                            : availableStandardSizes.length || availableMeasurements.length
                              ? "No fit reference linked"
                              : "No standard size or customer measurement"}
                        </option>
                        {availableStandardSizes.length ? (
                          <optgroup label="Standard sizes">
                            {availableStandardSizes.map((size) => (
                              <option key={size.id} value={`standard:${size.id}`}>
                                {buildStandardSizeLabel(size)}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {availableMeasurements.length ? (
                          <optgroup label="Customer measurements">
                            {availableMeasurements.map((measurement) => {
                              const itemType = measurement.item_type_id ? itemTypeById.get(measurement.item_type_id)?.name : "General";

                              return (
                                <option key={measurement.id} value={`customer:${measurement.id}`}>
                                  {buildMeasurementLabel({
                                    itemTypeName: itemType,
                                    measurement,
                                    updatedAt: measurement.updated_at
                                  })}
                                </option>
                              );
                            })}
                          </optgroup>
                        ) : null}
                      </select>
                      {activeCustomerId && selectedItemTypeId ? (
                        <QuickAddMeasurementDialog
                          key={`${rowId}-${selectedItemTypeId}`}
                          customerId={activeCustomerId}
                          itemTypeId={selectedItemTypeId}
                          itemTypeName={itemTypeById.get(selectedItemTypeId)?.name ?? "item"}
                          standards={standardsForItemType}
                          onCreated={(measurement) => {
                            setAvailableMeasurementRecords((current) => [measurement, ...current]);
                            setFitReferenceByRowId((current) => ({ ...current, [rowId]: `customer:${measurement.id}` }));
                          }}
                        />
                      ) : null}
                    </div>
                    {selectedStandardSize ? (
                      <div className="rounded-md border bg-background p-3 text-sm">
                        <div>
                          <p className="font-medium">{selectedStandardSize.size_label}</p>
                          <p className="text-xs text-muted-foreground">
                            Standard {itemTypeById.get(selectedStandardSize.item_type_id)?.name ?? "item"} size · Updated{" "}
                            {formatDateTime(selectedStandardSize.updated_at)}
                          </p>
                        </div>
                        {selectedStandardSizeDisplayEntries.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {selectedStandardSizeDisplayEntries.slice(0, 6).map(({ key, label, unit, value }) => (
                              <div key={key} className="rounded-md bg-muted px-2 py-1 text-xs">
                                <span className="font-medium">{label}</span>
                                <span className="text-muted-foreground">
                                  : {value}
                                  {unit ? ` ${unit}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedMeasurement ? (
                      <div className="rounded-md border bg-background p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {buildMeasurementLabel({
                                itemTypeName: selectedMeasurement.item_type_id
                                  ? itemTypeById.get(selectedMeasurement.item_type_id)?.name
                                  : "General measurement",
                                measurement: selectedMeasurement
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">Updated {formatDateTime(selectedMeasurement.updated_at)}</p>
                          </div>
                          {selectedMeasurement.is_default ? <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">default</span> : null}
                        </div>
                        {selectedMeasurementEntries.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {selectedMeasurementDisplayEntries.slice(0, 6).map(({ key, label, unit, value }) => (
                              <div key={key} className="rounded-md bg-muted px-2 py-1 text-xs">
                                <span className="font-medium">{label}</span>
                                <span className="text-muted-foreground">
                                  : {value}
                                  {unit ? ` ${unit}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {selectedMeasurement.notes ? <p className="mt-2 text-xs text-muted-foreground">{selectedMeasurement.notes}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <Button type="button" variant="outline" onClick={addRow} className="gap-2">
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </div>
  );
}
