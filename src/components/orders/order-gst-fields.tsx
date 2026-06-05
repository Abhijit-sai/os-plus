"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GstTreatment } from "@/types/database";

const taxableTreatments: GstTreatment[] = ["taxable_exclusive", "taxable_inclusive"];

const gstTreatmentOptions: Array<{ value: GstTreatment; label: string }> = [
  { value: "taxable_exclusive", label: "GST added on top" },
  { value: "taxable_inclusive", label: "GST included in amount" },
  { value: "exempt_or_nil", label: "Exempt / nil rated" },
  { value: "non_gst", label: "Non-GST supply" }
];

type OrderGstFieldsProps = {
  defaultGstRate: number;
  defaultGstTreatment: GstTreatment;
  gstRegistered: boolean;
};

function getInitialTreatment(defaultGstTreatment: GstTreatment): GstTreatment {
  return defaultGstTreatment === "not_applicable" ? "taxable_exclusive" : defaultGstTreatment;
}

export function OrderGstFields({ defaultGstRate, defaultGstTreatment, gstRegistered }: OrderGstFieldsProps) {
  const [gstEnabled, setGstEnabled] = React.useState(gstRegistered && defaultGstTreatment !== "not_applicable");
  const [gstTreatment, setGstTreatment] = React.useState<GstTreatment>(getInitialTreatment(defaultGstTreatment));

  if (!gstRegistered) {
    return (
      <>
        <input type="hidden" name="orderGstTreatment" value="not_applicable" />
        <input type="hidden" name="orderGstRate" value="0" />
      </>
    );
  }

  const isTaxable = taxableTreatments.includes(gstTreatment);

  return (
    <div className="grid gap-3 rounded-md border bg-muted/10 p-3 md:col-span-2">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={gstEnabled}
          onChange={(event) => setGstEnabled(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block font-medium">Collect GST on this order</span>
          <span className="block text-muted-foreground">Use the business default, or adjust this order if needed.</span>
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
              defaultValue={isTaxable ? defaultGstRate : 0}
              disabled={!isTaxable}
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
  );
}
