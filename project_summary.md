# OS PLUS Project Summary

## 1. Product Context

OS PLUS is a multi-tenant, white-label WorkOS for boutiques and small manufacturing businesses.

The first use case is a fashion boutique. The product should later support other manufacturing-style businesses where orders move through multiple human-driven production stages.

OS PLUS helps business owners manage:

- Orders
- Customers
- Item-level production workflows
- Workers
- Attendance
- Work logs
- Salary suggestions
- Worker advances/loans
- Expenses
- Customer-facing order tracking
- Dashboards

## 2. Current MVP Scope

MVP includes:

- Multi-tenant SaaS foundation
- White-label tenant configuration
- Manual tenant creation by OS PLUS super admin
- Super-admin tenant status editing and planned tenant billing/payment tracking
- Clerk authentication
- Supabase Postgres database
- Supabase Storage for files
- Vercel deployment
- Role-based access
- Manual order entry
- Customer profiles
- Phone-based customer suggestions
- Item Type Master
- Workflow configuration
- Stage Master
- Workgroup configuration
- Worker master
- Item-level workflow tracking
- Stage start/pause/resume/complete
- Multiple workers per stage
- Attendance
- Work logs
- Salary suggestion
- Worker ledger for advances/loans
- Expenses
- GST configuration/reporting planned for the next finance hardening phase
- Partial payments
- Partial pickup/dispatch
- Customer tracking link
- Tenant-scoped transactional WhatsApp/email alert foundation
- Production and at-risk dashboard

## 3. Out of Scope for MVP

The following are not part of MVP:

- Shopify integration
- Campaign-style WhatsApp automation
- Bulk promotional marketing messages
- Direct GST filing/e-invoicing integration
- Inventory management
- QR/barcode scanning
- Vendor management
- Worker self-login
- Customer login
- Mobile app
- Advanced OCR
- Custom domains
- Tally/Zoho Books integration
- Bank reconciliation

## 4. Confirmed Core Decisions

### Business Model

- Build multi-tenant from day one.
- Build as a white-label SaaS/custom tool.
- Each boutique/business is a tenant.
- OS PLUS super admin manually creates each tenant in MVP.

### White-Label Setup

Each tenant should be able to configure:

- Store name
- Logo
- Brand color
- GST registration settings and default GST rates
- Tracking page branding
- WhatsApp sender later
- Domain/subdomain later

### Product Name

Working name: **OS PLUS**

### Order and Item Model

- Order is the commercial unit.
- Order item is the production unit.
- One order can have multiple items.
- Each item can have its own workflow.
- Each item can have its own expected completion date.
- Order has a promised delivery date.
- Item-level date and order-level date must be connected for at-risk visibility.
- Partial delivery/pickup must be supported.
- Order-level delivery type applies to all items unless overridden at item level.

### Customer Model

- Customer name is mandatory.
- Phone number is optional.
- Email is optional.
- Gender is optional.
- Customer duplicates are allowed in MVP.
- No no-duplicate restriction at customer level for now.
- When a phone number is entered, the system should suggest existing customers with matching/similar numbers.
- User can select an existing customer or continue creating a new one.
- Customer profile should exist from MVP.
- Customer profile should show order history and measurements.

### Measurements

MVP supports:

- Measurement notes
- Measurement photos
- Simple key-value measurement fields
- Item-type-linked measurement records

### Item Photos / Attachments

- Attachments should be allowed at item level and stage level.
- Measurement card photos should be supported.
- Design reference photos should be supported.
- In-progress photos should be supported.
- Final item photos should be supported.
- Each attachment should have customer-visible/internal-only flag.

### Workflow

- Workflow is selected at item level.
- MVP supports sequential workflows.
- Data model should allow parallel stages later.
- One stage can have multiple workers.
- Stage cannot start without assigning a worker.
- Worker selection should be restricted to allowed workgroups for that stage.
- Stage completion suggests next stage.
- Manager confirms movement to next stage.
- Every major workflow change creates item history.

### Inventory

- Inventory is not part of MVP.
- Finished goods inventory later.
- Raw material inventory later.

### QR/Barcode

- Not part of MVP.
- Plan later for item tags and scan-based updates.

### Attendance and Work Logs

- Attendance is separate from work logs.
- Attendance is manually marked by admin/manager in MVP.
- Excel import or attendance system integration can come later.
- Workers do not log in during MVP.
- Managers/admins log work on behalf of workers.

### Salary

- System suggests salary.
- Admin finalizes salary manually.
- Wage rules should support hourly, daily, weekly, monthly.
- Schema should allow per-piece and hybrid wage types later.
- Worker ledger for advances/loans is part of MVP.

### Finance

- GST configuration and GST-ready reporting are now planned as the next finance hardening area; direct GST filing/e-invoicing remains later.
- Track payments, expenses, receivables, payables, and reminders.
- Partial payments are essential.
- Vendor master is Phase 2 or later and low priority.

### Customer Communication

- Customer-facing statuses should be separate from internal workflow stages.
- Tenant-scoped transactional WhatsApp/email alerts are now planned as a controlled foundation.
- Each boutique should eventually use its own WhatsApp Business sender and email sender identity.
- The first communication slice should support templates, opt-in triggers, dry-run/sandbox queueing, message preview, and message logs before live sending.
- Campaign-style promotional messaging remains out of MVP.
- Tracking links can be included in messages, but messages must expose only customer-safe information.

### Shopify

- Shopify integration is Phase 2.
- MVP uses manual order entry.
- Later, imported Shopify orders should automatically create order items after SKU/item mapping.

### Dashboard Priority

First polished dashboard:

- Production and at-risk orders/items

Basic dashboards:

- Owner overview
- Worker productivity
- Finance summary

## 5. Tech Stack

Confirmed for now:

- Next.js
- TypeScript
- Clerk
- Supabase Postgres
- Supabase Storage
- Vercel
- Tailwind CSS
- shadcn/ui

To be finalized later:

- Charts: Recharts or Tremor
- Background jobs: Inngest / Trigger.dev / Supabase Edge Functions
- OCR: Google Vision / AWS Textract / Tesseract
- WhatsApp: Meta WhatsApp Cloud API

## 6. Core Data Rules

- Every tenant-owned table must include `tenant_id`.
- No data must leak across tenants.
- Use soft delete for important operational records.
- Order and item are separate entities.
- Workflow belongs to item, not order.
- Internal stages and customer-facing statuses are separate.
- Stage-to-worker assignment must respect workgroup mapping.
- Attendance and production work logs are separate.
- Customer tracking page must expose only safe customer-facing fields.

## 7. Current Build Phase

Current phase: Production hardening and market-readiness. Core MVP operating modules are now broad enough for a real boutique pilot, so the next priority is not new module expansion. The app should now focus on tenant access correctness, account switching, tenant isolation audits, role enforcement, QA coverage, deployment readiness, and pilot onboarding.

## 8. Completed

- Product concept defined
- MVP boundary defined
- Multi-tenant decision confirmed
- White-label decision confirmed
- Core roles confirmed
- Customer model corrected
- Workflow principles confirmed
- Salary/finance MVP scope confirmed
- Shopify/WhatsApp/inventory moved to later phases
- Phase 0 foundation scaffold started
- Next.js, TypeScript, Tailwind, Clerk, Supabase, shadcn/ui-style project files created
- Initial tenant and tenant user migration created
- Tenant app shell, sidebar, settings placeholder, dashboard placeholder, and super admin tenant pages scaffolded
- Dependencies installed and lockfile generated
- Next.js upgraded to 16.2.6 and Clerk upgraded to 7.3.5
- Typecheck, lint, and production build verified successfully
- Live tenant creation confirmed by user with tenant slug `phantom-threads`
- Configuration Engine foundation migration and tenant-scoped settings screens added
- Workflow configuration migration and basic sequential workflow builder added
- Worker Master migration and tenant-scoped worker creation UI added
- Customer Master and Measurements foundation migration added
- Tenant-scoped customer list, creation, detail, phone suggestion, and measurement UI added
- Order foundation migration added
- Tenant-scoped order list, creation, and detail pages added
- Manual order creation supports existing customer selection, item-level workflow selection, expected completion dates, and initial payment capture
- Order numbering correction added: OS PLUS order numbers are generated automatically and optional external/reference order IDs are stored separately
- Workflow Execution foundation migration added
- New order items now automatically get workflow and stage instances
- Basic production queue and item workflow pages added
- Stage start/complete actions added with worker workgroup validation and item history logging
- Production dashboard queue sections and summary counters added
- Attendance foundation migration added
- Daily attendance page added with active worker rows, status marking, check-in/out, hours, and notes
- Salary and Worker Ledger foundation migration added
- Tenant-scoped salary period creation and salary suggestion generation added
- Worker ledger entry creation added for advances, loans, deductions, repayments, adjustments, and salary payments
- Salary page added with period list, latest salary suggestions, and recent worker ledger
- Finance basics migration added
- Tenant-scoped expense entry and receivables/payables entry added
- Finance page added with recent collections, expenses, receivables, payables, and simple operational lists

## 9. In Progress

- Orders and workflow command-center live testing

## 10. Pending

- Production hardening phase:
  - Simplify tenant user status UI to `active` and `disabled` only for MVP.
  - Improve `/select-tenant` into a clear business selector for users linked to multiple tenants.
  - Add a top-right profile/account menu with current user, current business, role, switch business, and sign out.
  - Audit all routes, server actions, API routes, query helpers, public tracking, attachments, and communications for tenant isolation and permission correctness.
  - Create `docs/OS_PLUS_QA_Test_Matrix.xlsx` with multi-sheet QA coverage for tenant access, roles, isolation, and all operational modules.
  - Use Phantom Threads as the main test bed and create one clean new boutique profile for production-style onboarding.
- Test tenant app access with a real Clerk user mapped in `tenant_users`
- Apply customer migration `20260519150000_customer_master_measurements.sql`
- Test customer creation for Phantom Threads
- Test phone suggestion search with repeated/similar numbers
- Test measurement creation with item-type-linked key-value data
- Apply order migration `20260519170000_order_foundation.sql`
- Test manual order creation for Phantom Threads
- Test item-level workflow selection and payment status calculation
- Apply order numbering correction migration `20260519183000_order_reference_and_numbering.sql`
- Apply workflow execution migration `20260519193000_workflow_execution_foundation.sql`
- Test workflow initialization for existing order items created before the execution migration
- Test stage start with a worker mapped to an allowed workgroup
- Test stage completion and next-stage readiness
- Test production queue counts and sections after starting/completing item stages
- Apply attendance migration `20260519203000_attendance_foundation.sql`
- Test marking attendance for Phantom Threads workers
- Apply salary migration `20260520110000_salary_worker_ledger.sql`
- Test adding worker ledger entries for Phantom Threads workers
- Create a draft salary period and verify generated suggestions from wage type, attendance, work logs, and ledger entries
- Add review/finalize/paid controls later without turning MVP salary into statutory payroll
- Apply finance migration `20260520130000_finance_basics.sql`
- Test adding expenses with tenant payment modes and expense categories
- Test adding receivables/payables with optional order linkage
- Create GitHub repository
- Continue with Customer Tracking Page foundation after Finance basics is verified

## 11. Bugs / Issues

- npm audit reports 2 moderate findings from PostCSS bundled under Next.js. No high or critical findings remain. npm suggests a breaking downgrade to `next@9.3.3`, so no automated audit fix was applied.

## 12. Risks / Important Considerations

- Tenant isolation must be implemented correctly from day one.
- Workflow tables must not be overcomplicated but should allow future parallel stages.
- Salary module should remain suggested/admin-finalized, not full payroll.
- Finance module should not become a full accounting system in MVP.
- GST capture must be compliance-safe: cash payments are still recorded, and payment mode must not be treated as a way to hide taxable activity.
- Customer duplicates are allowed, so customer search/suggestion UX must be good.
- Customer tracking page must not expose internal operational details.

## 13. Future Considerations

- Shopify integration
- WhatsApp templates and status-triggered communication
- Inventory
- QR/barcode scan updates
- Vendor master
- Direct GST filing/e-invoicing
- Tally/Zoho Books
- Worker login
- Customer login
- Custom domains
- Advanced analytics

## 14. Session Update Template

Every development session should update this section.

### Date

YYYY-MM-DD

### Updated By

Name / AI agent / developer

### Phase

Current phase name

### What Was Built

- Item 1
- Item 2

### Key Decisions Made

- Decision 1
- Decision 2

### Files/Modules Changed

- File/module 1
- File/module 2

### Bugs Found

- Bug 1
- Bug 2

### Bugs Fixed

- Fix 1
- Fix 2

### Pending Tasks

- Task 1
- Task 2

### Blockers

- Blocker 1
- Blocker 2

### Notes for Next Session

- Note 1
- Note 2

## 15. Session Updates

## Session Update - 2026-06-04 - Tenant Logo Upload on Creation

### Date

2026-06-04

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Built

- Added optional logo upload to super-admin tenant creation.
- Added a public `tenant-assets` Supabase Storage bucket migration for tenant branding assets.
- Tenant creation validates logo uploads as PNG, JPG, or WEBP up to 2 MB.
- Tenant creation stores the uploaded logo public URL in `tenants.logo_url`.
- Tenant logos now render in the tenant app shell and business selector when present.

### Key Decisions Made

- Tenant logos are public branding assets because they are intended to appear on customer-facing tracking pages.
- Operational attachments remain private and continue to use authenticated download routes.

### Files/Modules Changed

- `supabase/migrations/20260604160000_tenant_assets_bucket.sql`
- `src/features/tenants/actions.ts`
- `src/app/(super-admin)/super-admin/tenants/new/page.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/select-tenant/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-05 - Tenant Billing Status Derivation

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Tenant Commercial Control

### Change Made

- Tenant billing record payment status is now derived server-side from:
  - amount due,
  - amount paid,
  - billing period end date.
- Normal statuses are calculated:
  - `paid` when amount paid covers amount due,
  - `partially_paid` when some amount is paid but balance remains,
  - `overdue` when no amount is paid and the period end is before today,
  - `pending` when no amount is paid and the period is not overdue.
- Manual status selection was removed from the billing UI to avoid contradictions.
- Billing cards now show outstanding amount instead of repeating total due as if it were pending.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-05 - GST Settings Progressive Disclosure

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### Change Made

- Moved tenant GST configuration fields behind a click-to-open disclosure on:
  - super-admin tenant creation,
  - super-admin existing tenant edit,
  - tenant owner/admin Business profile.
- Existing GST-registered tenants open the GST section by default so active GST configuration remains visible during edits.
- New/non-GST tenants show only a compact GST row until the user intentionally opens the settings.
- Extracted the repeated GST form fields into a shared `GstSettingsFields` component so super-admin and tenant owner/admin configuration stay consistent.

### UX Decision

- GST is important, but it should not dominate default profile/billing review screens. The default state now keeps founders and OS PLUS admins focused on business identity and payments first, with tax configuration available when needed.

### Files/Modules Changed

- `src/components/settings/gst-settings-fields.tsx`
- `src/app/(super-admin)/super-admin/tenants/new/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/app/(tenant)/settings/business-profile/page.tsx`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-05 - Order GST Capture First Slice

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Finance Hardening: GST Capture

### What Was Built

- Added order-level GST capture migration with:
  - `orders.gst_treatment`,
  - `orders.gst_rate`,
  - `orders.taxable_amount`,
  - `orders.gst_amount`.
- Added a compact order GST decision block to the first order creation section.
- Order GST defaults come from the current tenant's Business profile GST configuration.
- Server-side order creation now calculates:
  - GST-exclusive totals by adding GST on top,
  - GST-inclusive totals by backing GST out of the entered amount,
  - zero GST for exempt/nil, non-GST, and not-applicable treatments.
- Order detail now shows GST treatment, taxable amount, GST amount, and GST rate in the payment summary.
- Existing order numbers remain unchanged and continue to be the reporting reference for now.

### Tenant Safety

- Order GST defaults are read only from the current tenant context.
- Order writes remain tenant-scoped through `requireTenantContext()` and existing tenant-owned order validation.
- Existing orders default to `not_applicable` and zero GST, avoiding reinterpretation of historical commercial totals.

### Remaining GST Work

- Add expense/vendor GST capture.
- Add Finance > GST view.
- Add accountant-handoff XLSX export.
- Add final GST report confirmation flow for GSTIN, legal name, registered address, and reporting period.

### Files/Modules Changed

- `supabase/migrations/20260605120000_order_gst_capture.sql`
- `src/types/database.ts`
- `src/features/orders/actions.ts`
- `src/components/orders/order-gst-fields.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `docs/03_Tech_Development_Plan.md`
- `docs/08_Database_Model.md`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.

## Session Update - 2026-06-05 - Expense GST Capture First Slice

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Finance Hardening: GST Capture

### What Was Built

- Added expense-level GST capture migration with:
  - `expenses.vendor_gstin`,
  - `expenses.vendor_invoice_number`,
  - `expenses.vendor_invoice_date`,
  - `expenses.gst_treatment`,
  - `expenses.gst_rate`,
  - `expenses.taxable_amount`,
  - `expenses.gst_amount`,
  - `expenses.input_gst_status`.
- Added an opt-in Vendor invoice / GST disclosure to Add expense and Edit expense dialogs.
- Expense GST defaults come from the current tenant's Business profile purchase GST settings.
- Server-side finance actions now calculate GST-inclusive and GST-exclusive expense taxable/GST snapshots.
- Vendor GSTIN is optional, normalized to uppercase when present, and validated only when entered.

### Tenant Safety

- Expense reads and writes remain scoped to `requireTenantContext()`.
- Expense category and payment mode validation still confirms selected records belong to the current tenant.
- Existing expenses default to `not_applicable` and zero GST, avoiding reinterpretation of historical spend.

### Remaining GST Work

- Add Finance > GST report view.
- Add accountant-handoff XLSX export.
- Add GST report confirmation flow for GSTIN, legal name, registered address, and reporting period.

### Files/Modules Changed

- `supabase/migrations/20260605123000_expense_gst_capture.sql`
- `src/types/database.ts`
- `src/features/finance/actions.ts`
- `src/components/finance/expense-gst-fields.tsx`
- `src/app/(tenant)/finance/page.tsx`
- `docs/03_Tech_Development_Plan.md`
- `docs/08_Database_Model.md`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.

## Session Update - 2026-06-05 - Finance GST Report and XLSX Export

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Finance Hardening: GST Reporting

### What Was Built

- Added a Finance `GST` tab.
- Added tenant-scoped GST report query for the selected Finance date range.
- GST report view now shows:
  - output GST from orders,
  - claimable input GST from expenses,
  - estimated net GST payable,
  - input GST needing review,
  - taxable sales,
  - tenant GST profile confirmation,
  - output GST table,
  - input GST table,
  - review exceptions.
- Added `/api/finance/gst-report/export` authenticated export route.
- XLSX export includes:
  - Summary,
  - Output GST,
  - Input GST,
  - Review Exceptions.
- Added `exceljs` for server-side XLSX generation after rejecting `xlsx` because it introduced a high-severity audit finding.

### Tenant Safety

- GST report/export uses `requireTenantContext()` and `finance:view`.
- Export route accepts only period dates; it does not accept tenant IDs.
- Order, expense, and customer lookups are scoped to the current tenant.

### Remaining GST Work

- Browser QA with seeded orders/expenses after migrations are applied.
- Decide whether `needs_review` input GST should be excluded from net payable until accountant confirmation; current implementation excludes it from claimable input GST and surfaces it separately.
- Dedicated GST invoice numbering remains later.
- GST portal upload format remains later.

### Files/Modules Changed

- `package.json`
- `package-lock.json`
- `src/features/finance/queries.ts`
- `src/app/(tenant)/finance/page.tsx`
- `src/app/api/finance/gst-report/export/route.ts`
- `docs/03_Tech_Development_Plan.md`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high/critical findings.

### Audit Notes

- `npm audit` still reports moderate findings from Next/PostCSS and `exceljs`/`uuid`.
- Suggested fixes require breaking downgrades (`next@9.3.3` or `exceljs@3.4.0`), so no automated audit fix was applied.

## Session Update - 2026-06-05 - Order Value GST UX and GST Report Inclusion Toggle

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Finance Hardening: GST UX Correction

### What Was Changed

- Removed GST controls from the first Order details section.
- Added a dedicated `Total order value` section after Order items and before Initial payment.
- The new section shows live item subtotal, item discounts, GST, and order total before payment entry.
- GST decision now happens with order value context, before recording payment.
- Added a Finance > GST report toggle:
  - `GST only`,
  - `Include non-GST`.
- The GST inclusion mode controls both on-screen report rows and XLSX export rows.

### Key Decisions

- Staff should decide GST only after seeing the constructed order value.
- GST report defaults to GST-bearing transactions so aggregates stay clean.
- Non-GST/exempt/not-applicable rows are still available for audit context through an explicit toggle.

### Files/Modules Changed

- `src/components/orders/order-gst-fields.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/features/finance/queries.ts`
- `src/app/(tenant)/finance/page.tsx`
- `src/app/api/finance/gst-report/export/route.ts`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-05 - Post-Deployment Roadmap: Tenant Billing, GST, and Public Website

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Post-Deployment Planning

### Decisions Added

- OS PLUS is live on Vercel and connected to GitHub.
- Super-admin tenant management must include editing mutable tenant details and changing tenant status at any time.
- Super-admin tenant configuration should include OS PLUS billing/payment tracking for each tenant.
- Inactive/suspended tenants should see a calm contact-support locked state instead of the normal dashboard.
- GST configuration and GST-ready reporting move into the near finance roadmap.
- Direct GST filing/e-invoicing/accounting integrations remain later.
- The public website should position OS PLUS as the operating system for workflow-driven businesses, not as generic accounting, CRM, or project management software.

### GST Planning Notes

- Tenant settings should capture GST registered status, optional GSTIN, legal name, registered address, default sales GST rate, default purchase GST rate, and default GST treatment.
- Order creation should support GST added on top, GST included in amount, exempt/nil/non-GST, and not-applicable treatments.
- Expense entry should capture vendor invoice/GST details, GST treatment, taxable amount, GST amount, and input GST review state.
- Cash payment mode must remain separate from GST treatment; OS PLUS should record cash collections and must not treat cash as automatically non-reportable.
- Finance should add a GST view for output GST, input GST, estimated net GST payable, review exceptions, and XLSX export.
- GST report generation must confirm tenant GSTIN, legal name, registered address, and reporting period before export.
- First GST reports are accountant-handoff XLSX only.
- Existing order numbers remain the GST report reference for now; dedicated GST invoice numbering is later.
- Tenant billing/payment tracking starts as manual super-admin recordkeeping; reminders and automation are later.

### Files/Docs Changed

- `docs/12_GST_SaaS_Billing_and_Market_Positioning.md`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/08_Database_Model.md`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Next Recommended Sequence

1. Finish production smoke QA on the deployed app.
2. Implement tenant inactive/suspended locked-state and super-admin tenant billing records.
3. Implement tenant GST settings and GST rate presets.
4. Implement order GST capture.
5. Implement expense GST capture.
6. Implement Finance > GST report and export.
7. Build the public marketing site and blog engine after the operational finance plan is locked.

## Session Update - 2026-06-05 - Tenant Billing and Inactive Tenant Lockout

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Tenant Commercial Control

### What Was Built

- Added `tenant_billing_records` migration for manual OS PLUS tenant subscription/payment tracking.
- Added typed `TenantBillingRecord` and `TenantBillingPaymentStatus` models.
- Added super-admin server actions to:
  - create tenant billing records,
  - update tenant billing records,
  - cancel billing records through soft delete.
- Added super-admin tenant detail billing UI:
  - latest billing status,
  - total due,
  - total paid,
  - outstanding,
  - add billing record form,
  - per-record edit and cancel controls.
- Added `/inactive-tenant` locked-state page for users whose tenant is inactive or suspended.
- Updated tenant context resolution so inactive/suspended tenants do not fall through to a misleading no-tenant state.
- Updated `/select-tenant` to redirect inactive-only users to `/inactive-tenant`.

### Tenant-Safety Notes

- Tenant billing records are OS PLUS-owned and only managed through super-admin guarded server actions.
- Tenant users do not see billing notes, payment references, or internal commercial details.
- Inactive/suspended tenant users see only a safe contact-support message.
- Existing active tenant selection behavior is preserved for users with one or more active memberships.

### Files/Modules Changed

- `supabase/migrations/20260605100000_tenant_billing_records.sql`
- `src/types/database.ts`
- `src/features/tenants/actions.ts`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/lib/tenant/context.ts`
- `src/app/inactive-tenant/page.tsx`
- `src/app/select-tenant/page.tsx`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending

- Apply `supabase/migrations/20260605100000_tenant_billing_records.sql` to live Supabase before using tenant billing in production.
- Manual browser QA with a real Clerk super-admin session: add/edit/cancel a billing record and mark a tenant inactive/suspended.

## Session Update - 2026-06-05 - GST Tenant Configuration UI and Form Warning Fix

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Tenant Commercial Control / GST Readiness

### User Feedback

- GST configuration was not visible in the super-admin tenant pages.
- Existing tenant edit was not obvious from the tenant list.
- Next.js/React logged a console warning because server-action forms explicitly specified `encType`.

### What Was Built

- Added tenant GST configuration migration:
  - `tenants.legal_name`
  - `tenants.registered_address`
  - `tenants.gst_registered`
  - `tenants.gstin`
  - `tenants.default_sales_gst_rate`
  - `tenants.default_purchase_gst_rate`
  - `tenants.default_order_gst_treatment`
  - `tenants.default_expense_gst_treatment`
  - `tenant_gst_rates` preset table
