import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const gstTreatmentOptions = [
  { value: "not_applicable", label: "Not applicable" },
  { value: "taxable_exclusive", label: "GST added on top" },
  { value: "taxable_inclusive", label: "GST included in amount" },
  { value: "exempt_or_nil", label: "Exempt / nil rated" },
  { value: "non_gst", label: "Non-GST supply" }
];

type GstSettingsFieldsProps = {
  defaultExpenseGstTreatment?: string | null;
  defaultOpen?: boolean;
  defaultOrderGstTreatment?: string | null;
  defaultPurchaseGstRate?: number | string | null;
  defaultSalesGstRate?: number | string | null;
  gstRegistered?: boolean | null;
  gstin?: string | null;
  legalName?: string | null;
  registeredAddress?: string | null;
  summaryDescription: string;
};

export function GstSettingsFields({
  defaultExpenseGstTreatment,
  defaultOpen = false,
  defaultOrderGstTreatment,
  defaultPurchaseGstRate,
  defaultSalesGstRate,
  gstRegistered = false,
  gstin,
  legalName,
  registeredAddress,
  summaryDescription
}: GstSettingsFieldsProps) {
  return (
    <details className="rounded-md border bg-muted/10 p-4" open={defaultOpen || Boolean(gstRegistered)}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">GST settings</h3>
            <p className="text-sm text-muted-foreground">{summaryDescription}</p>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs font-medium">{gstRegistered ? "GST enabled" : "Optional"}</span>
        </div>
      </summary>
      <div className="mt-4 space-y-4 border-t pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input name="gstRegistered" type="checkbox" defaultChecked={Boolean(gstRegistered)} className="h-4 w-4" />
          GST registered
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="legalName">Legal business name</Label>
            <Input id="legalName" name="legalName" defaultValue={legalName ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gstin">GSTIN</Label>
            <Input id="gstin" name="gstin" defaultValue={gstin ?? ""} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="registeredAddress">Registered address</Label>
            <Input id="registeredAddress" name="registeredAddress" defaultValue={registeredAddress ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultSalesGstRate">Default sales GST %</Label>
            <Input
              id="defaultSalesGstRate"
              name="defaultSalesGstRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={defaultSalesGstRate ?? 0}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultPurchaseGstRate">Default purchase GST %</Label>
            <Input
              id="defaultPurchaseGstRate"
              name="defaultPurchaseGstRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={defaultPurchaseGstRate ?? 0}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultOrderGstTreatment">Default order GST treatment</Label>
            <select
              id="defaultOrderGstTreatment"
              name="defaultOrderGstTreatment"
              defaultValue={defaultOrderGstTreatment ?? "not_applicable"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {gstTreatmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="defaultExpenseGstTreatment">Default expense GST treatment</Label>
            <select
              id="defaultExpenseGstTreatment"
              name="defaultExpenseGstTreatment"
              defaultValue={defaultExpenseGstTreatment ?? "not_applicable"}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {gstTreatmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </details>
  );
}
