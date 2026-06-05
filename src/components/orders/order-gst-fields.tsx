"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GstTreatment } from "@/types/database";

const taxableTreatments: GstTreatment[] = ["taxable_exclusive", "taxable_inclusive"];

const gstTreatmentOptions: Array<{ value: GstTreatment; label: string }> = [
  { value: "taxable_exclusive", label: "GST added on top" },
  { value: "taxable_inclusive", label: "GST included in amount" }
];

type OrderGstFieldsProps = {
  defaultGstRate: number;
  defaultGstTreatment: GstTreatment;
  gstRegistered: boolean;
};

function getInitialTreatment(defaultGstTreatment: GstTreatment): GstTreatment {
  return taxableTreatments.includes(defaultGstTreatment) ? defaultGstTreatment : "taxable_exclusive";
}

export function OrderGstFields({ defaultGstRate, defaultGstTreatment, gstRegistered }: OrderGstFieldsProps) {
  const [gstEnabled, setGstEnabled] = React.useState(gstRegistered && taxableTreatments.includes(defaultGstTreatment));
  const [gstTreatment, setGstTreatment] = React.useState<GstTreatment>(getInitialTreatment(defaultGstTreatment));
  const [gstRate, setGstRate] = React.useState(defaultGstRate);
  const [itemTotals, setItemTotals] = React.useState({ discountAmount: 0, subtotal: 0 });

  React.useEffect(() => {
    function updateTotals() {
      const quantityInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="itemQuantity_"]'));
      const nextTotals = quantityInputs.reduce(
        (totals, quantityInput) => {
          const rowId = quantityInput.name.replace("itemQuantity_", "");
          const unitPriceInput = document.querySelector<HTMLInputElement>(`input[name="itemUnitPrice_${rowId}"]`);
          const discountInput = document.querySelector<HTMLInputElement>(`input[name="itemDiscountAmount_${rowId}"]`);
          const quantity = Number(quantityInput.value || 0);
          const unitPrice = Number(unitPriceInput?.value || 0);
          const discountAmount = Number(discountInput?.value || 0);

          return {
            discountAmount: totals.discountAmount + discountAmount,
            subtotal: totals.subtotal + quantity * unitPrice
          };
        },
        { discountAmount: 0, subtotal: 0 }
      );

      setItemTotals(nextTotals);
    }

    function updateTotalsAfterClick() {
      window.setTimeout(updateTotals, 0);
    }

    updateTotals();
    document.addEventListener("input", updateTotals);
    document.addEventListener("change", updateTotals);
    document.addEventListener("click", updateTotalsAfterClick);
    return () => {
      document.removeEventListener("input", updateTotals);
      document.removeEventListener("change", updateTotals);
      document.removeEventListener("click", updateTotalsAfterClick);
    };
  }, []);

  if (!gstRegistered) {
    const baseTotal = Math.max(itemTotals.subtotal - itemTotals.discountAmount, 0);

    return (
      <div className="space-y-4">
        <input type="hidden" name="orderGstTreatment" value="not_applicable" />
        <input type="hidden" name="orderGstRate" value="0" />
        <OrderValueSummary discountAmount={itemTotals.discountAmount} gstAmount={0} subtotal={itemTotals.subtotal} totalAmount={baseTotal} />
      </div>
    );
  }

  const isTaxable = taxableTreatments.includes(gstTreatment);
  const baseTotal = Math.max(itemTotals.subtotal - itemTotals.discountAmount, 0);
  const effectiveGstRate = gstEnabled && isTaxable ? gstRate : 0;
  const gstAmount =
    effectiveGstRate > 0
      ? gstTreatment === "taxable_exclusive"
        ? roundMoney((baseTotal * effectiveGstRate) / 100)
        : roundMoney(baseTotal - baseTotal / (1 + effectiveGstRate / 100))
      : 0;
  const totalAmount = gstEnabled && gstTreatment === "taxable_exclusive" ? roundMoney(baseTotal + gstAmount) : baseTotal;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      <OrderValueSummary discountAmount={itemTotals.discountAmount} gstAmount={gstAmount} subtotal={itemTotals.subtotal} totalAmount={totalAmount} />
      <div className="grid gap-3 rounded-md border bg-muted/10 p-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={gstEnabled}
            onChange={(event) => setGstEnabled(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block font-medium">Apply GST to this order</span>
            <span className="block text-muted-foreground">Turn this off when GST is not collected. Choose whether GST is added on top or already included.</span>
          </span>
        </label>
        {gstEnabled ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="orderGstTreatment">GST treatment</Label>
              <select
                id="orderGstTreatment"
                name="orderGstTreatment"
                value={gstTreatment}
                onChange={(event) => setGstTreatment(event.target.value as GstTreatment)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {gstTreatmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="orderGstRate">GST rate %</Label>
              <Input
                id="orderGstRate"
                name="orderGstRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={isTaxable ? gstRate : 0}
                disabled={!isTaxable}
                onChange={(event) => setGstRate(Number(event.target.value || 0))}
              />
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="orderGstTreatment" value="not_applicable" />
            <input type="hidden" name="orderGstRate" value="0" />
          </>
        )}
      </div>
    </div>
  );
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function OrderValueSummary({
  discountAmount,
  gstAmount,
  subtotal,
  totalAmount
}: {
  discountAmount: number;
  gstAmount: number;
  subtotal: number;
  totalAmount: number;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Items subtotal</span>
          <span className="font-medium">{formatMoney(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Item discounts</span>
          <span className="font-medium">{formatMoney(discountAmount)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">GST</span>
          <span className="font-medium">{formatMoney(gstAmount)}</span>
        </div>
        <div className="border-t pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Order total</span>
            <span className="text-xl font-semibold">{formatMoney(totalAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