- Added GST settings to super-admin tenant creation.
- Added GST settings to super-admin existing tenant edit.
- Added GST settings to tenant owner/admin Business profile.
- Added explicit `Edit tenant` button on the super-admin tenant list.
- Removed explicit `encType` from server-action forms so React/Next controls multipart form handling automatically.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending

- Apply `supabase/migrations/20260605110000_tenant_gst_configuration.sql` to live Supabase before saving GST settings in production.
- Manual QA: create/edit tenant GST settings as super-admin, then edit the same GST settings as tenant owner/admin.

## Session Update - 2026-06-05 - GSTIN Conditional Validation Fix

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

GST Readiness Bug Fix

### Bug Fixed

- Tenant save could throw a Zod regex error when the GSTIN field contained an invalid value even if `GST registered` was not checked.
- GSTIN is now normalized and validated only when GST registered is checked.
- When GST registered is off, GSTIN is saved as `null` so ordinary tenant edits are not blocked.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-04 - Tenant Profile Editing Hardening

### Date

2026-06-04

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Built

- Added shared tenant logo upload helpers for the public `tenant-assets` bucket.
- Super-admins can now edit existing tenant mutable profile fields:
  - tenant name,
  - store name,
  - brand color,
  - status,
  - optional logo replacement.
- Tenant slug remains fixed/read-only after creation.
- Tenant owners/admins can now update their own business profile:
  - business name,
  - store name,
  - brand color,
  - optional logo replacement.
- Tenant logo rendering is supported in the app shell and business selector.

### Tenant-Safety Notes

- Super-admin tenant editing is still protected by the super-admin allowlist page guard and server action guard.
- Tenant owner/admin business profile editing still requires active tenant context plus `settings:manage`.
- Tenant owners/admins cannot edit slug, tenant status, or cross-tenant records from the business profile page.
- Logo uploads are constrained to PNG/JPG/WEBP up to 2 MB.

### Files/Modules Changed

- `src/lib/tenant/assets.ts`
- `src/features/tenants/actions.ts`
- `src/features/settings/actions.ts`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/app/(tenant)/settings/business-profile/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/new/page.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/select-tenant/page.tsx`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `20260604160000_tenant_assets_bucket.sql` in the active Supabase environment before testing logo upload there.
- Authenticated super-admin browser QA for creating a tenant with and without a logo.

## Session Update - 2026-06-04 - Production Hardening Implementation Slice

### Date

2026-06-04

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Built

- Cleaned tenant user status UX so tenant owner/admin workflows expose only Active and Disabled.
- Improved `/select-tenant` into a business selector with signed-in email, business name, active access state, and role.
- Added a top-right account/profile menu in the tenant app shell with current user, current business, role, Switch business, and Sign out.
- Created `docs/OS_PLUS_QA_Test_Matrix.xlsx` with 14 QA sheets covering tenant access, roles, tenant isolation, operational modules, public tracking, communications, attachments, and deployment smoke checks.
- Added a reproducible workbook builder at `scripts/build-qa-matrix.mjs`.

### Tenant Isolation Audit Notes

- Confirmed current feature query/action modules resolve tenant context and use tenant-scoped access patterns.
- Confirmed attachment download validates current tenant before issuing signed URLs.
- Confirmed communications actions validate tenant context, safe template variables, tenant-owned templates/rules, order ownership, and customer ownership.
- Confirmed tenant-owned tables in current migrations include `tenant_id`.
- Found and fixed a high-risk public tracking issue: public tracking was loading internal workflow stage instances and stage master names. Public tracking now uses only customer-safe order, item, item type, and customer-facing status data.

### Files/Modules Changed

- `src/lib/auth/super-admin.ts`
- `src/lib/tenant/context.ts`
- `src/components/layout/app-shell.tsx`
- `src/app/select-tenant/page.tsx`
- `src/app/(tenant)/settings/users/page.tsx`
- `src/features/tenant-users/actions.ts`
- `src/features/tracking/queries.ts`
- `src/app/(public)/track/[trackingToken]/page.tsx`
- `scripts/build-qa-matrix.mjs`
- `docs/OS_PLUS_QA_Test_Matrix.xlsx`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Bugs Fixed

- Public tracking no longer fetches or derives status from internal workflow stage data.
- Tenant user create/update actions no longer accept `invited` from the tenant owner/admin UI path.
- Super-admin UI now fails closed for non-allowlisted users and no longer appears as a public home-page entry point.

### Pending Tasks

- Run authenticated browser QA with real Clerk OTP/test configuration after approval.
- Use Phantom Threads and one clean new boutique tenant for the pilot onboarding rehearsal.
- Continue focused tenant isolation tests against ID-based routes and mutation attempts.

### Verification

- QA workbook was generated and inspected; all 14 requested sheets are present.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-04 - Production Hardening and Pilot Readiness Plan

### Date

2026-06-04

### Updated By

Codex AI agent

### Phase

Production Hardening and Market Readiness

### User Feedback

- The current OS PLUS module set is broad enough, possibly slightly overbuilt, for a boutique or small production facility to begin using.
- The next priority should be hardening, not more feature expansion.
- Tenant safety must be strict: nothing from one tenant should appear in another tenant's workspace.
- A signed-in user can belong to multiple businesses with different roles.
- Tenant owners/admins should create internal users by email.
- Tenant user statuses should be simplified to active/disabled for MVP.
- Testing must become a formal part of the next phase, including a multi-sheet Excel QA workbook.
- Phantom Threads should remain the test bed, and a clean new boutique tenant should be created for production-style onboarding.

### Key Decisions Made

- Keep OS PLUS-owned tenant memberships and roles; do not migrate to Clerk Organizations for MVP.
- Clerk remains responsible for identity and verified sign-in.
- OS PLUS remains responsible for tenant membership, tenant role, active/disabled status, and tenant selection.
- Pause large module expansion until tenant access, isolation, QA, and deployment hardening are complete.

### Next Implementation Priorities

- Improve `/select-tenant` into a clear business selector.
- Add a top-right account/profile menu with current user, current business, role, switch business, and sign out.
- Simplify tenant user status UI to active/disabled.
- Audit tenant isolation across routes, server actions, API routes, query helpers, public tracking, attachments, and communications.
- Fix high-risk tenant isolation or permission gaps immediately.
- Create `docs/OS_PLUS_QA_Test_Matrix.xlsx` with multiple sheets covering tenant access, roles, isolation, and every operational module.
- Run typecheck, lint, build, smoke checks, and authenticated/manual QA where Clerk OTP is required.

### Files/Modules Changed

- `project_summary.md`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/05_Project_Summary.md`

### Notes for Next Session

- Start from production hardening, not feature ideation.
- Treat root `project_summary.md` as authoritative.
- Use example.com addresses for fixture data only; real Clerk OTP tests need real reachable emails or Clerk test configuration.

## Session Update - 2026-06-01 - Email-First Tenant User Access Correction

### Date

2026-06-01

### Updated By

Codex AI agent

### Phase

Multi-Tenant Access Hardening

### User Feedback

- Tenant owners should not enter Clerk user IDs.
- Tenant owner/admin should add another internal user's email address, assign a role, and control active/disabled status.
- The invited/internal user should get portal access only after signing in through Clerk with that verified email and only while the OS PLUS tenant membership is active.

### What Was Built

- Changed tenant user management to email-first:
  - required email,
  - optional display name,
  - role,
  - status.
- Removed Clerk user ID from the tenant owner/admin add/edit user UI.
- Removed Clerk user ID from super-admin tenant creation; the first owner/admin can now be pre-authorized by email.
- Made `tenant_users.clerk_user_id` nullable so pre-authorized email memberships can exist before first sign-in.
- Added an internal email-linking flow in tenant context resolution:
  - Clerk verifies the signed-in user's identity/email,
  - OS PLUS looks for an active tenant membership with that email and no linked Clerk ID,
  - OS PLUS links that row to the Clerk user ID internally,
  - tenant access is granted only for active memberships.
- Kept authenticated tenant context typed as a linked Clerk membership so operational modules still have a stable actor ID for audit fields.
- Added tenant/email uniqueness for non-disabled tenant users.

### Key Decisions Made

- Clerk IDs are internal technical identifiers and should not be entered or understood by tenant owners.
- Clerk handles authentication and email verification.
- OS PLUS controls tenant membership, role, status, and tenant selection.
- `active` means the user can access the tenant after verified Clerk sign-in; `disabled` blocks access even if the Clerk account exists.
- Public/customer-facing surfaces remain unaffected.

### Files/Modules Changed

- `supabase/migrations/20260601103000_email_first_tenant_users.sql`
- `src/types/database.ts`
- `src/lib/auth/super-admin.ts`
- `src/lib/tenant/context.ts`
- `src/features/tenant-users/actions.ts`
- `src/features/tenants/actions.ts`
- `src/app/(tenant)/settings/users/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/new/page.tsx`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply migration `20260601103000_email_first_tenant_users.sql` in Supabase.
- Authenticated browser QA for adding a tenant user by email, first sign-in linking, tenant selection, and disabled-status blocking.

### Follow-up Fix - 2026-06-02

- Fixed email-first tenant access linking when a Clerk user already has an active membership for the same tenant.
- The linker now skips email-preauthorized rows for tenants where the signed-in Clerk user is already linked, preventing duplicate `(tenant_id, clerk_user_id)` violations.
- The fix is non-destructive: it does not delete or rewrite duplicate/legacy tenant user rows; tenant admins can disable redundant rows from Users and roles.

## Session Update - 2026-06-01 - Tenant User Roles and Tenant Selection Hardening

### Date

2026-06-01

### Updated By

Codex AI agent

### Phase

Multi-Tenant Access Hardening

### User Feedback

- OS PLUS needs clearer tenant-owner-controlled internal profiles.
- The platform super admin should remain separate from tenant owner/admin.
- Tenant owner/admin should be able to add internal Clerk-backed profiles and assign module-based roles.
- Project manager users should access orders, production, customers, and attendance.
- Finance users should access salary and finance.
- Tenant owner/admin should access all tenant modules.

### What Was Built

- Added tenant user profile fields migration:
  - `tenant_users.display_name`
  - `tenant_users.email`
  - `tenant_users.updated_by`
- Tightened role permissions:
  - `owner_admin`: all tenant modules, settings, tenant users.
  - `manager`: orders, production, customers, attendance.
  - `finance`: salary and finance.
  - `viewer`: dashboard/reports only.
- Reworked tenant context resolution so multi-tenant Clerk users require explicit tenant selection instead of silently using the first active membership.
- Added selected tenant cookie `os_plus_selected_tenant_id`.
- Added `/select-tenant` workspace chooser for Clerk users with multiple active tenant memberships.
- Added tenant-user management actions:
  - add tenant user,
  - update tenant user profile label/email,
  - change role,
  - change membership status.
- Added guardrail that prevents removing/demoting/disabling the last active owner/admin for a tenant.
- Added `/settings/users` for owner/admin-managed internal user profiles and role assignment.
- Added Settings overview card for Users and roles.

### Key Decisions Made

- Clerk remains the identity provider. OS PLUS owns tenant memberships, roles, and statuses.
- Tenant owners should add tenant users by email, not by Clerk user ID.
- This slice does not implement outbound invitation email; access is linked when the user signs in with the matching verified Clerk email.
- Super admin remains env-controlled and separate from tenant owner/admin permissions.
- Explicit tenant selection is required only when a Clerk user has multiple active tenant memberships.

### Files/Modules Changed

- `supabase/migrations/20260601090000_tenant_user_profile_fields.sql`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/lib/tenant/context.ts`
- `src/features/tenant-users/actions.ts`
- `src/features/tenant-users/queries.ts`
- `src/app/select-tenant/page.tsx`
- `src/app/page.tsx`
- `src/app/(super-admin)/layout.tsx`
- `src/app/(super-admin)/super-admin/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/new/page.tsx`
- `src/app/(tenant)/settings/users/page.tsx`
- `src/features/settings/queries.ts`
- `src/app/(tenant)/settings/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local HTTP smoke checks returned 200 for `/select-tenant`, `/settings/users`, and `/settings`.

### Pending Tasks

- Apply migration `20260601090000_tenant_user_profile_fields.sql` in Supabase.
- Apply migration `20260601103000_email_first_tenant_users.sql` in Supabase.
- Authenticated browser QA for `/select-tenant` using a Clerk user with multiple tenant memberships.
- Authenticated browser QA for `/settings/users` add/edit role/status flows.
- Decide later whether to integrate Clerk invite APIs, or keep tenant user mapping manual for MVP onboarding.

## Session Update - 2026-05-30 - Communications Control Polish

### Date

2026-05-30

### Updated By

Codex AI agent

### Phase

Transactional Communications Dry-Run Control Polish

### What Was Built

- Added tenant-safe update/archive actions for communication templates.
- Added tenant-safe update/archive actions for communication trigger rules.
- Archiving a template now soft-deletes the template, marks it inactive, and disables active trigger rules that reference it.
- Archiving a trigger rule now soft-deletes the rule and disables it.
- `/settings/communications` now supports edit/archive dialogs for templates and trigger rules.
- Trigger rule creation/editing now requires active templates.
- Order detail now loads recent tenant-scoped communication queue records for the order.
- Order detail customer message panel now shows recent message history so staff can see prior dry-run tracking links and payment reminders before queueing another one.

### Key Decisions Made

- Keep communications in dry-run mode; no provider integration, background jobs, scheduled reminders, or live sends were added.
- Keep settings review-first, with edit/archive forms behind dialogs.
- Preserve auditability by soft-deleting settings records instead of removing message history or queue records.

### Files/Modules Changed

- `src/features/communications/actions.ts`
- `src/app/(tenant)/settings/communications/page.tsx`
- `src/features/orders/queries.ts`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local HTTP smoke checks returned 200 for `/settings/communications` and `/orders`.

### Pending Tasks

- Authenticated browser QA for editing/archiving templates and trigger rules.
- Authenticated browser QA for order-level message history after queueing dry-run messages.
- Add sandbox lifecycle controls for queued messages later, such as cancel/mark failed/mark sent, before live provider adapters.

### Follow-up Fix

- Fixed `upsertCommunicationChannelSettingAction` optional text parsing so omitted optional fields such as `replyTo` are treated as empty optional values instead of throwing a Zod invalid-type runtime error.
- Re-ran `npm run typecheck`, `npm run lint`, and `npm run build`; all passed.

## Session Update - 2026-05-29 - Transactional Communications Planning and Foundation

### Date

2026-05-29

### Updated By

Codex AI agent

### Phase

Tenant-Safe Communications Foundation

### User Feedback

- Automated WhatsApp and email transaction alerts are needed for customer order updates and payment reminders.
- Messages may be tied to specific order/customer-facing statuses, payment events, or payment reminder rules.
- The design must handle multiple tenants, tenant-specific customers, phone numbers, email addresses, and sender configuration safely.

### What Was Built

- Updated the PRD to include tenant-scoped transactional WhatsApp/email alert foundations in MVP scope.
- Kept campaign-style promotional WhatsApp automation and bulk marketing messages out of MVP.
- Added a Transactional Communications module spec covering channels, triggers, templates, tenant safety, logs, retries, and UX principles.
- Updated the WBS with communication foundation, templates, trigger rules, staff UX, provider integration, and safety QA tasks.
- Updated the technical development plan with Phase 10A for provider-neutral communications foundation and dry-run/sandbox queueing before live sends.
- Updated the database model with communication channel settings, templates, trigger rules, message queue, and message logs.
- Added the communications foundation Supabase migration.
- Added TypeScript database types for communication settings, templates, trigger rules, queue records, and message logs.

### Key Decisions Made

- The next communications slice should be provider-neutral and dry-run capable before live WhatsApp/email delivery.
- Every communication table is tenant-owned and includes `tenant_id`.
- A message can only be queued for a customer/order/payment entity after server-side validation that the entity belongs to the current tenant.
- Templates may only render customer-safe variables such as store name, customer name, order number, promised date, customer-facing status, pending balance, and tracking link.
- Templates must never expose measurements, worker names, internal notes, salary, or internal attachments.
- Live sending should require explicit tenant channel configuration and a background worker/provider adapter.

### Files/Modules Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/06_Rules.md`
- `docs/08_Database_Model.md`
- `supabase/migrations/20260529120000_communications_foundation.sql`
- `src/types/database.ts`
- `project_summary.md`

### Pending Tasks

- Apply the new communications migration in the active Supabase environment.
- Build `src/features/communications` with safe template rendering, tenant-scoped queue helpers, and dry-run provider adapter.
- Add Settings > Communications UI for channel setup, templates, triggers, recent sends, failures, and queued reminders.
- Add manual order detail actions for preview/send tracking link and payment reminder.
- Select a background job runner before enabling live sends.

### Tenant-Safety Notes

- Communication settings, templates, trigger rules, queue, and logs are all tenant-scoped.
- Customer phone/email data remains tenant-owned through the existing `customers.tenant_id` boundary.
- Public tracking links may be sent, but public tracking remains token-based and customer-safe.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Follow-up Fix

- Hardened `20260529120000_communications_foundation.sql` for manual reruns by dropping existing communication updated-at triggers before recreating them.
- Verified the reported `,;` malformed SQL pattern is not present in the checked-in migration.
- Re-ran `npm run typecheck`, `npm run lint`, and `npm run build`; all passed.

### Date

2026-05-30

### Updated By

Codex AI agent

### Phase

Transactional Communications Dry-Run Foundation

### What Was Built

- Added `src/features/communications` with tenant-scoped settings queries, server actions, safe template rendering, and default dry-run templates.
- Added Settings > Communications at `/settings/communications`.
- Added channel setup for WhatsApp and email in disabled/sandbox modes.
- Added tenant-owned communication template creation with safe variable validation.
- Added tenant-owned trigger rule creation for future automated order/payment events.
- Added recent dry-run message and audit log visibility.
- Added order detail customer message actions for dry-run tracking link and payment reminder queueing.
- Manual message queueing validates:
  - current tenant context,
  - `orders:manage` permission,
  - order belongs to tenant,
  - customer belongs to tenant,
  - selected channel has the required phone/email contact.
- Live sending is explicitly blocked in this slice; queued messages are audit records only.

### Key Decisions Made

- Build dry-run queueing before live WhatsApp/email integration.
- Keep status-trigger automation configuration centralized under Settings > Communications.
- Use only safe customer-facing template variables.
- Do not expose measurements, worker names, internal notes, salary, or internal attachments in customer messages.

### Files/Modules Changed

- `src/features/communications/actions.ts`
- `src/features/communications/queries.ts`
- `src/features/communications/rendering.ts`
- `src/components/communications/order-message-dialog.tsx`
- `src/app/(tenant)/settings/communications/page.tsx`
- `src/app/(tenant)/settings/page.tsx`
- `src/features/settings/queries.ts`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local HTTP smoke checks returned 200 for `/settings/communications` and `/orders`.
- `git status` could not run because `D:\Develop\os-plus` is not a Git repository.

### Pending Tasks

- Authenticated browser QA for `/settings/communications` and order detail message dialogs.
- Add edit/archive controls for communication templates and trigger rules.
- Add background job processing only after choosing Inngest, Trigger.dev, or Supabase Edge Functions.
- Add live WhatsApp/email provider adapters only after tenant sender configuration and secret storage are reviewed.

### Date

2026-05-17

### Updated By

Codex AI agent

### Phase

Phase 0 / Phase 1 foundation

### What Was Built

- Read all files in `docs/` and the root `project_summary.md` before implementation.
- Confirmed product understanding: OS PLUS is a multi-tenant, white-label WorkOS for boutiques and small manufacturing businesses.
- Confirmed MVP boundaries and avoided Shopify, WhatsApp, inventory, GST, QR/barcode, worker login, and customer login features.
- Created Next.js/TypeScript project foundation files.
- Added Tailwind CSS configuration and shadcn/ui-style component setup.
- Added Clerk auth routes and middleware protection.
- Added Supabase browser and service-role client helpers.
- Added tenant context loader based on Clerk user ID and active `tenant_users` membership.
- Added role and permission helpers for MVP roles.
- Added tenant app shell with sidebar navigation and role-filtered modules.
- Added dashboard, settings, and module placeholder pages.
- Added super admin tenant listing, tenant creation, and tenant detail pages.
- Added public tracking route placeholder with customer-safe data boundary noted.
- Added initial Supabase migration for `tenants`, `tenant_users`, enums, indexes, updated-at triggers, and RLS.
- Added `.env.example`, `README.md`, `components.json`, and Supabase migration notes.

### Key Decisions Made

- `tenants` is treated as the SaaS root table, while tenant-owned tables must include `tenant_id`.
- Clerk remains the identity provider; OS PLUS owns tenant membership and role authorization through `tenant_users`.
- Server-side tenant resolution uses Clerk user ID and active tenant membership.
- App-layer permissions are code-based for MVP, with room for database-driven permissions later.
- RLS is enabled immediately on foundation tables; the app uses server-side service-role access after Clerk and tenant validation.
- The MVP assumes one active tenant membership per Clerk user for now; tenant switching can be added later if needed.

### Files/Modules Changed

- `package.json`
- `.env.example`
- `.gitignore`
- `README.md`
- `next.config.ts`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `components.json`
- `next-env.d.ts`
- `src/app/*`
- `src/components/layout/*`
- `src/components/ui/*`
- `src/features/tenants/actions.ts`
- `src/lib/auth/super-admin.ts`
- `src/lib/permissions/roles.ts`
- `src/lib/supabase/*`
- `src/lib/tenant/context.ts`
- `src/types/database.ts`
- `supabase/migrations/20260517120000_foundation_tenants.sql`
- `supabase/README.md`

### Bugs Found

- The project lives outside the default writable root, so reads/writes required elevated approval.
- `npm install` was requested but declined, so dependencies were not installed.
- Build, lint, and typecheck were not run.

### Bugs Fixed

- Moved `no-tenant` outside the tenant route group to avoid tenant-layout redirect loops.
- Added `next-env.d.ts` and stopped ignoring it.
- Updated the lint script to use `eslint`.
- Fixed the `CardTitle` heading ref type.
- Replaced `require()` in Tailwind config with an imported plugin.

### Pending Tasks

- Run `npm install`.
- Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- Fix any install/build issues that appear.
- Create `.env.local` from `.env.example`.
- Configure Clerk and Supabase credentials.
- Apply the Supabase migration.
- Test super admin tenant creation.
- Test tenant membership resolution and tenant app access.
- Decide whether tenant switching is needed before the first operational modules.

### Blockers

- Dependency installation and verification are blocked until `npm install` is approved/run.

### Notes for Next Session

- Resume from dependency installation and verification first.
- Do not start order, workflow, worker, salary, finance, Shopify, WhatsApp, inventory, GST, or QR/barcode work until the foundation passes checks.
- Keep tenant isolation and server-side tenant context as the first review point for every new module.

### Date

2026-05-18

### Updated By

Codex AI agent

### Phase

Phase 0 / Phase 1 foundation verification

### What Was Built

- Installed npm dependencies and generated `package-lock.json`.
- Resolved Clerk/Next peer dependency issues by upgrading to Next.js 16.2.6 and Clerk 7.3.5.
- Updated `eslint-config-next` to 16.2.6.
- Replaced deprecated Next.js `middleware.ts` convention with `proxy.ts`.
- Set explicit Turbopack project root in `next.config.ts` to avoid workspace-root confusion from a parent lockfile.
- Added durable folder placeholders for server actions, queries, mutations, validators, forms, tables, dashboard components, and database notes.
- Kept scope limited to foundation only; no Shopify, WhatsApp, inventory, GST, QR/barcode, worker login, customer login, or operational modules were built.

### Key Decisions Made

- Use Next.js 16.2.6 now because the project is still fresh and the local Node runtime supports it.
- Keep Clerk current with the major version compatible with the latest Next foundation.
- Do not run `npm audit fix --force` because npm recommends a breaking downgrade to `next@9.3.3`.
- Treat the remaining audit issue as a tracked moderate framework dependency issue until Next publishes or npm resolves a valid patched path.

### Files/Modules Changed

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `src/proxy.ts`
- `src/middleware.ts` removed
- `src/types/database.ts`
- `src/db/README.md`
- `src/server/README.md`
- `src/server/actions/.gitkeep`
- `src/server/queries/.gitkeep`
- `src/server/mutations/.gitkeep`
- `src/lib/validators/.gitkeep`
- `src/components/forms/.gitkeep`
- `src/components/tables/.gitkeep`
- `src/components/dashboard/.gitkeep`
- `project_summary.md`

### Bugs Found

- Initial install failed because Clerk required a newer Next peer version than the scaffold pin.
- Supabase table typing collapsed to `never` because hand-written table types were missing `Relationships` metadata.
- ESLint flat config failed when using the legacy `FlatCompat` setup with Next 16.
- Next.js 16 warned that `middleware.ts` is deprecated in favor of `proxy.ts`.
- Next.js warned about workspace-root inference because another lockfile exists at `D:\Develop\package-lock.json`.
- npm audit still reports 2 moderate findings through Next's bundled PostCSS dependency.

### Bugs Fixed

- Upgraded Next.js and Clerk dependency set.
- Added Supabase `Relationships` metadata to table types.
- Replaced ESLint config with direct `eslint-config-next/core-web-vitals` flat config.
- Renamed middleware implementation to `src/proxy.ts`.
- Set `turbopack.root` to the OS PLUS project directory.
- Re-ran verification after each fix.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-05-29 - Workflow Correction UX and History

### Date

2026-05-29

### Updated By

Codex AI agent

### Phase

