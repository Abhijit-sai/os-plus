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
- GST configuration/reporting planned for the next finance hardening phase
- Customer-facing order tracking
- Dashboards

## 2. Current MVP Scope

MVP includes:

- Multi-tenant SaaS foundation
- White-label tenant configuration
- Manual tenant creation by OS PLUS super admin
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
- Partial payments
- Partial pickup/dispatch
- Customer tracking link
- Production and at-risk dashboard

## 3. Out of Scope for MVP

The following are not part of MVP:

- Shopify integration
- WhatsApp automation
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
- Salary UX must be calm for a solo founder: history and payment clarity first, guided entry second, detailed calculations only when needed.
- Salary period creation must prevent overlapping active periods and duplicate worker salary entries.
- Salary payments entered in Salary should roll up to Finance as Salary expense, not be duplicated as manual expenses.

### Finance

- GST configuration and GST-ready reporting are now planned as the next finance hardening area; direct GST filing/e-invoicing remains later.
- Track payments, expenses, receivables, payables, and reminders.
- Partial payments are essential.
- Vendor master is Phase 2 or later and low priority.
- Salary should appear as a clean expense rollup sourced from Salary/Worker Ledger.

### Customer Communication

- Customer-facing statuses should be separate from internal workflow stages.
- WhatsApp automation is later.
- Each boutique should eventually use its own WhatsApp Business sender.
- MVP should generate tracking link that can be manually shared.

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

Current phase: Production hardening and pilot readiness. Root `project_summary.md` remains the authoritative current project history; this docs summary is partial/stale in older sections.

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

## 9. In Progress

- Documentation creation
- PRD
- WBS
- Tech development plan
- Site map
- Rules
- Tech stack

## 10. Pending

- Create GitHub repository
- Initialize Next.js project
- Configure Clerk
- Configure Supabase
- Create schema migrations
- Build tenant model
- Build app shell
- Build configuration module

## 11. Bugs / Issues

None yet.

## 12. Risks / Important Considerations

- Tenant isolation must be implemented correctly from day one.
- Workflow tables must not be overcomplicated but should allow future parallel stages.
- Salary module should remain suggested/admin-finalized, not full payroll.
- Finance module should not become a full accounting system in MVP.
- Salary screens must reduce anxiety: avoid dense default views with many editable forms; use guided flows, clear history, editable entries, and duplicate/overlap guardrails.
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

## 15. Session Update - 2026-05-27 - Salary Overview Grouping and Attention Board

## Session Update - 2026-06-04 - Production Hardening Next Phase

Root `project_summary.md` remains the authoritative session log.

Decision:

- Pause large module expansion.
- Move into production hardening and pilot readiness.
- Keep OS PLUS-owned tenant memberships and roles instead of Clerk Organizations for MVP.
- Simplify tenant user status UX to active/disabled.
- Use Phantom Threads as the main test bed and create one clean new boutique tenant for production-style onboarding.

Next priorities:

- Business selector for users linked to multiple tenants.
- Top-right account/profile menu with current user, current business, role, switch business, and sign out.
- Full tenant isolation and permission audit.
- Multi-sheet QA workbook at `docs/OS_PLUS_QA_Test_Matrix.xlsx`.

## Session Update - 2026-06-04 - Tenant Logo Upload on Creation

Root `project_summary.md` remains authoritative.

- Added optional logo upload to super-admin tenant creation.
- Added `supabase/migrations/20260604160000_tenant_assets_bucket.sql` for public tenant branding assets.
- Logo uploads are limited to PNG, JPG, or WEBP up to 2 MB and save into `tenants.logo_url`.
- Tenant logos now display in the app shell and business selector when present.
- Verification passed: `npm run typecheck`, `npm run lint`, and `npm run build`.
- Pending: apply the tenant assets bucket migration in the active Supabase environment before live logo-upload QA.

## Session Update - 2026-06-04 - Production Hardening Implementation Slice

Root `project_summary.md` remains authoritative. This secondary summary was reconciled with the first implementation slice of Production Hardening.

### Completed in this slice

