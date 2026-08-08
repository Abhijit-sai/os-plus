# OS PLUS V2 UPI Payment Intent Specification

## 1. Purpose

Provide a simple pre-Razorpay `Pay Now` experience on the public OS Plus tracking page.

The goal is to reduce random payment ambiguity by pre-filling tenant payment identity, transaction reference, order/invoice context and amount.

This is a **payment intent**, not automatic payment confirmation.

## 2. Important Trust Boundary

Launching a UPI intent or receiving a browser/app return does not prove that:

- payment succeeded;
- the exact amount was paid;
- payment settled to the tenant;
- the same transaction was not reused.

Until a trusted PSP/payment provider integration exists, staff must verify payment and record it in OS Plus.

Official Google Pay for India UPI integration guidance documents generic UPI deep-link parameters including payee address, payee name, transaction reference, transaction note, amount and currency. The same guidance tells merchants to verify the amount paid with their PSP/payment aggregator to prevent fraud.

Technical reference:

```text
https://developers.google.com/pay/india/api/android/in-app-payments
```

## 3. Tenant Configuration

Add tenant payment settings.

Required:

```text
UPI Enabled
UPI VPA
Payee Name
Show Pay Now on Tracking
```

Optional:

```text
Merchant Code
```

Example:

```text
UPI Enabled: Yes
VPA: fundry@bank
Payee Name: Fundry
Tracking Pay Now: Yes
```

The exact Fundry production VPA is tenant data and must not be hardcoded.

## 4. Payment Intent Object

Create one `payment_intents` record.

Example:

```text
Intent:
PI-...

Invoice:
INV-FY26-000281

Reference:
UPI-ORD-001281-X7K2

Amount:
₹1,240

Currency:
INR

Provider:
upi_intent

Status:
ACTIVE
```

## 5. Unique Transaction Reference

Do not use only:

```text
ORD-001281
```

as `tr`.

A customer may retry payment.

Use a unique Payment Intent reference.

Example:

```text
UPI-ORD-001281-X7K2
```

or a safe generated reference within UPI/PSP length constraints.

Persist the reference before showing the payment intent.

## 6. UPI URI

Conceptual URI:

```text
upi://pay
?pa=<VPA>
&pn=<PAYEE_NAME>
&tr=<UNIQUE_REFERENCE>
&tn=<ORDER_OR_INVOICE_NOTE>
&am=<PENDING_AMOUNT>
&cu=INR
```

Optional:

```text
mc=<MERCHANT_CODE>
```

Parameter intent:

```text
pa = payee VPA
pn = payee name
mc = merchant code, optional
tr = unique transaction reference
tn = transaction note/context
am = amount
cu = currency
```

Use proper URI encoding.

## 7. Transaction Note

The note should help later payment reconciliation.

Example:

```text
Fundry INV-FY26-000281 ORD-001281
```

Keep the note:

- customer-safe;
- concise;
- free of internal UUIDs;
- free of sensitive internal information.

## 8. Amount

Use:

```text
current pending invoice balance
```

at intent creation.

Example:

```text
Invoice Total: ₹1,500
Allocated: ₹500
Pending: ₹1,000

Payment Intent Amount: ₹1,000
```

Important:

The amount is **prefilled/intended**.

Do not claim in product requirements or UI that it is cryptographically uneditable across all UPI applications.

The merchant must verify actual payment evidence before recording payment.

## 9. Tracking Page UI

When enabled and balance > 0:

```text
Payment pending
₹1,240

[ PAY NOW ]

or scan

[ UPI QR ]
```

Below:

```text
Payment status may take time to update until the payment is verified.
```

Do not say:

```text
Payment successful
```

after the Pay Now link is opened.

## 10. Desktop and Mobile

### Mobile

`Pay Now` opens the UPI intent.

### Desktop

Show QR prominently.

The QR encodes the same UPI URI.

The page may still show Pay Now if supported by the browser/device.

## 11. Intent Lifecycle

Initial status:

```text
ACTIVE
```

Possible:

```text
EXPIRED
CANCELLED
CONSUMED
```

For V2 pre-provider mode:

- `ACTIVE`: shown/usable;
- `EXPIRED`: no longer shown if expiry is used;
- `CANCELLED`: invoice/payment context changed;
- `CONSUMED`: only after a verified/recorded payment mapping policy exists.

Do not set `CONSUMED` merely because the user clicked Pay Now.

## 12. Invoice Changes

If the Invoice pending amount changes:

- a previous active intent may be cancelled;
- create a new intent for the new pending balance.

Example:

```text
Old intent ₹1,240
Manual payment ₹500 recorded
New pending ₹740
```

The tracking page should not keep presenting the old ₹1,240 intent.

## 13. Manual Payment Confirmation

Finance/manager verifies actual receipt.

Then:

```text
CreatePayment
```

Capture:

- amount;
- payment mode = UPI;
- payment date;
- payer/reference if available;
- notes.

Then:

```text
AllocatePayment
```

to Invoice.

Invoice status updates from allocation.

The Payment Intent is supporting context.

It is not the Payment record itself.

## 14. Suspense Handling

Suppose tenant receives:

```text
₹1,240
Reference unclear
```

Finance can create:

```text
Payment
Reconciliation Status:
UNALLOCATED or NEEDS_REVIEW
```

Later allocate after verification.

This is preferable to falsely marking an Invoice paid.

## 15. Future Razorpay Upgrade

Later:

```text
OS Plus Invoice
  -> Razorpay Order/Payment Link
      -> customer pays
          -> verified webhook
              -> Create Payment
                  -> Allocate Payment
```

The public Tracking UI can continue to show:

```text
PAY NOW
```

while the provider adapter changes behind it.

This is why the public page should call a Payment Request/Intent abstraction, not directly embed Fundry-specific UPI string logic everywhere.

## 16. Security and Data Rules

1. VPA configuration is tenant-scoped.
2. Payment intent belongs to same tenant as Invoice.
3. Do not accept Invoice ID from public page without secure token/order context validation.
4. Generate URI server-side.
5. Do not expose internal database UUID in transaction note.
6. Use a unique reference.
7. Do not trust client-provided amount.
8. Recalculate pending amount server-side.
9. Do not mark paid from client callback.
10. Log intent creation and cancellation.

## 17. Tests

Automated:

```text
UPI-001 URI contains configured VPA
UPI-002 Payee name encoded
UPI-003 Unique reference generated
UPI-004 Note contains safe order/invoice context
UPI-005 Amount equals server-calculated pending balance
UPI-006 Currency = INR
UPI-007 Special characters URI encoded
UPI-008 Cross-tenant Invoice rejected
UPI-009 Old intent cancelled after balance change
UPI-010 Opening intent does not create Payment
```

Manual:

```text
UPI-011 Mobile Pay Now opens UPI selection/app in test environment
UPI-012 Desktop QR scans
UPI-013 QR and Pay Now resolve same intent values
UPI-014 Tracking page copy does not claim payment completed
UPI-015 After manual Payment allocation, pending balance updates
```

## 18. Acceptance Criteria

The pre-Razorpay flow is accepted when:

- tenant can configure VPA;
- unpaid Invoice can generate a server-side Payment Intent;
- public tracking shows Pay Now/QR;
- amount is prefilled from pending balance;
- unique reference and context are included;
- QR and CTA use the same URI;
- clicking/opening does not mark paid;
- manually verified payment can be recorded and allocated;
- tracking balance reflects the allocation.