Production Correction Hardening

### What Was Built

- Refined the stage correction dialog so it behaves like a focused correction flow.
- Worker and timing fields now appear only when relevant to the selected corrected status.
- Added a required correction reason separate from operational stage notes.
- Server actions now store correction reason in `item_history.notes` while preserving stage notes separately.
- Stage correction history now records old status, old timings, old active worker, new status, new timings, new worker, and reason.
- Correcting a stage to completed or skipped now moves the next not-started stage to ready-to-start when appropriate.
- Workflow instance and order item status are recomputed after correction.
- History timeline now describes what changed instead of showing only a generic correction message.

### Key Decisions Made

- Corrections are not destructive edits; they are explicit audited business corrections.
- Staff should not have to fill worker/timing fields when correcting a stage back to not started, ready, blocked, skipped, or paused.
- Correction reason is mandatory because it is the audit explanation.
- Stage notes remain operational notes and should not double as correction audit text.

### Files/Modules Changed

- `src/features/production/actions.ts`
- `src/components/production/workflow-action-dialogs.tsx`
- `src/components/production/item-workflow-panel.tsx`
- `docs/02_WBS.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-05-28 - Customer Measurements Use Tenant Standards

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Customer profile measurement entry should follow the same tenant standards used in order creation.
- Standards should simplify data entry, not lock the tenant into rigid fields; extra one-off fields remain allowed.
- Existing customer measurement records must remain editable even if they were created before standards existed.

### Implementation

- Added a reusable `CustomerMeasurementForm` client component for customer profile add/edit measurement dialogs.
- Customer detail queries now load active `item_type_measurement_fields` for the current tenant.
- Add and edit measurement dialogs now pre-fill rows from active standards when an item type is selected.
- Edit mode preserves historical custom fields that are not part of the current standards.
- Updated the measurement standards implementation spec.

### Verification

- `npm run typecheck` passed.

### Notes for Next Session

- Run lint/build after this focused slice.
- Optional later improvement: standard-size templates for tenants that want S/M/L or numeric size presets per garment type.

## Session Update - 2026-05-28 - Tenant Measurement Standards Settings

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Measurement standards are tenant-level configuration by item type.
- Standards define expected field labels, stable keys, units, sort order, required flag, active flag, and helper text.
- Standards guide future measurement entry but do not rewrite existing customer measurement records.
- Standard-size templates remain out of this slice.

### Implementation

- Added migration `supabase/migrations/20260528100000_item_type_measurement_fields.sql`.
- Added `ItemTypeMeasurementField` database type.
- Added settings queries/actions for measurement standards.
- Added `/settings/measurement-standards`.
- Added Settings card for Measurement standards.
- `/orders/new` now loads active measurement standards.
- Quick-add measurement rows in order creation are pre-filled from standards for the selected item type.
- Updated site map, database model, WBS, measurement standards spec, and summaries.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Apply `supabase/migrations/20260528100000_item_type_measurement_fields.sql` to live Supabase before using measurement standards.
- Next focused slice: upgrade customer profile add/edit measurement dialogs to use tenant standards.

## Session Update - 2026-05-28 - Quick-Add Measurement from Order Creation

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Quick-add measurement is available from an order item row only after a customer and item type are selected.
- The quick-add dialog does not create a nested form inside the order creation form.
- The saved measurement is immediately inserted into the local measurement list and auto-selected for that item.
- Current quick-add creates item-type-specific measurements. General measurements remain managed from the customer profile for now.

### Implementation

- Added `POST /api/customer-measurements`.
- Endpoint uses active tenant context and `customers:manage` permission.
- Endpoint validates customer tenancy and item type tenancy before insert.
- If marked default, the endpoint clears the previous default for the same customer/item type scope.
- Added quick-add dialog inside `OrderItemBuilder`.
- The item measurement selector now supports newly created measurements without leaving order creation.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Next recommended slice: tenant measurement standards in Settings.

## Session Update - 2026-05-28 - Order Edit Shell

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Order editing starts as a correction shell, not a destructive order rebuild.
- MVP edit scope includes order reference/source/dates/delivery/notes and non-destructive item corrections.
- Price, quantity, customer changes, item deletion, and payment reversal are deferred because they affect totals, finance records, production history, and audit expectations.

### Implementation

- Added `updateOrderDetailsAction` with tenant-scoped order validation.
- Added `updateOrderItemAction` with tenant-scoped item validation.
- Item measurement edits validate that the selected measurement belongs to the same order customer and is compatible with the item type.
- Added `EditOrderDialog` side pane on order detail.
- Edit pane supports:
  - order reference, source, order date, promised date, delivery type, delivery address, notes
  - item name, color, description, expected completion date, delivery override, measurement reference, item notes
- Revalidates orders, order detail, tracking page, and item workflow page after edits.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Next recommended slice: quick-add customer measurement from order creation without nested forms.

## Session Update - 2026-05-27 - Tracking Status and Measurement Standards Planning

### Date

2026-05-27

### Updated By

Codex AI agent

### Feedback Captured

- Order detail could show stored order status as `confirmed` while computed fulfillment showed `delivered`.
- Public tracking copy exposed awkward internal language such as "Current public status".
- Created orders need an edit path.
- Order creation should support quick-add customer measurements without leaving the flow.
- Workflow item view should show attached measurements.
- Tenants need configurable standard measurement fields per garment/item type.

### Implementation

- Public tracking now derives the displayed order status from safe item/stage progress, so a fully delivered workflow no longer appears as `confirmed` to the customer.
- Tracking page copy was simplified: removed "Current public status" and changed item section copy to customer-friendly language.
- Order detail now displays the effective delivered/partially-delivered status when item workflow progress proves delivery, avoiding confusing duplicate confirmed/delivered signals.
- Production fulfillment sync now revalidates the order detail and public tracking route after workflow changes.
- Workflow item panel now shows the linked measurement reference and measurement fields, or "No measurements available for this item" when none is attached.

### Product Plan Added

- Added `docs/11_Measurement_Standards_Implementation_Spec.md`.
- Updated PRD/WBS/database model notes for tenant-level measurement standards and order editing.
- Quick-add measurement during order creation should be implemented after refactoring the current one-large-server-form order page, because nested measurement forms inside the order form would be fragile.

### Verification

- `npm run typecheck` passed after code changes.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Next implementation choices: order edit shell first, then quick-add measurement dialog, then tenant-level measurement standards in Settings.

## Session Update - 2026-05-27 - Customer Measurement Reference in Order Creation

### Date

2026-05-27

### Updated By

Codex AI agent

### Product Decision

- Order item remains the production unit, so saved customer measurements are linked at `order_items.customer_measurement_id`, not at the order level.
- The link is optional. Staff can create an order without choosing a measurement, but when a customer and item type are selected, compatible saved measurements are shown directly inside the item row.
- Measurement choices are filtered by selected customer and compatible item type. General measurements can be used for any item type; item-type-specific measurements can only be linked to matching item types.
- Measurement references are internal production/founder context and remain excluded from the public token-based tracking page.

### Implementation

- Added migration `supabase/migrations/20260527123000_order_item_measurement_reference.sql`.
- Updated `OrderItem` database types with nullable `customer_measurement_id`.
- Loaded customer measurements into `/orders/new`.
- Added per-item measurement reference selection and inline preview in the order item builder.
- Added server-side validation in `createOrderAction` to enforce tenant ownership, selected customer ownership, and item-type compatibility before saving the measurement link.
- Display linked measurement references on order detail production item cards.
- Updated PRD, WBS, and database model docs.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Apply `supabase/migrations/20260527123000_order_item_measurement_reference.sql` to live Supabase before using measurement references during order creation.
- Consider a future quick-add measurement dialog from order creation for cases where the customer has no matching measurement yet.

## Session Update - 2026-05-27 - Cross-Module UX Feedback Pass

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Cross-Module UX Tightening

### User Feedback

- Main dashboard needs an attendance visual.
- Order detail top chips were noisy and could show duplicate in-progress labels.
- Customer side pane from an order should show measurement references.
- Customer profile order rows should open a summary pane before full order navigation.
- Worker side pane CTAs for Attendance, Salary Ledger, and Production were unclear.
- Salary overview charts should be arranged side by side, with attention/recent payments on the second row.
- Finance attention item for legacy order-linked receivables should not be shown.
- Workflow pages need clearer return navigation back to the related order.
- Sidebar needs active states and a compact icon-only mode.
- Header graph icon was not clickable and should become a meaningful profile/settings entry.
- Settings Seed Defaults needs a confirmation/explanation before running.

### What Was Built

- Added a 7-day Attendance stacked bar visual to the main dashboard.
- Cleaned order detail chips with labeled Order, Fulfillment, and Payment chips; Fulfillment is hidden when it duplicates order status.
- Added customer measurements into the order detail customer side pane.
- Changed customer profile order history rows to open an order summary side dialog with an `Open full order` action.
- Removed unclear worker side pane module CTAs.
- Reworked Salary overview layout: salary paid trend and worker salary chart are side by side; attention board and recent payments are side by side below.
- Removed the Finance legacy order-linked receivables alert from attention items.
- Added `Back to order` on production workflow pages when an order is available.
- Added sidebar active states and icon-only collapse toggle.
- Replaced the non-clickable header graph icon with a profile/settings shortcut.
- Wrapped Settings `Seed defaults` behind a confirmation dialog with explanatory copy.

### Key Decisions Made

- Default views should communicate state first; actions should be deliberate.
- Repeated or unlabeled status chips create confusion and should be labeled or suppressed when duplicate.
- Module shortcuts inside detail panes should be kept only when they are contextual and directly filtered to that record.
- Sidebar shell improvements can be handled incrementally without redesigning navigation.

### Files/Modules Changed

- `src/app/(tenant)/dashboard/page.tsx`
- `src/components/dashboard/analytics-charts.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/components/orders/customer-context-sheet.tsx`
- `src/features/orders/queries.ts`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/app/(tenant)/workers/page.tsx`
- `src/app/(tenant)/salary/page.tsx`
- `src/app/(tenant)/finance/page.tsx`
- `src/app/(tenant)/production/items/[itemId]/workflow/page.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/(tenant)/settings/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Remaining Follow-Up

- Deeper browser visual QA of the collapsed sidebar on mobile/desktop.
- Consider a formal breadcrumb/back-stack pattern across Orders, Production, Customers, and Dashboard drilldowns.

## Session Update - 2026-05-27 - Customer Workspace v1

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Customer Module Operational Upgrade

### User Feedback

- After reviewing the roadmap, the user identified Customers as the next module needing serious work.
- The user confirmed the schema should support multiple measurements per customer before proceeding.

### What Was Built

- Upgraded the Customer list from a plain master list into a workspace summary.
- Customer rows now show order count, last order date, active order count, pending balance, and measurement count.
- Added Customer list metrics for customers shown, active customers, and pending balance.
- Reworked Customer detail into a focused customer workspace.
- Customer detail now shows total orders, active orders, total booked, total paid, pending balance, and measurement count.
- Added order history to the customer profile with order number, date, status, item count, total, and pending amount.
- Added profile editing directly from the customer detail page.
- Added a quick `Create order` action that opens the order creation screen with the customer preselected.
- Improved measurement display into clearer cards by item type.
- Updated measurement default behavior so defaults are scoped per item type, with a separate general default when no item type is selected.

### Key Decisions Made

- Customers should become an operational workspace, not just a database master.
- The customer profile should answer: who is this customer, what have they ordered, what do they owe, and which measurements should be used.
- No schema migration is needed for this first customer upgrade; existing customer, order, payment, item, and measurement tables are enough.
- Attachment upload remains later; measurement photo URL stays as a placeholder until the shared file upload pattern is implemented.

### Files/Modules Changed

- `src/features/customers/queries.ts`
- `src/features/customers/actions.ts`
- `src/app/(tenant)/customers/page.tsx`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/components/orders/customer-picker.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Next Customer improvements should consider measurement edit/delete/default controls and a real attachment upload flow.

## Session Update - 2026-05-27 - Customer Measurement Management v1.1

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Customer Measurement UX

### User Feedback

- Customer profiles must support adding multiple measurements.
- Each measurement should show updated dates.
- Each measurement needs a reference note/name so users can identify records like trial measurements, garment-specific measurements, or the latest version.

### What Was Built

- Added a `reference_name` field to `customer_measurements`.
- Added a Supabase migration for the new measurement reference field and tenant-scoped search index.
- Updated database types for measurement reference names.
- Added reference name input to the Add Measurement form.
- Measurement cards now show reference name, item type, created date, and updated date.
- Added edit controls for existing measurements, including reference name, item type, notes, photo URL, fields, and default status.
- Added `Make default` action for existing measurements.
- Added soft archive action for incorrect or outdated measurements.
- Preserved the one-default-per-item-type rule and general default rule.

### Key Decisions Made

- Multiple measurements should be identifiable without opening every record.
- `updated_at` is the source of truth for when a measurement was last changed.
- Measurement delete is implemented as archive/soft delete, not hard delete.
- Real attachment upload remains later; `photo_url` stays as the interim field.

### Files/Modules Changed

- `supabase/migrations/20260527110000_customer_measurement_reference.sql`
- `src/types/database.ts`
- `src/features/customers/actions.ts`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/08_Database_Model.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Apply `supabase/migrations/20260527110000_customer_measurement_reference.sql` to live Supabase before using measurement reference names there.
- Next step after this should be either visual review or a shared attachment upload flow for measurement photos.

## Session Update - 2026-05-27 - Customer Profile CTA UX Correction

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Customer Profile UX Correction

### User Feedback

- Profile fields were always open for editing, making the customer profile feel like an edit form by default.
- Add measurement was always open on the page, creating clutter and anxiety.
- Edit measurement was visible as an inline section instead of a clear action.
- The user called out that these UI states should have been identified during first-pass analysis.

### What Was Built

- Changed the Customer Profile card to read-only display by default.
- Added an explicit `Edit details` CTA that opens the profile edit form in a dialog.
- Moved Add Measurement behind an `Add measurement` CTA and dialog.
- Moved measurement edit behind an `Edit` CTA and dialog.
- Kept quick actions visible only where they support decision-making: create order, make default, archive, edit.

### Key Decisions Made

- Customer profile pages should open in review mode, not edit mode.
- Creation and editing forms should be deliberate CTA flows unless the page itself is dedicated to entry.
- Default state should help users understand the customer quickly: identity, dues, orders, and saved measurements.

### Files/Modules Changed

- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 6 Production Dashboard foundation

### What Was Built

- Reworked `/production` from a flat item list into a queue-oriented production dashboard.
- Added summary counters for ready, in progress, blocked, due soon, delayed, and uninitialized items.
- Added queue sections for ready to start, in progress, due soon/at-risk, and needs workflow setup.
- Added per-item progress counts using completed stage count over total stage count.
- Added simple MVP at-risk logic based on expected completion date within two days and incomplete item status.

### Key Decisions Made

- Production dashboard remains read/navigation focused for now; item-level actions stay on the item workflow page.
- Kanban/drag-drop is deferred until the production state model is more stable.
- Due soon and at-risk use the MVP rule from the docs.

### Files/Modules Changed

- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test `/production` after starting and completing stages.
- Add filters by workflow, stage, due date, and worker.
- Add blocked/skipped stage actions.
- Later build kanban-style production board with assignment buckets.

### Notes for Next Session

- Next planned MVP slice is Attendance foundation: attendance table, daily attendance screen, manual status marking, and worker attendance history.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Cross-module UX expectations

### Key Decisions Made

- Add/edit/update flows are expected across operational modules, including orders, payments, customers, work stages, workers, and configuration masters. Current foundation screens may create/list first; edit flows should be layered in once the main MVP data spine is stable.
- Reports, dashboards, and production views should evolve toward a modern ClickUp-style analytics/dashboard feel with appropriate bar charts, pie charts, line charts, queue widgets, and configurable dashboard cards.
- Research reusable open-source dashboard/chart patterns or libraries later before deep dashboard polish. Keep MVP foundations simple until operational data exists.

### Pending Tasks

- Add payment create/edit flows to order detail.
- Add edit/update/delete controls for customers, orders, measurements, workers, workflow stages, attendance, production stage notes, and related records.
- Plan configurable dashboards in the reporting/dashboard polish phase.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 7 Attendance foundation

### What Was Built

- Added attendance migration with `attendance_status` enum and tenant-owned `attendance` table.
- Added tenant/date/worker indexes, soft delete, RLS, and one active attendance row per worker per date.
- Added TypeScript database types for attendance.
- Added attendance permissions for owner/admin and manager roles.
- Added tenant-scoped attendance query and server action layer.
- Replaced `/attendance` placeholder with a daily attendance screen.
- Daily attendance page supports date selection, active worker rows, status, check-in time, check-out time, total hours, notes, and daily counters.

### Key Decisions Made

- Attendance remains separate from production work logs.
- Managers/admins mark attendance manually in MVP.
- Saving a worker row updates the existing attendance record for that worker/date if one exists.

### Files/Modules Changed

- `supabase/migrations/20260519203000_attendance_foundation.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/features/attendance/queries.ts`
- `src/features/attendance/actions.ts`
- `src/app/(tenant)/attendance/page.tsx`
- `project_summary.md`

### Bugs Found

- ESLint rejected an unescaped apostrophe in attendance page copy.

### Bugs Fixed

- Reworded the attendance page copy.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260519203000_attendance_foundation.sql` to the live Supabase project.
- Open `/attendance`, select a date, and mark attendance for active workers.
- Add monthly attendance history and worker detail attendance views later.

### Notes for Next Session

- Next planned MVP slice is Salary and Worker Ledger foundation.
- `npm audit --audit-level=high` passed with no high or critical findings.

### Pending Tasks

- Create `.env.local` from `.env.example`.
- Configure Clerk application and add valid environment variables.
- Configure Supabase project and add valid environment variables.
- Apply `supabase/migrations/20260517120000_foundation_tenants.sql`.
- Add a real Clerk user ID to `OS_PLUS_SUPER_ADMIN_CLERK_USER_IDS`.
- Test super admin tenant creation in the running app.
- Test tenant dashboard access through an active `tenant_users` membership.
- Create GitHub repository when requested.

### Blockers

- Live auth/database flows cannot be tested until Clerk and Supabase credentials are provided.

### Notes for Next Session

- Start with environment setup and live integration testing.
- Keep using server-side tenant context before adding configuration, order, customer, workflow, worker, salary, or finance features.
- Revisit the moderate Next/PostCSS audit finding when a valid non-breaking fix is available.

### Date

2026-05-18

### Updated By

Codex AI agent

### Phase

Phase 1 live integration bug fix

### What Was Built

- Diagnosed failed tenant creation during live super admin testing.
- Added Supabase environment URL validation so `NEXT_PUBLIC_SUPABASE_URL` must be the project base URL and not a REST endpoint path.
- Added `suppressHydrationWarning` to the root HTML element to avoid browser-extension attribute noise during hydration.

### Key Decisions Made

- Keep `.env.local` values user-managed, but fail fast with clear validation if Supabase URL shape is wrong.
- Treat the observed `data-scribe-recorder-ready` hydration warning as browser-extension noise, not an app-rendering bug.

### Files/Modules Changed

- `src/lib/env/supabase.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/app/layout.tsx`
- `project_summary.md`

### Bugs Found

- `NEXT_PUBLIC_SUPABASE_URL` was configured with `/rest/v1/`, causing Supabase writes to fail with `Invalid path specified in request URL`.
- Browser extension injected `data-scribe-recorder-ready` into the server-rendered `<html>` element, causing a hydration mismatch warning.

### Bugs Fixed

- Added clear Supabase URL validation.
- Suppressed root HTML hydration warnings for external extension attributes.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Update `.env.local` so `NEXT_PUBLIC_SUPABASE_URL` is only `https://dxiyihrdfismbuqdmhit.supabase.co`.
- Restart the dev server after changing `.env.local`.
- Retry `/super-admin/tenants/new`.
- Confirm tenant creation and `/dashboard` tenant access.

### Blockers

- Tenant creation will continue failing until the Supabase URL in `.env.local` is corrected and the dev server is restarted.

### Notes for Next Session

- If tenant creation still fails after the URL correction, inspect whether the migration was applied to the same Supabase project referenced by `.env.local`.

### Date

2026-05-18

### Updated By

Codex AI agent

### Phase

Phase 2 Configuration Engine foundation

### What Was Built

- Added tenant-owned configuration migration for `customer_statuses`, `item_types`, `stage_master`, `workgroups`, `payment_modes`, and `expense_categories`.
- Added tenant IDs, audit columns, soft-delete columns, RLS enablement, indexes, and active-record uniqueness rules to configuration tables.
- Added TypeScript database types for the new configuration tables.
- Added settings defaults for customer statuses, item types, stages, workgroups, payment modes, and expense categories.
- Added tenant-scoped settings query layer.
- Added settings server actions for business profile update, default seeding, and creating master records.
- Replaced the settings placeholder with a real settings overview.
- Added settings pages for business profile, item types, stages, customer statuses, workgroups, payment modes, and expense categories.
- Kept scope limited to configuration masters; no orders, workflows, workers, salary, finance, Shopify, WhatsApp, inventory, GST, QR/barcode, worker login, or customer login features were built.

### Key Decisions Made

- Default configuration seeding is explicit through a settings action instead of hidden automatic mutation on page load.
- Customer-facing statuses remain their own table, separate from internal `stage_master`.
- Configuration tables use tenant-scoped partial unique indexes over lowercase names where `deleted_at is null`.
- Seed logic reads existing tenant records and inserts only missing defaults instead of relying on `upsert` against partial unique indexes.
- Business profile changes update the tenant root record because tenant branding belongs to the tenant identity.

### Files/Modules Changed

- `supabase/migrations/20260518170000_configuration_foundation.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/features/settings/defaults.ts`
- `src/features/settings/queries.ts`
- `src/features/settings/actions.ts`
- `src/components/settings/settings-list.tsx`
- `src/components/settings/text-master-form.tsx`
- `src/app/(tenant)/settings/page.tsx`
- `src/app/(tenant)/settings/business-profile/page.tsx`
- `src/app/(tenant)/settings/item-types/page.tsx`
- `src/app/(tenant)/settings/stages/page.tsx`
- `src/app/(tenant)/settings/customer-statuses/page.tsx`
- `src/app/(tenant)/settings/workgroups/page.tsx`
- `src/app/(tenant)/settings/payment-modes/page.tsx`
- `src/app/(tenant)/settings/expense-categories/page.tsx`
- `project_summary.md`

### Bugs Found

- Initial generic Supabase seed helper became too abstract and failed TypeScript because dynamic table names lost table-specific column knowledge.

### Bugs Fixed