- Tenant user status UX now exposes only Active and Disabled in owner/admin user management.
- `/select-tenant` now behaves as a clear business selector for multi-tenant users.
- Tenant app shell now has a top-right account/profile menu with signed-in user, current business, role, switch business, and sign out.
- Public tracking no longer loads internal workflow stages or stage master names.
- Super-admin routes now fail closed for non-allowlisted users, and the public home page no longer links to Super admin.
- `docs/OS_PLUS_QA_Test_Matrix.xlsx` was created with 14 sheets for tenant access, roles, isolation, modules, public tracking, communications, attachments, and deployment smoke checks.

### Audit notes

- Main feature actions and queries continue to resolve tenant context and apply tenant-scoped filters.
- Attachment downloads validate current tenant before creating signed URLs.
- Communications actions validate tenant ownership and safe variables before queueing dry-run messages.
- Current migrations show tenant-owned operational tables carry `tenant_id`.

### Pending

- Complete authenticated Clerk/manual QA using approved real email or Clerk test configuration.
- Continue pilot rehearsal with Phantom Threads and one clean new boutique tenant.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## 19. Session Update - 2026-06-05 - Post-Deployment Roadmap: Tenant Billing, GST, and Public Website

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Post-Deployment Planning

### What Was Added

- Added dedicated plan `docs/12_GST_SaaS_Billing_and_Market_Positioning.md`.
- Updated PRD, WBS, technical plan, and database model for:
  - super-admin tenant detail/status editing,
  - super-admin tenant billing/payment tracking,
  - inactive tenant locked-state UX,
  - tenant GST configuration,
  - order GST capture,
  - expense/vendor GST capture,
  - Finance > GST report and XLSX export,
  - public website positioning for workflow-driven businesses.

### Key Decisions Made

- Tenant slug remains immutable after creation.
- Super-admin can edit mutable tenant details and status at any time.
- Tenant billing/payment records are OS PLUS-owned operational records.
- GST readiness is now a near finance hardening area.
- Direct GST filing, e-invoicing, and accounting integrations remain later.
- Cash payment mode and GST treatment are separate; OS PLUS must record cash collections and must not treat cash as automatically non-reportable.
- First GST reports are accountant-handoff XLSX only.
- Existing order numbers remain the GST report reference for now; dedicated GST invoice numbering is later.
- Tenant billing/payment tracking starts as manual super-admin recordkeeping; reminders and automation are later.
- Public website positioning should focus on businesses with real workflows that cannot be run well with standard accounting templates.

### Next Recommended Sequence

1. Production smoke QA on deployed Vercel app.
2. Tenant inactive/suspended locked-state and super-admin billing records.
3. Tenant GST settings and GST rate presets.
4. Order GST capture.
5. Expense/vendor GST capture.
6. Finance GST report and export.
7. High-conversion public website and blog engine.

## 20. Session Update - 2026-06-05 - Tenant Billing and Inactive Tenant Lockout

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Tenant Commercial Control

### What Was Built

- Added Supabase migration for `tenant_billing_records`.
- Added manual super-admin tenant billing/payment record actions.
- Added super-admin tenant detail billing UI with summary metrics, add form, edit form, and cancel action.
- Added `/inactive-tenant` locked-state route.
- Updated tenant context resolution so inactive/suspended tenant access routes to the locked state instead of looking like no tenant membership exists.
- Updated `/select-tenant` so inactive-only users land on the locked-state route.

### Key Decisions Made

- Tenant billing is manual first.
- Billing notes and commercial details are super-admin-only.
- Tenant users see a calm reactivation/support message when their tenant is inactive or suspended.
- Existing active tenant access and multi-business selection behavior remains unchanged.

### Files/Modules Changed

