"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpenseInputGstStatus, GstTreatment } from "@/types/database";

const taxableTreatments: GstTreatment[] = ["taxable_exclusive", "taxable_inclusive"];

const gstTreatmentOptions: Array<{ value: GstTreatment; label: string }> = [
  { value: "taxable_inclusive", label: "GST included in paid amount" },
  { value: "taxable_exclusive", label: "GST extra on taxable amount" },
  { value: "exempt_or_nil", label: "Exempt / nil rated" },
  { value: "non_gst", label: "Non-GST expense" }
];

const inputGstStatusOptions: Array<{ value: ExpenseInputGstStatus; label: string }> = [
  { value: "needs_review", label: "Needs accountant review" },
  { value: "claimable", label: "Claimable input GST" },
  { value: "not_claimed", label: "Do not claim" },
  { value: "not_applicable", label: "Not applicable" }
];

type ExpenseGstFieldsProps = {
  defaultGstRate: number;
  defaultGstTreatment: GstTreatment;
  expense?: {
    gst_amount: number;
    gst_rate: number;
    gst_treatment: GstTreatment;
    input_gst_status: ExpenseInputGstStatus;
    taxable_amount: number;
    vendor_gstin: string | null;
    vendor_invoice_date: string | null;
    vendor_invoice_number: string | null;
  };
  gstRegistered: boolean;
};

function getInitialTreatment(defaultGstTreatment: GstTreatment): GstTreatment {
  return defaultGstTreatment === "not_applicable" ? "taxable_inclusive" : defaultGstTreatment;
}

export function ExpenseGstFields({ defaultGstRate, defaultGstTreatment, expense, gstRegistered }: ExpenseGstFieldsProps) {
  const savedHasGst = Boolean(expense && expense.gst_treatment !== "not_applicable");
  const [gstEnabled, setGstEnabled] = React.useState(gstRegistered && (savedHasGst || defaultGstTreatment !== "not_applicable"));
  const [gstTreatment, setGstTreatment] = React.useState<GstTreatment>(expense?.gst_treatment ?? getInitialTreatment(defaultGstTreatment));

  if (!gstRegistered) {
    return (
      <>
        <input type="hidden" name="expenseGstTreatment" value="not_applicable" />
        <input type="hidden" name="expenseGstRate" value="0" />
        <input type="hidden" name="inputGstStatus" value="not_applicable" />
      </>
    );
  }

  const isTaxable = taxableTreatments.includes(gstTreatment);

  return (
    <details className="rounded-md border bg-muted/10 p-3" open={savedHasGst}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Vendor invoice / GST</p>
            <p className="text-xs text-muted-foreground">Optional GST details for accountant handoff.</p>
          </div>
          <span className="rounded-full border px-2 py-1 text-xs">{savedHasGst ? "Saved" : "Optional"}</span>
        </div>
      </summary>
      <div className="mt-4 space-y-4 border-t pt-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={gstEnabled}
            onChange={(event) => setGstEnabled(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block font-medium">This expense has GST details</span>
            <span className="block text-muted-foreground">Payment mode stays separate from GST treatment.</span>
          </span>
        </label>
        {gstEnabled ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={expense ? `vendorInvoiceNumber-${expense.vendor_invoice_number ?? "expense"}` : "vendorInvoiceNumber"}>Invoice number</Label>
              <Input name="vendorInvoiceNumber" defaultValue={expense?.vendor_invoice_number ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label>Invoice date</Label>
              <Input name="vendorInvoiceDate" type="date" defaultValue={expense?.vendor_invoice_date ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label>Vendor GSTIN</Label>
              <Input name="vendorGstin" defaultValue={expense?.vendor_gstin ?? ""} placeholder="29ABCDE1234F1Z5" />
            </div>
            <div className="grid gap-2">
              <Label>GST treatment</Label>
              <select
                name="expenseGstTreatment"
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
              <Label>GST rate %</Label>
              <Input
                name="expenseGstRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={isTaxable ? expense?.gst_rate ?? defaultGstRate : 0}
                disabled={!isTaxable}
              />
            </div>
            <div className="grid gap-2">
              <Label>Input GST status</Label>
              <select
                name="inputGstStatus"
                defaultValue={expense?.input_gst_status ?? (isTaxable ? "needs_review" : "not_applicable")}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {inputGstStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <>
            <input type="hidden" name="expenseGstTreatment" value="not_applicable" />
            <input type="hidden" name="expenseGstRate" value="0" />
            <input type="hidden" name="inputGstStatus" value="not_applicable" />
          </>
        )}
      </div>
    </details>
  );
}