- Replaced the generic seed helper with concrete table-specific reads/inserts while preserving tenant isolation.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260518170000_configuration_foundation.sql` to the live Supabase project.
- Restart the dev server after applying the migration.
- Open `/settings` as the Phantom Threads owner/admin.
- Click `Seed defaults` once.
- Verify default item types, stages, customer statuses, workgroups, payment modes, and expense categories appear.
- Add one custom record in each settings master to confirm create actions.
- Start workflow configuration only after these masters are verified.

### Blockers

- New settings pages will error until the configuration migration is applied in Supabase.

### Notes for Next Session

- If `/settings` errors after applying the migration, check that the migration was applied to the same Supabase project used by `.env.local`.
- The next product slice should be workflow configuration, still before order entry.

### Date

2026-05-18

### Updated By

Codex AI agent

### Phase

Phase 2 Configuration Engine bug fix

### What Was Built

- Diagnosed stage creation failure while adding tenant stages.
- Added duplicate-master handling for item types, stages, customer statuses, workgroups, payment modes, and expense categories.
- Added body-level hydration warning suppression for browser extension attributes.

### Key Decisions Made

- The database should continue enforcing tenant-scoped unique master names.
- For this early settings UX, duplicate creation attempts are treated as idempotent no-ops instead of runtime crashes.
- Browser extension mutations on `<body>` are treated as external noise and suppressed at the root layout.

### Files/Modules Changed

- `src/app/layout.tsx`
- `src/features/settings/actions.ts`
- `project_summary.md`

### Bugs Found

- Duplicate stage names correctly violated `stage_master_tenant_name_active_idx`, but the server action surfaced the database error directly to the user.
- Browser extension attributes on `<body>` caused a hydration mismatch warning.

### Bugs Fixed

- Duplicate master insert errors now revalidate and return without crashing.
- Added `suppressHydrationWarning` on `<body>`.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Add inline form feedback/toast messages later so duplicate attempts can show a friendly “already exists” note.
- Continue testing settings master creation for Phantom Threads.

### Date

2026-05-18

### Updated By

Codex AI agent

### Phase

Phase 2 Workflow Configuration foundation

### What Was Built

- Added workflow configuration migration for `workflows`, `workflow_stages`, and `stage_workgroups`.
- Added foreign key from `item_types.default_workflow_id` to `workflows`.
- Added indexes, tenant IDs, audit columns, soft-delete support, and RLS enablement for workflow configuration tables.
- Added TypeScript database types for workflow configuration.
- Added workflow configuration queries and server actions.
- Added `/settings/workflows` page with sequential workflow creation, optional item-type association, default workflow flag, stage-to-workgroup mapping, and existing workflow list.
- Added `/settings/workflows/[workflowId]` detail page showing configured stage sequence.
- Added workflow card to settings overview.

### Key Decisions Made

- Workflow sequence is configured in `workflow_stages.sequence_number`, not inferred from the stage master list.
- MVP workflow builder remains sequential.
- `parent_stage_id`, `parallel_group_id`, and `dependency_type` are included in schema for future parallel workflow support but not exposed in the UI yet.
- Stage-to-workgroup mapping is configured independently from workflow stages so worker assignment rules can reuse stage master rules across workflows.
- Orders are still intentionally not started until configuration and workflow masters are verified.

### Files/Modules Changed

- `supabase/migrations/20260518190000_workflow_configuration.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/features/workflows/queries.ts`
- `src/features/workflows/actions.ts`
- `src/app/(tenant)/settings/page.tsx`
- `src/app/(tenant)/settings/workflows/page.tsx`
- `src/app/(tenant)/settings/workflows/[workflowId]/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260518190000_workflow_configuration.sql` to the live Supabase project.
- Restart the dev server after applying the migration.
- Open `/settings/workflows`.
- Map stages to allowed workgroups.
- Create a sequential workflow using Phantom Threads stages.
- Open the workflow detail page and confirm stage order.
- Add customer status mapping controls to workflow stages.
- Add edit/reorder controls for workflow stages.

### Blockers

- `/settings/workflows` will error until the workflow configuration migration is applied in Supabase.

### Notes for Next Session

- After workflow configuration is verified, the next logical slice is worker master and workgroups, or customer/item/order foundations depending on whether production assignment should be tested first.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 2 Workflow Configuration UX correction

### What Was Built

- Replaced checkbox-based workflow creation with explicit numbered stage dropdown rows.
- Added workflow sequence replacement on the workflow detail page.
- Added optional customer-facing status mapping while replacing workflow stages.
- Added workflow soft-delete action that also clears item-type default workflow references.
- Preserved tenant validation for every workflow sequence, status, and workgroup operation.

### Key Decisions Made

- Workflow stage order must be explicit and editable; it should never depend on checkbox order or stage master sort order.
- Existing incorrect workflows should be recoverable from the UI by replacing the sequence or deleting the workflow.
- Customer status mapping belongs at workflow-stage level, not stage master order.

### Files/Modules Changed

- `src/features/workflows/actions.ts`
- `src/features/workflows/queries.ts`
- `src/app/(tenant)/settings/workflows/page.tsx`
- `src/app/(tenant)/settings/workflows/[workflowId]/page.tsx`
- `project_summary.md`

### Bugs Found

- Checkbox-based workflow creation made sequence implicit and easy to get wrong.
- Existing workflow detail page did not provide a way to fix or delete a bad workflow.

### Bugs Fixed

- Workflow create form now uses explicit `Step 1`, `Step 2`, etc. dropdowns.
- Workflow detail page now supports replacing the full stage sequence.
- Workflow detail page now supports deleting the workflow.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Restart the dev server.
- Open the incorrect workflow detail page and either replace the sequence or delete it.
- Use `/settings` `Seed defaults` once to add missing defaults such as Kurtha, workgroups, payment modes, and expense categories.
- Create a clean workflow using the ordered step dropdowns.

### Notes for Next Session

- Add visible success/error feedback for settings forms.
- Consider adding edit/disable controls to stage master so customer-facing statuses like Delivered are not kept as internal stages by mistake.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 2 Worker Master foundation

### What Was Built

- Expanded default customer-facing statuses to include design confirmation, QC, packing, pickup/dispatch, dispatched, and delivered statuses.
- Added Worker Master migration for `workers` and `worker_workgroups`.
- Added `worker_status` and `worker_wage_type` database enums.
- Added tenant IDs, soft-delete columns, audit columns, indexes, and RLS enablement for worker tables.
- Added TypeScript database types for workers and worker-workgroup mappings.
- Added worker query and server action layer with tenant validation.
- Replaced the `/workers` placeholder with a real Worker Master screen.
- Worker creation now supports phone, joining date, primary workgroup, additional workgroups, wage type, wage amount, and notes.

### Key Decisions Made

- Workers remain operational resources and are not login users in MVP.
- Worker creation validates that selected workgroups belong to the current tenant.
- Wage types include future-supported `per_piece` and `hybrid` in schema, while MVP can still primarily use hourly/daily/weekly/monthly.
- Customer-facing statuses are expanded as safe labels for workflow-stage mapping, separate from internal production stages.

### Files/Modules Changed

- `src/features/settings/defaults.ts`
- `supabase/migrations/20260519110000_worker_master.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/features/workers/queries.ts`
- `src/features/workers/actions.ts`
- `src/app/(tenant)/workers/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260519110000_worker_master.sql` to the live Supabase project.
- Restart the dev server after applying the migration.
- Click `/settings` -> `Seed defaults` once to add missing customer-facing statuses and other defaults.
- Open `/workers` and add Phantom Threads workers.
- Map worker workgroups before testing production assignment.
- Add edit/disable worker controls later.

### Blockers

- `/workers` will error until the Worker Master migration is applied in Supabase.

### Notes for Next Session

- After workers are verified, the next logical slice is customer master and measurements, then order foundation.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Configuration default seed correction

### What Was Built

- Added SQL migration to seed missing default configuration rows for all existing tenants.
- Seed migration covers customer statuses, item types, internal stages, workgroups, payment modes, and expense categories.
- The migration is idempotent and checks existing tenant-owned names before inserting.

### Key Decisions Made

- Defaults should be available through migrations as well as the app-level Seed Defaults action.
- Seed migration avoids `on conflict` because configuration uniqueness is enforced through partial unique indexes for active, non-deleted records.
- Manual tenant data remains respected; existing matching names are not duplicated.

### Files/Modules Changed

- `supabase/migrations/20260519123000_seed_configuration_defaults.sql`
- `supabase/README.md`
- `project_summary.md`

### Bugs Found

- Customer-facing status default rows were not represented in SQL migrations; they only existed in app seed code.

### Bugs Fixed

- Added migration-backed default seeding for existing tenants.

### Pending Tasks

- Apply `supabase/migrations/20260519123000_seed_configuration_defaults.sql` to the live Supabase project.
- Verify Phantom Threads now has the full customer status list and missing defaults.
- Continue with Customer Master and Measurements after Worker Master is verified.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 3 Customer Master and Measurements foundation

### What Was Built

- Added tenant-owned `customers` table with optional phone, email, gender, address, notes, audit columns, soft delete, RLS, and tenant-scoped indexes.
- Added tenant-owned `customer_measurements` table with item-type linkage, key-value JSON measurement data, measurement notes, `photo_url`, default flag, audit columns, soft delete, RLS, and tenant-scoped indexes.
- Added customer and measurement TypeScript database types.
- Added tenant-scoped customer queries for list/search, phone suggestions, and customer detail.
- Added customer server actions with Zod validation and server-side tenant context.
- Replaced `/customers` placeholder with customer search/list UI.
- Added `/customers/new` customer creation page with phone suggestion foundation.
- Added `/customers/[customerId]` detail page with profile display and measurement creation/listing.

### Key Decisions Made

- Customer duplicates remain allowed; phone is indexed for suggestions but has no uniqueness constraint.
- Measurement data is stored as JSONB object key-value pairs for MVP flexibility.
- Measurement `photo_url` is included as attachment-ready groundwork, while the full shared `attachments` table/upload flow remains a later slice.
- Customer mutation permission is explicit as `customers:manage`, available to owner/admin and manager roles.
- Order history is intentionally only noted on the customer detail page until the Order foundation exists.

### Files/Modules Changed

- `supabase/migrations/20260519150000_customer_master_measurements.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/features/customers/queries.ts`
- `src/features/customers/actions.ts`
- `src/app/(tenant)/customers/page.tsx`
- `src/app/(tenant)/customers/new/page.tsx`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260519150000_customer_master_measurements.sql` to the live Supabase project.
- Restart the dev server after applying the migration.
- Open `/customers` as Phantom Threads owner/admin or manager.
- Create test customers, including repeated/similar phone numbers.
- Confirm `/customers/new?phone=...` shows matching suggestions.
- Add item-type-linked measurements with key-value fields.
- Add customer edit and measurement edit/delete controls later.

### Blockers

- `/customers` will error in the live app until the customer migration is applied to Supabase.

### Notes for Next Session

- After Customer Master is verified, continue with Order foundation: orders, order items, item-level workflow selection, payments groundwork, and secure tracking token generation.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 4 Order foundation

### What Was Built

- Added tenant-owned `orders`, `order_items`, and `order_payments` tables.
- Added order, delivery, payment, order status, and item status enums.
- Added tenant-scoped indexes, soft-delete columns, audit columns, amount constraints, tracking token uniqueness, and RLS enablement.
- Added order TypeScript database types.
- Added tenant-scoped order queries for order list, new order setup data, and order detail.
- Added order server action with Zod validation, server-side tenant context, and tenant validation for selected customer, item types, workflows, and payment mode.
- Replaced `/orders` placeholder with a searchable order list.
- Added `/orders/new` manual order creation page with commercial order fields, up to five item rows, item-level workflow selection, expected completion dates, delivery override, and initial payment capture.
- Added `/orders/[orderId]` detail page showing commercial summary, production items, payment summary, payment records, and generated tracking token.

### Key Decisions Made

- Order is stored as the commercial unit, while each `order_items` row is a production unit.
- Workflow selection is required at item level from the first order foundation slice.
- Initial payment is optional and creates an `order_payments` record when amount is greater than zero.
- Payment status is derived at creation from total amount and amount paid.
- Tracking tokens are generated on order creation, but the public tracking page remains a later customer-safe slice.
- Customer creation inside the order form is deferred; users select existing customers and can create customers through `/customers/new`.

### Files/Modules Changed

- `supabase/migrations/20260519170000_order_foundation.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/features/orders/queries.ts`
- `src/features/orders/actions.ts`
- `src/app/(tenant)/orders/page.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260519170000_order_foundation.sql` to the live Supabase project.
- Restart the dev server after applying the migration.
- Open `/orders/new` and create a test order using an existing customer, item type, workflow, and optional payment mode.
- Confirm `/orders` and `/orders/[orderId]` display the created order correctly.
- Add order edit controls, payment-add controls, and item edit controls later.
- Add workflow instance creation after order items are created in the next slice.

### Blockers

- `/orders` will error in the live app until the order migration is applied to Supabase.

### Notes for Next Session

- After Order foundation is verified, continue with Workflow Execution foundation: item workflow instances, item stage instances, stage status transitions, worker assignment validation, work logs, and item history.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 4 Order foundation correction

### What Was Built

- Added follow-up migration for optional `orders.reference_order_id`.
- Added tenant-owned `tenant_order_counters` table.
- Added database functions/triggers to generate tenant-scoped OS PLUS order numbers automatically.
- Updated order creation UI so staff no longer manually enters OS PLUS order number.
- Added optional Reference Order ID input for ecommerce, legacy, or external IDs.
- Updated order list/search/detail to include reference order ID.

### Key Decisions Made

- `orders.id` remains the internal UUID primary key.
- `orders.order_number` is now system-generated and tenant-scoped as `ORD-000001`, `ORD-000002`, etc.
- `orders.reference_order_id` is optional and intended for Shopify/ecommerce/manual external mapping.
- Duplicate external references are prevented per tenant and source when `reference_order_id` is present.
- Tenant-specific branding/prefix configuration is deferred; the counter design can support a configurable prefix later.

### Files/Modules Changed

- `supabase/migrations/20260519183000_order_reference_and_numbering.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/features/orders/actions.ts`
- `src/features/orders/queries.ts`
- `src/app/(tenant)/orders/page.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- Order creation incorrectly required staff to manually enter OS PLUS order number.
- Schema lacked an external/reference order ID for ecommerce or legacy mapping.

### Bugs Fixed

- Added generated tenant-scoped order numbering.
- Added optional reference order ID field and duplicate guard.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260519183000_order_reference_and_numbering.sql` to the live Supabase project after the original order foundation migration.
- Create a new order and verify the order number appears as `ORD-000001` or the next tenant number.
- Create an order with a reference ID and confirm it appears on list/detail pages.

### Blockers

- New order creation now depends on the order numbering correction migration because the app no longer sends `order_number` manually.

### Notes for Next Session

- If tenant-specific order prefixes are needed before production launch, add a configurable tenant order prefix field and update `generate_tenant_order_number`.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Phase 5 Workflow Execution foundation

### What Was Built

- Added workflow execution migration for `item_workflow_instances`, `item_stage_instances`, `item_stage_work_logs`, and `item_history`.
- Added workflow execution enums for item workflow status, stage status, and work log status.
- Added TypeScript database types for workflow execution tables.
- Added helper to generate workflow and stage instances from configured workflow stages.
- Updated order creation so newly created order items automatically get workflow instances and stage instances.
- Added production queries and actions.
- Replaced `/production` placeholder with a production queue.
- Added `/production/items/[itemId]/workflow` page with stage timeline, workflow initialization, stage start, stage completion, active worker log display, and recent item history.
- Added links from order item cards to production workflow pages.

### Key Decisions Made

- Existing order items created before this slice can be initialized from their production workflow page.
- Stage start requires selecting an active tenant worker.
- Stage start validates the selected worker belongs to one of the stage's allowed workgroups.
- Work logs are production records and remain separate from attendance.
- Stage completion completes active work logs, writes duration minutes, marks the next stage ready, and writes item history.
- MVP stage completion advances the next stage to `ready_to_start`; richer manager-confirmation UX can be refined later.

### Files/Modules Changed

- `supabase/migrations/20260519193000_workflow_execution_foundation.sql`
- `supabase/README.md`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/features/orders/actions.ts`
- `src/features/production/instances.ts`
- `src/features/production/queries.ts`
- `src/features/production/actions.ts`
- `src/app/(tenant)/production/page.tsx`
- `src/app/(tenant)/production/items/[itemId]/workflow/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- Fixed one TypeScript narrowing issue in stage completion action before final verification.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260519193000_workflow_execution_foundation.sql` to the live Supabase project.
- Open the workflow page for the existing test order item and click `Create workflow instance`.
- Confirm `/production` shows the item and current stage.
- Start the first stage with a worker who belongs to an allowed workgroup for that stage.
- Complete the stage and confirm the next stage becomes ready.
- Add pause/resume, blocked/skipped, multi-worker assignment UI, and attachment support later.

### Blockers

- Production workflow pages will error in the live app until the workflow execution migration is applied.
- Stage start will fail unless stage-to-workgroup mappings and worker-to-workgroup mappings are configured.

### Notes for Next Session

- After this is verified, refine production UX into proper queues: ready to start, in progress, blocked, due soon, and at-risk.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Workflow Execution UX correction

### What Was Built

- Updated production item workflow page to load stage-to-workgroup mappings, worker-to-workgroup mappings, and workgroup names.
- Worker dropdown now shows only active workers eligible for the selected ready stage.
- Ready stages now show a configuration message when no eligible worker exists instead of allowing an invalid start attempt.

### Key Decisions Made

- The server action keeps strict worker/workgroup validation as the final guardrail.
- The UI should guide managers toward valid workers and explain missing configuration before submission.
- The intended future UX is an order-detail operational matrix plus a production dashboard/board view for cross-order queues.

### Files/Modules Changed

- `src/features/production/queries.ts`
- `src/app/(tenant)/production/items/[itemId]/workflow/page.tsx`
- `project_summary.md`

### Bugs Found

- Production stage start UI allowed selecting workers who were not mapped to allowed workgroups for that stage.

### Bugs Fixed

- Filtered worker selection to eligible workers only and added missing-configuration messaging.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Verify the stage has allowed workgroups configured in Settings > Workflows.
- Verify active workers are mapped to at least one of those allowed workgroups.
- Retest starting the first ready stage.

### Notes for Next Session

- Build the richer order operations surface later: expandable item cards with stage columns, assigned worker, start timestamp, completed timestamp, and current status.
- Build production board later as queue-based/kanban management for ready, in-progress, completed-awaiting-next-assignment, blocked, due soon, and at-risk items.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Production history readability fix

### What Was Built

- Improved production item history display with human-readable event titles and details.
- Existing history rows now resolve stage instance IDs into stage names and worker IDs into worker names where available.

### Bugs Found

- Item history displayed raw event keys like `stage_completed` without clearly explaining which stage changed or what happened next.

### Bugs Fixed

- History now shows messages such as `Cutting completed` and `Next stage is ready: Stitching`.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Date

2026-05-19

### Updated By

Codex AI agent

### Phase

Workflow Configuration validation fix

### What Was Built

- Fixed workflow sequence replacement validation for customer-facing status mappings.

### Bugs Found

- Reusing the same customer-facing status on multiple workflow stages caused validation to fail because duplicate selected IDs were compared against unique database rows.

### Bugs Fixed

- Deduplicated selected customer status IDs before tenant validation while preserving the per-stage mapping values used for saving.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Date

2026-05-20

### Updated By

Codex AI agent

### Phase

Phase 8 Salary and Worker Ledger foundation

### What Was Built

- Added salary and worker ledger migration with `worker_ledger`, `salary_periods`, and `salary_calculations`.
- Added salary enums for worker ledger transaction types, salary period statuses, and salary payment statuses.
- Added tenant-scoped salary queries and server actions.
- Added worker ledger entry creation with worker and salary-period tenant validation.
- Added draft salary period creation that generates salary suggestion rows for active workers.
- Added draft salary suggestion regeneration.
- Replaced the `/salary` placeholder with an MVP salary dashboard, salary period list, salary suggestion review section, and recent worker ledger section.

### Key Decisions Made

- Salary calculations store wage type, wage amount, attendance totals, productive minutes, deductions, credits, and final payable as a snapshot.
- Salary period creation remains draft-only; admin review/finalize/paid workflows are intentionally deferred.
- Hourly wages use attendance hours when available and productive work hours as fallback; daily, weekly, and monthly wages are attendance-day based.
- Per-piece and hybrid wage types remain schema-supported but are flagged for manual admin review in MVP.
- Ledger entries inside the salary period date range are included in salary suggestions; full outstanding loan/advance aging is deferred.

### Files/Modules Changed

- `supabase/migrations/20260520110000_salary_worker_ledger.sql`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/features/salary/actions.ts`
- `src/features/salary/queries.ts`
- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260520110000_salary_worker_ledger.sql` to the live Supabase project.
- Open `/salary` as an owner/admin or finance user and add sample ledger entries.
- Create a draft salary period after attendance and work logs exist, then verify generated suggestions.
- Add salary review, finalize, paid, and salary-paid ledger linkage controls later.

### Blockers

- `/salary` will error in the live app until the salary migration is applied to Supabase.

### Notes for Next Session

- Keep salary as system-suggested and admin-finalized; do not expand into statutory payroll.
- Consider a worker detail ledger section after the main salary foundation is tested.
- Next likely MVP slice is Finance basics: expenses and operational inflow/outflow summaries, while keeping GST/accounting integrations out of scope.

### Date

2026-05-20

### Updated By

Codex AI agent

### Phase

Phase 9 Finance Basics foundation

### What Was Built

- Added finance migration with tenant-owned `expenses` and `receivables_payables` tables.
- Added finance enums for receivable/payable type and status.
- Added TypeScript database types for finance tables and enums.
- Added `finance:manage` permission for owner/admin and finance roles.
- Added tenant-scoped finance queries and server actions.
- Added expense creation with tenant validation for selected expense category and payment mode.
- Added receivable/payable creation with tenant validation for optional linked order.
- Replaced the `/finance` placeholder with an MVP operational finance page showing collections, expenses, receivables, payables, and entry forms.

### Key Decisions Made

- Finance remains operational tracking only; GST, accounting ledger, bank reconciliation, Tally, and Zoho integrations stay out of MVP.
- Expenses use existing tenant-owned expense categories and payment modes.
- Receivables/payables can optionally link to an order, but the module does not yet automate collections or payment status updates.
- Recent collections are summarized from existing `order_payments` records rather than duplicating payment data into finance tables.

### Files/Modules Changed

- `supabase/migrations/20260520130000_finance_basics.sql`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/features/finance/actions.ts`
- `src/features/finance/queries.ts`
- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260520130000_finance_basics.sql` to the live Supabase project.
- Open `/finance` as an owner/admin or finance user and add sample expenses.
- Add receivable/payable records, including one linked to an existing order.
- Later add edit/status update controls for expenses and receivables/payables.

### Blockers

- `/finance` will error in the live app until the finance migration is applied to Supabase.

### Notes for Next Session

- Keep the next finance steps limited to operational UX improvements unless the MVP explicitly needs more.
- Next logical MVP slice is the public customer tracking page: token lookup, tenant branding, order summary, and customer-safe item statuses.

### Date

2026-05-20

### Updated By

Codex AI agent

### Phase

Finance and Order Payment Consistency Patch

### What Was Built

- Added order detail payment capture form.
- Added tenant-scoped order payment server action.
- Added payment-mode validation for additional order payments.
- Added overpayment protection for order payments.
- Added recalculation of `orders.amount_paid` and `orders.payment_status` from `order_payments` after recording a payment.
- Fixed order creation so the inserted initial payment amount matches the capped order `amount_paid` value.
- Updated Finance to show automatic order receivables derived from order total minus actual paid amount.
- Added guardrail preventing order-linked receivables from being marked paid or partially paid through manual receivable entry.

### Key Decisions Made

- `order_payments` is the source of truth for customer money collected against an order.
- Order receivables are derived from order total minus paid amount; staff should not manually recreate order balances as independent receivables.
- Manual receivables/payables remain for non-order operational dues and reminders.
- Marking a linked order receivable as paid must happen by recording a payment on the order, not by changing receivable status.
- This keeps finance integrity without introducing full double-entry accounting, GST, bank reconciliation, Tally, or Zoho-style complexity.

### Files/Modules Changed

- `src/features/orders/actions.ts`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/features/finance/actions.ts`
- `src/features/finance/queries.ts`
- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- Manual order-linked receivables could be marked paid without creating an `order_payments` row, causing finance and order payment state to disagree.
- Initial order creation capped `orders.amount_paid` but inserted the raw initial payment amount into `order_payments`.

### Bugs Fixed

- Order-linked receivable payment truth now flows through order payments.
- Additional order payments update both order payment rows and cached order payment summary.
- Initial payment row now matches the amount stored on the order.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test adding a second payment to a partially paid order and confirm `/orders/[orderId]` and `/finance` both update.
- Consider a future reconciliation/admin repair action to recalculate `orders.amount_paid` from `order_payments` for historical data if needed.
- Add payment edit/delete or reversal behavior later; do not hard-delete money records casually.

### Blockers

- None for this patch.

### Notes for Next Session

- Keep cash collection single-sourced in `order_payments`.
- Any future “mark paid” UI for an order-linked receivable must call the order payment flow.

### Date

2026-05-20

### Updated By

Codex AI agent

### Phase

Order entry customer search UX fix

### What Was Built

- Replaced the new-order customer dropdown with a searchable customer picker.
- Customer picker searches by customer name and phone number.
- Customer picker writes the selected customer ID into the existing order creation server action.
- Added a clear create-customer link when no matching customer is found.
- Captured future finance UX direction: full balance sheet / P&L-style views, tabs, breakdowns, CTAs, and date-range chips such as Today, MTD, YTD, and custom ranges.

### Key Decisions Made

- Customer search is an order-entry usability foundation, so it was fixed now instead of waiting for the larger UI overhaul.
- Finance visual overhaul is deferred; current finance work stays focused on data integrity and MVP foundations.

### Files/Modules Changed

- `src/components/orders/customer-picker.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `project_summary.md`

### Bugs Found

- Customer selection on the new order page was a plain dropdown, which does not scale to hundreds of customers.

### Bugs Fixed

- New order customer selection now supports fast name/phone search.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Later support inline customer creation without leaving the order flow.
- Later overhaul Finance into balance sheet, P&L, cashflow, date-range chips, tabbed views, and richer drilldowns.

### Blockers

- None.

### Notes for Next Session

- Keep improving high-friction operational entry points as they appear, even before the full UI redesign pass.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Phase 10 Customer Tracking Page foundation

### What Was Built

- Replaced the public tracking placeholder with a real token-based lookup.
- Added public tracking query that does not require Clerk or tenant membership.
- Public tracking page now loads active tenant branding, safe order summary, and customer-visible order items.
- Public tracking page shows order number, order date, promised delivery date, delivery type, overall progress, and item-wise customer-facing status.
- Order detail now shows a clickable `/track/[trackingToken]` path.

### Key Decisions Made

- Public tracking fetches only customer-safe fields.
- Public tracking does not expose worker names, internal workflow stages, work logs, salary, payment records, internal notes, or admin IDs.
- Item status prefers configured customer-facing status and falls back to safe item status when no customer status is mapped.
- Attachments remain deferred; only existing customer-visible final item photo URL is displayed when present.

### Files/Modules Changed

- `src/features/tracking/queries.ts`
- `src/app/(public)/track/[trackingToken]/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- Public tracking route was only a placeholder and did not look up real order data.

### Bugs Fixed

- Public tracking now resolves real order data by secure tracking token.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test a real order tracking link from order detail.
- Add customer-visible attachments later through a dedicated attachments table.
- Add copy-to-clipboard UX for tracking links later.
- Improve customer tracking visual design during the broader UI overhaul.

### Blockers

- None.

### Notes for Next Session

- Keep public tracking strictly customer-safe.
- Next likely MVP slice is tightening order operations, public tracking polish, or dashboard/reporting improvements depending on testing feedback.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

OS PLUS Design System Foundation and Order Command Center first pass

### What Was Built

- Updated base theme tokens toward the OS PLUS monochrome shadcn direction.
- Tuned base card and button styling for compact, precise admin surfaces.
- Added reusable `Badge` and `Separator` UI primitives.
- Added reusable `PageHeader`, `CommandBar`, `MetricCard`, and `StatusBadge` components.
- Refreshed order detail with a command-center first pass: page header actions, command bar, metric cards, cleaner status badges, tracking link CTA, and compact commercial/payment sections.