- `supabase/migrations/20260605100000_tenant_billing_records.sql`
- `src/types/database.ts`
- `src/features/tenants/actions.ts`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/lib/tenant/context.ts`
- `src/app/inactive-tenant/page.tsx`
- `src/app/select-tenant/page.tsx`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending

- Apply `supabase/migrations/20260605100000_tenant_billing_records.sql` in the live Supabase project.
- Manual Clerk QA for super-admin billing forms and inactive tenant lockout.

## 21. Session Update - 2026-06-05 - GST Tenant Configuration UI and Form Warning Fix

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Tenant Commercial Control / GST Readiness

### What Was Built

- Added tenant GST configuration migration and TypeScript types.
- Added GST configuration fields to:
  - super-admin tenant creation,
  - super-admin existing tenant edit,
  - tenant owner/admin Business profile.
- Added explicit `Edit tenant` buttons on the super-admin tenant list.
- Removed explicit `encType` from server-action forms to clear the React/Next console warning.

### Key Decisions Made

- GST configuration lives at tenant level first.
- Order/expense GST capture and GST reports remain the next slices.
- Existing tenant editing should be visible from the list, not hidden behind title text.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending

- Apply `supabase/migrations/20260605110000_tenant_gst_configuration.sql` in live Supabase.
- Manual QA the GST fields in super-admin and tenant owner/admin settings.

## 17. Session Update - 2026-06-04 - Tenant Profile Editing Hardening

### Date

2026-06-04

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Built

- Added reusable tenant logo validation/upload support for the `tenant-assets` bucket.
- Added super-admin editing for existing tenant mutable fields while keeping slug fixed.
- Added tenant owner/admin editing for business name, store name, brand color, and optional logo replacement.
- Kept tenant status changes restricted to super-admin tenant detail editing.
- Continued logo rendering through the app shell and business selector.

### Key Decisions Made

- Slug stays immutable after tenant creation.
- Tenant owner/admin profile edits are scoped to the signed-in active tenant through `requireTenantContext`.
- Tenant business profile updates require `settings:manage`.
- Tenant logo files are restricted to PNG/JPG/WEBP up to 2 MB.

### Files/Modules Changed

- `src/lib/tenant/assets.ts`
- `src/features/tenants/actions.ts`
- `src/features/settings/actions.ts`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/app/(tenant)/settings/business-profile/page.tsx`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-01 - Email-First Tenant User Access Correction

Root `project_summary.md` remains the authoritative session log.

Built:

- Tenant user management is now email-first for tenant owners/admins.
- Owners add an internal user's email, display name, role, and status.
- The UI no longer asks tenant owners to enter Clerk user IDs.
- Super-admin tenant creation can pre-authorize the first owner/admin by email instead of Clerk user ID.
- `tenant_users.clerk_user_id` is now nullable so a tenant membership can be pre-authorized by email before first sign-in.
- When a user signs in through Clerk, OS PLUS links an active matching tenant email membership to that Clerk user ID internally.
- Access is granted only for active tenant memberships.

Tenant safety:

- Clerk verifies identity and email.
- OS PLUS controls tenant membership, role, status, and selected tenant.
- Disabled memberships do not grant access.
- Clerk IDs remain internal implementation details, not tenant-owner input.

Pending:

- Apply `supabase/migrations/20260601103000_email_first_tenant_users.sql`.
- Authenticated QA for add-by-email, first sign-in linking, tenant selection, and disabled access blocking.

Follow-up fix:

- Email-first tenant linking now skips email-preauthorized rows when the same Clerk user already has an active linked membership for that tenant.
- This prevents duplicate `(tenant_id, clerk_user_id)` errors without deleting legacy rows.

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Salary Overview UX

### What Was Built

- Added daily, weekly, and monthly grouping support for the salary paid trend.
- Added a Salary overview toggle for Daily, Weekly, and Monthly views.
- Added worker-wise Paid vs Due charting.
- Added an Attention board for unpaid salary periods, worker payables, outstanding advances, and outstanding loans.
- Clarified adjustment labels so advance/loan recovery can be entered as either `Deduct from salary` or `Cash repayment received`.

### Key Decisions Made

- Salary overview should simplify the founder's job into: money paid, worker dues, and items needing attention.
- Advances and loans stay in Adjustments but surface on Overview when they need action.
- MVP recovery flow: add an advance/loan entry, then reduce it through a deduction or repayment entry. Future improvement should link recovery entries to the original advance/loan for exact traceability.

### Files/Modules Changed

- `src/features/salary/queries.ts`
- `src/components/salary/salary-charts.tsx`
- `src/app/(tenant)/salary/page.tsx`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Partial Session Update - 2026-05-28 - Measurement UX Polish

Note: this docs summary is currently stale/partial. The root `project_summary.md` is the authoritative current project history.

### Date

2026-05-28

### Updated By

Codex AI agent

### Phase

Measurement Standards UX Hardening

### What Was Built

- Measurement forms now show tenant standard fields as fixed labels with visible required markers.
- Customer and order measurement previews now prefer standard labels/units and standard sort order over raw keys.
- Order quick-add measurement now gives clearer empty/required-field guidance.
- Customer measurement create/update and quick-add API now validate required active tenant standard fields server-side.

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
- `npm run lint` passed.
- `npm run build` passed.

