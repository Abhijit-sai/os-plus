# OS PLUS GST, SaaS Billing, and Market Positioning Plan

## 1. Purpose

This document captures the next major planning direction after Production Hardening and Pilot Readiness:

- OS PLUS super-admin commercial control over tenants.
- Tenant-level GST configuration and GST-ready finance reporting.
- Public website positioning for workflow-driven businesses that are underserved by generic accounting and CRM tools.

This is a planning document, not an implementation confirmation. GST behavior must be reviewed with an Indian tax professional before OS PLUS claims statutory compliance or provides filing-ready output.

## 2. Market Positioning

### Core Position

OS PLUS is the operating system for businesses where work moves through people, stages, approvals, delays, and handoffs.

It is not positioned as another accounting package, CRM, helpdesk, or generic project board. The target customer has orders that must become finished work through a real-world workflow: tailoring, fabrication, repairs, custom manufacturing, print shops, studios, workshops, made-to-order production, and similar service-plus-production businesses.

### Problem With Existing Tools

Many small production-driven businesses try to run on combinations of:

- accounting tools such as Zoho Books, Tally, QuickBooks, or Vyapar,
- spreadsheets and WhatsApp,
- project tools such as Trello, Monday, ClickUp, or Notion,
- generic CRM/order tools,
- vertical tools that solve only one niche.

The gap is that accounting tools know money but not item-level production. Project tools know tasks but not customers, payments, workers, measurements, production stages, salary, or customer tracking. Generic ERPs are often too heavy for boutiques and small workshops.

### Differentiation

OS PLUS should be positioned around:

- order-to-production workflow as the core object model,
- item-level production visibility,
- tenant-configurable stages and statuses,
- practical finance and cashflow visibility,
- worker attendance, effort, salary suggestions, and advances,
- customer-safe tracking links,
- calm founder workflows instead of enterprise ERP complexity.

### Website Content Strategy

The public website should be conversion-driven and editorially strong. It should include a high-end landing page plus a growing blog library focused on founder pain points:

- "Why Zoho Books cannot run your production workflow"
- "How to track every custom order without drowning in WhatsApp"
- "The difference between order tracking and production control"
- "How boutiques can prevent delayed deliveries"
- "GST visibility for small production businesses"
- "Why item-level workflow matters more than order status"
- "How to build a calm daily operating rhythm for a workshop"

The website should feel like a premium, design-led SaaS brand, but the copy must stay grounded in business outcomes: fewer missed orders, clearer cashflow, less founder anxiety, and better delivery discipline.

## 3. Super-Admin Tenant Commercial Control

### Requirement

OS PLUS super-admins must be able to edit tenant details and status at any time. Slug remains immutable after tenant creation.

Super-admins should also track tenant payments/subscription status inside tenant configuration.

### Super-Admin Capabilities

- Edit mutable tenant details:
  - tenant name,
  - store name,
  - logo,
  - brand color,
  - status.
- Track tenant commercial details:
  - billing plan,
  - billing cycle,
  - subscription start date,
  - subscription renewal date,
  - amount due,
  - amount paid,
  - last payment date,
  - next due date,
  - internal payment notes.
- Mark a tenant inactive or suspended.
- View tenant payment history.
- Record tenant payment receipts.

### Tenant Inactive UX

When a tenant is inactive, its users must not see normal business data dashboards. They should see a calm locked-state page explaining that the business profile is inactive and they should contact OS PLUS support to reactivate access.

The message must not expose internal billing notes, payment disputes, or super-admin-only reasons.

Suggested copy:

```text
This business profile is currently inactive.

Please contact OS PLUS support to reactivate access. Your data has not been deleted.
```

### Tenant-Safety Rules

- Tenant status checks must happen server-side before loading tenant dashboards or tenant-owned data.
- Inactive/suspended tenants must not grant normal app access even when tenant membership is active.
- Public tracking behavior for inactive tenants must be decided before implementation. Default recommendation: show a safe unavailable/contact-store state rather than exposing operational data.
- Super-admin commercial tables are OS PLUS-owned, not tenant-owned user-editable records.

