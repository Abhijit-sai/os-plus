import { notFound } from "next/navigation";

import { cancelTenantBillingRecordAction, createTenantBillingRecordAction, updateTenantAction, updateTenantBillingRecordAction } from "@/features/tenants/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireSuperAdminPageAccess } from "@/lib/auth/super-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TenantBillingPaymentStatus } from "@/types/database";

const paymentStatusLabels: Record<TenantBillingPaymentStatus, string> = {
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  waived: "Waived",
  cancelled: "Cancelled"
};

const gstTreatmentOptions = [
  { value: "not_applicable", label: "Not applicable" },
  { value: "taxable_exclusive", label: "GST added on top" },
  { value: "taxable_inclusive", label: "GST included in amount" },
  { value: "exempt_or_nil", label: "Exempt / nil rated" },
  { value: "non_gst", label: "Non-GST supply" }
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(amount);
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "Not set";
}

function getOutstanding(amountDue: number, amountPaid: number) {
  return Math.max(amountDue - amountPaid, 0);
}

export default async function TenantDetailPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requireSuperAdminPageAccess();

  const { tenantId } = await params;
  const supabase = createSupabaseServiceRoleClient();

  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("*").eq("id", tenantId).maybeSingle();

  if (tenantError) {
    throw new Error(`Unable to load tenant: ${tenantError.message}`);
  }

  if (!tenant) {
    notFound();
  }

  const { data: users, error: usersError } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  if (usersError) {
    throw new Error(`Unable to load tenant users: ${usersError.message}`);
  }

  const { data: billingRecords, error: billingError } = await supabase
    .from("tenant_billing_records")
    .select("*")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("billing_period_end", { ascending: false });

  if (billingError) {
    throw new Error(`Unable to load tenant billing records: ${billingError.message}`);
  }

  const activeBillingRecords = billingRecords ?? [];
  const latestBillingRecord = activeBillingRecords[0];
  const totalDue = activeBillingRecords.reduce((sum, record) => sum + Number(record.amount_due), 0);
  const totalPaid = activeBillingRecords.reduce((sum, record) => sum + Number(record.amount_paid), 0);
  const outstanding = Math.max(totalDue - totalPaid, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.name}</h1>
        <p className="text-muted-foreground">{tenant.store_name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenant profile</CardTitle>
          <CardDescription>{tenant.slug}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3 rounded-md border p-3">
            {tenant.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logo_url} alt={tenant.store_name} className="h-14 w-14 rounded-md object-cover" />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-md text-sm font-semibold text-white"
                style={{ backgroundColor: tenant.brand_color ?? "#2563eb" }}
              >
                {tenant.store_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="text-sm">
              <p className="font-medium">{tenant.store_name}</p>
              <p className="text-muted-foreground">Slug is fixed: {tenant.slug}</p>
            </div>
          </div>
          <form action={updateTenantAction} className="space-y-4">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name">Tenant name</Label>
                <Input id="name" name="name" defaultValue={tenant.name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="storeName">Store name</Label>
                <Input id="storeName" name="storeName" defaultValue={tenant.store_name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brandColor">Brand color</Label>
                <Input id="brandColor" name="brandColor" defaultValue={tenant.brand_color ?? "#2563eb"} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={tenant.status}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo">Logo</Label>
              <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
              <p className="text-xs text-muted-foreground">Optional. PNG, JPG, or WEBP up to 2 MB. Leave blank to keep the current logo.</p>
            </div>
            <div className="space-y-4 rounded-md border p-4">
              <div>
                <h3 className="font-medium">GST settings</h3>
                <p className="text-sm text-muted-foreground">Tenant-level defaults for accountant-handoff GST reporting.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="gstRegistered" type="checkbox" defaultChecked={tenant.gst_registered} className="h-4 w-4" />
                GST registered
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="legalName">Legal business name</Label>
                  <Input id="legalName" name="legalName" defaultValue={tenant.legal_name ?? ""} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input id="gstin" name="gstin" defaultValue={tenant.gstin ?? ""} placeholder="29ABCDE1234F1Z5" />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="registeredAddress">Registered address</Label>
                  <Input id="registeredAddress" name="registeredAddress" defaultValue={tenant.registered_address ?? ""} />
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
                    defaultValue={tenant.default_sales_gst_rate ?? 0}
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
                    defaultValue={tenant.default_purchase_gst_rate ?? 0}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="defaultOrderGstTreatment">Default order GST treatment</Label>
                  <select
                    id="defaultOrderGstTreatment"
                    name="defaultOrderGstTreatment"
                    defaultValue={tenant.default_order_gst_treatment ?? "not_applicable"}
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
                    defaultValue={tenant.default_expense_gst_treatment ?? "not_applicable"}
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
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <p className="text-muted-foreground">Created: {new Date(tenant.created_at).toLocaleString()}</p>
              <p className="text-muted-foreground">Updated: {new Date(tenant.updated_at).toLocaleString()}</p>
            </div>
            <Button type="submit">Save tenant</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tenant billing</CardTitle>
          <CardDescription>Manual OS PLUS subscription/payment tracking for this tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Latest status</p>
              <p className="font-medium">{latestBillingRecord ? paymentStatusLabels[latestBillingRecord.payment_status] : "No records"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Total due</p>
              <p className="font-medium">{formatCurrency(totalDue)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Total paid</p>
              <p className="font-medium">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground">Outstanding</p>
              <p className="font-medium">{formatCurrency(outstanding)}</p>
            </div>
          </div>
          <form action={createTenantBillingRecordAction} className="space-y-4 rounded-md border p-4">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <div>
              <h3 className="font-medium">Add billing record</h3>
              <p className="text-sm text-muted-foreground">Manual first. Reminders and automation stay later.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="billingPeriodStart">Period start</Label>
                <Input id="billingPeriodStart" name="billingPeriodStart" type="date" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="billingPeriodEnd">Period end</Label>
                <Input id="billingPeriodEnd" name="billingPeriodEnd" type="date" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="planName">Plan</Label>
                <Input id="planName" name="planName" placeholder="Pilot" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amountDue">Amount due</Label>
                <Input id="amountDue" name="amountDue" type="number" min="0" step="0.01" defaultValue="0" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amountPaid">Amount paid</Label>
                <Input id="amountPaid" name="amountPaid" type="number" min="0" step="0.01" defaultValue="0" required />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  Calculated from due, paid, and period end
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentDate">Payment date</Label>
                <Input id="paymentDate" name="paymentDate" type="date" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentMode">Payment mode</Label>
                <Input id="paymentMode" name="paymentMode" placeholder="UPI, bank transfer" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="referenceNumber">Reference</Label>
                <Input id="referenceNumber" name="referenceNumber" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Internal notes</Label>
              <Input id="notes" name="notes" />
            </div>
            <Button type="submit">Add billing record</Button>
          </form>
          <div className="space-y-3">
            {activeBillingRecords.map((record) => (
              <details key={record.id} className="rounded-md border p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {record.plan_name} · {paymentStatusLabels[record.payment_status]}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.billing_period_start)} to {formatDate(record.billing_period_end)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{formatCurrency(Number(record.amount_paid))} paid</p>
                      <p className="text-muted-foreground">{formatCurrency(getOutstanding(Number(record.amount_due), Number(record.amount_paid)))} outstanding</p>
                    </div>
                  </div>
                </summary>
                <div className="mt-4 space-y-4 border-t pt-4">
                  <form action={updateTenantBillingRecordAction} className="space-y-4">
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="billingRecordId" value={record.id} />
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="grid gap-2">
                        <Label htmlFor={`billingPeriodStart-${record.id}`}>Period start</Label>
                        <Input id={`billingPeriodStart-${record.id}`} name="billingPeriodStart" type="date" defaultValue={record.billing_period_start} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`billingPeriodEnd-${record.id}`}>Period end</Label>
                        <Input id={`billingPeriodEnd-${record.id}`} name="billingPeriodEnd" type="date" defaultValue={record.billing_period_end} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`planName-${record.id}`}>Plan</Label>
                        <Input id={`planName-${record.id}`} name="planName" defaultValue={record.plan_name} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`amountDue-${record.id}`}>Amount due</Label>
                        <Input id={`amountDue-${record.id}`} name="amountDue" type="number" min="0" step="0.01" defaultValue={record.amount_due} required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`amountPaid-${record.id}`}>Amount paid</Label>
                        <Input id={`amountPaid-${record.id}`} name="amountPaid" type="number" min="0" step="0.01" defaultValue={record.amount_paid} required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Status</Label>
                        <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                          {paymentStatusLabels[record.payment_status]} · calculated on save
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`paymentDate-${record.id}`}>Payment date</Label>
                        <Input id={`paymentDate-${record.id}`} name="paymentDate" type="date" defaultValue={record.payment_date ?? ""} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`paymentMode-${record.id}`}>Payment mode</Label>
                        <Input id={`paymentMode-${record.id}`} name="paymentMode" defaultValue={record.payment_mode ?? ""} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`referenceNumber-${record.id}`}>Reference</Label>
                        <Input id={`referenceNumber-${record.id}`} name="referenceNumber" defaultValue={record.reference_number ?? ""} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`notes-${record.id}`}>Internal notes</Label>
                      <Input id={`notes-${record.id}`} name="notes" defaultValue={record.notes ?? ""} />
                    </div>
                    <Button type="submit">Save billing record</Button>
                  </form>
                  <form action={cancelTenantBillingRecordAction}>
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input type="hidden" name="billingRecordId" value={record.id} />
                    <Button type="submit" variant="outline">
                      Cancel record
                    </Button>
                  </form>
                </div>
              </details>
            ))}
            {!activeBillingRecords.length ? <p className="text-sm text-muted-foreground">No billing records yet.</p> : null}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tenant users</CardTitle>
          <CardDescription>Clerk identities mapped to this tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {users?.map((user) => (
            <div key={user.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{user.clerk_user_id}</p>
              <p className="text-muted-foreground">
                {user.role} · {user.status}
              </p>
            </div>
          ))}
          {!users?.length ? <p className="text-sm text-muted-foreground">No tenant users yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