### Key Decisions Made

- OS PLUS admin UI defaults to strict monochrome: black primary CTAs, white/neutral surfaces, subtle borders, and compact ERP density.
- Tenant color should be used as an accent, especially for customer-facing branding and limited active states, not as the dominant admin UI theme.
- Dashboards should follow a Tremor-style visual direction, but we will build reusable dashboard primitives before deciding whether to add a dedicated Tremor package.
- Production, reports, and dashboard surfaces should borrow interaction patterns from ClickUp, Jira, Monday, and ERP-style command centers while staying shadcn-based.

### Files/Modules Changed

- `src/app/globals.css`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/separator.tsx`
- `src/components/layout/page-header.tsx`
- `src/components/layout/command-bar.tsx`
- `src/components/dashboard/metric-card.tsx`
- `src/components/design-system/status-badge.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Continue evolving order detail into a full command center with item stage matrix, current stage, active worker, and timestamps.
- Add tabs and richer tables to the design system.
- Build Tremor-style dashboard/reporting primitives for charts, date-range chips, and KPI grids.
- Apply the new design primitives gradually across finance, production, salary, attendance, and reports.

### Blockers

- None.

### Notes for Next Session

- Keep every new UI pass compact, operational, and shadcn-based.
- Avoid decorative or marketing-style layouts inside the tenant app.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Order Command Center production matrix

### What Was Built

- Extended order detail data loading with workflow instances, stage instances, stage master records, active work logs, workers, and customer-facing statuses for the order's items.
- Added per-item current stage visibility to the order detail page.
- Added per-item active worker visibility from in-progress work logs.
- Added per-item started/completed timestamps for the current stage.
- Added per-item stage completion progress bar.
- Added compact horizontal stage matrix cards for each production item.
- Kept the existing action boundary: item workflow actions remain on the production workflow page, while order detail becomes the command-center overview.

### Key Decisions Made

- Order detail should summarize production execution without duplicating every production action.
- Current stage is resolved from workflow instance current stage first, then fallback active/ready/blocked stage status.
- Active worker is shown only from an in-progress work log, avoiding stale assignment assumptions.
- Stage matrix stays compact and horizontally scrollable so multi-stage workflows do not break the command-center layout.

### Files/Modules Changed

- `src/features/orders/queries.ts`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- None during local verification.

### Bugs Fixed

- None in this slice.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test with orders containing initialized and uninitialized workflow items.
- Add customer-facing status controls later if operationally needed.
- Consider adding inline stage notes/status summaries after production note/status actions are built.

### Blockers

- None.

### Notes for Next Session

- Continue making order detail the operational command center while keeping production mutations on focused production workflow screens.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Design and UX roadmap checkpoint

### What Was Built

- Captured the next OS PLUS UX direction before continuing implementation.
- Confirmed the app should evolve into a compact, modern, shadcn-based operational workspace.
- Confirmed order detail should become the central command center for a single order.
- Confirmed production workflow editing/correction should be planned carefully as a separate guarded feature.

### Key Decisions Made

- Global font must move away from serif/browser-default feel to a modern sans platform font.
- Platform typography hierarchy must be standardized for page titles, card titles, labels, tables, metadata, and badges.
- The admin app should remain strict monochrome by default: black CTAs, white backgrounds, neutral surfaces, proper accents, and tenant color as a limited accent.
- Order detail needs a revised hierarchy: top command area, compact metrics, production item command center, commercial/payment summary, and customer context.
- Commercial summary and payment block should sit side by side on desktop.
- Tracking link should remain a top CTA and be removed from the commercial summary block.
- Payment section should become a finance-style payment table with a primary Add Payment modal and secondary Transaction Log modal/sheet.
- Customer name should become clickable and eventually open a right-side Notion-style customer drawer with previous orders, order statuses, and payment statuses.
- Stage timing details should move behind stage-level expand/dropdown/popover instead of appearing as top-level item-card clutter.
- Stage status display should be compact: completed stages use a green tick icon, in-progress stages show a visible label, not-started stages show no status text, blocked stages show warning.
- Internal workflow stages and customer-facing statuses must remain visually and semantically distinct to avoid confusing values like public `Delivered` while an internal delivery/handover stage is still in progress.
- Production workflow edit/correction should be a separate feature with a modal/sheet for status, worker, start time, completed time, and notes.

### Risks / Guardrails

- Do not let order-linked payment truth split across manual receivables and `order_payments`; order payments remain the source of truth.
- Do not allow arbitrary stage edits without server-side tenant, worker, workgroup, and timestamp validation.
- Do not blur customer-facing statuses with internal production stages.
- Do not overbuild full accounting, payroll, GST, bank reconciliation, Tally, or Zoho integrations in MVP.
- Do not turn tenant branding into a fully custom admin theme; keep tenant color as accent unless a later design decision says otherwise.

### Recommended Implementation Sequence

- First: Design System + Order Detail Layout Cleanup.
- Then: Production Stage Edit/Correction modal/sheet with strict validation and item history logging.
- Later: Finance/reporting dashboard overhaul with Tremor-style KPI cards, date-range chips, tabs, breakdowns, chart cards, and configurable views.

### Pending Tasks

- Add global sans typography and compact platform hierarchy.
- Refactor order detail commercial/payment sections.
- Add Add Payment modal/sheet and transaction log modal/sheet.
- Clean production item matrix stage statuses.
- Plan and build production stage edit/correction separately.

### Blockers

- None.

### Notes for Next Session

- If resuming from a clean session, read this section and continue with Design System + Order Detail Layout Cleanup.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Design System + Order Detail Layout Cleanup

### What Was Built

- Locked the global app body and form controls to the Geist/shadcn sans font stack.
- Tightened global heading hierarchy to use semibold sans typography.
- Reworked order detail commercial and payment summaries into side-by-side desktop cards.
- Removed the tracking link from the commercial summary because it already exists as a top action.
- Moved Add Payment into a compact popover-style disclosure inside the payment card.
- Replaced the separate bottom payment block with a finance-style payment table in the payment summary card.
- Added a transaction log disclosure for longer payment histories.
- Updated production item cards to distinguish public/customer status from internal production stage.
- Removed top-level current-stage start/completion timestamp clutter.
- Moved per-stage timing details into each stage card disclosure.
- Changed completed stage display to a compact green check icon, with in-progress/blocked/etc. still using visible status badges and not-started showing no status.

### Key Decisions Made

- Typography cleanup must happen globally before screen-by-screen UI polish.
- Order detail should keep payment actions close to the payment table, not as a separate prominent top-level section.
- Stage timing details are useful but secondary; they belong behind stage-level disclosure.
- Customer-facing item status and internal stage status must be presented as separate concepts.

### Files/Modules Changed

- `src/app/globals.css`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- Order detail JSX nesting broke during layout refactor and was fixed before final verification.

### Bugs Fixed

- Removed the extra closing JSX tag and restored successful typecheck/lint/build.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Replace native disclosure/popover behavior with proper shadcn Dialog/Sheet components once those primitives are added.
- Add customer side sheet from clickable customer name.
- Continue tightening the main orders list page to match the new compact operational style.
- Build production stage edit/correction as a separate guarded feature.

### Blockers

- None.

### Notes for Next Session

- Keep improving order detail in small, verified slices so UI cleanup does not break production/payment logic.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Main Orders List Redesign

### What Was Built

- Redesigned `/orders` into a compact operational command-center list.
- Added KPI cards for open orders, production item count, due-soon orders, and receivables.
- Added a shadcn-style command bar with search plus payment, order status, and source filters.
- Reworked recent orders into a dense table-like surface showing order number, customer, payment status, production progress, promised date, source, receivable balance, and item count.
- Added tenant-scoped production progress loading from `item_stage_instances` for order list rows.

### Key Decisions Made

- Chose Option A because the main orders list is the daily operational entry point and order detail already had a first command-center pass.
- Kept the slice schema-free and tenant-scoped; no new tables, migrations, or actions were introduced.
- Production progress is display-only on the orders list and continues to use production workflow pages for mutations.
- Receivable display remains derived from order total minus paid amount, preserving `order_payments` as the payment source of truth.

### Files/Modules Changed

- `src/app/(tenant)/orders/page.tsx`
- `src/features/orders/queries.ts`
- `project_summary.md`

### Bugs Found

- The existing orders list was too sparse for daily operations and did not surface production progress, receivables, or operational filters.

### Bugs Fixed

- Replaced the sparse card list with a dense operations table layout.
- Added stage-progress data to the tenant-scoped orders list query.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test `/orders` with a live tenant dataset containing mixed payment statuses, due dates, and initialized/uninitialized production workflows.
- Add a proper shadcn Select primitive later instead of native selects once the shared primitive exists.
- Continue with the customer side sheet on order detail or production stage correction modal as the next focused UX slice.

### Blockers

- None.

### Notes for Next Session

- Keep `/orders` as a fast scanning surface, not a mutation-heavy screen.
- Customer side sheet on order detail remains the best next order-context improvement.
- Production stage edit/correction should remain a separate guarded feature with strict tenant, worker, workgroup, and timestamp validation.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Order Command Center customer context sheet

### What Was Built

- Added a read-only customer context sheet for order detail.
- Made the customer name clickable from the order detail command bar.
- Customer sheet shows customer profile summary, contact fields, address, notes, recent orders, order statuses, payment statuses, item counts, totals, and receivables.
- Added tenant-scoped order detail data loading for the current customer's recent orders and related order item counts.
- Added a link from the sheet to the full customer profile and links to recent orders.

### Key Decisions Made

- Chose Option B after the main orders list redesign because order detail is becoming the operational command center.
- Kept the sheet read-only for now to avoid mixing customer edits into order operations.
- Did not add schema or new server actions.
- Kept all customer context queries tenant-scoped through the existing server-side tenant context.
- Used a small focused client component for the drawer because a shared shadcn Sheet/Dialog primitive does not exist in the codebase yet.

### Files/Modules Changed

- `src/components/orders/customer-context-sheet.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/features/orders/queries.ts`
- `project_summary.md`

### Bugs Found

- Order detail had customer name context only as static text and did not provide previous-order context without leaving the page.

### Bugs Fixed

- Added in-page customer context access from order detail.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Replace the focused custom drawer with a shared shadcn Sheet primitive once dialog/sheet primitives are added to the design system.
- Test the sheet with live tenants that have customers with many orders and customers with no prior orders.
- Add measurements summary to the customer sheet later if it becomes useful during order operations.
- Continue with production stage edit/correction modal/sheet as a separate guarded workflow feature.

### Blockers

- None.

### Notes for Next Session

- Keep customer context in order detail read-only until the customer edit workflow is intentionally designed.
- Any future customer drawer mutations must validate tenant ownership server-side.
- The next likely operational slice is production stage edit/correction with strict validation and item history logging.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Production Stage Correction foundation

### What Was Built

- Added guarded stage correction server action for production workflow stages.
- Added per-stage "Correct step" disclosure on `/production/items/[itemId]/workflow`.
- Correction form supports status, worker, started time, completed time, and notes.
- Server-side validation enforces tenant ownership, production permission, timestamp sanity, active worker ownership, and worker-to-stage workgroup eligibility.
- Stage corrections update stage instance state, relevant work logs, workflow instance current state, item status, and item history.

### Key Decisions Made

- Kept correction as a focused production workflow feature rather than adding edit controls to order detail.
- Used Zod validation for the new server action.
- Kept worker required only when correcting a stage to `in_progress`; completed stages may be corrected with timing and optionally a worker.
- Recomputed workflow/item state after correction from stage instances to reduce drift.
- Logged every correction to `item_history` with old and new stage values.

### Files/Modules Changed

- `src/features/production/actions.ts`
- `src/app/(tenant)/production/items/[itemId]/workflow/page.tsx`
- `project_summary.md`

### Bugs Found

- Production stages had start/complete actions but no guarded correction path for manager/admin data fixes.

### Bugs Fixed

- Added a first correction path with tenant validation, workgroup validation, timestamp validation, and history logging.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test corrections on live data for ready, in-progress, completed, blocked, and skipped stages.
- Consider replacing native disclosure controls with a shared shadcn Sheet/Dialog primitive later.
- Add stronger sequence rules later if the business wants to prevent correcting a later stage before an earlier mandatory stage is complete.
- Add a clearer audit timeline view for `stage_corrected` events if managers need detailed old/new display.

### Blockers

- None.

### Notes for Next Session

- Stage correction is intentionally powerful; keep future changes server-validated and history-logged.
- Do not expose production correction on public tracking or customer-facing surfaces.
- The next likely UX slice can be finance workspace polish or deeper production dashboard controls after live testing.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Finance Workspace UX Polish

### What Was Built

- Reworked `/finance` from a form-first page into a compact operational finance workspace.
- Added `PageHeader`, `CommandBar`, and `MetricCard` patterns to finance.
- Added date-range chips for Recent, Today, MTD, and YTD filtering on visible cash movement and KPI totals.
- Added KPI row for collections, expenses, net cash, receivables, and payables.
- Moved Add Expense and Add Due forms into compact command-bar disclosures.
- Added a combined cash movement list for collections and expenses.
- Tightened order receivables, manual dues, overdue dues, and expense breakdown sections.

### Key Decisions Made

- Finance remains operational tracking only, not full accounting.
- Order receivables continue to be derived from order total minus paid amount.
- Order payment truth remains in `order_payments`; manual dues remain separate.
- Used page-level filtering over the current recent query window and avoided schema changes.
- Kept native disclosure/select controls for now until shared shadcn Dialog/Sheet/Select primitives are added.

### Files/Modules Changed

- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- Finance was usable but too form-heavy and did not yet feel like a compact workspace for scanning cash, dues, and receivables.

### Bugs Fixed

- Rebalanced finance into a workspace layout with KPIs, command actions, cash movement, dues, and breakdowns.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test `/finance` with live tenant data across date ranges.
- Add proper shadcn Select/Dialog/Sheet primitives later.
- Add real chart cards only after finance data volume and reporting needs are clearer.
- Add edit/status update controls for expenses and manual receivables/payables later.

### Blockers

- None.

### Notes for Next Session

- Keep finance focused on operational cash tracking until MVP demands deeper accounting.
- Do not add GST, bank reconciliation, double-entry ledger, Tally, or Zoho-style integrations in MVP.
- Next useful slices: production dashboard controls, customer profile UX, or dashboard/reporting primitives.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Production Dashboard Workspace Polish

### What Was Built

- Reworked `/production` into a denser production workspace.
- Added `PageHeader`, `MetricCard`, `CommandBar`, and `StatusBadge` patterns.
- Added search across item, order, customer, workflow, and stage.
- Added queue filter for all, ready, in progress, blocked, due soon, delayed, and uninitialized items.
- Replaced the split queue card layout with a scan-friendly production queue table.
- Added attention board for delayed, blocked, and due-soon items.
- Added queue mix shortcuts to jump into focused production queues.

### Key Decisions Made

- Kept production dashboard read/scanning focused; workflow mutations remain on `/production/items/[itemId]/workflow`.
- Avoided schema changes and reused tenant-scoped production query data.
- Kept queue filters server-rendered through search params for simple, durable MVP behavior.
- Continued the compact monochrome admin direction using the shared design primitives.

### Files/Modules Changed

- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- Production dashboard had useful queue buckets but the page was too card-heavy for fast operational scanning.

### Bugs Fixed

- Rebalanced production into a single queue workspace with search, filtering, risk signals, and compact rows.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test `/production` with live tenant data across ready, in-progress, blocked, delayed, and uninitialized states.
- Add assigned/active worker visibility to the main production queue later if managers need it outside the item workflow page.
- Consider persisted queue views only after real usage patterns are clear.
- Replace native select with a shared shadcn Select primitive later.

### Blockers

- None.

### Notes for Next Session

- Keep `/production` as the high-level queue and `/production/items/[itemId]/workflow` as the action surface.
- Good next slices: customer profile UX, dashboard/reporting primitives, or attendance/salary workspace polish.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Finance Consistency and Edit Controls Patch

### What Was Built

- Removed order-linked manual receivable creation from the finance UI and server action.
- Kept order receivables derived only from order total minus actual order payments.
- Added finance edit actions for expenses, manual receivables/payables, and order payments.
- Added edit dialogs for cash movement entries and manual dues, available to tenant users with `finance:manage`.
- Removed the recurring expense checkbox from the finance UI and forced new/updated expenses to `is_recurring = false`.
- Added a shared centered `Dialog` component with close button, click-outside close, and Escape close.
- Replaced finance command-bar `<details>` popups with centered dialogs.
- Excluded legacy order-linked manual receivables from manual receivable totals and surfaced a warning if such old records exist.

### Key Decisions Made

- Tenant `owner_admin` and `finance` can edit finance records through the existing `finance:manage` permission.
- Manual dues are for non-order receivables/payables only.
- Revenue/payment edits update `order_payments` and then recalculate the cached order payment summary.
- The MVP should not expose recurring expenses until recurrence interval and generation behavior are explicitly designed.
- Existing legacy order-linked manual receivables are not counted in finance totals to avoid double-counting order balances.

### Files/Modules Changed

- `src/components/ui/dialog.tsx`
- `src/features/finance/actions.ts`
- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- Manual receivables could still be linked to a specific order, causing order balances to be counted separately from order payments.
- Open manual receivables/payables could be created but not clearly updated or closed.
- Expense creation exposed a recurring checkbox without interval or recurring-entry generation.
- Finance popups were anchored to CTAs and lacked proper close UX.

### Bugs Fixed

- Removed order-linked manual receivable creation.
- Added update flows for manual dues, expenses, and order payments.
- Removed misleading recurring expense UI.
- Added centered dialog UX with close affordances.
- Prevented legacy linked manual receivables from inflating manual receivable totals.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test editing an order payment and confirm order detail plus finance receivables update correctly.
- Test closing manual receivables/payables by updating status to paid or cancelled.
- Decide whether legacy order-linked manual receivable rows should get a one-time cleanup or migration later.
- Consider adding audit/history tables for finance edits before production use if stronger traceability is required.

### Blockers

- None.

### Notes for Next Session

- Keep order money single-sourced in `order_payments`.
- Do not reintroduce order-linked manual receivables.
- Treat recurring expenses as a future feature that needs interval, next-run date, and generated entry behavior.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Production Dashboard Feedback Patch

### What Was Built

- Removed the redundant Queue Mix panel from `/production`.
- Converted the top production count cards into clickable queue filters.
- Added selected visual styling to the active production filter card.
- Changed default production view to `Active workshop`.
- Excluded only delivered items from the default active workshop view.
- Added explicit `Delivered` filter card for completed handoff items.
- Kept dispatched, ready for dispatch, completed production, and other non-delivered items visible in active production tracking.
- Removed the queue dropdown from the command bar and kept search as the secondary filter.

### Key Decisions Made

- Only `delivered` means fully completed/removed from active production tracking.
- `dispatched` is still actively tracked because it has not been delivered yet.
- Top KPI cards are now the primary queue navigation, replacing duplicate queue mix controls.
- The production dashboard remains a scanning/triage surface; quick workflow update popup is a planned next slice.

### Files/Modules Changed

- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- Queue Mix repeated the same counts already shown in the top KPI row.
- Delivered items were appearing in the default production queue even though they are no longer in the workshop.

### Bugs Fixed

- Removed Queue Mix.
- Default queue now excludes delivered items.
- Added explicit delivered filter.
- Made top queue counts clickable and visually selectable.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Build quick workflow update popup/sheet from production rows.
- Keep full workflow page available for detailed workflow history and deeper review.
- Test default active production with real item statuses: completed, ready for dispatch, dispatched, delivered, cancelled, and blocked.

### Blockers

- None.

### Notes for Next Session

- Production default view should mean active workshop tracking, excluding delivered only.
- Dispatched items remain active until delivered.
- Next production UX slice should focus on inline quick actions instead of forcing navigation to the full workflow page.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Production Attention Board Logic Patch

### What Was Built

- Clarified production dashboard handling of delivery-stage items.
- Active production still excludes only `item_status = delivered`.
- Renamed active internal stage display from `Delivered` to `Delivery / handoff` when the item is not actually delivered.
- Tightened Attention Board logic so it no longer lists every due-soon item by default.
- Attention Board now focuses on delayed, explicitly blocked, ready-to-start, and order-blocking items.
- Added order-blocking detection for items ready/completed/ready-for-dispatch/dispatched while another item in the same order is not yet ready.

### Key Decisions Made

- A stage named `Delivered` does not mean the item is delivered if the item status is not `delivered`.
- `dispatched` remains active production tracking until customer handoff/delivery is complete.
- Due-soon items belong in the Due Soon filter, not necessarily the Attention Board.
- Explicit blocked state remains based on stage/item blocked status; order-blocked is a derived attention signal, not a persisted status.

### Files/Modules Changed

- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- Active delivery/handoff stage label appeared as `Delivered`, making an in-progress item look completed.
- Attention Board included due-soon items even when they were not blocked, ready, or delayed.

### Bugs Fixed

- Active delivery-stage rows now display `Delivery / handoff` unless item status is actually `delivered`.
- Attention Board now uses tighter operational criteria.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test order-blocking detection with live orders containing multiple items in mixed readiness states.
- Consider adding a dedicated persisted blocked reason later if managers need manual block/unblock workflows.
- Build quick workflow update popup/sheet from production rows.

### Blockers

- None.

### Notes for Next Session

- Do not treat internal stage names as final customer handoff state.
- Delivered means `item_status = delivered`; delivery/handoff stages can still be active.
- Finance needs a planned tabbed workspace redesign before the next finance UI pass.

### Date

2026-05-21

### Updated By

Codex AI agent

### Phase

Production Delivery Sync and Order Fulfillment Clarity

### What Was Built

- Updated production dashboard to treat a fully completed workflow with a final delivery/handoff stage as effectively delivered.
- Updated stage completion logic so future completed final delivery/handoff stages set `order_items.item_status = delivered`.
- Updated stage correction logic so corrected completed final delivery/handoff workflows set `order_items.item_status = delivered`.
- Added order fulfillment status syncing from item statuses after stage start, complete, and correction.
- Added clearer order detail fulfillment display with delivered item counts and a delivery metric.

### Key Decisions Made

- Delivery/handoff stage completion should promote the production item to `delivered`.
- Order status should be synced from item statuses: all delivered becomes `completed`, some delivered becomes `partially_delivered`, active work becomes `in_progress`.
- Existing data may still contain items marked `completed` even when the final delivery stage is complete; production/order views now interpret those as effectively delivered when the final stage indicates delivery.

### Files/Modules Changed

