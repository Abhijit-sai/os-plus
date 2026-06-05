import { Pencil } from "lucide-react";

import {
  updateOrderDetailsAction,
  updateOrderItemAction,
} from "@/features/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CustomerMeasurement,
  ItemType,
  ItemTypeStandardSize,
  Order,
  OrderItem,
} from "@/types/database";

type EditOrderDialogProps = {
  order: Order;
  items: OrderItem[];
  itemTypes: ItemType[];
  measurements: CustomerMeasurement[];
  standardSizes: ItemTypeStandardSize[];
};

const sourceOptions = [
  { value: "walk_in", label: "Walk-in" },
  { value: "shopify_manual", label: "Shopify manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

const deliveryOptions = [
  { value: "store_pickup", label: "Store pickup" },
  { value: "self_delivery", label: "Self delivery" },
  { value: "courier", label: "Courier" },
];

function formatDateTime(date: string | null) {
  if (!date) {
    return "not updated";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

function getMeasurementOptionLabel({
  itemTypeName,
  measurement,
}: {
  itemTypeName?: string | null;
  measurement: CustomerMeasurement;
}) {
  const baseLabel =
    measurement.reference_name?.trim() || itemTypeName || "Measurement";
  const parts = [baseLabel];

  if (measurement.is_default) {
    parts.push("default");
  }

  if (itemTypeName && itemTypeName !== baseLabel) {
    parts.push(itemTypeName);
  }

  parts.push(`updated ${formatDateTime(measurement.updated_at)}`);

  return parts.join(" · ");
}

function getStandardSizeOptionLabel({
  itemTypeName,
  standardSize,
}: {
  itemTypeName?: string | null;
  standardSize: ItemTypeStandardSize;
}) {
  return [
    standardSize.size_label,
    itemTypeName ?? "item",
    `updated ${formatDateTime(standardSize.updated_at)}`,
  ].join(" · ");
}

function ActionTrigger() {
  return (
    <span className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
      <Pencil className="h-4 w-4" />
      Edit order
    </span>
  );
}

export function EditOrderDialog({
  order,
  items,
  itemTypes,
  measurements,
  standardSizes,
}: EditOrderDialogProps) {
  const itemTypeById = new Map(
    itemTypes.map((itemType) => [itemType.id, itemType]),
  );

  return (
    <Dialog
      title={`Edit ${order.order_number}`}
      description="Correct order details and item references. Payments and production history stay separate."
      placement="side"
      trigger={<ActionTrigger />}
    >
      <div className="space-y-6">
        <form
          action={updateOrderDetailsAction}
          className="space-y-4 rounded-md border p-4"
          data-unsaved-guard="true"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <div>
            <h3 className="font-medium">Order details</h3>
            <p className="text-sm text-muted-foreground">
              Commercial fields that do not recalculate payment totals.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-referenceOrderId">Reference order ID</Label>
              <Input
                id="edit-referenceOrderId"
                name="referenceOrderId"
                defaultValue={order.reference_order_id ?? ""}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-source">Source</Label>
              <select
                id="edit-source"
                name="source"
                defaultValue={order.source}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-orderDate">Order date</Label>
              <Input
                id="edit-orderDate"
                name="orderDate"
                type="date"
                defaultValue={order.order_date}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-promisedDeliveryDate">
                Promised delivery date
              </Label>
              <Input
                id="edit-promisedDeliveryDate"
                name="promisedDeliveryDate"
                type="date"
                defaultValue={order.promised_delivery_date ?? ""}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-deliveryType">Delivery type</Label>
              <select
                id="edit-deliveryType"
                name="deliveryType"
                defaultValue={order.delivery_type}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {deliveryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-deliveryAddress">Delivery address</Label>
              <Input
                id="edit-deliveryAddress"
                name="deliveryAddress"
                defaultValue={order.delivery_address ?? ""}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="edit-orderNotes">Order notes</Label>
              <Input
                id="edit-orderNotes"
                name="notes"
                defaultValue={order.notes ?? ""}
                placeholder="Internal order notes"
              />
            </div>
          </div>
          <Button type="submit">Save order details</Button>
        </form>

        <div className="space-y-3">
          <div>
            <h3 className="font-medium">Item corrections</h3>
            <p className="text-sm text-muted-foreground">
              Non-destructive item edits. Price and quantity changes will be
              handled in a later finance-safe flow.
            </p>
          </div>
          {items.map((item) => {
            const compatibleMeasurements = measurements.filter(
              (measurement) =>
                !measurement.item_type_id ||
                measurement.item_type_id === item.item_type_id,
            );
            const compatibleStandardSizes = standardSizes.filter(
              (standardSize) => standardSize.item_type_id === item.item_type_id,
            );
            const selectedFitReference = item.standard_size_id
              ? `standard:${item.standard_size_id}`
              : item.customer_measurement_id
                ? `customer:${item.customer_measurement_id}`
                : "";

            return (
              <form
                key={item.id}
                action={updateOrderItemAction}
                className="space-y-4 rounded-md border p-4"
                data-unsaved-guard="true"
              >
                <input type="hidden" name="orderItemId" value={item.id} />
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {itemTypeById.get(item.item_type_id)?.name ??
                        "Unknown item type"}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    Qty {item.quantity}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-name-${item.id}`}>Item name</Label>
                    <Input
                      id={`edit-name-${item.id}`}
                      name="name"
                      defaultValue={item.name}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-color-${item.id}`}>Color</Label>
                    <Input
                      id={`edit-color-${item.id}`}
                      name="color"
                      defaultValue={item.color ?? ""}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor={`edit-description-${item.id}`}>
                      Description
                    </Label>
                    <Input
                      id={`edit-description-${item.id}`}
                      name="description"
                      defaultValue={item.description ?? ""}
                      placeholder="Styling details"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-expected-${item.id}`}>
                      Expected completion
                    </Label>
                    <Input
                      id={`edit-expected-${item.id}`}
                      name="expectedCompletionDate"
                      type="date"
                      defaultValue={item.expected_completion_date ?? ""}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-delivery-${item.id}`}>
                      Delivery override
                    </Label>
                    <select
                      id={`edit-delivery-${item.id}`}
                      name="deliveryTypeOverride"
                      defaultValue={item.delivery_type_override ?? ""}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">Use order delivery</option>
                      {deliveryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor={`edit-fit-reference-${item.id}`}>
                      Fit reference
                    </Label>
                    <select
                      id={`edit-fit-reference-${item.id}`}
                      name="fitReference"
                      defaultValue={selectedFitReference}
                      className="h-10 rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="">No fit reference linked</option>
                      {compatibleStandardSizes.length ? (
                        <optgroup label="Standard sizes">
                          {compatibleStandardSizes.map((standardSize) => (
                            <option
                              key={standardSize.id}
                              value={`standard:${standardSize.id}`}
                            >
                              {getStandardSizeOptionLabel({
                                itemTypeName: itemTypeById.get(
                                  standardSize.item_type_id,
                                )?.name,
                                standardSize,
                              })}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {compatibleMeasurements.length ? (
                        <optgroup label="Customer measurements">
                          {compatibleMeasurements.map((measurement) => {
                            const itemTypeName = measurement.item_type_id
                              ? itemTypeById.get(measurement.item_type_id)?.name
                              : "General";

                            return (
                              <option
                                key={measurement.id}
                                value={`customer:${measurement.id}`}
                              >
                                {getMeasurementOptionLabel({
                                  itemTypeName,
                                  measurement,
                                })}
                              </option>
                            );
                          })}
                        </optgroup>
                      ) : null}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Standard sizes come from the item type. Customer
                      measurements belong to this order customer.
                    </p>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor={`edit-notes-${item.id}`}>Item notes</Label>
                    <Input
                      id={`edit-notes-${item.id}`}
                      name="notes"
                      defaultValue={item.notes ?? ""}
                      placeholder="Internal item notes"
                    />
                  </div>
                </div>
                <Button type="submit" variant="outline">
                  Save item
                </Button>
              </form>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
