import { createOrderAction } from "@/features/orders/actions";
import { getNewOrderPageData } from "@/features/orders/queries";
import { CustomerPicker } from "@/components/orders/customer-picker";
import { OrderGstFields } from "@/components/orders/order-gst-fields";
import { OrderItemBuilder } from "@/components/orders/order-item-builder";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams?: Promise<{ customerId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const {
    context,
    customers,
    itemTypes,
    workflows,
    paymentModes,
    customerMeasurements,
    measurementFields,
    standardSizes,
  } = await getNewOrderPageData();
  const today = todayIsoDate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Create order
          </h2>
          <p className="text-muted-foreground">
            Manual order entry with item-level workflow selection for
            production.
          </p>
        </div>
      </div>
      <form
        action={createOrderAction}
        className="space-y-6"
        data-unsaved-guard="true"
      >
        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>
              Order is the commercial unit. Items below become production units.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Order number</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
                Generated automatically
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="referenceOrderId">Reference order ID</Label>
              <Input
                id="referenceOrderId"
                name="referenceOrderId"
                placeholder="Optional external or legacy ID"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">Source</Label>
              <select
                id="source"
                name="source"
                defaultValue="walk_in"
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
              <CustomerPicker
                customers={customers.map((customer) => ({
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                }))}
                selectedCustomerId={resolvedSearchParams?.customerId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="orderDate">Order date</Label>
              <Input
                id="orderDate"
                name="orderDate"
                type="date"
                defaultValue={today}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="promisedDeliveryDate">
                Promised delivery date
              </Label>
              <Input
                id="promisedDeliveryDate"
                name="promisedDeliveryDate"
                type="date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deliveryType">Delivery type</Label>
              <select
                id="deliveryType"
                name="deliveryType"
                defaultValue="store_pickup"
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {deliveryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="deliveryAddress">Delivery address</Label>
              <Input
                id="deliveryAddress"
                name="deliveryAddress"
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="notes">Order notes</Label>
              <Input
                id="notes"
                name="notes"
                placeholder="Internal order notes"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order items</CardTitle>
            <CardDescription>
              Add one row per production unit when pieces need individual
              tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OrderItemBuilder
              itemTypes={itemTypes.map((itemType) => ({
                id: itemType.id,
                name: itemType.name,
                icon_emoji: itemType.icon_emoji,
                description: itemType.description,
              }))}
              workflows={workflows.map((workflow) => ({
                id: workflow.id,
                name: workflow.name,
                description: workflow.description,
              }))}
              measurements={customerMeasurements}
              measurementFields={measurementFields}
              standardSizes={standardSizes}
              selectedCustomerId={resolvedSearchParams?.customerId}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total order value</CardTitle>
            <CardDescription>
              Review item totals and GST before recording any payment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrderGstFields
              defaultGstRate={Number(
                context.tenant.default_sales_gst_rate ?? 0,
              )}
              defaultGstTreatment={
                context.tenant.default_order_gst_treatment ?? "not_applicable"
              }
              gstRegistered={Boolean(context.tenant.gst_registered)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Initial payment</CardTitle>
            <CardDescription>
              Optional partial payment recorded during order creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="initialPaymentAmount">Amount paid</Label>
              <Input
                id="initialPaymentAmount"
                name="initialPaymentAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="initialPaymentModeId">Payment mode</Label>
              <select
                id="initialPaymentModeId"
                name="initialPaymentModeId"
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No payment mode</option>
                {paymentModes.map((paymentMode) => (
                  <option key={paymentMode.id} value={paymentMode.id}>
                    {paymentMode.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="initialPaymentDate">Payment date</Label>
              <Input
                id="initialPaymentDate"
                name="initialPaymentDate"
                type="date"
                defaultValue={today}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="initialPaymentReference">Reference</Label>
              <Input
                id="initialPaymentReference"
                name="initialPaymentReference"
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="initialPaymentNotes">Payment notes</Label>
              <Input
                id="initialPaymentNotes"
                name="initialPaymentNotes"
                placeholder="Optional"
              />
            </div>
          </CardContent>
        </Card>
        <Button type="submit">Create order</Button>
      </form>
    </div>
  );
}