- `src/features/production/actions.ts`
- `src/app/(tenant)/production/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- Completing the final delivery/handoff stage set item status to `completed` rather than `delivered`.
- Order detail did not make delivery/completion fulfillment clear enough.

### Bugs Fixed

- Future delivery/handoff workflow completion now marks the item delivered.
- Order status sync now runs after production stage mutations.
- Order detail now shows delivered item count and fulfillment badge/metric.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test ORD-000001 and other historical completed-delivery-stage items in the live tenant.
- Consider a one-time repair action/migration to persist `item_status = delivered` for historical items whose final delivery/handoff stage is already complete.
- Continue planning finance tabbed workspace redesign before implementation.

### Blockers

- None.

### Notes for Next Session

- If historical data still displays inconsistently, add a controlled tenant-scoped repair action rather than manually editing records.
- Keep order status derived from item delivery states; avoid manually splitting commercial order status from production fulfillment without a clear model.

### Date

2026-05-22

### Updated By

Codex AI agent

### Phase

Finance Manual Dues Settlement Model

### What Was Built

- Added settlement tracking to manual receivables/payables.
- Added migration `20260522100000_finance_due_settlements.sql`.
- Added `amount_settled` and `settled_at` to receivables/payables.
- Updated manual due creation/editing to capture total amount, amount settled, due date, settlement date, and notes.
- Removed manual due status selection from finance forms.
- Derived manual due status from amount, amount settled, due date, and cancellation state.
- Counted settled receivables as cash inflow and settled payables as cash outflow.
- Updated Dues Board to show total amount, settled amount, balance, and derived status.

### Key Decisions Made

- `amount` is the original receivable/payable obligation.
- `amount_settled` is cash received for receivables and cash paid out for payables.
- Only `amount - amount_settled` counts as receivable/payable balance.
- `overdue` is derived when balance remains and due date is in the past.
- `partially_paid` is derived when settled amount is greater than zero but less than total.
- Worker loans/advances should remain sourced from Worker Ledger and appear in finance later as a linked view, not duplicate manual dues.

### Files/Modules Changed

- `supabase/migrations/20260522100000_finance_due_settlements.sql`
- `src/types/database.ts`
- `src/features/finance/actions.ts`
- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- Manual dues could be marked open/partial/overdue without recording any settled amount.
- A past-due open receivable did not automatically become overdue.
- Partially paid receivables/payables did not clearly say whether amount meant original amount, settled amount, or remaining balance.

### Bugs Fixed

- Manual due status is now derived from balance and due date.
- Cashflow now includes settled manual receivables/payables.
- Dues Board now shows balance explicitly.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `supabase/migrations/20260522100000_finance_due_settlements.sql` to the live Supabase project.
- Test creating an overdue receivable by choosing a past due date.
- Test partially settled receivables and payables and confirm cashflow/dues balances update.
- Add finance tabbed views: Dashboard, Cashflow, Receivables, Payables, P&L, Balance.
- Add Worker Ledger-derived loan/advance visibility in Finance later without duplicating worker ledger records.

### Blockers

- Live `/finance` will need the new migration before using manual due settlement fields.

### Notes for Next Session

- Do not let users manually choose partial/overdue status without the underlying amount/date evidence.
- Receivable settlement is cash inflow; payable settlement is cash outflow.
- Finance tabbed workspace redesign is the next major finance UX slice.

### Date

2026-05-22

### Updated By

Codex AI agent

### Phase

Finance Workspace Redesign Phase 1

### What Was Built

- Reworked `/finance` into a server-rendered tabbed workspace with Dashboard, Cashflow, Receivables, and Payables tabs.
- Added range filters for Today, This Week, MTD, YTD, and Custom date windows.
- Added owner-focused Dashboard snapshot with cash in, cash out, net cash, open receivables, payables, simple position, attention items, and expense breakdown.
- Split Cashflow into actual money movement only: order payments, manual receivable settlements, expenses, and payable settlements.
- Split Receivables into derived order receivables and non-order manual receivables.
- Split Payables into manual payable balances and settlement actions.
- Kept existing Add Expense, Add Due, Edit Expense, Edit Order Payment, and Edit Manual Due actions working.

### Key Decisions Made

- Kept phase 1 as a page-level workspace redesign without schema changes.
- Kept tabs and date ranges server-rendered through search params.
- Preserved order payments as the source of truth for order receivables.
- Preserved manual due status derivation from amount, amount settled, due date, and cancellation state.
- Left P&L and Balance as planned next views rather than forcing partial accounting into this slice.

### Files/Modules Changed

- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- The finance page still mixed dashboard, cashflow, receivables, and payables into one scanning surface.
- The previous range set did not include This Week or Custom, which owners need for day-to-day review.
- Local `git diff` is not reliable from this folder because `D:\Develop\os-plus` does not contain its own `.git` directory.

### Bugs Fixed

- Rebalanced Finance into focused operational tabs.
- Added date range handling for Today, This Week, MTD, YTD, and Custom.
- Tightened local TypeScript types for the narrow order select used by the tenant-scoped finance query.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test `/finance` against live Phantom Threads data across Dashboard, Cashflow, Receivables, and Payables.
- Add P&L as an MVP operating revenue/expenses/profit view.
- Add Balance as a simple owner-useful cash plus receivables minus payables position.
- Consider increasing or paginating finance query windows before relying on YTD for larger tenants.
- Add Worker Ledger-derived loan/advance visibility later without duplicating worker ledger records.

### Blockers

- None.

### Notes for Next Session

- The Supabase settlement migration was reported applied manually to live Supabase with schema reload before this slice.
- Keep finance operational and owner-useful; do not add GST, bank reconciliation, double-entry accounting, Tally, Zoho, or full statutory accounting.
- Continue to keep order receivables derived only from order totals minus order payments.

### Date

2026-05-22

### Updated By

Codex AI agent

### Phase

Orders and Workflow Command-Center UX

### What Was Built

- Added clickable order dashboard chips for Active, All, Due Soon, Delayed, Unpaid, Partially Paid, Ready / Dispatch, and Delivered views.
- Replaced the fixed five-row new order item form with a dynamic Zoho-style item row builder.
- Added add/delete item row controls during order creation.
- Kept workflow selection explicit for each order item before creation.
- Added a workflow context/info block on new order creation that summarizes active workflows.
- Changed order creation parsing to support dynamic item row IDs while preserving the old fixed-row fallback.
- Moved the order detail workflow CTA beside the item’s internal workflow/stage context.
- Added a reusable `ItemWorkflowPanel` for actionable workflow management.
- Replaced the old clunky full workflow page with the shared workflow panel.
- Added actionable workflow side panes from order detail and production dashboard rows.
- Added an `Open full page` secondary CTA from workflow panes.
- Extended the shared dialog primitive to support right-side pane placement.

### Key Decisions Made

- Orders list chips are server-rendered through search params, matching the production dashboard pattern.
- New order creation must ask for workflow clearly per item instead of silently defaulting from item type.
- Workflow can still be changed/corrected later; the order creation workflow choice is the starting production path.
- Stage actions are allowed in the side pane, not reserved only for the full workflow page.
- The full workflow page and side panes now share the same workflow UI component to avoid divergent behavior.

### Files/Modules Changed

- `src/app/(tenant)/orders/page.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/app/(tenant)/production/page.tsx`
- `src/app/(tenant)/production/items/[itemId]/workflow/page.tsx`
- `src/components/orders/order-item-builder.tsx`
- `src/components/production/item-workflow-panel.tsx`
- `src/components/ui/dialog.tsx`
- `src/features/orders/actions.ts`
- `src/features/orders/queries.ts`
- `project_summary.md`

### Bugs Found

- New order creation had a hardcoded five-item template with no add/delete control.
- Order workflow entry was separated from the actual workflow/stage context in order detail.
- Workflow management UI was duplicated as a bulky full-page form stack and was not reusable for side-pane operations.
- The first unauthenticated `/orders` smoke request briefly returned a dev-server 404, while `/orders?view=active` returned the expected Clerk sign-in rewrite afterward.

### Bugs Fixed

- Dynamic item rows now submit safely through explicit row IDs.
- Orders now support chip-driven operational filtering.
- Workflow action UI is now shared between full page and side pane contexts.
- Production dashboard rows and attention items now open actionable workflow panes instead of forcing immediate navigation.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke checks for `/orders/new`, `/production`, and `/orders?view=active` returned Clerk sign-in rewrites when unauthenticated.

### Pending Tasks

- Test order chip counts and filters with live Phantom Threads data.
- Test dynamic order item creation with one item, multiple items, deleted rows, and explicit workflow choices.
- Test actionable workflow side panes with live ready-to-start, in-progress, blocked, and completed stages.
- Add a true workflow-change/edit action for changing an item’s workflow after creation if the business wants that available from order detail.
- Consider a more compact mobile treatment for the wide item-row builder after live use.

### Blockers

- None.

### Notes for Next Session

- Keep order list as the commercial command center and item workflow panes as the production action surface.
- Do not remove the full workflow page; it remains the deeper operational view opened from side panes.
- Side pane actions use the same server actions and tenant validation as the full page.

### Date

2026-05-22

### Updated By

Codex AI agent

### Phase

Orders and Workflow UX Feedback Patch

### What Was Built

- Moved the order detail `Open workflow` action out of the internal-stage label area and into the workflow stage strip after the visible stages.
- Simplified the order detail stage strip by removing timing dropdowns.
- Changed stage strip cards to show status directly under the stage name.
- Converted Add Payment on order detail into a centered dialog with overlay and close behavior.
- Kept global popup behavior aligned with the shared `Dialog` primitive.
- Made workflow stage cards in the side pane/full page more compact.
- Replaced the `Correct stage` disclosure with a pencil icon that opens a correction popup.
- Added Workflow and History tabs to the workflow panel so stage operations keep focus while activity is one click away.
- Reworked Recent History from stacked cards into a timeline-style activity feed.
- Added start/end timing as tertiary text on each stage in the workflow panel.
- Removed the open Workflow Context block from order creation.
- Moved workflow guidance behind an info icon beside the Workflow label.
- Reworked the order item builder to be mobile-friendly instead of forcing a wide table on small screens.
- Updated the item-name placeholder to `Enter item description`.

### Key Decisions Made

- Payment dialogs should use the centered popup pattern, not anchored disclosure popovers.
- Workflow history should be secondary to stage operations and live in a tab.
- Stage correction is still available in side panes, but hidden behind a compact edit affordance.
- Order item entry should behave as a stacked form on mobile and a dense row layout on desktop.

### Files/Modules Changed

- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/components/orders/order-item-builder.tsx`
- `src/components/production/item-workflow-panel.tsx`
- `project_summary.md`

### Bugs Found

- Add Payment used an anchored disclosure that could only be closed by toggling the same CTA.
- Order detail mini workflow cards truncated stage names and hid useful status behind timing disclosure.
- Workflow correction controls took too much visual space in the side pane.
- Recent workflow history was visually noisy as stacked cards.
- New order item entry remained clunky on mobile due to the wide table treatment.

### Bugs Fixed

- Add Payment now opens as a centered closeable dialog.
- Stage status is visible directly in order detail and workflow panels.
- Correction controls now open through a compact pencil popup.
- Recent History now uses a timeline view in its own tab.
- Order item rows now stack cleanly on mobile and remain dense on desktop.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke checks for `/orders/new`, `/orders?view=active`, and `/production?queue=active` returned Clerk sign-in rewrites when unauthenticated.

### Pending Tasks

- Review workflow panel visuals with live tenant data and long stage names.
- Validate the Workflow/History tab interaction inside the side pane after authenticated browser testing.
- Test dynamic order item entry on actual mobile viewport with real item types/workflows.

### Blockers

- None.

### Notes for Next Session

- Keep anchored popovers out of important form actions; use centered dialogs or side panes.
- Continue treating workflow actions as operational controls, with history/audit kept nearby but not visually dominant.

### Date

2026-05-23

### Updated By

Codex AI agent

### Phase

Order Delivered Status and Workflow CTA Patch

### What Was Built

- Added `delivered` as an order status in application types.
- Added migration `20260523100000_order_status_delivered.sql` to add `delivered` to the Postgres `order_status` enum.
- Added migration `20260523101000_backfill_delivered_order_status.sql` to backfill orders whose non-deleted items are all delivered.
- Updated production order fulfillment sync so an order becomes `delivered` when all order items are delivered.
- Updated order list active/due/delayed/delivered filters to account for the new `delivered` order status.
- Changed order detail `Open workflow` from a text CTA after the stage strip into a compact route/path icon CTA on the left side of the workflow stages.
- Fixed Workflow/History tab active states by making the radio/label/content structure work with peer styling.

### Key Decisions Made

- `delivered` is now the final order handoff status, while `completed` can remain available for older/commercial completion semantics.
- Active order filters should exclude `delivered` orders.
- The workflow pane entry should remain visible even when the stage strip is horizontally long.

### Files/Modules Changed

- `src/features/production/actions.ts`
- `src/types/database.ts`
- `src/app/(tenant)/orders/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/components/production/item-workflow-panel.tsx`
- `supabase/migrations/20260523100000_order_status_delivered.sql`
- `supabase/migrations/20260523101000_backfill_delivered_order_status.sql`
- `project_summary.md`

### Bugs Found

- All-delivered order items synced the parent order to `completed`, not `delivered`.
- Long workflow stage strips could push the text `Open workflow` CTA out of view.
- Workflow/History tabs did not visually show active state because the `peer` selectors were not applied to sibling labels.

### Bugs Fixed

- Final all-item handoff now syncs order status to `delivered`.
- Workflow entry is now a compact icon CTA placed before the stage strip.
- Workflow/History tabs now visibly switch active state.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply the new delivered order status migrations to live Supabase before relying on `delivered` order status in production.
- Test completing the final delivery/handoff stage for every item in a live order and confirm the order status becomes `delivered`.
- Test the workflow icon CTA on orders with long workflows and narrow screens.

### Blockers

- Live Supabase must receive the enum migration before code that writes `order_status = delivered` can work against production data.

### Notes for Next Session

- Run `20260523100000_order_status_delivered.sql` before `20260523101000_backfill_delivered_order_status.sql`.
- Keep `delivered` as completed customer handoff, not merely internal production completion.

### Date

2026-05-23

### Updated By

Codex AI agent

### Phase

Post-Creation Workflow Change

### What Was Built

- Added `changeItemWorkflowAction` for changing an order item workflow after creation.
- Added Zod validation for workflow change inputs.
- Validates the order item belongs to the current tenant.
- Validates the selected workflow belongs to the tenant and is active.
- Requires a reason when changing workflow.
- Soft-closes the previous active workflow instance and stage instances.
- Cancels active in-progress work logs when workflow changes.
- Updates the order item to the new workflow and resets item status to `not_started`.
- Creates a fresh workflow instance and stage instances from the selected workflow.
- Writes a `workflow_changed` item history event with old workflow, new workflow, and whether work had already started.
- Added a `Change workflow` dialog to the shared workflow panel, available in full page and side pane views.
- Added warning copy when changing workflow after work has started.
- Extended production item query data to include active tenant workflows for the change workflow dialog.

### Key Decisions Made

- Workflow change is allowed after work starts, but only with an explicit reason and visible warning.
- Old workflow execution records are soft-closed rather than hard deleted.
- Existing audit/history remains available; the new workflow starts fresh.
- Active work logs are cancelled when the workflow path changes to avoid pretending old work belongs to the new workflow.

### Files/Modules Changed

- `src/features/production/actions.ts`
- `src/features/production/queries.ts`
- `src/components/production/item-workflow-panel.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- The product copy promised workflow could change later, but there was no safe workflow-change action or UI.

### Bugs Fixed

- Added a guarded workflow-change path that preserves old records, creates a fresh workflow, and logs the reason.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Test changing workflow before work starts.
- Test changing workflow after a stage has started and confirm active work logs are cancelled.
- Test changing workflow after one or more completed stages and confirm old activity remains visible in history.
- Consider whether a future version should support mapping completed old stages into a new workflow instead of always resetting.

### Blockers

- None for local code.
- Live Supabase still needs the delivered order status migrations from the previous slice before delivered order sync can run safely in production.

### Notes for Next Session

- Workflow change intentionally resets the item to a fresh workflow path; do not merge old stage completion into the new workflow unless explicitly designed.
- Keep workflow change manager/admin controlled through `production:manage`.

### Date

2026-05-23

### Updated By

Codex AI agent

### Phase

Global Dialog Submit Close Patch

### What Was Built

- Updated the shared `Dialog` primitive so any valid form submission inside a dialog closes the popup immediately.
- This applies globally to workflow change, stage correction, add payment, finance dialogs, and other shared dialog forms.

### Key Decisions Made

- Close-on-submit belongs in the shared dialog primitive, not in each individual form.
- Native browser validation still runs first; invalid required fields should prevent submit and keep the dialog open.

### Files/Modules Changed

- `src/components/ui/dialog.tsx`
- `project_summary.md`

### Bugs Found

- Dialogs stayed open after server action form submissions, including workflow change.

### Bugs Fixed

- Added form submit capture on the dialog panel to close popups when a form submit starts.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Live-test workflow change and add payment dialogs to confirm the popup closes while the page refresh/revalidation completes.

### Blockers

- None.

### Notes for Next Session

- If we later add inline server-action error rendering inside dialogs, revisit close-on-submit so failed server validations can keep or reopen context.

### Date

2026-05-24

### Updated By

Codex AI agent

### Phase

Finance Workspace Phase 2

### What Was Built

- Added Finance P&L tab for simple MVP operating revenue, operating expenses, and operating profit.
- Added Finance Balance tab for owner-useful range net cash, open receivables, open payables, and simple position.
- Added order date to the finance orders query so booked order revenue can be calculated by selected date range.
- Kept Finance phase 2 schema-free and server-rendered through the existing tab/range search params.

### Key Decisions Made

- P&L uses booked order value in the selected range as operating revenue, while Cashflow remains the place for actual collections.
- Balance is intentionally a practical owner snapshot, not a statutory balance sheet or bank balance.
- Manual order-linked receivables remain excluded from finance totals; order receivables are still derived from order total minus order payments.
- No GST, double-entry accounting, bank reconciliation, Tally, Zoho, or full accounting complexity was added.

### Files/Modules Changed

- `src/app/(tenant)/finance/page.tsx`
- `src/features/finance/queries.ts`
- `project_summary.md`

### Bugs Found

- Live Supabase still cannot safely use `order_status = delivered` until the delivered enum migration is applied.
- This local workspace has Supabase app credentials but no database connection string, Supabase CLI project config, or SQL execution helper for applying arbitrary enum SQL from Codex.

### Bugs Fixed

- None in this slice; this was an additive Finance phase 2 workspace update.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply `20260523100000_order_status_delivered.sql` to live Supabase before `20260523101000_backfill_delivered_order_status.sql`.
- Live-test workflow change before work starts, after a stage starts, and after completed stages.
- Live-test Finance P&L and Balance tabs with Phantom Threads data.
- Continue order detail command-center polish.
- Build owner dashboard with active orders, delayed production, today’s cash, overdue dues, and attendance alerts.

### Blockers

- Live Supabase delivered status migration requires a manual SQL editor run, Supabase CLI project config, or a database connection string; service-role REST credentials alone are not enough to run the enum migration safely.

### Notes for Next Session

- Run the delivered enum migration before the backfill migration.
- Treat P&L as a simple operating view and Balance as an owner position snapshot; do not expand this into full accounting unless explicitly scoped.
- Keep order receivables derived only from order totals minus order payments.

### Date

2026-05-24

### Updated By

Codex AI agent

### Phase

Dashboard Planning and Architecture Alignment

### What Was Built

- Expanded the PRD dashboard module into a business source-of-truth command center.
- Added dashboard drilldown rules: dashboard widget, side pane, and full analytics page.
- Added planned dashboard tabs: Overview, Sales, Production, Workers, Finance, and Alerts.
- Added sales analytics requirements for daily bar chart, count/amount toggle, and daily/monthly/custom range drilldowns.
- Added worker productivity analytics requirements with the MVP 1 / 0.5 productivity counting rule.
- Added stale / at-risk production control rules for delayed, due-soon, blocked, stale ready, and stale in-progress items.
- Added finance dashboard requirements for cash, dues, upcoming/overdue receivables/payables, P&L, and balance snapshots.
- Added a WBS phase for Dashboard and Analytics with buildable slices.
- Added a technical development phase for Owner Dashboard and Analytics Command Center.
- Finalized the chart stack decision as Recharts-first, with Tremor-inspired patterns but no Tremor dependency until React 19 compatibility is safe.

### Key Decisions Made

- `/dashboard` should be the single source of truth for the business, not a marketing or placeholder landing page.
- Every major dashboard widget should support side-pane drilldown and full-page customization.
- Sales amount should be treated as booked order value by default, with collections shown separately.
- Worker productivity should count completed assigned item-stage work as `1` and started/touched-but-not-completed work as `0.5`.
- Stale/at-risk rules start simple for MVP and can become tenant-configurable later.
- Use Recharts for charts because the current app is on React 19 and `@tremor/react` still carries a React 18 peer dependency.

### Files/Modules Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/07_Tech_Stack.md`
- `project_summary.md`

### Bugs Found

- Existing planning docs described dashboards too narrowly compared with the intended business source-of-truth role.
- `@tremor/react` currently has a React 18 peer dependency, while OS PLUS is on React 19.

### Bugs Fixed

- Planning docs now clearly describe dashboard scope, drilldown behavior, data areas, and chart stack direction before implementation starts.

### Pending Tasks

- Install Recharts before implementing chart components.
- Build dashboard tenant-scoped query layer.
- Build dashboard overview widgets and tabs.
- Build sales chart with side pane/full-page drilldown.
- Build worker productivity chart with worker filters.
- Build stale / at-risk item list with workflow links.
- Build finance dues and attention summaries.
- Apply live Supabase delivered status migrations.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Start implementation with dashboard query/data shaping first, then reusable chart/widget components, then the `/dashboard` overview.
- Keep dashboard compact, monochrome, shadcn-based, and operational.
- Do not install Tremor yet unless its React compatibility changes or the dependency risk is explicitly accepted.

### Date

2026-05-24

### Updated By

Codex AI agent

### Phase

Dashboard Command Center Phase 1

### What Was Built

- Replaced the placeholder `/dashboard` with a compact business command center.
- Added dashboard tabs for Overview, Sales, Production, Workers, Finance, and Alerts through search params.
- Added KPI cards for active orders, delayed items, ready handoff, today cash, receivables, and payables.
- Added Recharts-powered sales bar chart with amount/count toggle.
- Added Recharts-powered worker productivity line chart using the MVP 1 / 0.5 productivity signal.
- Added side-pane drilldowns for Sales and Worker Productivity charts.
- Added full analytics routes `/dashboard/sales` and `/dashboard/workers`.
- Added stale / at-risk production item list combining delayed, blocked, due-soon, ready-to-start, and in-progress items.
- Added finance pressure panel with cash/dues summary and upcoming/overdue due list.
- Added owner attention queue with delayed/blocked/ready handoff items, overdue dues, and attendance alerts.
- Added tenant-scoped dashboard query layer.
- Installed `recharts` and `react-is`.
- Updated Clerk from `7.3.5` to `7.4.1`, clearing the high-severity transitive `js-cookie` audit finding.

### Key Decisions Made

- Dashboard Phase 1 remains read-only and derives from existing tenant-owned operational tables.
- Sales chart defaults to booked order value, with order count available through a toggle.
- Worker productivity remains an operational signal separate from salary finalization.
- Full analytics pages are intentionally basic in this pass; custom filters and monthly grouping come next.
- Recharts is now the chart engine. Tremor remains visual inspiration only.

### Files/Modules Changed

- `package.json`
- `package-lock.json`
- `src/features/dashboard/queries.ts`
- `src/components/dashboard/analytics-charts.tsx`
- `src/app/(tenant)/dashboard/page.tsx`
- `src/app/(tenant)/dashboard/sales/page.tsx`
- `src/app/(tenant)/dashboard/workers/page.tsx`
- `project_summary.md`

### Bugs Found

- npm audit reported a high-severity `js-cookie` advisory through Clerk dependencies after installing the chart stack.
- The previous dashboard was still a placeholder and did not reflect the new source-of-truth dashboard direction.

### Bugs Fixed

- Updated Clerk within the same major version to clear the high-severity audit finding.
- Replaced placeholder dashboard UI with real tenant-scoped business analytics.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke checks returned HTTP 200 for `/dashboard`, `/dashboard/sales`, and `/dashboard/workers`.
- In-app browser smoke test confirmed protected dashboard routes redirect through Clerk sign-in when unauthenticated.

### Pending Tasks

- Add custom date range and daily/monthly grouping controls for full analytics pages.
- Add worker checkbox filters on `/dashboard/workers`.
- Improve stale thresholds using stage expected duration and tenant-configurable settings later.
- Add production and finance full analytics pages if the side-pane pattern feels right after live testing.
- Live-test dashboard charts with Phantom Threads authenticated data.
- Apply live Supabase delivered status migrations.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.
- The only remaining npm audit findings are the existing moderate Next/PostCSS advisories; npm still suggests a breaking downgrade to `next@9.3.3`, so no automated fix was applied.

### Notes for Next Session

- Start with authenticated browser testing on live Phantom Threads data and verify chart values against source records.
- Continue Dashboard Phase 1.1 with date/grouping filters and worker checkbox selection.
- Keep dashboard dense, monochrome, operational, and side-pane driven.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Dashboard Analytics Controls Phase 1.1

### What Was Built

- Added range filters to `/dashboard/sales`: 7D, 30D, MTD, YTD, and Custom.
- Added daily/monthly grouping controls to `/dashboard/sales`.
- Added amount/count chart mode controls to `/dashboard/sales`.
- Added custom date inputs to `/dashboard/sales`.
- Added range filters to `/dashboard/workers`: 7D, 30D, MTD, YTD, and Custom.
- Added daily/monthly grouping controls to `/dashboard/workers`.
- Added worker checkbox selection to `/dashboard/workers`.
- Added custom date inputs to `/dashboard/workers`.
- Updated worker productivity totals to respect selected workers, selected date range, and selected grouping.

### Key Decisions Made

- The next module after Dashboard Command Center Phase 1 is Dashboard Analytics Controls and Drilldowns.
- Sales analytics full page should support booked amount and order count from the same control surface.
- Worker analytics full page should default to active workers but allow explicit checkbox selection.
- Worker productivity remains an operational signal using completed work as `1` and touched-but-not-completed work as `0.5`.

### Files/Modules Changed

- `src/app/(tenant)/dashboard/sales/page.tsx`
- `src/app/(tenant)/dashboard/workers/page.tsx`
- `project_summary.md`

### Bugs Found

- Full analytics pages were useful as larger charts but did not yet have the promised customization controls.
- In-app browser helper import path did not resolve during this session, so only HTTP route smoke checks were completed.

### Bugs Fixed

- Added the missing full-page analytics customization controls for Sales and Worker analytics.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke checks returned HTTP 200 for filtered `/dashboard/sales` and `/dashboard/workers` URLs.

### Pending Tasks

- Authenticated browser test with live Phantom Threads data.
- Verify sales chart totals against real order records.
- Verify worker productivity totals against real work logs.
- Consider adding Production and Finance full analytics pages.
- Improve stale thresholds using stage expected duration and tenant-configurable settings later.
- Apply live Supabase delivered status migrations.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.
- In-app browser automation helper path was unavailable in this session, so visual browser QA should be repeated when the browser tool is available.

### Notes for Next Session

- Continue Dashboard Phase 1.2 with production/finance full analytics pages or authenticated data verification, depending on whether live access is available.
- Keep analytics controls URL-driven with server-rendered data.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Dashboard Workers Filter Runtime Fix

### What Was Built

- Added worker search-param normalization for `/dashboard/workers`.
- Worker filters now accept both comma-separated `workers=a,b` values and repeated checkbox query params such as `workers=a&workers=b`.

### Key Decisions Made

- Checkbox filter URLs should support Next.js search params as either string or string array.

### Files/Modules Changed

- `src/app/(tenant)/dashboard/workers/page.tsx`
- `project_summary.md`

### Bugs Found

- `/dashboard/workers` crashed when checkbox form submission produced repeated `workers` query params because the code called `.split()` on an array.

### Bugs Fixed

- Added `normalizeWorkerParam` to safely flatten string and string-array worker params.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke check with repeated worker params returned HTTP 200.

### Pending Tasks

