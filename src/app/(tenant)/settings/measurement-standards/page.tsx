import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

import {
  archiveMeasurementFieldAction,
  archiveStandardSizeAction,
  createMeasurementFieldAction,
  createStandardSizeAction,
  updateStandardSizeAction,
  updateMeasurementFieldAction
} from "@/features/settings/actions";
import { getMeasurementStandardsSettings } from "@/features/settings/queries";
import { PageHeader } from "@/components/layout/page-header";
import { StandardSizeForm } from "@/components/settings/standard-size-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { AutoCloseActionDialog } from "@/components/ui/auto-close-action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemType, ItemTypeMeasurementField, ItemTypeStandardSize, Json } from "@/types/database";

function ActionTrigger({
  children,
  variant = "default"
}: {
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <span
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium shadow-sm transition-colors ${
        variant === "outline"
          ? "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90"
      }`}
    >
      {children}
    </span>
  );
}

function FieldForm({
  itemTypes,
  field,
  bare = false
}: {
  itemTypes: ItemType[];
  field?: ItemTypeMeasurementField;
  bare?: boolean;
}) {
  const action = field ? updateMeasurementFieldAction : createMeasurementFieldAction;

  const fields = (
    <>
      {field ? <input type="hidden" name="fieldId" value={field.id} /> : null}
      <div className="grid gap-2">
        <Label htmlFor={field ? `itemTypeId-${field.id}` : "itemTypeId"}>Item type</Label>
        {field ? <input type="hidden" name="itemTypeId" value={field.item_type_id} /> : null}
        <select
          id={field ? `itemTypeId-${field.id}` : "itemTypeId"}
          name="itemTypeId"
          defaultValue={field?.item_type_id ?? ""}
          disabled={Boolean(field)}
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={field ? `fieldLabel-${field.id}` : "fieldLabel"}>Field label</Label>
          <Input
            id={field ? `fieldLabel-${field.id}` : "fieldLabel"}
            name="fieldLabel"
            defaultValue={field?.field_label ?? ""}
            placeholder="Chest"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={field ? `fieldKey-${field.id}` : "fieldKey"}>Field key</Label>
          <Input
            id={field ? `fieldKey-${field.id}` : "fieldKey"}
            name="fieldKey"
            defaultValue={field?.field_key ?? ""}
            placeholder="chest"
            readOnly={Boolean(field)}
            required
          />
        </div>
      </div>
      {field ? <p className="text-xs text-muted-foreground">Field key and item type are permanent identifiers. Create a new field if either identity is wrong.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={field ? `unit-${field.id}` : "unit"}>Unit</Label>
          <Input id={field ? `unit-${field.id}` : "unit"} name="unit" defaultValue={field?.unit ?? ""} placeholder="in, cm, pcs" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={field ? `sortOrder-${field.id}` : "sortOrder"}>Sort order</Label>
          <Input
            id={field ? `sortOrder-${field.id}` : "sortOrder"}
            name="sortOrder"
            type="number"
            min="0"
            defaultValue={field?.sort_order ?? 0}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={field ? `helpText-${field.id}` : "helpText"}>Helper note</Label>
        <Input
          id={field ? `helpText-${field.id}` : "helpText"}
          name="helpText"
          defaultValue={field?.help_text ?? ""}
          placeholder="How staff should capture this measurement"
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input name="isRequired" type="checkbox" defaultChecked={field?.is_required ?? false} className="h-4 w-4" />
          Required
        </label>
        {field ? (
          <label className="flex items-center gap-2">
            <input name="isActive" type="checkbox" defaultChecked={field.is_active} className="h-4 w-4" />
            Active
          </label>
        ) : null}
      </div>
      <Button type="submit">{field ? "Save field" : "Add field"}</Button>
    </>
  );

  if (bare) return fields;

  return <form action={action} className="space-y-4" data-unsaved-guard="true">{fields}</form>;
}

function getMeasurementEntries(measurementData: Json) {
  if (!measurementData || Array.isArray(measurementData) || typeof measurementData !== "object") {
    return [];
  }

  return Object.entries(measurementData).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

function getSizePreview(size: ItemTypeStandardSize, fields: ItemTypeMeasurementField[]) {
  const fieldByKey = new Map(fields.map((field) => [field.field_key, field]));
  const fieldOrder = new Map(fields.map((field, index) => [field.field_key, index]));

  return getMeasurementEntries(size.measurement_data_json)
    .sort(([firstKey], [secondKey]) => {
      const firstIndex = fieldOrder.get(firstKey) ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = fieldOrder.get(secondKey) ?? Number.MAX_SAFE_INTEGER;

      if (firstIndex !== secondIndex) {
        return firstIndex - secondIndex;
      }

      return firstKey.localeCompare(secondKey);
    })
    .map(([key, value]) => {
      const field = fieldByKey.get(key);

      return {
        key,
        label: field?.field_label ?? key,
        unit: field?.unit ?? null,
        value
      };
    });
}

export default async function MeasurementStandardsPage() {
  const { itemTypes, fields, standardSizes } = await getMeasurementStandardsSettings();
  const fieldsByItemTypeId = new Map<string, ItemTypeMeasurementField[]>();
  const sizesByItemTypeId = new Map<string, ItemTypeStandardSize[]>();

  fields.forEach((field) => {
    const existing = fieldsByItemTypeId.get(field.item_type_id) ?? [];
    existing.push(field);
    fieldsByItemTypeId.set(field.item_type_id, existing);
  });

  standardSizes.forEach((size) => {
    const existing = sizesByItemTypeId.get(size.item_type_id) ?? [];
    existing.push(size);
    sizesByItemTypeId.set(size.item_type_id, existing);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Measurement standards"
        description="Tenant-level default fields for each garment or item type."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/settings">
                <ArrowLeft className="h-4 w-4" />
                Settings
              </Link>
            </Button>
            <Dialog
              title="Add measurement field"
              description="Create a standard field for one item type."
              trigger={<ActionTrigger>Add field</ActionTrigger>}
            >
              <FieldForm itemTypes={itemTypes} />
            </Dialog>
            <Dialog
              title="Add standard size"
              description="Create a size template such as S, M, L, or 38 for one item type."
              trigger={<ActionTrigger>Add size</ActionTrigger>}
              className="max-w-3xl"
            >
              <StandardSizeForm action={createStandardSizeAction} itemTypes={itemTypes} fields={fields} />
            </Dialog>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>How this works</CardTitle>
          <CardDescription>
            These standards belong only to this tenant. They guide measurement entry; they do not delete or rewrite old customer measurements.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure fields such as Chest, Waist, Length, Shoulder, or Sleeve for each item type. Customer-specific measurements can still add extra fields when needed.
        </CardContent>
      </Card>

      <div className="space-y-4">
        {itemTypes.map((itemType) => {
          const itemFields = (fieldsByItemTypeId.get(itemType.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
          const activeFields = itemFields.filter((field) => field.is_active);
          const itemSizes = (sizesByItemTypeId.get(itemType.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);

          return (
            <Card key={itemType.id}>
              <CardHeader>
                <CardTitle>{itemType.name}</CardTitle>
                <CardDescription>
                  {itemFields.length} dimension fields · {itemSizes.length} size templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium">Dimension fields</h3>
                    <p className="text-sm text-muted-foreground">These are the columns used by customer measurements and standard size templates.</p>
                  </div>
                  {itemFields.map((field) => (
                    <div key={field.id} className="rounded-md border p-3">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{field.field_label}</p>
                            {field.unit ? <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{field.unit}</span> : null}
                            {field.is_required ? <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">required</span> : null}
                            {!field.is_active ? <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">inactive</span> : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Key: {field.field_key} · Sort {field.sort_order}
                          </p>
                          {field.help_text ? <p className="mt-1 text-sm text-muted-foreground">{field.help_text}</p> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <AutoCloseActionDialog action={updateMeasurementFieldAction} successMessage="Measurement field saved."
                            title="Edit measurement field"
                            description="Update this tenant-level field standard."
                            trigger={
                              <ActionTrigger variant="outline">
                                <Pencil className="h-4 w-4" />
                                Edit
                              </ActionTrigger>
                            }
                          >
                            <FieldForm itemTypes={itemTypes} field={field} bare />
                          </AutoCloseActionDialog>
                          <form action={archiveMeasurementFieldAction}>
                            <input type="hidden" name="fieldId" value={field.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Archive
                            </Button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!itemFields.length ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No measurement fields configured for {itemType.name} yet.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Standard sizes</h3>
                      <p className="text-sm text-muted-foreground">Size templates such as S, M, L, or numeric sizes for this item type.</p>
                    </div>
                    <Dialog
                      title={`Add ${itemType.name} size`}
                      description="Save a reusable standard measurement set for this item type."
                      trigger={<ActionTrigger variant="outline">Add size</ActionTrigger>}
                      className="max-w-3xl"
                    >
                      <StandardSizeForm
                        action={createStandardSizeAction}
                        itemTypes={itemTypes}
                        fields={fields}
                        initialItemTypeId={itemType.id}
                      />
                    </Dialog>
                  </div>
                  {itemSizes.map((size) => {
                    const preview = getSizePreview(size, itemFields);

                    return (
                      <div key={size.id} className="rounded-md border p-3">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{size.size_label}</p>
                              <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Sort {size.sort_order}</span>
                              {!size.is_active ? <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">inactive</span> : null}
                            </div>
                            {preview.length ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                {preview.map(({ key, label, unit, value }) => (
                                  <div key={key} className="rounded-md bg-muted px-2 py-1 text-xs">
                                    <span className="font-medium">{label}</span>
                                    <span className="text-muted-foreground">
                                      : {value}
                                      {unit ? ` ${unit}` : ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">No dimension values saved.</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <AutoCloseActionDialog action={updateStandardSizeAction} successMessage="Standard size saved."
                              title="Edit standard size"
                              description="Update this reusable item-type size template."
                              trigger={
                                <ActionTrigger variant="outline">
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </ActionTrigger>
                              }
                              className="max-w-3xl"
                            >
                              <StandardSizeForm action={updateStandardSizeAction} itemTypes={itemTypes} fields={fields} standardSize={size} bare />
                            </AutoCloseActionDialog>
                            <form action={archiveStandardSizeAction}>
                              <input type="hidden" name="standardSizeId" value={size.id} />
                              <Button type="submit" variant="outline" size="sm">
                                Archive
                              </Button>
                            </form>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!itemSizes.length ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      {activeFields.length
                        ? `No standard sizes configured for ${itemType.name} yet.`
                        : `Add active dimension fields before creating ${itemType.name} size templates.`}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!itemTypes.length ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Add item types before configuring measurement standards.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
