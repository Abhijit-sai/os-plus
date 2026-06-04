"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function createCustomerHref(query: string) {
  const trimmed = query.trim();

  if (!trimmed) {
    return "/customers/new";
  }

  const digits = trimmed.replace(/\D/g, "");
  const params = new URLSearchParams();

  if (digits.length >= 3) {
    params.set("phone", digits);
  }

  return params.size ? `/customers/new?${params.toString()}` : "/customers/new";
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
  const [query, setQuery] = useState(initialCustomer ? `${initialCustomer.name}${initialCustomer.phone ? ` · ${initialCustomer.phone}` : ""}` : "");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(initialCustomer);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trimmedQuery = normalize(query);
  const filteredCustomers = useMemo(() => {
    if (!trimmedQuery) {
      return customers.slice(0, 8);
    }

    return customers
      .filter((customer) => {
        const haystack = `${customer.name} ${customer.phone ?? ""}`.toLowerCase();
        return haystack.includes(trimmedQuery);
      })
      .slice(0, 8);
  }, [customers, trimmedQuery]);

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
                setSelectedCustomer(customer);
                setQuery(`${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}`);
                onCustomerChange?.(customer.id);
                inputRef.current?.setCustomValidity("");
                setIsOpen(false);
              }}
              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{customer.name}</span>
              <span className="text-xs text-muted-foreground">{customer.phone ?? "No phone"}</span>
            </button>
          ))}
          {!filteredCustomers.length ? (
            <div className="space-y-2 p-3 text-sm">
              <p className="text-muted-foreground">No customer found.</p>
              <Link href={createCustomerHref(query)} className="font-medium text-primary underline-offset-4 hover:underline">
                Create new customer
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