## 4. GST Product Scope

### Product Goal

Add GST readiness to OS PLUS finance without turning the MVP into a full accounting engine.

The product should help tenants:

- configure GST basics,
- capture GST treatment at order creation,
- capture GST treatment on expenses/vendor payments,
- understand output GST collected and input GST paid,
- generate period-based GST reports for review/download,
- reduce mistakes before handing data to their accountant or GST portal workflow.

### Compliance Boundary

OS PLUS should not initially claim to file GST returns directly. It should generate reviewable/downloadable reports.

Future integrations may include:

- GST portal upload-friendly exports,
- e-invoice/e-way bill integrations if required,
- Tally/Zoho Books export,
- GST reconciliation with GSTR-2B or purchase data.

## 5. GST Configuration

Tenant business profile/settings should include:

- GST registered toggle.
- GSTIN, optional unless GST registered is on.
- Legal business name.
- Registered business address.
- Default sales GST rate.
- Default purchase/expense GST rate.
- Allowed GST rate presets.
- Default GST treatment for order creation.
- Default GST treatment for expenses.

Recommended GST treatment enum:

```text
taxable_exclusive
taxable_inclusive
exempt_or_nil
non_gst
not_applicable
```

Recommended rate storage:

- store percentage as basis points or decimal-safe numeric,
- snapshot the selected GST rate on every order/payment/expense row,
- never rely only on the tenant default for historical reports.

## 6. Order GST Workflow

### Order Creation UX

The first section of order creation should include a simple GST treatment control:

- "GST applies to this order" toggle or segmented control.
- GST treatment:
  - GST added on top,
  - GST included in amount,
  - No GST / exempt / not applicable.
- GST rate dropdown defaulted from tenant configuration.
- Clear taxable amount, GST amount, and final total preview.

### Important Cash Rule

Payment mode and GST treatment are separate.

Cash collection does not automatically mean GST is not reportable. OS PLUS should record cash payments normally and use the explicit GST treatment to determine report/reporting classification.

### Calculation Rules

For GST-exclusive orders:

```text
taxable_amount = subtotal - discount
gst_amount = taxable_amount * gst_rate
total_amount = taxable_amount + gst_amount
```

For GST-inclusive orders:

```text
total_amount = entered_amount
taxable_amount = total_amount / (1 + gst_rate)
gst_amount = total_amount - taxable_amount
```

For non-GST/exempt/not-applicable orders:

```text
gst_amount = 0
total_amount = taxable_amount
```

### Order Detail UX

Order detail should show:

- taxable amount,
- GST rate,
- GST amount,
- total amount,
- whether GST was included or added,
- payment collection status,
- correction/edit history where needed.

## 7. Expense and Vendor Payment GST Workflow

### Expense Entry UX

Expense entry should ask for:

- vendor/supplier name,
- invoice number, optional,
- invoice date, optional,
- GSTIN of vendor, optional,
- GST treatment:
  - GST included in paid amount,
  - GST added separately,
  - no GST,
  - exempt/non-GST,
- GST rate,
- taxable amount,
  - GST amount,
  - total paid amount.

### Input GST

Expenses with GST should contribute to an "input GST paid" view only when marked as GST-bearing and reportable.

The app should support cases where GST appears on a vendor invoice but may not be claimable later. A later enhancement can add:

```text
itc_eligible
itc_blocked_reason
```

For the first slice, the report can separate:

- GST paid on expenses,
- GST marked claimable,
- GST marked not claimable or needs review.

## 8. GST Report Module

### Finance Tab View

Finance should add a GST view with date range filters:

- output GST from orders,
- input GST from expenses/vendor payments,
- net GST payable estimate,
- orders included in GST report,
- expenses included in GST report,
- records missing GST classification,
- records missing GSTIN/invoice details where relevant.