## 25. Session Update - 2026-05-28 - Customer Measurements Use Tenant Standards

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Customer profile measurement entry should use tenant standards by item type.
- Standards simplify repeated entry while still allowing extra custom fields.
- Older customer measurements remain editable and keep their existing custom fields.

### Implementation

- Added reusable `CustomerMeasurementForm`.
- Customer detail now loads active tenant measurement standards.
- Customer profile add/edit measurement dialogs pre-fill standard rows when an item type is selected.
- Updated the measurement standards spec.

### Verification

- `npm run typecheck` passed.

### Notes for Next Session

- Run lint/build after this focused slice.
- Optional later improvement: tenant standard-size templates after field standards are stable.

## 24. Session Update - 2026-05-28 - Tenant Measurement Standards Settings

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Measurement standards are tenant-scoped and item-type-specific.
- Standards guide new measurement entry but do not rewrite existing customer measurements.
- Standard-size templates are deferred.

### Implementation

- Added migration `supabase/migrations/20260528100000_item_type_measurement_fields.sql`.
- Added `ItemTypeMeasurementField` type.
- Added settings queries/actions for measurement standards.
- Added `/settings/measurement-standards`.
- Added Settings card for Measurement standards.

## Session Update - 2026-05-29 - Standard Size Templates and Fit References

Root `project_summary.md` remains the authoritative session log. This partial docs summary now records that tenant measurement standards have expanded from dimension fields only to dimension fields plus item-type standard size templates.

Built:

- Added tenant-owned `item_type_standard_sizes`.
- Added `order_items.standard_size_id`.
- `/settings/measurement-standards` now manages dimension fields and standard size templates per item type.
- `/orders/new` fit reference selection now shows item-type standard sizes independent of customer, plus customer measurements after customer selection.
- Order edit and order detail now understand standard size references.

Tenant safety:

- Standard sizes include `tenant_id`.
- Server actions validate tenant ownership and item-type match before saving an order item standard size.
- Public tracking remains measurement-free.

## Session Update - 2026-05-29 - Attachment References Foundation

Root `project_summary.md` remains the authoritative session log.

Built:

- Added tenant-owned `attachments` table.
- Added attachment create/archive actions with parent entity tenant validation.
- Added reusable `AttachmentPanel`.
- Added customer-level attachment links on customer profile.
- Added item-level attachment links on order detail production item cards.

Boundary:

- This slice stores file URLs/references, labels, notes, file type, uploaded-by, and customer-visible flag.
- Direct uploads now use a private `os-plus-attachments` Supabase Storage bucket.
- Uploaded files open through an authenticated download route that validates tenant context before issuing a short-lived signed URL.
- Public tracking does not expose attachment records yet.
- Order creation quick-add measurements now pre-fill rows from active standards for the selected item type.
- Updated docs.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Apply `supabase/migrations/20260528100000_item_type_measurement_fields.sql` to live Supabase before using measurement standards.
- Next focused slice: upgrade customer profile measurement dialogs to use tenant standards.

## 23. Session Update - 2026-05-28 - Quick-Add Measurement from Order Creation

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Quick-add measurement is available from item rows after customer and item type are selected.
- It avoids nested forms inside the order creation form.
- The new measurement is auto-selected for that item.
- Current quick-add creates item-type-specific measurements.

### Implementation

- Added tenant-safe `POST /api/customer-measurements`.
- Validates tenant membership, `customers:manage`, customer ownership, and item type ownership.
- Supports marking the new measurement as the default for that customer/item type.
- Added quick-add dialog and local selector refresh to `OrderItemBuilder`.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Next recommended slice: tenant measurement standards in Settings.

## 22. Session Update - 2026-05-28 - Order Edit Shell

### Date

2026-05-28

### Updated By

Codex AI agent

### Product Decision

- Order editing starts as a safe correction shell.
- Editable now: order reference/source/dates/delivery/notes and non-destructive item corrections.
- Deferred: customer changes, price changes, quantity changes, item deletion, and payment reversal.

### Implementation

