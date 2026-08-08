"use client";

import { LoaderCircle } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";

import { createCustomerInlineAction } from "@/features/customers/actions";
import { normalizeIndianMobile } from "@/features/customers/phone";
import { useActionFeedback } from "@/components/ui/action-feedback-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type InlineCustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

type CustomerDraft = {
  address: string;
  email: string;
  gender: string;
  name: string;
  notes: string;
  phone: string;
};

const emptyDraft: CustomerDraft = {
  address: "",
  email: "",
  gender: "",
  name: "",
  notes: "",
  phone: "",
};

export function CreateCustomerDialog({
  customers,
  initialPhone = "",
  onCustomerResolved,
  trigger,
}: {
  customers: InlineCustomerOption[];
  initialPhone?: string;
  onCustomerResolved: (customer: InlineCustomerOption) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const feedback = useActionFeedback();
  const actionId = useId();
  const normalizedPhone = normalizeIndianMobile(draft.phone);
  const exactMatches = useMemo(
    () =>
      normalizedPhone
        ? customers.filter(
            (customer) =>
              normalizeIndianMobile(customer.phone) === normalizedPhone,
          )
        : [],
    [customers, normalizedPhone],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !open) {
      setDraft({ ...emptyDraft, phone: initialPhone });
      setDirty(false);
      setError(null);
    }

    setOpen(nextOpen);
  }

  function updateDraft(field: keyof CustomerDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setError(null);
  }

  function resolveCustomer(customer: InlineCustomerOption) {
    setDirty(false);
    onCustomerResolved(customer);
    setOpen(false);
  }

  function createCustomer() {
    if (!draft.name.trim()) {
      setError("Customer name is required.");
      return;
    }

    startTransition(async () => {
      feedback?.startAction(actionId, "Creating customer...");
      setError(null);

      try {
        const formData = new FormData();
        Object.entries(draft).forEach(([key, value]) => formData.set(key, value));
        const result = await createCustomerInlineAction(formData);
        resolveCustomer(result.customer);
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Unable to create customer. Please try again.",
        );
      } finally {
        feedback?.finishAction(actionId);
      }
    });
  }

  return (
    <Dialog
      title="Add customer"
      description="Create or select a customer without leaving this order draft."
      trigger={trigger}
      open={open}
      onOpenChange={handleOpenChange}
      preventClose={isPending}
      confirmClose={() =>
        !dirty || window.confirm("Discard this new customer draft?")
      }
    >
      {({ close }) => (
        <div className="space-y-4" data-unsaved-ignore="true">
          <div className="grid gap-2">
            <Label htmlFor="inlineCustomerName">Name</Label>
            <Input
              id="inlineCustomerName"
              value={draft.name}
              onChange={(event) => updateDraft("name", event.target.value)}
              placeholder="Customer name"
              disabled={isPending}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inlineCustomerPhone">Mobile number</Label>
            <Input
              id="inlineCustomerPhone"
              value={draft.phone}
              onChange={(event) => updateDraft("phone", event.target.value)}
              placeholder="Optional Indian mobile number"
              inputMode="tel"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Accepts 10 digits, a leading 0, +91, or 0091.
            </p>
          </div>
          {exactMatches.length ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Existing customer found</p>
              <p className="text-xs text-muted-foreground">
                Select the existing profile; a duplicate will not be created.
              </p>
              {exactMatches.map((customer) => (
                <Button
                  key={customer.id}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => resolveCustomer(customer)}
                  disabled={isPending}
                >
                  {customer.name} · {customer.phone}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="inlineCustomerEmail">Email</Label>
              <Input
                id="inlineCustomerEmail"
                type="email"
                value={draft.email}
                onChange={(event) => updateDraft("email", event.target.value)}
                placeholder="Optional"
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inlineCustomerGender">Gender</Label>
              <select
                id="inlineCustomerGender"
                value={draft.gender}
                onChange={(event) => updateDraft("gender", event.target.value)}
                className="h-10 rounded-md border bg-background px-3 text-sm"
                disabled={isPending}
              >
                <option value="">Not set</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="not_specified">Not specified</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inlineCustomerAddress">Address</Label>
            <Input
              id="inlineCustomerAddress"
              value={draft.address}
              onChange={(event) => updateDraft("address", event.target.value)}
              placeholder="Optional"
              disabled={isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inlineCustomerNotes">Notes</Label>
            <Input
              id="inlineCustomerNotes"
              value={draft.notes}
              onChange={(event) => updateDraft("notes", event.target.value)}
              placeholder="Optional"
              disabled={isPending}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={createCustomer} disabled={isPending} aria-busy={isPending || undefined}>
              {isPending ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Creating customer...
                </>
              ) : (
                "Create customer"
              )}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
