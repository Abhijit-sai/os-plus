import Link from "next/link";
import { Route } from "lucide-react";

import { getOrderDetailPageData } from "@/features/orders/queries";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { OrderMessageDialog } from "@/components/communications/order-message-dialog";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusBadge } from "@/components/design-system/status-badge";
import { ItemTypeIcon } from "@/components/item-types/item-type-icon";
import { CommandBar } from "@/components/layout/command-bar";
import { PageHeader } from "@/components/layout/page-header";
import { AddPaymentDialog } from "@/components/orders/add-payment-dialog";
import { AddOrderItemsDialog } from "@/components/orders/add-order-items-dialog";
import { CustomerContextSheet } from "@/components/orders/customer-context-sheet";
import { EditOrderDialog } from "@/components/orders/edit-order-dialog";
import { ItemWorkflowPanel } from "@/components/production/item-workflow-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { GstTreatment, ItemTypeMeasurementField } from "@/types/database";

const gstTreatmentLabels: Record<GstTreatment, string> = {
  exempt_or_nil: "Exempt / nil rated",
  non_gst: "Non-GST supply",
  not_applicable: "Not applicable",
  taxable_exclusive: "GST added on top",
  taxable_inclusive: "GST included in amount"
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount);
}

function getMeasurementEntries(measurementData: unknown) {
  if (!measurementData || Array.isArray(measurementData) || typeof measurementData !== "object") {
    return [];
  }

  return Object.entries(measurementData).filter((entry): entry is [string, string] => typeof entry[1] === "string");
}