- Added tenant-safe order detail edit action.
- Added tenant-safe order item edit action.
- Measurement reference edits validate same customer and compatible item type.
- Added `Edit order` side pane on order detail.
- Revalidates order, tracking, and production item views after edits.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Next recommended slice: quick-add customer measurement from order creation without nested forms.

## 21. Session Update - 2026-05-27 - Tracking Status and Measurement Standards Planning

### Date

2026-05-27

### Updated By

Codex AI agent

### Feedback Captured

- Stored order status and computed fulfillment status could disagree.
- Public tracking copy needed customer-friendly language.
- Created orders need edit support.
- Order creation needs quick-add measurement support.
- Workflow item view should show attached measurements.
- Tenants need configurable measurement standards by garment/item type.

### Implementation

- Public tracking now derives customer-facing order status from safe item/stage progress.
- Tracking copy was simplified and internal wording was removed.
- Order detail now displays effective delivered/partially-delivered status when workflow progress proves it.
- Production fulfillment sync revalidates order detail and public tracking routes.
- Workflow item panel displays attached measurement references and fields, or a clear empty state.

### Product Plan Added

- Added `docs/11_Measurement_Standards_Implementation_Spec.md`.
- Updated PRD, WBS, and database model docs for tenant-level measurement standards and order editing.
- Quick-add measurements should be added after avoiding nested forms in the current order creation page.

### Verification

- `npm run typecheck` passed after code changes.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Recommended next build order: order edit shell, quick-add measurement from order creation, tenant measurement standards.

## 20. Session Update - 2026-05-27 - Customer Measurement Reference in Order Creation

### Date

2026-05-27

### Updated By

Codex AI agent

### Product Decision

- Saved customer measurements are linked at item level through `order_items.customer_measurement_id`.
- The measurement link is optional and internal-only.
- Order creation filters measurement choices by selected customer and compatible item type.
- General measurements can be linked to any item; item-type-specific measurements are limited to matching item types.

### Implementation

- Added migration `supabase/migrations/20260527123000_order_item_measurement_reference.sql`.
- Updated database types and order creation queries.
- Added per-item measurement reference selection and inline preview in the order item builder.
- Added server-side tenant/customer/item-type validation before saving a measurement reference.
- Display linked measurements on order detail item cards.
- Updated PRD, WBS, and database model docs.

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Apply `supabase/migrations/20260527123000_order_item_measurement_reference.sql` to live Supabase before using this in production.
- Consider quick-add measurement from order creation later.

## 19. Session Update - 2026-05-27 - Cross-Module UX Feedback Pass

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Cross-Module UX Tightening

### What Was Built

- Added a 7-day Attendance visual to the main dashboard.
- Cleaned order detail chips with labels and duplicate fulfillment suppression.
- Added customer measurements to the order detail customer side pane.
- Changed customer profile order rows to open an order summary side dialog first.
- Removed unclear module CTAs from the worker side pane.
- Reworked Salary overview charts into the requested two-row layout.
- Removed the Finance legacy order-linked receivables alert.
- Added `Back to order` on production workflow pages.
- Added sidebar active states and icon-only collapse.
- Replaced the dead header graph icon with a profile/settings shortcut.
- Added confirmation copy before running Settings `Seed defaults`.

### Key Decisions Made

