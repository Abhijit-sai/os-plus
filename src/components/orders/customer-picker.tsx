"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CreateCustomerDialog,
  type InlineCustomerOption,
} from "@/components/customers/create-customer-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomerOption = InlineCustomerOption;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function notifyCustomerSelection(customerId: string | null) {
  window.dispatchEvent(new CustomEvent("osplus:customer-selected", { detail: { customerId } }));
}

export function CustomerPicker({
  customers,
  selectedCustomerId,
  onCustomerChange
}: {
  customers: CustomerOption[];
  selectedCustomerId?: string;
  onCustomerChange?: (customerId: string | null) => void;
}) {
  const initialCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [query, setQuery] = useState(initialCustomer ? `${initialCustomer.name}${initialCustomer.phone ? ` · ${initialCustomer.phone}` : ""}` : "");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(initialCustomer);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trimmedQuery = normalize(query);
  const filteredCustomers = useMemo(() => {
    if (!trimmedQuery) {
      return customerOptions.slice(0, 8);
    }

    return customerOptions
      .filter((customer) => {
        const haystack = `${customer.name} ${customer.phone ?? ""}`.toLowerCase();
        return haystack.includes(trimmedQuery);
      })
      .slice(0, 8);
  }, [customerOptions, trimmedQuery]);

  function selectCustomer(customer: CustomerOption) {
    setCustomerOptions((current) =>
      current.some((option) => option.id === customer.id)
        ? current
        : [customer, ...current],
    );
    setSelectedCustomer(customer);
    setQuery(`${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}`);
    onCustomerChange?.(customer.id);
    inputRef.current?.setCustomValidity("");
    setIsOpen(false);
  }

  useEffect(() => {
    onCustomerChange?.(selectedCustomer?.id ?? null);
    notifyCustomerSelection(selectedCustomer?.id ?? null);
  }, [onCustomerChange, selectedCustomer]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;

    if (!input || !form) {
      return;
    }

    const customerInput = input;

    function handleSubmit(event: SubmitEvent) {
      if (!selectedCustomer) {
        event.preventDefault();
        customerInput.setCustomValidity("Select a customer from the matching results before creating the order.");
        customerInput.reportValidity();
        setIsOpen(true);
      }
    }

    form.addEventListener("submit", handleSubmit);

    return () => {
      form.removeEventListener("submit", handleSubmit);
    };
  }, [selectedCustomer]);

  return (
    <div className="relative grid gap-2">
      <Label htmlFor="customerSearch">Customer</Label>
      <input type="hidden" name="customerId" value={selectedCustomer?.id ?? ""} />
      <Input
        id="customerSearch"
        ref={inputRef}
        value={query}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          blurTimeoutRef.current = setTimeout(() => setIsOpen(false), 120);
        }}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          setQuery(event.target.value);
          setSelectedCustomer(null);
          onCustomerChange?.(null);
          setIsOpen(true);
        }}
        placeholder="Search by name or phone"
        autoComplete="off"
      />
      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-md border bg-background shadow-md">
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                if (blurTimeoutRef.current) {
                  clearTimeout(blurTimeoutRef.current);
                }
                selectCustomer(customer);
              }}
              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{customer.name}</span>
              <span className="text-xs text-muted-foreground">{customer.phone ?? "No phone"}</span>
            </button>
          ))}
          {!filteredCustomers.length ? (
            <div className="p-3 text-sm">
              <p className="text-muted-foreground">No customer found.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Select an existing customer or create one here.
        </p>
        <CreateCustomerDialog
          customers={customerOptions}
          initialPhone={query}
          onCustomerResolved={selectCustomer}
          trigger={
            <span className={buttonVariants({ variant: "outline", size: "sm" })}>
              Add customer
            </span>
          }
        />
      </div>
    </div>
  );
}