### Report Generation Guardrail

Before generating/downloading a GST report, OS PLUS must confirm tenant GST details:

- GSTIN,
- legal business name,
- registered address,
- reporting period,
- whether the tenant confirms the report is ready for accountant/GST review.

### Export

Initial exports:

- summary XLSX,
- order-wise GST collected sheet,
- expense-wise GST paid sheet,
- exceptions/review sheet.

Future exports:

- GST portal upload-friendly formats after exact filing workflow is confirmed,
- accountant handoff pack,
- Tally/Zoho-compatible export.

## 9. Suggested Database Additions

### tenants

Add tenant GST configuration fields:

```text
legal_name
registered_address
gst_registered
gstin
default_sales_gst_rate
default_purchase_gst_rate
default_order_gst_treatment
default_expense_gst_treatment
```

### tenant_gst_rates

Tenant-owned GST rate presets.

```text
id
tenant_id
name
rate_percent
is_default_sales
is_default_purchase
is_active
created_at
updated_at
created_by
updated_by
deleted_at
```

### orders

Add GST snapshots:

```text
gst_treatment
gst_rate_percent
taxable_amount
gst_amount
total_before_gst
total_amount
gst_reportable
gst_invoice_number
gst_invoice_date
```

### expenses

Add GST snapshots:

```text
vendor_gstin
vendor_invoice_number
vendor_invoice_date
gst_treatment
gst_rate_percent
taxable_amount
gst_amount
total_amount
gst_reportable
itc_eligible
itc_review_status
```

### tenant_billing_records

OS PLUS-owned commercial tracking for tenant subscription/payment history.

```text
id
tenant_id
billing_period_start
billing_period_end
plan_name
amount_due
amount_paid
payment_status
payment_date
payment_mode
reference_number
notes
created_at
updated_at
created_by
updated_by
deleted_at
```

Payment statuses:

```text
pending
partially_paid
paid
overdue
waived
cancelled
```

## 10. Implementation Sequence

### Slice 1: Documentation and GST UX Decisions

- Confirm GST treatment labels.
- Confirm rate presets.
- Confirm whether OS PLUS should support invoice numbering now or later.
- Confirm whether reports are accountant handoff only or GST portal upload-oriented.

### Slice 2: Tenant Commercial Control

- Add tenant billing records migration.
- Add super-admin billing/payment UI.
- Add inactive tenant locked-state UX.
- Add tenant status guard before tenant dashboard data loads.

### Slice 3: Tenant GST Configuration

- Add tenant GST fields and tenant GST rate presets.
- Add business profile GST settings.
- Add validation for GSTIN format when provided.

### Slice 4: Order GST Capture

- Add order GST fields.
- Update order creation calculations and previews.
- Snapshot GST treatment/rate/amount.
- Update order detail and finance calculations.

### Slice 5: Expense GST Capture

- Add expense GST fields.
- Update expense entry and expense list.
- Separate expense total from taxable and GST amount.

### Slice 6: GST Report

- Add Finance > GST view.
- Add date range filters.
- Add summary, order sheet, expense sheet, and review exceptions.
- Export XLSX.
- Confirm GSTIN/legal details before report generation.

### Slice 7: Public Website

- Research competing tools and refine positioning.
- Build premium landing page.
- Add blog/content architecture.
- Add conversion CTAs: book pilot, request workflow audit, see OS PLUS for your workshop.

## 11. Open Questions

1. Should GST be in the next pilot release, or after the pilot proves core workflow usage?
2. Should OS PLUS generate invoice numbers now, or only GST reports from existing order numbers?
3. Which GST rates should be available by default for the first Indian boutique pilot?
4. Should tenant subscription/payment tracking include automated reminders now, or only super-admin manual records?
5. Should inactive tenants block public tracking links immediately, or show a store-contact fallback?