function formatMeasurementEntries({
  entries,
  standards
}: {
  entries: [string, string][];
  standards: ItemTypeMeasurementField[];
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

function isDeliveryStageName(stageName: string | undefined) {
  const normalized = stageName?.toLowerCase() ?? "";
  return normalized.includes("deliver") || normalized.includes("handoff");
}

function StageStatusIndicator({ status }: { status: string }) {
  return <StatusBadge value={status} />;
}

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const {
    context,
    order,
    customer,
    items,
    payments,
    itemTypes,
    workflows,
    paymentModes,
    workflowInstances,
    stageInstances,
    workflowStages,
    stageMasters,
    workLogs,
    workers,
    workerWorkgroups,
    stageWorkgroups,
    workgroups,
    contributionRules,
    contributionCorrections,
    itemHistory,
    customerStatuses,
    customerOrders,
    customerOrderItems,
    customerMeasurements,
    measurementFields,
    orderItemAttachments,
    orderMessages,
    standardSizes
  } = await getOrderDetailPageData(orderId);
  const itemTypeById = new Map(itemTypes.map((itemType) => [itemType.id, itemType]));
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  const paymentModeById = new Map(paymentModes.map((paymentMode) => [paymentMode.id, paymentMode]));
  const stageById = new Map(stageMasters.map((stage) => [stage.id, stage]));
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));
  const customerStatusById = new Map(customerStatuses.map((status) => [status.id, status]));
  const customerMeasurementById = new Map(customerMeasurements.map((measurement) => [measurement.id, measurement]));
  const standardSizeById = new Map(standardSizes.map((standardSize) => [standardSize.id, standardSize]));
  const workflowInstanceByItemId = new Map(workflowInstances.map((instance) => [instance.order_item_id, instance]));
  const attachmentsByItemId = orderItemAttachments.reduce((groups, attachment) => {
    const rows = groups.get(attachment.entity_id) ?? [];
    rows.push(attachment);
    groups.set(attachment.entity_id, rows);
    return groups;
  }, new Map<string, typeof orderItemAttachments>());
  const stagesByItemId = new Map<string, typeof stageInstances>();
  const activeLogByStageId = new Map(
    workLogs
      .filter((log) => log.status === "in_progress")
      .map((log) => [log.stage_instance_id, log])
  );

  stageInstances.forEach((stageInstance) => {
    const existing = stagesByItemId.get(stageInstance.order_item_id) ?? [];
    existing.push(stageInstance);
    stagesByItemId.set(stageInstance.order_item_id, existing);
  });

  const outstandingAmount = Math.max(order.total_amount - order.amount_paid, 0);
  const trackingPath = `/track/${order.tracking_token}`;
  const trackingUrl = trackingPath;
  const effectivelyDeliveredItemIds = new Set(
    items
      .filter((item) => {
        if (item.item_status === "delivered") {
          return true;
        }

        const itemStages = (stagesByItemId.get(item.id) ?? []).sort((a, b) => a.sequence_number - b.sequence_number);
        const finalStage = itemStages.at(-1);
        const finalStageName = finalStage ? stageById.get(finalStage.stage_master_id)?.name : undefined;

        return (
          Boolean(itemStages.length) &&
          itemStages.every((stage) => ["completed", "skipped"].includes(stage.status)) &&
          finalStage?.status === "completed" &&
          isDeliveryStageName(finalStageName)
        );
      })
      .map((item) => item.id)
  );
  const deliveredItems = effectivelyDeliveredItemIds.size;
  const productionCompleteItems = items.filter(
    (item) => item.item_status === "completed" || effectivelyDeliveredItemIds.has(item.id)
  ).length;
  const fulfillmentLabel =
    deliveredItems === items.length && items.length
      ? "delivered"
      : deliveredItems > 0
        ? "partially_delivered"
        : productionCompleteItems === items.length && items.length
          ? "production_complete"
          : "in_progress";
  const displayOrderStatus =
    fulfillmentLabel === "delivered" || fulfillmentLabel === "partially_delivered"
      ? fulfillmentLabel
      : order.order_status;
  const productionStarted =
    items.some((item) => item.item_status !== "not_started") ||
    workflowInstances.some((instance) => instance.status !== "not_started") ||
    stageInstances.some((stage) =>
      ["in_progress", "paused", "completed", "skipped", "blocked"].includes(stage.status)
    ) ||
    workLogs.length > 0;
  const isFullyDelivered =
    order.order_status === "delivered" ||
    (items.length > 0 && items.every((item) => item.item_status === "delivered"));

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_number}
        description={`Order source: ${order.source.replace("_", " ")}`}
        actions={
          <>
            <AddOrderItemsDialog
              orderId={order.id}
              customerId={order.customer_id}
              orderStatus={order.order_status}
              isFullyDelivered={isFullyDelivered}
              productionStarted={productionStarted}
              itemTypes={itemTypes.filter((itemType) => itemType.is_active)}
              workflows={workflows.filter((workflow) => workflow.is_active)}
              measurements={customerMeasurements}
              measurementFields={measurementFields}
              standardSizes={standardSizes}
            />
            <EditOrderDialog
              order={order}
              items={items}
              itemTypes={itemTypes}
              measurements={customerMeasurements}
              standardSizes={standardSizes}
            />
            <Button asChild variant="outline">
              <Link href={trackingPath}>Open tracking</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/orders">Back to orders</Link>
            </Button>
          </>
        }
      />
      <CommandBar>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          <span>Customer</span>
          <CustomerContextSheet customer={customer} measurements={customerMeasurements} orders={customerOrders} orderItems={customerOrderItems} currentOrderId={order.id} />
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          <span>Order</span>
          <StatusBadge value={displayOrderStatus} />
        </span>
        {fulfillmentLabel !== displayOrderStatus ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
            <span>Fulfillment</span>
            <StatusBadge value={fulfillmentLabel} />
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          <span>Payment</span>
          <StatusBadge value={order.payment_status} />
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          {deliveredItems}/{items.length} items delivered
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
          Promised {order.promised_delivery_date ?? "not set"}
        </span>
      </CommandBar>
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <CardTitle>Customer messages</CardTitle>
              <CardDescription>
                Queue dry-run tracking links and payment reminders. Live WhatsApp/email sending is still disabled.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <OrderMessageDialog
                channel="whatsapp"
                customer={customer}
                order={order}
                tenant={context.tenant}
                trackingUrl={trackingUrl}
                triggerType="manual_tracking_link"
              />
              <OrderMessageDialog
                channel="email"
                customer={customer}
                order={order}
                tenant={context.tenant}
                trackingUrl={trackingUrl}
                triggerType="manual_tracking_link"
              />
              {outstandingAmount > 0 ? (
                <>
                  <OrderMessageDialog
                    channel="whatsapp"
                    customer={customer}
                    order={order}
                    tenant={context.tenant}
                    trackingUrl={trackingUrl}
                    triggerType="manual_payment_reminder"
                  />
                  <OrderMessageDialog
                    channel="email"
                    customer={customer}
                    order={order}
                    tenant={context.tenant}
                    trackingUrl={trackingUrl}
                    triggerType="manual_payment_reminder"
                  />
                </>
              ) : null}
            </div>
          </div>
        </CardHeader>
        {orderMessages.length ? (
          <CardContent className="border-t pt-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">Recent message history</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {orderMessages.slice(0, 4).map((message) => (
                  <div key={message.id} className="rounded-md border bg-muted/10 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{message.trigger_type ? message.trigger_type.replaceAll("_", " ") : "manual message"}</p>
                      <Badge variant="neutral">{message.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {message.channel} · {message.recipient_phone ?? message.recipient_email} · {new Date(message.created_at).toLocaleString("en-IN")}
                    </p>
                    <p className="mt-2 line-clamp-2 text-muted-foreground">{message.body_text}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Order total"
          value={`₹${formatMoney(order.total_amount)}`}
          hint={order.gst_amount > 0 ? `Includes GST ₹${formatMoney(order.gst_amount)}` : `Discount ₹${formatMoney(order.discount_amount)}`}
        />
        <MetricCard label="Amount paid" value={`₹${formatMoney(order.amount_paid)}`} hint={order.payment_status.replace("_", " ")} />
        <MetricCard label="Receivable" value={`₹${formatMoney(outstandingAmount)}`} hint="Derived from order payments" />
        <MetricCard label="Production" value={`${productionCompleteItems}/${items.length}`} hint="Production-complete items" />
        <MetricCard label="Delivery" value={`${deliveredItems}/${items.length}`} hint={fulfillmentLabel.replaceAll("_", " ")} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
            <CardHeader>
              <CardTitle>Commercial summary</CardTitle>
              <CardDescription>Order-level dates, delivery, and internal notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-medium">Order date</p>
                  <p className="text-muted-foreground">{order.order_date}</p>
                </div>
                <div>
                  <p className="font-medium">Promised date</p>
                  <p className="text-muted-foreground">{order.promised_delivery_date ?? "Not set"}</p>
                </div>
                <div>
                  <p className="font-medium">Delivery</p>
                  <p className="text-muted-foreground">{order.delivery_type.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <StatusBadge value={displayOrderStatus} />
                </div>
                <div>
                  <p className="font-medium">Reference ID</p>
                  <p className="text-muted-foreground">{order.reference_order_id ?? "Not set"}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">Delivery address</p>
                <p className="text-muted-foreground">{order.delivery_address ?? "Not set"}</p>
              </div>
              <Separator />
              <div>
                <p className="font-medium">Notes</p>
                <p className="text-muted-foreground">{order.notes ?? "No notes"}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <CardTitle>Payment summary</CardTitle>
                  <CardDescription>Collections are sourced from order payment records.</CardDescription>
                </div>
                {outstandingAmount > 0 ? (
                  <AddPaymentDialog orderId={order.id} outstandingAmount={outstandingAmount} paymentModes={paymentModes} />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Subtotal</p>
                  <p className="text-muted-foreground">₹{formatMoney(order.subtotal)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Discount</p>
                  <p className="text-muted-foreground">₹{formatMoney(order.discount_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total</p>
                  <p className="text-muted-foreground">₹{formatMoney(order.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">GST treatment</p>
                  <p className="text-muted-foreground">{gstTreatmentLabels[order.gst_treatment]}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Taxable</p>
                  <p className="text-muted-foreground">₹{formatMoney(order.taxable_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">GST</p>
                  <p className="text-muted-foreground">
                    ₹{formatMoney(order.gst_amount)}
                    {order.gst_rate > 0 ? ` at ${order.gst_rate}%` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Paid</p>
                  <p className="text-muted-foreground">₹{formatMoney(order.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
                  <p className="text-muted-foreground">₹{formatMoney(outstandingAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <StatusBadge value={order.payment_status} />
                </div>
              </div>
              <Separator />
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 4).map((payment) => (
                      <tr key={payment.id} className="border-t">
                        <td className="px-3 py-2">{payment.payment_date}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {payment.payment_mode_id ? paymentModeById.get(payment.payment_mode_id)?.name ?? "Unknown" : "No mode"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">₹{formatMoney(payment.amount)}</td>
                      </tr>
                    ))}
                    {!payments.length ? (
                      <tr>
                        <td className="px-3 py-3 text-muted-foreground" colSpan={3}>
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {payments.length > 4 ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">Transaction log</summary>
                  <div className="mt-3 space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="rounded-md border p-3">
                        <div className="flex justify-between gap-3">
                          <p className="font-medium">₹{formatMoney(payment.amount)}</p>
                          <p className="text-muted-foreground">{payment.payment_date}</p>
                        </div>
                        <p className="text-muted-foreground">
                          {payment.payment_mode_id ? paymentModeById.get(payment.payment_mode_id)?.name ?? "Unknown mode" : "No mode"}
                          {payment.reference_number ? ` · ${payment.reference_number}` : ""}
                        </p>
                        {payment.notes ? <p className="text-muted-foreground">{payment.notes}</p> : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>
      </div>
      <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Production items</CardTitle>
              <CardDescription>Each item is a production unit with its own workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => {
                const itemStages = (stagesByItemId.get(item.id) ?? []).sort((a, b) => a.sequence_number - b.sequence_number);
                const workflowInstance = workflowInstanceByItemId.get(item.id);
                const currentStage =
                  itemStages.find((stage) => stage.id === workflowInstance?.current_stage_instance_id) ??
                  itemStages.find((stage) => ["ready_to_start", "in_progress", "paused", "blocked"].includes(stage.status)) ??
                  null;
                const activeLog = currentStage ? activeLogByStageId.get(currentStage.id) : null;
                const activeWorker = activeLog ? workerById.get(activeLog.worker_id) : null;
                const completedStageCount = itemStages.filter((stage) => stage.status === "completed").length;
                const stageProgress = itemStages.length ? Math.round((completedStageCount / itemStages.length) * 100) : 0;
                const customerStatus = item.customer_status_id ? customerStatusById.get(item.customer_status_id)?.name : null;
                const effectiveItemStatus = effectivelyDeliveredItemIds.has(item.id) ? "delivered" : item.item_status;
                const linkedMeasurement = item.customer_measurement_id ? customerMeasurementById.get(item.customer_measurement_id) : null;
                const linkedStandardSize = item.standard_size_id ? standardSizeById.get(item.standard_size_id) : null;
                const linkedMeasurementEntries = linkedMeasurement ? getMeasurementEntries(linkedMeasurement.measurement_data_json) : [];
                const linkedStandardSizeEntries = linkedStandardSize ? getMeasurementEntries(linkedStandardSize.measurement_data_json) : [];
                const linkedMeasurementStandards = linkedMeasurement?.item_type_id
                  ? measurementFields
                      .filter((field) => field.item_type_id === linkedMeasurement.item_type_id)
                      .sort((a, b) => a.sort_order - b.sort_order)
                  : [];
                const linkedStandardSizeStandards = linkedStandardSize
                  ? measurementFields
                      .filter((field) => field.item_type_id === linkedStandardSize.item_type_id)
                      .sort((a, b) => a.sort_order - b.sort_order)
                  : [];
                const linkedMeasurementDisplayEntries = formatMeasurementEntries({
                  entries: linkedMeasurementEntries,
                  standards: linkedMeasurementStandards
                });
                const linkedStandardSizeDisplayEntries = formatMeasurementEntries({
                  entries: linkedStandardSizeEntries,
                  standards: linkedStandardSizeStandards
                });

                return (
                  <div key={item.id} className="rounded-md border p-4">
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <ItemTypeIcon
                            emoji={itemTypeById.get(item.item_type_id)?.icon_emoji}
                            kind={itemTypeById.get(item.item_type_id)?.icon_kind}
                            name={itemTypeById.get(item.item_type_id)?.icon_name}
                            color={itemTypeById.get(item.item_type_id)?.icon_color}
                          />
                          {itemTypeById.get(item.item_type_id)?.name ?? "Unknown type"} ·{" "}
                          {workflowById.get(item.workflow_id)?.name ?? "Unknown workflow"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge value={customerStatus ?? effectiveItemStatus} />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="font-medium">Internal stage</p>
                        <p className="text-muted-foreground">
                          {currentStage ? stageById.get(currentStage.stage_master_id)?.name ?? "Unknown" : "Not started"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Assigned worker</p>
                        <p className="text-muted-foreground">{activeWorker?.name ?? "None"}</p>
                      </div>
                      <div>
                        <p className="font-medium">Public status</p>
                        <p className="text-muted-foreground">{customerStatus ?? effectiveItemStatus.replace("_", " ")}</p>
                      </div>
                      <div>
                        <p className="font-medium">Expected</p>
                        <p className="text-muted-foreground">{item.expected_completion_date ?? "not set"}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {completedStageCount}/{itemStages.length} stages complete
                        </span>
                        <span>{stageProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${stageProgress}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                      <p className="text-muted-foreground">Qty {item.quantity}</p>
                      <p className="text-muted-foreground">Final ₹{formatMoney(item.final_price)}</p>
                      <p className="text-muted-foreground">
                        Delivery {item.delivery_type_override?.replace("_", " ") ?? "uses order"}
                      </p>
                    </div>
                    {linkedStandardSize || linkedMeasurement ? (
                      <div className="mt-4 rounded-md border bg-muted/20 p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">Fit reference</p>
                            <p className="text-muted-foreground">
                              {linkedStandardSize
                                ? `${linkedStandardSize.size_label} standard size`
                                : linkedMeasurement?.reference_name ??
                                  (linkedMeasurement?.item_type_id ? itemTypeById.get(linkedMeasurement.item_type_id)?.name : "General measurement")}
                            </p>
                          </div>
                          {linkedStandardSize ? (
                            <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">standard</span>
                          ) : linkedMeasurement?.is_default ? (
                            <span className="rounded-full bg-neutral-950 px-2 py-1 text-xs text-white">default</span>
                          ) : null}
                        </div>
                        {linkedStandardSizeDisplayEntries.length || linkedMeasurementDisplayEntries.length ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {(linkedStandardSize ? linkedStandardSizeDisplayEntries : linkedMeasurementDisplayEntries).slice(0, 6).map(({ key, label, unit, value }) => (
                              <div key={key} className="rounded-md bg-background px-2 py-1 text-xs">
                                <span className="font-medium">{label}</span>
                                <span className="text-muted-foreground">
                                  : {value}
                                  {unit ? ` ${unit}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {linkedMeasurement?.notes ? <p className="mt-2 text-xs text-muted-foreground">{linkedMeasurement.notes}</p> : null}
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <AttachmentPanel
                        attachments={attachmentsByItemId.get(item.id) ?? []}
                        description="Design references, measurement photos, fabric notes, and item-level files for staff."
                        entityId={item.id}
                        entityType="order_item"
                        title="Item attachments"
                      />
                    </div>
                    {itemStages.length ? (
                      <div className="mt-4 overflow-x-auto">
                        <div className="flex min-w-max gap-2">
                            <Dialog
                              title={`${item.name} workflow`}
                              description="Move stages, assign workers, complete work, or correct the workflow record."
                              placement="side"
                              trigger={
                                <span className="inline-flex h-[76px] w-12 items-center justify-center rounded-md border border-dashed hover:bg-accent" title="Open workflow">
                                  <Route className="h-5 w-5" />
                                  <span className="sr-only">Open workflow</span>
                                </span>
                              }
                            >
                              <ItemWorkflowPanel
                                item={item}
                                order={order}
                                workflow={workflowById.get(item.workflow_id) ?? null}
                                workflows={workflows}
                                itemType={itemTypeById.get(item.item_type_id) ?? null}
                                workflowInstance={workflowInstance ?? null}
                                 stageInstances={itemStages}
                                 workflowStages={workflowStages.filter((workflowStage) => workflowStage.workflow_id === item.workflow_id)}
                                stages={stageMasters}
                                workers={workers}
                                workerWorkgroups={workerWorkgroups}
                                stageWorkgroups={stageWorkgroups}
                                workgroups={workgroups}
                                 workLogs={workLogs.filter((log) => log.order_item_id === item.id)}
                                 contributionRules={contributionRules.filter((rule) => rule.item_type_id === item.item_type_id)}
                                 contributionCorrections={contributionCorrections.filter((correction) => correction.order_item_id === item.id)}
                                 canCorrectCompletedContributions={context.membership.role === "owner_admin"}
                                history={itemHistory.filter((event) => event.order_item_id === item.id)}
                                linkedMeasurement={linkedMeasurement ?? null}
                                variant="pane"
                              />
                            </Dialog>
                            {itemStages.map((stage) => (
                              <div key={stage.id} className="w-40 rounded-md border bg-background p-2">
                                <div className="space-y-2">
                                  <p className="line-clamp-2 text-xs font-medium">
                                    {stage.sequence_number}. {stageById.get(stage.stage_master_id)?.name ?? "Stage"}
                                  </p>
                                  <StageStatusIndicator status={stage.status} />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Workflow stages are not initialized for this item yet.</p>
                    )}
                    {item.notes ? <p className="mt-3 text-sm text-muted-foreground">{item.notes}</p> : null}
                  </div>
                );
              })}
              {!items.length ? <p className="text-sm text-muted-foreground">No items on this order.</p> : null}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