- Authenticated browser test with live Phantom Threads worker filter data.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Keep checking URL-driven forms for repeated checkbox param arrays in Next.js pages.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Dialog Server Action Error Visibility Fix

### What Was Built

- Removed global close-on-submit behavior from the shared `Dialog` primitive.
- Added controlled open support to `Dialog`.
- Added render-function child support to `Dialog` for future close-on-success patterns.
- Added structured form-action wrappers for order payment, workflow change, and stage correction actions.
- Added client `AddPaymentDialog` that displays server-action errors and closes only after successful payment recording.
- Added client workflow action dialogs for changing workflow and correcting stages.
- Rewired order detail add-payment popup to use the new action-state dialog.
- Rewired workflow panel change-workflow and correct-stage dialogs to use action-state dialogs.

### Key Decisions Made

- Shared dialogs must not close automatically on every form submit.
- Operational dialogs should stay open on validation/action failure and show the actual error.
- Dialogs should close only after a successful server action response.
- Side panes must not close because a nested form inside them submitted.

### Files/Modules Changed

- `src/components/ui/dialog.tsx`
- `src/features/orders/actions.ts`
- `src/features/production/actions.ts`
- `src/components/orders/add-payment-dialog.tsx`
- `src/components/production/workflow-action-dialogs.tsx`
- `src/components/production/item-workflow-panel.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `project_summary.md`

### Bugs Found

- Shared `Dialog` used `onSubmitCapture={() => setOpen(false)}`, which closed every dialog and side pane on submit before server-action success/failure was known.
- Workflow side pane closed when nested change/correction forms were submitted, making edits look like they did not work.
- Add-payment popup closed immediately and hid server-action errors, making failures look silent.

### Bugs Fixed

- Removed submit-capture auto close from `Dialog`.
- Add-payment failures now remain visible in the popup.
- Workflow change/correction failures now remain visible in their dialogs without closing the parent side pane.
- Successful add-payment, workflow change, and stage correction submissions close their own dialog intentionally.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke checks returned HTTP 200 for `/orders` and `/production`.

### Pending Tasks

- Authenticated live test: add payment from an order popup and confirm payment appears after revalidation.
- Authenticated live test: change workflow from workflow side pane and confirm old workflow closes and new workflow starts.
- Authenticated live test: correct stage status from side pane and confirm side pane stays open on invalid inputs and shows errors.
- Consider moving other important dialogs to the same structured action-state pattern over time.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Do not reintroduce global close-on-submit behavior in the shared dialog primitive.
- Use structured action-state client dialogs for operational forms where users need clear success/failure feedback.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Production Kanban Board Phase 1

### What Was Built

- Added Production module toggle between list view and board view.
- Added `/production?view=board` stage-level Kanban board.
- Board columns are built from workflow stage configuration and sorted by workflow sequence.
- Added final synthetic `Completed` column for items whose workflow is complete/delivered.
- Added board status filters: All, Ready, In progress.
- Added workflow filter buttons for all workflows or one selected workflow.
- Added stage column header counts for total, ready, in-progress, and delayed items.
- Added Notion-style production cards with item name/description, due urgency, order number, customer name, assigned worker, workflow name, status, and delayed marker.
- Cards sort by urgency: delayed first, then earliest due date, no due date last.
- Card click opens the existing workflow side pane for quick edits; no drag-and-drop was added.
- Board pane close links preserve board filters.
- Updated production page query dependencies to include workflow stages, work logs, and workers.
- Updated PRD and WBS with production Kanban rules and planned view behavior.

### Key Decisions Made

- No schema change was needed; workflow start/end are inferred from workflow stage sequence for MVP.
- Board movement remains action-driven through the existing workflow side pane, not drag-and-drop.
- All workflows can be shown together by de-duplicating shared stage masters, while the workflow filter gives a clean single-workflow sequence.
- Items appear in active stage columns when ready to start, in progress, paused, or blocked for visibility; ready/in-progress filters narrow to the requested statuses.
- Fully completed/delivered workflow items appear in the synthetic Completed column.

### Files/Modules Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `src/features/production/queries.ts`
- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- The existing production query did not include workflow stage configuration, active work logs, or workers, which were required for board columns and assigned-worker cards.

### Bugs Fixed

- Extended production query data for board rendering without changing workflow action behavior.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/production?view=board` returned HTTP 200.
- Local smoke check for `/production?view=board&boardStatus=in_progress` returned HTTP 200.

### Pending Tasks

- Authenticated visual test with live Phantom Threads production data.
- Validate board columns against the configured workflows and long stage names.
- Validate card side pane updates from board cards.
- Consider adding compact horizontal stage color accents if the monochrome board needs more scanning help.
- Consider extracting board helpers/components if the production page grows further.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Keep the board view as a visual production control surface; workflow movement should remain through side-pane actions for MVP.
- If future workflows diverge heavily, defaulting to a selected workflow may become clearer than showing all workflow stages together.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Production Kanban Board Refinement

### What Was Built

- Reworked Production board controls so view/search are compact and board-only filters are separated into their own row.
- Reduced the search bar footprint from a full-width control to a compact search input.
- Replaced one-line workflow filter chips with a compact workflow dropdown using checkbox multi-select.
- Added repeated `workflowId` search-param normalization so one or many workflows can be selected safely.
- Made board cards shorter by removing stacked metadata and showing order/customer, worker, and workflow in compact inline rows.
- Made the board view honor the top KPI chips, including active workshop, ready, in progress, blocked, due soon, delayed, uninitialized, and delivered.
- Preserved board status and workflow filters when opening and closing the workflow side pane from board cards.
- Added an `Uninitialized` board column when workflow setup items are present or the uninitialized chip is selected.

### Key Decisions Made

- Production board and list should share the same queue filter semantics so KPI chips behave consistently across views.
- Workflow filtering should support multiple workflows through URL-driven checkbox params, matching the dashboard worker-filter pattern.
- Search is secondary in this screen and should not consume primary board real estate.
- Board cards should prioritize scan speed over full detail; deeper edits remain in the side pane.

### Files/Modules Changed

- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- Board rows did not apply the top queue/KPI chip filter, so chips changed the selected state but not the Kanban data.
- Workflow filters were rendered as many horizontal chips, which became noisy when several workflows existed.
- Board card metadata was stacked vertically, making cards too tall for operational scanning.

### Bugs Fixed

- Shared the queue-filter rule between list and board views.
- Added workflow checkbox normalization for string and string-array query params.
- Compressed card metadata and moved workflow filtering into a dropdown.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/production?view=board` returned HTTP 200.

### Pending Tasks

- Authenticated visual test with live Phantom Threads data after selecting multiple workflows.
- Check board usability on smaller laptop widths with many workflow columns.
- Consider extracting the production board into smaller components if the page continues to grow.
- Continue applying the clearer status/workflow separation pattern to other operational pages where filters feel crowded.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Keep board interactions action-driven through the side pane; no drag-and-drop in MVP.
- Reuse URL-driven multi-select normalization anywhere checkbox filters can submit repeated params.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Production Filter Bar Simplification

### What Was Built

- Removed the duplicate board-only All / Ready / In progress status filter row.
- Kept board filtering aligned with the top KPI chips instead of maintaining separate status controls.
- Moved workflow multi-select into the primary Production filter bar next to the view controls.
- Changed Production search into a compact icon popover with Apply and Clear actions.
- Preserved queue, view, search, and workflow URL state across filter changes.

### Key Decisions Made

- The top KPI chips are the single source of truth for production status filtering.
- Search is useful but secondary, so it should be available on demand rather than taking permanent horizontal space.
- Workflow selection belongs in the first filter surface because it controls the board scope.

### Files/Modules Changed

- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- The board had redundant status controls even though the KPI chips already provided those filters.

### Bugs Fixed

- Removed duplicate board status filtering UI and simplified board filtering to use top queue chips plus workflow selection.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/production?view=board` returned HTTP 200.

### Pending Tasks

- Authenticated visual test of the popover search and workflow dropdown on live data.
- Apply the same compact filter treatment to other dense operational pages where status chips and filters compete.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Internal tenant workspace routes should remain Clerk-protected; only customer tracking routes are public token-based.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Production Filter UX Refinement

### What Was Built

- Added a client-side Production filter bar component with inline expanding search.
- Search now shows the active query as a compact preview chip until clicked.
- Workflow dropdown now appears in both list and board views.
- Workflow selection now filters the list view as well as the board view.
- Workflow dropdown closes when clicking outside the dropdown area.
- Production search normalization now uses explicit lowercase normalization across item, description, order, customer, workflow, and stage text.

### Key Decisions Made

- Search should expand inline inside the filter bar rather than opening as a floating popup.
- Workflow filtering is a module-level filter and should be available in both list and board views.
- Native `<details>` is not sufficient for this dropdown behavior because it does not reliably close on outside click.

### Files/Modules Changed

- `src/components/production/production-filter-bar.tsx`
- `src/app/(tenant)/production/page.tsx`
- `project_summary.md`

### Bugs Found

- Workflow filtering was only exposed in board view.
- Workflow dropdown required clicking the trigger again to close.
- List view did not apply selected workflow filters.

### Bugs Fixed

- Added outside-click dropdown behavior.
- Applied selected workflow filters to both production list and board data.
- Kept search matching case-insensitive and broadened searchable text coverage.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/production?view=board` returned HTTP 200.
- Local smoke check for `/production?q=grey` returned HTTP 200.

### Pending Tasks

- Authenticated visual test of inline search expansion and outside-click dropdown closing.
- Consider reusing the client filter bar pattern on other operational pages with crowded status/workflow filters.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Keep query-param filters normalized for both string and repeated string-array forms.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Workers Dialog Markup Fix

### What Was Built

- Fixed the Add Worker dialog trigger markup on `/workers`.
- Replaced the nested `Button` trigger with a styled non-button trigger element.

### Key Decisions Made

- Dialog triggers must not receive a `Button` component while the shared `Dialog` wraps triggers in a native button.

### Files/Modules Changed

- `src/app/(tenant)/workers/page.tsx`
- `project_summary.md`

### Bugs Found

- The Workers page rendered a `<button>` inside the shared dialog trigger `<button>`, causing a React hydration warning.

### Bugs Fixed

- The visible Add Worker CTA now uses `buttonVariants()` on a `span`, avoiding invalid nested button markup.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke check for `/workers` returned HTTP 200.

### Pending Tasks

- Consider improving the shared `Dialog` primitive later to support an `asChild` trigger pattern and prevent this class of issue globally.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- When using the current shared `Dialog`, pass non-interactive trigger content unless the primitive is changed to support `asChild`.

### Date

2026-05-25

### Updated By

Codex AI agent

### Phase

Workers UX Alignment Phase 1

### What Was Built

- Reworked `/workers` from a basic add/list screen into a compact operations workspace.
- Moved Add Worker into a centered dialog while preserving existing tenant-scoped create behavior.
- Added worker KPI cards for active workers, present today, active work logs, workgroups, wage gaps, and advances/loans signal.
- Added worker search, status filters, and workgroup filter.
- Added a compact worker operations table with worker, workgroup, wage, attendance, active work, ledger signal, and open action.
- Added worker side pane with setup details, today attendance state, active work count, recent work logs, recent ledger entries, and links to Attendance, Salary, and Production.
- Extended the workers query layer to load today attendance, recent production work logs, and recent worker ledger entries.

### Key Decisions Made

- Workers are a connecting operational module for production, attendance, salary, and ledger, so the page should show cross-module signals without creating duplicate records.
- Worker ledger remains sourced from `worker_ledger`; Finance should later link to it, not duplicate worker dues.
- Worker login remains out of MVP; managers/admins continue to manage worker records and log work.
- No schema changes were needed for this UX alignment slice.

### Files/Modules Changed

- `src/features/workers/queries.ts`
- `src/app/(tenant)/workers/page.tsx`
- `project_summary.md`

### Bugs Found

- The workers page was still foundation-level and did not expose attendance, production work, or ledger context needed for daily use.

### Bugs Fixed

- Added tenant-scoped read-only worker signals from attendance, work logs, and worker ledger.
- Fixed TypeScript import/type issues from the workers page rewrite before completing verification.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/workers` returned HTTP 200.
- Local smoke check for `/workers?q=test` returned HTTP 200.

### Pending Tasks

- Authenticated visual test of add-worker dialog, worker filters, and side pane with Phantom Threads data.
- Continue Core Operations UX Alignment with Customers, Attendance, or Salary.
- Consider adding worker edit/status actions later, but only after live use confirms the required controls.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Attendance is the strongest next candidate for UX alignment because it directly feeds salary suggestions and daily worker operations.

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Attendance UX Alignment Phase 1

### What Was Built

- Reworked `/attendance` from large per-worker forms into a compact daily attendance board.
- Added today-first date controls with Previous, Today, and Next navigation.
- Added KPI cards for selected date, present, absent, half day, unmarked, and marked total hours.
- Added search and status filters for worker attendance rows.
- Added status chips for All, Present, Absent, Half day, Leave, Holiday, and Unmarked.
- Converted worker attendance rows into dense editable rows with status, check-in, check-out, hours, notes, and Save.
- Preserved the existing tenant-scoped `markAttendanceAction` and attendance/work-log separation.

### Key Decisions Made

- Attendance remains a daily operations board, not a production work-log screen.
- No schema changes were needed for this UX alignment slice.
- Row-level saves remain explicit to avoid accidental bulk attendance changes.

### Files/Modules Changed

- `src/app/(tenant)/attendance/page.tsx`
- `project_summary.md`

### Bugs Found

- The previous attendance page was usable but too form-heavy for daily operations.

### Bugs Fixed

- Improved attendance density, date navigation, and filterability while keeping existing server action behavior.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/attendance` returned HTTP 200.
- Local smoke check for `/attendance?q=test` returned HTTP 200.

### Pending Tasks

- Authenticated visual test of row saves, date navigation, and status filters with Phantom Threads data.
- Continue Core Operations UX Alignment with Salary or Customers.
- Consider quick action buttons for common attendance states after live use confirms the desired flow.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Salary UX Alignment is now the strongest next candidate because attendance feeds salary suggestions directly.

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Attendance Date Navigation Fix

### What Was Built

- Fixed Attendance Previous / Today / Next date navigation.
- Replaced local-midnight date shifting with UTC-safe date parsing and `setUTCDate`.
- Aligned Attendance default today calculation to the tenant operating timezone currently used for the project, Asia/Kolkata.

### Key Decisions Made

- Date-only attendance navigation should not use local-midnight `Date` plus `toISOString()` because timezone conversion can shift the displayed day.
- Attendance date strings should be treated as date-only values for navigation and display.

### Files/Modules Changed

- `src/app/(tenant)/attendance/page.tsx`
- `src/features/attendance/queries.ts`
- `project_summary.md`

### Bugs Found

- Previous / Next navigation could produce the wrong date, or appear not to move, because date-only values were converted through UTC after being created at local midnight.

### Bugs Fixed

- Date shifting now uses UTC date math, preventing Asia/Kolkata off-by-one behavior.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke check for `/attendance?date=2026-05-26` returned HTTP 200.

### Pending Tasks

- Browser-click test Previous / Today / Next while authenticated to confirm the visible selected date updates correctly.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Use date-only helpers for date navigation in other modules if similar previous/next controls are added.

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Attendance Sheet and Salary Semantics Alignment

### What Was Built

- Documented Attendance and Salary semantics in the PRD, WBS, and Tech Development Plan.
- Clarified that attendance status is the primary payroll day-unit signal.
- Clarified salary defaults: Present = 1 day, Half day = 0.5 day, Absent/Leave/Holiday = 0 days.
- Clarified that daily/weekly/monthly wages use attendance day units, while hourly wages use attendance hours.
- Replaced row-by-row Attendance saving with a draft daily attendance sheet.
- Added one sheet-level `Save attendance sheet` action.
- Added quick actions to mark all present, mark only unmarked workers present, and reset draft state.
- Added optional time-in/time-out fields that calculate hours when both times are entered.
- Allowed manual hours entry without requiring time-in/time-out.
- Added tenant-validated bulk attendance save action that safely updates existing rows and inserts new rows without relying on fragile partial-index upsert behavior.

### Key Decisions Made

- Attendance should be saved as a daily sheet, not as disconnected row-by-row final records.
- Time-in/time-out are operational details; payable status and hours are the salary-relevant values.
- Manual hours override calculated hours.
- Existing attendance records remain visible as saved status badges while the sheet is edited as draft state.
- Production work logs remain separate and should not replace attendance.

### Files/Modules Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `src/features/attendance/actions.ts`
- `src/app/(tenant)/attendance/page.tsx`
- `src/components/attendance/attendance-sheet.tsx`
- `project_summary.md`

### Bugs Found

- The prior attendance UI mixed final saved status, time entry, payroll hours, and per-row saving in a confusing way.
- Blind bulk upsert would be risky because the attendance uniqueness rule is a partial active-row unique index.

### Bugs Fixed

- Attendance now has a draft sheet model with one explicit save.
- Hours now calculate from time-in/time-out when possible, while still allowing manual hours only.
- Bulk persistence now validates workers by tenant and uses explicit update/insert logic.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/attendance` returned HTTP 200.
- Local smoke check for `/attendance?date=2026-05-26` returned HTTP 200.

### Pending Tasks

- Authenticated live test saving an attendance sheet with: manual hours only, calculated hours from time-in/out, half day, absent, and unmarked rows.
- Verify salary suggestion totals after saving attendance rows across a test salary period.
- Consider adding a clearer monthly attendance history view after Salary UX Alignment.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Salary UX Alignment should inspect and display how attendance day units and hours drive each worker’s salary suggestion.

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Attendance Dashboard-First UX

### What Was Built

- Changed Attendance to lead with a dashboard/regularity view before the draft attendance sheet.
- Extended attendance queries to load recent attendance for active workers only across a 14-day window ending on the selected date.
- Added worker-level regularity table showing recent regularity percentage, present day units, absences, gaps, and signals.
- Added attendance alerts for anomalies such as unmarked today, repeated absences, attendance gaps, low regularity, and frequent partial days.
- Added average regularity and attention KPI cards.
- Kept the draft attendance sheet below the dashboard as the editing surface.

### Key Decisions Made

- Attendance should first answer whether workers are regular and whether today has attendance gaps, before asking the user to mark rows.
- Only active workers should appear in attendance dashboards and sheets.
- Anomaly rules are MVP heuristics for owner/manager attention, not punitive payroll rules.

### Files/Modules Changed

- `src/features/attendance/queries.ts`
- `src/app/(tenant)/attendance/page.tsx`
- `project_summary.md`

### Bugs Found

- The Attendance page still felt like a data-entry form rather than a daily control surface.

### Bugs Fixed

- Added dashboard context and worker regularity signals before the attendance-entry sheet.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings.
- Local smoke check for `/attendance` returned HTTP 200.
- Local smoke check for `/attendance?date=2026-05-26` returned HTTP 200.

### Pending Tasks

- Authenticated visual review of anomaly thresholds with real Phantom Threads data.
- Consider making regularity window configurable after live use.
- Continue Salary UX Alignment so attendance regularity and payable units are visible in salary suggestions.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Keep anomaly labels as manager attention signals; do not let them directly alter salary until admin-finalized salary rules are explicit.

## Session Update - 2026-05-26 - Attendance Chart Overview and Mark View Split

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Attendance Dashboard UX Alignment

### What Was Built

- Split Attendance into an Overview view and a Mark Attendance view.
- Made Overview the default attendance landing view.
- Added Recharts-based date-wise attendance split chart for present, half day, absent, leave, holiday, and unmarked workers.
- Added worker regularity bar chart with visual color states for healthy/watch/attention.
- Added attention board for repeated absences, attendance gaps, low regularity, frequent partial days, and unmarked current-day attendance.
- Added 7-day, 14-day, 30-day, and custom date range controls, defaulting to 14 days.
- Added active-worker multi-select filter with outside-click close behavior.
- Kept the daily draft attendance sheet in the Mark Attendance view with previous/today/next date navigation.
- Added a disabled Excel upload placeholder to keep the later import workflow visible but out of MVP implementation.

### Key Decisions Made

- Attendance should answer regularity and anomaly questions first, then allow daily entry as a separate operational view.
- Overview filters are query-param driven so ranges and selected workers can be shared/bookmarked.
- Attendance anomaly labels remain owner attention signals only; they do not directly alter salary.
- Excel upload will require preview and explicit confirmation before writing rows to the database.

### Files/Modules Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `src/features/attendance/queries.ts`
- `src/app/(tenant)/attendance/page.tsx`
- `src/components/attendance/attendance-charts.tsx`
- `src/components/attendance/attendance-worker-filter.tsx`
- `project_summary.md`

### Bugs Found

- Browser smoke check could not visually confirm the authenticated attendance content because the in-app browser session was not authenticated and did not expose the attendance DOM.

### Bugs Fixed

- Replaced the table-first attendance dashboard with chart-first overview and separated daily sheet entry into its own view.
- Extended attendance query loading from a fixed selected-date window to configurable dashboard start/end dates.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings. npm still reports a moderate PostCSS advisory under Next.js where the suggested force fix would downgrade Next, so it was not applied.
- Local route check for `/attendance` returned HTTP 200.

### Pending Tasks

- Authenticated visual review of `/attendance`, `/attendance?view=mark`, custom date range, and worker multi-select behavior.
- Decide whether attendance overview should later support monthly grouping.
- Build Excel attendance upload/import later with parse, preview, tenant validation, and explicit confirmation.
- Continue Salary UX Alignment so attendance day units and hours are transparent in salary suggestions.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Keep Attendance Overview as an operational signal board, not a payroll engine. Salary remains system-suggested and admin-finalized.

## Session Update - 2026-05-26 - Attendance Capacity Control Board

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Attendance Dashboard UX Alignment

### What Was Built

- Reworked the Attendance Overview from generic attendance reporting into a production-capacity control board.
- Replaced the date-wise status split chart with a Daily Capacity Trend chart showing available capacity, lost capacity, and unmarked capacity.
- Added Today Availability, Capacity Loss, Salary Readiness, and Attention KPI cards.
- Added a worker attendance heatmap showing worker-by-date patterns for present, half day, absent, leave, holiday, and unmarked.
- Re-ranked the attention board by operational priority instead of only regularity percentage.
- Added action labels to attention cards such as Mark today, Review worker, Fix gaps, and Watch pattern.
- Added consecutive absence detection as an attention signal.

### Key Decisions Made

- Attendance overview should answer whether production can run today, not only whether attendance was recorded.
- Capacity is expressed in worker-day units: present is 1, half day is 0.5, absent/leave is lost capacity, and unmarked is unknown capacity.
- Salary Readiness measures whether attendance rows in the selected range are marked, but does not finalize salary.
- Heatmap is better than another aggregate chart for spotting worker behavior patterns quickly.

### Files/Modules Changed

- `src/app/(tenant)/attendance/page.tsx`
- `src/components/attendance/attendance-charts.tsx`
- `project_summary.md`

### Bugs Found

- The previous attendance overview was too report-like and did not clearly answer production capacity, salary readiness, or action priority.

### Bugs Fixed

- Replaced generic status reporting with capacity, reliability, and action-oriented dashboard signals.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings. npm still reports the existing moderate PostCSS advisory through Next.js; the suggested force fix would downgrade Next and was not applied.

### Pending Tasks

- Authenticated visual review with real tenant data.
- Consider adding production correlation later: present but no work logged, work logged but attendance missing, absent worker assigned active work, and low attendance against delayed items.
- Consider monthly grouping once the current range-based board is stable.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- The next high-value attendance improvement is correlating attendance with production work logs and active assignments.

## Session Update - 2026-05-26 - Salary Review Workspace UX Alignment

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Alignment

### What Was Built

- Reworked `/salary` from a foundation page into a compact salary review workspace.
- Added selected salary period navigation through `periodId` query params.
- Added KPI cards for gross suggestion, deductions, final payable, amount due, and review readiness.
- Added worker-wise salary review table showing attendance days/hours, productive hours, ledger impact, gross, final payable, and status.
- Added review signals for missing suggestions, manual wage review, no attendance input, fully deducted rows, and paid amount exceeding payable.
- Kept period creation, suggestion regeneration, and ledger entry creation available for salary managers.
- Added period-specific ledger panel showing entries linked to or dated within the selected period.

### Key Decisions Made

- Salary remains system-suggested and admin-finalized; this slice improves review clarity without adding statutory payroll or automated finalization.
- Attendance days/hours and production minutes are shown side by side but remain separate inputs.
- Ledger entries remain sourced from `worker_ledger`; Finance should later link to this data instead of duplicating worker dues.
- Review readiness is an operational completeness signal, not a payroll approval status.

### Files/Modules Changed

- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`

### Bugs Found

- The previous Salary page hid the actual calculation trail behind summary cards and long forms, making it hard to review worker-level payable logic.

### Bugs Fixed

- Salary suggestions now expose the calculation trail and review signals in the main workspace.
- Selected period review is now explicit instead of always focusing only on the latest period.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings. npm still reports the existing moderate PostCSS advisory through Next.js; the suggested force fix would downgrade Next and was not applied.

### Pending Tasks

- Authenticated visual review with real Phantom Threads salary periods and worker ledger entries.
- Add explicit review/finalize/mark-paid server actions later, after salary workflow semantics are confirmed.
- Consider a worker salary side pane for deeper attendance, ledger, and production drilldown.
- Verify salary suggestion totals after saving attendance across a test period.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.

### Notes for Next Session

- Do not turn Salary into statutory payroll. The next salary step should be admin review/finalize controls only after live review confirms the workflow.

## Session Update - 2026-05-26 - Salary Finalization and Payment Lifecycle

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary Lifecycle Implementation

### What Was Built

- Documented the end-to-end salary lifecycle in PRD, WBS, and Tech Development Plan.
- Added migration `20260526120000_salary_finalization_payments.sql`.
- Added founder/admin finalized payable fields to salary calculations while preserving the system suggestion.
- Added payment mode support to worker ledger entries for salary payments.
- Added tenant-validated `finalizeSalaryCalculationAction`.
- Added tenant-validated `recordSalaryPaymentAction`.
- Salary finalization now stores founder payable amount, finalization note, finalized timestamp, and finalized-by Clerk user id.
- Salary payment recording now creates a worker ledger `salary_paid` entry and updates salary calculation payment progress/status.
- Salary period status now updates from worker calculation state: draft, finalized, or paid.
- Salary review table now includes inline founder finalization and salary payment recording controls.
- Finance now includes Salary module `salary_paid` worker ledger entries as salary cash-out and Salary expense aggregation.

### Key Decisions Made

- System suggestion remains preserved in `salary_calculations.final_payable`.
- Founder/admin payout truth is stored separately in `salary_calculations.finalized_payable_amount`.
- Actual salary money movement is sourced from Worker Ledger as `salary_paid`.
- Finance aggregates Salary module payments instead of duplicating them as manual expenses.
- Salary payments support partial payment through `amount_paid` and payment status.

### Files/Modules Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `supabase/migrations/20260526120000_salary_finalization_payments.sql`
- `src/types/database.ts`
- `src/features/salary/actions.ts`
- `src/features/salary/queries.ts`
- `src/app/(tenant)/salary/page.tsx`
- `src/features/finance/queries.ts`
- `src/app/(tenant)/finance/page.tsx`
- `project_summary.md`

### Bugs Found

- Salary suggestions did not previously preserve a distinct founder-finalized payable amount.
- Salary payments could be entered as ledger transactions, but payment mode was not available on worker ledger for Finance aggregation.
- Finance did not include Salary module payments in cash-out or expense breakdown.

### Bugs Fixed

- Added separate founder-finalized salary amount and finalization metadata.
- Added payment-mode-aware salary-paid worker ledger entries.
- Finance cashflow and P&L-style expense breakdown now include salary payments from Worker Ledger.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm audit --audit-level=high` passed with no high or critical findings. npm still reports the existing moderate PostCSS advisory through Next.js; the suggested force fix would downgrade Next and was not applied.

### Pending Tasks

- Apply `supabase/migrations/20260526120000_salary_finalization_payments.sql` to live Supabase before using salary finalization/payment fields there.
- Authenticated test: create salary period, finalize one worker to the suggested amount, finalize another to a different amount with note, record partial and full payments, and confirm Finance shows salary cash-out.
- Decide whether finalized suggestions should be protected from regeneration or regenerated into a fresh version/history later.
- Add worker salary side pane for detailed attendance, production, and ledger drilldown.
- Add weekly/monthly worker income reports.

### Blockers

- Live Supabase still needs delivered status migrations applied before production code can safely write `order_status = delivered`.
- Live Supabase also needs the new salary finalization/payment migration applied before this salary slice can be used end to end.

### Notes for Next Session

- Salary now has the correct core lifecycle: suggestion, founder finalization, salary-paid ledger entry, and Finance aggregation. Next work should focus on live migration/testing and worker income reports.

## Session Update - 2026-05-26 - Salary UX Reframing for Solo Founder Calm

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Product Reframing

### User Feedback

- The current Salary dashboard is visually and emotionally cluttered.
- Showing all worker calculations, finalization fields, payment forms, ledger entry forms, and period controls at once creates anxiety for a solo founder.
- The Salary module should simplify the founder's work instead of exposing payroll mechanics by default.
- The first salary need is historical clarity: weekly/monthly/custom-range salary paid, worker-wise payment history, and recent payment trends.
- The second need is a smooth Add Salary flow for a chosen period with strong guardrails.
- Salary entry must prevent duplicate salary expenses and overlapping salary periods.
- Salary entries must be editable so wrong entries do not feel dangerous.
- Finance should receive Salary as one clean expense category rollup from Salary, not require duplicate manual expense entry.

### Product Decision

- Reimagine Salary as a calm founder workspace.
- Default Salary view should be history-first: salary paid, salary due, salary expense trend, worker-wise payment history, and date range filters.
- Salary creation should move into a guided flow: choose period, validate overlap, generate suggestions, review workers, finalize/pay, then show confirmation.
- Detailed calculation trails should be available through drilldown or a focused period workspace, not shown as a dense default table.
- Guardrails are core UX, not optional validation: no overlapping active periods, no duplicate worker-period calculations, no duplicate salary-paid ledger entries, and overpayment warnings/blocks.
- All operational salary records should be editable or cancellable with audit fields.

### Docs Changed

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/05_Project_Summary.md`
- `docs/06_Rules.md`
- `docs/08_Database_Model.md`
- `docs/10_Salary_UX_Implementation_Spec.md`
- `project_summary.md`

### Pending Implementation Direction

- Redesign `/salary` into a history-first dashboard with weekly/monthly/custom date range charts.
- Add worker-wise salary payment history for recent weeks/months.
- Replace always-visible worker finalization/payment forms with a focused Add Salary / Period Workspace flow.
- Add server-side overlap validation for salary periods.
- Add duplicate-submit protection for salary-paid ledger entries.
- Add edit flows for period metadata, finalized payable amounts, notes, and payment entries.
- Ensure Finance rolls Salary module payments into the Salary expense category without manual duplication.

### Blockers

- None. User confirmed all pending Supabase migrations have been applied successfully.

### Notes for Next Session

- Do not proceed by polishing the current cluttered Salary table. The next implementation should simplify the information architecture first.
- The target feeling is: “I know what I paid, I know who is due, and adding salary feels guided and reversible.”

## Session Update - 2026-05-26 - Salary UX Implementation Spec

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Specification

### What Was Built

- Added `docs/10_Salary_UX_Implementation_Spec.md`.
- Specified the Salary information architecture as Overview, Periods, and Period Workspace.
- Defined the default Overview as salary history-first, with paid/due totals, worker-wise payment history, salary paid trend, recent payments, and pending periods.
- Defined the Add Salary flow as guided period setup with overlap validation before creation.
- Defined the Period Workspace as the focused place for worker suggestion review, finalization, and payment.
- Defined query helper needs: `getSalaryOverviewData`, `getSalaryPeriodsData`, and `getSalaryPeriodWorkspaceData`.
- Defined server action guardrails for overlap validation, regeneration protection, overpayment blocking, duplicate payment protection, and edit/cancel salary payment actions.
- Confirmed Finance should continue consuming Salary module `salary_paid` worker ledger entries as Salary expense rollups.

### Key Decisions Made

- Do not implement the Salary fix as visual cleanup of the existing page.
- Split broad salary data into task-specific query helpers.
- Keep the first implementation schema-light; existing tables are enough for the first UX restructure.
- Consider a later idempotency/source-reference migration only if server-side duplicate-submit protection is not robust enough.
- Payment over outstanding payable should be blocked in MVP, not merely shown as a warning.

### Pending Tasks

- Implement Salary overview query and page.
- Implement period overlap guard in `createSalaryPeriodAction`.
- Protect `generateSalarySuggestionsAction` from replacing finalized or paid rows.
- Block overpayment and add duplicate-submit guard in `recordSalaryPaymentAction`.
- Add focused period workspace and move finalization/payment forms out of the default page.
- Add edit/cancel salary payment actions and recompute payment status after edits.
- Verify Finance salary rollup after the Salary redesign.

### Blockers

- None. User confirmed all pending Supabase migrations have been applied successfully.

### Notes for Next Session

- Start implementation with query/action guardrails before UI polish.
- Preserve the emotional goal: Salary should feel guided, recoverable, and sparse by default.

## Session Update - 2026-05-26 - Salary Calm Workspace First Implementation

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Redesign Implementation

### What Was Built

- Reworked `/salary` from a dense review/payroll table into a calmer founder workspace.
- Added a history-first Salary overview with date range controls, paid-in-range, salary due, workers paid, and pending period metrics.
- Added salary paid trend chart using Recharts.
- Added worker-wise payment history for the selected date range.
- Added recent salary payments panel showing Salary module payments that roll into Finance.
- Added compact salary period cards with payable, paid, due, worker count, and selected-period navigation.
- Moved worker finalization and payment controls into a focused Period Workspace using collapsible worker rows.
- Kept detailed attendance, production, ledger impact, finalization, and payment controls available only when a worker row is opened.
- Reframed manual worker ledger entry as "Other worker ledger adjustment" and removed salary-paid from that generic dropdown so salary payments are recorded from a salary period.
- Added `src/components/salary/salary-charts.tsx`.
- Rebuilt `src/features/salary/queries.ts` around overview/period/workspace needs instead of one raw page payload.
- Added salary action guardrails:
  - salary period overlap validation,
  - regeneration block when rows are finalized or paid,
  - overpayment block,
  - duplicate salary-paid ledger entry guard,
  - Finance revalidation after salary payment.

### Key Decisions Made

- The default Salary page should answer history and confidence questions before exposing period actions.
- The current implementation stays schema-light and uses existing tables.
- Payment over outstanding due is blocked in MVP.
- Regeneration does not proceed after finalized or paid salary rows exist.
- Salary payments should be recorded from the period workspace, while generic ledger adjustment excludes `salary_paid`.

### Files/Modules Changed

- `src/app/(tenant)/salary/page.tsx`
- `src/features/salary/actions.ts`
- `src/features/salary/queries.ts`
- `src/components/salary/salary-charts.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke check for `/salary` returned HTTP 200.

### Pending Tasks

- Authenticated visual review with Phantom Threads data.
- Add edit/cancel salary payment actions and recompute salary payment status after edits.
- Consider a dedicated `/salary/periods/[periodId]` route if the period workspace grows beyond the page.
- Add stronger database-level idempotency/source reference if server-side duplicate-payment guard is not enough after live testing.

### Blockers

- None.

### Notes for Next Session

- Do not re-expand the default Salary page. Keep detailed controls inside focused period/worker drilldowns.

## Session Update - 2026-05-26 - Salary Validation Notice Patch

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Guardrail Feedback

### Bugs Found

- Creating an overlapping salary period correctly detected the overlap, but surfaced it by throwing a runtime error screen.
- This violated the Salary UX goal: guardrails should reduce anxiety, not crash the page.

### Bugs Fixed

- Converted expected salary guardrail outcomes into redirects back to `/salary` with inline notices.
- Overlapping salary period attempts now select the existing overlapping period and show a warning banner.
- Invalid period date order now shows a warning banner.
- Regeneration protection for finalized/paid rows now shows a warning banner.
- Overpayment attempts now show a warning banner instead of crashing.
- Duplicate salary payment detection now shows a success-style notice instead of inserting again.
- Successful period creation and salary payment now show confirmation notices.

### Files/Modules Changed

- `src/features/salary/actions.ts`
- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Continue converting expected business-validation failures into inline action feedback instead of thrown runtime errors.

## Session Update - 2026-05-26 - Salary Optional Ledger Field Patch

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Guardrail Feedback

### Bugs Found

- The Other worker ledger adjustment form no longer submits `linkedSalaryPeriodId`, but the salary action optional text parser rejected missing/null form values.
- This caused a runtime ZodError instead of treating the missing salary period link as optional.

### Bugs Fixed

- Updated salary action optional text parsing to accept `null` and `undefined` form values and convert empty values to `null`.
- This keeps optional fields optional across salary actions instead of throwing runtime validation errors.

### Files/Modules Changed

- `src/features/salary/actions.ts`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-05-26 - Salary View Split

### Date

2026-05-26

### Updated By

Codex AI agent

### Phase

Salary UX Simplification

### User Feedback

- The salary page still had too many directly related sections on one long screen.
- It was unclear what the founder should do first because dashboard history, period creation, period review/payment, and worker ledger adjustments were all visible together.
- The user asked to split Salary into multiple views similar to Attendance and the broader OS PLUS design principles.

### What Was Built

- Split `/salary` into three query-param views:
  - `Overview`
  - `Periods`
  - `Adjustments`
- Made `Overview` the default view with only range controls, KPI cards, salary paid trend, recent salary payments, and worker payment history.
- Moved salary period creation, salary period list, and Period Workspace into `?view=periods`.
- Moved other worker ledger adjustment into `?view=adjustments`.
- Updated Salary navigation buttons so each view has one clear job.
- Kept the primary Add Salary Period CTA pointed at the Periods view.

### Key Decisions Made

- Salary should follow the Attendance pattern: overview first, operational entry as a separate view.
- The default Salary screen should not show period creation, period worker rows, or ledger adjustment forms.
- Period review and payment belong together in the Periods view.
- Worker advances/loans/deductions are related to Salary but should stay in Adjustments, away from the default dashboard.

### Files/Modules Changed

- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local smoke checks returned HTTP 200 for:
  - `/salary?view=overview`
  - `/salary?view=periods`
  - `/salary?view=adjustments`

### Notes for Next Session

- Review the three views visually with authenticated Phantom Threads data.
- If Period Workspace still feels heavy, move it to a dedicated period route or side pane.

## Session Update - 2026-05-27 - Salary Worker Record Flow Simplification

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Salary Period Workspace UX

### User Feedback

- The expanded worker record in the Period Workspace still looked like two separate modules: Final and Pay.
- The user asked whether these could be stacked vertically like the order creation portion.
- The user also asked what may be missing for making the period record editing workflow usable and clearer for tracking.

### What Was Built

- Changed the expanded worker salary controls from side-by-side forms into a vertical two-step flow.
- Renamed the first step to `1. Confirm payable`.
- Added explanatory helper copy that this is where the final payable amount for the worker-period record is edited.
- Renamed `Final amount` to `Payable amount`.
- Renamed the note field to `Edit note`.
- Changed the first action button to `Save payable`.
- Renamed the second step to `2. Record payment`.
- Added helper copy that the payment amount is actual money paid and rolls into Finance as Salary expense.
- Renamed `Pay` to `Payment amount`.
- Changed the payment action button to `Record payment`.

### Key Decisions Made

- `Final` and `Pay` are not two modules; they are two sequential actions on one worker salary record.
- The UI should make this feel like editing one record: first confirm what should be paid, then record what was actually paid.
- Payment edit/cancel is still missing and remains the next important usability piece for clear tracking.

### Files/Modules Changed

- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Add edit/cancel controls for recorded salary payments so mistakes can be corrected without manual database intervention.
- Consider adding a visible payment history row under each worker record even when there are no payments yet.

## Session Update - 2026-05-27 - Salary Overview Grouping and Attention Board

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Salary Overview UX

### User Feedback

- The salary chart was effectively showing salaries as daily only.
- The user requested a weekly/monthly toggle for the same salary paid view.
- The user requested worker-wise graphical representation.
- The user suggested an attention board for payables and advances that need adjustment.
- The user asked how an advance or loan given to a worker should later be adjusted or repaid.

### What Was Built

- Added salary grouping support for daily, weekly, and monthly salary paid trends.
- Added a Salary overview toggle for Daily, Weekly, and Monthly views.
- Added worker-wise salary chart data and a worker salary bar chart showing Paid vs Due.
- Added an Attention board on the Salary overview for:
  - unpaid salary periods,
  - worker payables,
  - outstanding advances,
  - outstanding loans.
- Clarified adjustment type labels in the Salary Adjustments view:
  - `Deduct from salary`
  - `Cash repayment received`
  - `Manual adjustment`

### Key Decisions Made

- The default Salary overview should answer three calm questions: what was paid, who still needs action, and which advances/loans need adjustment.
- Advances and loans should not be hidden inside the period workspace; they belong in Adjustments and should surface as attention items on the overview.
- In the current MVP model, an advance/loan is balanced by adding either a salary deduction or a cash repayment entry for the worker. A future ledger improvement should link repayments/deductions to the original advance/loan entry for exact traceability.

### Files/Modules Changed

- `src/features/salary/queries.ts`
- `src/components/salary/salary-charts.tsx`
- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-05-28 - Measurement UX Polish and Required Standards

### Date

2026-05-28

### Updated By

Codex AI agent

### Phase

Measurement Standards UX Hardening

### Planning Notes

- Root `project_summary.md` is the authoritative current project history. `docs/05_Project_Summary.md` has partial/stale updates and should be treated as secondary until it is reconciled.
- The next slice was chosen as measurement UX polish instead of standard-size templates because field standards need to feel stable and calm before adding size presets.
- Dependencies were existing tenant-scoped measurement standards, customer measurement forms, order quick-add measurement, order measurement selection, and order/customer measurement previews.

### What Was Built

- Customer profile measurement add/edit forms now show tenant standard rows as fixed labels instead of editable key fields.
- Required tenant standard fields are visibly marked and use native required validation in customer measurement forms.
- General measurements now show a clear empty-state explanation instead of implying standards should exist.
- Order creation quick-add measurement dialog now shows fixed standard labels, required badges, better empty guidance, and client-side required-field feedback.
- Customer profile and order detail measurement previews now sort fields by tenant standard order and display standard field labels/units instead of raw keys where possible.
- Order creation and order edit measurement selectors now use clearer option labels with reference name, default marker, item type, and last-updated date.
- Server-side customer measurement creation/update and quick-add API now validate required active tenant standard fields for the selected item type.
- Order detail now loads active tenant measurement standards so linked measurement previews can use human labels without exposing anything publicly.

### Key Decisions Made

- Required fields should guide staff clearly, but the workflow still allows extra one-off fields for boutique-specific needs.
- Standard field keys remain stable internal identifiers; staff-facing screens should prefer labels and units.
- Standard-size templates remain deferred until field standards are tested in real customer/order flow.
- Tenant safety remains unchanged: all standards and measurements are loaded by current tenant context, customer/item-type tenancy is validated before writes, and public tracking remains measurement-free.

### Files/Modules Changed

- `src/components/customers/customer-measurement-form.tsx`
- `src/components/orders/order-item-builder.tsx`
- `src/components/orders/edit-order-dialog.tsx`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/features/customers/actions.ts`
- `src/app/api/customer-measurements/route.ts`
- `src/features/orders/queries.ts`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Visual/authenticated review with real Phantom Threads data for customer profile measurement dialogs, order quick-add, order item measurement selector, and order detail previews.
- Consider a small reusable measurement preview helper/component if this display pattern appears in more modules.

### Notes for Next Session

- Do not add standard-size templates until tenant field standards have been reviewed in the real order flow.
- If measurement form validation feels too strict in real boutique use, convert required standard fields from hard browser blocking to an explicit "save anyway" correction flow.

## Session Update - 2026-05-29 - Standard Size Templates and Fit References

### Date

2026-05-29

### Updated By

Codex AI agent

### Phase

Measurement Standards Expansion

### User Feedback

- The earlier measurement standards work clarified dimension fields, but the user needed standard size sets as named combinations of dimensions.
- Standard sizes such as XS, S, M, L, XL, 38, or 40 must belong to the item type, not the selected customer.
- A shirt size S or blazer size 40 should carry multiple values such as chest, length, shoulder, sleeve, collar, hip, etc.
- The settings UI should support filling those size combinations in a table-like input.

### What Was Built

- Added tenant-owned `item_type_standard_sizes` for item-type standard size templates.
- Added `order_items.standard_size_id` alongside the existing `customer_measurement_id`.
- Expanded `/settings/measurement-standards` so each item type now has two concepts:
  - Dimension fields, which define the measurement columns.
  - Standard sizes, which define named rows of values for those columns.
- Added standard size create/edit/archive actions with tenant and item-type validation.
- Updated order creation so the item row fit-reference dropdown shows:
  - Standard sizes from the selected item type, independent of customer.
  - Customer measurements only after customer selection.
- Updated order creation persistence so order items save either a standard size or a customer measurement reference.
- Updated order edit to use the same fit-reference concept.
- Updated order detail item cards to display linked standard size values or linked customer measurement values using tenant field labels.

### Key Decisions Made

- `item_type_measurement_fields` are dimension definitions, not size presets.
- `item_type_standard_sizes` are named combinations of dimension values and are tightly coupled to item type.
- Order item fit references are mutually exclusive in the current MVP: one standard size, one customer measurement, or neither.
- Standard size selection is internal-only and must not appear on public tracking.
- Tenant safety is preserved through `tenant_id`, RLS, tenant-filtered reads, and server-side validation that selected standard sizes belong to the current tenant and match the order item's item type.

### Files/Modules Changed

- `supabase/migrations/20260529100000_item_type_standard_sizes.sql`
- `src/types/database.ts`
- `src/features/settings/actions.ts`
- `src/features/settings/queries.ts`
- `src/components/settings/standard-size-form.tsx`
- `src/app/(tenant)/settings/measurement-standards/page.tsx`
- `src/features/orders/queries.ts`
- `src/features/orders/actions.ts`
- `src/components/orders/order-item-builder.tsx`
- `src/components/orders/edit-order-dialog.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/08_Database_Model.md`
- `docs/11_Measurement_Standards_Implementation_Spec.md`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply the new Supabase migration in the active database environment.
- Perform authenticated browser QA on `/settings/measurement-standards`, `/orders/new`, and order detail edit/display with real tenant data.

## Session Update - 2026-05-29 - Attachment References Foundation

### Date

2026-05-29

### Updated By

Codex AI agent

### Phase

Shared Attachments Foundation

### Planning Notes

- The next MVP slice was chosen as shared attachments because boutiques need measurement photos, design references, and item-specific file context during real order work.
- The first implementation intentionally uses URL/reference records rather than direct binary upload because this repo does not yet include Supabase Storage bucket configuration.
- Direct storage upload should be added after buckets and upload policies are defined.

### What Was Built

- Added tenant-owned `attachments` table with:
  - `entity_type`
  - `entity_id`
  - `file_url`
  - `file_type`
  - `label`
  - `notes`
  - `is_customer_visible`
  - `uploaded_by`
- Added attachment types to `src/types/database.ts`.
- Added shared attachment queries for loading records by entity type and entity IDs.
- Added attachment create/archive server actions with tenant validation and entity ownership checks.
- Added reusable `AttachmentPanel`.
- Added customer-level attachments to the customer profile.
- Added item-level attachments to order detail production item cards.

### Key Decisions Made

- Attachments are tenant-scoped from day one.
- Attachment actions validate that the parent customer/order item/stage/etc. belongs to the current tenant before writing.
- The customer-visible flag is stored now, but public tracking does not expose attachment records in this slice.
- The UI stays contextual: attachments appear where staff need them, not as a standalone media dashboard.

### Files/Modules Changed

- `supabase/migrations/20260529110000_attachments_foundation.sql`
- `src/types/database.ts`
- `src/features/attachments/actions.ts`
- `src/features/attachments/queries.ts`
- `src/components/attachments/attachment-panel.tsx`
- `src/features/customers/queries.ts`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/features/orders/queries.ts`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/08_Database_Model.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply the new Supabase migration in the active database environment.
- Add direct Supabase Storage upload once buckets and policies are configured.
- Add customer-safe attachment rendering to public tracking only after explicit review of visibility rules.

## Session Update - 2026-05-29 - Private Attachment Uploads

### Date

2026-05-29

### Updated By

Codex AI agent

### Phase

Shared Attachments Storage

### What Was Built

- Added private Supabase Storage bucket migration for `os-plus-attachments`.
- Added attachment metadata columns:
  - `storage_bucket`
  - `storage_path`
  - `file_size_bytes`
- Updated attachment creation so staff can either upload a file or save an external URL.
- Added upload guardrails:
  - max file size 10 MB,
  - allowed types: JPG, PNG, WEBP, HEIC, PDF.
- Uploaded files are stored under tenant/entity scoped paths.
- Added authenticated download route at `/api/attachments/[attachmentId]/download`.
- Updated the attachment panel to show a file input, file size, and authenticated "Open uploaded file" links.

### Key Decisions Made

- The storage bucket is private, not public.
- Internal uploaded files should not expose raw storage paths.
- Download access goes through tenant-authenticated server code that issues a short-lived signed URL.
- External URLs remain supported for files already stored elsewhere.
- Public tracking still does not expose attachment records.

### Files/Modules Changed

- `supabase/migrations/20260529113000_attachment_storage_bucket.sql`
- `src/types/database.ts`
- `src/features/attachments/actions.ts`
- `src/app/api/attachments/[attachmentId]/download/route.ts`
- `src/components/attachments/attachment-panel.tsx`
- `docs/01_PRD.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/08_Database_Model.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Apply attachment table and storage bucket migrations in the active Supabase environment.
- Authenticated browser QA upload/download on customer profile and order detail item attachments.

## Session Update - 2026-05-29 - Attachment UX Correction

### Date

2026-05-29

### Updated By

Codex AI agent

### Phase

Shared Attachments UX Polish

### User Feedback

- The Add attachment CTA looked weak and wrapped awkwardly.
- The upload form exposed too many hand-written fields.
- Uploaded images opened on another page instead of showing as thumbnails.
- The desired behavior is closer to a gallery: image thumbnails, image preview in an overlay, with details still available.

### What Was Built

- Changed the attachment CTA to a compact primary `Upload` action.
- Simplified the add attachment dialog:
  - file upload is the primary action,
  - name is optional and can fall back to the file name,
  - notes, external URL, and customer-safe flag are tucked under `More details`,
  - file type is inferred instead of manually entered.
- Converted attachment display from a text list into a responsive gallery.
- Image attachments now render thumbnails.
- Clicking an image thumbnail opens an overlay preview with details.
- PDF/link attachments render as file/link tiles.
- Uploaded files still open through the authenticated download route.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