- Default views should prioritize comprehension before editing or navigation.
- Status chips should be labeled when multiple status concepts appear together.
- Detail pane actions should stay contextual to the record being viewed.

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
- `docs/05_Project_Summary.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Remaining Follow-Up

- Browser visual QA for the collapsed sidebar and chart layouts.
- Consider a formal breadcrumb/back-stack pattern across drilldown-heavy pages.

## 17. Session Update - 2026-05-27 - Customer Measurement Management v1.1

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Customer Measurement UX

### What Was Built

- Added `reference_name` to customer measurements.
- Added a Supabase migration and database type update for measurement reference names.
- Added reference name input when creating measurements.
- Showed measurement created and updated timestamps on customer profiles.
- Added edit controls for reference, item type, notes, photo URL, fields, and default status.
## Session Update - 2026-06-05 - GST Settings Progressive Disclosure

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Built

- Moved tenant GST configuration fields behind a click-to-open disclosure on super-admin tenant creation, super-admin tenant edit, and tenant owner/admin Business profile.
- Existing GST-registered tenants open the GST settings by default during edits.
- New or non-GST tenants show only a compact GST row until the user intentionally opens it.
- Extracted repeated GST fields into a shared `GstSettingsFields` component.

### Key Decisions Made

- GST settings should be available but not visually dominate normal tenant profile review.
- Tenant business identity and tenant billing remain the primary default review surface.

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

- Added order-level GST capture fields for GST treatment, GST rate, taxable amount, and GST amount.
- Added a compact GST decision block to the first order creation section, defaulted from the current tenant's Business profile GST settings.
- Server-side order creation now calculates GST-exclusive, GST-inclusive, exempt/nil, non-GST, and not-applicable order totals.
- Order detail now displays GST treatment, taxable amount, GST amount, and GST rate in the payment summary.
- Existing order numbers remain unchanged and remain the first accountant-handoff report reference.

### Key Decisions Made

- GST calculation is authoritative on the server action, not the browser.
- Existing orders default to `not_applicable` and zero GST so historical order totals are not reinterpreted.
- Payment mode remains separate from GST treatment.

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

- Added expense GST fields for vendor GSTIN, vendor invoice number/date, GST treatment, GST rate, taxable amount, GST amount, and input GST status.
- Added an opt-in Vendor invoice / GST disclosure to Add expense and Edit expense dialogs.
- Expense GST defaults use the current tenant's Business profile purchase GST settings.
- Server-side finance actions calculate GST-inclusive and GST-exclusive expense snapshots.
- Vendor GSTIN remains optional and is validated only when entered.

### Key Decisions Made

- Expense payment amount remains the operational cash-out amount.
- Payment mode remains separate from GST treatment.
- Existing expenses default to `not_applicable` and zero GST.

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

- Added `Make default` for existing measurement records.
- Added soft archive for incorrect or outdated measurements.

### Key Decisions Made

- Multiple measurements must be identifiable by a human-friendly reference name.
- `updated_at` is the source of truth for last measurement change.
- Measurement removal is archive/soft delete in MVP.
- Real file upload remains later; `photo_url` stays as the interim measurement photo field.

### Files/Modules Changed

- `supabase/migrations/20260527110000_customer_measurement_reference.sql`
- `src/types/database.ts`
- `src/features/customers/actions.ts`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/08_Database_Model.md`
- `docs/05_Project_Summary.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Notes for Next Session

- Apply `supabase/migrations/20260527110000_customer_measurement_reference.sql` to live Supabase.
- Review measurement edit/archive UX with real customer data.

## 18. Session Update - 2026-05-27 - Customer Profile CTA UX Correction

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Customer Profile UX Correction

### What Was Built

- Changed Customer Profile to read-only display by default.
- Added `Edit details` CTA and dialog for profile editing.
- Moved Add Measurement behind an `Add measurement` CTA and dialog.
- Moved measurement editing behind an `Edit` CTA and dialog.
- Kept measurement actions visible only as focused commands: make default, archive, edit.

### Key Decisions Made

- Customer profile pages should open in review mode, not edit mode.
- Add/edit forms should be behind CTAs unless the page is dedicated to data entry.
- Default Customer view should be calm and scannable.

### Files/Modules Changed

- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `docs/05_Project_Summary.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## 16. Session Update - 2026-05-27 - Customer Workspace v1

### Date

2026-05-27

### Updated By

Codex AI agent

### Phase

Customer Module Operational Upgrade

### What Was Built

- Upgraded the Customer list with order count, last order date, active orders, pending balance, and measurement count.
- Added Customer list metrics for customers shown, active customers, and pending balance.
- Reworked Customer detail into an operational workspace with profile editing, commercial summary, order history, and measurements.
- Added a quick `Create order` action that opens order creation with the customer preselected.
- Improved measurement cards by item type.
- Scoped default measurements per item type, while allowing one general default when no item type is selected.

### Key Decisions Made

- Customers should be an operational workspace, not only a master list.
- Multiple measurements per customer are supported by the current schema.
- The first Customer upgrade stays schema-light; attachment upload and measurement edit/delete controls remain next steps.

### Files/Modules Changed

- `src/features/customers/queries.ts`
- `src/features/customers/actions.ts`
- `src/app/(tenant)/customers/page.tsx`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/app/(tenant)/orders/new/page.tsx`
- `src/components/orders/customer-picker.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/05_Project_Summary.md`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
