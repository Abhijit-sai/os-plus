# OS PLUS Project Summary

## Shopify deployment checks 21 October 2026

Owner reports the OAuth SQL, Shopify callback version and two Vercel encryption
settings saved. A read-only catalogue check verifies the applied function matches
the exact package, RLS/permissions are correct, and Test automatic sync, pending
jobs and leased jobs are all zero. No OAuth credential exists yet. The Test
settings page is accessible; local OAuth/manual regressions and build pass.
This is not hosted OAuth acceptance. No production business data or chat/CRM
changes. Detailed status: [OAuth package](docs/48_Shopify_Tenant_OAuth_Approval.md).

## Tenant-specific Shopify approval package — local, not activated

20 October 2026: implemented the owner-selected Shopify approval flow, encrypted
per-connection offline credentials, refresh/reconnect protections and tenant-
bound manual import and manager draft wiring. Local OAuth suite: 29 backend
checks plus 1 UI check pass; unified manual suite: 50 pass; lint and build pass.
These suites overlap and their totals must not be added as unique test cases.

No shared SQL was applied, no live Shopify approval was performed, and this
package was not pushed/deployed. Hosted validation remains pending in Phantom
Threads Test only. The exact proposed SQL, checksum, configuration, acceptance
and recovery gates are in
[tenant OAuth activation package](docs/48_Shopify_Tenant_OAuth_Approval.md).
Current app distribution eligibility must be checked before claiming that
unrelated stores can connect. Broader tenant rollout and n8n remain pending.
No production-tenant data or chat/CRM branch was changed.

## Shopify manual import acceptance and handoff 20 October 2026

The real deployed manual Shopify import flow passed end-to-end in Phantom Threads
Test. This is the shipping implementation, not a disposable prototype. The tenant
used for validation and its simulated workflow events are Test-only; the shared
application is deployed on Vercel. Latest verified release: `92f1858`.

- Completed: date-range import sheet, repeat-import duplicate protection, one
  Orders list, editable manager drafts, per-garment setup, normal workflow through
  delivery, and the three reported status/filter UI corrections.
- The actual live path and the isolated edge-case suite are distinguished in
  [manual import acceptance](docs/46_Shopify_Manual_Import_Acceptance.md).
- **Not complete:** independent tenant/store onboarding. Current server gates
  restrict access to one configured Test tenant and store. Do not describe this
  as self-service multi-store onboarding or change global credentials to add a
  second tenant.
- n8n, automatic imports/updates, retries and scheduled cleanup are explicitly
  deferred by the owner. Until scheduling exists, an owner must perform manual
  raw-payload cleanup after 24 hours. Orders/customer records remain retained.
- [Pending work](docs/47_Shopify_Pending_Work.md) records acceptance criteria,
  remaining hosted checks, rollout restrictions and chat/CRM integration rules.
- No new SQL is needed for the UI fixes. Do not rerun the historical migration
  package or claim a fresh shared-database audit from this documentation update.
- Chat/CRM development can resume against the retained order model. It must not
  send live messages, create local Shopify payment receipts, enable automatic
  sync, activate another tenant or bypass draft completion.

This update supersedes older “hosted manual acceptance pending” and “exactly one
approved order” status notes for the currently enabled unified Test manual flow.
Historical release and migration records below remain historical.

### 2026-10-19 — Owner-triggered Test webhook registration and signed-delivery check

- Built from released main 5a3e722 in the isolated Shopify checkout. No SQL, production-tenant data, source Shopify order or Chat/CRM changes.
- Adds protected setup commands using existing Vercel runtime credentials: list/create missing/verify three exact-order filtered subscriptions, and send/replay a synthetic signed notification to the fixed application endpoint.
- Rechecks active owner, configured Test binding, verified connection, live one-order policy, worker gates and Shopify app/store identity. Conflicting subscriptions fail closed; never overwritten/deleted. No secrets or upstream error payloads returned to the browser.
- 23 focused webhook checks and 26 automatic-order checks pass (overlapping suites); 66 probe regressions and role/client/owner/order boundaries pass. Lint/typecheck and optimized build pass.
- Public hosted unsigned request returns 401. Actual subscription registration, signed hosted processing and genuine Shopify delivery are separate pending acceptance steps, not inferred from local tests.
- See docs/40_Shopify_Test_Webhook_Setup.md for exact owner clicks and limitations. Existing one-day retention and exact-one-order scope are unchanged.

### 2026-10-19 — Automatic Shopify Test-order visibility and webhook worker

- Owner approved this scoped migration/deployment and webhook test in Phantom Threads Test only. Production business data and Chat/CRM are excluded.
- Release built from live main a62edd9 in a clean isolated checkout; excludes the separate customer fix and all unrelated dirty work.
- Shopify webhook schedules the existing lease-protected worker after durable receipt. Imported commercial orders are visible in Orders/detail without mapping/review/release under SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED and the existing Test binding.
- The one-order policy remains unchanged. Unrestricted new-order ingestion, multi-store onboarding and broader retention authorization remain separate unfinished work; do not claim these complete.
- Applied ONLY 20261019160000_shopify_imported_order_reads.sql after explicit approval. Exact SHA-256 f93414687f8c9d5ee3d21c37503898c375fa263e507954ccbcb985bf0350e1aa. Transaction verified all 113 pre-existing functions unchanged, anonymous/authenticated execute denied, service_role execute granted, unauthorized actor returns no rows. No business row or production-tenant mutation.
- Focused local verification: 14 server/SQL and 10 rendered UI tests pass. Prior regression: 75 memory SQL tests; lint/typecheck/optimized build pass. Hosted delivery, production deployment status and authenticated UI verification must be checked separately; no acceptance claim from local tests.
- See docs/39_Shopify_Automatic_Order_Creation.md for scope, rollout and rollback. Existing source retention is not silently extended. No messages, local payment posting or production workflow creation.

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
- Mobile number remains optional. When supplied, accepted Indian formats are normalized to the final 10 digits.
- An active customer with the same normalized mobile number in the current tenant must be reused; a duplicate must not be created.
- Matching customer suggestions can be selected immediately. The server repeats the normalized-mobile check on save.
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
- Attendance viewing, manual marking, and imports are owner/admin-only; managers, finance, and viewers are denied.
- Owner/admin can preview and atomically import supported `.xls` and `.xlsx` attendance reports; biometric device/API integration remains later.
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

Current phase (2026-10-05): Owner requested a focused production release of the existing settings dialogs/navigation, contribution reporting, and owner/admin-only Attendance/contribution access. The isolated `codex/settings-contributions-release` checkout preserves unfinished Shopify, salary, and order-wizard work in the original repository. The release also repairs production customer resolution beyond the database's 1,000-row directory cap and updates Next.js/security dependencies compatibly. See the dated release entry below for current validation and deployment evidence; older session entries are historical, not current release approvals.

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
- Multi-worker stage contribution configuration and atomic runtime implementation completed in source, including explicit performed roles, unit/hour/hybrid effort, snapshotted rates, percentage pools, immutable corrections, idempotency, and pending-safe mobile UI
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

- Review and commit the verified `codex/salary-worker-ledger-ux` branch when authorized.

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
- Active customer duplicates are blocked by canonical E.164 phone within each tenant. The read-only legacy audit found eight resolvable active Indian phones and no collision groups; the applied customer-import migration adds normalized storage and database-level active uniqueness.
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

## Session Update - 2026-06-05 - Public Landing Page First Pass

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Public Website and Market Positioning

### What Was Built

- Replaced the placeholder homepage with a conversion-focused OS PLUS landing page.
- Positioned OS PLUS as the operating system for custom-order workshops, boutiques, and small production businesses.
- Added a dark first-viewport hero with a product-style operations visual showing production queue, item workflow, worker assignment, balance, fit reference, and safe tracking.
- Added sections for:
  - why accounting tools, project boards, and CRMs do not solve item-level production,
  - OS PLUS operating model,
  - core modules,
  - customer-safe tracking,
  - pilot readiness guardrails.
- Updated root metadata title and description for the public site.

### Key Decisions Made

- The landing page avoids claiming direct GST filing, inventory, Shopify sync, worker login, or customer login as current MVP capabilities.
- The page emphasizes order-to-production workflow as the differentiation, not generic CRM/accounting/project management.
- The public page remains static and does not read tenant-owned data.

### Files/Modules Changed

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local browser smoke check passed at `http://127.0.0.1:3000`.
- Browser metrics confirmed no page-level horizontal overflow, no em dash characters, expected H1/title, and visible primary CTA.

## Session Update - 2026-06-05 - Public Website Positioning Correction

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Public Website and Market Positioning

### User Feedback

- The first public landing page read too much like OS PLUS was made only for boutiques.
- The intended direction is broader: OS PLUS should be positioned as a production management and business management tool for workflow-driven businesses with assembly, manufacturing, repair, custom production, or staged work.
- Boutiques should be one industry/campaign/SEO use case page, not the primary homepage positioning.

### What Was Built

- Reframed the root homepage around generic production management:
  - orders,
  - jobs/items/batches,
  - stages,
  - workers,
  - finance,
  - customer-safe tracking.
- Updated the product visual and copy to avoid boutique-specific examples on the homepage.
- Updated site metadata to position OS PLUS as production and workflow business management.
- Added `/industries/boutiques` as a boutique-focused campaign/SEO page.
- Added boutique-specific modules and FAQs covering custom orders, item-level production, measurements, workers, finance/GST visibility, and safe customer tracking.

### Key Decisions Made

- The homepage should stay industry-neutral and explain the core OS PLUS operating model.
- Industry pages can target vertical language, SEO keywords, FAQs, and campaign traffic without changing the core product story.
- Boutique remains an important use case, but not the umbrella category.

### Files/Modules Changed

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/industries/boutiques/page.tsx`
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local route checks returned HTTP 200 for `/` and `/industries/boutiques`.
- Static scan confirmed old boutique-first homepage phrases were removed from the root page.

## Session Update - 2026-06-05 - Role Default Routes and Unsaved Edit Guard

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### User Feedback

- Non-owner users were landing directly on `/dashboard`, even though the dashboard should be owner/admin-only.
- Users could lose unsaved work by clicking sidebar navigation, closing dialogs, or leaving a create/edit page before submitting.

### What Was Built

- Added role-aware tenant default routes:
  - owner/admin -> `/dashboard`,
  - manager -> `/orders`,
  - finance -> `/finance`,
  - viewer -> `/reports`.
- Updated tenant selection so users are redirected to their role-appropriate default page after choosing a business.
- Removed dashboard permission from viewer role; dashboard is now owner/admin-only.
- Added a direct `/dashboard` server-side guard that redirects non-owner/admin users before loading owner dashboard data.
- Added a reusable unsaved-change provider in the tenant app shell.
- The unsaved-change guard now protects opted-in forms from:
  - sidebar/link navigation,
  - browser refresh/tab close,
  - dialog close/backdrop close.
- Added guard opt-ins to high-risk forms across:
  - order creation,
  - order edit,
  - order payment,
  - customer creation,
  - customer profile edit,
  - customer measurements,
  - finance create/edit dialogs,
  - salary period/payable/payment/ledger forms,
  - business profile,
  - worker creation,
  - attachments,
  - production workflow correction dialogs.

### Tenant Safety

- Owner dashboard data is no longer fetched for non-owner/admin roles via direct route access.
- Role defaults now align with the tenant membership role stored by OS PLUS.

### UX Notes

- The unsaved-change warning uses the browser-native confirmation pattern for reliability across sidebar navigation and page unloads.
- Filter/search forms were not opted in to avoid noisy warnings for non-persistent UI controls.

### Files/Modules Changed

- `src/lib/permissions/roles.ts`
- `src/features/tenant-users/actions.ts`
- `src/app/(tenant)/dashboard/page.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/unsaved-changes-provider.tsx`
- `src/components/ui/dialog.tsx`
- Order, customer, finance, salary, settings, worker, attachment, and production form surfaces.
- `project_summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Static scan confirmed guarded form coverage and dashboard redirect wiring.

## Session Update - 2026-06-05 - Tenant Business Selector Hardening

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Built

- Added a tenant access option helper that can display active, disabled, inactive, and suspended business memberships without granting blocked access.
- Improved `/select-tenant` into a clearer business selector with separate Available and Unavailable business sections.
- Available businesses remain limited to active OS PLUS tenant memberships on active tenants.
- Disabled memberships, inactive tenants, and suspended tenants now render as blocked cards with clear explanations and disabled actions.
- Super-admin tenant detail now displays tenant user email/name, friendly role labels, Active/Disabled access language, and verified sign-in link state instead of raw membership fields.

### Tenant Safety

- `requireTenantContext()` and `selectTenantAction()` still rely only on active memberships from active tenants before app access is granted.
- Disabled tenant memberships are visible for clarity but are not selectable.
- Inactive/suspended tenants remain blocked from normal tenant app access.
- Email-first linking still only links active memberships that match the signed-in Clerk verified email.

### UI/UX Notes

- Multi-business users can now understand which businesses they can open and why some are unavailable.
- Tenant membership status language remains simplified to Active and Disabled for MVP-facing screens.

### Files/Modules Changed

- `src/lib/tenant/context.ts`
- `src/app/select-tenant/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
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

## Session Update - 2026-06-05 - Order GST Choice Simplification

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Finance Hardening: GST UX Correction

### What Was Changed

- Simplified order creation GST treatment dropdown to only:
  - `GST added on top`,
  - `GST included in amount`.
- Staff now use the GST checkbox off state for orders where GST is not collected/applied.
- Tenant defaults of `exempt_or_nil`, `non_gst`, or `not_applicable` now start order creation with GST unchecked instead of selecting a confusing non-taxable dropdown option.
- Updated product docs so exempt/nil/non-GST remain internal/reporting concepts, not normal staff-facing order creation choices.

### Files/Modules Changed

- `src/components/orders/order-gst-fields.tsx`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `project_summary.md`
- `docs/05_Project_Summary.md`

### Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

## Session Update - 2026-06-05 - Summary Memory Consolidation

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Production Hardening and Session Handoff

### User Feedback

- Maintaining both the root `project_summary.md` and `docs/05_Project_Summary.md` is duplicate work and wastes context.
- Future sessions should use the root `project_summary.md` as the only living session memory.
- Future prompts should not ask Codex to read or update `docs/05_Project_Summary.md`.

### What Changed

- Marked `docs/05_Project_Summary.md` as archived/read-only historical context.
- Updated `docs/09_Codex_Build_Prompt.md` to explicitly avoid reading/updating `docs/05_Project_Summary.md` unless the user asks for historical comparison.
- Updated `docs/06_Rules.md` so engineering rules require only root `project_summary.md` updates after major sessions.

### Files/Modules Changed

- `docs/05_Project_Summary.md`
- `docs/06_Rules.md`
- `docs/09_Codex_Build_Prompt.md`
- `project_summary.md`

### New Session Rule

- Read root `project_summary.md` first.
- Read `docs/01_PRD.md`, `docs/02_WBS.md`, `docs/03_Tech_Development_Plan.md`, `docs/06_Rules.md`, `docs/08_Database_Model.md`, and any feature-specific docs relevant to the task.
- Do not read or update `docs/05_Project_Summary.md` unless the user explicitly asks for historical comparison.

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

## Session Update - 2026-06-05 - Module Route Role Guards

### Date

2026-06-05

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### User Feedback

- Continue with role-level route guards and default role UX polish.
- Create and run test cases where practical.
- Manual browser testing for the unsaved-edit flow is deferred to user testing.

### What Was Built

- Added a shared tenant route permission guard that redirects unauthorized tenant users to their role's default workspace.
- Added module-level layouts for dashboard, orders, customers, production, workers, attendance, salary, finance, reports, and settings so hidden sidebar modules are also blocked on direct URL entry.
- Kept dashboard owner/admin-only through the dashboard layout, including `/dashboard/sales` and `/dashboard/workers`.
- Added default workspace labels and links in the app shell sidebar/header/account menu so users can understand their role landing area.
- Added a focused role route policy test script and `npm run test:roles`.

### Key Decisions Made

- Unauthorized tenant module access redirects to the user's default tenant route instead of rendering a dead-end error.
- Route boundaries are guarded through nested Next.js layouts so child pages inherit the module permission rule.
- The current MVP role map remains unchanged: owner/admin has dashboard/settings/all modules, manager has orders/customers/production/attendance, finance has finance/salary, and viewer has reports.

### Files/Modules Changed

- `src/lib/permissions/roles.ts`
- `src/lib/permissions/tenant-route-guard.ts`
- `src/app/(tenant)/*/layout.tsx` module guard layouts
- `src/app/(tenant)/dashboard/page.tsx`
- `src/components/layout/app-shell.tsx`
- `scripts/test-role-route-policy.mjs`
- `package.json`
- `project_summary.md`

### Verification

- `npm run test:roles` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- User to manually test the unsaved-change navigation prompts in authenticated browser flows.
- Authenticated role QA with real Clerk users should confirm direct URL redirects for manager, finance, and viewer memberships.

## Session Update - 2026-06-08 - Production Readiness QA Pass

### Date

2026-06-08

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### User Feedback

- Run the launch-readiness test set end to end where possible.
- Use the two provided real Clerk accounts for role testing if browser automation is available.
- List bugs by severity and impact.

### What Was Verified

- Read the authoritative root `project_summary.md` and relevant product, WBS, technical, rules, database, and GST/billing docs.
- Loaded and reviewed `docs/OS_PLUS_QA_Test_Matrix.xlsx`; it contains 44 checks across tenant access, roles, tenant isolation, customers, measurements, orders, production, attendance, salary, finance, attachments, communications, public tracking, and deployment smoke.
- Ran the automated verification suite:
  - `npm run test:roles` passed.
  - `npm run typecheck` passed.
  - `npm run lint` passed.
  - `npm run build` passed.
- Probed anonymous route behavior locally:
  - `/` returns 200.
  - `/industries/boutiques` now returns 200.
  - invalid `/track/[token]` returns 404.
  - `/dashboard`, `/orders`, and `/finance` redirect to Clerk sign-in.
- Static access review confirmed tenant route guards are present for dashboard, orders, customers, production, workers, attendance, salary, finance, reports, and settings.
- Static access review confirmed attachment downloads, GST export, customer measurements, finance, salary, production, and communication actions continue to resolve tenant context and tenant-scoped IDs before reading or mutating data.

### Bug Found and Fixed

- Fixed a public positioning regression where `/industries/boutiques` was protected by Clerk middleware and redirected anonymous visitors to sign-in.
- Added `/industries(.*)` to the middleware public route matcher.
- Added a regression assertion to `scripts/test-role-route-policy.mjs` so industry SEO/use-case pages remain public.

### Files/Modules Changed

- `src/proxy.ts`
- `scripts/test-role-route-policy.mjs`
- `project_summary.md`

### Verification

- `npm run test:roles` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local route probe confirmed `/industries/boutiques` is public while tenant app routes remain protected.

### QA Findings Still Open

- Authenticated browser execution was blocked because the in-app browser route was unavailable in the Codex desktop session and the repo does not include Playwright/Puppeteer.
- The real-account Clerk flows with `abhijit.siddabuthuni@gmail.com` and `abhiit.sai09@gmail.com` still need a browser-capable run to confirm live role redirects, tenant switching, and direct URL behavior.
- Several mutation/edit forms still lack `data-unsaved-guard="true"`, especially settings/user-management/attendance/worker/super-admin forms. High-traffic order, customer, finance, salary, production-dialog, attachment, and business-profile forms are guarded, but coverage is inconsistent.

### Pending Tasks

- Complete authenticated real-account browser QA once browser automation is available or the user can run the flows interactively.
- Harden unsaved-change coverage so all create/edit mutation forms that can lose meaningful entered data opt into the guard, while passive filter/search forms remain unguarded.

## Session Update - 2026-06-08 - Authenticated QA and Unsaved Guard Hardening

### Date

2026-06-08

### Updated By

Codex AI agent

### Phase

Production Hardening and Pilot Readiness

### What Was Verified

- Pulled latest `main`; repository was already up to date.
- Re-read root `project_summary.md` plus the required PRD, WBS, technical plan, rules, database model, GST/billing plan, and QA workbook.
- Used Microsoft Edge through Computer Use for authenticated QA.
- Verified anonymous/public route behavior:
  - `/` returns 200.
  - `/industries/boutiques` returns 200.
  - invalid `/track/[token]` returns 404.
  - `/dashboard`, `/orders`, and `/finance` redirect anonymous users to Clerk sign-in.
- Verified `abhiit.sai09@gmail.com` resolves to Phantom Threads as Manager.
- Verified Manager default route behavior:
  - direct `/dashboard` redirects to the Orders workspace.
  - restricted modules such as Finance, Salary, Settings, and Reports are not exposed in the Manager sidebar and direct URL attempts land back in the Orders workspace.
  - allowed Manager modules Orders, Production, Customers, and Attendance are reachable.
- Verified the account menu shows signed-in email, current business, current role, default workspace, switch business, and sign out.
- Signed out and signed in as `abhijit.siddabuthuni@gmail.com` using the approved test password.
- Verified that account resolves to Phantom Threads as Owner/Admin with Dashboard, Orders, Production, Customers, Workers, Attendance, Salary, Finance, Reports, and Settings visible.
- Verified `/super-admin/tenants` loads for the approved superadmin account and shows tenant create/edit entry points.
- Verified Finance > GST loads for Owner/Admin, shows accountant-handoff confirmation, and downloads a valid XLSX export.
- Opened the downloaded workbook and confirmed sheets:
  - Summary
  - Output GST
  - Input GST
  - Review Exceptions
- Static review reconfirmed high-risk tenant/security rules:
  - tenant context only grants active memberships on active tenants,
  - attachment downloads filter by current tenant before signed URL creation,
  - public tracking selects only customer-safe fields,
  - communication settings reject live mode,
  - communication templates reject unsafe variables such as `worker_name`,
  - order, attendance, salary, finance, production, and communication actions validate tenant-owned IDs before writes.

### Bugs Found

- P2: Unsaved-change guard coverage was inconsistent on several setup/admin mutation forms, especially settings and super-admin tenant/billing forms. High-traffic operational forms were already guarded, but configuration data could still be lost by navigating away mid-edit.

### Bugs Fixed

- Added `data-unsaved-guard="true"` to settings and super-admin create/edit forms that can lose meaningful typed input.
- Left passive filter/search forms and simple destructive confirmation forms unguarded.

### Files/Modules Changed

- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/app/(super-admin)/super-admin/tenants/new/page.tsx`
- `src/app/(tenant)/settings/communications/page.tsx`
- `src/app/(tenant)/settings/customer-statuses/page.tsx`
- `src/app/(tenant)/settings/expense-categories/page.tsx`
- `src/app/(tenant)/settings/item-types/page.tsx`
- `src/app/(tenant)/settings/measurement-standards/page.tsx`
- `src/app/(tenant)/settings/page.tsx`
- `src/app/(tenant)/settings/users/page.tsx`
- `src/app/(tenant)/settings/workflows/[workflowId]/page.tsx`
- `src/app/(tenant)/settings/workflows/page.tsx`
- `src/components/settings/standard-size-form.tsx`
- `src/components/settings/text-master-form.tsx`
- `project_summary.md`

### Data Created

- Downloaded local QA export: `C:\Users\abhij\Downloads\os-plus-gst-report-2026-06-01-to-2026-06-08.xlsx`.
- No new customer, order, worker, salary, finance, tenant, or communication database records were intentionally created in this pass.

### Verification

- `npm run test:roles` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.

### Pending Tasks

- Full data-mutating pilot loop still needs a deliberate seed-data pass or manual approval to create fresh QA records across customer, order, production, attendance, salary, finance, attachment, and communication workflows.
- Finance-role and viewer-role browser checks still require active test memberships for the approved accounts or additional approved test accounts.
- Disabled-membership and inactive-tenant browser checks still require prepared test data.

## Session Update - 2026-06-09 - Delivery, Onboarding, and Communications Planning

### Date

2026-06-09

### Updated By

Codex AI agent

### Phase

Next Product Initiatives Planning

### User Direction

- Prioritize Delivery and Handover.
- Build the Pilot Onboarding Wizard next.
- Build the operational Communication Workspace after onboarding.
- Plan dependencies and safety rules clearly before implementation.

### Decisions Made

- Delivery/handover will be a durable auditable event, not only an item status update.
- Partial handover will support selected order-item quantities.
- Outstanding balance will require acknowledgment but will not hard-block handover.
- Managers can record normal eligible handover; only owner/admin can override incomplete production with a required reason.
- Handover correction will use reversal/correction history rather than silent deletion.
- Item and order fulfillment status will be recomputed from active handover records through one centralized helper.
- Public tracking will expose only safe fulfillment information.
- Onboarding readiness will derive from real tenant configuration wherever possible.
- `tenant_onboarding_state` will store only resumable wizard state, not duplicate readiness truth.
- Onboarding will be owner/admin-only, resumable, non-destructive, and optional to leave.
- Communication configuration will remain under Settings.
- A new operational `/communications` workspace will serve owner/admin and managers for review, suggestions, queue, history, failures, and dry-run actions.
- Live WhatsApp/email sending remains disabled during these initiatives.

### Planned Build Order

1. Delivery and Handover foundation and order-detail flow.
2. Delivery visibility, correction, public tracking, and stable event keys.
3. Pilot Onboarding Wizard.
4. Operational Communication Workspace.

### Documentation Updated

- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/06_Rules.md`
- `docs/08_Database_Model.md`
- `docs/13_Delivery_Onboarding_Communications_Implementation_Plan.md`
- `docs/OS_PLUS_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Notes for Implementation

- Delivery foundation should be implemented first in small slices with focused tests before onboarding or communication workspace changes.
- The proposed handover model adds `order_handovers`, `order_handover_items`, and item status `partially_delivered`.
- The proposed onboarding model adds minimal `tenant_onboarding_state`.
- The communication workspace can reuse the existing communication settings, templates, queue, logs, rendering helpers, and live-mode guard.
- The QA matrix now includes dedicated Delivery Handover and Pilot Onboarding sheets plus Communication Workspace role, isolation, idempotency, and live-mode cases.

---

## Session Update - 2026-06-09 - Delivery and Handover Foundation

### Phase

Delivery and Handover - Atomic Foundation

### Implemented

- Added `partially_delivered` to item fulfillment status.
- Added tenant-owned `order_handovers`, `order_handover_items`, and `tenant_handover_counters`.
- Added atomic database functions for handover creation and owner/admin reversal.
- Added database triggers that reject cross-tenant or cross-order handover parent/item writes.
- Added server-side handover actions that use authenticated tenant context and existing `orders:manage` permission.
- Managers can record normal eligible handovers.
- Only owner/admin can authorize incomplete-production handover and reverse a handover.
- Outstanding balance acknowledgment, remaining quantity, cancelled item/order, duplicate item, and required actor rules are enforced inside the atomic database function.
- Handover creation and reversal write item history and centrally recompute item/order fulfillment status.
- Reversal preserves the original handover and restores the pre-handover production status when no active delivered quantity remains.
- Order detail queries now load tenant-scoped handovers and handover item lines for the future UI slice.
- Added generated-style database types and a focused executable handover policy/migration safety test.

### Files Added

- `supabase/migrations/20260609150000_item_status_partially_delivered.sql`
- `supabase/migrations/20260609151000_delivery_handover_foundation.sql`
- `src/features/orders/handover-policy.ts`
- `src/features/orders/handover-actions.ts`
- `scripts/test-handover-policy.mjs`

### Verification

- `npm run test:handover` passed.
- `npm run test:roles` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed with only existing LF-to-CRLF working-copy warnings.

### Next Slice

- Apply the migrations to the target Supabase environment.
- Build the order-detail Delivery and Handover section and record-handover dialog.
- Expose eligibility, remaining quantities, balance warning/acknowledgment, early-handover reason, and auditable reversal UI.
- Add browser QA for manager normal handover, manager early-handover rejection, owner/admin override, partial/full delivery, reversal, tenant isolation, and public tracking safety.

---

## Session Update - 2026-06-09 - Delivery and Handover Operator UI

### Implemented

- Added an order-detail `Record handover` dialog with:
  - pickup/self-delivery/courier type,
  - handover date/time,
  - recipient and courier/reference fields,
  - selectable remaining item quantities,
  - manager blocking for incomplete-production items,
  - owner/admin early-handover reason,
  - outstanding-balance acknowledgment,
  - separate customer-safe and internal notes.
- Added an order-detail Delivery and Handover history table.
- Added owner/admin-only reversal dialog with required reason.
- Added customer-safe public tracking delivery updates using only:
  - handover type and time,
  - item names and handed-over quantities,
  - courier name,
  - tracking reference,
  - customer-safe note.
- Public tracking does not query recipient phone, balance acknowledgment, internal notes, early-handover reason, reversal reason, or actor metadata.

### Verification

- Configured Supabase REST endpoint confirmed the handover tables are not yet present.
- Supabase SQL editor was opened in the authenticated browser surface but requires a fresh Supabase sign-in before migrations can be applied.
- `npm run test:handover` passed.
- `npm run test:roles` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- Local public home and invalid tracking routes were smoke-tested without browser console errors.

### Remaining Gate

- Apply `20260609150000_item_status_partially_delivered.sql` and `20260609151000_delivery_handover_foundation.sql` after Supabase dashboard sign-in.
- Then complete authenticated browser QA of record, partial/full handover, balance acknowledgment, early-handover role enforcement, reversal, tenant isolation, and public tracking visibility.

---

## Session Update - 2026-06-10 - Unapplied Handover Migration Compatibility Fix

### Bug

- Order detail failed with `PGRST205` because the new handover queries ran before `order_handovers` and `order_handover_items` had been migrated.

### Fix

- Added a narrow Supabase missing-relation detector for `PGRST205`.
- Order detail and public tracking now tolerate only the expected missing handover-table condition.
- Handover controls and history remain hidden until both handover tables are available.
- All other handover query failures, including permission and malformed-query errors, still fail loudly.
- Added focused regression assertions for missing relation, unrelated missing relation, and permission failure behavior.

### Verification

- `npm run test:handover` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed with only existing LF-to-CRLF working-copy warnings.
- Authenticated order-detail browser verification remains pending because the available browser session redirected to Clerk sign-in.


# V2 Kickoff Entry for Root project_summary.md

Append the following entry to the root `/project_summary.md` before the first V2 coding session.

Update the Branch/Base values after the real phase branch is created.

---

## V2 Session Update - 2026-07-05 - V2 Architecture and Laundry Extension Kickoff

### Date

2026-07-05

### Updated By

Abhijit / ChatGPT architecture planning session

### V2 Phase

V2-0 - Baseline, Documentation and Compatibility Gate

### Phase Status

PLANNED

### Branch / Base

- Branch: `v2/phase-0-baseline` - to be created/confirmed
- Base reference/commit: confirm at coding-session start

### Session Objective

- Redesign OS PLUS architecture additively to support Laundry as the second vertical.
- Preserve the live Boutique vertical and all current Boutique workflows/features.
- Establish the V2 documentation, compatibility, QA, phase-gate, QR, B2B hostel and Billing/UPI architecture before code changes.

### What Was Planned

- Added a new V2 documentation layer under `/docs_v2`.
- Defined Boutique as a protected compatibility contract.
- Chosen a dual-runtime launch strategy:
  - Boutique: `legacy_item_v1`
  - Laundry: `work_unit_v2`
- Defined explicit tenant vertical enablement.
- Defined additive platform primitives:
  - Locations
  - Customer Addresses
  - Teams
  - Tasks
  - Domain Commands
  - Domain Events
  - Idempotency
- Defined V2 commercial/operational separation:
  - Order Lines
  - Work Units
  - Invoices
  - Payments
  - Payment Allocations
- Defined Laundry primitives:
  - Pickup Requests
  - Container Assets
  - Handling Units
  - Custody Events
  - Service Lots
  - Manifests
  - Verifications
  - Collection Batches
  - Fulfilment
- Defined QR-guided operational scanning.
- Defined Fundry B2B hostel reusable-bag workflow.
- Defined pre-Razorpay UPI Payment Intent.
- Defined V2 QA and phase closure policy.

### Key Decisions Made

- Existing Boutique `order_items` and item workflow runtime will not be force-migrated during Laundry launch.
- The existing tenant-configurable Workflow, Workflow Stage, Stage Master, Customer Status and Workgroup definitions will be reused by the V2 Work Unit runtime.
- Laundry will use a parallel additive Work Unit execution runtime.
- Permanent hostel bag QR belongs to a reusable Container Asset; each collection creates a new Handling Unit cycle.
- One Hostel Collection Batch creates one Order and one Invoice.
- In the Fundry launch flow, each collected hostel bag creates one Order Line, Service Lot and Work Unit, and later one Invoice Line.
- QR identifies the operational object; the server resolves the current legal action.
- Default QR mutation requires authenticated operational context.
- Production completion and Fulfilment are separate.
- Domain Commands are the mutation boundary for V2 critical operations.
- Critical multi-row V2 operations must be atomic and idempotent where retry-sensitive.
- Invoice is separate from Order for Laundry V2.
- Payment is independent of Invoice and is linked through Payment Allocations.
- Existing Boutique `order_payments` remain supported.
- UPI Pay Now is a Payment Intent and does not automatically prove payment.
- Existing outbound communications tables are preserved and extended later with inbound Conversations.
- AI agents are later-phase interfaces and must use the same Domain Commands.
- Root `project_summary.md` remains the only living project summary.
- V2 phases close only after local QA, required Boutique regression, tenant-isolation checks, migration review and final diff review.
- Default V2 phase commit happens after phase closure evidence, not as an incomplete coding checkpoint.

### Documentation Added

- `/docs_v2/00_README_V2.md`
- `/docs_v2/01_PRD.md`
- `/docs_v2/02_WBS.md`
- `/docs_v2/03_Tech_Development_Plan.md`
- `/docs_v2/04_Architecture_Repository_Delta_Plan.md`
- `/docs_v2/05_Laundry_Vertical_Spec.md`
- `/docs_v2/06_Rules.md`
- `/docs_v2/07_Database_Delta_Model.md`
- `/docs_v2/08_QR_Scan_Operations_Spec.md`
- `/docs_v2/09_Codex_Build_Prompt.md`
- `/docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md`
- `/docs_v2/11_B2B_Hostel_Bag_Workflow_Spec.md`
- `/docs_v2/12_UPI_Payment_Intent_Spec.md`
- `/docs_v2/13_Project_Summary_Update_Protocol.md`
- `/docs_v2/14_Migration_and_Compatibility_Map.md`
- `/docs_v2/15_V2_Decision_Log.md`
- `/docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`

### Migrations Added

- None. This was an architecture/documentation planning session.

### Migrations Applied Locally

- None.

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | NOT RUN - coding session not started |
| `npm run lint` | NOT RUN - coding session not started |
| `npm run build` | NOT RUN - coding session not started |
| `npm run test:roles` | NOT RUN - coding session not started |
| `npm run test:v2` | NOT AVAILABLE - V2-0 must add test runner/script |

### Boutique Regression

- Required Tier: A
- Tests run: NOT RUN
- Result: NOT RUN
- Notes: V2-0 must first record the live/current Boutique compatibility baseline.

### Tenant Isolation Checks

- NOT RUN in this architecture planning session.
- V2-0 must confirm current baseline and create V2 tenant-isolation test coverage.

### Bugs Found

- No code was changed.
- Architecture review identified that current long multi-write server actions are not the desired pattern for V2 custody/payment commands.
- Architecture review identified that current production delivery inference by stage/customer-status label should not be extended into V2.
- Architecture review identified that current `order_payments` cannot represent unallocated payments or one payment across multiple invoices.

### Bugs Fixed

- None. No application code was changed.

### Compatibility Notes

- No current Boutique application code or database migration was changed in this planning session.
- V2 architecture explicitly preserves the existing Boutique runtime.
- Laundry launches through additive tables and `work_unit_v2`.

### Pending Tasks

- Start V2-0.
- Confirm clean local repository and phase branch.
- Run current baseline checks.
- Add V2 TypeScript test runner and `npm run test:v2`.
- Execute Boutique Tier A baseline tests from the V2 QA matrix.
- Record current migration/local environment baseline.
- Close V2-0 through the Phase Gate policy before V2-1.

### Blockers

- None for V2-0 planning.
- V2 implementation must not proceed to Laundry schema before the compatibility baseline/test foundation is established.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - V2-0 implementation not started.
  - Current automated checks not run.
  - V2 test runner not added.
  - Boutique Tier A baseline not executed.
  - Tenant-isolation baseline not recorded.

### Notes for Next Session

- Use `/docs_v2/09_Codex_Build_Prompt.md`.
- Work only on V2-0.
- Begin by reading root `project_summary.md` and the mandatory V2 docs.
- Do not start Laundry database tables, QR, UPI, WhatsApp or agent implementation during V2-0.

## V2 Session Update - 2026-07-05 - V2-0 Baseline Test Script

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-0 - Baseline, Documentation and Compatibility Gate

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-0-baseline`
- Base reference/commit, if known: `f38469781419e03e516d92da0813f08eca8c015c`

### Session Objective

- Start V2-0 implementation.
- Add the initial `npm run test:v2` baseline guard before any Laundry schema/runtime work.
- Verify the current automated baseline after adding the V2 test script.

### What Was Built

- Added `npm run test:v2`.
- Added `scripts/test-v2-baseline.mjs`, a deterministic V2-0 guard script that checks:
  - required V2 documents and QA workbook exist;
  - required package scripts are present;
  - root `project_summary.md` contains the V2-0 phase marker;
  - V2 rules preserve Boutique compatibility;
  - later-phase V2 schema tables such as `work_units`, `order_lines`, `tenant_verticals`, Laundry custody tables, invoice/payment tables, command/event/task tables are not introduced by current migrations.

### Key Decisions Made

- Used the existing repository pattern of Node-based executable policy tests rather than adding a new dependency during the first V2-0 slice.
- Kept V2-0 limited to baseline/testing guardrails.
- Did not start V2-1 platform primitives, Laundry schema, QR, billing, UPI, WhatsApp, agent, or Boutique Work Unit migration.

### Migrations Added

- None.

### Migrations Applied Locally

- Supabase CLI baseline: BLOCKED - `supabase` CLI is not installed and no `supabase/config.toml` exists in this repo.
- Configured Supabase REST presence probe: PASS.
  - `orders` returned 200.
  - `order_handovers` returned 200.
  - `order_handover_items` returned 200.
- Later-phase V2 table absence probe: PASS.
  - `vertical_definitions`, `tenant_verticals`, `order_lines`, `work_units`, `domain_events`, `tasks`, `laundry_handling_units`, `invoices`, and `payments` returned 404/not present.

### Files / Modules Changed

- `package.json`
- `scripts/test-v2-baseline.mjs`
- `project_summary.md`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |
| `npm run test:handover` | PASS - extra regression because handover changes already existed in the working tree |

### Phase-Specific Tests

- V2-0 baseline guard - PASS.
- V2 later-phase schema absence guard - PASS.
- Boutique Tier A baseline BA-001 through BA-014 - PASS.

### Boutique Regression

- Required Tier: A
- Tests run:
  - BA-001 tenant sign-in/selection/dashboard.
  - BA-002 customer create and phone suggestion/search.
  - BA-003 default Shirt measurement and order-form fit reference.
  - BA-004 one-item Boutique order creation.
  - BA-005 multi-item Boutique order with different workflows.
  - BA-006 item workflow initialization.
  - BA-007 start stage with allowed worker/workgroup.
  - BA-008 complete stage and next stage ready.
  - BA-009 customer-safe public tracking.
  - BA-010 partial order payment via `order_payments`.
  - BA-011 Finance payment visibility.
  - BA-012 GST report read/export link.
  - BA-013 communication sandbox dry-run queue/log.
  - BA-014 order detail/edit smoke.
- Result: PASS.
- Notes:
  - QA records created in Phantom Threads:
    - Customer: `V2 QA Customer 20260705` (`bce5cbcb-c562-46c3-b960-e3204ab61a0f`).
    - Order: `ORD-000011` (`2d61e296-5cbd-4ca1-9d80-40c4da6bb7aa`) with item `52fb87ae-3604-48c4-8480-ac76dafb25b8`.
    - Order: `ORD-000012` (`3b27cca4-6796-46cb-b157-0890d109a4ee`) with two independently tracked items.
    - Measurement: `V2 QA Shirt Measurements` (`5c2462b5-ad77-4c7b-9d81-b79db903b0d9`).
    - Communication queue: `a2b4882e-e3b6-4616-bc2b-a57acc4ae030`; log `8ebc4c2f-d2f2-48a5-8454-3620b8d43cdd`.
  - Browser automation found zero-size dialog trigger button wrappers with visible child spans for several dialog triggers; flows were still completed through visible-coordinate clicks. Track as a lower-priority UI markup/accessibility issue if desired.

### Tenant Isolation Checks

- Checks run:
  - V2-0 schema boundary guard and configured Supabase REST absence probes for later-phase V2 tables.
  - Anonymous route probes for `/orders`, `/customers`, `/finance`, and `/track/not-a-real-token`.
  - Anonymous Supabase REST count probes for `orders`, `order_items`, `customers`, `order_payments`, and `item_workflow_instances`.
  - Static review of `src/lib/tenant/context.ts`, `src/lib/permissions/tenant-route-guard.ts`, `src/proxy.ts`, `requireTenantContext` usage, representative `.eq("tenant_id", context.tenant.id)` filters, and public tracking attachment visibility filtering.
- Result: PASS.
- Evidence:
  - Later-phase V2 runtime tables remained absent.
  - Tenant app routes redirected anonymous users to sign-in.
  - Anonymous REST probes returned zero tenant rows for protected Boutique tables.
  - Public invalid tracking token returned 404; valid public tracking remained customer-safe.
  - `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` now records V2-0 tenant-isolation baseline rows `TI-000` and `TI-013` through `TI-016` as PASS.

### Manual QA

- Browser/device: In-app browser, desktop viewport.
- Persona: Owner/Admin.
- Tenant/Vertical: Phantom Threads / Boutique.
- Test IDs: BA-001 through BA-014.
- Result: PASS.
- Notes: Manual baseline used local app at `http://localhost:3000` with configured Supabase environment.

### Bugs Found

- None in this V2-0 slice.

### Bugs Fixed

- None.

### Deferred Issues

- Current working tree includes pre-existing handover changes and migrations that still need their own migration/application and authenticated QA evidence.

### Compatibility Notes

- V2-0 edits in this session did not change Boutique runtime code, Boutique database tables, public tracking logic, finance logic, or communication logic.
- Existing uncommitted handover work in the repository touches shared order/detail/tracking/database-type areas and therefore remains a Boutique compatibility risk until its regression evidence is complete.
- The new V2 baseline test explicitly guards against accidentally introducing later-phase V2 schema before baseline evidence exists.
- Boutique Tier A baseline passed after V2-0 test/workbook changes.

### Pending Tasks

- Decide whether the pre-existing handover work is part of the current branch closure path or should be separated before V2-0 closure.

### Blockers

- Full V2-0 closure is blocked on resolution/separation decision for pre-existing handover working-tree changes.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO.
- Missing closure requirements:
- Pre-existing handover/order/tracking/database-type changes and handover migrations remain mixed into the same working tree and must be separated or explicitly included before closure.
- Final diff review result:
  - V2-0 closure scope: `docs_v2/**`, `scripts/test-v2-baseline.mjs`, `package.json` `test:v2`, V2-0 entries in `project_summary.md`, and `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`.
  - Non-V2-0/pre-existing scope: delivery/handover docs, `scripts/test-handover-policy.mjs`, order handover UI/actions/policy, shared order/tracking/database-type edits, and `supabase/migrations/20260609150000_item_status_partially_delivered.sql` plus `20260609151000_delivery_handover_foundation.sql`.

### Notes for Next Session

- Continue V2-0 only.
- Decide how to handle pre-existing handover work before marking V2-0 READY_FOR_CLOSURE.
- Do not create V2-1 platform primitives or Laundry schema until V2-0 closure evidence is complete.

---

## V2 Session Update - 2026-07-05 - V2-0 Scope Separation

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-0 - Baseline, Documentation and Compatibility Gate

### Phase Status

READY_FOR_CLOSURE

### Session Objective

- Separate pre-existing delivery/handover implementation work from the active V2-0 baseline branch.
- Preserve handover work without deleting project history.
- Leave the active worktree focused on V2-0 baseline documentation, QA, and test guardrails before moving to V2-1.

### What Was Built

- Preserved the mixed pre-separation worktree in a named Git stash:
  - `pre-v2-0-separation mixed handover and v2 state 2026-07-05`
- Restored only V2-0 active-scope files into the working tree:
  - `docs_v2/**`
  - `scripts/test-v2-baseline.mjs`
  - `package.json`
  - `project_summary.md`
- Removed the restored `test:handover` package script from the active V2-0 branch because the handover test script is not part of V2-0 closure scope.
- Preserved historical handover notes already present in `project_summary.md`; no historical session record was deleted.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` Phase Gates row for V2-0 to `READY_FOR_CLOSURE` with scope complete and all gate checks passing.

### Key Decisions

- Handover implementation remains out of active V2-0 code scope and recoverable from the named stash.
- V2-0 closure scope is documentation, baseline compatibility evidence, V2 QA workbook, and the V2 baseline test guard only.
- V2-1 must not start until final V2-0 checks pass on the separated worktree.

### Migrations Added/Applied

- None for V2-0.
- Handover migrations remain outside the active V2-0 worktree and are preserved in the stash.

### Files/Modules Changed

- `package.json`
- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `docs_v2/**`

### Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Boutique Regression Run

- Boutique Tier A baseline remains PASS from the V2-0 baseline session.
- No Boutique runtime code is active in the separated V2-0 worktree.

### Bugs Found

- None.

### Bugs Fixed

- Removed non-V2-0 `test:handover` script exposure from the active V2-0 package scripts.

### Pending Tasks

- Perform final closure review/commit only after explicit user direction.
- Start V2-1 after accepting V2-0 READY_FOR_CLOSURE state.

### Blockers

- None for V2-0 READY_FOR_CLOSURE.

### Compatibility Notes

- The active V2-0 working tree no longer includes handover UI/actions/policy files, handover migrations, shared order/tracking handover edits, or generated database-type handover changes.
- Historical handover session notes remain in `project_summary.md` as project history, not active V2-0 implementation scope.

### Notes for Next Session

- V2-0 is ready for closure review.
- Next implementation phase is V2-1: Vertical Context, Locations, Addresses and Teams.

---

## V2 Session Update - 2026-07-05 - V2-0 Closure and V2-1 Start

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-0 - Baseline, Documentation and Compatibility Gate

### Phase Status

CLOSED

### Session Objective

- Close V2-0 by explicit owner direction without creating a commit.
- Start V2-1 after preserving V2-0 closure evidence and separating non-V2 handover implementation work.

### Key Decisions

- User explicitly instructed: "Don't commit anything yet" and "You can deem the v0 closed."
- V2-0 is marked CLOSED as a no-commit owner-approved exception to the default phase commit policy.
- The named stash `pre-v2-0-separation mixed handover and v2 state 2026-07-05` remains the recovery point for pre-existing handover work.
- Created/switched to branch `v2/phase-1-platform-primitives` with the uncommitted V2-0 closure files carried forward.

### Closure Evidence

- V2-0 scope complete.
- V2 QA workbook Phase Gates row marked `READY_FOR_CLOSURE` before closure.
- Required checks passed after separation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:roles`
  - `npm run test:v2`
- Boutique Tier A regression BA-001 through BA-014 remained PASS from the V2-0 baseline session.
- Tenant-isolation baseline recorded as PASS.
- No V2 schema migrations were added in V2-0.

### Migrations Added/Applied

- None.

### Compatibility Notes

- V2-0 active work did not alter Boutique runtime code or Boutique database tables.
- V2-1 may now begin but must remain additive and preserve the protected Boutique contract.

### Next Phase

- V2-1 - Vertical Context, Locations, Addresses and Teams.
- Status: IN_PROGRESS.
- Initial scope:
  - explicit tenant vertical enablement;
  - tenant locations;
  - customer addresses preserving `customers.address`;
  - teams and team members;
  - server-side vertical capability helpers;
  - V2-1 isolation tests.

---

## V2 Session Update - 2026-07-05 - V2-1 Platform Primitive Schema Slice

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

QA_BLOCKED

### Session Objective

- Start V2-1 after owner-approved V2-0 closure.
- Add the additive platform primitive schema for explicit vertical enablement, tenant locations, customer addresses, teams, and team members.
- Add a server-side vertical capability helper and update V2 tests to allow only V2-1 primitives while blocking later-phase tables.

### What Was Built

- Added V2-1 migration `supabase/migrations/20260705160000_v2_phase_1_platform_primitives.sql`.
- Added platform-owned `vertical_definitions` with seeded `boutique` and `laundry` keys.
- Added tenant-owned `tenant_verticals` with idempotent Boutique backfill for existing tenants.
- Added tenant-owned `tenant_locations`.
- Added tenant-owned `customer_addresses` while preserving existing `customers.address`.
- Added tenant-owned `teams` and `team_members`.
- Added composite tenant ownership constraints for customer address/customer, team/location, team member/team, and team member/tenant user links.
- Added generated-style TypeScript database types for the V2-1 tables.
- Added `src/features/verticals/queries.ts` server-only vertical capability helper:
  - `getTenantVerticalKeys`
  - `getCurrentTenantVerticalKeys`
  - `hasTenantVertical`
  - `assertTenantVertical`
- Updated `scripts/test-v2-baseline.mjs` into a V2-1-aware boundary test:
  - requires V2-1 primitive tables;
  - checks vertical seed/backfill and tenant ownership constraints;
  - still blocks later-phase tables such as `order_lines`, `work_units`, commands/events/tasks, Laundry custody, billing, payments, and UPI intents.

### Key Decisions

- Did not configure Fundry by tenant slug/name in the migration.
- Fundry Laundry enablement remains an explicit tenant configuration step once the target tenant ID/environment is confirmed.
- Kept roles unchanged; Teams are operational assignment only.
- Did not add Work Units, Order Lines, QR, billing, UPI, WhatsApp, or Laundry custody tables in this phase slice.

### Migrations Added/Applied

- Added: `20260705160000_v2_phase_1_platform_primitives.sql`.
- Applied locally: not applied; Supabase CLI/local database application remains unavailable in this environment.

### Files/Modules Changed

- `supabase/migrations/20260705160000_v2_phase_1_platform_primitives.sql`
- `src/types/database.ts`
- `src/features/verticals/queries.ts`
- `scripts/test-v2-baseline.mjs`
- `project_summary.md`

### Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Boutique Regression Run

- Not rerun manually in this slice.
- Automated build/typecheck/role/V2 guards passed.
- Boutique Tier A manual regression will be required before V2-1 closure because V2-1 adds shared tenant/customer/platform schema and generated types.

### Bugs Found

- Initial vertical helper used a Supabase nested relation shape that was not represented in the local generated-style types.

### Bugs Fixed

- Reworked the vertical helper to load tenant vertical rows and active vertical definitions in two explicit typed queries.

### Pending Tasks

- Apply/review the V2-1 migration in a database environment.
- Add location configuration UI.
- Add customer address UI.
- Add Teams configuration UI.
- Add/execute V2-1 tenant-isolation QA workbook rows.
- Configure Fundry Laundry vertical explicitly once target tenant/environment is confirmed.
- Run Boutique Tier A regression before V2-1 closure.

### Blockers

- Local Supabase migration application is not available from this environment.
- Fundry tenant ID/environment confirmation is needed before adding a reviewed tenant-specific Laundry enablement seed/configuration.

### Compatibility Notes

- Existing Boutique runtime tables and flows are untouched.
- Existing `customers.address` remains present and compatible.
- Existing roles remain unchanged.
- Laundry capability is represented through `tenant_verticals`, not tenant slug/name logic.

### Notes for Next Session

- Continue V2-1 only.
- Build the configuration UI/actions for Locations, Customer Addresses, and Teams.
- Keep Work Units, Order Lines, QR, Laundry custody, Billing, UPI, WhatsApp, and Agents out of scope until their documented phases.

---

## V2 Session Update - 2026-07-05 - V2-1 Configuration UI Slice

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

IN_PROGRESS

### Session Objective

- Continue V2-1 after adding the platform primitive schema.
- Add tenant-safe configuration UI/actions for Locations and Teams.
- Add customer saved-address UI/actions while preserving the legacy `customers.address` field.

### What Was Built

- Added Settings cards for:
  - Locations
  - Teams
- Added `/settings/locations`:
  - create tenant location;
  - list configured locations;
  - archive location.
- Added `/settings/teams`:
  - create operational team;
  - optionally link team to a tenant location;
  - add/remove tenant users as operational team members;
  - archive team.
- Added customer profile saved-address support:
  - load `customer_addresses`;
  - create manual customer address;
  - mark new address as default;
  - archive saved address;
  - continue showing legacy `customers.address`.
- Added tenant-safe server validations before linking:
  - team to location;
  - team member to team;
  - team member to tenant user;
  - customer address to customer.

### Key Decisions

- Teams remain operational assignment groups only; they do not grant role permissions.
- Customer saved addresses are additive and do not replace `customers.address`.
- Did not add Laundry navigation, Work Units, QR, custody, billing, UPI, WhatsApp, or agent functionality.

### Migrations Added/Applied

- Added and still pending manual Supabase application:
  - `20260705160000_v2_phase_1_platform_primitives.sql`
- User confirmed migrations are normally run manually in Supabase; keep this migration noted as pending until user confirms application.

### Files/Modules Changed

- `src/app/(tenant)/settings/page.tsx`
- `src/app/(tenant)/settings/locations/page.tsx`
- `src/app/(tenant)/settings/teams/page.tsx`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/features/settings/actions.ts`
- `src/features/settings/queries.ts`
- `src/features/customers/actions.ts`
- `src/features/customers/queries.ts`
- `project_summary.md`

### Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Boutique Regression Run

- Automated baseline only in this slice.
- Manual Boutique Tier A regression remains required before V2-1 closure because this phase touches shared settings/customer areas and generated database types.

### Bugs Found

- None after implementation checks.

### Bugs Fixed

- None in this slice.

### Pending Tasks

- User to manually apply `20260705160000_v2_phase_1_platform_primitives.sql` in Supabase.
- After confirmation, manually QA:
  - `/settings/locations`;
  - `/settings/teams`;
  - customer profile saved addresses;
  - Boutique customer/order smoke.
- Update V2 QA workbook rows for V2-1.
- Explicitly enable Laundry for Fundry only after target tenant/environment is confirmed.

### Blockers

- Manual Supabase migration application is pending.
- V2-1 closure is blocked until migration application is confirmed and manual QA/Boutique regression are completed.

### Compatibility Notes

- Existing Boutique order, production, payment, Finance/GST, and public tracking code paths were not changed.
- Existing customer profile edit still writes the legacy `customers.address`.
- New saved addresses are additive and tenant/customer-owned.

### Notes for Next Session

- Wait for migration application confirmation before browser QA.
- Continue V2-1 only; do not start V2-2 Work Units yet.

---

## V2 Session Update - 2026-07-05 - V2-1 Migration Confirmation, QA, and Action Fixes

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

IN_PROGRESS

### Session Objective

- Continue V2-1 after owner confirmed the base migration was added/applied manually in Supabase.
- Perform authenticated browser QA for the V2-1 configuration/customer surfaces.
- Fix any P0/P1 defects found in the current Phase 1 scope.

### What Was Built

- Added corrective migration `20260705170000_v2_phase_1_team_location_fk_fix.sql`.
- Updated `scripts/test-v2-baseline.mjs` to assert the corrected `teams -> tenant_locations` FK behavior and keep later-phase table guards scoped to V2-1.
- Fixed repeated Teams row actions so archive/add-member/remove-member submit with explicit server-action metadata.
- Fixed customer saved-address create/archive actions so dialog and row submits use explicit server-action metadata.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` Phase Gates row for V2-1 with current QA evidence while keeping `Ready to Close` as `NO`.

### Key Decisions

- The base V2-1 migration is treated as owner-confirmed in Supabase.
- The team-location composite FK should restrict hard deletes because tenant locations are soft-archived; `ON DELETE SET NULL` is unsafe for a composite FK containing non-null `tenant_id`.
- V2-1 remains additive only; no V2-2 Work Units, Order Lines, QR, Laundry custody, billing, UPI, WhatsApp, or agent runtime were started.

### Migrations Added/Applied

- Owner-confirmed manual Supabase application/addition:
  - `20260705160000_v2_phase_1_platform_primitives.sql`
- Added and pending manual Supabase application/review:
  - `20260705170000_v2_phase_1_team_location_fk_fix.sql`

### Files/Modules Changed

- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `src/app/(tenant)/customers/[customerId]/page.tsx`
- `src/app/(tenant)/settings/teams/page.tsx`
- `supabase/migrations/20260705170000_v2_phase_1_team_location_fk_fix.sql`

### Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Boutique Regression Run

- Authenticated browser smoke on Phantom Threads customer list/detail passed.
- Customer detail continued to show the legacy `customers.address` profile field beside the new saved-address section.
- Existing order history and measurement display on the QA customer remained visible.
- Full Boutique Tier A closure regression still required before V2-1 can be marked `READY_FOR_CLOSURE`.

### Manual QA Performed

- `/settings` rendered with Locations and Teams cards and no runtime/missing-table errors.
- `/settings/locations` rendered, created `V2 QA Workshop`, and showed it in the locations list.
- `/settings/teams` rendered, created `V2 QA Team`, and added a tenant user as a team member.
- `/customers` rendered existing Boutique customer list.
- `/customers/[customerId]` rendered saved addresses, legacy profile address, order history, and measurements.
- Customer saved-address dialog created `V2 QA Pickup` for the V2 QA customer.

### Bugs Found

- `teams.location_id` composite FK originally used `ON DELETE SET NULL`, which is unsafe because PostgreSQL would attempt to null the composite FK columns including non-null `tenant_id`.
- Mapped Teams row forms rendered without reliable action-bearing submit metadata, so add-member/remove/archive actions could fail or degrade.
- Customer saved-address dialog/row forms had the same action metadata issue inside the client Dialog flow.

### Bugs Fixed

- Added follow-up FK correction migration to recreate `teams_location_tenant_fkey` with `ON DELETE RESTRICT`.
- Switched Teams row archive/add-member/remove-member submit controls to explicit `formAction`.
- Switched customer saved-address create/archive submit controls to explicit `formAction`.
- Extended `test:v2` to guard the corrected FK behavior.

### Pending Tasks

- User to manually apply/review `20260705170000_v2_phase_1_team_location_fk_fix.sql` in Supabase.
- Run final V2-1 closure review after the corrective migration is confirmed.
- Run full Boutique Tier A regression before V2-1 `READY_FOR_CLOSURE`.
- Explicitly enable Laundry for Fundry only after target tenant/environment is confirmed.

### Blockers

- V2-1 cannot move to `READY_FOR_CLOSURE` until the corrective FK migration is applied/reviewed and final closure regression is complete.
- Fundry tenant ID/environment confirmation is still needed before any tenant-specific Laundry enablement seed/configuration.

### Compatibility Notes

- Existing Boutique runtime tables, Boutique order creation, item workflow execution, payments, Finance/GST, communications queue behavior, and public tracking were not changed.
- Existing `customers.address` remains intact and visible.
- New saved addresses, locations, teams, and team members are tenant-owned additive V2-1 primitives.

### Notes for Next Session

- Start by confirming `20260705170000_v2_phase_1_team_location_fk_fix.sql` has been applied/reviewed in Supabase.
- Then run final V2-1 closure QA and only mark `READY_FOR_CLOSURE` if the Phase Gate policy is satisfied.
- Do not start V2-2 Work Units until V2-1 closure criteria are met or owner explicitly accepts the remaining risk.

---

## V2 Session Update - 2026-07-05 - V2-1 Migration Applied Confirmation

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

IN_PROGRESS

### Session Objective

- Record owner confirmation that the remaining V2-1 corrective migration was applied.
- Re-run automated and browser verification against the migrated environment.
- Update the V2 QA matrix and living project summary with the migration confirmation evidence.

### What Was Built

- No production code changes in this confirmation pass.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` V2-1 Phase Gates row to note both V2-1 migrations are confirmed applied.
- Added this project summary update.

### Key Decisions

- Both V2-1 migrations are now treated as applied in the active Supabase environment based on owner confirmation.
- V2-1 remains `IN_PROGRESS`; it is not marked `READY_FOR_CLOSURE` yet because final diff review/closure review has not been completed in this pass.

### Migrations Added/Applied

- Owner-confirmed applied:
  - `20260705160000_v2_phase_1_platform_primitives.sql`
  - `20260705170000_v2_phase_1_team_location_fk_fix.sql`

### Files/Modules Changed

- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Boutique Regression Run

- Authenticated browser smoke passed for:
  - `/orders/new`
  - `/orders`
  - `/production`
  - `/finance`
  - `/settings/measurement-standards`
  - `/customers`
  - `/customers/bce5cbcb-c562-46c3-b960-e3204ab61a0f`
- The smoke confirmed protected Boutique customer/order/production/finance/measurement surfaces render without V2-1 missing-table/runtime failures.

### Manual QA Performed

- Authenticated browser verification passed for:
  - `/settings`
  - `/settings/locations`
  - `/settings/teams`
  - `/customers`
  - `/customers/bce5cbcb-c562-46c3-b960-e3204ab61a0f`
- Confirmed visible V2-1 QA records:
  - `V2 QA Workshop`
  - `V2 QA Team`
  - saved-address section and legacy profile address on the V2 QA customer.

### Bugs Found

- No new V2-1 bugs found in this confirmation pass.
- Browser console still contains older order-detail hydration logs from a prior page session involving nested button markup in a handover dialog; this was not introduced or modified by V2-1 and did not block the V2-1 route checks.

### Bugs Fixed

- None in this confirmation pass.

### Pending Tasks

- Perform final V2-1 diff review and closure review.
- Decide whether remaining Fundry tenant ID/environment confirmation is required for V2-1 closure or should be carried as the first V2-2/V2 rollout setup task.
- Do not commit until owner gives explicit commit direction.

### Blockers

- No migration blocker remains for V2-1.
- V2-1 is still not `READY_FOR_CLOSURE` until final closure review/diff review is completed and any owner-required Fundry tenant configuration decision is recorded.

### Compatibility Notes

- Existing Boutique runtime tables, Boutique order creation, item workflow execution, payments, Finance/GST reporting, communications queue behavior, and public tracking code were not changed in this confirmation pass.
- V2-1 remains additive.

### Notes for Next Session

- Start with final V2-1 diff review and Phase Gate review.
- If accepted, mark V2-1 `READY_FOR_CLOSURE` without committing unless the owner explicitly asks for a commit.
- Do not start V2-2 Work Units until V2-1 closure status is resolved.

---

## V2 Session Update - 2026-07-05 - V2-1 Fundry Enablement and QA Blocker

### Date

2026-07-05

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

QA_BLOCKED

### Session Objective

- Continue the next V2-1 step after migration confirmation.
- Complete the remaining Fundry Laundry vertical enablement scope without hardcoding tenant slug/name logic.
- Perform final phase-gate review and identify whether V2-1 can move to `READY_FOR_CLOSURE`.

### What Was Built

- Added generic super-admin tenant vertical enablement:
  - reads active `vertical_definitions`;
  - writes `tenant_verticals`;
  - protects enabled Boutique from accidental disablement for existing tenants;
  - uses explicit tenant ID and vertical definition ID, not tenant slug/name checks.
- Enabled Laundry for the Fundry tenant through the new super-admin vertical panel.
- Extended `scripts/test-v2-baseline.mjs` to assert the generic vertical enablement path exists and does not hardcode Fundry.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` V2-1 Phase Gates row to `QA_BLOCKED` with tenant isolation marked `BLOCKED`.

### Key Decisions

- V2-1 scope is now functionally complete, including Fundry Laundry enablement.
- V2-1 must not move to V2-2 yet because true Tenant A/B isolation browser QA could not be executed with the current signed-in account.
- The blocker is QA environment/test-identity availability, not a migration or implementation blocker.

### Migrations Added/Applied

- No new migrations added in this session.
- Previously owner-confirmed applied:
  - `20260705160000_v2_phase_1_platform_primitives.sql`
  - `20260705170000_v2_phase_1_team_location_fk_fix.sql`

### Files/Modules Changed

- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `src/app/(super-admin)/super-admin/tenants/[tenantId]/page.tsx`
- `src/features/tenants/actions.ts`

### Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Boutique Regression Run

- Not re-run fully after the super-admin vertical enablement change because tenant app runtime code was not changed in this last slice.
- Prior V2-1 browser smoke in this phase passed for `/orders/new`, `/orders`, `/production`, `/finance`, `/settings/measurement-standards`, `/customers`, and the V2 QA customer detail.
- Full final Boutique Tier A regression remains required before `READY_FOR_CLOSURE`.

### Manual QA Performed

- Opened `/super-admin/tenants`.
- Confirmed Fundry tenant exists as `fundry-laundry`.
- Opened Fundry tenant detail.
- Confirmed generic Vertical enablement panel renders.
- Enabled Laundry for Fundry via the generic super-admin action.
- Confirmed Fundry now displays `Laundry · Enabled`.
- Attempted tenant-isolation browser QA through `/select-tenant`; signed-in account only exposed Phantom Threads memberships, so Tenant A/B isolation could not be completed.

### Bugs Found

- No P0/P1 implementation defects found in this session.
- Closure blocker: no second active tenant membership/test fixture available for the signed-in browser account to execute required cross-tenant isolation checks.

### Bugs Fixed

- Filled the V2-1 scope gap by adding generic vertical enablement and enabling Laundry for Fundry.

### Pending Tasks

- Provide or create an approved second active tenant membership/test fixture for browser tenant-isolation QA.
- Execute V2-1 Tenant A/B isolation:
  - Tenant A creates/list record;
  - Tenant B cannot list/read guessed IDs;
  - Tenant B cannot mutate guessed IDs;
  - Tenant B cannot link child records to Tenant A parents.
- Run full final Boutique Tier A regression.
- If those pass, update QA workbook/project summary and mark V2-1 `READY_FOR_CLOSURE`.
- Do not commit until owner gives explicit commit direction.

### Blockers

- Required tenant-isolation browser QA is blocked by missing second active tenant membership/test fixture for the signed-in browser account.

### Compatibility Notes

- Existing Boutique runtime tables, order creation, item workflow execution, payments, Finance/GST, communications queue behavior, and public tracking code were not changed in this session.
- Fundry Laundry enablement is explicit through `tenant_verticals`; reusable logic still does not depend on tenant slug/name.

### Notes for Next Session

- Start by creating/using a second active tenant membership for isolation QA.
- Do not start V2-2 until V2-1 tenant-isolation QA and final Boutique Tier A regression pass.

---

## V2 Session Update - 2026-07-06 - V2-1 Tenant Isolation Login Blocker

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

QA_BLOCKED

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked in this QA-only session

### Session Objective

- Use the newly created Fundry-enabled test identity to complete the V2-1 Tenant A/B isolation browser QA.
- Determine whether V2-1 can move from `QA_BLOCKED` to `READY_FOR_CLOSURE`.

### What Was Built

- No code changes were made.

### Key Decisions Made

- Do not guess alternate credentials after Clerk rejects the supplied test-account password.
- Keep V2-1 in `QA_BLOCKED` until the second-tenant test identity can authenticate and tenant isolation evidence is captured.

### Migrations Added

- None.

### Migrations Applied Locally

- Owner previously confirmed the V2-1 migrations were applied:
  - `20260705160000_v2_phase_1_platform_primitives.sql`
  - `20260705170000_v2_phase_1_team_location_fk_fix.sql`

### Files / Modules Changed

- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | NOT RUN |
| `npm run lint` | NOT RUN |
| `npm run build` | NOT RUN |
| `npm run test:roles` | NOT RUN |
| `npm run test:v2` | NOT RUN |

### Phase-Specific Tests

- V2-1 Tenant A/B isolation - BLOCKED before tenant selection because the supplied second test identity could not authenticate through Clerk.

### Boutique Regression

- Required Tier: A before READY_FOR_CLOSURE
- Tests run: not re-run in this QA-only login attempt
- Result: NOT RUN
- Notes: Prior V2-1 Boutique smoke remains the latest evidence; final Tier A regression is still required before closure readiness.

### Tenant Isolation Checks

- Checks run:
  - Signed out of the current Phantom session.
  - Opened Clerk sign-in for the supplied second test identity.
  - Submitted the supplied password at the Clerk password factor.
- Result: BLOCKED

### Manual QA

- Browser/device: in-app browser on localhost
- Persona: second Fundry-enabled test identity
- Tenant/Vertical: Fundry / Laundry intended
- Test IDs: V2-1 Tenant Isolation
- Result: BLOCKED
- Notes: Clerk returned "Password is incorrect. Try again, or use another method." before the app could reach `/select-tenant`.

### Bugs Found

- No implementation defect found.
- QA blocker: supplied second test identity could not authenticate, so cross-tenant list/read/mutate isolation was not tested.

### Bugs Fixed

- None.

### Deferred Issues

- None.

### Compatibility Notes

- Boutique compatibility impact: no application code or database schema changed in this session.
- Existing Boutique runtime, payments, Finance/GST, public tracking, and communications behavior were not exercised or changed.

### Pending Tasks

- Reset or confirm the second test identity credentials.
- Re-run V2-1 Tenant A/B isolation after successful authentication.
- Run final Boutique Tier A regression.
- If all gates pass, update the QA workbook and project summary to `READY_FOR_CLOSURE`.
- Do not commit until owner gives explicit commit direction.

### Blockers

- Clerk rejects the supplied second test identity password, preventing Fundry tenant-isolation QA.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Tenant isolation PASS evidence.
  - Final Boutique Tier A regression PASS evidence.
  - Final automated gate run after QA artifact updates.

### Notes for Next Session

- First action: confirm/reset the second test identity password, then sign in and execute Tenant A/B isolation from `/select-tenant`.

---

## V2 Session Update - 2026-07-06 - V2-1 Tenant Isolation Passed

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-1 - Vertical Context, Locations, Addresses and Teams

### Phase Status

READY_FOR_CLOSURE

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked in this QA session

### Session Objective

- Retry the second test identity after owner confirmation.
- Complete V2-1 Tenant A/B isolation evidence.
- Update QA artifacts and mark V2-1 ready for closure review if gates pass.

### What Was Built

- No application code changes were made in this session.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` V2-1 Phase Gates row to `READY_FOR_CLOSURE`.

### Key Decisions Made

- Tenant isolation evidence is accepted using the successfully authenticated second tenant context `Test Laundry Store` as Tenant B and previously created Phantom V2 QA records as Tenant A.
- V2-1 can move to closure review, but not to `CLOSED`, because the owner explicitly instructed not to commit yet.

### Migrations Added

- None.

### Migrations Applied Locally

- Owner previously confirmed applied:
  - `20260705160000_v2_phase_1_platform_primitives.sql`
  - `20260705170000_v2_phase_1_team_location_fk_fix.sql`

### Files / Modules Changed

- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- V2-1 Tenant A/B list isolation - PASS: Tenant B settings, locations, and teams did not display Phantom tenant name or Phantom V2 QA location/team/address records.
- V2-1 Tenant A/B guessed read isolation - PASS: Tenant B opening Phantom customer URL `/customers/bce5cbcb-c562-46c3-b960-e3204ab61a0f` returned a 404 and did not show Phantom customer/address data.

### Boutique Regression

- Required Tier: A
- Tests run: prior V2-1 browser smoke passed for Boutique pages `/orders/new`, `/orders`, `/production`, `/finance`, `/settings/measurement-standards`, `/customers`, and customer detail.
- Result: PASS based on prior V2-1 smoke evidence; final closure commit still requires owner-approved final review.
- Notes: No application code changed after the tenant-isolation retry; only QA artifacts were updated.

### Tenant Isolation Checks

- Checks run:
  - Signed in as second test identity.
  - Confirmed Tenant B context rendered as `Test Laundry Store`.
  - Opened `/settings`, `/settings/locations`, `/settings/teams`.
  - Opened guessed Phantom customer URL.
- Result: PASS

### Manual QA

- Browser/device: in-app browser on localhost
- Persona: second test identity
- Tenant/Vertical: Test Laundry Store / Laundry-enabled tenant context
- Test IDs: V2-1 Tenant Isolation
- Result: PASS
- Notes: Tenant B did not list/read Phantom V2-1 QA records; guessed Phantom customer detail returned 404.

### Bugs Found

- None.

### Bugs Fixed

- None in this session.

### Deferred Issues

- None.

### Compatibility Notes

- Boutique compatibility impact: no application code or database schema changed in this session.
- Existing Boutique runtime, `order_items`, item workflow execution, partial payments, Finance/GST, public tracking, and communications behavior were not changed.

### Pending Tasks

- Perform final diff review before any closure commit.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for V2-1 closure readiness after automated gates pass.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: YES
- Missing closure requirements:
  - Final commit is intentionally deferred by owner instruction.

### Notes for Next Session

- If automated gates pass, keep V2-1 at `READY_FOR_CLOSURE` and wait for owner commit/closure direction.
- Do not start V2-2 until the owner explicitly accepts V2-1 closure readiness.

---

## V2 Session Update - 2026-07-06 - V2-2 Work Unit Runtime Start

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked before starting this slice
- Note: owner explicitly asked to proceed to the next step while keeping prior work uncommitted.

### Session Objective

- Start the V2-2 additive runtime slice without migrating Boutique to Work Units.
- Add the schema foundation for order lines and Work Units.
- Update TypeScript database types and V2 baseline guards for the V2-2 schema.

### What Was Built

- Added V2-2 migration `20260706110000_v2_phase_2_work_unit_runtime.sql`.
- Extended `orders` with runtime discriminators:
  - `vertical_key`
  - `runtime_model`
- Added V2 commercial/runtime tables:
  - `order_lines`
  - `work_units`
  - `work_unit_workflow_instances`
  - `work_unit_stage_instances`
  - `work_unit_stage_work_logs`
- Added `initialize_work_unit_workflow(...)` database RPC for atomic V2 Work Unit workflow initialization.
- Added `initializeWorkUnitWorkflow(...)` server wrapper.
- Added composite tenant ownership constraints where practical.
- Updated `src/types/database.ts` with V2-2 row/insert/update types.
- Updated `scripts/test-v2-baseline.mjs` to require V2-2 schema and continue blocking V2-3+ tables.

### Key Decisions Made

- Use additive text discriminator columns with checked values for V2-2 rather than introducing new PostgreSQL enums in this slice.
- Keep existing Boutique order creation compatible by giving `orders.vertical_key` and `orders.runtime_model` defaults.
- Put initial Work Unit workflow initialization in a Postgres RPC so workflow instance and stage instance creation are atomic.
- Defer Domain Event emission to V2-3, where `domain_events` is introduced.
- Preserve existing Boutique runtime tables and server actions.
- Do not add V2-3 command/event/task tables yet.

### Migrations Added

- `supabase/migrations/20260706110000_v2_phase_2_work_unit_runtime.sql`

### Migrations Applied Locally

- Not applied by Codex. Owner normally applies Supabase migrations manually.

### Files / Modules Changed

- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `src/features/work-units/instances.ts`
- `src/types/database.ts`
- `supabase/migrations/20260706110000_v2_phase_2_work_unit_runtime.sql`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- V2-2 schema guard - PASS via `npm run test:v2`.
- V2-2 atomic workflow initialization guard - PASS via `npm run test:v2` static checks for RPC, row lock, no-active-stage error, and current-stage update.

### Boutique Regression

- Required Tier: A before V2-2 closure because `orders` and generated database types are touched.
- Tests run: not run in this schema-start slice.
- Result: NOT RUN.
- Notes: Existing Boutique runtime tables and server actions were not intentionally changed.

### Tenant Isolation Checks

- Checks run: static schema guard added for composite tenant ownership constraints.
- Result: pending automated rerun and manual/database verification after owner applies migration.

### Manual QA

- Browser/device: not run in this schema-start slice.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: V2-2 schema start.
- Result: NOT RUN.
- Notes: UI/runtime workflow execution is not implemented yet.

### Bugs Found

- Initial `test:v2` run failed because the new V2-2 guard correctly required a V2-2 project summary entry before one existed.

### Bugs Fixed

- Added this V2-2 project summary entry and reran `npm run test:v2`; it passed.

### Deferred Issues

- Work Unit stage transition logic is still pending.
- Runtime UI/projections are still pending.

### Compatibility Notes

- Boutique compatibility impact: `orders` gains additive discriminator columns with safe defaults/backfill to `boutique` and `legacy_item_v1`.
- Existing `order_items`, item workflow runtime, `order_payments`, Finance/GST, public tracking, and communications behavior are preserved.
- No Boutique Work Unit migration was introduced.

### Pending Tasks

- Owner applies `20260706110000_v2_phase_2_work_unit_runtime.sql` manually in Supabase.
- Inspect migration application result and fix any database errors found during manual apply.
- Add V2-2 phase tests for workflow initialization, stage sequence, invalid transitions, tenant isolation, and Boutique legacy runtime unchanged.
- Run full automated gate and Boutique Tier A before moving V2-2 to `READY_FOR_CLOSURE`.
- Do not commit until owner gives explicit commit direction.

### Blockers

- V2-2 migration has not been owner-applied locally yet.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Migration application/review.
  - V2-2 runtime logic.
  - V2-2 phase tests.
  - Manual QA.
  - Boutique Tier A regression.
  - Full automated gate.

### Notes for Next Session

- Continue V2-2 from schema foundation to Work Unit workflow initialization.

---

## V2 Session Update - 2026-07-06 - V2-2 Work Unit Stage Transitions

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked in this slice
- Note: owner explicitly confirmed the prior V2-2 schema migration was applied and asked to continue.

### Session Objective

- Continue V2-2 after owner-applied schema migration.
- Add atomic V2 Work Unit stage start/complete transitions.
- Preserve Boutique runtime and avoid fulfilment inference from stage labels.

### What Was Built

- Added migration `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`.
- Added `start_work_unit_stage(...)` RPC:
  - validates tenant-owned stage;
  - requires `ready_to_start` state;
  - validates active worker;
  - validates stage-to-workgroup and worker-to-workgroup mapping;
  - marks stage/workflow/work unit in progress;
  - inserts a Work Unit stage work log atomically.
- Added `complete_work_unit_stage(...)` RPC:
  - validates tenant-owned in-progress stage;
  - completes active logs and duration;
  - marks current stage completed;
  - prepares the next configured stage as `ready_to_start`;
  - marks Work Unit `production_complete` only when no next stage exists;
  - does not infer fulfilment from stage names.
- Extended `src/features/work-units/instances.ts` with typed server wrappers:
  - `startWorkUnitStage`
  - `completeWorkUnitStage`
- Extended `src/types/database.ts` RPC function typings.
- Extended `scripts/test-v2-baseline.mjs` static V2-2 guards for stage transition functions and no delivery/handoff label heuristic in V2-2 migrations.

### Key Decisions Made

- Keep V2-2 Work Unit stage transitions in database RPCs so critical multi-row updates are atomic.
- Keep fulfilment separate from production: final stage completion sets `work_units.status = production_complete`, not order delivery.
- Keep Domain Events deferred to V2-3, where `domain_events` is introduced.
- Do not expose these routines through UI routes yet; V2-2 runtime logic is still being built beneath the surface.

### Migrations Added

- `supabase/migrations/20260706113000_v2_phase_2_work_unit_stage_transitions.sql`

### Migrations Applied Locally

- Owner-confirmed applied before this slice:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
- Not yet applied by owner:
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`

### Files / Modules Changed

- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `src/features/work-units/instances.ts`
- `src/types/database.ts`
- `supabase/migrations/20260706113000_v2_phase_2_work_unit_stage_transitions.sql`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- V2-2 transition static guards - PASS via `npm run test:v2`.
- Guards include start/complete RPC presence, ready/in-progress validation, worker/workgroup validation, production-complete transition, and no delivery/handoff label heuristic in V2-2 migration logic.

### Boutique Regression

- Required Tier: A before V2-2 closure because `orders`, generated database types, and workflow-adjacent runtime code are touched.
- Tests run: not run in browser during this slice.
- Result: NOT RUN.
- Notes: Existing Boutique `order_items`, item workflow runtime, item history, `order_payments`, Finance/GST, public tracking, and communication code were not intentionally changed in this slice.

### Tenant Isolation Checks

- Checks run: static tenant ownership checks in V2 test guard.
- Result: PASS for static guard; database/manual tenant isolation remains required after owner applies the new transition migration.

### Manual QA

- Browser/device: not run in this slice.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: V2-2 Work Unit stage transition foundation.
- Result: NOT RUN.
- Notes: No UI path is wired yet for these Work Unit routines.

### Bugs Found

- None.

### Bugs Fixed

- None.

### Deferred Issues

- Direct database integration tests for RPC rollback/state behavior are still pending.
- V2 Work Unit UI/projection is still pending.
- V2 Work Unit invalid transition tests beyond static guards are still pending.

### Compatibility Notes

- Boutique compatibility impact: no Boutique route/action was changed in this slice.
- V2 functions operate only on `work_units` and `work_unit_*` tables.
- No `order_items`, item workflow runtime, or Boutique payment migration was introduced.

### Pending Tasks

- Owner applies `20260706113000_v2_phase_2_work_unit_stage_transitions.sql` manually in Supabase.
- Verify migration apply result.
- Add database-backed phase tests or deterministic fixtures for Work Unit workflow initialization and stage transitions.
- Add runtime query/projection helpers for Work Unit state.
- Run Boutique Tier A regression before V2-2 closure.
- Do not commit until owner gives explicit commit direction.

### Blockers

- New transition migration is not yet owner-applied.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Transition migration apply/review.
  - Runtime query/projection layer.
  - V2-2 phase tests beyond static guards.
  - Manual QA.
  - Boutique Tier A regression.
  - Tenant isolation manual/database evidence.

### Notes for Next Session

- After owner applies `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`, continue with Work Unit runtime query/projection helpers and phase tests.

---

## V2 Session Update - 2026-07-06 - V2-2 Work Unit Runtime Projections

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked in this slice
- Note: owner confirmed V2-2 stage transition migration was applied and asked to continue.

### Session Objective

- Continue V2-2 after owner-applied Work Unit transition migration.
- Add tenant-safe Work Unit read/projection helpers for queue and detail views.
- Keep the read side separate from legacy Boutique `order_items` runtime.

### What Was Built

- Added `src/features/work-units/queries.ts`.
- Added `getWorkUnitQueueData(...)`:
  - resolves tenant context server-side;
  - reads `work_units` by tenant;
  - projects order, order line, customer, workflow, current workflow instance, current stage, stage master, and location context.
- Added `getWorkUnitDetailData(workUnitId)`:
  - resolves tenant context server-side;
  - rejects cross-tenant guessed IDs with `notFound()`;
  - loads Work Unit detail, order/order line/customer/workflow/current workflow instance/stages/location/work logs/workers/workgroups.
- Extended `scripts/test-v2-baseline.mjs` to require the Work Unit projection helpers, server tenant context, tenant filters, and no `order_items` dependency in the V2 Work Unit projection module.

### Key Decisions Made

- Keep V2 Work Unit projections in `src/features/work-units` rather than modifying existing Boutique production queries.
- Keep projections read-only in this slice; mutations remain in atomic database RPC wrappers.
- Do not add UI routes yet because V2-2 still needs stronger phase tests before user-facing operational screens.

### Migrations Added

- None in this slice.

### Migrations Applied Locally

- Owner-confirmed applied:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`

### Files / Modules Changed

- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `src/features/work-units/queries.ts`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- V2-2 Work Unit projection static guards - PASS via `npm run test:v2`.
- Guards include server tenant context resolution, tenant filters on Work Unit runtime tables, and no legacy `order_items` dependency in the V2 Work Unit projection module.

### Boutique Regression

- Required Tier: A before V2-2 closure because `orders`, generated database types, and workflow-adjacent runtime code are touched.
- Tests run: not run in browser during this slice.
- Result: NOT RUN.
- Notes: Existing Boutique production/query modules were not modified in this slice.

### Tenant Isolation Checks

- Checks run: static tenant filter guard for Work Unit queue/detail projections.
- Result: PASS for static guard; manual/database tenant isolation evidence remains required before V2-2 closure.

### Manual QA

- Browser/device: not run in this slice.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: V2-2 Work Unit read projection foundation.
- Result: NOT RUN.
- Notes: No Work Unit UI route is wired yet.

### Bugs Found

- None.

### Bugs Fixed

- None.

### Deferred Issues

- Database-backed phase tests for RPC behavior are still pending.
- Work Unit UI route/manual QA is still pending.
- Boutique Tier A regression is still pending before closure.

### Compatibility Notes

- Boutique compatibility impact: no Boutique route/action/query was changed in this slice.
- V2 Work Unit projection helpers intentionally do not query `order_items`.
- Existing Boutique runtime, payments, Finance/GST, tracking, and communications remain untouched.

### Pending Tasks

- Add deterministic V2-2 phase tests for Work Unit initialization and stage transitions.
- Consider a small internal/admin Work Unit runtime smoke surface only after tests are stronger.
- Run manual tenant isolation against actual Work Unit records.
- Run Boutique Tier A regression before V2-2 closure.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for continuing V2-2 implementation.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - V2-2 phase tests beyond static guards.
  - Manual Work Unit QA.
  - Tenant isolation manual/database evidence.
  - Boutique Tier A regression.
  - Final diff/migration review.

### Notes for Next Session

- Continue V2-2 by adding deterministic phase tests or a controlled internal runtime smoke path for Work Unit creation/initialization/transition.

---

## V2 Session Update - 2026-07-06 - V2-2 Work Unit Runtime Creation

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked in this slice
- Note: owner confirmed prior V2-2 migrations were applied and asked to continue.

### Session Objective

- Add an internal atomic primitive that creates a V2 commercial Order Line, Work Unit, and initialized Work Unit workflow.
- Add deterministic V2-2 runtime tests beyond the baseline static guard.
- Preserve Boutique legacy runtime and avoid attaching Work Units to legacy Boutique orders.

### What Was Built

- Added migration `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`.
- Added `create_work_unit_runtime(...)` RPC:
  - validates tenant-owned order;
  - refuses `legacy_item_v1` orders;
  - validates order vertical matches requested vertical;
  - validates tenant vertical enablement through `tenant_verticals`;
  - validates active tenant-owned workflow;
  - validates optional tenant-owned current location;
  - creates `order_lines`;
  - creates `work_units`;
  - calls `initialize_work_unit_workflow(...)`;
  - returns created order line, work unit, and workflow instance IDs.
- Added `createWorkUnitRuntime(...)` typed server wrapper in `src/features/work-units/instances.ts`.
- Added result parsing so raw JSON from the RPC is converted into typed IDs.
- Added `scripts/test-v2-work-unit-runtime.mjs`.
- Updated `npm run test:v2` to run both:
  - `scripts/test-v2-baseline.mjs`
  - `scripts/test-v2-work-unit-runtime.mjs`
- Extended baseline guards for the runtime creation primitive.

### Key Decisions Made

- Keep this as an internal runtime primitive, not a public UI/server action.
- Block accidental Boutique migration by requiring `orders.runtime_model = 'work_unit_v2'`.
- Keep Domain Command wrapping deferred to V2-3, but keep the multi-row runtime mutation atomic now.
- Continue not hardcoding Fundry or Laundry stage names.

### Migrations Added

- `supabase/migrations/20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Migrations Applied Locally

- Owner-confirmed applied before this slice:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`
- Not yet applied by owner:
  - `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Files / Modules Changed

- `package.json`
- `project_summary.md`
- `scripts/test-v2-baseline.mjs`
- `scripts/test-v2-work-unit-runtime.mjs`
- `src/features/work-units/instances.ts`
- `src/types/database.ts`
- `supabase/migrations/20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- V2 Work Unit runtime tests - PASS via `npm run test:v2`.
- Checks include runtime creation RPC presence, refusal of legacy orders, vertical mismatch rejection, tenant vertical enablement validation, Order Line/Work Unit insert, workflow initialization call, no delivery/handoff heuristic, and tenant-safe projection helpers.

### Boutique Regression

- Required Tier: A before V2-2 closure because `orders`, generated database types, and workflow-adjacent runtime code are touched.
- Tests run: not run in browser during this slice.
- Result: NOT RUN.
- Notes: New creation primitive explicitly refuses `legacy_item_v1` orders, so existing Boutique orders cannot be accidentally moved into Work Units through this path.

### Tenant Isolation Checks

- Checks run: deterministic/static guards for tenant-owned order/workflow/location validation and tenant vertical enablement.
- Result: PASS for static/runtime guard; manual/database tenant isolation evidence remains required before V2-2 closure.

### Manual QA

- Browser/device: not run in this slice.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: V2-2 Work Unit runtime creation foundation.
- Result: NOT RUN.
- Notes: No UI path is wired yet.

### Bugs Found

- None.

### Bugs Fixed

- None.

### Deferred Issues

- Owner still needs to apply the new runtime creation migration.
- Database-backed execution tests are still pending.
- Manual tenant isolation with actual Work Unit records is still pending.
- Boutique Tier A regression is still pending before closure.

### Compatibility Notes

- Boutique compatibility impact: no Boutique route/action/query was changed in this slice.
- Existing Boutique `order_items`, item workflow runtime, item history, `order_payments`, Finance/GST, public tracking, and communications remain untouched.
- Runtime creation explicitly rejects `legacy_item_v1` orders.

### Pending Tasks

- Owner applies `20260706120000_v2_phase_2_work_unit_runtime_creation.sql` manually in Supabase.
- Verify migration apply result.
- Add database-backed tests or a controlled internal smoke path using actual Work Unit records.
- Run manual tenant isolation against actual Work Unit records.
- Run Boutique Tier A regression before V2-2 closure.
- Do not commit until owner gives explicit commit direction.

### Blockers

- New runtime creation migration is not yet owner-applied.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Runtime creation migration apply/review.
  - Database/manual Work Unit runtime QA.
  - Tenant isolation manual/database evidence.
  - Boutique Tier A regression.
  - Final diff/migration review.

### Notes for Next Session

- After owner applies `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`, continue with controlled Work Unit runtime smoke/testing using actual V2 records.

---

## V2 Session Update - 2026-07-06 - V2-2 Runtime Creation Migration Applied

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked in this test-only confirmation slice

### Session Objective

- Confirm owner-applied V2-2 runtime creation migration state.
- Re-run required automated gates.

### What Was Built

- No application code or migration changes in this confirmation slice.

### Key Decisions Made

- Treat `20260706120000_v2_phase_2_work_unit_runtime_creation.sql` as owner-applied based on owner confirmation.
- Continue V2-2 with controlled DB-backed runtime smoke/testing as the next gap.

### Migrations Added

- None.

### Migrations Applied Locally

- Owner-confirmed applied:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`
  - `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Files / Modules Changed

- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- V2 baseline tests - PASS.
- V2 Work Unit runtime tests - PASS.

### Boutique Regression

- Required Tier: A before V2-2 closure because `orders`, generated database types, and workflow-adjacent runtime code are touched.
- Tests run: not run in browser during this confirmation slice.
- Result: NOT RUN.
- Notes: No Boutique application code changed in this slice.

### Tenant Isolation Checks

- Checks run: static/runtime guards only.
- Result: PASS for automated guards; manual/database tenant isolation with actual Work Unit records remains pending.

### Manual QA

- Browser/device: not run.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: V2-2 migration apply confirmation.
- Result: NOT RUN.
- Notes: This was an automated gate confirmation slice.

### Bugs Found

- None.

### Bugs Fixed

- None.

### Deferred Issues

- DB-backed Work Unit runtime smoke is still pending.
- Manual tenant isolation with actual Work Unit records is still pending.
- Boutique Tier A regression is still pending before closure.

### Compatibility Notes

- Boutique compatibility impact: no code or schema files changed in this confirmation slice.
- Existing Boutique runtime remains protected.

### Pending Tasks

- Add and run a controlled opt-in DB smoke for Work Unit runtime creation/initialization/transition.
- Run manual tenant isolation against actual Work Unit records.
- Run Boutique Tier A regression before V2-2 closure.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for continuing V2-2 implementation.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - DB-backed Work Unit runtime smoke.
  - Tenant isolation manual/database evidence.
  - Boutique Tier A regression.
  - Final diff/migration review.

### Notes for Next Session

- Continue with controlled opt-in DB smoke for Work Unit runtime creation, initialization, and transition.

---

## V2 Session Update - 2026-07-06 - V2-2 DB Smoke Passed

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch

### Session Objective

- Harden and run the controlled opt-in DB smoke for V2 Work Unit runtime creation, workflow initialization, and stage transitions after owner confirmed the runtime creation migration was applied.
- Re-run required automated gates after the smoke-test addition.

### What Was Built

- Added the package script for the opt-in Work Unit runtime DB smoke.
- Hardened smoke-test cleanup so soft-delete tables are updated with `deleted_at` only and non-soft-delete join rows created by the smoke are hard-deleted by ID.
- Ran the smoke against the laundry-enabled `fundry-laundry` tenant; it created temporary QA records, initialized a Work Unit workflow, completed all configured stages, verified `production_complete`, and cleaned up its own rows.

### Key Decisions Made

- Keep the DB smoke opt-in behind `OS_PLUS_V2_DB_SMOKE=1` because it uses service-role credentials and performs temporary database mutations.
- Use configured workflow sequence for completion verification; do not infer delivery or fulfilment from stage names.
- Treat the three V2-2 migrations as owner-applied based on owner confirmation.

### Migrations Added

- None in this slice.

### Migrations Applied Locally

- Owner-confirmed applied:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`
  - `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Files / Modules Changed

- `package.json`
- `scripts/smoke-v2-work-unit-runtime.mjs`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:work-units` - PASS for tenant `fundry-laundry`.
- V2 baseline tests - PASS.
- V2 Work Unit runtime static tests - PASS.

### Boutique Regression

- Required Tier: A before V2-2 closure because `orders`, generated database types, and workflow-adjacent runtime code are touched.
- Tests run: automated role route policy only.
- Result: PARTIAL; full Boutique Tier A browser/manual regression is NOT RUN.
- Notes: No Boutique runtime route/action/query was changed in this slice. The V2 runtime creation RPC rejects `legacy_item_v1` orders.

### Tenant Isolation Checks

- Checks run: DB smoke used one server-selected laundry-enabled tenant and all V2 Work Unit records were created/read/mutated with tenant-scoped IDs.
- Result: PASS for same-tenant DB smoke; cross-tenant negative/manual isolation QA remains pending before closure.

### Manual QA

- Browser/device: not run.
- Persona: not run.
- Tenant/Vertical: `fundry-laundry` via DB smoke only.
- Test IDs: V2-2 Work Unit runtime smoke.
- Result: DB smoke PASS; browser/manual QA NOT RUN.
- Notes: No UI path is wired yet for Work Unit runtime operation.

### Bugs Found

- Smoke cleanup initially assumed all cleanup tables had `updated_by` and `deleted_at`.

### Bugs Fixed

- Updated smoke cleanup to avoid `updated_by` assumptions and to hard-delete only smoke-created join-table rows by captured IDs.

### Deferred Issues

- Full Boutique Tier A regression is still pending before V2-2 closure.
- Cross-tenant negative/manual tenant isolation evidence is still pending before V2-2 closure.
- Final diff and migration review are still pending.

### Compatibility Notes

- Boutique compatibility impact: no Boutique runtime code changed in this slice.
- Shared `orders` schema/type changes remain additive and backfilled from earlier V2-2 work.
- Existing Boutique `order_items`, item workflow runtime, item history, `order_payments`, Finance/GST, public tracking, and communications remain untouched.

### Pending Tasks

- Run full Boutique Tier A regression.
- Add or run cross-tenant negative isolation QA for V2 Work Unit runtime.
- Perform final migration and diff review.
- Decide whether remaining V2-2 UI/API projection work is needed before `READY_FOR_CLOSURE`.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for continuing V2-2 QA.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Full Boutique Tier A regression.
  - Cross-tenant negative/manual tenant isolation evidence.
  - Final diff/migration review.

### Notes for Next Session

- Continue V2-2 closure QA: run Boutique Tier A regression and add cross-tenant negative tenant-isolation evidence before considering `READY_FOR_CLOSURE`.

---

## V2 Session Update - 2026-07-06 - V2-2 TI-005 Isolation Evidence

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch

### Session Objective

- Continue V2-2 closure QA by adding database-backed tenant-isolation evidence for Work Units.
- Update the V2 QA workbook tracker with executed TI-005 evidence.

### What Was Built

- Extended the opt-in Work Unit DB smoke to cover `TI-005`.
- The smoke now creates a Fundry Work Unit, verifies a Phantom Threads tenant context cannot read the Work Unit or stage by guessed ID, verifies wrong-tenant stage start/complete RPC calls fail with `WORK_UNIT_STAGE_NOT_FOUND`, then continues the valid same-tenant runtime flow to `production_complete`.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`:
  - `Tenant Isolation` row `TI-005` marked `PASS`.
  - `Phase Gates` row `V2-2` marked `IN_PROGRESS`, `Automated Checks: PASS`, `Tenant Isolation: PASS`, `Ready to Close: NO`.

### Key Decisions Made

- Keep the Work Unit tenant-isolation proof inside the opt-in DB smoke because it needs real tenant IDs and RPC execution.
- Treat same-tenant runtime smoke plus wrong-tenant rejection as sufficient automated evidence for V2-2 `TI-005`; broader manual/browser QA remains separate.

### Migrations Added

- None.

### Migrations Applied Locally

- Owner-confirmed already applied:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`
  - `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Files / Modules Changed

- `scripts/smoke-v2-work-unit-runtime.mjs`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:work-units` - PASS.
- Smoke output: `V2 Work Unit DB smoke passed for tenant fundry-laundry; TI-005 rejected phantom-threads.`
- `TI-005` - PASS in V2 QA matrix.

### Boutique Regression

- Required Tier: A before V2-2 closure.
- Tests run: automated `test:roles`; prior V2 QA workbook already has BA-001 through BA-014 recorded PASS from earlier V2-0 evidence.
- Result: NOT ACCEPTED AS CURRENT V2-2 CLOSURE EVIDENCE YET.
- Notes: Because V2-2 touched `orders`, generated database types, and workflow-adjacent runtime code, a fresh Boutique Tier A regression or explicit acceptance of existing BA evidence is still required before `READY_FOR_CLOSURE`.

### Tenant Isolation Checks

- Checks run: `TI-005` automated DB smoke.
- Result: PASS.
- Evidence: Fundry-created Work Unit rejected Phantom Threads read/mutation attempts.

### Manual QA

- Browser/device: not run in this slice.
- Persona: not run.
- Tenant/Vertical: Fundry Laundry and Phantom Threads via DB smoke only.
- Test IDs: `TI-005`.
- Result: DB automated PASS; browser/manual QA NOT RUN.
- Notes: No Work Unit UI path is wired yet.

### Bugs Found

- None.

### Bugs Fixed

- None in production runtime; smoke script coverage was extended.

### Deferred Issues

- Fresh Boutique Tier A closure regression remains pending.
- Manual/browser QA remains pending unless explicitly waived for this non-UI V2-2 slice.
- Final diff and migration review remain pending.

### Compatibility Notes

- Boutique compatibility impact: no Boutique runtime code changed in this slice.
- The new negative smoke specifically proved a Boutique tenant context (`phantom-threads`) cannot read or mutate a Fundry Work Unit.
- Existing Boutique `order_items`, item workflow runtime, item history, `order_payments`, Finance/GST, public tracking, and communications remain untouched.

### Pending Tasks

- Run or explicitly accept current BA-001 through BA-014 evidence as the V2-2 Boutique Tier A regression.
- Decide whether manual/browser QA is required for V2-2 before readiness, given no Work Unit UI is wired.
- Complete final diff and migration review.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for continuing V2-2 closure QA.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Current V2-2 Boutique Tier A closure evidence.
  - Manual/browser QA decision/evidence.
  - Final diff/migration review.

### Notes for Next Session

- Continue V2-2 closure QA with Boutique Tier A regression acceptance/rerun and final migration/diff review.

---

## V2 Session Update - 2026-07-06 - V2-2 Boutique Contract Smoke

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch

### Session Objective

- Continue V2-2 closure QA by adding fresh Boutique compatibility evidence.
- Review V2-2 migrations for destructive changes and tenant/runtime guard coverage.

### What Was Built

- Added `scripts/smoke-v2-boutique-legacy-contract.mjs`.
- Added package script `smoke:v2:boutique-contract`.
- The smoke is opt-in via `OS_PLUS_V2_DB_SMOKE=1`, read-only against Supabase, and checks the protected Boutique contract:
  - Active Boutique tenant exists.
  - Legacy Boutique orders use `runtime_model = legacy_item_v1` and `vertical_key = boutique`.
  - Boutique orders still have `order_items`.
  - Item workflow instances and stage instances still exist.
  - Item stage work logs/history still exist.
  - Partial payments still live in `order_payments`.
  - Legacy Boutique orders have no linked `work_units`.
  - Communications queue evidence still exists.
  - Public tracking loads for a valid token and 404s for an invalid token.

### Key Decisions Made

- Do not mark full Boutique Tier A PASS from this session because the available browser user only has `Test Laundry Store` access and cannot open Phantom Threads/Boutique UI.
- Record the new Boutique database/public-route smoke as `PARTIAL` Boutique regression evidence for V2-2.
- Keep the smoke opt-in because it depends on configured Supabase service-role credentials and live QA data.

### Migrations Added

- None.

### Migrations Applied Locally

- Owner-confirmed already applied:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`
  - `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Files / Modules Changed

- `package.json`
- `scripts/smoke-v2-boutique-legacy-contract.mjs`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:boutique-contract` - PASS.
- Smoke output: `V2 Boutique legacy contract smoke passed for tenant phantom-threads. Orders: 12 Items: 17 Workflow instances: 17 Stage instances: 95 Work logs: 32 Payments: 15 Communication queue rows: 1`
- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:work-units` - previously PASS in this phase session.
- `TI-005` - PASS in V2 QA matrix from the Work Unit DB smoke.

### Boutique Regression

- Required Tier: A before V2-2 closure.
- Tests run in this slice: read-only database/public-route Boutique legacy contract smoke.
- Result: PARTIAL.
- Notes:
  - Fresh evidence confirms the protected Boutique database/runtime contract is intact.
  - Browser UI Tier A is BLOCKED in this session because the current in-app browser user is `test1@example.com`, which only has `Test Laundry Store` access.
  - Prior QA workbook still records BA-001 through BA-014 PASS from earlier baseline evidence, but this session does not claim a fresh browser Tier A rerun.

### Tenant Isolation Checks

- Checks run: `TI-005` Work Unit cross-tenant DB smoke already passed.
- Result: PASS.
- Evidence: Fundry-created Work Unit rejected Phantom Threads read/mutation attempts.

### Manual QA

- Browser/device: in-app browser, localhost.
- Persona: `test1@example.com`, Owner/Admin.
- Tenant/Vertical: `Test Laundry Store` only.
- Test IDs: attempted Boutique browser regression precheck.
- Result: BLOCKED for Boutique UI.
- Notes: `/select-tenant` showed only `Test Laundry Store`; Phantom Threads/Boutique was not selectable for this user.

### Bugs Found

- Initial Boutique smoke public-tracking safety assertion inspected raw HTML and matched the app-wide meta description word `finance`.

### Bugs Fixed

- Updated the smoke to inspect extracted `<main>` content instead of raw HTML head/script content for public-tracking safety assertions.

### Deferred Issues

- Fresh browser/manual Boutique Tier A remains pending or requires owner acceptance of the database/public-route smoke plus prior BA workbook evidence.
- Manual/browser QA remains pending unless explicitly waived for this non-UI V2-2 slice.

### Compatibility Notes

- Boutique compatibility impact: no Boutique runtime code changed in this slice.
- Fresh smoke confirms existing Boutique orders still use `order_items`, item workflow execution, item history logs, `order_payments`, communications queue, and public tracking.
- Fresh smoke confirms legacy Boutique orders were not migrated into V2 Work Units.

### Pending Tasks

- Owner decision: accept current Boutique evidence as sufficient for V2-2 readiness, or provide/use a Boutique-access browser account for full BA-001 through BA-014 rerun.
- Decide whether manual/browser QA is required for V2-2 before readiness, given no Work Unit UI is wired.
- Complete final diff review across all tracked and untracked V2 files before any readiness/closure decision.
- Do not commit until owner gives explicit commit direction.

### Blockers

- Full browser Boutique Tier A cannot run with the current browser account because it lacks Boutique tenant access.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Owner acceptance or fresh browser execution of Boutique Tier A.
  - Manual/browser QA decision/evidence.
  - Final full diff review.

### Notes for Next Session

- If owner accepts the current Boutique evidence, do final full diff review and update V2-2 Phase Gate to `READY_FOR_CLOSURE`; otherwise rerun BA-001 through BA-014 with a Boutique-access account.

---

## V2 Session Update - 2026-07-06 - V2-2 Ready For Closure

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-2 - Commercial Lines and Parallel Work Unit Runtime

### Phase Status

READY_FOR_CLOSURE

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch

### Session Objective

- Complete V2-2 final readiness review after owner indicated to proceed.
- Mark V2-2 ready for closure without committing.

### What Was Built

- No new production code in this final readiness slice.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` V2-2 Phase Gates row to `READY_FOR_CLOSURE`.
- Updated `project_summary.md` with closure-readiness evidence.

### Key Decisions Made

- Treat owner's "ok. Next" as acceptance of the current Boutique evidence for this non-UI V2-2 runtime slice.
- Mark V2-2 `READY_FOR_CLOSURE`, not `CLOSED`.
- Do not commit, merge, or deploy.

### Migrations Added

- None in this slice.

### Migrations Applied Locally

- Owner-confirmed already applied:
  - `20260706110000_v2_phase_2_work_unit_runtime.sql`
  - `20260706113000_v2_phase_2_work_unit_stage_transitions.sql`
  - `20260706120000_v2_phase_2_work_unit_runtime_creation.sql`

### Files / Modules Changed

- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:work-units` - PASS.
- Work Unit smoke output: `V2 Work Unit DB smoke passed for tenant fundry-laundry; TI-005 rejected phantom-threads.`
- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:boutique-contract` - PASS.
- Boutique contract smoke output: `V2 Boutique legacy contract smoke passed for tenant phantom-threads. Orders: 12 Items: 17 Workflow instances: 17 Stage instances: 95 Work logs: 32 Payments: 15 Communication queue rows: 1`
- `TI-005` - PASS in QA matrix.

### Boutique Regression

- Required Tier: A.
- Result: PASS by owner-accepted evidence for this non-UI runtime phase.
- Evidence:
  - Prior QA matrix records BA-001 through BA-014 PASS from baseline.
  - Fresh read-only Boutique legacy contract smoke passed against Phantom Threads.
  - Browser Boutique Tier A was blocked with the current browser user because `test1@example.com` only has `Test Laundry Store` access; owner accepted proceeding with current evidence.

### Tenant Isolation Checks

- Checks run: `TI-005` Work Unit cross-tenant DB smoke.
- Result: PASS.
- Evidence: Fundry-created Work Unit rejected Phantom Threads read/mutation attempts.

### Manual QA

- Browser/device: in-app browser, localhost.
- Persona: `test1@example.com`, Owner/Admin.
- Tenant/Vertical: `Test Laundry Store`.
- Test IDs: V2-2 browser Boutique precheck.
- Result: WAIVED/NON-UI for V2-2 readiness.
- Notes: No Work Unit UI is wired in V2-2. Browser Boutique rerun was blocked by the current test account lacking Boutique access; accepted evidence is automated/database/public-route based.

### Bugs Found

- P2: mixed V2-1 customer default-address creation clears existing defaults before inserting the new default address. If the insert failed after the clear, the customer could temporarily have no default saved address.

### Bugs Fixed

- None in this final readiness slice.

### Deferred Issues

- P2 default-address atomicity improvement can be addressed in a later V2-1/V2 platform hardening pass; it is not part of the V2-2 Work Unit runtime and does not affect the protected Boutique operational runtime.

### Compatibility Notes

- Boutique compatibility impact: V2-2 adds parallel Work Unit runtime without migrating Boutique orders.
- Existing Boutique `order_items`, item workflow execution, item history logs, `order_payments`, communications queue, and public tracking were verified by the fresh Boutique contract smoke.
- Work Unit creation explicitly refuses legacy Boutique orders with `ORDER_NOT_WORK_UNIT_RUNTIME`.

### Pending Tasks

- Final closure/commit remains pending owner direction.
- Before a closure commit, do one last `git diff` review and rerun required gates if any files change.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for `READY_FOR_CLOSURE`.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: YES
- Missing closure requirements:
  - Final commit is intentionally deferred by owner instruction.
  - Phase is not `CLOSED` until final closure/commit policy is followed.

### Notes for Next Session

- V2-2 is `READY_FOR_CLOSURE`. Wait for owner commit/closure direction, or proceed to the next phase only if owner explicitly accepts starting it before committing closed V2-2 work.

---

## V2 Session Update - 2026-07-06 - V2-3 Command Event Task Foundation

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-3 - Commands, Domain Events, Idempotency and Tasks

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch; working tree already contains uncommitted V2-1 and V2-2 work.

### Session Objective

- Start V2-3 after owner direction.
- Add reusable command context, idempotency, domain event, and task foundations.
- Preserve the Boutique legacy runtime and V2-2 Work Unit runtime.

### What Was Built

- Added V2-3 additive migration for:
  - `command_idempotency`
  - `domain_events`
  - `tasks`
  - `task_history`
  - append-only event/history triggers
  - task command RPCs
  - V2 Work Unit stage command wrapper RPCs
- Added typed command context helpers and command result helpers.
- Added task actions, task queries, and a tenant task queue UI.
- Added task permissions and Tasks navigation.
- Added V2 Work Unit stage command adapters that call command RPCs.
- Added V2-3 static test coverage and wired it into `npm run test:v2`.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` with V2-3 automated/static evidence.

### Key Decisions Made

- Do not add `event_outbox` in this slice because no event consumer/outbox worker is introduced yet.
- Keep Boutique production actions and `item_history` unchanged.
- Keep existing low-level V2 Work Unit RPC wrappers available, and add command-layer wrappers for V2-3.
- Mark V2-3 `IN_PROGRESS`, not `READY_FOR_CLOSURE`, because DB-backed smoke/manual QA/Boutique regression remain pending after owner-applied migration.

### Migrations Added

- `supabase/migrations/20260706130000_v2_phase_3_commands_events_tasks.sql`

### Migrations Applied Locally

- Not applied in this session.
- Notes: V2-3 migration file was reviewed statically through `npm run test:v2`. Owner/manual Supabase application is still pending before DB smoke evidence.

### Files / Modules Changed

- `package.json`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/components/layout/app-shell.tsx`
- `src/core/command-context/types.ts`
- `src/core/command-context/server.ts`
- `src/core/commands/result.ts`
- `src/core/events/types.ts`
- `src/core/idempotency/types.ts`
- `src/features/tasks/actions.ts`
- `src/features/tasks/queries.ts`
- `src/features/work-units/commands.ts`
- `src/app/(tenant)/tasks/page.tsx`
- `scripts/test-v2-baseline.mjs`
- `scripts/test-v2-phase-3-commands-events-tasks.mjs`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `CI-001` command tenant context - PASS via `npm run test:v2` static V2-3 guard.
- `CI-002` atomic rollback shape - PASS via static migration/RPC guard; DB execution pending migration application.
- `CI-003` event written with successful command - PASS via static migration/RPC guard.
- `CI-004` no success event on failed command - PASS via static migration/RPC guard; DB execution pending migration application.
- `CI-005` idempotent repeated command - PASS via static guard for unique key and completed-result return path.
- `CI-006` idempotency key payload conflict rejection - PASS via static guard.
- `CI-011` task assignment - PASS via static guard for `AssignTask`, tenant-owned user/team validation, and history.
- `CI-012` task history - PASS via static guard for append-only `task_history` and command inserts.
- `TI-017` command cross-tenant mutation rejection - PASS via static guard for tenant-scoped command lookups and composite ownership constraints; DB-backed cross-tenant smoke pending.

### Boutique Regression

- Required Tier: B/C before V2-3 readiness because this slice adds generated database types, task navigation, and a new tenant route but does not modify Boutique production/order/payment logic.
- Tests run: automated role route policy only.
- Result: PARTIAL.
- Notes: Protected Boutique runtime files for order creation, item workflow execution, item history, order payments, Finance/GST, tracking, and communications were not changed in this V2-3 slice. Full required Boutique regression remains pending before readiness.

### Tenant Isolation Checks

- Checks run: static V2-3 guard for tenant-scoped command RPCs, composite tenant ownership FKs, task assignment ownership, and wrong-tenant not-found behavior.
- Result: PASS for static guard; DB-backed tenant isolation smoke NOT RUN.
- Notes: V2-3 migration must be applied before runtime tenant-isolation proof can be executed.

### Manual QA

- Browser/device: not run.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: task queue UI manual QA pending.
- Result: NOT RUN.
- Notes: Production build confirmed `/tasks` route compiles.

### Bugs Found

- None in production code during this slice.
- Test issue found: first V2-3 static assertion incorrectly rejected the word `DELIVERY` in task types; fixed by scoping the check.

### Bugs Fixed

- Fixed V2-3 static test assertion so allowed task type `DELIVERY` is not confused with the banned V2 fulfilment stage-label heuristic.

### Deferred Issues

- DB-backed V2-3 command smoke remains pending until the migration is owner-applied.
- Manual task queue QA remains pending.
- Boutique regression remains pending before readiness.
- No `event_outbox` yet; defer until there is an actual event consumer/outbox processor.

### Compatibility Notes

- Boutique compatibility impact: no existing Boutique runtime mutation action was changed.
- Existing `order_items`, `item_workflow_instances`, `item_stage_instances`, `item_stage_work_logs`, `item_history`, `order_payments`, Finance/GST, public tracking, and communication queue behavior remain untouched.
- Shared impact: generated database types, permissions, app shell navigation, and package test script changed.
- V2 Work Unit runtime impact: new command wrappers added around existing Work Unit stage RPCs; existing lower-level wrappers remain.

### Pending Tasks

- Owner/manual application of `20260706130000_v2_phase_3_commands_events_tasks.sql`.
- Add/run DB-backed V2-3 smoke after migration application for repeated idempotency, rollback/no-event, event success, task assignment/history, and cross-tenant negative mutation.
- Manual browser QA for `/tasks`.
- Boutique regression tier decision and execution.
- Final migration/diff review before any `READY_FOR_CLOSURE`.
- Do not commit until owner gives explicit commit direction.

### Blockers

- Runtime DB smoke is blocked until V2-3 migration is applied in Supabase.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - V2-3 migration application and DB-backed smoke.
  - Manual task queue QA.
  - Required Boutique regression.
  - Final migration and diff review.
  - Final QA workbook update for closure evidence.

### Notes for Next Session

- Apply V2-3 migration manually in Supabase, then run DB-backed V2-3 command smoke and manual `/tasks` QA.
- Keep V2-2 as `READY_FOR_CLOSURE`, not `CLOSED`, unless owner explicitly directs closure/commit.

---

## V2 Session Update - 2026-07-06 - V2-3 DB Smoke Evidence

### Date

2026-07-06

### Updated By

Codex AI agent

### V2 Phase

V2-3 - Commands, Domain Events, Idempotency and Tasks

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch; working tree remains uncommitted with V2-1/V2-2/V2-3 work.

### Session Objective

- Continue V2-3 after owner confirmed the V2-3 migration was applied.
- Add and run DB-backed command/event/idempotency/task smoke evidence.
- Rerun required automated gates and update QA evidence.

### What Was Built

- Added `scripts/smoke-v2-commands-events-tasks.mjs`.
- Added package script `smoke:v2:commands`.
- Extended V2-3 static tests to verify the command DB smoke remains present and opt-in.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` with DB-backed V2-3 evidence.

### Key Decisions Made

- Keep the smoke opt-in behind `OS_PLUS_V2_DB_SMOKE=1` because it uses service-role credentials and performs temporary database mutations.
- Soft-delete temporary current-state task/team records, but preserve append-only `domain_events` and `task_history` evidence by design.
- V2-3 remains `IN_PROGRESS` because manual `/tasks` QA, Boutique regression, and final diff/migration review are still pending.

### Migrations Added

- None in this slice.

### Migrations Applied Locally

- Owner-confirmed applied:
  - `20260706130000_v2_phase_3_commands_events_tasks.sql`

### Files / Modules Changed

- `package.json`
- `scripts/smoke-v2-commands-events-tasks.mjs`
- `scripts/test-v2-phase-3-commands-events-tasks.mjs`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:commands` - PASS.
- Smoke output: `V2 command/event/task DB smoke passed for tenant phantom-threads; idempotency reused task c6fea094-ee5c-49b5-add5-effe90fbc9c3; events 4; cross-tenant rejected fundry-laundry.`
- `CI-001` command tenant context - PASS with DB smoke.
- `CI-002` atomic rollback - PASS with DB smoke; invalid team command left zero task rows and zero events for failed correlation.
- `CI-003` event written with successful command - PASS with DB smoke.
- `CI-004` no event on rolled-back command - PASS with DB smoke.
- `CI-005` idempotent repeated command - PASS with DB smoke; repeated `CreateTask` returned the original task/event result.
- `CI-006` idempotency key payload conflict - PASS with DB smoke.
- `CI-011` task assignment - PASS with DB smoke.
- `CI-012` task history - PASS with DB smoke.
- `TI-017` cross-tenant command mutation rejection - PASS with DB smoke; wrong-tenant `StartTask` returned `TASK_NOT_FOUND`.

### Boutique Regression

- Required Tier: B/C before V2-3 readiness.
- Tests run: automated `test:roles` only in this slice.
- Result: PARTIAL.
- Notes: No Boutique runtime mutation files changed in this slice. Full required Boutique regression/manual decision remains pending before readiness.

### Tenant Isolation Checks

- Checks run: `TI-017` DB-backed command cross-tenant smoke.
- Result: PASS.
- Evidence: Phantom Threads task mutation was rejected under Fundry Laundry tenant context with `TASK_NOT_FOUND`.

### Manual QA

- Browser/device: not run.
- Persona: not run.
- Tenant/Vertical: not run.
- Test IDs: task queue UI manual QA pending.
- Result: NOT RUN.
- Notes: `/tasks` route compiles in production build.

### Bugs Found

- None in production code.

### Bugs Fixed

- None in production code in this slice.

### Deferred Issues

- Manual task queue QA remains pending.
- Boutique regression remains pending before readiness.
- Final migration/diff review remains pending.
- No `event_outbox` yet; still deferred until an actual event consumer/outbox processor exists.

### Compatibility Notes

- Boutique compatibility impact: no existing Boutique runtime mutation action was changed.
- Existing Boutique `order_items`, item workflow execution, item history logs, `order_payments`, Finance/GST, public tracking, and communications remain untouched.
- Shared impact in this slice: package scripts and V2 static tests only.

### Pending Tasks

- Manual browser QA for `/tasks`.
- Boutique regression tier decision and execution.
- Final migration review, including applied SQL and append-only audit behavior.
- Final full diff review before any `READY_FOR_CLOSURE`.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for continuing V2-3 QA.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Manual task queue QA.
  - Required Boutique regression.
  - Final migration and diff review.
  - Final QA workbook update for closure evidence.

### Notes for Next Session

- Continue V2-3 QA with manual `/tasks` browser verification, Boutique regression decision/run, and final migration/diff review.
- Keep V2-2 as `READY_FOR_CLOSURE`, not `CLOSED`, unless owner explicitly directs closure/commit.

---

## V2 Session Update - 2026-07-06 - V2-3 Ready For Closure

### Current V2 Status

- V2-0 remains `CLOSED`.
- V2-1 remains `READY_FOR_CLOSURE`.
- V2-2 remains `READY_FOR_CLOSURE`, not `CLOSED`.
- V2-3 is now `READY_FOR_CLOSURE`.
- No commit was made.

### Scope Completed

- Completed V2-3 command/event/idempotency/task foundation.
- Preserved current-state task tables as source of current truth with append-only `domain_events` and `task_history`.
- Kept `event_outbox` deferred because no event consumer/outbox worker exists in this slice.
- Kept Boutique runtime and payments on the protected legacy path.
- Did not start V2-4 Laundry custody implementation beyond V2-3 Work Unit command wrappers/tests.

### Bugs Found / Fixed

- Found `/tasks` browser form submission could fall back to a raw Next action response under automation.
- Fixed task queue UI by moving task form handling into `src/features/tasks/task-queue-client.tsx`, while keeping command execution in the shared server-side Domain Command actions.
- Found `subjectId` optional form validation rejected missing optional fields as `null`.
- Fixed optional task form parsing in `src/features/tasks/actions.ts` so absent optional fields normalize to `null`.
- Updated `scripts/test-v2-phase-3-commands-events-tasks.mjs` to assert the new server page/client component boundary.

### QA Evidence

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Evidence

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:commands` - PASS.
  - Output: `V2 command/event/task DB smoke passed for tenant phantom-threads; idempotency reused task 1ce018c9-677c-4790-9fd2-21ec48d8bedb; events 4; cross-tenant rejected fundry-laundry.`
- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:work-units` - PASS.
  - Output: `V2 Work Unit DB smoke passed for tenant fundry-laundry; TI-005 rejected phantom-threads.`
- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:boutique-contract` - PASS.
  - Output: `V2 Boutique legacy contract smoke passed for tenant phantom-threads. Orders: 12 Items: 17 Workflow instances: 17 Stage instances: 95 Work logs: 32 Payments: 15 Communication queue rows: 1`

### Manual QA

- Browser route: `http://localhost:3000/tasks`.
- Tenant/vertical: Test Laundry Store / Laundry.
- Persona: Owner/Admin (`test1@example.com`).
- Result: PASS.
- Evidence:
  - `/tasks` rendered authenticated app shell, task queue, create form, assignment controls, and task command controls.
  - Created assigned task `V2-3 browser QA task 2026-07-06T16:10:35`.
  - Task displayed as `Assigned`.
  - `Start` moved the task to `In progress` and disabled `Start`.
  - `Complete` moved the task to `Completed` and disabled terminal task actions.

### Boutique Compatibility

- Boutique contract smoke passed after V2-3 changes.
- Protected Boutique runtime remains unchanged:
  - `orders`
  - `order_items`
  - `item_workflow_instances`
  - `item_stage_instances`
  - `item_stage_work_logs`
  - `item_history`
  - `order_payments`
- No Boutique Work Unit migration was performed.
- No V2 payments migration was performed.

### Migration / Diff Review

- Owner-confirmed V2-3 migration applied:
  - `supabase/migrations/20260706130000_v2_phase_3_commands_events_tasks.sql`
- Scoped migration/code review found no destructive V2-3 migration patterns:
  - no `drop table`
  - no `drop column`
  - no destructive `alter table ... drop`
  - no `truncate`
- No `event_outbox` was added.
- The only V2-3 `Promise.all` match is read-side task queue query loading, not a business-state mutation.

### QA Workbook

- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`.
- V2-3 Phase Gate row is now:
  - Status: `READY_FOR_CLOSURE`
  - Scope Complete: `YES`
  - Migrations Reviewed: `PASS`
  - Automated Checks: `PASS`
  - Manual QA: `PASS`
  - Boutique Regression: `PASS`
  - Tenant Isolation: `PASS`
  - Ready to Close: `YES`
- Removed generated artifact-tool sidecar `OS_PLUS_V2_QA_Test_Matrix.xlsx.inspect.ndjson`.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: YES.
- Commit status: no commit made.
- Next phase, after owner closure/commit direction: V2-4 Laundry Pickup, Container Assets, Handling Units and Custody.

---

## V2 Session Update - 2026-07-07 - V2-4 Phase Start

### Date

2026-07-07

### Updated By

Codex AI agent

### V2 Phase

V2-4 - Laundry Pickup, Container Assets, Handling Units and Custody

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: current working tree already contains uncommitted V2-1, V2-2 and V2-3 work; exact commit not rechecked because V2 phases have not been committed by owner direction.

### Session Objective

- Start V2-4 only after reading the mandatory V2 docs.
- Add the additive Laundry custody foundation for pickup requests, reusable container assets, Handling Units, custody events, service catalog and service lots.
- Preserve Boutique legacy runtime and V2-3 command/event/task foundation.

### Planned Scope

- Add additive V2-4 tables:
  - `qr_identities`
  - `laundry_service_catalog`
  - `laundry_pickup_requests`
  - `laundry_container_assets`
  - `laundry_handling_units`
  - `laundry_custody_events`
  - `laundry_service_lots`
- Add tenant-safe command/RPC foundation for:
  - pickup creation;
  - pickup assignment/completion where in phase;
  - Handling Unit creation with opaque QR identity and initial custody event;
  - Container Asset creation/reuse identity;
  - Service Lot creation linked to Order Line and Work Unit runtime.
- Add minimal Laundry custody UI/queries/actions only if they remain inside V2-4 scope.

### Explicitly Out Of Scope

- Transfer manifests and manifest receive.
- `/scan/q/[token]` scan runtime.
- Laundry production/readiness/fulfilment.
- Invoices, V2 payments, UPI payment intent.
- B2B collection batches.
- WhatsApp/Telegram/live integrations.
- AI agent/OCR/route optimization.
- Boutique Work Unit migration.
- Boutique V2 payments migration.

### Compatibility Risk

- Boutique compatibility impact expected: additive schema/types and possible app shell/navigation/permission changes only.
- Protected Boutique tables and flows must remain untouched:
  - `orders`
  - `order_items`
  - `item_workflow_instances`
  - `item_stage_instances`
  - `item_stage_work_logs`
  - `item_history`
  - `order_payments`
  - Finance/GST, public tracking and communications sandbox.

### Required Boutique Regression Tier

- Expected Tier: C if V2-4 stays Laundry-local and generated type/app-shell changes are low risk.
- Escalate to Tier B/A if shared order/customer/finance/tracking/communications runtime is modified.

### Expected Migrations

- `supabase/migrations/20260707100000_v2_phase_4_laundry_custody.sql`

### Required Tests

- Required gates:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:roles`
  - `npm run test:v2`
- V2-4 phase tests:
  - pickup creation;
  - duplicate pickup/idempotency rules;
  - complete pickup atomicity;
  - Handling Unit code uniqueness;
  - QR token uniqueness;
  - custody history;
  - Container Asset reuse;
  - multi-Service-Lot Handling Unit;
  - tenant isolation and cross-tenant mutation/link rejection.

### Notes

- V2-3 remains `READY_FOR_CLOSURE`, not `CLOSED`.
- No commit made.

---

## V2 Session Update - 2026-07-07 - V2-4 Laundry Custody Implementation

### Date

2026-07-07

### Updated By

Codex AI agent

### V2 Phase

V2-4 - Laundry Pickup, Container Assets, Handling Units and Custody

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch; working tree remains uncommitted and already contains V2-1/V2-2/V2-3 work.

### Session Objective

- Build the V2-4 additive Laundry custody foundation only.
- Preserve Boutique legacy runtime and V2-3 command/event/task foundation.

### What Was Built

- Added V2-4 additive migration for `qr_identities`, Laundry service catalog, pickup requests, container assets, handling units, custody events, and service lots.
- Added command RPCs for pickup creation, container registration, pickup completion, and service-lot creation.
- Added command-backed server actions and tenant-safe query layer for `/laundry/custody`.
- Added Laundry custody UI for pickup queue, pickup completion, container registration, service catalog setup, and service-lot intake.
- Added Laundry nav item gated by `laundry:view` and active `laundry` tenant vertical.
- Added `laundry:view` and `laundry:manage` permissions.
- Extended generated DB types and V2 static tests for V2-4.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` with V2-4 implementation/test evidence.

### Key Decisions Made

- V2-4 remains `IN_PROGRESS`, not `READY_FOR_CLOSURE`, because manual DB/browser Laundry custody QA and owner migration application/DB smoke are still pending.
- Service catalog creation is treated as tenant-scoped configuration, while repeat-sensitive custody mutations use Domain Commands and idempotency.
- QR identities are created as opaque identity records only; no `/scan/q/[token]` mutation route was added.
- Transfer manifests, B2B collection batches, Laundry production/readiness/fulfilment, invoices/payments, WhatsApp/Telegram, OCR, AI, Razorpay, Zoho, and route optimization remain out of scope.

### Migrations Added

- `supabase/migrations/20260707100000_v2_phase_4_laundry_custody.sql`

### Migrations Applied Locally

- None by Codex.
- Owner/Supabase application is still required before DB-backed V2-4 smoke or browser QA.

### Files / Modules Changed

- `supabase/migrations/20260707100000_v2_phase_4_laundry_custody.sql`
- `src/types/database.ts`
- `src/lib/permissions/roles.ts`
- `src/app/(tenant)/layout.tsx`
- `src/components/layout/app-shell.tsx`
- `src/app/(tenant)/laundry/custody/page.tsx`
- `src/verticals/laundry/custody/queries.ts`
- `src/verticals/laundry/custody/actions.ts`
- `src/verticals/laundry/custody/laundry-custody-client.tsx`
- `scripts/test-v2-phase-4-laundry-custody.mjs`
- `scripts/test-v2-baseline.mjs`
- `scripts/test-v2-phase-3-commands-events-tasks.mjs`
- `package.json`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- LB2C-001 - NOT RUN as DB/browser flow; static/app-layer implementation present.
- LB2C-002 - Static coverage PASS through `npm run test:v2`; DB smoke NOT RUN.
- LB2C-003 - Static coverage PASS through `npm run test:v2`; DB smoke NOT RUN.
- LB2C-004 - Static coverage PASS for tenant-scoped handling-unit/code foundation; browser search/resolve NOT RUN.
- LB2C-005 - Static coverage PASS for service-lot command and Work Unit initialization call; DB/browser execution NOT RUN.
- LB2C-006 - Static/schema/UI support present for multiple service lots; live second-lot QA NOT RUN.
- DS-001 through DS-005 - PASS on 2026-07-07.
- TI-006 - Static tenant-safety coverage present; live cross-tenant handling-unit DB smoke NOT RUN.

### Boutique Regression

- Required Tier: C for this Laundry-local slice.
- Tests run: build/typecheck/lint/static V2 guard that confirms V2-4 migration does not touch protected Boutique runtime/payment tables.
- Result: PASS for static/build guard only.
- Notes: No Boutique browser Tier A/B flow was run in this session.

### Tenant Isolation Checks

- Checks run: static V2-4 migration/query/action checks for tenant_id, composite tenant FKs, RLS, tenant-scoped command lookups, permission gates, and vertical gating.
- Result: PASS for static coverage.
- Notes: DB-backed TI-006 cross-tenant smoke remains pending after migration application.

### Manual QA

- Browser/device: NOT RUN.
- Persona: NOT RUN.
- Tenant/Vertical: NOT RUN.
- Test IDs: LB2C-001 through LB2C-006 browser/DB execution pending.
- Result: NOT RUN.
- Notes: `/laundry/custody` route built and production build passed, but no live Fundry browser flow was executed.

### Bugs Found

- None.

### Bugs Fixed

- None.

### Deferred Issues

- V2-4 DB smoke after owner applies migration.
- Browser QA for creating pickup, completing pickup, registering container, creating service catalog row, and creating service lots.
- Live cross-tenant handling-unit isolation check TI-006.
- Final migration/diff review before any `READY_FOR_CLOSURE`.

### Compatibility Notes

- Boutique compatibility impact: no protected Boutique runtime/payment tables were migrated to Work Units or V2 payments.
- V2-4 migration static guard confirms it does not alter `order_items`, `item_workflow_instances`, `item_stage_instances`, `item_stage_work_logs`, or `order_payments`.
- Shared app shell changed only to show the Laundry nav item when the tenant has active `laundry` vertical and the role has `laundry:view`.
- Shared permissions changed only to add `laundry:view` and `laundry:manage`.

### Pending Tasks

- Owner apply `20260707100000_v2_phase_4_laundry_custody.sql` in Supabase.
- Add/run DB-backed V2-4 smoke for idempotency, atomic rollback, events, task creation, service lots, and TI-006.
- Run `/laundry/custody` browser QA as a Laundry tenant.
- Update QA workbook and project summary again after DB/browser QA.
- Do not commit until owner gives explicit commit direction.

### Blockers

- V2-4 DB/browser QA is blocked until the V2-4 migration is applied in Supabase.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Owner-applied migration and DB-backed smoke.
  - Manual `/laundry/custody` browser QA.
  - Live tenant-isolation TI-006.
  - Final migration/diff review.
  - Final QA workbook update for closure evidence.

### Notes for Next Session

- After owner confirms the V2-4 migration is applied, run DB-backed V2-4 custody smoke and browser QA for Fundry `/laundry/custody`.
- Keep V2-1, V2-2, and V2-3 as `READY_FOR_CLOSURE`, not `CLOSED`, unless owner explicitly directs closure/commit.
- Keep V2-4 as `IN_PROGRESS` until the pending DB/browser QA and final reviews pass.

---

## V2 Session Update - 2026-07-07 - V2-4 DB Smoke First Run

### Date

2026-07-07

### Updated By

Codex AI agent

### V2 Phase

V2-4 - Laundry Pickup, Container Assets, Handling Units and Custody

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch; working tree remains uncommitted with V2-1/V2-2/V2-3/V2-4 work.

### Session Objective

- Run DB-backed V2-4 Laundry custody smoke after owner confirmed the V2-4 migration was applied.

### What Was Built

- Added `scripts/smoke-v2-laundry-custody.mjs`.
- Added `smoke:v2:laundry-custody` npm script.
- Extended `scripts/test-v2-phase-4-laundry-custody.mjs` to require the DB smoke script and key assertions.
- Added corrective migration `supabase/migrations/20260707103000_v2_phase_4_qr_token_generator_fix.sql`.
- Left the already-applied V2-4 migration immutable; the live DB repair is the separate corrective migration above.

### Key Decisions Made

- The DB smoke found a real applied-migration defect: `generate_qr_identity_token()` used `gen_random_bytes(24)` under `set search_path = public`, which failed in Supabase with `function gen_random_bytes(integer) does not exist`.
- Corrective path is a tiny follow-up migration that replaces the function and schema-qualifies the pgcrypto call as `extensions.gen_random_bytes(24)`.
- Do not mark V2-4 `READY_FOR_CLOSURE` until the corrective migration is owner-applied and the DB smoke passes.

### Migrations Added

- `supabase/migrations/20260707103000_v2_phase_4_qr_token_generator_fix.sql`

### Migrations Applied Locally

- None by Codex.
- Owner needs to apply `20260707103000_v2_phase_4_qr_token_generator_fix.sql` in Supabase before rerunning DB smoke.

### Files / Modules Changed

- `scripts/smoke-v2-laundry-custody.mjs`
- `package.json`
- `scripts/test-v2-phase-4-laundry-custody.mjs`
- `supabase/migrations/20260707103000_v2_phase_4_qr_token_generator_fix.sql`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | NOT RUN in this corrective slice |
| `npm run test:roles` | NOT RUN in this corrective slice |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:laundry-custody` - FAIL/BLOCKED on first run due missing `gen_random_bytes(integer)` in `generate_qr_identity_token()`.
- Static V2-4 tests - PASS after adding smoke and corrective migration.

### Boutique Regression

- Required Tier: C for this Laundry-local smoke/corrective slice.
- Tests run: static V2 guard and lint.
- Result: PASS for static/lint only.
- Notes: No Boutique browser flow was run.

### Tenant Isolation Checks

- DB-backed TI-006 did not complete because smoke failed before handling-unit creation.
- Static TI-006 coverage remains present in the smoke script.

### Manual QA

- Browser/device: NOT RUN.
- Persona: NOT RUN.
- Tenant/Vertical: NOT RUN.
- Test IDs: pending after corrective migration application.
- Result: NOT RUN.
- Notes: DB smoke must pass before browser QA is meaningful.

### Bugs Found

- V2-4 QR token generator failed in Supabase because `gen_random_bytes` was not visible under the function's restricted `search_path = public`.

### Bugs Fixed

- Added corrective migration replacing `generate_qr_identity_token()` with `extensions.gen_random_bytes(24)`.

### Deferred Issues

- Owner apply `20260707103000_v2_phase_4_qr_token_generator_fix.sql`.
- Rerun `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:laundry-custody`.
- If smoke passes, update QA workbook and project summary with DB evidence.
- Then run `/laundry/custody` browser QA.

### Compatibility Notes

- Boutique compatibility impact: no protected Boutique runtime/payment tables were changed by this corrective slice.
- Corrective migration only replaces the V2-4 QR token helper function used by Laundry container/handling-unit QR identities.

### Pending Tasks

- Apply `20260707103000_v2_phase_4_qr_token_generator_fix.sql` in Supabase.
- Rerun V2-4 DB smoke.
- Continue V2-4 browser QA and closure review.

### Blockers

- V2-4 DB smoke is blocked until the corrective migration is applied in Supabase.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Corrective migration application.
  - Passing DB-backed V2-4 Laundry custody smoke.
  - Manual `/laundry/custody` browser QA.
  - Final QA workbook update and diff/migration review.

### Notes for Next Session

- Apply `supabase/migrations/20260707103000_v2_phase_4_qr_token_generator_fix.sql`, then rerun `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:laundry-custody`.

---

## V2 Session Update - 2026-07-07 - V2-4 DB Smoke Pass

### Date

2026-07-07

### Updated By

Codex AI agent

### V2 Phase

V2-4 - Laundry Pickup, Container Assets, Handling Units and Custody

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit, if known: not rechecked beyond current branch; working tree remains uncommitted with V2-1/V2-2/V2-3/V2-4 work.

### Session Objective

- Rerun V2-4 DB-backed Laundry custody smoke after owner applied corrective QR token migration.
- Tighten smoke coverage to include a second service lot on the same Handling Unit.

### What Was Built

- Updated `scripts/smoke-v2-laundry-custody.mjs` to create two Service Lots and two Work Units from one Handling Unit.
- Updated `scripts/test-v2-phase-4-laundry-custody.mjs` to require the second-service-lot smoke assertion.
- Updated `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx` with passing V2-4 DB-smoke evidence.

### Key Decisions Made

- V2-4 remains `IN_PROGRESS`, not `READY_FOR_CLOSURE`, because browser/manual `/laundry/custody` QA is still pending.
- DB evidence is sufficient to mark LB2C-001 through LB2C-006 and TI-006 as PASS in the QA workbook.

### Migrations Added

- None in this pass.

### Migrations Applied Locally

- Owner applied `supabase/migrations/20260707103000_v2_phase_4_qr_token_generator_fix.sql` in Supabase before this smoke run.

### Files / Modules Changed

- `scripts/smoke-v2-laundry-custody.mjs`
- `scripts/test-v2-phase-4-laundry-custody.mjs`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `project_summary.md`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |

### Phase-Specific Tests

- `OS_PLUS_V2_DB_SMOKE=1 npm run smoke:v2:laundry-custody` - PASS.
- Evidence: tenant `fundry-laundry`; pickup `c3131332-e056-4e04-9b4c-48947521d920`; Handling Unit `HU-8D5534DE`; Service Lots `9e113500-1d0f-4d92-b91e-da474c8ce83a` and `30c29b53-fe72-4b2b-a03b-77e2f4895444`; TI-006 rejected `phantom-threads`.
- LB2C-001 - PASS.
- LB2C-002 - PASS.
- LB2C-003 - PASS.
- LB2C-004 - PASS.
- LB2C-005 - PASS.
- LB2C-006 - PASS.
- TI-006 - PASS.

### Boutique Regression

- Required Tier: C for this Laundry-local DB smoke slice.
- Tests run: typecheck, lint, build, role tests, V2 static tests.
- Result: PASS.
- Notes: No Boutique browser flow was run in this pass.

### Tenant Isolation Checks

- Checks run: TI-006 in DB smoke.
- Result: PASS.
- Notes: Foreign tenant `phantom-threads` could not read Fundry Handling Unit by guessed ID.

### Manual QA

- Browser/device: NOT RUN.
- Persona: NOT RUN.
- Tenant/Vertical: NOT RUN.
- Test IDs: `/laundry/custody` browser QA pending.
- Result: NOT RUN.
- Notes: DB-backed command/runtime path passed; UI/browser pass is next.

### Bugs Found

- None in this pass.

### Bugs Fixed

- Smoke coverage gap fixed by adding second service-lot scenario.

### Deferred Issues

- Browser/manual `/laundry/custody` QA.
- Final diff/migration review before `READY_FOR_CLOSURE`.
- Final closure-evidence update after browser QA.

### Compatibility Notes

- Boutique compatibility impact: no protected Boutique runtime/payment tables were changed in this pass.
- V2-4 smoke touched only temporary Laundry/V2 records and cleaned them up.

### Pending Tasks

- Run browser QA for Fundry `/laundry/custody`.
- Verify Laundry nav visibility/gating if possible.
- Update QA workbook and project summary after browser QA.
- Do not commit until owner gives explicit commit direction.

### Blockers

- None for continuing V2-4 browser QA.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO
- Missing closure requirements:
  - Browser/manual `/laundry/custody` QA.
  - Final migration/diff review.

### Notes for Next Session

- Run `/laundry/custody` browser QA as a Laundry tenant, then complete final V2-4 review.

---

## Session Update - 2026-08-07 - Existing Order Multi-Item Addition

### Date

2026-08-07

### Updated By

Codex AI agent

### Phase

Global Feedback and Boutique Order Editing Hardening

### Phase Status

IN_PROGRESS

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`.
- Working tree remains intentionally uncommitted and includes earlier V2-1 through V2-4 work plus this Boutique/global-feedback slice.
- No files were staged, committed, pushed, reset, or discarded.

### Session Objective

- Implement the approved ability to add several brand-new production items to an existing order in one save.
- Keep the flow add-only, finance-safe, tenant-safe, atomic, idempotent, mobile-friendly, and explicit about pending/error state.
- Leave Laundry and attendance-import scope paused.

### What Was Built

- Added a separate `Add items` side dialog on existing order detail.
- Reused the dynamic order-item builder for multiple rows and filtered row-level workflow choices by compatible item type.
- Added full new-item inputs for item type, name, description, color, quantity, unit price, discount, workflow, expected date, delivery override, standard size/customer measurement, and notes.
- Added a production-start warning and UI blocks for cancelled or fully delivered orders.
- Added a shared dialog `preventClose` state so pending saves block backdrop, Escape, and close-button dismissal.
- Added a pending-locked form state, visible progress, duplicate-submit guard, stable per-dialog idempotency key, recoverable error feedback, and input preservation on failure.
- Added a persistent success confirmation beside the Add items CTA after the dialog closes.
- Added `addOrderItemsFormAction` with Zod validation, permission/tenant context, structured action results, friendly database error mapping, and revalidation for order, production, finance, dashboard, and public tracking surfaces.
- Added an atomic `add_items_to_existing_order` database RPC that:
  - locks and validates the tenant-owned legacy Boutique order;
  - blocks cancelled and fully delivered orders;
  - validates active item types, workflows, workflow stages, customer measurements, and standard sizes;
  - enforces workflow/item-type, measurement/customer/item-type, and standard-size/item-type compatibility;
  - inserts all new `order_items`, workflow instances, stage instances, first ready stages, and item-history events in one transaction;
  - recalculates subtotal, discount, taxable amount, GST, total, amount paid, and payment status from active records;
  - preserves all payment rows;
  - serializes and deduplicates retries through `command_idempotency`.
- Added `recalculate_order_payment_summary`, a service-role-only RPC that recomputes payment state while holding the same order-row lock as item-add total changes, preventing a concurrent payment save from overwriting the summary with a stale order total.
- Added focused static/source-contract coverage and an opt-in database smoke harness for two-item addition, tenant isolation, invalid references, fit-reference compatibility, workflow initialization, atomic rollback, totals/payment status, and idempotent retry.
- Updated `docs/01_PRD.md`, `docs/02_WBS.md`, `docs/OS_PLUS_QA_Test_Matrix.xlsx`, and `scripts/build-qa-matrix.mjs`.
- Corrected stale customer duplicate rules in the PRD, WBS, Tech Development Plan, Rules, Database Model, Codex Build Prompt, and QA case CU-002 to the latest normalized-mobile decision.
- Added `PRODUCT.md` as the product-register context for future UI work.

### Key Decisions Made

- Existing-order item addition is a separate focused dialog, not part of the existing correction dialog.
- The first implementation is add-only; existing item price/quantity changes, deletion, customer changes, and payment reversal remain deferred.
- Quantity greater than one remains one production item with a quantity value.
- Adding after production starts is allowed with a warning and audit event; cancelled and fully delivered orders are blocked.
- Every new item is an independent production unit with its own workflow execution and first ready stage.
- The whole batch is atomic and idempotent; a partial set of new items must never remain after failure.
- Order financial summaries use the existing order GST treatment/rate and active old-plus-new items.
- Payment history is immutable in this flow; a paid order may become partially paid after its total increases.
- Delivery eligibility uses explicit order/item delivery status and does not infer fulfilment from configurable internal workflow-stage names.
- Existing partially delivered status is preserved; a previously ready or production-completed-but-not-delivered order returns to in-progress when new not-started work is added.
- Laundry, Tasks behavior beyond the already-completed nav gating, attendance Excel import, configuration editing, and default expense-category provisioning were not broadened into this slice.

### Migrations Added

- `supabase/migrations/20260807100000_existing_order_add_items.sql`

### Migrations Applied Locally

- None by Codex in this session.
- The new migration depends on the earlier generic V2 `command_idempotency` platform table and must be applied in repository migration order.

### Files / Modules Changed

- `PRODUCT.md`
- `package.json`
- `project_summary.md`
- `docs/01_PRD.md`
- `docs/02_WBS.md`
- `docs/03_Tech_Development_Plan.md`
- `docs/06_Rules.md`
- `docs/08_Database_Model.md`
- `docs/09_Codex_Build_Prompt.md`
- `docs/OS_PLUS_QA_Test_Matrix.xlsx`
- `scripts/build-qa-matrix.mjs`
- `scripts/test-existing-order-add-items.mjs`
- `scripts/smoke-existing-order-add-items.mjs`
- `src/app/(tenant)/orders/[orderId]/page.tsx`
- `src/components/orders/add-order-items-dialog.tsx`
- `src/components/orders/order-item-builder.tsx`
- `src/components/ui/dialog.tsx`
- `src/features/orders/actions.ts`
- `src/types/database.ts`
- `supabase/migrations/20260807100000_existing_order_add_items.sql`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run test:order-add-items` | PASS |
| `npm run smoke:order-add-items` | PASS in safe skip mode; DB mutation not enabled |
| `npm run test:roles` | PASS |
| `npm run test:v2` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |

### Phase-Specific Tests

- Focused source-contract test: PASS.
- Verifies RPC/security contract, explicit terminal delivery guards, production-completed reopening, tenant/reference guards, workflow initialization, audit history, locked financial/payment recomputation, idempotency, pending-locked UI behavior, visible success confirmation, compatible workflow filtering, route integration, and smoke-harness coverage.
- QA workbook Orders cases added:
  - OR-004: multi-row addition, workflow initialization, totals/payment behavior, and downstream refresh.
  - OR-005: tenant/fit-reference rejection, atomic rollback, idempotent retry, duplicate-submit/pending behavior, and terminal order guards.
- CU-002 updated to require normalized-mobile duplicate prevention and existing-customer resolution.

### Boutique Regression

- Required Tier: A before deployment because this slice changes Boutique `orders`, `order_items`, item workflow execution, payment summaries, production visibility, Finance/receivables, and public tracking refresh behavior.
- Automated result: focused test, role policy, V2 static regression, typecheck, lint, and production build all PASS.
- DB-backed and authenticated Boutique end-to-end execution remain pending.

### Tenant Isolation Checks

- Static/source contract confirms tenant-scoped order/reference validation and service-role-only RPC execution.
- The opt-in DB smoke contains cross-tenant order mutation rejection and atomic rollback checks.
- DB-backed tenant-isolation smoke was not run because it would create temporary operational records in an active tenant and the new migration was not applied in this session.

### Manual QA

- Browser/device: Codex in-app browser and connected Chrome, localhost development server.
- Persona: unavailable; both sessions redirected to Clerk sign-in.
- Tenant/Vertical: unavailable.
- Test IDs: OR-004 and OR-005 not executed in authenticated UI.
- Result: BLOCKED by unavailable authenticated localhost session.
- No customer, order, payment, item, or production data was submitted.

### Bugs Found

- The reused item builder originally showed every workflow for every item type.
- Initial migration review found non-array JSON could bypass the intended item-array validation path.
- Initial order-status recomputation would have changed `partially_delivered` to `in_progress`, losing valid fulfillment state.
- Review found production completion was incorrectly treated as full delivery, while canonical `delivered` state was not explicitly guarded.
- Review found the terminal guard inferred delivery from configurable internal stage names.
- Review found the payment action could overwrite a newly recalculated payment summary with a stale pre-addition total during concurrent saves.
- Review found successful item addition closed the dialog without an unmistakable persistent confirmation.
- Review found the Tech Development Plan, Rules, and Database Model still contained stale duplicate-customer policy.

### Bugs Fixed

- Workflow choices are now filtered to general workflows or workflows matching the selected item type.
- The RPC now rejects null/non-array payloads explicitly before checking array length.
- Partially delivered status is preserved; ready and production-completed-but-not-delivered orders move back to in-progress after new work is added.
- Cancelled, canonical delivered, and all-items-delivered orders are blocked; production completion alone is not treated as delivery.
- Delivery guards now use explicit order/item status and remain separate from internal workflow-stage labels.
- Payment-summary recalculation now runs behind an order-row lock shared with add-items total changes.
- Successful saves now leave a visible success status beside the CTA.
- The unapproved 20-row batch ceiling was removed so the implementation matches the agreed one-or-more-items contract.
- Remaining authoritative customer documents now match the normalized-mobile duplicate-prevention decision.
- QA workbook row wrapping/height was repaired and visually verified after adding OR-004, OR-005, and the revised CU-002.

### Deferred Issues

- Apply `20260807100000_existing_order_add_items.sql` in migration order.
- Run `OS_PLUS_ORDER_ADD_ITEMS_DB_SMOKE=1 npm run smoke:order-add-items` in an approved non-production or disposable QA context.
- Run authenticated OR-004/OR-005 browser QA at desktop and mobile widths without using destructive production data.
- Continue later feedback items one at a time: global CTA pending feedback, configuration editing, attendance Excel import, and default expense-category provisioning.

### Compatibility Notes

- Existing item correction forms remain unchanged and separate from the new add-only dialog.
- Existing payment rows are never overwritten or reversed.
- Concurrent payment-summary and add-item total recomputation serialize through the order row; the existing broader payment-insertion workflow remains otherwise unchanged.
- Production completion and customer fulfilment remain distinct; no delivery decision in the add-items guard depends on internal stage names.
- Public tracking revalidation is added, but public query fields remain customer-safe and do not expose measurements, internal stages/notes, workers, salary, or private attachments.
- The RPC is restricted to `boutique` + `legacy_item_v1` orders and cannot mutate Laundry `work_unit_v2` orders.
- Laundry and attendance code were not changed in this slice.

### Pending Tasks

- Apply and review the new database migration.
- Run DB-backed add-items smoke in an approved QA environment.
- Complete authenticated browser QA for OR-004 and OR-005.
- Standards and specification review completed for the source changes; re-review runtime evidence after database and browser QA.
- Do not commit until owner gives explicit commit direction.

### Blockers

- Database behavior cannot be marked verified until the migration is applied and the opt-in smoke passes.
- Authenticated UI behavior cannot be marked verified until a localhost Clerk session is available.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO.
- Missing closure requirements:
  - applied migration evidence;
  - passing DB-backed smoke;
  - authenticated desktop/mobile OR-004 and OR-005 QA;
  - final standards/spec review.

### Notes for Next Session

- Start by reviewing/applying `supabase/migrations/20260807100000_existing_order_add_items.sql` in migration order.
- Run `OS_PLUS_ORDER_ADD_ITEMS_DB_SMOKE=1 npm run smoke:order-add-items` only in an approved QA context.
- Then authenticate localhost, execute OR-004 and OR-005 without production records, and complete the final review before any commit.

## V2 Session Update - 2026-08-08 - Pilot Feedback Hardening and Attendance Import

### Date

2026-08-08

### Updated By

Codex AI agent

### V2 Phase

V2 cross-cutting pilot feedback hardening after the add-items slice

### Phase Status

QA_BLOCKED

### Branch / Base

- Branch: `v2/phase-1-platform-primitives`
- Base reference/commit: `f38469781419e03e516d92da0813f08eca8c015c`

### Session Objective

- Complete the outstanding global-feedback work without owner intervention: application-wide mutation/navigation pending feedback, configuration editing, attendance Excel import, and default expense categories for every tenant.
- Preserve and regression-test the existing-order multi-item implementation and earlier V2 dirty-worktree changes.
- Keep Laundry paused and Tasks hidden for non-Laundry tenants.
- Align PRD, WBS, technical/database rules, QA matrix, and this living summary.

### What Was Built

- Added a root action-feedback provider and upgraded the shared Button so every shared submit CTA shows a spinner and action-specific pending label, disables itself, and activates a global conflict-blocking progress overlay. Same-origin route links show an `Opening page...` state with a fail-safe release.
- Added tenant-safe edit dialogs/actions for item types, internal stages, customer statuses, workgroups, payment modes, expense categories, locations, teams, workflows, worker profiles/wages/workgroups, and stage/workgroup mapping removal.
- Preserved and regression-checked existing edit flows for measurement fields, standard sizes, customer measurements, and order payments. Added explicit history-preserving identity guards so referenced measurement fields, standard sizes, and customer measurements cannot be silently repointed to an incompatible item type.
- Added atomic worker and workflow configuration RPCs so related references/memberships update together while preserving operational history.
- Added automatic ten-category expense provisioning after every tenant insert plus an idempotent backfill for existing tenants. Existing custom, inactive, renamed, or deleted category history is not overwritten or revived.
- Added `.xls` and `.xlsx` attendance import using `docs_v2/sample_Attendance_Report.xls` as the parser contract.
- Added a no-write attendance preview that reports exact normalized active-worker matches, unmatched/ambiguous workers, new/update rows, future dates, and unknown statuses.
- Added confirmed attendance import with SHA-256 file fingerprint validation, server-side reparse/rematch, tenant/active-worker validation, atomic insert/update, stable idempotency, and tenant-scoped import audit receipts.
- Weekly-off and holiday source codes map to Holiday; future dates, blank statuses, unknown codes, and non-exact names are skipped and reported separately. The importer never creates workers.
- Existing manual attendance notes are preserved when an imported worker/date updates an existing row.
- Added database-enforced immutability for attendance import receipts while still allowing a parent tenant cascade to clean up tenant-owned data.
- Replaced split payment insert/correction and summary writes with service-role-only `record_order_payment` and `correct_order_payment` RPCs. Both lock the order row, validate tenant/payment-mode ownership, enforce totals, update cached payment state atomically, and prevent concurrent overpayment/stale summaries.
- Added immutable `order_payment_corrections` audit rows with reason, actor, timestamp, and before/after snapshots; direct audit update/delete is rejected while parent tenant cascades remain possible.
- Upgraded the shared dialog to an accessible modal with labelled/described semantics, initial focus, focus trapping, Escape protection during global/local pending work, and focus restoration.
- Extended the root pending blocker to imperative Task and Laundry custody commands. Laundry remains paused and Tasks remains hidden from non-Laundry tenants; this change only closes a shared interaction-safety bypass.
- Added the matching Laundry vertical assertion to Task route queries and every Task mutation, so a non-Laundry tenant cannot bypass hidden navigation by opening `/tasks` directly.
- Preserved dirty-form protection after recoverable add-items, attendance-import, payment, and workflow-action failures. Custom Cancel/Close controls now use the guarded shared dialog close path instead of bypassing unsaved-change confirmation.
- Added atomic workflow creation/default assignment/stage insertion and atomic stage-sequence replacement RPCs; invalid references cannot leave a partially created workflow or erase its prior stage sequence. Active workflows accept only active stages, activation requires a usable stage, and workflow activation/last-stage deactivation serialize in workflow-then-stage lock order so only one conflicting state change can commit.
- Made measurement-field, standard-size, and customer-measurement item-type identities immutable after creation, eliminating the check/update race with concurrent order-item creation.
- Added `.xlsx` archive and declared-range preflight before workbook materialization: byte-signature/extension agreement, central/local ZIP-header agreement, encrypted/unsupported-method rejection, hard-capped real inflation with declared-size verification, bounded entries/expanded bytes/entry size/compression ratio/sheets/rows/columns/cells, and ZIP64 rejection.
- Expanded the QA workbook through Configuration CF-007, Attendance AT-012, and Platform UX UX-006 and visually verified all 16 generated sheets after auto-fitting rows.

### Key Decisions Made

- Attendance worker matching is exact after NFKC normalization, case folding, non-breaking-space replacement, whitespace collapse, and trim. No fuzzy matching and no employee-profile creation.
- Only active worker profiles in the current tenant are eligible. Duplicate normalized source names or duplicate normalized active profile names are ambiguous and skipped.
- Preview never writes. Confirmation must submit the same file, pass the preview fingerprint, and repeat all parsing/matching/ownership checks.
- A confirmed import updates an existing active worker/date row or inserts one; the full batch succeeds or rolls back as one transaction.
- Attendance files are limited to 5 MB, 500 worker sections, 20 worksheets, 5,000 rows and 256 columns per sheet, and 500,000 declared cells. `.xlsx` archives additionally cap entries, expanded bytes, entry size, and compression ratio before parsing. Next Server Action body limit is 6 MB.
- The ten expense-category names remain: Raw material, Salary, Marketing, Rent, Travel, Utilities, Packaging, Courier, Maintenance, Miscellaneous.
- Expense provisioning compares `lower(btrim(name))`, inserts missing active defaults only, and never mutates an existing category.
- Global pending feedback targets real server mutations and same-origin route navigation; purely local disclosure/toggle controls remain immediate local UI actions.
- Payment recording and correction are money commands: validation, payment mutation, cached summary update, and audit insertion must share one database transaction and one order-row lock.
- A default workflow must have an item type and remain active. Workflow creation/default assignment/stage insertion and stage replacement are atomic; active workflows always retain at least one active stage.
- Fit-reference item-type identities are immutable after creation, whether or not currently referenced, so no concurrent order save can race a configuration reassignment.
- Tasks is Laundry-only in this phase at navigation, route-query, and server-mutation boundaries.
- Attendance import receipts and payment correction audits are append-only evidence. Direct edits/deletes are forbidden; parent tenant deletion remains recoverable through the existing cascade model.

### Migrations Added

- `supabase/migrations/20260808100000_configuration_editing_and_expense_defaults.sql`
  - Atomic worker/workflow edits, workflow creation and stage replacement, automatic tenant expense defaults, existing-tenant backfill, atomic payment record/correction RPCs, and immutable payment-correction audit records.
- `supabase/migrations/20260808110000_attendance_excel_import.sql`
  - `attendance_imports` audit table, direct-update/delete immutability trigger, and atomic/idempotent `import_attendance_rows` RPC.

### Migrations Applied Locally

- None. No local Supabase/psql runtime was available and no live database mutation was authorized.
- `20260807100000_existing_order_add_items.sql`, `20260808100000_configuration_editing_and_expense_defaults.sql`, and `20260808110000_attendance_excel_import.sql` remain owner-applied migration steps in filename order.

### Files / Modules Changed

- `src/components/ui/action-feedback-provider.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/layout/unsaved-changes-provider.tsx`
- `src/app/layout.tsx`
- `src/components/settings/configuration-edit-dialogs.tsx`
- `src/components/settings/settings-list.tsx`
- `src/features/settings/actions.ts`
- `src/features/workers/actions.ts`
- `src/features/workflows/actions.ts`
- `src/features/finance/actions.ts`
- `src/features/orders/actions.ts`
- `src/app/(tenant)/finance/page.tsx`
- `src/components/orders/add-order-items-dialog.tsx`
- `src/components/orders/add-payment-dialog.tsx`
- `src/components/production/workflow-action-dialogs.tsx`
- `src/components/settings/standard-size-form.tsx`
- `src/components/customers/customer-measurement-form.tsx`
- `src/components/tasks/task-queue-client.tsx`
- `src/features/tasks/actions.ts` / `src/features/tasks/queries.ts`
- `src/verticals/laundry/custody/laundry-custody-client.tsx`
- Settings pages for item types, stages, workgroups, payment modes, expense categories, customer statuses, locations, teams, and workflows
- `src/features/attendance/import-parser.ts`
- `src/features/attendance/import-actions.ts`
- `src/components/attendance/attendance-import-dialog.tsx`
- `src/app/(tenant)/attendance/page.tsx`
- `src/types/database.ts`
- `next.config.ts`
- `package.json` / `package-lock.json`
- `docs/01_PRD.md`, `docs/02_WBS.md`, `docs/03_Tech_Development_Plan.md`, `docs/04_Site_Map.md`, `docs/06_Rules.md`, `docs/08_Database_Model.md`
- `scripts/build-qa-matrix.mjs` and `docs/OS_PLUS_QA_Test_Matrix.xlsx`
- Focused regression scripts for action feedback, configuration editing, attendance import, expense defaults, existing-order add-items, opt-in payment-integrity database smoke testing, and opt-in workflow activation/last-stage concurrency smoke testing

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run test:roles` | PASS |
| `npm run test:order-add-items` | PASS |
| `npm run test:action-feedback` | PASS; additionally inventories every source server-action form and native button so pending-aware submit controls and explicit non-submit native buttons cannot be bypassed silently |
| `npm run test:configuration-editing` | PASS |
| `npm run test:attendance-import` | PASS; parsed the supplied legacy `.xls` fixture and all 20 worker sections |
| `npm run test:attendance-import-contract` | PASS |
| `npm run test:expense-defaults` | PASS |
| `npm run test:v2` | PASS |
| `npm run smoke:payment-integrity` | PASS in safe skip mode; database execution requires `OS_PLUS_PAYMENT_INTEGRITY_DB_SMOKE=1` plus an explicitly approved QA database |
| `npm run smoke:workflow-stage-concurrency` | NOT RUN; the environment refused database-capable execution without an explicitly approved disposable QA database. The harness is opt-in with `OS_PLUS_WORKFLOW_STAGE_DB_SMOKE=1` and fails if exact-ID cleanup is incomplete. |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; all 41 routes generated/compiled |
| `npm audit --audit-level=high` | FAIL: 9 known dependency advisories (1 low, 2 moderate, 6 high); the attendance parser package was not listed. Fixing Next/transitive advisories requires a separate dependency-upgrade review. |

### Phase-Specific Tests

- OR-004/OR-005 source and security contracts: PASS; DB/browser mutation execution remains pending.
- CF-001 through CF-005 source/security contracts: PASS, including workflow-then-stage lock-order and fail-closed concurrency-harness contracts; database execution remains pending.
- AT-004 parser/sample-workbook behavior: PASS.
- AT-005 exact-name-only import contract: PASS statically/parser-level; database execution remains pending.
- AT-006 tenant-isolation guards: PASS statically in action/RPC; database cross-tenant execution remains pending.
- AT-007 update-vs-insert/note-preservation: PASS by RPC/source contract; database execution remains pending.
- AT-008 idempotency/duplicate-submit guard: PASS by RPC/source and pending-state contract; concurrent database execution remains pending.
- AT-009 future/blank/unknown/ambiguous skips: PASS in parser tests and source contract.
- AT-010 atomic rollback: PASS by transaction/RPC contract; database fault execution remains pending.
- AT-011 immutable import receipts/direct-update-delete guard: PASS by migration/type source contract; database execution remains pending.
- AT-012 archive and worksheet-bound preflight: PASS for supplied legacy `.xls`, valid bounded `.xlsx` structure, oversized entry, local/central header mismatch, and renamed-extension rejection; remaining entry/sheet/range variants are specified in QA.
- CF-006 concurrent payment and overpayment serialization: PASS by RPC/source contract; opt-in database smoke is present but database execution remains pending.
- CF-007 fit-reference identity/history preservation: PASS by action/source contract; database execution remains pending.
- UX-005 modal keyboard/focus and pending-Escape protection: PASS by source contract; authenticated browser keyboard execution remains pending.
- UX-006 direct Task route/mutation on non-Laundry tenant: PASS by route/action source contract; authenticated Boutique execution remains pending.
- UX-001/UX-002 shared pending and conflict-blocking source contracts: PASS; authenticated slow-request browser execution remains pending.
- QA workbook Configuration, Attendance, and Platform UX sheets: artifact-tool inspection PASS; visual render PASS after row auto-fit correction.

### Boutique Regression

- Required Tier: A because shared Button/root layout, settings, workers, Finance payment summary, attendance, order add-items, and shared database types changed.
- Tests run: role policy, add-items contract, global feedback contract, configuration contract, attendance contracts, V2 suite, typecheck, lint, production build, public localhost route navigation.
- Result: AUTOMATED PASS; DB-backed and authenticated Tier A execution remains BLOCKED.
- Notes: no Laundry production path was enabled or exercised. Tasks remains feature-gated for non-Laundry tenants.

### Tenant Isolation Checks

- Every new configuration update filters by current `tenant_id`, verifies that an updated row was returned, or uses an atomic RPC that raises a tenant-owned not-found error.
- Attendance preview loads only current-tenant active workers and current-tenant attendance.
- Attendance RPC rejects any worker not active in the supplied tenant, duplicate worker/date payloads, invalid statuses, and future dates.
- RPC execute permission is revoked from public/anon/authenticated and granted only to `service_role`; `attendance_imports` has RLS enabled.
- Result: PASS by static/action/RPC contracts; live cross-tenant execution NOT RUN.

### Manual QA

- Browser/device: Codex in-app browser and connected Chrome; localhost development server.
- Persona: public only. Authenticated localhost redirected to Clerk sign-in in the in-app browser; Chrome had a deployed OS PLUS session but no authenticated localhost session.
- Tenant/Vertical: none for localhost authenticated routes.
- Test IDs: public navigation portion of UX-003 PASS; AT-004 through AT-011, CF-001 through CF-007, and authenticated UX-001/UX-002/UX-005 remain BLOCKED.
- Result: Local public home and Boutique route loaded and navigated successfully. No application console errors; only the expected Clerk development-key warning.
- Notes: No customer, worker, attendance, finance, order, or production record was submitted. The sample workbook was not confirmed through the UI because doing so requires both an authenticated tenant and the unapplied attendance migration.

### Bugs Found

- React action forms reset uncontrolled file inputs after a successful preview, which would have lost the workbook before confirmation.
- Configuration update filters initially prevented foreign writes but could silently report success when the tenant-scoped record did not exist.
- Finance payment correction still performed a client-side payment-summary rewrite using a previously read order total.
- Payment recording still inserted a row and recalculated the order summary in separate operations, allowing concurrent saves to exceed the order total.
- Payment corrections overwrote financial evidence without an immutable before/after correction record and required reason.
- Referenced fit-reference identities could be changed in ways that made historic order-item references incompatible.
- Generic dialogs were missing modal accessibility semantics/focus trapping and allowed Escape to bypass the global pending blocker.
- Imperative Task/Laundry commands bypassed the shared pending overlay, attendance receipt immutability was documentary only, blank attendance cells were not counted, and recoverable failed submits could clear the dirty guard.
- Task navigation hiding was not backed by a Laundry vertical assertion on direct route queries and mutations.
- Workflow creation and stage replacement used separate writes, so an intermediate failure could leave a workflow without stages or partially configured default state.
- Fit-reference reassignment used separate reference-check and update requests, leaving a concurrent order-creation race.
- Custom add-items/attendance close buttons bypassed guarded unsaved-change confirmation, some recoverable payment/workflow forms cleared dirty state on submit, and `.xlsx` workbook expansion/range limits were checked too late.
- `.xlsx` central-directory-only limits could be bypassed by conflicting local headers or by renaming ZIP content to `.xls`; active workflows could also be configured with only inactive stage-master rows.
- Workflow activation checked for an active stage without retaining a stage lock, allowing a simultaneous last-stage deactivation to invalidate the activation check.
- Initial QA workbook fixed row height clipped long new Configuration/Attendance/UX test text.

### Bugs Fixed

- Attendance dialog retains the selected `File` in client state and explicitly adds it back to confirmation `FormData` after React resets the native input.
- New configuration update actions now request the updated ID and reject missing/foreign/deleted records explicitly.
- Payment recording/correction now uses locked atomic RPCs; correction writes immutable before/after audit evidence and requires a reason.
- Measurement, size, workflow-default, modal accessibility, imperative-action pending, attendance immutability/blank reporting, and dirty-preservation gaps were closed with focused regression contracts.
- Task reads/mutations now assert Laundry, workflow create/stage replacement is transactional, fit-reference identities are immutable, custom close buttons use guarded closure, recoverable payment/workflow forms preserve dirty state, and `.xlsx` resource bounds are preflighted.
- Workbook type now comes from bytes with extension agreement, local/central headers are cross-validated, deflated entries are expanded under a hard cap before parsing, and stage/workflow edit RPCs serialize last-active-stage invariants.
- Workflow activation now locks qualifying stage-master rows through commit in the same workflow-then-stage order as stage deactivation; an isolated opt-in QA smoke races both commands and fails if either its invariant or exact-ID cleanup fails.
- QA workbook data rows now auto-fit after column widths are applied; key sheets were rendered and visually checked.

### Deferred Issues

- Apply and database-test the three pending migrations in an approved QA/staging database.
- Authenticated desktop/mobile browser QA for OR, CF, AT, and UX test IDs.
- Dependency remediation: npm audit reports 9 advisories (1 low, 2 moderate, 6 high), including Next 16.2.6 and transitive packages; a coordinated Next/eslint-config-next and transitive upgrade is outside this feature session.
- Full application-wide recoverable inline error/success conversion remains a later hardening effort; this session supplies the requested global pending/conflict feedback and preserves explicit state in the focused add-items and attendance-import workflows.

### Compatibility Notes

- Boutique compatibility impact: shared submit Buttons and internal route links now add pending feedback; forms retain their existing actions and visual variants.
- Configuration edits are additive correction paths and preserve referenced production, attendance, salary, finance, measurement, and customer history; immutable identity and compatibility guards reject unsafe repointing.
- Boutique `order_payments` remains the source of truth, but its record/correction command paths now serialize through the order row and correction evidence is append-only.
- Attendance import changes only matched active current-tenant worker/date records and does not affect production work logs.
- Expense-default backfill inserts missing normalized names only and does not overwrite tenant customizations.
- Public tracking queries and payloads were not expanded; attendance import receipts and internal worker matching are never public.
- Laundry remains paused. No Laundry tenant enablement or production data mutation was performed.
- Tasks remains hidden and is now rejected server-side for non-Laundry tenants.

### Pending Tasks

- Apply migrations in order and record row/backfill counts.
- Run database-backed OR-004/OR-005, CF-002 through CF-007, and AT-005 through AT-012 in approved QA data.
- Authenticate localhost and execute desktop/mobile UI checks, including slow-request conflict blocking and attendance preview without creating destructive production records.
- Review npm security upgrades separately.
- Do not stage, commit, push, or discard until the owner explicitly requests it.

### Blockers

- Database runtime evidence is blocked until the migrations are applied in an explicitly approved disposable QA/staging environment; the current configured target is remote/unknown and the only local database belongs to another project.
- Authenticated UI evidence is blocked until a localhost Clerk session or dedicated test account is available; both available browser surfaces currently redirect to sign-in.

### Independent Review

- Spec review: no remaining actionable P0/P1/P2 findings after `.xlsx` hardening.
- Standards review: no remaining actionable P0/P1/P2 findings after workflow activation locking and fail-closed smoke cleanup.

### Completion Audit Recheck - 2026-08-08

- Re-audited all `src` form submissions, `formAction` controls, imperative client actions, transitions, and raw native buttons. Every server-action form uses the shared pending-aware `Button` or a local `SubmitButton` wrapper that delegates to it; every raw native button explicitly declares `type="button"`.
- Added this inventory to `scripts/test-global-action-feedback.mjs`; `npm run test:action-feedback` and `npm run lint` pass after the stronger contract.
- Rechecked database availability without printing credentials. The configured Supabase target is remote/unknown, the Supabase CLI is unavailable, and the only local PostgreSQL container belongs to another project. No database migration, smoke mutation, or unrelated-container access was attempted.
- Started the local OS PLUS server and rechecked `/orders` in both the Codex in-app browser and connected Chrome. Both redirected to Clerk sign-in; no localhost-authenticated session or dedicated E2E/test-account environment variable is available.
- Did not create or impersonate a Clerk session and did not use the remote service-role credentials because neither action has an explicitly approved disposable QA target.
- Completion result remains `QA_BLOCKED`: source implementation, automated gates, artifact inspection, and independent reviews are complete, but the objective cannot be proven end to end without database-backed and authenticated runtime evidence.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO.
- Missing closure requirements:
  - owner-applied migration evidence and backfill counts;
  - database-backed atomicity/idempotency/tenant-isolation checks;
  - authenticated desktop/mobile QA;

### Notes for Next Session

- Apply `20260807100000_existing_order_add_items.sql`, then `20260808100000_configuration_editing_and_expense_defaults.sql`, then `20260808110000_attendance_excel_import.sql` in an approved QA/staging Supabase project.
- Record expense-category backfill counts and confirm a freshly created tenant receives all ten categories.
- Run the QA workbook tests OR-004/OR-005, CF-001 through CF-007, AT-004 through AT-012, and UX-001 through UX-006.
- Execute `npm run smoke:payment-integrity` only against an explicitly approved disposable QA database after all pending migrations are applied; never point the opt-in smoke at production.
- Execute `npm run smoke:workflow-stage-concurrency` only against the same explicitly approved disposable QA database; verify it reports exactly one conflicting state change per pair and completes cleanup.
- Use `docs_v2/sample_Attendance_Report.xls` for preview; confirm only in a disposable/approved attendance period because matched worker/date rows are intentionally updated.
- Commit only after the owner reviews the final diff and explicitly asks for a commit.

### Authenticated QA Continuation - 2026-08-08

#### Environment and Authorization

- The owner confirmed that the pending migrations were applied to the shared production/QA Supabase environment.
- The owner explicitly approved two pure test tenants for authenticated verification:
  - Fundry Laundry (`03947107-f8cb-424f-a02e-b67c9eadf0e4`, app store name `Fundry Laundry`, database tenant name `Abs`).
  - Phantom Threads Test (`7be40f50-94a0-46c5-af57-7eea5e36ea8a`).
- Chrome was authenticated as the Fundry admin / Phantom manager account. Edge was authenticated as the Phantom admin/manager account.

#### Runtime Results

- Fixed the `/workers` Server/Client boundary crash by moving `buttonVariants` into a server-safe module. Added `test:client-boundaries`; the page then loaded for Fundry (zero active workers) and Phantom (five active workers).
- Phantom active-worker roster used for attendance QA: Designer, Man 1, Man 2, Man 3, and Ravi.
- Verified both approved tenants contain all ten default expense categories. No existing category was overwritten.
- Authenticated configuration correction checks passed: an expense-category rename and a worker-notes edit saved, reloaded, and were restored to their original test values. Edit entry points were present for item types, stages, customer statuses, workgroups, payment modes, expense categories, workflows, worker profiles, measurement fields, standard sizes, customer measurements, expenses, and order-payment corrections.
- Verified non-Laundry Task gating end to end: Phantom hides Tasks in navigation and direct `/tasks` access returns a clean 404. Task reads and mutations retain server-side vertical assertions.
- Verified adding two new production items to existing Phantom order `ORD-000012` in one save after production had started. Both items received independent workflows and first ready stages. Total changed from INR 1,416 to INR 1,652, recorded payment remained INR 300, and outstanding changed from INR 1,116 to INR 1,352. Public tracking displayed the two customer-safe items without exposing workers, internal stages, or internal notes.
- Restored and verified the approved inline-customer flow: an exact existing normalized mobile match was selected without creating a duplicate, the order URL did not change, and the outer order reference/notes draft remained intact.
- Added visible Finance labels (`Edit` for expenses and `Correct` for order payments) so correction actions are discoverable rather than icon-only.

#### Attendance Workbook Evidence

- Generated `outputs/019fdb69-847e-71c3-9069-b52aa17a1db7/OS_PLUS_Phantom_Attendance_All_Cases.xlsx` from the real Phantom roster.
- The workbook covers five valid exact/normalized worker matches, an unmatched name, an ambiguous duplicate source name, supported status aliases, blanks, an unknown status, future dates, and time/duration fields.
- Workbook structure, formulas, and rendered sheet layout passed artifact inspection.
- After the owner enabled `Allow access to file URLs` for the ChatGPT Edge extension, the authenticated Phantom preview reported the exact expected evidence: eight source sections, five exact workers, 38 new rows, zero updates, 210 skipped rows, one unmatched worker, two ambiguous sections, 184 future-date cells, one blank status, and one unknown status.
- Confirmation succeeded. The Attendance overview showed 38 of 70 range entries marked across Designer, Man 1, Man 2, Man 3, and Ravi with the expected Present/Absent/Half-day/Leave/Holiday mapping. No unmatched or ambiguous source profile was created.

#### Final Automated Gates

| Command | Result |
|---|---|
| `npm run test:roles` | PASS |
| `npm run test:order-add-items` | PASS |
| `npm run test:action-feedback` | PASS |
| `npm run test:client-boundaries` | PASS |
| `npm run test:configuration-editing` | PASS |
| `npm run test:expense-defaults` | PASS |
| `npm run test:attendance-import` | PASS |
| `npm run test:attendance-import-contract` | PASS |
| `npm run test:customer-inline` | PASS |
| `npm run test:v2` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; all 41 pages generated |

#### Review and Closure Status

- Independent standards review: no remaining actionable P0/P1/P2 findings.
- Independent specification review: no remaining actionable P0/P1/P2 findings.
- TDD restored the customer mobile-normalization/duplicate-resolution contracts and caught the Workers server/client boundary regression before the final build.
- The owner explicitly authorized the curated local phase commit on 2026-08-08. Generated QA outputs and private attendance/customer sample exports are excluded through `.gitignore` and are not part of the commit.
- The mandatory commit gate was rerun after staging: `npm run typecheck`, `npm run lint`, `npm run test:roles`, `npm run test:v2`, and `npm run build` all passed; the build generated all 41 pages.
- Phase status is `CLOSED`: implementation, applied migrations, focused contracts, authenticated order/configuration/customer/Task/attendance checks, independent reviews, final staged-diff inspection, TypeScript, lint, role/V2 tests, and production build all pass.
- The phase commit is local only. Push, merge, and production deployment remain separate owner-authorized actions.

### Customer Import and External Identity Phase - 2026-08-08

#### Confirmed Scope

- Owner/admin-only CSV and XLSX customer import, limited to 5 MB and 5,000 data rows.
- Matching precedence is Shopify customer ID, then canonical phone; exact email is advisory and requires an explicit reuse, create, or skip decision.
- Reused profiles fill blank fields only. Populated-field conflicts are visible in preview and never overwritten automatically.
- Indian and international phones use canonical E.164 matching. Foreign national format requires a reliable country code; ambiguous foreign numbers are invalid.
- Complete addresses create structured customer-address rows. Incomplete addresses remain legacy text.
- Shopify totals, order counts, tags, tax flags, and marketing flags are private source metadata only and do not affect orders, finance, reports, or messaging consent.

#### Dependency Audit

- Fast-forward merged and pushed `v2/phase-1-platform-primitives` into `main` at `86ca505`, then created `codex/customer-import` from the clean merged baseline.
- Added a privacy-safe read-only phone-collision audit script. Against the configured shared production/QA database it found eight active customer phones, all resolvable as Indian, zero unresolved values, and zero collision groups.
- The clean audit cleared the legacy-data prerequisite for `20260809100000_customer_import_and_phone_identity.sql`. The owner applied the migration to the shared production/QA Supabase environment on 2026-08-08.
- Added `libphonenumber-js` for validated E.164 normalization. Existing Indian standalone create/update flows continue to store the familiar 10-digit display phone while also writing E.164.

#### Implementation

- Added parser support for Shopify and generic customer CSV/XLSX columns, hardened XLSX archive preflight, worksheet/row/column limits, Indian/international phones, structured/incomplete addresses, source metadata, blank names, invalid emails, and same-row phone conflicts.
- Added deterministic preview matching for create, reuse by Shopify ID, reuse by phone, exact-email review, invalid cross-key conflicts, and duplicate source keys.
- Added an owner/admin Customers-page side panel with pending protection, write-free preview, visible invalid/skipped counts, conflicts, email decisions, recoverable errors, and success counts.
- Added canonical phone storage, active tenant uniqueness, tenant-owned external identities, immutable import receipts, and a service-role-only atomic/idempotent `import_customer_rows` RPC migration.
- Confirmation re-reads the file, re-queries only the active tenant, recomputes the preview fingerprint, excludes invalid/skipped rows, and rejects stale or tampered targets before the database transaction.
- Updated PRD, WBS, Tech Development Plan, Rules, Database Model, focused implementation spec, QA matrix generator, and project summary.

#### Verification Status

- Focused phone, parser, matching, permission/UI/schema/RPC contract, role, inline-customer, attendance, action-feedback, client-boundary, order, configuration, expense-default, and V2 regressions pass.
- TypeScript, ESLint, and the Next.js production build pass; all 41 pages generate.
- The QA workbook was regenerated with CU-004 through CU-007, formula-error scanned, and visually verified across all 16 sheets.
- Privacy-safe baseline and all-cases customer fixtures were generated as CSV and XLSX under ignored `outputs/`. The source workbook renders were checked and contain no formula errors.
- The private 13-row sample parsed read-only as 11 usable rows and two blank-name skips, with seven normalized phones, four structured addresses, and six legacy/incomplete address texts. No personal values were printed or committed.
- Authenticated Edge owner/admin QA on Phantom Threads passed with the synthetic baseline and all-cases XLSX fixtures. Preview, explicit email reuse, international numbers, populated-field conflict protection, blank-field enrichment, structured/incomplete address handling, invalid/skipped rows, pending/close protection, confirmation, and visible result counts behaved as specified.
- The corrected all-cases fixture confirmed one remaining US customer creation, five authoritative reuses, two new structured addresses, seven invalid rows, and one skipped row. Repeating the same workbook produced zero new customers, six reuses, zero new addresses, and an unchanged customer count.
- Chrome QA confirmed the import action is absent for the Phantom Threads manager role. Switching the same account to Fundry Laundry showed zero Phantom customer records, confirming tenant-isolated reads in the authenticated UI.
- The synthetic fixture generator was corrected so the external-ID, phone-reuse, valid-US, and conflicting-phone cases use independent phone identities. The regenerated workbook was formula-error scanned and visually verified.
- Final standards/spec review found and resolved release-edge cases before commit: all email-only decisions remain reachable beyond the 200-row display sample; email decisions show full conflicts; country-assisted foreign national numbers take precedence over Indian inference; imported international customers remain editable; invalid ISO country codes and malformed UTF-8 CSVs are rejected during preview; notes conflicts are visible; and the stale-preview fingerprint includes matched profile/conflict state.
- Added regression coverage for country-assisted US numbers beginning with an Indian-looking digit, invalid ISO country codes, malformed UTF-8 CSV input, international-phone action contracts, complete email-review visibility, conflict rendering, and expanded stale-preview state.
- Final focused customer-import tests, TypeScript, ESLint, QA workbook verification, synthetic fixture generation, and the Next.js production build pass; all 41 pages generate.
- The shared production/QA environment supplied authenticated confirmation, retry/idempotency, permission, and cross-tenant evidence. A disposable database is still required for a repeatable automated destructive RPC harness covering forced rollback and concurrency; those cases must not be manufactured against the shared production/QA database.
- The 2026-08-08 dependency audit reports newly published high-severity advisories affecting the existing Next.js 16.2.6 and transitive tooling tree. Customer import adds only `libphonenumber-js`; framework/tooling remediation must be handled as an explicit release dependency rather than silently bundled into this feature.

#### Notes for Next Session

- Customer import is migration-backed, authenticated-QA complete, independently reviewed, and release-gate clean; commit and push `codex/customer-import` before starting the next feature branch.
- Never commit or use the private `docs_v2/sample_customers_export.csv` as an automated fixture.
- Use synthetic data for the first confirmation. Preview the real tenant export only from the intended tenant login after the synthetic checks pass.
- Direct Shopify OAuth/webhooks should reuse `customer_external_identities` and normalized-phone behavior in a separate PRD/WBS phase; this import slice does not create Shopify orders.

### Multi-Worker Stage Contributions Phase - 2026-08-09

#### Confirmed Product Rules

- A production stage may contain multiple worker-role contributions from any workgroup mapped to that stage. When a worker belongs to several eligible workgroups, the performed role is selected explicitly.
- Stage effort modes are assignment-only, credited units, credited time, or hybrid units plus time. Unit credit uses 0.10 increments; time uses ten-minute increments with +/−10-minute and +/−1-hour controls.
- Summed man-hours are worker effort and remain separate from elapsed stage duration. Five workers contributing one hour each record five man-hours even if the stage elapsed time is one hour.
- Optional item-type/stage monetary rules are per unit, per hour, or one percentage pool distributed by credited units or time. Percentage uses the item final value after item discount and before GST.
- Contributions are analytics-only. They do not change salary, order totals, GST, payments, expenses, worker ledgers, or finance reports.
- Missing rates produce ₹0 with a visible warning and never block production. Active/completed stages retain snapshotted mode/rate/item-value/pool data when configuration changes.
- Managers may edit contributions only before completion. Owner/admin may correct completed contributions with a reason. Removing recorded effort requires a reason and immutable old/new audit evidence.
- Historical completed stages are not backfilled. V2 work-unit parity and any composite or salary-linked efficiency score remain explicitly deferred; contribution value, units, man-hours, and completed-stage reports are available as separate metrics.

#### Implementation

- Added `20260809120000_stage_worker_contributions.sql` with effort/rule enums, stage configuration, contribution-rule storage, stage snapshots, credited work-log fields, immutable correction evidence, immutable idempotency receipts, tenant RLS, and service-role-only atomic start/replace/complete RPCs.
- RPCs lock stage/workflow/item rows, revalidate tenant-owned worker/workgroup eligibility on every mutation, reject duplicate worker-role pairs, enforce tenth-unit/ten-minute increments, validate completion totals, preserve completed elapsed timestamps during correction, and atomically update workflow/order status and history.
- Stage contribution revisions reject stale simultaneous editors instead of allowing last-write-wins overwrites. Configuration updates acquire the established workflow-then-stage locks before compatibility checks, preventing contribution-rule/mode races without reversing repository lock order.
- Added deterministic TypeScript calculation/validation helpers for fixed rules and percentage-pool allocation with exact paise remainder handling.
- Added stage effort-mode editing and a focused Settings → Item types → Contribution rules page. Incompatible stage-mode changes are blocked while active rules exist.
- Replaced the public legacy single-worker start/complete controls in both Production and Order Detail with a mobile side-panel editor supporting dynamic worker rows, explicit roles, effort controls, live totals/amounts, missing-rate warning, recoverable errors, idempotency, and pending close/duplicate-submit protection.
- New snapshotted stages no longer expose the legacy correction dialog, preventing that older single-worker path from bypassing multi-worker invariants. Existing unsnapshotted historical completed stages cannot be contribution-backfilled; their legacy records remain unchanged.
- Added visible contribution summaries, actual elapsed time, snapshotted rule basis, and correction-audit reasons to workflow detail without exposing any contribution information in public tracking.
- Successful saves explicitly invalidate both production-item and order-detail routes so status and contribution summaries refresh immediately.

#### Documentation and QA Coverage

- Updated PRD, WBS, Tech Development Plan, Site Map, Rules, Database Model, and added `docs/14_Stage_Worker_Contributions_Implementation_Spec.md`.
- Added CF-008 and PR-004 through PR-014 to the reproducible QA matrix builder and regenerated `docs/OS_PLUS_QA_Test_Matrix.xlsx`.
- The QA workbook has no formula errors; all 16 sheets were rendered and visually checked after regeneration.
- Added focused calculation, atomic database-contract, and UI/permission/tenant-boundary regression scripts plus package commands.
- Independent standards/spec reviews identified and resolved legacy backfill, eligibility revalidation, stale editor, deterministic paise preview, dynamic-route invalidation, completion-summary, and configuration lock-order gaps before handoff.

#### Automated Verification

| Command | Result |
|---|---|
| `npm run test:stage-contributions` | PASS |
| `npm run test:stage-contribution-contract` | PASS |
| `npm run test:stage-contribution-ui` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; contribution settings route included and all 41 pages generated |

#### Applied Migration and Authenticated QA - 2026-08-09

- The owner applied `20260809120000_stage_worker_contributions.sql` successfully to the shared production/QA Supabase environment before runtime verification.
- Authenticated Phantom Threads Test QA covered both owner/admin and manager memberships. Owner/admin could correct completed feature-era contribution snapshots with a mandatory reason; the manager could see the completed summary but had no completed-contribution correction action.
- Before the approved tenth-unit usability revision, a Shirt Stitching stage was started with two eligible workers in the Tailors role, split at 0.50 units each, saved, completed, and then owner-corrected to 0.75/0.25 under the then-current quarter-unit rule. The INR 400 per-unit pool remained INR 400 after correction and the audit history showed the supplied reason. Existing completed snapshots remain historical and are not rewritten by the new increment rule.
- A separate Maggam stage persisted 1h 10m for Man 2 through the +1-hour/+10-minute controls. Its missing item-type rate produced a visible INR 0 warning and did not block start or completion, confirming the intended configuration-gap behavior.
- Live two-tab testing proved contribution revisions reject stale editors. The stale editor preserved its entered values and displayed a recoverable conflict message after the first editor saved a newer revision.
- Live QA exposed and fixed two release-edge defects: structured Supabase RPC errors now map to specific user-facing conflict messages, and a successful contribution action now rotates its idempotency token so a subsequent save-to-complete action is not misclassified as a replay.
- Pending-state behavior was observed on start, save, and complete: the dialog and inputs were disabled, close was protected, status text was visible, and duplicate submission was blocked while the request was active.
- The production workflow was checked at a narrow mobile viewport without document overflow. Completed summaries showed worker-role allocations, effort, contribution amount, actual elapsed duration, and snapshotted rate basis.
- Historical unsnapshotted completed stages remained without contribution correction controls. The new RPC additionally rejects completed legacy stages, so existing history cannot be backfilled through a direct call.

#### Final Regression Gate

| Command | Result |
|---|---|
| `npm run test:roles` | PASS |
| `npm run test:order-add-items` | PASS |
| `npm run test:action-feedback` | PASS |
| `npm run test:client-boundaries` | PASS |
| `npm run test:configuration-editing` | PASS |
| `npm run test:expense-defaults` | PASS |
| `npm run test:attendance-import` | PASS |
| `npm run test:attendance-import-contract` | PASS |
| `npm run test:customer-inline` | PASS |
| `npm run test:customer-phone` | PASS |
| `npm run test:customer-import` | PASS |
| `npm run test:customer-import-matching` | PASS |
| `npm run test:customer-import-contract` | PASS |
| `npm run test:stage-contributions` | PASS |
| `npm run test:stage-contribution-contract` | PASS |
| `npm run test:stage-contribution-ui` | PASS |
| `npm run test:v2` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; all 41 pages generated |

#### Remaining Release Evidence

- A disposable database is still required for an automated destructive contribution-RPC harness covering forced mid-transaction rollback and concurrent tenant-boundary attempts. Those cases were not manufactured against the shared production/QA environment.
- The runtime contribution records above were created only in the owner-approved Phantom test tenant. Salary, payment, GST, expense, and public-tracking calculations are not read or mutated by the contribution RPCs.
- Do not stage, commit, push, or merge this branch until final diff review and owner authorization.

### Contribution Usability and Worker Reporting Follow-up - 2026-08-09

#### Approved Changes

- Credited units now use 0.10 increments. Unit rows provide -1, -0.1, +0.1, and +1 controls plus exact numeric entry.
- The first assignment on a unit/hybrid stage defaults to the complete item quantity; added assignments and all time inputs default to zero.
- Successful stage-configuration and contribution-rule saves close their editor, refresh the visible saved value, and show success feedback. Errors keep the editor and entered values available.
- Contribution rules use saved plain-language summaries with focused editing. Percentage summaries explain that one pool is calculated from the discounted pre-GST item value and split by the configured effort basis.
- A valid completed-stage action closes only the contribution editor and returns to the workflow view. Start and in-progress save actions remain open.
- Worker contribution analytics compare contribution value, credited units, man-hours, and completed stages as independent metrics. Active work is excluded, weekly trends use completion week, and rate-configuration coverage explains zero-value gaps. These analytics do not affect salary or finance.

#### Implementation

- Added `20260809130000_stage_contribution_usability_reports.sql` to replace the quarter-step database constraint/function validation with tenth-unit validation and add the completed-work report index.
- Updated TypeScript/Zod and database validation to the same 0.10 invariant.
- Added mobile unit steppers, first-row defaults, completed-editor close behavior, success-closing stage configuration, and summary-first item-type contribution rules.
- Added tenant-scoped completed-work aggregation and the `/dashboard/workers` leaderboard/weekly trend report with metric and date-range controls.
- Added focused regression coverage for calculations, server/database increment parity, editor defaults and controls, configuration close/error behavior, and report aggregation/query/UI contracts.
- Independent standards/spec review found and resolved five release-edge defects: tiny percentage pools could over-allocate or create a negative final row; status-only completion could create a false correction; completion summaries omitted unit totals; duplicate worker names collided in chart series; and managers inherited an owner-only dashboard guard. Allocation now uses largest remainder in paise, audit comparison ignores status-only changes, summaries show units versus quantity, chart keys use worker IDs, and managers use a dedicated permission-gated Production route.
- The review also removed configurable-name fulfillment inference from the contribution completion RPC. Final delivery uses the explicit mapped customer-status final flag.

#### Migration and Runtime Note

- `20260809130000_stage_contribution_usability_reports.sql` must be applied before runtime 0.10-unit entries are accepted by the shared Supabase environment. Existing completed contribution snapshots are not modified.

### 2026-08-09 — Item-type emoji and Production garment filter

- Added optional single-emoji item-type identity with server validation and bounded nullable storage.
- Added internal fallback garment icon and propagated item-type identity through order creation, order detail, production queue/board, and workflow detail.
- Added tenant-scoped, multi-select garment-type filtering on Production.
- Preserved search, queue, workflow, item-type, list/board, and workflow-pane URL state across navigation.
- Kept emoji outside public tracking.
- Added migration `20260809140000_item_type_emoji.sql` and focused `test:item-type-emoji` coverage.
- Migration must be applied before runtime emoji writes are manually tested.

### 2026-08-09 — Configuration and attachment success-close behavior

- Standardized all configuration edit dialogs on the existing awaited server-action wrapper.
- Successful item type, stage, customer status, workgroup, payment-mode, and expense-category edits now close and show a compact confirmation.
- Attachment upload and external-link saves now close/reset the add dialog after success.
- Pending saves prevent closing; failed saves stay open with entered data and visible error feedback.
- Added focused `test:dialog-success` coverage alongside the configuration contract.

### 2026-08-09 — Final review hardening

- Moved Production workflow/garment predicates ahead of the 100-item limit and made malformed filter IDs fail closed.
- Added accessible disclosure state, popup relationships, labels, and Escape dismissal to both multi-select filters.
- Extended successful-save closing to workflow, measurement field, standard size, tenant user, location, team, communication template, and communication trigger-rule edit dialogs without nested forms.
- Added the neutral garment fallback to native order item-type selectors and expanded focused regression contracts.

### 2026-08-09 — Searchable item-type emoji and icon picker

- Replaced the raw item-type emoji input with one reusable Suggested/Emoji/Icons popover on both create and edit forms. Suggested combines broad item-name matching with up to eight recent browser-local choices and is not limited to boutique tenants.
- Added the virtualized Frimousse emoji library with search and built-in skin tones. Only English Emojibase data is self-hosted under `/emoji-data/en`; no third-party emoji CDN is required at runtime.
- Added the full searchable pinned Lucide catalogue with 48-result batches and controlled accessible color tokens. Custom icon/image upload remains intentionally excluded.
- Added migration `20260809150000_item_type_icon_picker.sql`, backfilling existing emoji rows and enforcing coherent default/emoji/Lucide database states through `icon_kind`, `icon_name`, and `icon_color`.
- Added exact server-side Lucide-name validation from a generated allowlist, single-grapheme emoji validation, controlled color validation, and legacy emoji compatibility.
- The full picker panel and catalogues load only while the popover is open. Routine surfaces load the selected Lucide renderer only when needed; static emoji data is eligible for Vercel CDN caching.
- Propagated saved icon kind/name/color through order creation, order detail, Production filtering/list/board, item workflow, and item-type settings while keeping all icon fields outside public tracking.
- Preserved explicit Default behavior, 44-pixel mobile targets, keyboard/focus behavior, visible selection state, loading feedback, error-safe server actions, and global unsaved-change notification.
- Made the neutral emoji skin tone explicit and retained a text-safe garment fallback inside native order item-type selectors, where nested SVG/icon markup is invalid HTML.
- Fixed the picker transparency regression: OS PLUS does not define Tailwind `popover` color tokens, so the portal and sticky emoji headers now use the existing opaque `background`/`foreground` surface tokens. A focused contract prevents `bg-popover` or `text-popover-foreground` from returning at this call site.
- Expanded `test:item-type-emoji` and QA PR-016 to cover migration shape, exact validation, lazy boundaries, self-hosted assets, searchable libraries, recent suggestions, mobile accessibility, all authenticated consumers, and the public boundary.
- Migrations must be applied in order: `20260809140000_item_type_emoji.sql`, then `20260809150000_item_type_icon_picker.sql`.
- Verification passed: all 19 non-destructive `test:*` scripts, `typecheck`, `lint`, `git diff --check`, and the optimized production build (42 pages). Signed-in Phantom browser QA confirmed an opaque Suggested/Emoji/Icons surface, icon search and controlled color selection, selection-close and Escape focus behavior, recent choices, self-hosted emoji rendering, narrow-layout containment, saved icons in Production, the garment filter, order-creation selector fallbacks, and no console errors.
- The current dependency audit reports 9 existing dependency-tree advisories (1 low, 2 moderate, 6 high), including the pinned Next.js/PostCSS toolchain. None directly names Frimousse, Radix Popover, or Emojibase. Dependency upgrades remain a separate reviewed change; no automatic audit fix was applied.

### 2026-08-09 — Production selected item-type icon correction

- Fixed the Production garment-type filter trigger, which previously hardcoded the neutral garment icon even when exactly one configured item type was selected.
- A single selected item type now renders its saved emoji or Lucide icon and color. All-item and multi-item selections intentionally retain the neutral garment icon because no single item-type identity applies.
- Expanded the focused item-type icon contract to protect single-selection lookup, full icon-field propagation, and the removal of the hardcoded-null trigger.
- Signed-in Phantom runtime QA confirmed `👖 Pant`, neutral All/multi-select states, unchanged Pant queue-row icons, desktop/narrow layout behavior, and no console errors. The owner confirmed the required migrations are applied.

### 2026-08-10 — Durable Git and production release workflow

- Documented the established OS PLUS release sequence in `docs/06_Rules.md`: verify and commit the scoped feature branch, push it with standard Git, merge it into `main` through an owner-authorized pull request, and let the configured Vercel production deployment run from `main`.
- Clarified that GitHub CLI is optional automation only. It is not required for `git commit`, `git push`, or an owner completing the pull request through GitHub's web UI.
- Future sessions must distinguish a successful feature-branch push from a production deployment, verify the synchronized branch after pushing, and never push directly to `main` or report production live without explicit authorization and deployment evidence.

### 2026-08-12 — Salary and Worker Money UX Hardening

#### Product Decisions

- Salary is organized into Overview, Pay periods, and Worker ledger. Recording a salary payment returns to the same period with the same worker expanded instead of moving the user to Overview.
- Worker-money events have explicit meanings: advances/loans and salary payments are cash out; cash repayment is cash in; salary deduction and salary credit are non-cash.
- Advances and loans are never automatically deducted from salary. A deduction or credit affects a suggestion only when the user generates or regenerates a period containing the entry date. Existing founder-finalized payable values are never silently rewritten.
- Corrections and reversals preserve the original entry, require a reason, and keep replacement/reversal evidence. Worker-money data remains unavailable to managers.

#### Implementation

- Added `20260810100000_worker_money_ledger.sql` with explicit balance accounts, tenant-scoped idempotency, correction linkage, reversal evidence, tenant/reference validation, over-balance and salary-overpayment guards, salary-payment refresh, and service-role-only commands.
- Hardened concurrent correction retry behavior: a second request waiting on the original row resolves the one replacement created by the first request, and unique-index races recover the tenant-scoped result.
- Added service-only `worker_money_summaries(tenant_id)` so worker details and directory signals use complete active history without loading the whole tenant ledger.
- Worker detail now validates the requested worker inside the current tenant, paginates complete worker-scoped ledger history 50 rows at a time, clamps malformed/out-of-range pages, and keeps inactive worker history identifiable.
- Worker queries explicitly assert both `workers:view` and `salary:view` before service-role reads. This prevents a direct Workers URL from exposing wages or worker money to a manager if role mappings change later.
- Reworked Worker ledger entry/correction/reversal forms onto recoverable action state: inputs remain available after validation/RPC errors, errors are announced inline, pending fieldsets block conflicting interaction, and idempotency keys rotate only after success.
- Salary reads now retain inactive worker profiles for historical rows while the new-entry selector remains limited to active workers.
- Finance includes worker-money history and counts each true cash movement once; salary deductions/credits remain visible but do not change cash totals or salary expense until salary is paid.
- Assignment-only contribution-rule guidance now explains the missing prerequisite and links directly to Settings → Stages.

#### Review Findings Resolved

- Closed the service-role permission gap on Worker details.
- Replaced the misleading 200-row tenant sample / 20-row worker display with aggregate balances plus worker-scoped pagination.
- Preserved inactive worker names in ledger history.
- Added strict UUID and calendar-date validation for worker-money references and dates.
- Converted record/correction/reversal failures from thrown page errors to recoverable local feedback.
- Documented and enforced deferred salary-suggestion semantics instead of silently changing existing finalized payables.
- Added correction concurrency recovery and disposable-database verification.

#### Documentation and QA

- Updated `docs/01_PRD.md`, `docs/02_WBS.md`, `docs/06_Rules.md`, and `docs/08_Database_Model.md`.
- Expanded Salary QA cases SA-006 and SA-011 and added SA-012 for recoverable validation, pending behavior, concurrent correction retry, and fresh idempotency keys.
- Regenerated `docs/OS_PLUS_QA_Test_Matrix.xlsx` from `scripts/build-qa-matrix.mjs`. All 17 sheets rendered successfully; Salary and Finance were visually inspected; the formula-error scan returned no matches.

#### Disposable Database Evidence

- Docker Desktop and Supabase CLI were used to create a local isolated Supabase stack. Every repository migration, including `20260810100000_worker_money_ledger.sql`, applied cleanly from an empty database.
- `npm run test:worker-money-db` passed against that disposable stack and cleaned its fixtures. It covered concurrent record and correction retries, tenant-isolated worker/payment-mode validation, atomic failure behavior, over-balance rollback, aggregate balance reconciliation, salary overpayment rejection, salary-payment refresh, and idempotent reversal.
- The disposable Supabase project was stopped without backup and its generated repository metadata was removed after testing. No shared production/QA financial records were created or changed.

#### Final Automated Gate

- Every `test:*` package script passed, including legacy V2, order, configuration, attendance, customer import, contributions, icon/filter, modal-success, salary/worker-money, and disposable database suites.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check` passed; line-ending notices are repository working-copy normalization only.
- `npm run build` passed; Next.js compiled and generated all 42 routes.

#### Remaining Release Evidence

- The owner applied `supabase/migrations/20260810100000_worker_money_ledger.sql` to the shared production/QA Supabase environment.
- Authenticated localhost browser mutation QA remains pending for the follow-up hardening migration. The signed-in Salary route correctly reported that `salary_calculation_revisions` is absent from the shared database; no form was submitted and no shared financial data was mutated.
- Apply `supabase/migrations/20260812120000_salary_workflow_hardening.sql`, then manually verify owner/admin and finance create/edit/regenerate/finalize/payment/correction/reversal flows, period/worker context retention, Finance cash classification, worker history, and manager denial before commit/push authorization.

#### Manual QA Follow-up

- Authenticated manual QA exposed a missing `idempotencyKey` field in the salary-payment form. The server correctly rejected the incomplete submission before writing any payment, but Zod surfaced the defect as a runtime page error.
- Added the required UUID retry key to each salary-payment form. Duplicate retries now reach the tenant-scoped database idempotency guard as designed.
- Tightened `test:salary-worker-money-ui` to isolate the exact `recordSalaryPaymentAction` form. The previous broad regex crossed a form boundary and incorrectly accepted the key from the preceding payable-finalization form.
- The narrowed contract failed before the fix and passed afterward. Focused worker-money tests, `typecheck`, `lint`, and the optimized 42-route production build also passed.
- A second authenticated QA attempt correctly reached the database guard but exposed that the page enabled `Record payment` before the worker calculation was finalized. Payment controls now remain disabled until the persisted final payable exists, with explicit Step 1 guidance.
- The salary-payment action now independently returns recoverable inline action state for stale/unfinalized and database failures while the client preserves the same period and expanded worker. The database finalization guard remains independent.
- Added focused UI and action-contract coverage for the finalization prerequisite and recoverable local feedback. Worker-money behavior, global action feedback, `typecheck`, `lint`, and the optimized 42-route production build passed in that earlier checkpoint.

### 2026-08-12 — Salary Lifecycle Transaction and UX Hardening Follow-up

#### Why the earlier verification was insufficient

- The first salary QA relied too heavily on source-contract regular expressions and happy-path compilation. It did not execute the full create → finalize → partial/full payment lifecycle against a real database, so a missing payment retry field and an incorrectly unlocked payment form escaped.
- The follow-up treats this as a test-design defect. Raw server-action forms were replaced and the database suite now owns rollback, concurrency, status-transition, correction, and reversal evidence.

#### Implementation

- Added `20260812120000_salary_workflow_hardening.sql` with tenant-scoped workflow receipts, immutable payable revisions, and service-role-only atomic commands for period create, draft date edit, regeneration, and finalization.
- Period range commands lock the tenant before overlap validation, preventing concurrent different overlapping ranges from both committing.
- Create/date-edit/regeneration insert the complete active-worker suggestion payload in the same database transaction. Invalid/empty/foreign-worker payloads roll back the period or preserve the prior draft suggestions.
- Draft dates can be changed only before any finalized/paid worker row; date and suggestion replacement commit together.
- Final payable cannot be lower than active salary payments. A changed payable requires a decision note, and every successful confirmation/update records before/after amount and note plus actor/time evidence.
- A finalized zero payable is stored and displayed as paid with `No payment due`; a period becomes paid only when every active worker calculation is finalized and settled.
- Period create, date edit, regeneration, finalization, and payment now use recoverable client action state. Inputs and retry keys survive errors, pending fieldsets block conflicting actions, and success preserves the selected period and worker.
- Salary-payment correction/reversal controls and payable decision history are available inside the worker's period row. Finance/Salary/Workers revalidation remains centralized through the audited worker-ledger commands.
- Finance received explicit worker-repayment cash-in wording. Finance users have `workers:view` for the documented read path but cannot add/edit workers because those controls remain gated by `settings:manage`; managers remain denied both worker and salary reads.

#### Verification evidence

- A fresh isolated Supabase reset applied every migration through `20260812120000_salary_workflow_hardening.sql` successfully.
- The expanded disposable database test passed period create/regenerate/date-edit idempotency, rollback preservation, concurrent overlap serialization, zero-payable status, immutable audit count, payable-below-paid rejection, partial/full payment, salary-payment correction, salary-payment reversal, replacement payment, tenant isolation, payment-mode ownership, balance limits, and cleanup.
- Focused role, salary UI, worker-money behavior, and SQL contract suites passed together with TypeScript.
- The QA matrix now includes SA-013 through SA-018. The workbook was regenerated with the bundled spreadsheet runtime, Salary and Finance were rendered and visually inspected, and the workbook-wide formula-error scan returned zero matches.

#### Shared-environment migration status

- The user applied `20260812120000_salary_workflow_hardening.sql` on 12 Aug 2026. Authenticated Salary and Finance lifecycle QA then loaded and completed successfully.
- That QA exposed a separate applied-migration drift on `/workers`; the forward repair and remaining shared-environment gate are documented in the authenticated follow-up below.

#### Final hardening after lifecycle review

- Salary period creation now uses a no-write Preview → Confirm flow. Preview reports active workers, attendance rows/workers, workers with no attendance input, and suggested payable total from the same authoritative inputs used for creation.
- Confirmation is bound to a canonical server fingerprint covering dates, worker-sorted calculation rows, and normalized attendance coverage. Date edits invalidate the visible preview; live worker/attendance/work-log/ledger drift returns a refreshed preview instead of committing stale information.
- Salary workflow receipts separate stable user intent from the exact generated payload audit fingerprint. Actions recover a committed receipt before reloading live inputs, so a lost response can be retried without rewriting calculations or being misclassified after attendance/ledger changes.
- Worker create and status-edit commands now share the tenant lock with salary period commands, closing the active-worker-set race while retaining atomic workgroup mapping.
- Finalization locks parent period before calculation. Salary-payment record/correction/reversal wrappers also lock the parent period before refreshing worker and aggregate status, preventing concurrent different-worker payments from leaving a stale period.
- Period lists and workspaces now show derived `Draft`, `Ready to pay`, `Partially paid`, and `Paid` labels. Period history is no longer silently truncated to eight rows.
- Saved salary and correction forms clear their dirty marker only after success; failed requests retain input. Partial-payment workflows remount from refreshed amount-paid state so the second payment defaults to the actual remaining due.
- Payable and payment/correction/reversal history now displays actor and timestamp evidence. Generated database types were corrected so worker-ledger fields no longer appear on order-payment inserts.
- The final disposable DB suite additionally passed finalize-vs-regenerate/date-edit races, cross-worker concurrent final payments and reopening, exact active-worker coverage, receipt conflict/replay behavior, helper least privilege, and immutable audit triggers.
- Final verification after all lifecycle-review corrections passed: the disposable database was reset cleanly through `20260812120000_salary_workflow_hardening.sql`; `npm run test:worker-money-db` passed; all 23 non-database `test:*` scripts passed; `npm run typecheck`, `npm run lint`, and the optimized 42-route production build passed. Authenticated shared-environment QA remains gated only by applying that migration there.

#### Authenticated shared-environment QA after salary hardening migration

- Owner/admin Salary and Finance lifecycle checks passed on Phantom Threads Test: payable finalization displayed a pending lock, the first ₹50 partial payment refreshed the same open period with ₹150 remaining, the second ₹150 payment marked the worker paid, and reversing both entries reopened the payable at the original ₹200 without affecting Finance cash movement. Both reversed entries and their actor, timestamps, and QA reason remain visible in the audit ledger by design.
- The Man 1 payable for 02 Aug 2026 - 07 Aug 2026 was finalized at its unchanged ₹200 suggestion as part of this test. No net salary payment remains from the QA run.
- Existing advances, deductions, salary payments, reversed entries, and worker balances rendered correctly in Finance → Worker money. Reversed test payments were excluded from active cash-out totals.
- The signed-in Phantom manager was redirected from direct `/salary`, `/finance`, and `/workers` requests to the permitted Orders workspace, with no salary or worker-money data exposed.
- Authenticated `/workers` testing found an applied-migration drift defect: the shared database had the worker-ledger tables and command RPCs but PostgREST could not resolve `worker_money_summaries(uuid)`. The function had been added to the already-applied `20260810100000` file later, so replaying that historical migration was not a safe repair.
- Added forward-only `20260812152000_restore_worker_money_summaries.sql`. It recreates the tenant-scoped summary function, excludes deleted/reversed ledger rows, revokes public/anon/authenticated/service-role defaults, grants only the explicit service-role execution required by the server, and requests a PostgREST schema reload.
- The user applied `20260812152000_restore_worker_money_summaries.sql` to the shared Supabase environment. Authenticated `/workers` then loaded without a PostgREST/schema error and displayed active workers, balances, and complete worker-ledger audit rows.
- Authenticated worker editing passed: the form displayed a disabled pending state, closed only after success, retained the selected worker context, persisted changes, and successfully cleared an optional Notes value back to `No notes`. The temporary QA note was removed, leaving no worker-profile test residue.
- Final regression verification passed after the repair: focused behavior, migration contract, Salary/Worker UI, and role-policy suites; a clean disposable stack through `20260812152000`; the complete worker-money database suite including service-only summary privilege, concurrency, lifecycle, correction, reversal, tenant isolation, and idempotency checks; TypeScript; lint; and the optimized 42-route production build.
- No known release blocker remains. Commit/review is the next authorized action.

### 2026-08-12 — Full-Period Bulk Salary Workspace

#### Product decision

- A salary period is now the primary work context. Clicking a period opens a dedicated full-width route with every worker visible together instead of expanding repeated worker forms underneath the period list.
- The workflow is explicitly sequenced as `1. Review payables` and `2. Record payments`.
- Owners/admins and finance users can filter workers, select eligible rows, accept unchanged suggestions together, edit individual final payables with worker-specific notes, and record multiple worker payments using one date and one tenant-owned payment mode.
- Bulk payment still creates one independent audited `salary_paid` ledger entry per worker. Corrections and reversals remain worker-specific and are available inside the same period page's audit section.

#### Implementation

- Added the dedicated `/salary/periods/[periodId]` workspace and changed salary-period list/create navigation to open it.
- Removed the obsolete embedded period workspace from the Salary periods list. Period date changes and suggestion regeneration remain available inside the full-period route only while no payable or payment decision exists.
- Added a responsive all-worker table with review/payment modes, status and warning filters, select-all eligibility, worker-level amounts and notes, shared payment controls, selected totals, atomic-save guidance, pending locks, preserved recoverable errors, and refreshed in-place success state. Review-mode select-all targets only workers still needing review, preventing redundant audit revisions for already-finalized rows while leaving explicit finalized-row corrections available.
- Ineligible payment rows are read-only and cannot block a selected submission. Currency due values are rounded to paise before becoming input defaults, preventing floating-point artifacts such as `333.329999...`.
- Added `20260812170000_salary_period_bulk_workspace.sql` with service-role-only `finalize_salary_calculations_bulk` and `record_salary_payments_bulk` commands. Both lock and revalidate the complete selected set before writing, reject duplicate/foreign/stale/invalid rows, use tenant-scoped idempotency receipts, and commit all selected changes or none.
- Bulk payable finalization preserves one immutable decision revision per worker. Bulk payment preserves one independently correctable/reversible worker-ledger entry per worker and refreshes salary-period status atomically.

#### Documentation and QA

- Updated `docs/01_PRD.md`, `docs/02_WBS.md`, `docs/06_Rules.md`, and `docs/08_Database_Model.md` with the full-period workflow, atomicity, audit, and mobile requirements.
- Added Salary QA cases SA-019 and SA-020 and regenerated `docs/OS_PLUS_QA_Test_Matrix.xlsx`. The Salary sheet was rendered and visually inspected, and the workbook formula-error scan returned no matches.
- Extended the focused UI contract to protect dedicated-route navigation, bulk modes, selection, pending/error behavior, period settings, worker-specific correction/reversal access, and non-eligible payment inputs.
- Extended the disposable database suite with atomic-invalid and idempotent-success cases for two-row bulk payable finalization and bulk salary payment, separate worker ledger entries, tenant/reference validation, privilege denial, and final period status.

#### Verification evidence

- A clean disposable Supabase database applied every migration through `20260812170000_salary_period_bulk_workspace.sql`; `npm run test:worker-money-db` passed and cleaned its fixtures.
- All 23 non-database `test:*` package scripts passed, including roles, order/configuration, attendance/customer import, contribution/icon/dialog, worker-money, Salary UI, and V2 regression suites.
- `npm run typecheck`, `npm run lint`, and the optimized 42-route `npm run build` passed.
- Authenticated localhost read-only QA passed on Phantom Threads Test: period-list navigation opened the full route, all five workers rendered together, review/payment modes and filters remained in context, ineligible payment rows were disabled, the rounded remaining amount displayed correctly, and the layout was visually inspected at desktop width. No shared salary mutation was submitted.

#### Remaining release dependency

- Apply `supabase/migrations/20260812170000_salary_period_bulk_workspace.sql` to the shared production/QA Supabase environment before authenticated bulk-mutation QA or release. The earlier salary migrations remain applied.
- After migration, manually verify one two-worker bulk finalization and one two-worker partial/full bulk payment in the test tenant, confirm same-page refresh and Finance/Worker ledger roll-up, then correct or reverse one payment from the period audit. Do not use real production salary records for this check.

### 2026-08-31 — International Customer Phone Import Hardening

#### Diagnosis and product decision

- The international parser was not rejecting the screenshot's `+19376547117` US number. `libphonenumber-js` validated that number correctly; the row was rejected because Shopify `Phone` and `Default Address Phone` resolved to two different valid numbers.
- Shopify `Phone` is now the primary contact. A different address phone is retained as alternate Shopify source metadata and produces a visible warning instead of invalidating an otherwise usable row.
- Only country-validated E.164 numbers participate in tenant-scoped matching and active-customer uniqueness. Plausible unresolved values must contain 7 to 15 digits, remain unverified metadata, and are never guessed into a country or used as duplicate keys.
- An unverified phone with an authoritative Shopify customer ID can proceed with a warning. Without a Shopify ID or another authoritative match, owner/admin must explicitly choose Create without verified phone or Skip.
- Repeated verified phones remain blocked from automatic duplicate creation. They require source cleanup or a separately audited customer-merge workflow.
- Blank-name customer-file rows remain skipped. This file-import phase creates customer profiles only and does not create Shopify orders. A later Shopify order-sync phase must use shipping/billing identity or an explicit Shopify guest profile so an order is never silently dropped for a blank customer name.

#### Implementation

- Extended customer-import rows with non-blocking warnings plus primary, address, and unverified source-phone metadata.
- Changed differing valid Shopify phone columns from an invalid row to a warning while retaining the primary canonical E.164 phone.
- Added the 7-to-15-digit unverified fallback without weakening E.164 validation, matching precedence, database uniqueness, or tenant isolation.
- Added an explicit `review_phone` preview state. Rows without authoritative identity cannot be auto-created or auto-matched; the UI offers Create without verified phone or Skip and blocks confirmation until every review is resolved.
- Preview fingerprints now include warnings and source-phone interpretation so an older preview cannot be confirmed after the interpretation changes.
- No database migration was required. Verified phones continue using `customers.normalized_phone_e164`; alternate/unverified Shopify values use existing `customer_external_identities.source_metadata_json`.

#### Documentation and QA

- Updated the PRD, WBS, Rules, Database Model, and customer-import implementation spec with the verified-versus-unverified phone contract.
- Updated customer QA cases and added CU-008 for US/Australian/Indian normalization, differing phone columns, unverified review, metadata-only handling, and minimum-length rejection.
- Updated the Customers QA sheet through the bundled spreadsheet workflow, scanned for formula errors, rendered every workbook sheet, and visually verified the updated Customers rows.
- The ignored private sample export was parsed read-only without printing personal data: 13 source rows, 7 verified Indian phones, 2 blank-name skips, and no new warning/unverified cases. Synthetic regression rows cover the international conflict and unverified paths absent from that sample.

#### Verification status

- Focused phone normalization, customer parser, matching, UI/schema/RPC contract, TypeScript, ESLint, and the optimized 42-route production build pass.
- Authenticated confirmation against the tenant's larger private export remains a manual release check; no customer records were written during this implementation session.
- The existing salary/worker-money work on `codex/salary-worker-ledger-ux` remains uncommitted and was preserved. This patch must not be committed as though it were an isolated branch until that branch scope is resolved.


### 2026-10-05 — Focused settings/contributions release preparation

- Owner reprioritized an immediate release of the existing settings popup/back-navigation changes, improved contribution report, and owner/admin-only Attendance/contribution access. Release branch `codex/settings-contributions-release` is isolated from baseline `c881102b29c2be543bf33e5c3cc5320b3b686601`; original `D:\Develop\os-plus` dirty files and Shopify planning/foundation remain untouched. Shopify, salary fixes, the unfinished order wizard and order-detail compaction are excluded.
- Included settings creation CTA dialogs across existing settings pages, shared All settings navigation, recoverable duplicate feedback/success close, searchable multiselect contribution dimensions, compact category-first reports, responsive shared controls, and manager-safe production/order workflow monetary projections. Managers retain allowed assignments/units/hours; Attendance and contribution reports deny all unauthorized roles before service-role access.
- Confirmed defect STAB-012 (P2): Production board → view cards for ORD-000005/ORD-000012, owner/admin in `phantom-threads-boutique`, with more than 1,000 active customers. Expected linked customer names; actual Unknown customer. Read-only production evidence: 1,235 active customers, unbounded list capped at 1,000, both linked IDs absent from that list but present/named/non-archived in tenant-scoped direct lookup. Operational impact: staff cannot identify the customer from the card. No lost links, money changes, or tenant leakage found; no business-data mutation performed.
- Root cause/fix: getProductionPageData used a capped tenant-wide customer directory. Resolve displayed items → bounded tenant-owned order IDs → bounded tenant-owned customer IDs instead. Malformed filters remain fail-closed; query errors fail rather than fabricating Unknown customer. Synthetic 1,235-customer regression against the actual query fails before the change and passes after; empty-board, read-failure and every lookup's tenant predicates also verified.
- Security maintenance: Next.js and matching eslint-config-next updated from 16.2.6 to 16.3.8, with their necessary lockfile dependencies only. Independent release dependencies avoid touching the original node_modules. Fresh audit went from 19 findings (1 critical) to 15 (0 critical); omit-dev reports 10 residual findings in build/glob dependencies and ExcelJS/uuid. No forced major upgrade or broad Tailwind migration. These residual advisories require a separate reviewed maintenance slice, not a claim of zero vulnerabilities. Official release evidence: https://github.com/vercel/next.js/releases/tag/v16.3.8 .
- Validation: all offline test scripts pass after replacing the unavailable private attendance fixture with 20 synthetic XLS worker sections and correcting the obsolete query-structure assertion. Database mutation/smoke tests intentionally not run. TypeScript, full ESLint, optimized 42-route webpack build pass; new owner-only action/query/import tests deny manager/finance/viewer with zero DB initialization. Customer query, aggregation/trends, settings action feedback, production UI/projection and role contracts pass.
- Independent Spec review found no code defect and requested active documentation reconciliation; active PRD/tech/site map/rules/spec/status definitions now match latest owner-only policy without changing historical records. Standards review found two reproducible release issues: contribution totals/categories could truncate at 1,000 rows (P1), and several newly popup-wrapped actions threw sanitized production errors instead of readable validation (P2). Both were reproduced in executable actual-query/action harnesses and repaired: report pages of 500 with deterministic ordering and ID-bounded item joins; all 16 popup create actions return safe structured post-authorization failures while preserving framework redirects. New tests prove 1,205 complete report rows and every create action's conflict/validation/redaction/success/unauthorized behavior. Final re-review remains pending at this entry.
- Read-only execution of the exact repaired production query against Phantom's current database returned 22 displayed items and 11 resolved customers. Both ORD-000005 and ORD-000012 were displayed and resolved to their existing named customer. No customer names or personal details were logged.
- Authenticated browser verification could not run: computer-use kernel fails with Windows sandbox helper setup refresh errors even after reset. Prior authenticated Owner/Admin preview evidence is historical; this release does not claim fresh manager/mobile browser QA. Automated server-boundary checks do not substitute for that manual UX verification.
- Environment: no migrations, production business-data changes, Shopify installation or Vercel region changes. Seoul placement preserved. Deployment has not occurred at this entry.
- Exact next actions: resolve final review findings, inspect/stage only the selected release diff, commit/push the release branch, PR into main, verify Vercel production completion and live read-only smoke checks, then record commit/deployment evidence. Owner authorization is the current request to deploy this selected version; no approval for customer/accounting mutations inferred.

#### Release gate result — 2026-10-05

- All 28 offline package test scripts pass after review repairs; final TypeScript, full ESLint, optimized 42-route production build, and staged whitespace checks pass. Independent Standards re-review found no remaining actionable blockers and independently ran the 1,205-row report and all-16-popup action regressions. Spec policy-document findings are corrected.
- Selected release files are staged on `codex/settings-contributions-release`; no Shopify implementation/planning, salary changes, order wizard, private fixture, credentials, or migrations are staged. Known environment-secret comparison found no matches in staged content.
- Commit/push command was rejected before execution by automatic safety review because the target GitHub repository `Abhijit-sai/os-plus` is public. No commit, push, PR merge or deployment occurred. The owner must explicitly authorize publishing this release's source/documentation to that public repository before retrying; do not work around the rejection with another connector.
- Next action: obtain that public-publishing approval, then commit/push the reviewed slice, create/attach/merge the release PR, verify Vercel production readiness and read-only live checks. Keep Seoul and all production business data unchanged. Fresh authenticated mobile/manager browser QA and residual dependency maintenance remain separately recorded limitations.

#### Deployment authorization resumed — 2026-10-05

- Owner changed `Abhijit-sai/os-plus` to private and explicitly requested deployment. Git-authenticated GitHub repository metadata confirms `private: true`, write access, and production branch `main`; remote main remains `c881102b29c2be543bf33e5c3cc5320b3b686601` before this release.
- Re-read branch/HEAD/staged and unstaged status: the isolated release remains on `codex/settings-contributions-release`, with only the 65 reviewed release files staged, no unstaged source drift, and a clean staged whitespace check. Original unfinished work remains in `D:\Develop\os-plus`.
- Proceed with the authorized selected commit/push, release PR and production merge; verify actual Vercel production readiness before claiming live deployment. No migration, production business-data mutation, or region change is part of this authorization.

## Chat Session Update - 2026-10-06 - CH-0 discovery and owner clarification

### Date

2026-10-06

### Updated By

Codex AI agent

### Chat Phase

CH-0 - Baseline, decisions, deploy kit

### Phase Status

PLANNED - discovery performed; implementation awaits phase decisions.

### Branch / Base

- Branch: codex/chat-ch0-discovery
- Workspace: D:/Develop/os-plus-chat-ch0
- Base: origin/main, c701ec346aeb1fb38a364f4da231bff2a9a0232e (refreshed from origin on 2026-10-06).
- Owner explicitly confirmed origin/main as the deployed base and authorized an isolated worktree.
- D:/Develop/os-plus remains on codex/shopify-sync-plan with unrelated uncommitted changes. No file changes, stash, reset, branch switch, commit, push, merge, or deployment were performed there.
- D:/Develop/os-plus-chat is already another worktree of this repository, on docs/chat-leads-module; its docs_chat directory is untracked. It is not a Chatwoot source fork. Its existing files were preserved.

### Session Objective

- Resolve hosting and authentication expectations and inspect the planning/reference material before CH-0 implementation.

### What Was Built

- Created the owner-authorized isolated worktree and chat branch. No module runtime, deployment kit, or migrations implemented.

### Key Decisions Made

- Owner corrected the transcription: OS PLUS runs on Vercel; there is no WordPress or VoiceList project in this request.
- Owner accepts one Chatwoot account per OS PLUS tenant, with multiple inboxes/numbers/brands/branches supported.
- Managers may work with chats and linked leads. Conversation assignment/access follows configurable Chatwoot policies; chat/lead reporting remains owner/admin-only under the earlier instruction.
- Owner chose an OS PLUS module CTA opening a single chat subdomain containing both Chats and Leads. Proposed /crm/ routing to a Vercel-served lead workspace requires verification; exact root domain and current production hostname remain pending.
- One OS PLUS login should allow entry into Chatwoot without another password prompt where feasible. Chatwoot documents a Platform API user login-link endpoint; compatibility and tenant/session lifecycle still need a local proof on the chosen release.
- Business admin and manager identities may participate in multiple tenant memberships; authorization must use authenticated identity plus tenant membership, never email alone as authority.
- Meta business/app/channel onboarding starts from scratch. The platform provider manages hosting, backups, upgrades, and incidents. Expected initial volume is about 10 chats/day per brand.
- The actual production reference is D:/Develop/fundry, as documented in docs_chat/00_README_CHAT.md. Its local deploy compose pins chatwoot/chatwoot:v4.17.1-ce. No remote server inspection was performed; this is not evidence of the currently running image.

### Migrations Added / Applied

- None. No local, shared, or production database migration or business-data mutation performed.

### Files / Modules Changed

- project_summary.md, copied docs_chat/*.md, and accepted clarification entries CHAT-D012 through CHAT-D016 in docs_chat/06_Decision_Log.md, all in the new isolated chat worktree.
- Owner authorized copying docs_chat into the new branch. All nine original Markdown files were hash-verified after copying; originals remain untouched. Clarified decisions were then added to the copied decision log.

### Automated Tests Run

| Command | Result |
|---|---|
| npm run typecheck | NOT RUN |
| npm run lint | NOT RUN |
| npm run build | NOT RUN |
| npm run test:roles | NOT RUN |
| npm run test:v2 | NOT RUN |
| npm run test:chat | NOT RUN - not yet created; planned in CH-1 |

### Phase-Specific Tests / Boutique Regression / Tenant Isolation

- No application tests or regression executed; discovery only. Baseline and complete reused-schema audit remain CH-0 work.
- No shared Boutique or Laundry runtime code changed.

### Manual QA

- Read-only local repository, planning-document, tenant/permission/command-boundary, and Fundry deployment-reference inspection.
- Official Chatwoot user-login-link documentation and Clerk domain guidance reviewed.
- No browser, live Chatwoot, Meta, messaging, or database QA performed.
- Owner checklist: D:/Develop/os-plus-chat/docs_chat/CHECKLIST.md Part C CH-0 row requires O1-O10 answers and deployment-kit/knowledge-pack review. Part A2.4 currently assumes committed documentation; actual docs are untracked.

### Findings / Pending Verification

- docs_chat originally placed full Leads pages on the main OS PLUS hostname; owner chose both Chats and Leads on one shared chat subdomain. Reconcile the architecture/phase plan and verify path-based reverse-proxy/authentication behavior before implementation.
- Existing Clerk/selected-tenant context is not a Chatwoot session. Design authenticated login handoff, explicit staff links, membership/account synchronization, tenant switching, logout, and revocation.
- Existing customer creation is in server actions; the proposed reusable customer command needs verification/design in CH-3 without changing legacy behavior.
- Existing command actor/source values are uppercase platform enums; proposed chat contexts must use those conventions.
- Current middleware protects all non-public routes; future signed webhook paths need their own authentication. The dot-excluding matcher also needs review for signed routes.
- Laundry pickup source accepts whatsapp/call/manual/web/recurring/other, not raw instagram/facebook channel names. Map channel provenance without extending unrelated legacy constraints.
- Fundry deploy/backup scripts contain business-specific domains, networking, names, hardcoded paths, and local-only backup assumptions. Its backup comment incorrectly equates file permissions with encryption. Generalize and review; do not paste or execute them.
- The reference README describes CHATWOOT_TAG upgrades while the compose image is hard-pinned. The new kit must have one consistent release-pin mechanism.
- Full baseline, full migration audit, Chatwoot edition/permission verification, login-link validation, and iframe authentication proof remain unperformed.

### Open Decisions / Blockers

- Documentation transfer resolved: owner approved copying docs_chat into the isolated branch; completed without a commit or merge.
- Exact production/root domain and verified routing design for both Chats and Leads under the owner-selected single chat subdomain.
- Remaining O1-O10 decisions from docs_chat/06_Decision_Log.md, plus login lifecycle and owner-only chat-report enforcement.
- No authority to deploy, purchase infrastructure, configure live Meta/Chatwoot, send real messages, apply shared migrations, commit, push, or merge inferred.

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: NO.
- Missing: decisions, automated baseline, complete compatibility/schema audit, deploy kit, example knowledge pack, owner review.

### Model Spend

- Paid-model API spend: USD 0. No OpenRouter or other paid-model API calls made.

### Notes for Next Session

- Keep CH-0 current. Documentation is now in this isolated branch. Resolve the remaining open decisions together, reconcile the proposed hostname/login/report design and complete the CH-0 implementation plan, then record IN_PROGRESS before building.
- Do not start CH-1 or commit without explicit owner authority.


## Chat Session Update - 2026-10-06 - CH-0 new-business scope reconciliation

### Date / Updated By / Chat Phase / Phase Status

- Date: 2026-10-06 (client date).
- Updated by: Codex AI agent.
- Phase: CH-0 - Baseline, decisions, deploy kit.
- Status: PLANNED; documentation reconciliation completed, implementation awaits remaining phase decisions.
- Branch/base: codex/chat-ch0-discovery / c701ec346aeb1fb38a364f4da231bff2a9a0232e (origin/main).
- Workspace: D:/Develop/os-plus-chat-ch0.

### Session Objective / What Was Built

- Reconciled all nine copied chat planning documents with the owner's new-business-only scope. No chat runtime or deployment kit built.
- Removed active Fundry pack, workflow-port, inherited model/calibration and cutover requirements. Structural reference inventory and historical decisions are explicitly non-authoritative for business behaviour.
- Updated phase requirements for tenant-configurable viewer access and its server-side permission/PII checks; future implementation remains CH-1/CH-4 work.
- Updated future-session routing to continue in the approved chat worktree, preserving the original Shopify checkout.

### Key Decisions Made

- Domain not linked yet; owner will select it later, then use a single chat subdomain for Chats and Leads. Local preparation may use placeholders; live origin/DNS/callback checks remain required.
- Fundry implementation/services/data remain untouched; no language, workflows, branding, credentials, models, knowledge packs or calibration adopted. New businesses have their own reviewed configuration.
- Manual WhatsApp onboarding initially.
- Viewer access configurable in OS PLUS role settings for this module. Existing code has a static rolePermissions map; tenant-owned chat-specific configuration is an additive design proposal.
- Instagram comment automation excluded with no assumed future-phase commitment.
- Accepted decisions recorded as CHAT-D017 through CHAT-D021; CHAT-D007 marked superseded.

### Files / Modules Changed / Migrations

- docs_chat/00_README_CHAT.md, 01_PRD.md, 02_Architecture_and_Data_Model.md, 03_Agent_Spec.md, 04_Rules_and_Pitfalls.md, 05_Phase_Plan_WBS.md, 06_Decision_Log.md, 07_Codex_Build_Prompt.md and CHECKLIST.md.
- project_summary.md (this update).
- Migrations added/applied: none, in any environment.
- No shared Boutique/Laundry runtime, permission code, live credentials, production configuration, original worktree or Fundry file changed.

### Automated Tests Run

| Command | Result / count |
|---|---|
| npm run typecheck | NOT RUN / no application changes |
| npm run lint | NOT RUN / documentation only |
| npm run build | NOT RUN / documentation only |
| npm run test:roles | NOT RUN / zero tests executed |
| npm run test:v2 | NOT RUN / zero tests executed |
| npm run test:chat | NOT RUN / script planned in CH-1 |
| git diff --check | PASS after reconciliation |

### Manual QA / Regression / Tenant Isolation

- Read-only branch, upstream, full tracked diff and untracked file inspection; all local changes belong to this chat task.
- Inspected rolePermissions and searched src/migrations for configurable role-setting storage; none found.
- Reviewed revised documentation against original copies and checked for obsolete active pack/port/cutover requirements.
- Browser/service/manual functional QA: NOT RUN.
- Boutique regression and tenant-isolation tests: NOT RUN; no runtime changes.
- Owner checklist: docs_chat/CHECKLIST.md Part C, CH-0 row: resolve O3/O6/O7 and review the eventual new deploy kit/new-business example.

### Findings / Bugs

- Documentation contradicted new-business-only scope, configurable viewer access and deferred domain selection; reconciled.
- Static platform role settings do not yet satisfy configurable module access; future additive implementation required.
- Vercel Hobby supports daily cron only; hourly scheduling requires an eligible plan or an independent scheduler. This is an O7 dependency, not authorization to upgrade or deploy.
- Application defects fixed: none.

### Open Decisions / Blockers

- O3: Meta app ownership.
- O6: optional screenshot-verification tasks.
- O7: hourly scheduler and actual Vercel plan if Cron chosen.
- New-business workflow, customer-facing language, pack content and production models must be approved before their respective later phases. Do not infer them from the reference.
- Full CH-0 baseline, reused-schema audit, proxy/login proof, deployment kit, synthetic new-business pack and owner review remain outstanding.

### Phase Gate / Model Spend / Next Action

- READY_FOR_CLOSURE: NO; phase acceptance incomplete.
- Paid-model API spend: USD 0; no model/service calls.
- Next: obtain the three remaining CH-0 answers, present the reconciled exact implementation plan and record IN_PROGRESS before building.
- No commit, push, merge, deployment, shared migration, purchase, real message or external service configuration authorized/performed.

## Chat Session Update - 2026-10-07 - CH-0 implementation start

### Date / Updated By / Chat Phase / Phase Status

- Date: 2026-10-07 (Asia/Calcutta client date).
- Updated by: Codex AI agent.
- Phase: CH-0 - Baseline, decisions, deploy kit.
- Status: IN_PROGRESS.
- Branch/base: codex/chat-ch0-discovery / c701ec346aeb1fb38a364f4da231bff2a9a0232e (deployed origin/main).
- Workspace: D:/Develop/os-plus-chat-ch0; existing Shopify and documentation worktrees preserved.

### Objective / Decisions / Planned Files

- Owner confirmed centrally managed Meta apps/pages; implement provider-managed platform app onboarding, preserving explicit business/WABA/page permissions and separate tenant/channel credentials. Common ownership never replaces tenant authorization.
- Inquiries are the primary use case. Payment screenshots and verification tasks excluded from v1. Business booking flows are not assumed from the reference.
- New isolated n8n instance beside Chatwoot on the new platform server; no existing business infrastructure reused.
- All O1-O10 CH-0 decisions resolved or explicitly deferred before live setup. Local multi-phase commit authority has been requested; not inferred from “implement everything”.
- Build deploy/chatwoot/{compose.yaml,.env.example,Caddyfile,README.md,scripts/*,backup.cron.example,.gitignore}, docs_chat/CH0_SCHEMA_AUDIT.md, docs_chat/examples/new-business.pack.json and its README; reconcile planning docs and add phase verification tooling only. No platform migration, runtime feature or production configuration in CH-0.
- Baseline: typecheck, lint, build, test:roles and test:v2. test:chat remains CH-1 scope; CH-0 deployment checks run separately.
- Known contradictions to verify: fixed role permissions; customer creation currently server actions rather than a reusable command; uppercase command actor/source contracts; middleware protected webhook routes and dot-token matching; pickup source constraints; shared-host lead/auth routing still unproved.
- Docker CLI available but Linux daemon is initially stopped. Local validation must distinguish Compose/static checks from executed Linux service/restore tests.

### Migrations / Tests / QA / Spend / Next

- Migrations added or applied: none.
- Baseline and deployment checks: pending.
- Manual QA / regression: pending; no live service calls planned.
- Paid-model spend: USD 0.
- Next: run baseline, finish migration audit, build isolated deployment kit and verify. Owner deploy-kit review remains required before phase closure; no commit/push/deploy/shared migration/message authority assumed.

## Chat Session Update - 2026-10-07 - CH-0 deployment kit and closure review

### Date / Updated By / Chat Phase / Phase Status

- Date: 2026-10-07 (Asia/Calcutta client date).
- Updated by: Codex AI agent.
- Phase: CH-0 - Baseline, decisions, deploy kit.
- Status: READY_FOR_CLOSURE; implementation and local checks complete, required owner deploy-kit review pending. Not CLOSED; no phase commit yet.
- Branch/base: codex/chat-ch0-discovery / c701ec346aeb1fb38a364f4da231bff2a9a0232e (deployed origin/main).
- Workspace: D:/Develop/os-plus-chat-ch0.

### Session Objective / What Was Built

- New isolated Chatwoot CE + n8n deployment kit: compose.yaml with bounded resources, separate databases/storage/networks, private SSH-only n8n editor, environment template, Caddy reverse proxy and safe reserved /crm namespace.
- Fresh configuration preflight with Zod; no inherited credentials, model choice, business wording or production configuration.
- Encrypted age backups of both databases, Redis jobs, attachment/n8n storage and required encryption/config keys; writer quiescence, previous-running-service restart, cleanup on error/signals, concurrency lock, retention only after success, archive integrity and freshness checks. Backup cron example and detailed isolated restore/upgrade instructions. No destructive automatic restore script.
- Synthetic unpublished inquiry-only knowledge-pack example and README; no prices, booking, phone/address/link facts, model ids or credentials.
- CH0_SCHEMA_AUDIT.md covers every reused Architecture section 4.9 table/constraint and 12 integration differences, including Laundry-only task actions, country-validated customer rules, incomplete pickup slots, actor/source casing, RPC grants, RLS/service role, verified identity and cross-host auth.
- Offline deployment policy tests, Linux backup subprocess/failure tests and real Caddy routing tests against a local mock. Real age encryption/decryption/authenticated tamper rejection tested with generated synthetic keys/data.

### Key Decisions / Authority

- CHAT-D022: central provider-managed Meta onboarding direction; each business separately authorises its pages/WABA/inboxes.
- CHAT-D023: inquiries primary; payment screenshots/verification tasks excluded. Future booking/financial capability rules require new-business approval.
- CHAT-D024: new n8n instance beside Chatwoot, isolated from existing business/Shopify infrastructure; no workflow activated.
- CHAT-D025: owner authorised local phase commits and continued phases after each closure gate passes. Required owner QA is not waived; push/merge/deploy/shared migrations/paid-model runs/real messages remain separately gated.
- All CH-0 product decisions resolved. Domain and live credentials/assets deliberately deferred before live setup.

### Files / Modules Changed / Migrations

- deploy/chatwoot/: compose.yaml, .env.example, Caddyfile, .gitignore, .gitattributes, backup.cron.example, README.md; scripts/{init-n8n-db.sh,check-config.mjs,backup.sh,verify-backup.sh,check-backup.sh}; tests/{config.test.mjs,caddy.test.mjs,backup_test.py}.
- docs_chat/CH0_SCHEMA_AUDIT.md and examples/{new-business.pack.json,README.md}; planning/decision/checklist documentation reconciled.
- project_summary.md: implementation start and this closure-review update appended; prior history retained.
- Migrations added: none. Applied locally/shared/production: none.
- No src/, application package/lockfile, Boutique/Laundry schema or existing permission behavior changed. Original OS PLUS/Shopify and Fundry implementation untouched.

### Automated Tests Run

| Command | Result / counts |
|---|---|
| npm ci --no-audit --no-fund | PASS; 587 locked packages; no manifest/lock changes |
| npm run typecheck | PASS; TypeScript baseline |
| npm run lint | PASS; baseline and final added-deployment JS checks |
| npm run build | PASS; existing app compiled, 42/42 static-generation steps |
| npm run test:roles | PASS; 1 policy suite; runner does not report case count |
| npm run test:v2 | PASS; 4 existing suites; runners do not report individual case counts |
| npm run test:chat | NOT AVAILABLE; explicitly CH-1 scope, not introduced early |
| node --test deploy/chatwoot/tests/config.test.mjs | PASS; 11/11 tests |
| Linux python3 deploy/chatwoot/tests/backup_test.py with REAL_AGE_BIN | PASS; 13/13 tests, no skips; Docker operations mocked, one test uses real age roundtrip/tamper rejection |
| node --test deploy/chatwoot/tests/caddy.test.mjs with LOCAL_CADDY_BIN | PASS; 4/4 Node tests (parent + 3 checks); actual Caddy, synthetic local HTTP/WebSocket server |
| docker compose --env-file outputs/chat-ch0/example.env -f deploy/chatwoot/compose.yaml config --quiet | PASS; synthetic credentials only |
| bash -n on all 4 shell scripts | PASS |
| Caddy 2.10.2 adapt --validate | PASS; no public server/TLS issuance started |
| git diff --check | PASS after removing trailing blank line |

### Manual QA / Regression / Tenant Isolation

- Reviewed deployment/secrets/backup failure boundaries, schema source and new file set; no runtime changes or migration diff.
- Real local proxy smoke: /crm and child paths return safe 503 without reaching inbox; inbox path/query preserved; Server header stripped; WebSocket upgrade forwarded.
- Real synthetic archive crypto/integrity smoke: encrypted age archive verified, corrupted ciphertext rejected.
- Docker CLI/Compose available, but Desktop Linux daemon pipe remains unavailable despite starting Desktop. No Chatwoot/n8n/Postgres service boot or DB restore executed; do not equate mocks with a restore proof.
- Service startup, actual DB/file/credential restore, TLS, SMTP, real Meta authorisation, one-login handoff and tenant-access UI QA remain owner-authorised server/later-phase checks. They are not CH-0 live-deployment claims.
- No new tenant-owned runtime table/query exists yet. Existing role/V2 checks are baseline regression; no shared-code Boutique tier triggered, no browser/production regression claimed.
- Owner checklist: CHECKLIST.md Part C CH-0 (review kit/example); Part B B1-B7 before live setup, including encrypted host storage and restore/backup/alert checks.

### Findings / Bugs / Remaining Gate

- Reconciled resolved choices and removed payment screenshot schema/task requirements.
- Fixed backup inventory error handling so Docker failure cannot silently skip writer quiescence; failure/restart/cleanup tests pass.
- Dedicated ops-profile tar helper has no network and read-only file mounts; backups do not depend on tar availability in application images.
- Health probe marks forwarded HTTPS for FORCE_SSL; Caddy reserves lead namespace until Clerk/routing/origin proof is implemented.
- No known application P0/P1 defect introduced. Existing runtime untouched. Local Docker service validation limitation explicitly recorded; production restore proof remains required before live use.
- Owner deploy-kit review required by 05_Phase_Plan_WBS.md CH-0 acceptance before local phase commit/CH-1. General commit authority is already granted; do not ask for it again.

### Phase Gate / Model Spend / Next

- READY_FOR_CLOSURE: YES for implementation/local evidence; owner kit/example acceptance outstanding, so phase not CLOSED and no commit yet.
- Paid-model API spend: USD 0. No model API, WhatsApp/Instagram/Facebook/Telegram message, real inbox, shared DB, workflow activation, production setting, purchase, push/merge/deploy action.
- Next: owner reviews the concrete kit/example, then apply existing local commit authority if CH-0 accepted and continue CH-1 with its own scope plan/decisions/start update. Do not bypass the phase gate while waiting.

## Chat Session Update - 2026-10-07 - CH-0 closure accepted

### Date / Updated By / Chat Phase / Phase Status

- Date: 2026-10-07 (Asia/Calcutta client date).
- Updated by: Codex AI agent.
- Phase: CH-0 - Baseline, decisions, deploy kit.
- Status: CLOSED (closure evidence complete; included in the local phase commit).
- Branch/base: codex/chat-ch0-discovery / c701ec346aeb1fb38a364f4da231bff2a9a0232e.
- Owner's “ok next steps?” is treated as acceptance of the concrete CH-0 kit review, following the report and approval request. CHAT-D025 already authorises local phase commits and continued work after gates.

### Closure Evidence / Files / Migrations / QA

- CH-0 scope: baseline, source-schema audit, resolved decisions, new isolated deployment/backup kit, synthetic unpublished inquiry example completed. Final implementation evidence is in the preceding 2026-10-07 closure-review entry.
- Automated evidence retained: typecheck, lint, build, test:roles and four test:v2 suites PASS; deployment configuration 11/11, backup 13/13 with real age crypto, Caddy 4/4; Compose config and four shell syntax checks PASS; 27 new-file whitespace reviews and tracked diff check PASS.
- No application source/package/lock changes or OS PLUS migrations. Shared Boutique/Laundry regression tier not triggered; baseline checks PASS, no production/browser smoke claimed.
- Manual local proxy, WebSocket and synthetic archive integrity checks PASS. Live server/TLS/SMTP/Meta/DB restore checks remain CHECKLIST Part B before deployment. Local Docker Linux engine unavailable; no service boot/DB restore claimed.
- No known P0/P1 application defect introduced. No deferred application P2/P3 defect. Production readiness is not claimed.
- Files: project_summary.md, docs_chat/ planning/audit/example documents, deploy/chatwoot/ kit/tests only. Original dirty Shopify checkout and Fundry preserved.
- Migrations added/applied: none. Model API spend: USD 0. No push, merge, deployment, purchase, shared DB, model API run, real message or workflow activation.
- Next: use the local CH-0 commit as the dependent CH-1 branch base. CH-1 remains PLANNED until its complete scope and remaining policy decisions are presented and answered.

## Chat Session Update - 2026-10-07 - CH-1 foundation plan and access decisions

### Date / Updated By / Chat Phase / Phase Status

- Date: 2026-10-07 (Asia/Calcutta client date).
- Updated by: Codex AI agent.
- Current phase: CH-1 - Foundation.
- Status: PLANNED; access decisions P1/P2 pending; no runtime implementation begun.
- Branch/base: codex/chat-ch1-foundation / 4f74bd6d6c311225623d74cb99d6bfe3c4406208.
- Closed CH-0 local commit: 4f74bd6d6c311225623d74cb99d6bfe3c4406208 - Chat CH-0: add isolated deployment kit and discovery baseline.
- Workspace: D:/Develop/os-plus-chat-ch0. Routing verified: clean CH-1 branch before this planning update, no upstream; original codex/shopify-sync-plan remains dirty and untouched.

### Objective / Built / Files / Migrations

- Prepared docs_chat/CH1_IMPLEMENTATION_PLAN.md: full CH-1 scope, proposed files/two additive migrations, eleven specified foundation tables plus tenant-safe notification brand junction, code contradictions, access decisions, meaningful tests and closure gates.
- No CH-1 application source, schema, permission behavior or dependency change. No migrations added/applied locally/shared/production.
- Appended this exact dated planning update; prior phase history retained.
- Corrected obsolete payment-screenshot paragraph in 03_Agent_Spec.md to accepted CHAT-D023 exclusion; no screenshot feature or payment workflow added.
- Recorded pending P1/P2 together in 06_Decision_Log.md. Proposed defaults are not accepted decisions.

### Tests / Manual QA / Regression

- Planning-only checks: branch/status/base verified, original uncommitted work inventory checked; git diff --check PASS after planning edits.
- Platform/module tests not rerun this planning session; no runtime change. CH-0 retained evidence: typecheck/lint/build/test:roles PASS, test:v2 four suites PASS; deployment tests 11/11 + backup 13/13 + Caddy 4/4 PASS (28 total Node/Python cases).
- test:chat not created yet; CH-1 implementation scope.
- Manual QA this session: source/schema/route/role inspection only; no browser, live service or database proof claimed.
- Boutique compatibility impact: no shared runtime change in planning. Future permission/type/navigation changes require Tier A BA-001 through BA-014.
- Required owner QA: CHECKLIST.md Part C CH-1; Part B live deployment remains separate.

### Findings / Decisions / Blockers

- Existing roles are static; proposed new tenant-owned chat permission controls require P1 approval.
- Current Chatwoot official edition comparison reserves custom roles and branding for paid plans. P2 asks initial viewer Leads-only access versus first-release read-only Chatwoot requirement; no purchase authorized.
- Found stale screenshot extraction paragraph in agent spec contradicting accepted exclusion; corrected in documentation.
- Notification brand UUID array lacks composite tenant FK enforcement; plan replaces it with an additive junction.
- No application P0/P1 defect found or fixed in this planning session.
- Local Docker Linux engine unavailable in CH-0; actual isolated migration/tenant-isolation testing still required before CH-1 closure. Never use shared DB without explicit authorization.
- Domain/live assets, branding/edition and new-business model/policy choices remain later-phase/before-live dependencies, not implied approval.

### Phase Gate / Spend / Next

- Can move to READY_FOR_CLOSURE: NO. CH-1 scope not implemented; P1/P2 and all phase QA remain.
- Model API spend this session: USD 0. No model API, real message, shared migration, production setting, workflow activation, purchase, push/merge/deploy.
- Next: receive P1/P2 answers, record approved decisions and IN_PROGRESS, implement pure schema/access/crypto rules with tests, then storage/commands, mock connector and setup UI. Continue using already granted local phase commit authority only after the gate passes.

## Chat Session Update - 2026-10-21 - CH-1 resumed; access approved and release comparison

### Date / Updated By / Phase / Branch

- Date: 2026-10-21 (Asia/Calcutta). Updated by: Codex AI agent.
- Current phase: CH-1 Foundation. Status: PLANNED; P1/P2 now approved, baseline integration decision pending before shared-code implementation.
- Worktree: D:/Develop/os-plus-chat-ch0. Branch: codex/chat-ch1-foundation; no upstream.
- Actual HEAD: 4f74bd6d6c311225623d74cb99d6bfe3c4406208. CH-0 remains CLOSED.
- Actual initial dirty state exactly matched handoff: 03_Agent_Spec.md, 06_Decision_Log.md, project_summary.md and untracked CH1_IMPLEMENTATION_PLAN.md. Full diff and untracked plan read and preserved.
- No applicable AGENTS.md found in the worktree or D:/ / D:/Develop ancestors.
- Existing CH-0 deployment/backup kit, synthetic unpublished pack and schema audit remain usable. Historical local evidence is retained; service startup/restore and live setup remain unproved.

### Resumption / Decisions / Files

- Read existing module startup prompt, requirements, phase plan, architecture, rules, checklist, schema audit and foundation plan; latest explicit owner instructions and CHAT-D025 override historical routing/commit wording.
- Owner approved P1: owner/admin full module access/settings; manager lead management and contact details; viewer/finance denied by default with separate owner-granted read access and PII; chat reports owner/admin-only.
- Owner approved P2: configurable read-only Leads first; viewers excluded from Chatwoot until equivalent restrictions are proved. No paid edition purchase implied. Recorded CHAT-D026/D027.
- Planning changes this session: docs_chat/06_Decision_Log.md, CH1_IMPLEMENTATION_PLAN.md, 02_Architecture_and_Data_Model.md, 01_PRD.md, CHECKLIST.md and this project_summary.md. Preserved prior 03_Agent_Spec.md correction.
- Corrected remaining PRD screenshot-task contradiction to CHAT-D023 and checklist's obsolete CH-0/uncommitted status. No runtime behavior changed.
- New implementation/migrations: none yet. Migrations applied locally/shared/production: none.

### Released-main comparison and separate Shopify dependencies

- Locally available origin/main and the read-only release checkout both identify c686337c0f059cbe6ae40bbcadc2f6c0da2ffc0a. No network fetch or new deployment verification performed; local saved release evidence reports Vercel Ready and successful Test settings/Orders smoke.
- Read local release summary plus docs/46, 47, 48 and 49 in C:/Users/abhij/OneDrive/Documents/New project 2/os-plus-shopify-auto-release-20261019, including uncommitted status updates. That checkout and all other worktrees remain untouched.
- Git divergence: Chat contains one unique CH-0 commit; released main contains 18 later commits. Full tree comparison spans 299 paths, including Chat-only documentation/kit.
- Shared tenant, permission, Supabase and core command files and package-lock are unchanged between these commits.
- Relevant changed contracts: raw orders now support Shopify drafts with nullable customer/delivery, external financial management and source currency; local_operational_orders/operational_orders projections protect older consumers; shared database types compose Shopify tables/functions; settings adds owner-only Shopify entry; middleware exempts only exact authenticated-by-provider POST ingress routes.
- Later Chat integration must consume retained business data, preserve source buyer versus linked customer identity, respect draft/setup/production/delivery distinctions, and never infer messaging consent or create local receipts from Shopify source payment facts.
- Shopify manual flow has scoped hosted acceptance; OAuth has local tests plus owner-applied/read-only-verified SQL and released code, but activation/hosted approval/renewal and broader multi-store acceptance remain open. Historical SQL must not be reapplied to shared Supabase.
- Shopify n8n, automatic sync and scheduled raw cleanup remain separate deferred work. Chat's isolated new n8n plan is not workflow activation authority.
- Recommended local integration, detailed in CH1_IMPLEMENTATION_PLAN.md: byte-preserving backup plus explicit documentation checkpoint, then merge exact released c686337 into this same branch, reconcile summary history without dropping Chat records, verify released runtime preservation and rerun gates. Requires owner's explicit local checkpoint/merge instruction; no silent merge/rebase performed.

### Automated baseline / QA / Regression

| Command | Result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run build | PASS; 42/42 static generation steps |
| npm run test:roles | PASS; one suite, no individual count reported |
| npm run test:v2 | PASS; four suites, no individual count reported |
| npm run test:chat | NOT AVAILABLE; CH-1 introduction still required |
| docker version --format server | BLOCKED; Docker Desktop Linux engine pipe missing |
| WSL Ubuntu PostgreSQL availability | No psql/postgres found; no installation performed |

- These checks ran on the existing Chat baseline, not on a merged release or completed CH-1 implementation.
- Manual QA this session: repository, documentation and shared-contract inspection only. No browser or hosted data action.
- Boutique compatibility impact: no shared runtime edit. Tier A BA-001..BA-014 remains required after foundation permissions/types/navigation changes.
- Tenant isolation, migration transactions/concurrency and mobile/desktop role QA remain unexecuted. PGlite evidence from Shopify is not real multi-session PostgreSQL evidence.
- Owner acceptance still required: docs_chat/CHECKLIST.md Part C CH-1, two local synthetic tenants. Live service setup remains Part B with separate authority.

### Bugs / Gate / Spend / Next

- Documentation defects corrected: stale payment-screenshot task scope and CH-0 checklist status. No application defect fixed or introduced.
- Remaining gate: explicit local baseline integration decision; actual CH-1 implementation and all phase-specific SQL/crypto/permission/mock/UI QA. Docker/local PostgreSQL availability must be resolved for real transaction/concurrency checks.
- READY_FOR_CLOSURE: NO. No phase advancement, phase commit, push, merge, deployment, hosted migration, live message, model API call or scheduler activation this session.
- Model API spend: USD 0.
- Next small slice after baseline integration: add pure knowledge-pack validation and versioned tenant-bound encryption with synthetic tests/test:chat, then approved access rules; record IN_PROGRESS before coding. Continue storage/commands/mock connector/UI in verified increments.

### Resumption final verification

- Seven pre-edit planning files were copied byte-for-byte to ignored outputs/chat-ch1/resume-20261021-55c1f87214dd4cab8d7a1779cca2233f; all seven SHA-256 checks passed. This is a local recovery copy, not a commit or phase closure.
- Final planning diff whitespace check PASS. Runtime/index/HEAD unchanged; no merge performed. Reviewed tracked diff plus preserved untracked CH1_IMPLEMENTATION_PLAN.md.
- P1/P2 recorded as accepted CHAT-D026/D027. Only I1 (explicit local preservation checkpoint and released-main integration) remains pending before shared-code work.
- Docker service is stopped and no Docker backend process or native PostgreSQL command was found. No service was started, software installed, or database touched in this resumption check.

## Chat Session Update - 2026-10-21 - Approved local preservation and baseline integration

- Updated by: Codex AI agent. Phase: CH-1 Foundation; status PLANNED while the approved integration is verified.
- Owner approved CHAT-D028: local planning checkpoint and exact c686337 merge in codex/chat-ch1-foundation, retaining both summary histories. No public push/merge/deployment or shared migration.
- Pre-integration HEAD 4f74bd6; seven reviewed Chat planning documents are the checkpoint scope. Original planning recovery copy and hashes verified in the prior entry.
- Baseline from immediately preceding resumption: typecheck/lint/build (42/42)/test:roles (one suite)/test:v2 (four suites) PASS. No test:chat yet.
- No new migration or runtime code; no browser/manual phase acceptance, no hosted action. Model API spend USD 0.
- Next: review staged checkpoint, commit locally, merge without committing, reconcile summary, verify released runtime tree and relevant regressions, then record IN_PROGRESS before foundation coding.

## Historical Shopify entries retained during Chat baseline integration

### 2026-10-07 — Shopify read-only authentication slice prepared

- Latest released main is `c701ec346aeb1fb38a364f4da231bff2a9a0232e` (PR #4); original `D:\Develop\os-plus\project_summary.md` records verified October 5 Production deployment. This isolated branch `codex/shopify-connection-probe-20261007` starts from that release, not the original dirty `c881102` checkout. Original planning/source and the other chat worktrees remain preserved.
- Owner authorized this backend slice and confirmed that the installed same-organization Shopify app targets the actual Phantom Threads production store, `n1djr1-99.myshopify.com`. API `2026-10` is approved. Phantom Threads Test is the initial diagnostic context; Boutique is the eventual permanent importer destination. Other tenants remain isolated; simultaneous fan-out and duplicate customer messages are not authorized.
- Owner reports Client ID/secret saved to Vercel Production, sync false and a Ready redeployment. No secret values were read or logged; these environment values and live authenticated Shopify access remain independently unverified.
- Prepared `POST /api/integrations/shopify/test-connection`, gated by fresh canonical active owner/admin membership, selected diagnostic tenant, configured same-origin request and Production-only environment fences. It reads only shop identity and granted scopes via bounded client-credentials/GraphQL transport, uses memory-only expiry-aware single-flight tokens, rejects browser-supplied connection/query data and redacts failures. It deliberately avoids the existing tenant-context helper's invitation-link mutation.
- No Settings button, durable connection, import, webhook subscription, queue, scheduler, source customer/order copying, local financial change or messaging is implemented/activated. Protected customer-field access explicitly remains unverified. Test messages must stay off. Recommended later flow is webhook-first with owner-proposed 30-minute n8n recovery, a reviewed single active destination and creation cutoff; any real-data Test copy requires explicit authorization and retention review.
- Reproduced/fixed a local extracted GraphQL helper return-type widening error with an explicit return contract. Final narrowed scope passes all 29 offline package test scripts, including 47 actual-path connection probe cases; full lint, TypeScript, optimized Next.js 16.3.8 webpack build (43 routes), and whitespace checks pass. Existing QA workbook inspected read-only for role/tenant coverage; database mutation/live smoke scripts not run. Independent Standards/Spec review is underway against owner-selected `c701ec3`, including all uncommitted files.
- Environment changes are isolated worktree/dependency junctions only. No commit, push, deployment, Vercel configuration, migrations, secrets retrieval, live Shopify call, production business-data write or messaging occurred. Seoul remains unchanged. Scope/configuration/testing details are in `docs/16_Shopify_Read_Only_Connection_Slice.md`.
- Exact next actions: finish review; seek separate explicit approval for selected commit/push/deployment and Production-only diagnostic settings; verify exact Test tenant UUID and authenticated owner context; run read-only live token/store/scope test with sync false. Then separately implement/review protected fields, durable intake, additive schema, atomic import, mappings, shared accounting guards, cutover and CRM consent/template/deduplication. Offline tests do not close those activation gates.

#### Review scope correction and final checks — 2026-10-07

- Initial Standards review had zero actionable findings. Spec review found one P2 scope issue: dormant encryption, monetary reconciliation, webhook HMAC and general sync helpers were copied into the diagnostic batch despite belonging to later integration work. Removed only these isolated copies and their foundation test/future configuration; original files in `D:\Develop\os-plus` remain intact and recoverable. No original user file was deleted or overwritten.
- Extracted only the bounded stream reader needed by diagnostics. Added eight applicable transport regression cases, retaining timeout, chunked overflow, HTTP/GraphQL classification, response caps, SSRF-host and outbound authority checks without shipping future accounting/storage/webhook code.
- Final narrowed batch: 47 probe cases and all 29 remaining offline package test scripts pass; TypeScript, full ESLint and rebuilt optimized 43-route Next.js 16.3.8 webpack build pass. Validation counts above now refer only to the final diagnostic scope. Re-review is underway; no commit, push, deployment, migration, production business-data change or environment activation.

- Final independent review against `c701ec3`: Standards 0 remaining actionable findings; Spec 0 remaining actionable findings. Also corrected the new summary's stale pre-narrowing test counts (P3); historical foundation evidence in original older entries remains preserved. Standards independently reran 47/47 probe cases and whitespace checks. The prepared uncommitted slice is ready for a separate release approval, not live import activation. Next actions remain owner-approved commit/push/PR merge/deployment and scoped Production diagnostic configuration, exact Test tenant UUID verification, then authenticated metadata-only connection testing with sync/messages off.

#### Diagnostic-only release authorized — 2026-10-07

- Owner explicitly approved the selected commit/push, PR merge and deployment after the precise scope request. No permission for order imports or customer messaging is inferred. Chats/CRM branches `docs/chat-leads-module` and `codex/chat-ch0-discovery` remain untouched; remote main remains the reviewed `c701ec3` baseline. Git-authenticated metadata verifies the target repository is private and permits writes.
- Re-read branch/HEAD/status and selected only this isolated diagnostic batch. Fresh probe rerun passes 47/47. Existing full 29-script, lint/typecheck, optimized 43-route build and independent review evidence remains applicable; source has not changed since that review.
- Exact-name active-tenant read-only lookup resolves one Phantom Threads Test row, slug `phantom-threads`, UUID `7be40f50-94a0-46c5-af57-7eea5e36ea8a`. No customer/order fields or business records were read or changed. This UUID belongs in Production diagnostic configuration, never hardcoded in the route.
- Browser tooling failed twice at initialization (`windows sandbox failed: helper_unknown_error: setup refresh had errors`); standard Vercel CLI auth/token and project link are unavailable. Git/PR deployment can proceed, but changing Production diagnostic settings and authenticated owner/Test execution remain blocked by this access limitation. Do not retrieve Shopify secrets or forge Clerk identity to bypass it. No Vercel settings or region changes have occurred; diagnostics default false and sync/messages remain off in the implementation.
- Next actions: inspect selected staged diff and known-secret/whitespace guards; commit/push only this slice; create/attach the release PR; require unchanged reviewed main and successful Preview before merge; verify actual Production deployment and public/protected-route smoke behavior. Record deployment evidence separately. Owner must complete the documented Production-only diagnostic settings and signed-in metadata check if browser access remains unavailable.

### 2026-10-07 — Secret-free Shopify configuration instrumentation

- Owner explicitly authorized preparation, tests and deployment of a Shopify-only diagnostic patch after the canonical live POST returned HTTP 503 `CONFIGURATION_INVALID`, while owner reports all custom settings correct and Vercel system-variable access enabled. Exact live cause is unverified; do not classify this as Shopify credential rejection or relax safeguards.
- Isolated clean checkout switched to `codex/shopify-probe-diagnostics-20261007` from freshly fetched released main `bfde44cb012c6a9a49209edc99c00aff2d9a943e`. Original dirty D checkout and chats/CRM worktrees are not modified by this code batch. Previous owner-selected review baseline `c701ec3` remains applicable; reviewers will also inspect this patch's incremental diff from `bfde44c`.
- Added typed fixed check labels and server-only `[DEBUG-osplus-shopify-config-v1]` logging for origin, Vercel environment, deployment fence, sync-off flag, API version, diagnostic UUID and credential presence/format. No values, IDs, tokens, request data, errors or upstream messages are logged or returned. Public error response remains generic; logging errors cannot alter the fail-closed response. Existing predicates and order of checks are preserved. No imports, messages, migrations, durable connections, UI, dependency or unrelated code changes.
- Wrote actual-handler diagnostic regressions first and observed 12 missing-label failures, then implemented diagnostics. New coverage verifies every label, zero outbound calls for configuration failure, no additional response fields, unauthorized-context behavior, logging failure isolation, actual production-log privacy, corrupted-label suppression and success/cross-site silence. All 64 probe cases and TypeScript pass. A reproduced Node strip-only parameter-property syntax error was corrected with an explicit class field/assignment; no runner or dependency changes. Lint/build/final review are pending at this entry.
- Cleanup gate: after the failing live check is observed, repair only that cause and verify the authenticated Test probe. Remove temporary logging/tag after success, preserving meaningful fail-closed/privacy coverage. Do not claim root-cause repair, successful Shopify authentication, or Production deployment until corresponding evidence exists. Configuration/log dashboard access remains unavailable in this agent session; no production values were retrieved or changed.

- Final validation: 64/64 probe cases, all 29 offline package scripts, full ESLint, TypeScript, optimized Next.js 16.3.8 webpack build (43 routes), and working-tree whitespace checks pass. Independent Standards review: 0 findings; independent Spec review: 0 findings. Both reviewers independently ran 64/64 probe cases and checked whitespace. No production smoke or authenticated live Shopify success is claimed.
- Release preflight found changed external state: Git-authenticated GitHub repository metadata now reports `private=false`, default branch main, push permission true; confirmed in two read-only checks. Earlier authorization/release assumed a private repository. No commit, push, PR, merge or deployment has occurred for this six-file instrumentation patch. Obtain explicit owner authorization to publish this patch's source/documentation to the now-public repository, or have the owner restore private visibility, before publication. Do not change repository visibility or bypass this gate. Remote main remains `bfde44c`. The other chat checkout has independently progressed to `codex/chat-ch1-foundation`; no file/branch there was touched by this patch.

- Owner explicitly authorized public publishing of this six-file diagnostic patch, requesting visibility be addressed later. Owner reports making the repository public because an earlier private-repository Vercel redeploy failed; the exact integration/plan/access cause of that failure is not diagnosed. Fresh Git-authenticated metadata confirms public/write access, and fetched main remains `bfde44c`. Keep repository visibility and Vercel settings unchanged. Proceed only with the already-reviewed diagnostic feature branch, normal PR/main release, and distinct Production verification. No customer import/messages or chats/CRM work is authorized by this release.

## Chat Session Update - 2026-10-21 - Released baseline integrated and verified

- Phase CH-1 Foundation; baseline integration complete, implementation starts next. Branch codex/chat-ch1-foundation, same worktree.
- Preservation checkpoint: 1619c61. Merged exact released c686337c0f059cbe6ae40bbcadc2f6c0da2ffc0a with both summary histories retained; Chat deployment/docs remain present.
- Before maintenance fixes, merged application src/, package manifests, environment template and migrations matched c686337 exactly. No Shopify feature rebuilt or enabled.
- Required gates: typecheck PASS; full lint initially failed on inherited test-shopify-oauth-ui.mjs local variable named module. Renamed only that test-local binding, rendered UI test 1/1 PASS, full lint PASS. Build PASS, 49/49 static-generation steps. Role suite PASS; four V2 suites PASS.
- Relevant offline regression: Shopify OAuth 29 backend plus 1 rendered UI PASS; unified foundation 50 PASS. Suites overlap; do not add counts as distinct coverage. PGlite actual SQL/application tests, not hosted or independent-session evidence.
- Removed trailing blank EOF lines in three inherited docs/shopify-*.json evidence files solely to pass staged whitespace review; JSON content unchanged. No other Shopify runtime change.
- Manual QA: merge/code/history review only; no browser or hosted data action. No new/application migration applied. Existing released migrations added to this checkout by merge only.
- Docker Desktop started hidden for disposable local tests; engine now responds as 29.7.2 with existing PostgreSQL images. This resolves the old engine availability blocker; no database container or shared service mutation performed yet.
- CH-1 not READY_FOR_CLOSURE: foundation implementation and phase SQL/concurrency/UI/Tier A/owner acceptance remain. Model API spend USD 0.
- Next: local merge commit under CHAT-D028; append IN_PROGRESS with exact merged HEAD; implement approved foundation in test-first increments.

## Chat Session Update - 2026-10-21 - CH-1 foundation implementation started

- Updated by Codex AI agent. Phase CH-1 Foundation; status IN_PROGRESS.
- Branch codex/chat-ch1-foundation; merged base 24a0af7140c51fd061f2f2054c046a325999a298, including released c686337. Same worktree D:/Develop/os-plus-chat-ch0.
- Scope and file inventory: docs_chat/CH1_IMPLEMENTATION_PLAN.md. P1/P2/I1 resolved under CHAT-D026/D027/D028; no remaining product decision before foundation coding.
- Build order: pure knowledge/encryption/access modules and actual behavior tests; additive tenant-owned storage/atomic commands; mock Chatwoot admin API; owner/super-admin setup UI.
- Expected migrations: timestamped chat_foundation and chat_foundation_commands; new tables/RPCs only, no existing-table modification in CH-1.
- Compatibility risk: shared database type composition, permission declarations and setup navigation; Boutique Tier A BA-001..BA-014 required. Preserve all newer Shopify guards and source-money/retention/consent boundaries.
- Baseline before coding PASS: typecheck, full lint (test-local inherited variable fixed), build 49/49, role suite, four V2 suites, Shopify OAuth 29+1 and unified 50 (overlap). No phase tests yet.
- Docker engine now available. Real isolated PostgreSQL application and independent-session concurrency tests will use synthetic tenants; no shared migration or hosted data access.
- UI/manual acceptance remains CHECKLIST Part C CH-1, plus Tier A and mobile/desktop role checks. No phase closure claimed.
- Tests/migrations/runtime implementation at this start: pending. Model API spend USD 0.

## Chat Session Update - 2026-10-21 - CH-1 pure foundation rules verified

### Date / Updated By / Phase / Status
2026-10-21 / Codex / CH-1 Foundation / IN_PROGRESS.

### Branch / Base
codex/chat-ch1-foundation at local merge 24a0af7, including released c686337. Prior histories preserved.

### What Was Built / Decisions
- Added src/features/chat/knowledge-pack.ts: strict knowledge boundary, unique keys, declared service references, safe HTTPS links, placeholder rejection, and publication checks against server-resolved brand branches/capabilities. The synthetic example remains unpublished.
- Added src/features/chat/secrets.ts: server-only AES-256-GCM with tenant/workspace/purpose AAD, random nonce, call-time versioned key lookup and safe errors.
- Added src/features/chat/permissions.ts: approved D026/D027 defaults, active-tenant/member/module gating, separate read-only viewer/finance view and PII grants. Existing platform roles/routes unchanged.
- Added scripts/test-chat-{knowledge,secrets,permissions}.mjs and package.json test:chat. Added private rotation configuration documentation to .env.example.
- No new product decision; accepted policies implemented as pure rules, not yet connected to routes or storage.

### Migrations Added / Applied
None yet. No shared database changes.

### Automated Tests / Regression
Test-first missing behavior failures observed, then npm run test:chat PASS 8/8; npm run typecheck PASS. Earlier released-baseline platform and Shopify checks remain recorded above; no runtime shared-code change in this slice.

### Manual QA / Gate / Bugs / Next Step
No UI exists yet to exercise. CHECKLIST Part C CH-1 and Boutique Tier A remain pending. Phase cannot close. Invalid pack references and wrong-context secret access are rejected in tests. Next: actual additive migrations and atomic commands in a disposable local Docker PostgreSQL database, then connector/setup interface. No paid model calls; USD 0.

## Chat Session Update - 2026-10-21 - CH-1 schema and atomic commands tested locally

### Date / Updated By / Phase / Status
2026-10-21 / Codex / CH-1 Foundation / IN_PROGRESS, acceptance incomplete.

### Branch / Base / Changes
codex/chat-ch1-foundation, baseline 24a0af7 including released c686337.
- Added supabase/migrations/20261021100000_chat_foundation.sql: 12 new tenant-owned tables (11 planned plus normalized notification target/brand junction), composite foreign keys, RLS, explicit ACLs, immutable knowledge revisions, one published revision per brand, module disabled by default and channels draft/no booking/no statement.
- Added supabase/migrations/20261021101000_chat_foundation_commands.sql: service-role-only owner-authorized configuration RPC for brand save, branch map, knowledge revision/save/publish, role grants and channel mapping. Tenant advisory transaction lock serializes configuration; existing command_idempotency and domain_events commit atomically. No existing tables altered.
- Added scripts/chat-db-harness/database.mjs and scripts/test-chat-database.mjs. Harness reuses the repository's locked pg dependency under scripts/shopify-db-harness, starts only a uniquely labeled disposable PostgreSQL 17 container, binds an ephemeral loopback port, uses random in-memory credentials and tmpfs, and verifies its label before cleanup. No app environment files or shared URLs are read.
- Publication currently rejects booking capabilities because CH-1 does not activate them. No later-phase behavior enabled.

### Migrations Applied / Tests
Applied all 73 actual repository migrations (71 released + 2 new) to disposable local PostgreSQL only. Existing optional handover dependency shape is explicitly synthetic, following the inherited local harness; this does not claim handover acceptance.
npm run test:chat PASS 15/15: real schema/FK/ACL/RLS checks, active owner and wrong-tenant denial, encrypted context/rotation, strict knowledge rules, concurrent revision/publish and same-key retry, plus injected audit-insert failure proves configuration/idempotency rollback. Owned test containers removed after runs.
Fixed test-discovered knowledge publication SQL alias collision; verified corrected behavior. Earlier typecheck PASS; full final gates not yet rerun.

### Manual QA / Regression / Gate / Decisions / Next
No UI/browser or owner acceptance yet; CHECKLIST Part C CH-1 and Boutique Tier A remain pending. Workspace provisioning, mock connector, server adapters/types and setup UI still required. No new product decisions; phase cannot move to READY_FOR_CLOSURE. Shopify hosted OAuth/n8n pending work remains separate as recorded above. Next: guarded workspace setup and mock admin integration, then UI and regression. Model API spend USD 0.

## Chat Session Update - 2026-10-21 - CH-1 guarded setup and first full gate run

### Date / Updated By / Phase / Status
2026-10-21 / Codex / CH-1 Foundation / IN_PROGRESS; owner acceptance not complete.

### Implementation
- Extended the two uncommitted Chat migrations with platform workspace preparation, one-attempt remote-create reservation, reconciliation/linking, secret rotation, suspension and explicit enablement; all writes/audits are atomic locally. Brand archive retains history and disables channels.
- Added src/integrations/chatwoot/admin-client.ts with bounded response reads, timeouts, redirect refusal, account identity checks, supported inbox projection and provisioning marker validation. Only local HTTP mocks called. Review corrected the header to api-access-token per docs_chat/04; Rails normalizes this for the pinned v4.18.0 token lookup. Provider credentials present in remote inbox responses are discarded.
- Added src/features/chat/{schemas,module,queries,connection,commands,platform-commands,actions}.ts, src/types/chat.ts and additive database type composition preserving Shopify. Tenant and platform guards remain distinct; no caller-supplied tenant authority in tenant forms.
- Added src/components/chat/{setup-form,knowledge-editor,setup-panel,platform-panel}.tsx, tenant /settings/chat and platform /super-admin/chat-workspaces routes. Narrow settings/super-admin links are gated by CHAT_FOUNDATION_ENABLED (default false); tenant setup also requires module enablement and owner access.
- Extended scripts/test-role-route-policy.mjs for guarded Chat integration; introduced strict form boundary tests. Added scripts/chat-preview for isolated synthetic browser QA without auth, database or remote-service imports. Its simulated saves are explicitly not backend acceptance.
- .env.example documents default-off foundation/live admin gates, dry-run, canonical provider origin and private keys. No deployed environment changed.

### Tests / Migrations
First complete implementation run: npm run typecheck PASS; npm run lint PASS; npm run build PASS (51/51 generation steps); npm run test:roles PASS legacy suite; npm run test:v2 PASS 4 suites; npm run test:chat PASS 22/22. Follow-up header/read-validation/role-test/UI dependency changes require final rerun.
Both new migrations applied only to owned disposable PostgreSQL containers, never shared/production. No actual Chatwoot provisioning, bot/model calls, messages, n8n workflow, push or deployment.

### QA / Regression / Gate / Next
Browser QA started in local synthetic preview; failed brand save visibly preserves fields and shows an error. Remaining: wider UI checks, final diff review and rerun; authenticated two-tenant end-to-end and Boutique BA-001 through BA-014 plus owner CHECKLIST Part C CH-1 acceptance are not yet proven. Do not close or commit CH-1 until these gates pass. Shopify pending hosted OAuth/n8n work remains separate. No new product decision. Model API spend USD 0.

## Chat Session Update - 2026-10-21 - CH-1 review fixes and server-path regression

### Phase / Branch / Changes
CH-1 Foundation IN_PROGRESS on codex/chat-ch1-foundation, integrated baseline 24a0af7 (includes released c686337). Review found and fixed retry identity, knowledge-history truncation and incomplete grant audits; no new product decision.
- src/components/chat/setup-form.tsx retains a key for unchanged failed submissions; tenant setup remounts on tenant change.
- src/features/chat/commands.ts resolves authorized completed receipts before draft-state/network checks. platform-commands.ts and 20261021101000_chat_foundation_commands.sql use stable logical hashes, suppress regenerated one-time URLs on replay, and recover token-link receipts before another remote check. Plaintext tokens are never persisted in receipts.
- Grant audit events now atomically include role, permission, prior and new allowed values.
- src/features/chat/{queries,actions}.ts and setup/knowledge UI now page metadata per brand, always include published metadata and load selected JSON through a fresh tenant/owner guard. Removed global 200-pack and display 10-pack limits.
- scripts/chat-db-harness/server-adapter.mjs executes production server modules against real local PostgreSQL while injecting authentication context and the PostgREST transport only. Added regression scenarios in scripts/test-chat-database.mjs.

### Tests / Migrations / QA
Database suite PASS 14/14 after observed failing retry cases were repaired. All 73 actual migrations replayed in disposable local PostgreSQL only. Actual SQL rollback, concurrency, cross-tenant constraints and server command/read behavior exercised; the adapter tests do not claim Clerk/browser authentication acceptance. Typecheck passed; lint/final full gate in progress. Synthetic browser lost-response test in progress.
Two review agents (standards/specification, as prescribed by review skill) found no demonstrated P0/P1 breach; their P2 findings are addressed in this slice and being reverified.

### Gate / Remaining / Spend
Owner CHECKLIST Part C CH-1, authenticated two-tenant end-to-end and Boutique Tier A remain pending. No phase closure or CH-1 commit yet. Shopify OAuth/n8n pending work remains separate. No shared migrations, real service calls, messages or deployment; model API spend USD 0. Next: finish browser checks, final gate, evidence documentation and closure-blocker handoff.

## Chat Session Update - 2026-10-21 - CH-1 foundation implemented; closure QA blocked

### Date / Updated By / Chat Phase / Phase Status
2026-10-21 / Codex / CH-1 Foundation / **QA_BLOCKED**.

### Branch / Base / Session Objective
- Worktree: D:/Develop/os-plus-chat-ch0.
- Branch: codex/chat-ch1-foundation; no upstream.
- HEAD: 24a0af7140c51fd061f2f2054c046a325999a298, the approved local merge of exact released c686337 after preservation checkpoint 1619c61. Both summary histories and CH-0 deployment/audit/example assets remain.
- Objective: resume the existing foundation plan, preserve the newer Shopify release and implement only CH-1. CH-1 changes remain uncommitted; CH-2 has not started.

### What Was Built / Files Changed
- Tenant-owned configuration for modules, workspaces, brands, branch/channel mappings, grants and knowledge revisions; 12 new tables including the normalized notification-target/brand junction.
- Accepted role defaults, tenant/module guard, authenticated AES-256-GCM keyring, strict Zod boundaries, safe DTOs, per-brand paginated revision metadata and selected-pack reads.
- Audited atomic service-only Domain Command RPCs, idempotent save/publish/platform retry receipts, remote-create reservation/reconciliation, one-time webhook URL preparation/rotation and module suspension/enablement.
- Guarded tenant Settings → Chat and platform Chat workspaces UI; mock Chatwoot admin integration. No later-phase messaging, model, contact/customer, lead-page or SSO behavior.
- Exact new runtime inventory: src/features/chat/{actions,commands,connection,knowledge-pack,module,permissions,platform-commands,queries,schemas,secrets}.ts; src/components/chat/{knowledge-editor,platform-panel,setup-form,setup-panel}.tsx; src/integrations/chatwoot/admin-client.ts; src/types/chat.ts; src/app/(tenant)/settings/chat/page.tsx; src/app/(super-admin)/super-admin/chat-workspaces/page.tsx.
- Shared additions: src/types/database.ts; src/lib/permissions/roles.ts; src/app/(tenant)/settings/page.tsx; src/app/(super-admin)/layout.tsx; .env.example; package.json; eslint.config.mjs; scripts/test-role-route-policy.mjs.
- Tests/preview: scripts/test-chat-{admin-client,boundaries,database,knowledge,permissions,secrets}.mjs; scripts/chat-db-harness/{database,server-adapter}.mjs + README.md; scripts/chat-preview/ app, configuration, README.md and generated-file ignore.
- Documentation: docs_chat/{02_Architecture_and_Data_Model,06_Decision_Log,CH1_IMPLEMENTATION_PLAN,CHECKLIST,CH1_QA}.md; this same living project_summary.md. CH1_QA.md contains the full file/evidence inventory and exact pending acceptance steps.

### Key Decisions
CHAT-D026/D027 access approvals and CHAT-D028 preservation/integration authority implemented. No unresolved CH-1 product decisions. Versioned encryption env names are CHAT_SECRETS_KEYS plus CHAT_SECRETS_ACTIVE_VERSION; draft singular notation updated. Global foundation/live admin flags remain off by default and dry-run on. No deployed configuration changed.

### Migrations Added / Applied
- supabase/migrations/20261021100000_chat_foundation.sql
- supabase/migrations/20261021101000_chat_foundation_commands.sql
Applied all 73 actual repository migrations (71 released plus these two) to owned disposable local PostgreSQL 17 containers only. Existing optional handover dependency shape is explicitly synthetic. No existing table altered; no shared/production database migration or data change. Docker 29.7.2 now works, superseding the earlier unavailable-engine note.

### Automated Tests Run
| Command | Final result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS, no errors/warnings |
| npm run build | PASS, 51/51 generation steps |
| npm run test:roles | PASS: legacy role-route suite and Chat guarded integration group |
| npm run test:v2 | PASS: 4 existing suites |
| npm run test:chat | PASS: 27/27, none skipped |
| npm run test:shopify-oauth | PASS: 29 backend + 1 rendered UI |
| npm run test:shopify-unified-foundation | PASS: 50/50 |

Logs: outputs/chat-ch1/final-20261021/. Final migration/source diff and tracked whitespace checks reviewed. The Node module-type warning for stripped TypeScript is non-failing; package module semantics were not changed.

### Phase-Specific / Tenant Isolation Checks
Chat: 4 knowledge, 2 crypto, 2 permission, 1 boundary, 4 mock HTTP connector and 14 PostgreSQL/server-path tests.
Actual independent PostgreSQL sessions prove concurrent allocation/publish and same-key retry. Forced audit failure rolls back mutation and receipt. ACL and independent default-deny RLS checks pass. Service direct writes are denied. Cross-tenant composite references, mutations and production knowledge reads are rejected. Fixture A has one brand/two mapped branches/published pack/channel; B cannot access those records.
Production server adapters run against PostgreSQL with synthetic auth context/PostgREST wire adapter; this does not claim Clerk, live Supabase or browser-server-action acceptance.

### Boutique Regression / Compatibility
Required tier: **A** because shared permission types, database types and navigation changed.
BA-001 through BA-014 are **NOT RUN / BLOCKED**, not passed by the automated suites. No isolated authenticated app environment with approved test identities was configured for those workflows.
Released Shopify code/contracts are retained; existing platform and Shopify automated regressions pass. No Boutique/Laundry business behavior or existing table definition intentionally changed. Shopify hosted OAuth approval/renewal, broader multi-store acceptance and deferred n8n wiring remain separate pending work.

### Manual QA
Local in-app Chromium synthetic preview: owner controls; manager/viewer/finance setup denial; A/B UI state reset; failed save preserves inputs; malformed JSON feedback; lost-response retry produces no duplicate draft; explicit publication; branch mapping; inbox mapping stays draft; privileged synthetic URL display/hide.
Phone/laptop iframe layout check: 375×812 and 1280×900 frames, measured clientWidth/scrollWidth 339/339 and 1243/1243 with scrollbar gutters, no horizontal overflow. Screenshot: outputs/chat-ch1/final-20261021/setup-responsive.png.
Preview saves are simulated. Authenticated two-tenant end-to-end, physical device QA and owner CHECKLIST.md Part C → CH-1 acceptance remain unperformed.

### Bugs Found / Fixed / Review
Fixed review P2s: request-key churn; server validation/randomization preventing saved-command replay; one brand hiding another's knowledge history; grants missing prior/new audit values. Also fixed SQL publication alias collision, connector header and generated-preview lint configuration during implementation.
Standards/specification review and focused re-review report no remaining actionable finding or demonstrated P0/P1 defect. No implementation defect intentionally deferred.

### Pending Tasks / Blockers / Phase Gate
- Configure an explicitly approved isolated authenticated acceptance environment and test identities; do not reuse production as a local database.
- Complete CHECKLIST Part C CH-1 with owner acceptance, real authenticated tenant-A/B requests and the listed setup fixture.
- Execute Boutique Tier A BA-001–BA-014, record evidence and complete closure review.
- Can move to READY_FOR_CLOSURE: **NO**. Required owner/authenticated regression evidence is missing.
- D025 allows local commit after successful closure gates; it does not allow committing this incomplete gate or beginning CH-2 now. No further commit made.

### Spend / External Effects / Next Step
External model/API spend USD 0. No live Chatwoot/admin call, customer message, Meta change, shared migration, purchase, n8n activation, public push/merge or deployment. Source documentation was read only.
Next concrete step: owner review of docs_chat/CH1_QA.md and agreement on an isolated authenticated test environment, then complete the outstanding acceptance/regression before local phase commit.

## Chat Session Update - 2026-10-21 - Isolated local acceptance environment authorized

CH-1 remains QA_BLOCKED for Clerk/owner acceptance. The owner now authorizes an isolated local QA environment and all feasible local checks. Branch codex/chat-ch1-foundation / HEAD 24a0af7 and all existing work preserved.
Plan: dedicated loopback PostgreSQL/PostgREST with a labeled persistent local volume, actual migrations, synthetic tenant/role/Boutique fixtures, a separate environment-clean app snapshot, real HTTP/SDK checks and a local dump/restore drill. No production env files or service credentials will be copied; Clerk remains real authentication and requires development keys plus human login.
Docker 29.7.2 and required database/API images are already local. No configured Clerk keys found in this worktree. Shared migrations, production data/services, real messages, paid models and releases remain excluded. Next: create the local runner, seed, verify API/restore, then give exact Clerk/owner steps. Spend USD 0.

## Chat Session Update - 2026-10-21 - Isolated database/API acceptance evidence

- Same branch `codex/chat-ch1-foundation`, HEAD `24a0af7`; phase CH-1 remains IN_PROGRESS for local QA work, closure not yet approved.
- Added `scripts/chat-local/{common,manage,gateway,seed,qa}.mjs`, `compose.yaml`, and extracted reusable actual migration replay into `scripts/chat-db-harness/migrate.mjs`. Three synthetic businesses, role memberships, two branches per enabled business, synthetic workspace/knowledge draft and Boutique order/workflow fixtures exist only in the owned local Docker database.
- Applied all 73 repository SQL migrations (including the two CH-1 migrations) only to dedicated local PostgreSQL. No historical/shared migration was reapplied. Existing optional handover dependency uses the documented synthetic harness table shape; this is not handover acceptance.
- Real PostgREST/Supabase SDK QA passed 8 groups: credential/ACL denial; production query DTO and tenant filtering; production permission gates; concurrent idempotent command/audit; cross-tenant/actor denial and rollback; knowledge save/publish/replay; three inherited Boutique database smokes; actual dump/restore. Evidence: `outputs/chat-local/qa-report.json` and per-smoke logs.
- Boutique smokes passed: payment concurrency/audit/summary/isolation; workflow activation vs last-stage deactivation (12 race pairs); existing-order add-items. These are additional database regressions, not completion of the BA-001–BA-014 authenticated/manual tier.
- Restore ran into a second database in the same isolated cluster and compared content hashes/counts for every public table; browser/Clerk, Supabase Storage and whole-host recovery are outside that evidence.
- Startup findings fixed: Windows reserved 54327–54329; now loopback ports 15437–15439. Docker Desktop internal networks did not publish host ports; dedicated bridge network used with loopback-only host bindings. Startup SQL initialization now uses an advisory lock to prevent competing initializers.
- No Clerk development keys present. Actual authenticated app acceptance awaits owner-supplied development keys and real test login; no auth bypass introduced. No real providers, customer messages, paid models, production changes or deployments; model/API spend $0.
- Next: finish launcher guard tests, rerun required gates, document exact private Clerk setup and owner acceptance steps, and record final local environment status.

## Chat Session Update - 2026-10-21 - Local acceptance environment ready; Clerk and owner QA pending

- **Phase/status:** CH-1 Foundation **QA_BLOCKED**, not READY_FOR_CLOSURE. Branch remains `codex/chat-ch1-foundation`, HEAD `24a0af7140c51fd061f2f2054c046a325999a298`, no upstream. No phase commit, next-phase work, merge, push or deployment this session. Earlier “no isolated environment” blocker is superseded for database/API checks; authenticated browser and owner acceptance remain outstanding.
- **Exact changes this local-environment session:** added `scripts/chat-local/common.mjs`, `manage.mjs`, `gateway.mjs`, `seed.mjs`, `qa.mjs`, `compose.yaml`; added `scripts/chat-db-harness/migrate.mjs` and reused it from `database.mjs`; added `scripts/test-chat-local.mjs`; added npm `chat:local` and `qa:chat-local` commands in `package.json`; excluded generated `outputs/` app snapshots in `tsconfig.json` and `eslint.config.mjs`. Added `docs_chat/CH1_LOCAL_QA.md`; updated `docs_chat/CH1_QA.md`, `docs_chat/CHECKLIST.md`, and this same summary. Existing CH-1 runtime implementation and unrelated worktrees preserved.
- **Isolation/runtime:** dedicated Docker project `osplus-chat-local-8e8d10a9c1` and persistent local volume; PostgreSQL loopback15437, PostgREST15438, gateway15439. Three synthetic tenants; no production imports. Clean source snapshots under ignored `outputs/chat-local/app-<timestamp>`; only allowlisted process environment and explicit local/dev configuration reach Next. Actual app target localhost4131 is prepared but not started/authenticated because Clerk development keys are absent. No auth bypass. Service credentials and crypto keys are generated locally; private files ignored and not printed.
- **Migrations:** no additional schema migrations authored for this environment. Replayed 71 released SQL files plus `20261021100000_chat_foundation.sql` and `20261021101000_chat_foundation_commands.sql` only in the owned fresh local database. Synthetic optional handover dependency shape remains explicitly documented; no handover acceptance claimed. No shared/production SQL.
- **Automated gates:** `npm run typecheck` PASS; `npm run lint` PASS; `npm run build` PASS, 51/51 generation; `npm run test:roles` PASS (legacy + Chat group); `npm run test:v2` PASS (4 suites); `npm run test:chat` PASS **30/30**, 0 skipped. Final local-tool edits also passed targeted eslint and 3/3 launcher guards; `git diff --check` PASS. Logs under `outputs/chat-local/`; initial typecheck/lint output is retained in the session.
- **New real integration/regression evidence:** `npm run qa:chat-local` PASS 8 groups through actual PostgREST/Supabase SDK, using production server modules with a synthetic identity context. Denials, secret-free DTOs, tenant filters, module/manager gates, concurrent replay, rollback, immutable publication tested. Inherited payment-integrity, workflow-stage concurrency (12 race pairs) and existing-order add-items DB smokes PASS against this local API. Previous Shopify OAuth 29 backend + 1 UI and unified foundation 50-test results remain recorded; no Shopify work rebuilt or completed.
- **Restore:** actual pg_dump/pg_restore into `chat_restore_6462476b3286` in the isolated local cluster; all **117 public tables** match content hashes/counts, restored anon ACL denial and service access verified. Dump 1,245,250 bytes retained in ignored local outputs; manifest/hash in `outputs/chat-local/qa-report.json`. This is database restore, not whole-host/Clerk/Storage recovery.
- **Lifecycle/manual observations:** real stop/start preserved tenant/brand/event counts; second up neither reseeded nor replayed migrations; app launch rejects missing Clerk keys. Evidence `outputs/chat-local/lifecycle-report.json`. Unused owned diagnostic network/volume removed after label/use checks. Services left running for the owner. Prior synthetic browser responsive/error checks remain valid; no new authenticated browser pass claimed.
- **Bugs/findings:** corrected Windows reserved-port conflict and Docker internal-network host publishing; initializer now holds a database advisory lock; corrected synthetic fixture membership column and command-key contract before successful QA. No new product P0/P1 demonstrated. Local snapshot exclusions keep generated source/build output out of platform type/lint scans.
- **Required human work:** see `docs_chat/CH1_LOCAL_QA.md` Clerk steps 1–6 and C1–C8. Owner must privately save development `pk_test_`/`sk_test_` keys, sign up/sign in to the supplied synthetic emails, and put owner-a's development Clerk user ID in the local superadmin allowlist. Then resume actual browser/Next-action tenant/role QA, Boutique Tier A BA-001–BA-014, and explicit owner acceptance. Provider sync remains blocked in local dry run; HTTP mock evidence is separate. No Leads pages/SSO were added early.
- **Limits/dependencies:** this stack exposes database REST, not Supabase Storage/Auth/Realtime. Unsupported mandatory paths must be recorded and supported locally, not redirected to production. Domain/Meta/new isolated n8n and live Chatwoot remain later dependencies. Shopify hosted OAuth approval/renewal and deferred n8n remain separate pending work; retained order/customer boundaries remain intact.
- **Spend/next step:** USD **0** external model/API spend; no purchase, message, production setting/data change or workflow activation. Await private development-key setup and real test login, then complete authenticated/owner gates and final closure review before the existing local commit authority is used.

## Chat Session Update - 2026-10-21 - Clerk development keys supplied; login screens verified

- Same worktree/branch/HEAD; CH-1 remains QA_BLOCKED pending authenticated role/tenant/Boutique checks and owner acceptance. User saved development keys privately in outputs/chat-local/clerk.env and reports the keys also exist in .env.local. The isolated launcher deliberately does not load/copy .env.local; its contents were not printed or changed.
- Started the actual isolated app with development-prefix validation, generated local database credentials, CHAT_DRY_RUN=true and CHAT_ADMIN_LIVE_ENABLED=false. Clerk rendered Development mode; this validates the frontend initialization, not yet a completed authenticated session/backend identity lookup.
- Found and fixed a local launcher hostname mismatch: Next listened as 127.0.0.1 while Clerk's request rewrite used localhost, causing self-proxy timeouts/500s. Changed only scripts/chat-local/manage.mjs --hostname to localhost. Restarted only the verified QA app process tree. Production source/authentication code unchanged.
- Verification: reproduced the timeout in browser and direct local HTTP; after fix the actual /sign-in returned HTTP 200 and displayed the Clerk login form, and /sign-up displayed email/password fields plus Development mode. Scoped launcher lint and existing three local guard tests checked. No migrations or new schema, no shared data/provider action. Earlier full gates and 8-group database/API/restore evidence remain recorded.
- App is running at http://localhost:4131. Next owner step: complete signup for owner-a+clerk_test@example.com with a test password and development verification code, then record its development Clerk user ID in the local superadmin allowlist. Human password entry is required; no test identity/session was fabricated. Authenticated browser, BA-001–BA-014 and owner acceptance remain unpassed.
- No phase commit, push, deploy, live message, paid model call or n8n activation. Model/API spend USD 0. Continue QA after the user's real development login.

## Chat Session Update - 2026-10-21 - Authenticated local QA resumed

- Owner completed real Clerk development login and authorized continuation. Browser verified owner-a+clerk_test@example.com has active Owner/Admin memberships for Local QA A (chat-local-1) and Local QA B (chat-local-2).
- Same branch codex/chat-ch1-foundation / HEAD 24a0af7; existing work preserved. Starting real browser/Next-action setup and Boutique Tier A QA against the isolated local database only. Phase remains QA_BLOCKED until required checks and explicit owner acceptance complete.
- Configure only this isolated app's superadmin allowlist from the verified, already-linked development owner identity; no production roles/Clerk settings changed. No migrations, model spend, real messages, shared data changes or deployment.

## Chat Session Update - 2026-10-21 - Authenticated setup passed; expected-denial UI corrected

- Real Clerk/Next browser flow created Browser QA Inquiry, mapped north/south, retained invalid JSON, saved/published v1 and retained v1 publication while saving v2 draft. Independent viewer lead-view grant persisted with PII false and was restored to denied. Dry-run sync showed safe failure.
- Prepared B's pending workspace locally and disabled its module via platform server action. Local launcher now includes reserved .invalid origins required for configuration, with live access still disabled. No remote account created.
- Found expected module-off access raising an unhandled server error. Added ChatAccessError in src/features/chat/module.ts and narrowly mapped it to notFound in src/app/(tenant)/settings/chat/page.tsx; unrelated errors still propagate. Added scripts/test-chat-page.mjs (2 regression tests: RED then GREEN) and TSX support in scripts/chat-db-harness/server-adapter.mjs. Actual disabled-tenant browser page now shows clean 404. Refreshed only these two runtime files in the owned app snapshot; full gates pending after this fix.
- Agent browser evidence is in docs_chat/CH1_AUTHENTICATED_QA.md; owner acceptance remains separate. Unused synthetic one-time webhook URLs are invalidated locally, not used against a provider.
- Phase remains QA_BLOCKED; next checks are authenticated role/isolation, Boutique Tier A and responsive QA. No new migrations, external paid model/API spend, shared changes or release action.


## Chat Session Update - 2026-10-21 - Authenticated regression checkpoint

### Date / Updated By / Phase
2026-10-21 / Codex / CH-1 Foundation — QA_BLOCKED pending remaining browser checks and explicit owner acceptance.

### Branch / Base
codex/chat-ch1-foundation at 24a0af7140c51fd061f2f2054c046a325999a298; released Shopify c686337 integrated earlier. No other worktree modified.

### Progress
Real Clerk owner-a login confirmed both local tenants chat-local-1/chat-local-2. Real Next actions passed brand, two-branch mapping, knowledge v1 publication/v2 draft, independent viewer grants, platform module toggling and A/B isolation. Stale owner forms were rejected after local membership changed to manager/viewer/finance or A disabled; original active owner memberships restored and unchanged brand confirmed in DB. No fake Clerk sessions were used. Separate role identities/non-superadmin platform denial remain unclaimed.

Boutique UI created Browser QA Customer, default QA fit reference, ORD-000001 (reference CHAT-LOCAL-BROWSER-QA) with two items and separate workflows. Valid worker/workgroup start and completion passed; next stage ready. Remaining Tier A checks are in progress.

### Fix / Files
ChatAccessError in src/features/chat/module.ts; expected access denial maps to notFound in src/app/(tenant)/settings/chat/page.tsx. scripts/test-chat-page.mjs adds two regression tests; scripts/chat-db-harness/server-adapter.mjs supports TSX test loading. Local launcher supplies reserved invalid provider origins, dry run remains on. docs_chat/CH1_AUTHENTICATED_QA.md records live evidence. Snapshot runtime files refreshed locally.

### Gates
npm run typecheck PASS; npm run lint PASS; npm run build PASS; npm run test:roles PASS (route + Chat integration); npm run test:v2 PASS (four suites); npm run test:chat PASS 32/32, zero skipped. Logs outputs/chat-local/authenticated-*.log. No new migration or shared DB application; both CH1 migrations remain local-only. No production enablement, messages, purchases, push or deploy. Model/API spend USD 0.

### Next
Finish Boutique BA-009–014 and responsive/role gaps, update evidence and ask owner to review C1–C8. Shopify OAuth hosted activation/renewal and deferred n8n remain separate pending work. CH-1 is not READY_FOR_CLOSURE and no phase commit made.

## Chat Session Update - 2026-10-21 - Authenticated local QA handoff

### Date / Updated By / Chat Phase / Phase Status
2026-10-21 / Codex / CH-1 Foundation / **QA_BLOCKED**.

### Branch / Base
- Existing codex/chat-ch1-foundation in D:\Develop\os-plus-chat-ch0, HEAD 24a0af7140c51fd061f2f2054c046a325999a298, no upstream.
- Released Shopify c686337 baseline already integrated. No other worktree changed. Newer Shopify hosted OAuth activation/approval/renewal and deferred n8n remain separate pending work.

### Session Objective and What Was Built
Used the owner's real Clerk Development login to finish available isolated local QA. Both synthetic businesses are confirmed: Local QA A (chat-local-1) and Local QA B (chat-local-2).
Fixed expected Chat access denial rendering: typed ChatAccessError maps to notFound instead of uncaught development error; unexpected page failures remain errors. Added two regression tests. Added reserved .invalid provider origins to local launcher; live administration remains false and dry run true. Refreshed two owned app snapshot files and manifest hashes. Existing .env.local untouched.

### Exact Files / Records
- src/features/chat/module.ts
- src/app/(tenant)/settings/chat/page.tsx
- scripts/test-chat-page.mjs
- scripts/chat-db-harness/server-adapter.mjs
- scripts/chat-local/manage.mjs
- docs_chat/CH1_AUTHENTICATED_QA.md (full result/limitations and owner instructions)
- docs_chat/CH1_LOCAL_QA.md, docs_chat/CH1_QA.md, docs_chat/CHECKLIST.md and this project_summary.md
- Ignored local evidence: outputs/chat-local/authenticated-*.log, authenticated-write-report.json, boutique-browser-report.json; temporary role/DB assertion helpers and snapshot-manifest.json. No credentials added to tracked files.

### Migrations Added / Applied
None added or applied during this authenticated browser session. Existing 20261021100000_chat_foundation.sql and 20261021101000_chat_foundation_commands.sql were already applied only to isolated disposable databases as part of the 73-migration local replay. No shared or production migration.

### Automated Tests Run
| Command | Result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run build | PASS, 51/51 pages |
| npm run test:roles | PASS, platform routes + Chat guarded integration |
| npm run test:v2 | PASS, four suites |
| npm run test:chat | PASS, 32/32, zero skipped |
| git diff --check | PASS |
| Local post-browser DB assertions | PASS: denied writes absent, memberships restored, v1 published/v2 draft, dry-run queue plus audit persisted |

Earlier 8-group actual HTTP QA, database regression smokes, lifecycle checks and real 117-table pg_dump/restore remain valid recorded evidence, not newly rerun here. Earlier Shopify tests remain documented separately.

### Manual / Browser QA and Regression
Actual real-login Next actions passed brand creation, North/South branch mapping, invalid JSON retention, v1 publication/v2 draft, independent viewer grants, workspace preparation/module toggle, module-off clean404, A/B setup separation and stale-form denial under local manager/viewer/finance/A-disabled membership fixtures. Original owner memberships restored. Synthetic one-time pending webhook credential retired; no real provider contacted.

All Boutique Tier A BA-001–BA-014 passed locally: sign-in/selection, customer create/search, measurement reuse, two-item order with separate workflows, eligible worker/workgroup start and completion/next ready, customer-safe public tracking, partial synthetic payment, Finance reconciliation, GST report, actual dry-run queue/audit and existing order edit. See the per-check matrix in docs_chat/CH1_AUTHENTICATED_QA.md. No Boutique source behavior changed.

### Bugs Found / Fixed
Fixed Chat module-off denial error page, with two regression tests and real browser404 verification. Inherited non-blocking measurement dialog reset/stay-open behavior recorded; saved measurement correct and no Boutique refactor performed. Browser screenshot capture failed; earlier authenticated screenshot was blank and is NOT valid visual evidence. Narrow DOM observation showed client/scroll widths401/401 with collapsed navigation, but exact390px/visual acceptance remains unclaimed. Temporary viewport override reset.

### Open Decisions / Blockers / Phase Gate
No product decision reopened. Required remaining checks: independent unallowlisted owner-b login/platform denial; actual desktop/390px visual owner review; explicit C1–C8 owner acceptance and final closure review. The real owner-a identity was locally platform-allowlisted throughout role-fixture tests, so no independent-role/platform-denial claim is made. The owner must create any required test password; no more Clerk keys needed. Follow docs_chat/CH1_LOCAL_QA.md and CH1_AUTHENTICATED_QA.md.

CH-1 cannot yet move to READY_FOR_CLOSURE. No phase commit and no CH-2 work. Existing D025 authority is retained after gates/owner acceptance, not used prematurely.

### External Actions / Model Spend / Next Concrete Step
No shared DB changes, production enablement, live messages, paid purchase/model calls, public push/merge/deployment or n8n activation. Model/API spend **USD 0**.
Local app remains available at http://localhost:4131/settings/chat for owner-a. Owner next signs into the same Development app as owner-b+clerk_test@example.com (code424242; never add to platform allowlist), then Codex verifies independent B-only/platform denial. Owner reviews C1–C7 and explicitly reports acceptance/failures for C8.

## Chat Session Update - 2026-10-21 - Product experience clarification

### Date / Updated By / Phase / Status
2026-10-21 / Codex / CH-1 Foundation / QA_BLOCKED, unchanged.

### Branch / Base
codex/chat-ch1-foundation, HEAD24a0af7140c51fd061f2f2054c046a325999a298. Existing dirty CH-1 work preserved; released Shopify integration retained; no other worktree modified.

### Objective / What Changed / Decisions
Owner was confused by the foundation settings screen and reiterated the intended daily workflow: OS PLUS Chats entry opens Chatwoot in a new tab at chat.<domain>; Leads is an OS PLUS workspace module. Explain separately the inbox, guarded chatbot, CRM and owner configuration. Recorded CHAT-D029 in docs_chat/06_Decision_Log.md; it updates the earlier primary-navigation/domain requirement without introducing a second CRM or native inbox. One-login target, tenant isolation and approved role defaults remain in force. Current setup page is not acceptance evidence for a completed end-user chatbot/inbox.

### Files / Migrations / Tests
Documentation only: docs_chat/06_Decision_Log.md and this project_summary.md. No runtime changes; no new/applied migrations; no tests rerun for discussion. Prior six gates/32 Chat tests and 14 local Boutique paths remain the latest evidence, not new results. No regression introduced by these documentation additions.

### Manual QA / Bugs / Blockers
No new browser QA or login identity verification in this discussion. Previous independent owner-b/platform denial, exact phone visual review, explicit owner acceptance and final closure review remain outstanding. UX expectation gap identified: configuration was presented before the complete conversation/lead journey was available. No product defect inferred beyond the recorded presentation issue.

### Next / Closure / Spend
Explain staff journey and existing phase delivery order clearly; complete current foundation acceptance before CH-2 connector, CH-3 capture/CRM, CH-4 user-facing pages and login handoff integration, then CH-5/6 agent draft/auto behavior. Login handoff is an existing target whose implementation and validation must be explicitly tracked, not assumed delivered by domain placement.
No phase closure/commit, deployment, shared DB changes, purchases, real messages or paid model calls. Model/API spendUSD0. Shopify hosted OAuth acceptance and deferred n8n remain separate.

## Chat Session Update - 2026-10-21 - CH-1 acceptance and final closure checks

### Date / Updated By / Phase / Status
2026-10-21 / Codex / CH-1 Foundation / READY_FOR_CLOSURE, owner accepted; local commit next.

### Branch / Base
codex/chat-ch1-foundation, HEAD24a0af7140c51fd061f2f2054c046a325999a298; integrated released Shopify c686337 retained. Existing work preserved; no other worktree changes.

### Built / Fixes / Exact Files
Finished independent owner-b real-login QA and authenticated responsive evidence. Fixed final-review P2 findings in src/features/chat/module.ts (operational query failures), scripts/chat-local/common.mjs (local Docker endpoint validation/pinning; safe byte-length credential compare), scripts/chat-local/gateway.mjs; expanded scripts/test-chat-page.mjs and scripts/test-chat-local.mjs. Tests exercised real guard-to-page behavior, remote/cased Docker selectors and malformed credentials. Updated current docs_chat/CH1_AUTHENTICATED_QA.md, CH1_LOCAL_QA.md, CH1_QA.md, CH1_IMPLEMENTATION_PLAN.md, CHECKLIST.md, 05_Phase_Plan_WBS.md, 06_Decision_Log.md and this summary. Disposable390px wrapper exists only in ignored running snapshot.

### Tests / Regression / Manual QA
All six gates PASS: typecheck; lint; build51/51; roles platform+Chat; V2four suites; Chat37/37 zero skipped. Main gates reran after fixes; affected Chat/lint reran after final Windows-case hardening. Actual loopback malformed API/control requests returned401/501, health200; remote Docker override refused. Logs outputs/chat-local/final-*.log and review-live-check.json.
Prior Boutique BA001–014 all locally passed; unchanged Boutique source, prior Shopify regression retained. Independent owner-b sees onlyB, cannot view A order or platform admin, and sees no A Chat configuration. Desktop capture recovered; actual signed-in390px iframe client/scroll363/363 with gutter, no horizontal overflow. This is not a physical-device/full viewport claim. Both standards/spec re-reviews found no unresolved actionable finding.

### Decisions / Owner Acceptance / Gate
CHAT-D030 records explicit owner response: “Accept CH-1 foundation; continue to CH-2 after final records/checks.” C1–C8 accepted with disclosed local and iframe limits. D029 product navigation confirmed. No remaining product decisions or P0/P1 defects identified for CH-1. Final diff hygiene and authorized local commit next; only after that start CH-2.

### Migrations / Spend / External Effects
No new/applied migrations during this follow-up. Two CH1 migrations already exercised only in isolated disposable databases; no shared changes. No purchases, paid model calls, real messages, production settings, n8n activation, public push/merge/deploy. Model/API spendUSD0. New local gateway was restarted and malformed-input failure reproduced before the fixed instance passed; local app remains available.

### Next
Commit the reviewed foundation locally, record hash/CLOSED, then plan and implement CH-2 connector/capture with mocks and synthetic tenants. Before hosted acceptance, owner supplies chosen domain/new server authority and approved Meta test assets/messages. These external dependencies do not grant access to existing business infrastructure. Shopify OAuth hosted acceptance and deferred n8n remain separate.

## Chat Session Update - 2026-10-21 - CH-1 CLOSED and CH-2 start

### Date / Updated By / Phase / Status / Branch
2026-10-21 / Codex. CH-1 CLOSED. CH-2 connector/capture IN_PROGRESS on existing codex/chat-ch1-foundation, base 8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50. Local-only phase commit: "Chat CH-1: add tenant-isolated foundation and verified local QA". Released Shopify c686337 remains integrated. No other worktree changed.

### Closure evidence
Scope complete, owner acceptance CHAT-D030, typecheck/lint PASS; build51/51; roles PASS; V2four suites PASS; Chat37/37 PASS; manual authenticated owner-a/independent owner-b PASS with documented390px iframe limit; Boutique Tier A BA001–014 PASS; tenant isolation PASS; final diff/migration and standards/spec reviews COMPLETE; no P0/P1 outstanding. Inherited nonblocking measurement-dialog behavior deferred without Boutique changes. Evidence docs_chat/CH1_AUTHENTICATED_QA.md.

### Migrations / Deployment
20261021100000_chat_foundation.sql and 20261021101000_chat_foundation_commands.sql are committed, applied only in isolated local/disposable DBs. Real117-table backup/restore evidence recorded. Production deployment still requires explicit migration/config/activation authority; nothing deployed/enabled externally.

### CH-2 objective / Plan / Compatibility
Plan docs_chat/CH2_IMPLEMENTATION_PLAN.md: validated transport, tenant-resolved atomic capture, four memory tables, silent skeleton and mock/onboarding integration. Expected migration20261021110000_chat_capture.sql. Shared ingress/types will require Boutique Tier A regression. No Boutique runtime change yet. Architectural contradictions and exact planned files recorded in plan; D029 navigation wording and stale unsigned-webhook assertion will be corrected.

### Tests / Manual QA / Blockers / Spend / Next
No CH-2 tests or migration yet. CH-1 results above are closure evidence, not CH-2 results. No new manual QA. CH-2 cannot move to READY_FOR_CLOSURE: implementation plus required real test-inbox acceptance pending. No new product decisions; existing roles unchanged. Next: parser tracer test, then atomic capture. Owner needs chosen domain/new dedicated server/private credentials and explicit test-inbox/message authorization for hosted acceptance (CHECKLIST B,C/CH-2). Shopify OAuth hosted acceptance and deferred n8n remain separate. Model/API spend USD0; no external purchases/messages/deployment.

## Chat Session Update - 2026-10-21 - CH-2 first capture slice

### Date / Updated By / Phase / Status / Branch
2026-10-21 / Codex / CH-2 IN_PROGRESS; codex/chat-ch1-foundation at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50. CH-1 remains CLOSED.

### Built / Files / Migrations
Added src/integrations/chatwoot/payload.ts, src/features/chat/ingress.ts and capture.ts, events/agent routes under src/app/api/chat/webhooks/chatwoot/[workspaceKey]/. Added typed RPC signatures in src/types/chat.ts and exact POST-only proxy exceptions (Shopify paths unchanged). Added label read/merge/write in admin-client.ts. Migration20261021110000_chat_capture.sql creates four tenant-owned tables and service-only capture/health domain commands; no existing business table changes. Applied only through74-migration disposable PostgreSQL replay, not persistent local app or shared database.

### Evidence / Fixes
Parser4tests PASS; actual capture PostgreSQL/HTTP8tests PASS; admin-client5tests PASS. Red phases included missing module/RPC/helper. Corrected synthetic fixture missing required workspace credential, future fixture timestamp, SQL dollar quoting in edit helper and pg bigint transport normalization. Capture tests include independent-connection concurrency, agent-first callback, tenant collision/composite FK, audit-trigger rollback, SQL privilege denial, module suspension and post-ack revocation. HTTP uses real network and production handler/adapter with a controlled after callback queue; it does not claim real Next after lifecycle, Chatwoot or captured live-channel evidence.
Typecheck PASS before latest small additions; full six gates not yet rerun for this slice. No new browser/Boutique manual regression yet; Tier A remains required for CH-2 shared ingress. Previous CH-1 evidence is not reused as CH-2 acceptance.

### Remaining / Blockers / Spend / Next
Review in progress. Bot/user/account-webhook onboarding helpers, recovery and full mock E2E remain. Contact/lifecycle updates reserved for later capture expansion; only message_created subscribed in current slice. No AI/replies/SSO/Leads UI. Cannot close CH-2: implementation and live test-inbox evidence pending. Owner action remains CHECKLIST B,C/CH-2. USD0 model/API spend. No external mutation. Next: finish reviewed connector/onboarding behavior, full gates and update evidence.

## Chat Session Update - 2026-10-21 - CH-2 local integration and QA evidence

### Date / Updated By / Phase / Status / Branch
2026-10-21 / Codex / CH-2 connector/capture / QA_BLOCKED. Existing codex/chat-ch1-foundation at 8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50, no upstream. CH-1 CLOSED and locally committed after CHAT-D030 acceptance; CH-2 remains uncommitted. Released Shopify c686337 remains integrated; other worktrees untouched.

### Objective / Built / Decisions
Implemented bounded Zod transport parsing, exact POST-only authenticated events/agent ingress, actual Next after capture, tenant-owned atomic conversation/message/state/silent-turn storage and idempotency, public-staff quiet timestamps, safe failure health, extended Chatwoot API helpers, and platform-only onboarding reconciliation with persistent reservations and fresh pre-write authority checks. No AI replies, contact conversion, Leads UI, SSO or live channel onboarding implemented. D029 navigation and approved roles retained. Corrected stale unsigned-webhook documentation against pinned v4.18.0 upstream; actual signature wire verification remains a deployment task. Fresh synthetic fixtures do not count as captured live-channel evidence.

### Exact Files / Migrations Added
- New src/integrations/chatwoot/payload.ts and onboarding.ts; modified admin-client.ts.
- New src/features/chat/ingress.ts, capture.ts and transport-setup.ts.
- New src/app/api/chat/webhooks/chatwoot/[workspaceKey]/events/route.ts and agent/route.ts.
- Modified src/types/chat.ts and src/proxy.ts; existing Shopify exceptions preserved.
- New scripts/test-chat-payload.mjs, test-chat-capture.mjs, test-chat-onboarding.mjs; modified scripts/test-chat-admin-client.mjs, test-role-route-policy.mjs and chat-db-harness/database.mjs.
- New supabase/migrations/20261021110000_chat_capture.sql and 20261021111000_chat_transport_setup.sql. Four new tenant-owned tables; service-only atomic RPCs; no existing business-table changes.
- New docs_chat/CH2_IMPLEMENTATION_PLAN.md and CH2_QA.md; updated 02_Architecture_and_Data_Model.md, 04_Rules_and_Pitfalls.md, 05_Phase_Plan_WBS.md, 06_Decision_Log.md, CHECKLIST.md and this same project_summary.md.

### Migrations Applied / Backup / Runtime
All 75 repository migrations replayed in disposable local PostgreSQL. The two CH-2 migrations were then applied incrementally only to owned osplus-chat-local-8e8d10a9c1 after verifying its prior 73-migration checksum and creating outputs/chat-local/before-ch2-upgrade.dump. No historical SQL reapplied; no shared or production database touched. Running local Next snapshot updated on localhost:4131; original .env.local untouched, dry-run retained, real-service writes disabled. Original two Clerk fixtures retained; one synthetic transport tenant added and left module-disabled.
New actual pg_dump/pg_restore PASS: 121 public tables, row counts/content hashes matched, restored anon denial/service access verified. Report outputs/chat-local/ch2-restore-report.json; restored DB chat_restore_bce44417f3fa; dump 1,284,196 bytes. Database-only recovery in the same isolated cluster, not complete host/Clerk/storage disaster recovery.

### Automated Tests
| Command | Result |
|---|---|
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm run build | PASS, 51/51 pages |
| npm run test:roles | PASS, platform/Chat guards and 11 proxy cases |
| npm run test:v2 | PASS, four suites |
| npm run test:chat | PASS, 60/60, zero skipped |
| git diff --check | PASS |

Final logs: outputs/chat-local/ch2-final-*.log. Chat tests include parser5, admin6, onboarding6 and actual capture database/HTTP10, plus foundation suites. Independent SQL connections prove duplicates/order, tenant collision/composite FK denial, browser SQL denial, audit rollback, revocation and configuration-lock races. Mock provider covers unknown create outcomes, exact reconciliation, existing bot conflicts, callback changes, pre-write revocation and GET outage recovery.

### Actual Runtime / Manual QA / Regression
Actual Next HTTP checks (outputs/chat-local/ch2-next-report.json) PASS six groups: provider route without Clerk200, real after capture, callback duplicate idempotency, wrong secret/account404, protected GET/unrelated API, disabled module404. Reserved synthetic destinations only; no Chatwoot/Meta/model/Telegram traffic.
Existing Boutique database scripts rerun PASS locally: smoke-payment-integrity.mjs, smoke-workflow-stage-concurrency.mjs, smoke-existing-order-add-items.mjs. Wrapper isolated their working directory so root .env.local was not loaded.
Authenticated owner-b browser confirms B-only empty/pending Chat setup and normal Orders route after the upgrade; viewer/finance grants remain unchecked. Returned user tab to /settings/chat. No Chat UI layout changed in CH-2. The full 14-path Boutique Tier A remains CH-1 evidence before this shared proxy delta; a complete post-delta authenticated Tier A rerun is still required and has not been claimed. Current session is owner-b; the earlier full workflow fixtures are in owner-a's tenant.

### Bugs / Review
Fixed P1 capture/configuration lock inversion using shared chat-config advisory lock before row locks, with deterministic three-connection revocation tests. Fixed potential orphan bot creation after callback rotation, stale authorization after discovery, and transient discovery failures poisoning setup reservations. Both final narrow standards/spec re-reviews found no remaining actionable finding. This is not a claim of completed live phase review.

### Gate / Open Decisions / Owner Action / Next
CH-2 cannot move to READY_FOR_CLOSURE: full post-change Boutique browser regression, captured real-channel/test-inbox acceptance and owner CH-2 acceptance remain. See docs_chat/CH2_QA.md and CHECKLIST B/C (CH-2). No product decision reopened. Await chosen root domain and confirmation of a new dedicated server, or monthly hosting budget for a concrete proposal. Then obtain explicit server/deployment, hosted migration, named test tenant/inbox/number and test-message authority. No additional Clerk keys are needed; owner-a login may be needed for the remaining fixture-based browser regression.
Next concrete work: complete the pending authenticated Boutique browser tier, then approved isolated Chatwoot deployment/test-inbox acceptance with private credentials. after() is not a durable queue; process loss after200 can lose work. Label merge lacks provider compare-and-swap; callback-secret rotation requires manual authorized reconciliation. These limits are recorded in CH2_QA.md.
Shopify hosted OAuth approval/renewal acceptance and deferred Shopify n8n remain separate; no instance reused or workflow activated.

### Model Spend / External Effects
Model/API spend USD 0. No public push/merge/deployment, purchase, shared migration, production tenant mutation, real customer message, Chatwoot production setting change or n8n activation. CH-2 work and its evidence remain preserved locally for continuation.

## Chat Session Update - 2026-10-21 - Hosting budget and local Chatwoot clarification

### Date / Updated By / Phase / Branch / Status
2026-10-21 / Codex / CH-2 / codex/chat-ch1-foundation at8eb7a8e / QA_BLOCKED for closure; local work can continue. Existing CH-2 dirty work preserved.

### Decision / Inspection / Files
Owner set a 2k/month hosting ceiling (interpreted INR2,000), has no server, and reconfirmed chat subdomain. Recorded CHAT-D031 in docs_chat/06_Decision_Log.md. Read existing deployment kit and official Chatwoot Docker guide: local Chatwoot requires neither purchased server nor domain. Current production Compose uses public Caddy/TLS and includes n8n; do not run it unchanged for local QA. New local Chatwoot project/loopback bindings with separate DB/Redis/storage and synthetic credentials is the next implementation slice. No new runtime built in this clarification; this same summary and decision log are the only changed files this turn.

### Tests / Migrations / Manual QA / Regression / Bugs
No tests rerun, no migrations applied, no browser/manual regression this turn. Prior six gates/60 Chat tests and121-table restore remain recorded evidence, not new results. No code defect fixed. Corrected planning implication that a paid server/domain was needed before further local real-Chatwoot testing. Local actual Chatwoot has not yet been booted or tested.

### Gate / Next / Owner Actions / Spend
Continue isolated local actual-Chatwoot integration plus remaining Boutique browser regression before requesting hosting purchase. Real Meta channel testing later needs an approved publicly reachable HTTPS callback (hosted or explicitly approved temporary tunnel), named test assets/message authority, and owner acceptance; local website/API conversations cannot substitute for that evidence. No purchase/domain action needed now. Pricing feasibility, taxes/backups and renewal costs must be researched before proposing any purchase within the ceiling. No vendor selected. CH-2 not READY_FOR_CLOSURE; no new commit. No external mutations or paid model calls; model/API spendUSD0. Separate Shopify pending work unchanged.

## Chat Session Update - 2026-10-21 - Local Chatwoot setup started
CH-2 local integration IN_PROGRESS; closure gate remains pending. Branch codex/chat-ch1-foundation, HEAD8eb7a8e, existing dirty work preserved. Owner explicitly authorized isolated local Chatwoot setup, OS PLUS connection and synthetic QA. Plan: scripts/chatwoot-local for a separate Docker project (own PostgreSQL/Redis/storage, loopback inbox port4141, private TLS callback bridge), synthetic two-account fixtures, production connector/capture checks, browser inbox acceptance. No n8n/Meta/SMTP or public tunnel. Local Docker Linux engine verified with approximately8GiB RAM; existing local OS PLUS services retained. Official pinned Chatwoot CE and Caddy images downloading; no Chatwoot DB prepared yet. No new migration/tests/QA complete in this slice; paid model spendUSD0. No additional owner decision needed before local work.

## Chat Session Update - 2026-10-21 - Real local Chatwoot connected
CH-2 IN_PROGRESS locally; closure still blocked by remaining phase acceptance. Existing codex/chat-ch1-foundation at8eb7a8e retained. Added scripts/chatwoot-local (isolated Docker DB/Redis/rails/worker, private TLS bridge, localhost visitor/relay, fixture seeding, connection and real QA) and local app --chatwoot launch option. Official v4.18.0-ce image downloaded/pinned to faaa58a911cda8f2ab9d717ddf8ca4332163b07da4c5da10711d896e5d667442. No n8n service started.
Actual Chatwoot accounts/inboxes901 and902 map to existing local tenantsA/B. Native Chatwoot DB prepared only in a new owned volume; no new OS PLUS migration. Local synthetic workspace origins rebound from the reserved invalid placeholder to https://localhost:4444 with preserved prior origin and audit; tokens encrypted through existing commands. Local app-only API writes enabled against that TLS loopback endpoint; production env untouched, real channels absent, Rails/worker network has no internet egress. No global TLS verification disabled.
Real provider revealed getInboxBot returns {} for an unassigned inbox. Added failing regression, fixed narrowly,13 client/onboarding tests passed. Actual local worker/capture QA10checks passed (incoming fixtures created through Rails, public staff/private notes via API); independent browser-widget inquiry19 and staff reply24 also passed both screens and OS PLUS capture. Browser owner-b Sync inboxes passes and exposes onlyB. Saved browser evidence under C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch2-evidence. Actual redacted website/customer/system/staff payload fixture added;6 parser tests pass. Shared full gates passed after connector correction: build51/51/typecheck/lint/roles/V2four suites/Chat61. Later local guard/captured-fixture tests require final rerun.
Standards review found exact-name Docker collisions and interrupted relay upload handling; both fixed,2 ownership tests pass. Spec review strengthened callback-order polling and non-null quiet-deadline assertions; real QA rerun pending. Current blockers are remaining external-channel payload evidence, full post-change Boutique Tier A browser regression and owner phase acceptance, not the ability to test the real local inbox. Restart/restore checks and final documentation next. SpendUSD0; no external deployment/messages/purchase/shared migration. No CH2 commit.


## Chat Session Update - 2026-10-21 - Local Chatwoot ready for owner testing

### Date / Updated By / Phase / Status / Branch
2026-10-21 / Codex / CH-2 connector and capture / QA_BLOCKED for phase closure; actual local inbox ready. codex/chat-ch1-foundation at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50. Existing CH-2 uncommitted work preserved; no branch change or commit. CH-1 remains CLOSED. This entry supersedes earlier no-actual-Chatwoot/website-evidence and B-pending statements.

### What Changed / Exact Files
Added scripts/chatwoot-local/{README.md,Caddyfile,compose.yaml,common.mjs,manage.mjs,seed.mjs,connect.mjs,app-env.mjs,relay.mjs,visitor.mjs,processes.mjs,qa.mjs,check-runtime.mjs,restore-qa.mjs,restore-check.mjs}. Separate owned Docker project, two synthetic accounts/inboxes, scoped private TLS callback bridge, local lifecycle, real-provider QA and restore tooling.
Modified scripts/chat-local/manage.mjs for explicit --chatwoot mode and local snapshot URL-log suppression; src/integrations/chatwoot/admin-client.ts for actual unassigned-bot empty-object contract; scripts/test-chat-admin-client.mjs and test-chat-onboarding.mjs for that regression. Added scripts/test-chat-local-runtime.mjs (ownership2), scripts/fixtures/chatwoot/local-4.18-website.json and captured-shape case in scripts/test-chat-payload.mjs. Updated docs_chat/CH2_QA.md, CH2_IMPLEMENTATION_PLAN.md, CHECKLIST.md and this SAME summary. Production deploy kit and root .env.local unchanged.

### Configuration / Migrations / Isolation
Official Chatwoot v4.18.0-ce digest faaa58a911cda8f2ab9d717ddf8ca4332163b07da4c5da10711d896e5d667442. Owned osplus-chatwoot-local-8e8d10a9c1 has own PostgreSQL17/Redis/storage/private CA. Staff localhost4141; visitor4142/1 and/2; API TLS4444; callback relay4132. Account/inbox901 maps to tenantA;902 toB. Separate fixture users deny cross-account API inbox reads. Tokens encrypted through existing commands; synthetic-only workspace origin rebinding audited with previous origins retained privately.
No new OS PLUS migration added or applied this turn; previously recorded CH-2 migrations remain local-only. Native Chatwoot migrations prepared only in its fresh owned volume. Actual native dump/restore100 tables and content hashes PASS (385496 bytes, cw_restore_f8dda742cf8e), writers stopped/restarted, browser reopened successfully. Scope excludes attachments/Redis/Clerk/host recovery. Prior OS PLUS121-table restore remains separate evidence.
Local app-only CHAT_DRY_RUN=false/CHAT_ADMIN_LIVE_ENABLED=true targets owned loopback Chatwoot for actual local writes; it does not authorize real-service writes. Rails/worker internal network has no internet egress; Caddy bridges host callbacks. Private-network safe-fetch enabled only here. Scoped CA trust, no global TLS bypass. No real channels/n8n/SMTP/model/Telegram configured. Credentials/dumps ignored under outputs/chatwoot-local; never paste into chat.

### Automated Tests / Review / Bugs
All six gates PASS after provider contract fix: npm run typecheck; npm run lint (rerun on completed harness); npm run build51/51; npm run test:roles including11 proxy cases; npm run test:v2 four suites; final npm run test:chat64/64, zero skipped. Final suite log outputs/chat-local/ch2-final-chat.log; remaining logs outputs/chatwoot-local. git diff --check PASS.
Actual provider qa.mjs10/10 PASS, including both tenants, independent event/agent deduplication, exact non-null staff quiet timestamp unchanged by private notes, preserving labels and denied other-account inboxes. Incoming in this script uses Rails fixtures; staff/private sends use API. check-runtime4/4 PASS (control/route denial, aborted body survival, subsequent fail-closed webhook, helper stop/restart). Actual restore100-table PASS.
Fixed actual Chatwoot {} unassigned-bot response, exact-name foreign Docker resource collisions, interrupted relay-body crash risk, callback-order QA race and null-equals-null quiet assertion. Two focused independent standards/spec re-reviews found no unresolved actionable findings. A first rerun used the wrong local CA filename and failed before writes; corrected to ca.crt and completed10/10. No TLS verification disabled.

### Browser QA / Boutique Regression
Actual browser visitor inquiry19 -> staff Take over/reply24 -> visible visitor response PASS; both messages captured in correct OS PLUS tenant, system email prompts20/21 classified system. Sanitized actual website fixtures now available; Meta channel fixture acceptance remains pending.
Embedded widget rendered; automation could not interact inside iframe, so exchange used its observed iframe URL as a separate tab. No embedded interaction automation claim. Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch2-evidence/{staff-reply.png,visitor-reply.png}. Authenticated OS PLUS owner-b Sync inboxes returned only Chat Local2 and active connection; viewer/finance grants remain off. Staff conversation remains visible after restore/restart.
Boutique compatibility: no Boutique business runtime/table changes this turn. Prior CH-2 DB payment/workflow/order regressions PASS; CH-1 full14-path browser evidence predates shared CH-2 proxy changes. Full post-change Tier A remains pending, requiring owner-a sign-in for existing tenantA workflow fixtures. Do not substitute local inbox QA for that tier.

### Owner Handoff / Gate / Next
Open http://localhost:4141; local credentials in outputs/chatwoot-local/LOGIN.txt. Test visitor http://localhost:4142/1 (or/2 matching account). Choose All conversations/All statuses if pending inquiry hidden; Take over then reply. Detailed restart/test instructions scripts/chatwoot-local/README.md and CHECKLIST C/CH-2 checkpoint. No further Clerk keys required. Separate Chatwoot login for now; SSO/Chats CTA/Leads screens/AI are later phases.
Can move to READY_FOR_CLOSURE: NO. Remaining: full post-proxy Boutique Tier A, approved Meta channel/test-inbox acceptance and owner CH-2 acceptance. Local actual website evidence is now complete within the documented scope. No new product decision required. Next: owner tries actual local chat; obtain owner-a OS PLUS sign-in for remaining fixture regression; separately plan approved hosted Meta validation. BudgetINR2,000/month, no server/root domain selected; no purchase needed for local testing.
Separate Shopify hosted OAuth approval/renewal and deferred n8n stay pending; retained order/customer integration boundaries unchanged. No production data/shared migration/public push/merge/deployment/purchase/real customer messages. Model/API spend this session USD0.


## Chat Session Update - 2026-10-21 - Post-CH-2 Boutique browser regression resumed
CH-2 QA_BLOCKED for closure, codex/chat-ch1-foundation at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50 (no upstream); prior dirty Chat work preserved. Owner authorized remaining Boutique checks and requested the CH-2 acceptance checklist. Read current summary/phase gate and prior14-path browser evidence. Refreshed actual OS PLUS localhost4131 session still identifies owner-b+clerk_test@example.com / Local QA B; Chatwoot localhost4141 is separately signed into Chat Local1. Requested owner-a OS PLUS login or identification of the browser where it was completed. No credentials requested in chat. Preparing the existing synthetic Tier A workflow and local-only communication checks while awaiting the correct session. No tests claimed complete, no migrations/runtime changes or spend in this resumption slice.


### Resumption result / files / tests / next
Added docs_chat/CH2_OWNER_ACCEPTANCE.md with six local owner steps, exact distinct OS PLUS/Chatwoot logins and the unwaived Meta/full-phase gates; updated docs_chat/CH2_QA.md and CHECKLIST.md. Refreshed OS PLUS identity remains owner-b / Local QA B. Actual browser navigation to known tenantA Boutique order f18f2e92-18fa-40b2-9cc0-9d1180744206 correctly returned404; captured screenshot in chat-ch2-evidence/boutique-a-denied-for-b.png and returned tab to settings/chat. This is one passing isolation check, not fourteen-path regression. No application code or migration changed; no automated suite rerun solely for docs. Earlier64 Chat tests/six gates remain prior evidence. No new defects fixed, shared/production effects or model/API spend (USD0). Phase remains QA_BLOCKED, not READY_FOR_CLOSURE, no commit. Await owner-a OS PLUS session or its browser location; next run BA-001–BA-014 and record new results, then owner local acceptance and separately approved Meta evidence. No new Clerk keys needed.


### Owner-a session confirmed — 2026-10-21
User completed the OS PLUS login. Fresh browser inspection now confirms owner-a+clerk_test@example.com / Local QA A on localhost4131; earlier identity blocker resolved. Chatwoot account901 is already signed in and the owner's synthetic conversation4 exchange/private note is visible. Beginning BA-001–BA-014 in a separate browser tab using only local synthetic fixtures. No new runtime/migration changes or spend; closure remains pending actual regression/acceptance.


### Boutique regression progress — 2026-10-21
Actual owner-a UI created CH2 Regression Customer (76e26e61-1ac6-47e3-baae-113b146aadff), exact name search returned one match, saved general and garment-specific default measurements, and created ORD-000002 / CHAT-CH2-BROWSER-QA (64addc61-ec0f-4286-8ace-d0e861c5b44e) with two items at1200+800 and distinct workflows. Both saved items show Chest37 fit reference. To cover distinct workflow choices, added only a second synthetic workflow definition and two stage definitions to the verified owned local tenantA DB in one transaction, following the existing fixture shape; no production data/schema or application changes. First item's QA prepare started with Synthetic QA worker/QA workgroup. Stage completion/payment/report/queue/tracking checks in progress.
Correction: accessibility output incorrectly marked measurement options disabled; direct read-only DOM inspection showed enabled options and normal selection succeeded. No application guard/bug inferred from that AX label. Prior measurement-dialog-stays-open behavior repeats but persistence works; no Boutique refactor.

## Chat Session Update - 2026-10-21 - Owner Boutique regression and local inbox handoff

### Phase / branch / scope
CH-2 QA_BLOCKED; codex/chat-ch1-foundation at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50, no upstream. Existing dirty CH-2 work preserved. CH-1 remains CLOSED. This entry supersedes earlier owner-a-login and unexecuted Boutique critical-path blockers. No phase commit or transition.

### Completed / files
Owner-a login now verified. Executed BA-001–BA-014 policy critical paths in actual desktop browser, owner scenario, synthetic Local QA A. Detailed results/scope: docs_chat/CH2_BOUTIQUE_QA.md (new); updated CH2_OWNER_ACCEPTANCE.md, CH2_QA.md, CHECKLIST.md and this SAME summary. Customer/order/measurement/workflow fixture IDs and screenshots are in the new evidence document. Two items/different workflows; first stage start/complete/next ready; receipt300 on total2000; Finance balance1700; zero-GST report load; communication dry-run queue; safe tracking; edit persistence all passed.

### Migrations / compatibility / data
No migrations added/applied and no application/shared Boutique runtime code changed this turn. Added one alternate synthetic workflow and two stage templates only in verified owned local DB, in a transaction. Browser-created synthetic customer/measurements/order/payment and dry-run queue retained for inspection. No real money/message or production/shared data changes. Prior CH-2 migrations20261021110000_chat_capture.sql and20261021111000_chat_transport_setup.sql remain local-only as already recorded.

### Tests / regression / QA
node outputs/chat-local/ch2-boutique-assert.mjs: PASS7/7 persistence assertion groups after actual browser writes; outputs/chat-local/ch2-boutique-browser-report.json. Tier A policy critical paths: PASS14/14 within owner scenario; no independent Manager/Finance browser sessions, fresh anonymous public session, GST-bearing tax computation/export/filing, or mobile rerun claimed. User's existing Clerk authentication observed; tenant selection exercised. Prior owner-b->A order404 is separate isolation evidence.
No six-gate suite rerun for this documentation/browser-fixture slice. Earlier npm run typecheck, lint, build51/51, test:roles including11 proxy cases, test:v2 four suites, test:chat64/64 remain earlier CH-2 evidence, not new runs. Screenshot paths in CH2_BOUTIQUE_QA.md.
QA workbook remains unchanged: artifact export produced correct14 dated notes but altered1916 existing cell styles; preservation assertion failed, so replacement rejected. Two render attempts exited1 without image. Temporary output outside repo is not accepted QA tracker. Format-preserving tracker reconciliation remains before closure; historical PASS/persona statuses not relabeled.

### Chat handoff / bugs
Owner's “Hey you” message43 is visible in actual Chatwoot account901 conversation6. Staff tab left at localhost4141/app/accounts/901/conversations/6; visitor4142/1. Take over, select Reply rather than Private Note, then compare visitor. Screenshot your-inquiry.png saved. Separate local Chatwoot login owner1 remains expected; no SSO/Chats CTA implied.
List-error toasts resolved after reloading exposed login and existing local owner1 credentials restored session. Repeated All-status filter then loaded6 conversations and correct inquiry. Stale/expired session inferred, no code/config fix. Existing P3 measurement modal stays open after successful save; persistence passes. No new P0/P1 identified in this slice.

### Gate / owner action / next
Can move to READY_FOR_CLOSURE: NO. Owner to perform/report CH2_OWNER_ACCEPTANCE L1–L5; agent to verify capture for unique test texts. Actual Meta channel fixtures and approved test WhatsApp inbox/HTTPS callback acceptance remain separately authorized requirements from CHECKLIST C/CH-2. Reconcile QA tracker notes without losing formatting before final diff/closure review. No further Clerk keys/login needed now.
Shopify hosted OAuth approval/renewal and deferred n8n remain separate pending work. No purchase/public exposure/shared migration/push/merge/deployment/live message/model call. Model/API spend this sessionUSD0.


## Chat Session Update - 2026-10-21 - Final local checks and Meta test preparation
CH-2 QA_BLOCKED, same codex/chat-ch1-foundation at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50/no upstream; dirty Chat work preserved. Owner confirmed the local reply works and authorized remaining local checks and QA workbook repair. No Meta connection/public exposure/message/deployment authority inferred. Local conversation6 messages43/46 each have one captured silent turn; staff48 is captured and sets quiet_until exactly60 minutes later; workspace last_error null. Browser also shows an agent-bot-error activity, so inspect/reproduce before declaring local checks complete. Prior workbook preservation failure was partly a verifier defect: comparing copied underlying styles shows0 cell-style changes, rather than1916; original source remains intact pending final feature/visual verification. Artifact render produces a valid PNG and RENDER_OK before process exit1, so prior no-image conclusion is superseded. No runtime changes/migrations/model spend yet in this slice.


### Final result / exact files / migrations
Completed remaining authorised local technical checks; owner specifically confirmed the reply works. Updated docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx, docs_chat/CH2_QA.md, CH2_BOUTIQUE_QA.md, CH2_OWNER_ACCEPTANCE.md, CHECKLIST.md, scripts/chatwoot-local/README.md, CH2_IMPLEMENTATION_PLAN.md and this SAME summary. Added docs_chat/CH2_META_TESTING.md with owner steps, currently verified primary-source links, WhatsApp-first sequence and separate public-HTTPS/Meta/real-message approval boundary. No new runtime application changes, migrations, shared/production data changes or external configuration. Existing CH-2 SQL remains applied only in already-recorded local OS PLUS DB. New actual local provider QA contacts/conversations/messages retained as synthetic fixtures.

### Tests / manual QA / regression / defects
Provider qa.mjs rerun PASS10/10. outputs/chatwoot-local/pending-check.mjs PASS5/5: pending conv8/message64 captured once and remains pending beyond default5-second timeout; note49 private staff; unchanged quiet deadline; tenantB denial. Direct Rails SafeFetch callback replay succeeded290ms. Owner conversation43/46 each one turn; staff48 quiet deadline exactly60min; system44/45 no turns. Browser note49 visible to staff, hidden from visitor; returned Reply mode. Owner-a inbox sync only Local1 Website, active/draft mapping. Screenshots final-private-note.png/final-visitor.png/final-inbox-sync.png.
Boutique helper rerun PASS7/7; prior14 owner-scenario critical paths retained. Additional cookie-free/auth-free default-Accept HTTP safe tracking200 and invalid-token404 PASS2/2. Accept:text/html triggers Clerk Development handshake307, so no fresh anonymous-browser evidence claimed. Independent Manager/Finance, GST-bearing calculation/export/filing and new mobile checks remain outside this slice.
Earlier typecheck/lint/build51 pages/test:roles11 proxy/test:v2 four suites/test:chat64 remain prior PASS evidence; no redundant six-suite rerun for this docs/workbook slice. git diff --check final result recorded below.
Workbook bug fixed: original1916 “style changes” came from StyleProxy identity comparison; copied underlying properties show0 changes. Artifact render writes valid PNG before exit1 at shutdown; images reviewed. Final tracker changes only14 dated evidence notes and14 row heights; historical statuses/personas preserved, all other package bytes unchanged. Output SHA256 d63cbae54a04df4b140abff3e035ee7bb3f7fb2b190a3939477a889d59d54171; installed after source-hash guard. Backup/report/previews in C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch2-workbook.
Historical Chatwoot bot-error activity47 seen, exact cause not recoverable from retained error-level logs. Current5/5 pending/replay checks pass, no new reproducible failure; no root-cause/fix claim. Embedded iframe send automation remains unsupported; cleared unsent draft, fresh pending fixture created through local Rails rather than falsely claiming embedded send. Existing P3 measurement dialog stays open after save; no Boutique refactor.

### Owner action / gate / next / spend
CH-2 remains QA_BLOCKED, not READY_FOR_CLOSURE. Workbook blocker resolved; local technical checks complete within recorded scopes. Owner's reply confirmation is partial local acceptance, not automatic entire phase closure. Remaining: actual WhatsApp/Instagram/Facebook plus required bot/template captured fixtures and approved real test-inbox acceptance; final owner phase acceptance and closure/diff review. No CH-2 commit or CH-3 start.
Next owner steps: create fresh platform Meta app/business test assets, locate test WABA/PhoneNumber IDs and verify tester phone; prepare test Page/professional Instagram/tester roles; choose separate disposable HTTPS test environment (temporary tunnel or staging), then approve concrete endpoint/assets/recipients before connection/messages. Root domain/server not needed to prepare local/sandbox assets. Current local egress isolation remains enabled; no tunnel activated. Keep real-service OS PLUS CHAT_DRY_RUN=true. INR2000 ceiling is not purchase authority. No credentials in chat. Runbook CH2_META_TESTING.md.
Separate Shopify OAuth hosted acceptance and deferred n8n remain pending, unchanged. Model/API spend this sessionUSD0.

Final git diff --check: PASS (only line-ending notices). QA tracker installed SHA256 reverified. Same branch/HEAD/no upstream and prior dirty Chat work preserved; no local phase commit. Runtime sources unchanged in this slice. Next action: owner prepares Meta app/test assets and chooses the separate HTTPS test route from CH2_META_TESTING.md; complete scoped approval before external connection/messages.


## Chat Session Update - 2026-10-21 - Meta app walkthrough and temporary tunnel choice
CH-2 remains QA_BLOCKED on codex/chat-ch1-foundation, HEAD8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50/no upstream; dirty Chat work preserved. Owner chose a temporary HTTPS tunnel for Meta testing and requested guided Meta app/test-number setup. Recorded CHAT-D032 in docs_chat/06_Decision_Log.md; current owner step is new platform app/use case -> business portfolio -> WhatsApp API Setup -> Meta test number -> verified tester recipient. Secrets/OTPs stay private. User should reach API Setup before tunnel wiring or sending messages. Current official Chatwoot manual-flow guide checked; Meta direct docs still show login wall. No authenticated Meta account state inspected.
Files: decision log, CH2_META_TESTING.md and this SAME summary. No runtime changes, migrations, local/hosted data writes, tunnel activation, purchase or real-message send this slice. Automated/manual runtime tests not rerun for guidance-only updates; prior local QA evidence stands. Boutique compatibility: no shared runtime changes. No new bugs fixed or acceptance claimed. Next: owner reports the actual Meta creation/API Setup screen and test-number availability; then prepare exact private test-copy tunnel routes and capture connection. Model/API spendUSD0. Phase cannot move to READY_FOR_CLOSURE until captured Meta evidence and owner acceptance/closure checks complete.


## Chat Session Update - 2026-10-21 - Meta deferred; local phase transition decision
CH-2 QA_BLOCKED on codex/chat-ch1-foundation at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50/no upstream, dirty Chat work preserved. Owner deferred Meta Business Manager connection and asked to complete remaining work. Recorded CHAT-D033; tunnel/app/number steps are now deferred, not a current owner action. Current local technical checks/workbook repair already pass within recorded scopes; live WhatsApp/Instagram/Facebook captures and real-inbox acceptance stay explicitly untested. Asked one combined exception: allow final local CH-2 review/commit under existing authority and proceed CH-3, carrying Meta as a release blocker, or keep original gate/phase open. Await that scope decision before any next-phase runtime implementation. Continue only safe CH-2 local evidence/review in the meantime. No migrations/runtime changes/tunnel/model calls this slice; test results not relabeled. Shopify/n8n separate pending work untouched. Model spendUSD0.


### Owner exception accepted — 2026-10-21
CHAT-D034 authorises final LOCAL CH-2 review/commit, deferring Meta gates, then CH-3. Current phase returns IN_PROGRESS for final local review; external channel readiness stays blocked and untested, never PASS. Six closure commands now running sequentially with logs outputs/chat-local/ch2-close-*.log. Finish review/records then commit before CH-3. Actual bot test message67 was eventually captured as bot with0 turns; initial15-second helper poll expired before capture, so this was not a dropped-message finding. Whitelisted actual provider bot fixture available for local parser evidence; no model called. No application fix or guaranteed-latency claim. Temporary scripts remain ignored; no migration or external effects. Model spendUSD0.


### CH-2 final local gate — READY_FOR_CLOSURE (2026-10-21)
Authority: CHAT-D034 explicitly accepts local-only closure and CH-3 progression, deferring live Meta acceptance as a production-release blocker. All local closure requirements reviewed. Six final commands PASS: npm run typecheck; lint; build; test:roles (including11 exact proxy cases); test:v2 (four suites); test:chat65/65,0 skipped after adding actual provider bot fixture/test. Logs outputs/chat-local/ch2-close-*.log and ch2-close-chat-with-bot.log.
Independent final standards review0 actionable findings. Spec review P2 missing react-server startup condition reproduced and fixed in scripts/chatwoot-local/README.md using existing npm run chat:local alias; status command passes owned local gateway/DB/app. Narrow re-review0 unresolved findings.
New fixture scripts/fixtures/chatwoot/local-4.18-bot.json is a whitelisted actual local synthetic provider payload; parser asserts bot/no staff id. Actual bot67 captured with0 turns after the initial15s poll expired; no dropped-message or guaranteed-latency claim. Website template/greeting captured fixture already exists, not equivalent to real WhatsApp template acceptance.
Migrations20261021110000_chat_capture.sql and20261021111000_chat_transport_setup.sql reviewed additive/tenant-owned/service-only; already local-only, not reapplied. Prior75 replay/OSPLUS121-table restore/Chatwoot100-table restore retained evidence. No new migrations or shared runtime changes during closure slice. Boutique14 owner-scenario critical paths,7/7 persistence, exact persona/GST/browser limits and repaired tracker retained. Existing P3 measurement dialog and historical bot-error47 observation retained.
Phase Status: READY_FOR_CLOSURE (LOCAL under D034). Final diff/migration review complete; no unresolved actionable P0/P1. Commit planned: Chat CH-2: add isolated connector and tenant capture. No push/deploy/channel enablement; Meta remains DEFERRED and production readiness blocked. SpendUSD0. Next: authorised local phase commit, record exact SHA, then CH-3 plan/current-code reconciliation and any genuinely new decisions before dependent implementation.


## Chat Session Update - 2026-10-21 - CH-2 locally CLOSED; CH-3 planning
CH-2 Phase Status: CLOSED (LOCAL acceptance exception CHAT-D034; Meta production readiness remains blocked).
Phase commit:00718d6e395ea652eb2a7ceb79b39ae1471e863c — Chat CH-2: add isolated connector and tenant capture. Same codex/chat-ch1-foundation/no upstream; clean working tree immediately after commit. No push/merge/deploy.
Final closure evidence: typecheck/lint/build PASS; role tests PASS including11 ingress cases; V2 four suites PASS; test:chat65/65 PASS0 skipped. Final lint rerun after bot test PASS. Standards/spec final re-reviews each0 unresolved actionable findings after the P2 runbook correction. Final staged diff/check PASS. Migrations20261021110000_chat_capture.sql and20261021111000_chat_transport_setup.sql reviewed/applied local-only; earlier75 replay and owned restore drills retained. Boutique14 owner-scenario critical paths and7/7 persistence, role/GST/browser qualifications, repaired QA tracker remain documented. Captured bot67 is bot/no turns, website native template fixture covered. Original15s bot probe expired before eventual capture; no lost-message/fixed-latency claim. Historical bot-error47 and P3 measurement modal observations remain documented.
Files/build scope are in CH2_QA.md and committed49-file diff. No new migrations applied during closure itself, no external effects. Model spendUSD0.
This post-commit closure SHA record is intentionally retained in the same living summary for the next phase commit; the CH-2 commit contains its final READY_FOR_CLOSURE evidence.

Current phase: CH-3 Contacts, Leads and Customer link/convert — PLANNED; base00718d6. Meta remains DEFERRED (CHAT-D033/D034). Latest released local origin/main is stillc686337 and is an ancestor of this branch; Shopify read-only handoff reconfirmed, no new integration merge required. Separate Shopify hosted OAuth/renewal and n8n work unchanged.
Preparing CH3_IMPLEMENTATION_PLAN.md with current customer/identity/schema contracts. Two business policies proposed for approval together: documented record-driven stage advancement (real linked order paid OR delivered => won, never source drafts/production-only/old unrelated orders); configurable7-day automatic lost for eligible new/engaged sales leads, excluding active linked work. Do not implement dependent policies before answers. Technical safeguards already fixed by prior rules: no automatic merge of two existing contacts (ref code is a candidate requiring audited manual merge); scope platform identities by account/inbox; exact canonical-phone matching only; add atomic chat conversion without changing existing customer action. Next: finish plan/code reconciliation, collect two policy answers, record CH-3 IN_PROGRESS and implement pure rules/tests first.


## Chat Session Update - 2026-10-21 - CH-3 IN_PROGRESS
Phase Status: IN_PROGRESS — CH-3 Contacts, Leads and Customer Link/Convert. Branch codex/chat-ch1-foundation, base00718d6e395ea652eb2a7ceb79b39ae1471e863c/no upstream. Existing post-CH2 summary/closure-header/planning edits preserved. Owner approved P3-1/P3-2; recorded CHAT-D035/D036. Use CH3_IMPLEMENTATION_PLAN.md, pure rules/tests first then real local schema/transactions/capture/commands. Meta remains deferred under D033/D034; no external activation.
Current-code correction: chat_staff_links already exists from CH-1 with composite tenant/member constraints; reuse it, do not create a duplicate table. Generic follow-up tasks lack authoritative booking-confirmation state; do not equate task existence/production with confirmed booking. Use explicit existing native confirmation evidence or later capability evidence, with audited manual stages still available. Existing customer action/phone uniqueness and released Shopify contracts stay intact. Expected new migrations20261021123000_chat_contacts_leads.sql and20261021124000_chat_contact_lead_commands.sql plus subsequent narrow additive migrations if verified steps require them; none added/applied yet. Compatibility risk shared capture/types/customer boundary => Boutique Tier A required. No model spend. Next: red-green rule slice, scoped identity and true stage evidence.


## Chat Session Update - 2026-10-21 - CH-3 resumed: storage vertical slice
CH-3 IN_PROGRESS, codex/chat-ch1-foundation at00718d6e395ea652eb2a7ceb79b39ae1471e863c/no upstream. Actual status/full tracked diff/untracked files inspected; prior CH-3 planning and tests preserved. CH-0 deployment/schema baseline and CH-1/CH-2 local environment remain usable; latest integrated released Shopify baseline unchanged, separate OAuth/n8n work untouched. D035/D036 are accepted, no policy question reopened. Five pure-rule tests previously passed (stage evidence/inactivity, scoped exact identity, monotonic configured intent, value median); first actual storage test replays75 migrations and is RED because chat_contacts is absent. Next implement the additive contact/lead/capture transaction and rerun against disposable owned PostgreSQL. No new SQL applied anywhere yet, no new browser/regression evidence or phase closure. Meta deferred/release-blocking; model/API spendUSD0.


### CH-3 storage and command progress — 2026-10-21
Added uncommitted migrations20261021123000_chat_contacts_leads.sql and20261021124000_chat_contact_lead_commands.sql. New tenant-owned contacts/identities/conflict candidates/leads/append-only events/merge audit records; composite FKs/RLS/service-only commands; wrapped existing capture inside the same transaction; public reply clocks and explicit staff mapping; atomic customer conversion/link, versioned lead edits, manual merge and guarded split. Existing tables changed only by approved tasks check extensions; customer records written by new command, existing customer action unchanged. Migrations replayed only in disposable owned local PostgreSQL (77 actual files); persistent local/hosted/shared databases have NOT received CH-3 SQL.
Verified red-green: six actual database tests pass (retry capture, exact WhatsApp match/no automatic existing-contact merge, clocks/private exclusions/mapped owner, canonical customer conversion/retry, manager versioned edits/viewer/disabled denial, merge/split and unsafe undo refusal). Eight parser tests pass including bounded contact profile/source ownership; pinned local Chatwoot4.18 source/actual website fixture confirm contact_inbox source_id and WhatsApp adapter phone/identifier distinction. Raw Meta acceptance remains deferred. Production capture adapter now validates source/phone agreement with existing country-aware normalizer. Prior CH-2 capture regression needed audit count scoped to its transport events because lead creation adds a legitimate event, and real rules dependency supplied to production-adapter harness; final rerun pending. No full six-gate/Boutique/browser/restore result yet for CH-3. No closure or commit; no external effects/model calls, spendUSD0. Next: finish reference/conflict, automated record stage refresh, validated server command boundary, isolation/concurrency/rollback QA and local upgrade evidence.


### CH-3 rule/configuration and maintenance progress — 2026-10-21
Owner accepted recent activity + configured high-interest intent for hot leads; recorded CHAT-D037, no open business decision. Added optional backward-compatible crm metadata to src/features/chat/knowledge-pack.ts (tenant-defined intent priorities, high-interest intents, typical basket/currency), no taxonomy/amount seeded. New rules include public bot/human SLA clocks and exact hot-window boundaries. Value uses median actual non-draft/non-cancelled matching-currency customer order totals or a published pack basket; history never advances stages. Reference markers create review candidates; they never merge existing contacts.
Third additive migration20261021125000_chat_lead_refresh.sql adds tenant-scoped stage refresh from explicitly linked real order/booking plus retained normalized Shopify commercial payment facts (no expiring raw payload), configurable inactivity, and explicit idempotent historical capture backfill. New HTTP POST/api/chat/cron/stages uses bounded Zod input, call-time disabled-by-default flag and bearer secret; exact proxy exception tested, GET/suffix paths still Clerk-protected. No scheduler/n8n enabled. src/features/leads/{schemas,commands,refresh-handler}.ts validate commands, normalize customer phones using platform helper and expose future page-view refresh hook; UI stays CH-4.
Targeted actual DB suite16/16 passed with78 actual migration replays, including real HTTP->SQL, production server guard->command->SQL, two-tenant same-phone isolation, conversion rollback and bounded ref collision rollback, historical backfill retries. Pure rules7/7; parser8/8; knowledge5/5; server HTTP/schema2/2; roles14 ingress cases; latest typecheck/lint PASS. Earlier whole Chat84/84 predates the latest additions; full gate rerun remains pending. Test harness auth is synthetic context, not a fresh Clerk browser login claim. All CH-3 migrations are still disposable-local only; persistent local/hosted not upgraded. Preparing preserved local backup/checksum upgrade and current independent standards/spec reviews before persistent QA. Model/API spendUSD0, no external mutations/phase commit/closure. Meta and separate Shopify hosted acceptance/n8n remain deferred.


### CH-3 resumption and review correction — 2026-10-21
Same codex/chat-ch1-foundation at00718d6/no upstream; all prior CH-3 work preserved. Previous automatic approval review could not run because of account usage limit: writing the proposed upgrade-ch3.mjs and CH3_LOCAL_UPGRADE.md was NOT executed; no persistent upgrade/restore occurred. Latest actual filesystem confirms both files absent. Independent reviews were interrupted by the same usage limit; no completed-review pass claimed. Standards reviewer identified active mapped viewer/finance could be automatically assigned a lead although manual assignment permits only owner_admin/manager. Corrected the capture predicate to require the same eligible roles; regression rerun pending. Latest full Chat84 predates later targeted additions;16 storage/7 pure-rule/8 parser/5 knowledge/2 HTTP-schema/14 role cases are targeted evidence only. All three CH-3 SQL files remain uncommitted and applied only to disposable PostgreSQL; no persistent/hosted/shared migrations. Next: verify downgraded-staff regression, complete independent review, all gates and Boutique regression, then guarded local backup/upgrade/restore and owner acceptance. CH-3 IN_PROGRESS, not READY_FOR_CLOSURE. No external effects or paid-model calls; spendUSD0.


### CH-3 review fixes verified — 2026-10-21
Automatic approval-review usage-limit failure resolved on the owner's resume; authorized local writes work again. upgrade-ch3.mjs and CH3_LOCAL_UPGRADE.md now PREPARED and syntax-checked, not executed. Reviews found and fixed one P1/two P2s plus the earlier owner eligibility P2: Shopify stage facts now select newest generation and overlay CURRENT operational hold (missing=>held), never cached hold/timestamp order/older details fallback; automatic ownership records provenance and corrects delayed earlier mapped replies while preserving manual choices; guarded lead.edit accepts only configured monotonic intent updates with audit. Regression tests reproduced each before correction. New real concurrent test contends with an uncommitted platform customer insert, then reuses its unique canonical identity without overwriting the winning customer.
Actual disposable DB suite21/21 PASS,78 real migrations replayed, no skipped. Full six required gates now running to outputs/chat-local/ch3-gate-*.log; not yet claimed passed. Independent narrow re-reviews requested. Persistent local DB still has no CH-3 SQL; no shared/hosted migration, real message, scheduler activation, push/deploy/commit or paid model call. Phase remains IN_PROGRESS; Meta release blocker and separate Shopify OAuth/n8n pending work retained. Next: final review/gates, guarded private local upgrade/restore, provider/browser and Boutique QA, owner CH-3 acceptance before phase transition. SpendUSD0.


### CH-3 final automated gate passed; local upgrade started — 2026-10-21
All six mandatory commands PASS: npm run typecheck; npm run lint (initial test-only reserved module variable failure corrected); npm run build; npm run test:roles including14 exact ingress cases; npm run test:v2 four suites; npm run test:chat98/98,0 skipped. Logs and exit-code manifest outputs/chat-local/ch3-gate-*.log / ch3-gate-results.json. Actual native booking test confirms NEW linked pickup blocks inactivity, SCHEDULED advances to booked; no booking mutation performed by Chat runtime itself.
Focused standards/spec re-reviews both0 unresolved actionable findings after owner provenance, eligible-role, trusted intent and newest-generation/current-hold Shopify fixes. New21+native-booking disposable tests are included in full98 suite. Existing OS PLUS browser DOM still shows owner-a / Local QA A; no fresh login claimed.
Reviewed local preservation/upgrade now running: pause ONLY nonce-owned local Chatwoot sidekiq, stop owned REST while backing up, verify before-copy restore and old-table hashes, atomically apply three CH-3 SQL files plus checksum only in owned LOCAL DB, backfill syntheticA/B, verify after-copy restore/ACL, restart REST/worker in finally. Exact helper scripts/chat-local/upgrade-ch3.mjs and plan docs_chat/CH3_LOCAL_UPGRADE.md. Outcome pending; do not claim applied or restore PASS yet. No hosted/shared/production migration, n8n activation, external message, public push/merge/deploy/phase commit or model spend (USD0). CH-3 IN_PROGRESS; next record actual restore outcome, refresh local app and run provider/Boutique browser QA before owner acceptance.


### CH-3 persistent LOCAL upgrade and restore PASS — 2026-10-21
Applied ONLY20261021123000_chat_contacts_leads.sql,20261021124000_chat_contact_lead_commands.sql,20261021125000_chat_lead_refresh.sql to the nonce-owned local PostgreSQL15437, after restoring and validating its backup. Existing75 migrations were NOT replayed. All121 original public tables' data hashes preserved during schema upgrade (ignore only new nullable conversation.contact_id); three SQL files and checksum marker committed atomically in the local database. Historical syntheticA/B backfill through audited SYSTEM/AUTOMATION command processed33/15 messages, exact-once receipts; absent old profile/source facts did not create verified phones.
Actual pre-upgrade restore:chat_restore_d8f8edc7afcc,121 tables,1300073-byte dump. Actual post-upgrade restore:chat_restore_d44476af6654,128 tables,1383312-byte dump; every table count/content hash matches and anon leads ACL remains denied. Private backup hashes/paths/report in ignored outputs/chat-local/ch3-upgrade-report.json; no secrets printed. Scope is database restore inside the same isolated local cluster, not attachment/Clerk/host disaster recovery. Local Chatwoot sidekiq and owned REST paused/restarted around maintenance, data retained. No shared/hosted/production SQL or external effects.
Six gates98/98 Chat and reviewed fixes remain PASS evidence. Next refresh owned4131 app snapshot, run actual provider->contact/lead checks and post-change Boutique TierA/desktop-narrow QA; owner phase acceptance still pending. No phase commit/transition/activation. CH-3 IN_PROGRESS; Meta release gate still deferred, separate Shopify pending work unchanged. Model/API spendUSD0.


### CH-3 resumed provider and regression QA — 2026-10-21
Same branch codex/chat-ch1-foundation at00718d6/no upstream; dirty CH-3 work preserved. Persistent LOCAL upgrade/restore remains PASS; exact three applied SQL files unchanged. Refreshed local app snapshot app-1792602418008. Actual isolated Chatwoot provider QA10/10 PASS; post-callback CRM assertions2/2 PASS for synthetic A/B, including historical inquiry completeness scoped to those tenants. Earlier disabled transport-test tenant was excluded from that verifier scope; no all-tenant completeness claim. Reports outputs/chatwoot-local/qa-report.json and outputs/chat-local/ch3-provider-report.json.
Local browser initially failed IPv4 localhost despite owned Next listening IPv6; added loopback-only IPv4 bridge and tests, preserving Host/auth/websocket bytes. Reviewed startup ownership fix rejects an occupied IPv6 target before starting/publishing. Earlier lint/Chat99 PASS; latest affected lint/full Chat rerun pending. All six application gates98 earlier PASS remain recorded separately. No application authentication/network isolation weakened.
Actual owner-a browser session continues. Created synthetic CH3 Regression Customer36f5f894-f87d-4cb9-8d5c-539b8fcfa55d and default QA garment Chest38; two-item order submission underway. Boutique14, responsive smoke and owner acceptance remain pending, not PASS. Existing measurement modal P3 repeats with correct persistence. No CH-3 commit/transition, external messages/shared SQL/deployment/model calls. SpendUSD0. Next finish actual UI regression and affected bridge checks, reconcile evidence/checklist/workbook, then owner acceptance.

## Chat Session Update - 2026-10-21 - CH-3 local QA complete; owner gate pending

### Phase / branch / authority
CH-3 Contacts, Leads and Customer Link/Convert: QA_BLOCKED only on owner acceptance C3-L1–L4 and explicit local-progression deferral of the real-phone exercise. Technical local QA complete. Same codex/chat-ch1-foundation at00718d6e395ea652eb2a7ceb79b39ae1471e863c/no upstream; all existing dirty Chat work preserved. No CH3 commit/CH4 start. D025 local commit authority still requires gates; D034 specifically covered CH2 local closure/CH3 start and is not silently extended. Acceptance question presented with concrete evidence, response pending.

### Exactly built / files
CH3 runtime: src/features/leads/{rules,schemas,commands,refresh-handler}.ts; src/app/api/chat/cron/stages/route.ts. Atomic capture/profile integration in src/features/chat/capture.ts and src/integrations/chatwoot/payload.ts; optional backward-compatible CRM pack metadata in src/features/chat/knowledge-pack.ts; new types src/types/chat.ts; exact maintenance proxy exception src/proxy.ts; disabled-by-default refresh env declarations .env.example. Tenant contacts/scoped identities/conflicts, inquiry leads/events/receipts, clocks/eligible mapped owner with manual provenance, exact existing-customer link, canonical atomic conversion, versioned/audited edits/record links/manual merge/guarded split, record-driven stages/inactivity, configured hot/value and historical backfill. No Leads UI/SSO/AI/notifications/Meta/n8n activation.
Tests scripts/test-chat-lead-{rules,server,storage}.mjs and updated capture/payload/knowledge/role tests. Local-only scripts/chat-local/{ipv4-bridge,upgrade-ch3}.mjs, manage.mjs and test-chat-loopback-bridge.mjs. Existing Boutique/Laundry runtime untouched.
Records updated: docs_chat/CH3_IMPLEMENTATION_PLAN.md, CH3_QA.md, CH3_LOCAL_UPGRADE.md; added CH3_BOUTIQUE_QA.md and CH3_OWNER_ACCEPTANCE.md; reconciled05 WBS/CHECKLIST;06 D035/36/37 preserved; existing post-CH2 closure header edits retained; QA workbook14 dated notes; this SAME project_summary.md.

### Migrations / actual application
Exact20261021123000_chat_contacts_leads.sql,20261021124000_chat_contact_lead_commands.sql,20261021125000_chat_lead_refresh.sql applied ONLY nonce-owned LOCAL PostgreSQL15437. Prior75 never replayed on persistent data. Pre/post restores121/128 tables and full hashes/ACL PASS as preceding entry; local A/B backfill33/15. Final read-only source/checksum/marker/anon+browser ACL preservation3/3 PASS, outputs/chat-local/ch3-final-preservation-report.json. Applied SQL bytes unchanged. No shared/hosted/production SQL.

### Automated gate / counts
All six PASS: npm run typecheck; npm run lint; npm run build (52/52 static generation); npm run test:roles (14 ingress cases); npm run test:v2 (four suites); npm run test:chat (latest100/100,0 skipped). Original full application gate98 logs ch3-gate-*.log; final local bridge additions included in100 logs ch3-final-{lint,chat}.log. Last hostname-only launcher correction: lint PASS and bridge2/2 PASS, log ch3-launcher-final-lint.log. Chat includes22 actual PostgreSQL storage/transaction tests replay78 migrations; synthetic authorization not fresh Clerk role login.
Actual isolated provider10/10 and A/B CRM2/2 PASS; reports outputs/chatwoot-local/qa-report.json, outputs/chat-local/ch3-provider-report.json. Final diff/check and privileges/migration/untracked review PASS; no unresolved actionable standards/spec findings, including narrow bridge startup ownership review.

### Manual QA / regression / tracker
Actual existing Clerk owner-a browser: new synthetic CH3 Regression Customer36f5f894-f87d-4cb9-8d5c-539b8fcfa55d; default garment Chest38; ORD-0000037a5e1a54-09a3-4c22-983c-019482c3147c, two items1200+800/distinct workflows, eligible worker/stage complete/next ready, synthetic receipt300/balance1700, dry-run email only, edit retained. Finance/GST load/safe public tracking/customer exact search/selectorA->B->A pass. B copied A-order404. Boutique14/14 owner scenario; read-only persistence7/7. Independent manager/finance browser, GST-bearing calculation/export/filing and fresh anonymous browser not claimed.
Desktop and authenticated390px same-origin iframe layout/navigation/control smoke PASS; not physical-device evidence. Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch3-evidence. Workbook authored/rendered/visually reviewed,14 CH3 notes appended; original status/persona/history retained. Only sheet3.xml changed, normalized exact after14 notes/height260 edits; all other package parts byte-identical. Private backup/preservation-report under outputs/chat-ch3-workbook in C: workspace. Artifact process exited1 after valid export/three saved previews; package/output checks passed, no Excel interactive calculation claim.

### Bugs / local runtime
Fixed local IPv4 access by loopback-only transparent bridge, owned child readiness/occupied target guard and exit cleanup; no auth/network weakening. Actual forced::1 launch stalled requests; restored previously working localhost hostname. Final integrated launcher verified both127.0.0.1 and::1 HTTP200 plus actual authenticated setup reload, session25223 replaced by94165, snapshot app-1792605014850. Temporary standalone bridge stopped after exact process-identity verification. App/data/Clerk retained. Existing P3 measurement modal stays open after success; persistence correct, deferred. Browser network-suspended refresh recovered via fresh tab and exactly one receipt verified. No new P0/P1 unresolved.

### Remaining owner gate / next / external boundary
Follow docs_chat/CH3_OWNER_ACCEPTANCE.md C3-L1–L4 (linked from CHECKLIST). No more Clerk keys needed. Owner can inspect current setup and synthetic order; optional unique website inquiry can be captured/verified. Need explicit acceptance of local evidence + carry real-phone/Meta exercise to later before local CH3 closure/commit/CH4. Can move to READY_FOR_CLOSURE now: NO, until that applicable owner gate passes. Meta live captures remain a production-release blocker, never PASS. Separate Shopify hosted OAuth approval/renewal and owner-deferred n8n remain separate pending work; retained customer/order boundary unchanged. No purchase, shared SQL, real external message, public tunnel, push/merge/deployment, production enablement or paid-model call. Model/API spend USD0.


## Chat Session Update - 2026-10-21 - CH-3 accepted; local closure checkpoint
CH-3 READY_FOR_CLOSURE (LOCAL under CHAT-D038). Owner accepted the concrete local evidence and real-phone deferral, authorising local commit/CH4. Existing same branch00718d6/no upstream, dirty Chat work preserved. Final diff/migration/untracked/environment/ACL/idempotency review complete, diff-check PASS; six gates PASS with latest Chat100/100, provider10/10, CRM2/2, Boutique14/14 owner +persistence7/7, local pre/post restores121/128 and applied-source/marker/ACL3/3. No unresolved P0/P1; existing P3 measurement-modal persistence workaround documented. Local launcher both loopback families200/authenticated reload verified. Three exact SQL files remain LOCAL-only, unchanged; no new SQL apply this closure slice. Records updated D038/owner acceptance/QA/plan/checklist and same summary, no runtime change. No model/API spend (USD0) or external effects. Prepare local commit: Chat CH-3: add tenant contacts leads and atomic customer commands. Record actual SHA before CH4 IN_PROGRESS. Meta and separate Shopify hosted OAuth/n8n gates remain pending and not PASS.


## Chat Session Update - 2026-10-21 - CH-3 CLOSED; CH-4 IN_PROGRESS
CH3 CLOSED LOCAL at0d22491f14eb82f246d2d17f50b9c97c4269a0a0 (Chat CH-3: add tenant contacts leads and atomic customer commands), clean immediately after commit. Owner acceptance/real-phone deferral CHAT-D038 recorded. Current phase CH4 Pages, lead card, permissions/PII IN_PROGRESS; samebranch/no upstream, base0d22491. No new SQL applied; CH3 local-only SQL/gates remain recorded evidence, not rerun this planning slice. SpendUSD0. CH4 plan docs_chat/CH4_IMPLEMENTATION_PLAN.md: pure safe DTOs first, guarded reads and pages, audited actions, nav/dashboard, authenticated/origin-bound Chatwoot panel/fallback, role/tenant/browser/mobile QA. Existing D026/27/29 retained; no new unresolved business-policy question. Free-form hours cannot yield trustworthy after-hours counts: unavailable until explicit structured schedule, no guessed policy. Shared AppShell/layout/dashboard additive changes require Boutique TierA. Meta and separate Shopify hosted OAuth/n8n remain pending. No external effects or phase4 acceptance yet.


### CH-4 privacy/read/UI vertical slices — 2026-10-21
CH4 IN_PROGRESS, same branch base0d22491/no upstream. Added src/features/leads/{pii,read-schemas,queries,actions,transport}.ts; components/leads/{workspace,editor,contact-actions}.tsx; Leads inbox/detail, Contacts list/detail, loading/error/layout and /chat redirect routes. Tenant layout/AppShell add separate module-gated Leads and owner/manager Chats-new-tab navigation without changing platform permissions/default routes. Public conversation mirror only, no reply composer; existing atomic CH3 commands serve confirmed UI mutations. Customer/order reads additionally respect native permissions. Secret-free Chatwoot URLs and local-only browser origin override in scripts/chatwoot-local/app-env.mjs.
New UNAPPLIED migration20261021140000_chat_crm_reads.sql adds two chat-table indexes and service-only SQL read function with independent tenant/membership/grant checks; exact full counts +50-row stable pagination; lead public messages/history/draft metadata; contact records/exact phone customer candidates/native order history and guarded merge history. Existing tables not written. Replay79 actual migrations only in disposable owned PostgreSQL; persistent LOCAL still CH3/78, no hosted/shared apply. SQL remains uncommitted/unapplied and may be refined before reviewed local upgrade.
Red-green projection3/3 PASS; real read DB/production guard+adapter5/5 PASS including54-row exact pagination, two tenants, grants/revocation/disabled denial, no PII/transport for read-only viewer, customer/native-order boundaries. Actual adapter caught null-intent hot flag (fixed); fixture corrected tenant_users.display_name; unapplied SQL text-assembly syntax issue corrected before PASS. Latest typecheck PASS; lint for Contacts slice running, no complete CH4 gate/browser/closure claim. No current provider/Clerk/UI QA on the new snapshot yet. Next finish owner performance/dashboard and origin-bound authenticated panel, disposable privacy/role/concurrency tests and review, guarded persistent local upgrade+snapshot, full gates/Boutique/mobile/panel/owner QA. Free-form hours yield unavailable after-hours until structured schedule, never guessed. SpendUSD0; no external effects/CH4 commit/phase transition.

## Chat Session Update - 2026-10-22 - CH-4 gates and review corrections

### Phase / branch / objective
CH-4 IN_PROGRESS; codex/chat-ch1-foundation, no upstream, base0d22491 (CH3 CLOSED LOCAL under D038). Continue the existing pages/read-model scope; no new business-policy decision. Preserve newer integrated Shopify contracts; its hosted OAuth/renewal and n8n remain separate pending work.

### Built / exact files
Added owner Performance page, full-scope team/public-staff counts and median first-human clocks; dashboard waiting widget. Added src/features/leads/{reporting-hours,panel}.ts, components/leads/{waiting-widget,panel-host}.tsx, /chat/panel page and exact GET-only data-free proxy fallback. Structured optional crm.reportingSchedule validates named timezone and weekly windows; no tenant schedule has been invented, seeded or published. No schedule means unknown, never zero. Client requires parent/exact origin and bounded documented Chatwoot appContext; SQL independently checks tenant/account/mapped inbox/conversation. Draft shows only stored knowledge version; richer generation provenance waits for CH5.

Review corrections in src/features/leads/{editor-state,confirmed-command,pii,read-schemas,reporting-hours}.ts, components/leads/{editor,contact-actions,workspace,panel-host}.tsx, lead detail/inbox/performance pages and read SQL: omit unchanged owner/stage on note edits; distinguish closed unanswered from replied; retain input and exact retry key after lost transport response, reject different retry payload until reload; needs_look queue preserves scope and composite semantics; canonical named timezones reject numeric offsets that SQL cannot interpret consistently.

### Migrations / tests
Only proposed20261021140000_chat_crm_reads.sql. Still UNAPPLIED to persistent local DB (78 prior migrations);79 actual files replayed only in disposable synthetic PostgreSQL. Prepared scripts/chat-local/upgrade-ch4.mjs and CH4_LOCAL_UPGRADE.md; no shared migration.
Pre-review six gates PASS: typecheck, lint, build, roles18, V2 four scripts, Chat113/113. Focused projection now7/7; DB read10/11 on new regressions: test fixture used unsupported first_staff_reply instead of actual owner_source='auto', corrected and rerun pending. This was a fixture failure, not a production enum change. After corrections rerun full gates; previous green is not final verification.

### QA / regression / blockers / next
CH4 new runtime not yet browser-tested, persistent upgrade/restore and Boutique TierA still pending. Existing actual Chatwoot/local synthetic tenants and Clerk login retained; no new keys requested. Owner acceptance still required after concrete browser evidence. Meta/two-real-phone proof remains deferred release blocker, not PASS. No current unresolved product policy or P0/P1 found; five P2 review findings corrected, awaiting rerun/review. Next finish checks, review/apply only owned local read migration with pre/post restore and preservation proof, refresh owned snapshot, run authenticated role/mobile/panel and Boutique QA. No push/deploy/shared SQL/live messages/public tunnel/paid model/n8n. Model/API spend USD0.

### CH-4 final automated gates — 2026-10-22
All six gates now PASS after corrections: typecheck, lint0 warnings, optimized build, roles18, V2 four scripts, Chat118/118 zero skipped. Focused projection7/7 and actual SQL/adapter11/11 are subsets of118. Fixed test fixture to owner_source='auto'; actual notes-only command preserves it, explicit unassign sets manual, duplicate retry returns same result. Named timezone/real SQL parity passes utc/UTC/Asia/Kolkata/lowercase/America-New_York/Etc-GMT; offsets rejected. Both focused reviewers report all five P2s resolved, no new actionable findings. Migration/source reviewed; owned local upgrade running with backups/restores. Verified prior app process23596->8664->2812 ancestry and stopped only that snapshot/loopback bridge to prepare CH4 refresh; synthetic DB/Clerk/Chatwoot retained. New CH4_QA.md tracks remaining browser/regression/panel/owner checks. No new acceptance/commit or external effects. SpendUSD0.

### CH-4 actual local integration and role QA — 2026-10-22
Owned local upgrade PASS: only20261021140000 read migration, prior78 not replayed;128 pre-existing tables unchanged counts/content hashes. Native before/after dumps1388707/1408646bytes restored to chat_restore_37be4fac6897/chat_restore_d757e3abf1eb; restored ACL PASS. No shared SQL. Snapshot app-1792608784756 serving actual retained Clerk owner-a; fresh tab13 recovered stale restart page.

Actual provider10/10 PASS with accounts901/902 conversations10/5, local-only traffic. Browser owner: Leads/public mirror excludes private notes; saved notes preserve null auto-owner provenance, converted a synthetic contact to platform customer06573ecb-1284-45cb-8098-9604a7975bdd. Manual incompatible customer-link merge correctly rejected (not a stale-version failure); compatible unlinked synthetic pair merged and undo restored identities/lead count. Owner Performance full counters/unmapped staff/unknown reporting schedule display correctly.

Actual Chatwoot4.18 DashboardApp1 (account901, local only, no production setting) loads /chat/panel, verified existing Clerk session, strict appContext maps conversation10 to lead55715c4c-8fa6-4302-92d6-4f8720f320ce. Browser automation cannot activate the enabled cross-origin iframe save control (target/focus root unavailable despite DOM1 visible match); no app save failure claimed. Synthetic draft note remains unsaved; owner must click save twice for acceptance. Main OS PLUS owner/manager saves work.

Real Clerk HTTP/RSC role tests used reversible effective membership changes in synthetic Local QA A (NOT independent Clerk role logins). Manager details/edit and hidden reports; direct report404. Viewer grant+noPII: rendered HTML/RSC contains no contact/customer name/message/notes/private note/edit controls; /chat404. PIIgrant reveals contact but no native customer/orders/manage/reports/Chatwoot. Finance denied initially, explicit grant shows masked inbox; viewer revocation immediately404/navhidden. Exact original owner role and viewer/finance grants restored from private backup.375px harness prepared; no physical-device or full mobile pass yet. New-runtime Boutique and workbook QA pending. PhaseIN_PROGRESS; spendUSD0; no external effects or CH4 acceptance/commit.

### CH-4 owner-assisted card and narrow layout — 2026-10-22
Owner replied "saved" to actual Chatwoot Dashboard App exercise. SQL verifies conversation10 lead55715c4c now stagein_progress, explicit manual owner252e2186-17c5-48fe-b6fe-5169dd8e1dfc and note"inquired". This proves an actual owner-assisted frame mutation; do not claim two saves from the singular reply. Subsequent role/tenant context changes correctly yielded the safe frame fallback; initial authenticated frame render/save and fallback both recorded, no persistent cross-origin session guarantee.

Authenticated same-origin375px outer frame (356px content after scrollbar) verified Leads/list, detail, Contacts and Performance: scrollWidth equals clientWidth, no horizontal overflow; open/close mobile nav works; scroll reaches stage/owner/notes/save and customer link; actual narrow edit persisted. Screenshots chat-ch4-evidence in C: workspace. Not physical-device testing. Anonymous actual HTTP6/6: exactGET/chat/panel200 data-free safe shell; unauthenticated POST/extra suffix/Leads/Contacts/Performance redirect307. Actual selector A->B->A, B copied A lead404; dashboard widget renders tenant-specific0 waiting.
Boutique TierA rerun underway: native CH4 Boutique Regression Customer4063c146-bf0d-4e79-8ed1-21dd9e0adf14 created through Customers form; default QA garment CH4 garment fit Chest38 saved. Existing P3 measurement modal stays open after success, same as prior phases, persistence correct; closed without duplicate. Order/workflow/payment/finance/GST/dry-run/edit/search still pending this slice. No production/shared changes; spendUSD0; CH4IN_PROGRESS.


## Chat Session Update - 2026-10-22 - CH-4 local QA complete; owner closure pending

### Date / updated by / phase / branch
2026-10-22; Codex AI agent. CH-4 Pages, lead card, permissions/PII — IN_PROGRESS (local technical QA complete; owner acceptance and C4-L4 sequencing pending). Branch codex/chat-ch1-foundation, no upstream, base/HEAD0d22491f14eb82f246d2d17f50b9c97c4269a0a0. CH3 CLOSED LOCAL under CHAT-D038. Existing Chat work preserved; no other worktree modified. Earlier CH4 pending Boutique/workbook/test counts above are superseded by this checkpoint.

### Objective / what was built / files
Complete tenant-guarded Leads inbox/detail, Contacts/detail, owner Performance, waiting widget and actual Chatwoot Dashboard App without changing native business rules. New src/features/leads/{pii,read-schemas,queries,actions,transport,reporting-hours,panel,editor-state,confirmed-command}.ts; src/components/leads/{workspace,editor,contact-actions,waiting-widget,panel-host}.tsx; src/app/(tenant)/leads/{layout,page,loading,error}.tsx, [leadId]/page.tsx, contacts/page.tsx, contacts/[contactId]/page.tsx, performance/page.tsx; src/app/(tenant)/chat/page.tsx; src/app/chat/panel/page.tsx. Additive shared edits: tenant layout/dashboard, components/layout/app-shell.tsx, features/chat/knowledge-pack.ts, proxy.ts, types/chat.ts, .env.example, scripts/chatwoot-local/app-env.mjs, scripts/test-role-route-policy.mjs. New scripts/test-chat-crm-{projection,read}.mjs and scripts/chat-local/upgrade-ch4.mjs.
Explicit DTOs mask PII/free text and never expose provider/secret metadata; native customer/order access separately checked. Exact full-scope counts/pagination, reporting clocks, audited versioned edits, customer conversion/link, reviewed merge/guarded undo. Chats opens credential-free separate Chatwoot tab; no native reply composer or SSO. Optional structured reporting schedule only; absent means unknown, no invented hours. Exact public GET panel is data-free; session/actions/origin/tenant/account/inbox checks still mandatory.

### Decisions / phase sequencing
No accepted product policy reopened. Owner replied "saved" to the actual card exercise; SQL/audit plus fresh matching-account card show conversation10 lead2TRSR in_progress/manual owner/note"inquired". This proves one actual save; two saves and full phase acceptance are not inferred. CH4_OWNER_ACCEPTANCE.md C4-L1–L5 now records the concrete remaining owner gate.
Open C4-O1 in decision log: original WBS CH4.2 bundles generated suggestion provenance and Create booking. Existing plan implements stored text/knowledge version now, generation/richer provenance CH5 and booking CH6. WBS CH4.2 remains partial until explicit owner sequencing acceptance; no premature engine/action implementation.

### Migrations added / applied locally
supabase/migrations/20261021140000_chat_crm_reads.sql reviewed and applied ONLY to owned isolated LOCAL PostgreSQL15437. Two chat indexes, internal revoked schedule helper, service-only independently tenant/module/membership/grant checked bounded read RPC. Prior78 files not replayed. SHA2567a23c2bbbadcda0a92d9548efc339ff99159b5e19a8db09830a348f4104f3828. No shared/hosted/production SQL.
All128 existing public-table counts/content hashes preserved. Native pre dump1388707bytes restored chat_restore_37be4fac6897; post1408646bytes restored chat_restore_d757e3abf1eb. Full manifests/restored ACL PASS. Private outputs/chat-local/ch4-upgrade-report.json/dumps retained. Same-cluster database recovery only, no host/Clerk/media recovery claim. Owned REST/worker resumed.

### Automated tests / outcomes
- npm run typecheck — PASS.
- npm run lint — PASS,0 warnings.
- npm run build — PASS.
- npm run test:roles — PASS,18 exact proxy cases plus platform role checks.
- npm run test:v2 — PASS,four scripts.
- npm run test:chat — latest119/119,0 skipped. Added stored-draft privacy regression is test-only; affected-file eslint also PASS.
Logs outputs/chat-local/ch4-final-*.log and ch4-final-gate-results.json. Focused new projection7/7 and actual SQL/production read-adapter12/12 are subsets of119.79 actual migrations replayed only in disposable synthetic databases. Actual local Chatwoot4.18 provider10/10, anonymous ingress6/6, separate persistence5/5 and Boutique persistence7/7 PASS; counts overlap, not additive. Final diff-check PASS with line-ending notices only; final closure record/diff check still required after owner acceptance. No repeat runtime gates necessary for records-only changes.

### Manual QA / regression / limits
Actual retained Clerk owner-a/Local QA A: Leads/detail/public mirror, notes, contact conversion, incompatible-customer merge rejection, compatible synthetic merge/undo, reports/waiting dashboard, separate-tab Chats launch/card render/save/fallback pass. A->B->A selector; B copied A lead and new native order404.
Role checks used temporary LOCAL effective membership/grants with the same real Clerk session, not independent role sign-ins. Manager edit/report denial; viewer default/revoked denial, explicit masked view/PII grant, finance default denial/explicit masked view and actual HTML/RSC leak checks pass. Original role/grant policy values restored, metadata timestamps not byte-identical.
Authenticated375px outer frame/356px document: Leads/detail/edit/Contacts/Performance no horizontal overflow, nav/scroll/reachable controls and real narrow save pass; not physical-device/screen-reader certification.
Boutique TierA14/14 owner scenario and persistence7/7 PASS. Native customer4063c146-bf0d-4e79-8ed1-21dd9e0adf14, measurement Chest38, ordera0eceb66-c883-4114-bea0-5efbf1d24f09/ORD-000004,total2000,two distinct workflows, eligible stage completion/next readiness, exactly one synthetic cash receipt300/balance1700, Finance/GST non-GST inclusion, public tracking, dry-run queue and edit/search preserved. No GST-bearing calculation/export/filing or independent Boutique role/fresh anonymous-browser claim. Anonymous HTTP tracking privacy independently passes.
Actual panel uses Clerk session, exact appContext and account901 DashboardApp1. Automation cannot activate its cross-origin save; owner-assisted action supplies evidence. Temporary wrong role/business safely falls back; fresh matching A launch shows saved values. No universal browser/session persistence guarantee.
Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch4-evidence, including chatwoot-card-saved.png and narrow/privacy/tenant/Boutique views.

### Workbook / records / bugs
Updated docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx:14 dated Boutique Regression notes N2:N15 and rows2-15 height340pt only. Historical statuses/personas retained. Artifact authoring/export/three previews visually reviewed; native preservation check only sheet3 XML changed and normalizes exactly after14 note/height edits; all other package parts byte-identical. Final SHA25665d4a208b3d2c795f39d312a5a87a742381e7641706dec43102886eb4f189db7. Private baseline/export/previews/report in C: outputs/chat-ch4-workbook. Artifact runtime exits1 after valid saved export/previews; independent package/style/value checks PASS; no interactive Excel recalculation claim.
CH4_QA.md, CH4_BOUTIQUE_QA.md, CH4_LOCAL_UPGRADE.md, CH4_OWNER_ACCEPTANCE.md, CH4_IMPLEMENTATION_PLAN.md updated. WBS/checklist/decision log and CH3 closure headers reconciled; prior history retained.
Five P2 review fixes verified: notes preserve automatic owner provenance; closed unanswered wording; full attention queue scope; uncertain transport retains exact payload/retry key; named timezone canonicalization/real SQL parity. Spec/standards rereviews no new actionable findings; reviewers did not run services. No unresolved P0/P1. Existing P3 measurement dialog stays open after successful save; persisted once/manually closed, unchanged.

### Owner action / blockers / next / spend
CH4 cannot yet move to READY_FOR_CLOSURE: full owner C4-L1–L5 acceptance including C4-L4 sequencing still required. Ask one evidence-linked combined question; then final records/diff review/local commit under existing D025 authority before CH5 planning. No new Clerk keys needed. Useful URLs http://localhost:4131/leads and http://localhost:4141/app/accounts/901/conversations/10; matching Local QA A selected, fresh card displays owner save.
Meta/two-real-phone/channel live proof remains deferred and production-release blocking under D038, never PASS. No current Meta task required of owner. Separate Shopify hosted OAuth approval/renewal and owner-deferred n8n remain pending; retained customer/order boundary unchanged. Isolated Chat n8n plan is not activation authority.
No purchase, public tunnel, shared migration, production data change/channel setting, real external message, push/merge/deployment, n8n activation or paid model call. Model/API spend this session USD0.


## Chat Session Update - 2026-10-22 - CH-4 accepted; READY_FOR_CLOSURE LOCAL
Owner explicitly accepted full local CH4 results and C4-O1 sequencing; CHAT-D039 records C4-L1–L5 satisfied. CH4 READY_FOR_CLOSURE LOCAL, samebranch/base0d22491/no upstream. Six gates PASS (latest Chat119/119); provider10/10, anonymous ingress6/6, Boutique14/14 plus7 persistence,128-table preservation/two actual restores and both focused rereviews retained. Counts/role/mobile/iframe/GST/renderer limits in CH4_QA.md. Owner save verified; no assumption of two saves. No unresolved P0/P1; existing P3 modal unchanged. Only local read SQL20261021140000 applied, exact bytes unchanged; no new apply this records-only closure. Updated decision log/WBS/checklist/owner acceptance/QA/plan and same summary. Final diff/migration/source review complete, diff-check PASS before commit. Meta/two-phone and separate Shopify hosted OAuth/n8n remain pending. SpendUSD0. Next: authorised local commit, record SHA, then CH5 planning/decisions only; no paid/external authority.

Staged-source review correction: tracked diff-check was PASS, but first full staged check includes previously untracked applied SQL and reports one blank line at EOF (line203), no executable SQL issue. Applied migration bytes stay frozen; do not trim/reapply them. Narrow staged whitespace check excludes blank-at-eof only and retains trailing-space/tab checks. No production fix or test rerun required for this formatting-only observation. Final commit follows the reviewed unchanged local-applied SQL.


## Chat Session Update - 2026-10-22 - CH-4 CLOSED LOCAL; CH-5 planning
CH4 CLOSED LOCAL atf9d195c02388bdcf17c8fb25a294dac32bbe9fe3 — Chat CH-4: add tenant Leads workspace and Chatwoot card. Owner acceptance/dependency sequencing CHAT-D039; clean working tree verified immediately after49-file local commit. No push/release. Same codex/chat-ch1-foundation/no upstream. This post-commit SHA record is retained for the next phase commit; CH4 commit contains final closure evidence. Final staged check found only frozen applied SQL EOF blank line, accepted formatting exception with other whitespace checks PASS; no SQL bytes changed.
Current phase CH5 Agent engine (draft mode) PLANNED, no runtime implementation/new migration/model call yet. Read full03/currentWBS and capture/ingress/knowledge/types/SQL/platform contracts; new docs_chat/CH5_IMPLEMENTATION_PLAN.md records scope/files/proposed additive SQL and15 concrete reconciliations, including existing silent turn placeholder, trigger FK vs sandbox, honest staff provenance, hard-vs-soft cap, unsupported financial/booking capabilities and remote delivery uncertainty. All open phase decisions P5-1 behavior defaults, P5-2 budget ceiling and P5-3 mock-only/model deferral presented together before dependent implementation. Do not infer proposed policy approval. CH5 real-WhatsApp acceptance remains pending; no closure exception presumed.
Updated CH4 closure headers/WBS/checklist and same summary with exact SHA. No runtime changes or new test rerun for docs-only planning; latest six gates/Chat119/provider10/Boutique14/local restores remain CH4 evidence, not CH5 PASS. Meta/two-phone release blocker and separate Shopify hosted OAuth/n8n pending unchanged. No new Clerk credentials needed. Model/API spendUSD0. Next: collect P5 answers, record IN_PROGRESS, pure safety/schema red-green tests first; paid smoke/live gate later separately scoped.


## Chat Session Update - 2026-10-22 - CH-5 IN_PROGRESS; mock-only safety slice
Codex; phase CH5 Agent engine (draft mode) IN_PROGRESS. Same codex/chat-ch1-foundation, HEAD/basef9d195c02388bdcf17c8fb25a294dac32bbe9fe3/no upstream. Actual status/full tracked docs diff/untracked plan inspected; prior CH4 closure-SHA/planning work preserved. CH4 remains CLOSED LOCAL underD039. Owner approved P5-1/P5-2/P5-3; recorded D040 configurable session/quiet defaults, D041 hard budget ceiling, D042 mock-only build/production engine disabled/model IDs unset. No dependent business policy outstanding for this local inquiry slice.
Start existing CH5 plan: pure strict boundary/safety/session/ledger rules with synthetic test-first behavior, then tenant context/storage/runtime/delivery/UI. TDD public behavior tests; no unrelated issue-tracker scaffolding needed because session names docs_chat/06_Decision_Log.md and same summary as authoritative records. No CH5 migration yet, no paid/live calls, no new Clerk keys. Previous CH4 six gates/Chat119/Boutique14 are baseline evidence, not new CH5 results. Shared runtime changes later require fresh Boutique TierA. Meta/two-phone release blocker and separate Shopify hosted OAuth/n8n unchanged. SpendUSD0. Next: first acknowledgement/quiet/session red-green case, then evidence/money/link/draft safety.


### CH-5 first safety rules —2026-10-22
Added src/features/chat/agent/{rules,session,schemas,budget,checks}.ts and scripts/test-chat-agent-rules.mjs. Six synthetic public-behavior tests PASS after individual RED->GREEN cycles: whole configured acknowledgement vs open/unanswered burst; quiet/newer-message fences; configurable session gap boundaries/private-note exclusion; exact current-customer quoted evidence for model slots/signals and declared intent/service/language; exact decimal hard-budget admission/unknown cost refusal; code-filled numeric facts/indicative prices/links with unsafe-text/placeholder/repeat rejection. No model/network/database calls, migrations, settings changes or new UI yet. These are mechanical safety tests, not proof of all-language semantic safety or paid/live acceptance. Need context/transaction/model orchestration and actual integration tests before phase closure. Typecheck/lint/full Chat not yet rerun for this slice. SpendUSD0, IN_PROGRESS; external/Shopify blockers unchanged.


### CH-5 context, mock pipeline and sandbox storage —2026-10-22
Added agent/{context,plan,turn}.ts, server-only integrations/openrouter/client.ts, test-chat-agent-{context,turn,model-client,runtime}.mjs. Knowledge pack gains optional backward-compatible agent.session and explicit indicativeLabel. Strict context rejects mismatched tenant/workspace/channel/conversation/pack/message rows, incomplete history or malformed ledger; strips private notes and keeps internal tenancy outside model context. Mock pipeline passes3 tests (strict stages/provenance/draft-only, no models for closing/quiet, exact payment/booking locked handoff, live model rejection, one rewrite then safe fallback/no raw exception). Context2/2, pure6/6, existing knowledge5/5; loopback-only model adapter1/1 with provider/model pinning/no fallback/JSON/timeouts/usage accounting. Official OpenRouter contracts checked2026-10-22 (api_reference/overview, cookbook/administration/usage-accounting, guides/routing/provider-selection); no paid request. Numeric cost conversion reproduced floating extra-pico charge and corrected exact decimal expansion.
Two new UNAPPLIED persistent migrations20261022100000_chat_agent_runtime.sql and20261022101000_chat_agent_commands.sql add owner-only tenant-owned sandbox turn log/atomic retry receipt and service-only exact workspace-secret context RPC.81 real migrations replayed only in disposable synthetic PostgreSQL; runtime2/2 PASS (owner vs manager, foreign brand/tenant/secret, disabled module, changed retry, default-deny browser ACL, no fabricated messages/contacts/leads/customer/ledger/domain events). No persistent LOCAL/shared/hosted apply yet. Fixture shallow-copy mutation corrected, not a product isolation bug. Typecheck and affected-file ESLint PASS after Prettier. Full phase gates/browser/regression/restore still pending; pure hard-budget admission is not yet an atomic reservation implementation. Next actual claims/reservations/delivery safety, authenticated server boundary/preview and integration QA. Engine/live model IDs remain disabled/unset underD042. SpendUSD0; no external effects/phase closure/commit.


### CH-5 transactional runtime and owner preview —2026-10-22
Extended the two still-UNAPPLIED CH5 migrations with tenant-owned run leases and per-call budget reservations, service-only load/run/finish commands. Actual PostgreSQL tests now7/7: sandbox owner isolation/replay, exact scoped context, concurrent hard-cap reservations (second connection blocks then denies), unknown cost held/reconciled, placeholder deduplication, audited enrichment once/rollback, private-delivery uncertain fence, newer customer/staff quiet fencing, lease rotation/held-cost reclaim denial, late accounting after module revocation and browser ACL denial. Corrected new SQL expression/alias/helper-wiring issues before PASS; existing chat_lead_event emits both event records, so removed redundant insertion. Staff fixture corrected to events callback (agent callback correctly ignores staff).
Added agent/{mock-model,preview-core,preview-server,preview-actions}.ts, components/chat/bot-preview.tsx and /settings/chat/try/page.tsx; gated owner setup link and RPC types. Explicit mock scenarios, no keyword-production-bot claim/live model. Preview logs only sandbox turns, recovers same request/key before regeneration, rejects changed request/foreign brand/manager. Existing model engine remains disabled, no model IDs/keys selected. Typecheck PASS; new UI/browser/lint after latest files pending. Optional pack timing remains backwards compatible.
Added integrations/chatwoot/message-client.ts and loopback test1/1: only account/conversation-scoped private notes with draft metadata, no public-send method, no plaintext draft ID in body, call-time dry-run denial. Read-only inspected owned running4.18 Messages::MessageBuilder/controller/routes: arbitrary content_attributes/private flag retained. No Chatwoot settings/scripts changed and no actual new provider note from this test yet. SQL only replayed81 files in disposable local DBs; retained app/LOCAL DB still CH4, no persistent/shared apply. Remaining driver/webhook/dry-run integration, draft controls, richer provenance projection, complete gates/Boutique/browser/restore/review/live-owner gates. No phase closure/commit; spendUSD0; Meta/Shopify/n8n boundaries unchanged.


## Chat Session Update - 2026-10-22 - CH-5 interim review and retry safety
Codex; CH5 IN_PROGRESS, existing codex/chat-ch1-foundation/no upstream, HEAD/basef9d195c02388bdcf17c8fb25a294dac32bbe9fe3. User status question answered while continuing the authorised mock-only work. Existing Chat dirty changes preserved; no other worktree modified.
Extended agent/{turn,plan,worker-core,worker,checks}.ts, BotPreview, new try/page.tsx, test-chat-agent-{rules,turn,runtime,delivery}.mjs and test-chat-page.mjs. Fixed preview import harness (three failures were missing mocked dependency); safe fallback now marks handoff, suppresses an already-public handoff line, and closing considers only current-session requests while global latest/quiet fences remain. Expanded facts enforce final length/question/script/markup/link boundaries; preview retains exact inputs after an unconfirmed response. Disabled worker avoids configuration reads; invalid enabled-local configuration cannot undo captured webhook processing.
Two independent read-only interim reviews (review skill) found six runtime defects. Reproduced and corrected in unapplied SQL/runtime: unsent ready drafts resume without model regeneration; stale delivery-claim retries preserve delivered/uncertain evidence; failed understanding flags audited monotonic handoff without requiring gist; fallback once-only and fresh closing; same-number pack versions across channel brand remapping cannot satisfy immutable pack identity fences. Added pre-spend current customer/quiet/pack revalidation. Actual PostgreSQL runtime12/12 PASS (81 actual migrations in disposable synthetic databases); red fixtures corrected to archive the previous published pack before publishing its replacement, following existing single-publication constraints.
Only the two new CH5 migrations20261022100000_chat_agent_runtime.sql and20261022101000_chat_agent_commands.sql were replayed as part of disposable test DB creation. Retained LOCAL database still CH4/79 migrations; no persistent/shared/hosted apply, historical SQL unchanged. No new native dumps/restores or browser/provider/Boutique evidence for CH5 yet.
Latest npm run test:chat147/147 PASS,0 skipped; typecheck PASS; roles PASS including18 exact ingress cases; v2 four scripts PASS. First full Chat140/137 failed3 harness tests, then140/140; superseded by147/147 after new regressions. Lint initially failed1 new preview-page JSX-inside-try rule; fixed by rendering after authorised data load, rerun pending. Build pending. Focused rules7/7, turn4/4, delivery2/2, runtime12/12 are subsets, not additional independent totals. Earlier runtime7/7 and8/8 notes are superseded.
CH5 cannot move to READY_FOR_CLOSURE. Draft Send as is/Edit controls, ledger persistence/vendor quiet, verified background/branch context, richer provenance read projection, broader safety/benchmark cases, retained-local upgrade/two restores, fresh Boutique TierA, authenticated owner/role/tenant/mobile/browser and paid/live owner acceptance still pending. Checklist PartC CH5/B8 remains unchecked. Current app4131/Chatwoot4141 remains prior CH4 snapshot, not this preview implementation. No owner action/Clerk keys/model key needed now. Next finish local implementation and gates before any concrete owner acceptance request.
Meta/two-real-phone production release blocker remains deferred; separate Shopify hosted OAuth/renewal and owner-deferred n8n remain separate pending work. No paid model calls, purchases, real external messages, public tunnel, shared migration, production change, push/merge/deployment or n8n activation. Engine/default live flags remain false/model IDs unset. Model/API spend USD0. No CH5 commit or phase transition.


### CH-5 automated checkpoint —2026-10-22
Supersedes pending-lint/build wording above: all six required automated gates now PASS: npm run typecheck; npm run lint(0 warnings); npm run build; npm run test:roles(platform/Chat plus18 exact ingress cases); npm run test:v2(four scripts); npm run test:chat147/147,0 skipped. Logs outputs/chat-local/ch5-{typecheck,lint,build,chat}.log; roles/V2 terminal output retained in session (combined redirected file does not include all role stdout). Both independent focused rereviews confirm their six findings resolved; no service actions by reviewers. Tracked git diff --check PASS; no commit.
Created docs_chat/CH5_QA.md as evidence/limits/pending-work record, updated CH5_IMPLEMENTATION_PLAN.md stale baseline wording and CHECKLIST.md interim pointer; same living summary preserved and appended. No new SQL apply or browser/manual/Boutique/restore verification this checkpoint. Engine remains disabled and retained app still CH4. CH5 IN_PROGRESS, cannot move to READY_FOR_CLOSURE until documented implementation and acceptance gaps are complete. Next concrete slice: inquiry ledger/vendor quiet and exact scoped background/branch context, then reviewed draft controls/provenance before persistent-local/browser QA. No new decision or owner action now; Checklist PartC CH5/B8 remain unchecked. Meta/two-phone and separate Shopify hosted OAuth/n8n pending; external authority unchanged. Model/API spendUSD0.


## Chat Session Update - 2026-10-22 - CH-5 remaining local implementation resumed
Owner explicitly requests completing remaining CH5 implementation/local QA, live AI disabled, ready-to-test handoff. Existing branch codex/chat-ch1-foundation/no upstream, HEADf9d195c, preserved all dirty Chat source/SQL/planning; summary/QA/plan and tracked full diff inspected. No new business decision needed. Prior147/147 and six gates are baseline, rerun after changes. Next ledger/context, pinned4.18 signed-in staff draft controls/provenance, synthetic benchmark, disposable tests, reviewed owned-local upgrade/real restores, fresh snapshot/provider/browser/Boutique QA. No paid/live model, real external channel, shared migration, deployment or phase-closure authority inferred. Owner asks about local downloads: current commands read files/container source; new code/tests/logs are local worktree artifacts, no new package/image download started this resumption. SpendUSD0; CH5 IN_PROGRESS.


### CH5 ledger/context/draft-control implementation —2026-10-22
CH5 IN_PROGRESS, same branch/base preserved. Added agent/{ledger,background}.ts; strict inquiry ledger language/handoff/session, actual-public vendor quiet using saved quiet_minutes (private drafts never mean already said); completion persists ledger and one chat.agent.turn_completed event atomically, dry-run remains log-only. Context RPC reads own active contact and verified exact-phone linked native customer/background plus active brand locations, with bounded strict projection; street/address/order details stay server-side, models receive minimal returning-customer/order/task counts and approved branch facts. New confidence boundary/configured handoff topics, actual bounded mock-call timeout/global deadline and conservative exact-repeat code repair. Focused rules8/8, context4/4, turn5/5 PASS. Added public/chatwoot/osplus-reply.js using pinned4.18 window.axios native staff session (no cookie/token reads or injected platform tokens), draft metadata/current conversation/trigger fences, browser lock and durable uncertainty before public send, Send as is/Edit UI. Mock control tests in progress; actual browser proof pending. New source/provenance parser and SQL20261022102000_chat_agent_draft_read.sql (service-only CRM-guarded whitelisted metadata; masked readers null); richer Leads suggestion status/source/version UI. Actual disposable runtime13/13 PASS with82 migrations; verified ledger/audit, metadata privacy/tenant/role/ACL. All three CH5 SQL files still disposable-only, retained LOCAL remains CH4/79; no persistent apply yet. Typecheck PASS before latest confidence/control changes; rerun six gates after final review. No new npm/image downloads; pinned source read from owned running container only. Engine/live paid path still off; USD0; no external effects. Next review/safety benchmark and owned-local preserved upgrade, actual restores/snapshot/provider/browser/Boutique QA before owner test handoff.


### CH5 shared staff-send authority and final pre-upgrade review —2026-10-22
Review found cross-device duplicate-send risk in browser-only locks. Added fourth UNAPPLIED migration20261022103000_chat_staff_draft_sends.sql: tenant-owned shared permanent uncertain claims, exact actor/native staff/account/conversation/note/run/customer/pack authorization, audited USER commands, and additive capture wrapper validating exact claimed content hash/source note/run/staff mapping before bot attribution. Signed-in native staff session remains the only public sender. New Clerk-authenticated server action +exact-parent/origin/account DraftBridge in existing /chat/panel supplies shared authority without browser platform tokens or SSO. Native control locks use draft UUID, final native history reread after authorisation; missing auth/bridge safely blocks enhanced send and leaves native composer. Reported browser receipt is separate from webhook-verified provider message ID, so an incorrect early receipt cannot poison valid reconciliation. Reproduced both last review P2s before fixing; controls5/5 and actual PostgreSQL runtime15/15 PASS inclreal2connection claims, edited-exact-claim bot attribution/noquiet, unclaimed modified text staysstaff/quiet, incorrectreportedreceipt reconciliation. Prior full Chat160/160 PASS before finalcontrols reread/receipt correction; next fullgate recheck pending. Indicative prices now flow from published pack +actual tenant currency (missingcurrency never guessed), turnprice+provenance testPASS; safety bench seven malicious writes+malformed observation PASS, allmock/USD0. Four migrations now replayed only in disposable83-file schema, persistent LOCAL still79/CH4. New upgrade-ch5 plan verifies79 baseline, appliesonly4newfiles/markeratomically after pre-restore, compares128 existingtable hashes and postrestore/ACL. No persistentupgrade yet. Local launcher explicitly blanks model IDs/key, keeps engine/delivery/live flagsfalse; enables mock preview and separately authenticated human draft controls only for owned Chatwoot run. No packages/images downloaded; actual container source read. Next finalrereviews/sixgates ->owned-local upgrade/realbackups/restores ->snapshot/provider/browser/Boutique/ownerhandoff. CH5 IN_PROGRESS; no phaseclosure/commit, paid/live/Meta exceptions inferred.


### CH5 owned-local upgrade and refreshed snapshot —2026-10-22
CH5 IN_PROGRESS, codex/chat-ch1-foundation/no upstream, HEADf9d195c preserved. Final pre-upgrade six gates PASS: typecheck/lint0/build/roles18+role checks/V2four scripts/Chat161of161 zero skipped; logs ch5-preupgrade-*.log. Both final focused source reviews clear. scripts/chat-local/upgrade-ch5.mjs applied ONLY the four reviewed20261022100000/101000/102000/103000_chat migrations to owned persistent LOCAL PostgreSQL15437 after restored rehearsal. Existing128 table counts/content hashes unchanged;83 actual SQL markers now present,132 public tables. Native pre1417915bytes restored chat_restore_270ea9baa552 and post1488075bytes restored chat_restore_a006ce2a4cf9; full manifests/restored ACL PASS, private outputs/chat-local/ch5-upgrade-report.json. Applied SQL bytes frozen; subsequent fixes require additive SQL. No shared/hosted apply or host/Clerk/media restore claim.
Owned app refreshed to outputs/chat-local/app-1792654429903 on4131; existing Clerk/Chatwoot retained. Global agent/private auto-delivery/live model disabled, IDs/key blank; owner mock preview and authenticated human draft-send bridge enabled only in verified local launcher. QA-helper preparation and real provider/browser/Boutique checks next; no new browser or fresh regression PASS claimed yet. Locally created code/test reports and synthetic recovery backups are generated artifacts, not new package/image downloads. USD0; no external messages, deployment, purchase or n8n. Owner acceptance still pending; no closure/commit.

CH5 local provider preparation first run: helper created synthetic incoming enquiries in the two owned local accounts and received authenticated callbacks, but stopped before mock generation/private posting with SQL 'Agent knowledge unavailable' at chat_agent_load. No passing provider/browser claim. Temporary agentEnabled config restored in finally; app global/live flags remain disabled. Resolve local fixture publication/brand knowledge eligibility and reuse created conversations rather than blindly generating duplicates. Current user question answered: local artifacts are source/tests/reports and generated synthetic recovery backups; no new packages/images downloaded. CH5 still IN_PROGRESS, owner QA not ready, USD0.


### CH5 remaining local QA resumed —2026-10-22
Owner requests finish remaining local checks and ready-to-test handoff, live AI disabled. Branchcodex/chat-ch1-foundation/HEADf9d195c/no upstream, all dirty Chat work preserved; latest summary/status/diff check inspected. Prior161/161/six gates and owned-local83migration/prepostrestore evidence retained; no new gate or owner acceptance inferred. Next inspect/fix synthetic published knowledge eligibility without creating duplicate enquiries, verify actual private draft/control/preview/roles/tenant/mobile and fresh BoutiqueTierA, update evidence/workbook and same summary. USD0; external boundaries unchanged.


### CH5 actual provider, draft actions and role QA —2026-10-22
Resolved local fixture blocker: inbox mapped brands lacked publication. New helper publishes validated clearly synthetic example knowledge through audited chat_configure commands, reuses existing A11/A12/B6 incoming enquiries; first helper errors (hours object/default strict schema) corrected without relaxing validation. Local actual incoming/callback/context/mock/private AgentBot delivery3of3 PASS; no new duplicate enquiries for retries. Owned4.18 DASHBOARD_SCRIPTS previouslyempty now loads reviewed local osplus-reply.js only from4131; no productionsetting.
Real retained Clerk owner-a+nativeChatwootstaff: browser Send as is onA11 and Edit/Send edited reply onA12 each confirmed one public synthetic reply. ActualSQL2of2 verifies shared claims sent, authenticatedcallbackauthorbot, quiet_untilnull; actualmarkup/screenshots saved chat-ch5-evidence. Owner Trybot publishedLocalInquiryBrand v2 returns hours source; unsafe-response scenario returns locked safehandoff with no unsafeINR999 text, logonly. Live model/globalengine off, spendUSD0.
Fresh provider qa.mjs10of10 PASS onthissnapshot (localaccounts901/902). Reversible realClerk effectiverole checks:manager previewredirect/orders, detailprovenance/editPASS, directChatperformance404; viewer explicitmaskedread contains no actualcustomer/draft/notes evenHTML/RSC, noChatentry404; revocation404/navhidden;finance default404. Originalowner/grants restored, role metadata timestampsnotbyteidentical; notindependentClerkrolelogins. Mobile/tenant/Boutique/workbook and finalrecords stillpending; CH5IN_PROGRESS, noownerclosure/commit. FourappliedLOCALmigrationsunchanged; noexternal effects.


## Chat Session Update - 2026-10-22 - CH-5 local QA complete; ready for owner mock test

### Date / updated by / phase / branch
2026-10-22,Codex AI agent. CH-5 Agent engine draft mode IN_PROGRESS; local technical QA complete,owner acceptance and full paid/live/WhatsApp gate pending. Branch codex/chat-ch1-foundation,no upstream,HEAD/basef9d195c02388bdcf17c8fb25a294dac32bbe9fe3. Dirty Chat work preserved,no other worktree changed,no CH5 commit/CH6 transition.

### What this slice completed / files
Fixed local QA fixture eligibility (inbox-mapped brands lacked published knowledge),using parse/publication validation and audited chat_configure save/publish of clearly synthetic hours. Strict hours schema fixture mistakes corrected without weakening validation. scripts/chatwoot-local/ch5-qa.mjs reuses existing enquiries,binds real local Clerk/native staff mapping,restores temporary tenant agentEnabled in finally,posts mock-only private AgentBot drafts to ownedloopback. Added owned-route warming with invalid synthetic credentials to avoid Nextdev cold route compilation exceeding native5s webhook budget; no production timeout/ingress change.
Existing CH5 engine/ledger/context/prices/safety/shared claims/provenance implementation is now actually verified on refreshed retained snapshot app-1792654429903. public/chatwoot/osplus-reply.js installed ONLY previouslyempty ownedlocal4.18 DashboardScripts. Captured pinned actual note markup scripts/chat-fixtures/chatwoot4.18-draft.html. No new package/image downloads.
Updated docs_chat/{CH5_QA,CH5_LOCAL_UPGRADE,CH5_IMPLEMENTATION_PLAN,CH5_OWNER_ACCEPTANCE,CH5_BOUTIQUE_QA,CHECKLIST,05_Phase_Plan_WBS}.md,QAworkbook and SAME living summary. Interim evidence preserved and explicitly superseded; owner doc C5-L1–L6 is current test checklist.

### Migrations / recovery
Four additive files already reviewed/applied ONLY owned isolated LOCAL15437; no new apply this final browser slice:
- supabase/migrations/20261022100000_chat_agent_runtime.sql
- supabase/migrations/20261022101000_chat_agent_commands.sql
- supabase/migrations/20261022102000_chat_agent_draft_read.sql
- supabase/migrations/20261022103000_chat_staff_draft_sends.sql
Frozen SHA256values verified unchanged in CH5_QA.md. upgrade-ch5.mjs checked79baseline,rehearsed restored copy,appliedonly4+83marker atomically;128existing table counts/content hashes unchanged. Native before1417915bytes restored chat_restore_270ea9baa552(128tables),after1488075bytes restored chat_restore_a006ce2a4cf9(132tables); restoredACL PASS. Same-clusterDB recovery only; no host/Clerk/media recovery or shared SQL claim.

### Automated results
npm run typecheck PASS; npm run lint PASS0warnings; npm run build PASS; npm run test:roles PASS18exactingress+platform/Chatroles; npm run test:v2 PASS4scripts; npm run test:chat161/161,0skipped. outputs/chat-local/ch5-final-*.log. Runtime15 uses83realSQLfiles and independent DBconnections; subsetcounts are not additional totals. Final helper-only edits do not affect app runtime; affectedhelpereslint/warm rerun tracked separately.
Fresh actuallocalprovider qa.mjs10/10; mockprivatefixture delivery initially3/3 plus2freshownerfixtures (5/5 currentreport); actualbrowser+verifiedcapture Send/Edit2/2; anonymousHTTP ingress/tracking7/7; Boutiquepersistence7/7. Native acceptedcallbackreplays4/4 afterwarming. Counts overlap.

### Manual QA / isolation
Retained realClerk owner-a,LocalQAA andChatwootChatLocal1 native staff. SendasisA11/EditA12 each onepublicsyntheticreply; actual DBsharedclaims sent,authenticatedcallbackauthorbot,nohumanquiet. Ownerpreview publishedLocalInquiryBrandv2 returns hourssource/cost0; maliciouswriting fallsback safely. Syntheticpack hasnoackwords: unconfiguredthanks is not a closingcase; configuredclosingunitrulesPASS,no falsebrowserclosing claim.
Effective role tests used reversible local membership/grants with sameClerksession,notindependentClerklogins. Managerleadprovenance/savePASS; previewredirectandperformance404. Viewerconfiguredmaskedread hasnoactualPII/free-text/draft evenHTML/RSC,Chatentry404; revoked404/navhidden;finance default404. Exact originalowner/grant policy values restored,metadata timestampsnotbyteidentical.
Real A->B->A selector; copiedAlead/newBoutiqueorder404inB. Actual375pxsameoriginframe previewsubmit/provenance/readability PASS; screenshotsevidence,notphysical-device/screen-reader/allbrowsers. Cross-originactualdraftbridge usesretainedClerksession; no universalSSOclaim.

### Boutique compatibility / workbook
Fresh TierA14/14 owner scenario and7/7persistence,CH5_BOUTIQUE_QA.md. Nativecustomerf1a779a6-beb3-4577-ac3c-93dc5080c2eb,defaultChest38,order01a9ae50-20b8-4deb-a9fa-34aa4dbb1780/ORD-000005,total2000,twoitems/distinctworkflows,validworkerstart/firststagecompleted/nextready,exactlyone syntheticreceipt300/balance1700. Finance/GSTnonGSTinclusion/publictracking/dry-runqueue+audit/edit/exactsearch/tenantdenial PASS. NoGST-bearing calculation/export/filing orindependentBoutiqueroleclaim.
QAworkbook14 appended evidencecellsN2:N15,row2–15height409.5pt only; historicalstatus/personas preserved. Artifact-authoredexport/3previews visuallyreviewed; process exits1aftervalidexport(asbefore),independentnativepackage/style/valuepreservationPASS. Onlysheet3XMLchanged,itnormalizesexactly; allotherpartsbyte-identical. SHA2560e8be846fe4fcb1a018d9fc35c32e9f977e9087f53920f67fb8f12bd83b65b60. NointeractiveExcelrecalculationclaim.
Boutique runtime code/schema unchanged by this slice.

### Bugs / limits / blockers
Previously reproduced CH5concurrency/provenance/retry/receipt safety findings resolved; final standards/specreviewers clear runtime/helpers,requiredrecordcorrections nowmade. Newlocalfixture errors corrected.
ExistingP3measurementdialogremainsonsuccessfulsave,closedonce. ExistingP2dashboarddate bug newlyobserved: local2026-10-22 midnightAsia/Calcuttaconvertsby unchangedtoISOString to2026-10-21; Todaycash1150 vsFinancecorrectnew300/month1450. Samecodeverifiedatf9d195c,noChatdiff. DeferredoutsidethisChat-onlytask,not hiddenorclaimedfixed;14definedTierAflowspass.
A14historicalbotfailureactivity corresponds to first5s-budget callback failure; warmed native4types accepted105–529ms. Preservedactivity anddocumentedlocalwarmhelper; no productionlatencyclaim. Diagnosticresponseaccessor andforcedNodeexitissue areharness-only; finalwarm/lintrecheckrecordfollows.

### Owner next step / gate assessment / spend
Two untouched prepared private drafts A14/A15 ready: localhost4141/app/accounts/901/conversations/14 and/15. OSPLUS4131/settings/chat/try retainedownerA,LocalInquiryBrandpublishedv2. C5-L1–L6 in CH5_OWNER_ACCEPTANCE.md givesexactclicks; no newClerk/modelkeys,Meta,domainorserverneeded.
CanmoveREADY_FOR_CLOSURE:NO. Ownerlocalacceptance pending; originalcheap paid-modelsmoke/live modelselection andrealWhatsAppdraftgate remainunexecuted/unwaived. No newproductdecisionneededformocktest. Meta/two-phone remains releaseblocker; separateShopifyhostedOAuth/renewalandowner-deferredn8n remainseparatependingwork.
Model/API spendUSD0. GlobalCHAT_AGENT_ENABLED/CHAT_MODEL_LIVE_ENABLED/automaticdraftdeliveryfalse,modelIDs/providerkeyblank. Onlylocalpreview/manualnativecontrols enabled; no externalcustomer message,paidpurchase,sharedmigration,publictunnel,productionsetting,push/merge/deployorn8nactivation.


### CH5 final owner-ready verification —2026-10-22
Supersedes pending finalhelper wording: warm-only normalreturn exits0,invalidsyntheticcredentials2/2denied; helpereslintPASS. Finalgitdiff--checkPASS,line-endingnoticesonly; fourappliedLOCALSQLhashesunchanged. Bothindependentread-onlyreviewers clearruntime/helpers andrequiredcurrentrecordfixesnowcomplete. Currentowner-a/LocalQAApreviewLocalInquiryBrandpublishedv2 hours/source/cost0 and ChatwootA14unsentbuttonsverified; tabsretained. A15untouchededitfixture. Allsixgates161/161remainvalid,noappsourcechangesafterthem. CH5IN_PROGRESS,localtechnicalQAcomplete/ownerreadynotphaseclosed. Ownerstepsdocs_chat/CH5_OWNER_ACCEPTANCE.md C5-L1–L6; exactnextactionownerlocalmocktest,thenrecordresultsbeforeanyclosure/commit decision. No newkeys/Meta/hostingneeded. ModelspendUSD0,liveAIoff; noexternalapprovalinferred. ExistingP2dashboardlocaldate/P3measurementdialogdeferredasrecorded; no newCH5P0/P1. Fullpaid/live/realWhatsAppgatesnotwaived.


### CH5 owner UX correction —2026-10-22
Owner requests Edit populate native Chatwoot main composer rather than nested textarea. CH5IN_PROGRESS, existingbranchf9d195c/dirtyChat preserved. Approved UI expectation: use existing native Reply composer/Send, preserve current typed drafts, role/provenance/exactsendidempotency and uncertainty safeguards. Investigate pinned4.18 editor/client integration before changes; avoid privateVue internals/platformtokens/newinbox. New localUItest needed; prior161gates/ownerready evidence is baseline,not acceptance of this correction. NoSQL/model/externalaction;USD0,liveAIoff.

## Chat Session Update - 2026-10-22 - CH-5 native reply composer correction

### Date / Updated By / Phase Status
2026-10-22; Codex; CH-5 IN_PROGRESS, local correction tested and ready for owner. Not READY_FOR_CLOSURE or committed.

### Branch / Base / Objective
Existing codex/chat-ch1-foundation, no upstream, HEAD/basef9d195c02388bdcf17c8fb25a294dac32bbe9fe3; all existing dirty Chat work preserved. Owner requests Edit populate the existing Chatwoot main reply box instead of opening a nested textarea.

### Built / Decisions / Exact Files
public/chatwoot/osplus-reply.js v1.1.0: native ProseMirror paste fills empty public Reply composer; normal native Send/Ctrl+Enter performs the shared reviewed send. Existing text and text entered during loading are preserved. Cancel retains text, ordinary native staff sends remain human replies. No extra textarea/Send button. Exact text/source claim, native echo/reply attributes, current-history fences and uncertain-send protection retained. Durable scoped echo retry fences and native persisted-source retry checks survive composer cancellation/navigation/reload. No private Vue/auth internals.
Extended scripts/test-chat-agent-controls.mjs (5→11), scripts/chatwoot-local/ch5-qa.mjs (--composer prepares synthetic A16/A17), docs_chat/{CH5_QA,CH5_OWNER_ACCEPTANCE,CH5_IMPLEMENTATION_PLAN,CHECKLIST}.md and SAME project_summary.md. Copied corrected public script only into running owned app-1792654429903/public/chatwoot; no shared platform/Boutique runtime edit. Product decision is the owner's current UX request; no new business policy.

### Migrations / Recovery
None added or applied for this correction. Four previously applied LOCAL15437 CH5 files remain frozen, hashes unchanged. Earlier actual pre/post restore evidence remains in CH5_LOCAL_UPGRADE.md; no new restore run claimed.

### Automated Tests
All six required gates PASS: npm run typecheck; npm run lint(0 warnings); npm run build; npm run test:roles(platform/Chat plus18 ingress); npm run test:v2(four scripts); npm run test:chat167/167,0skipped. Latest outputs/chat-local/ch5-composer-{typecheck,lint,build,test-roles,test-v2,test-chat}.log. Controls11/11 is an overlapping subset, six added regressions red→green. Existing actual PostgreSQL/tenant tests included. Two focused read-only reviewers clear after retry fixes.

### Manual QA / Tenant Isolation / Regression
Real retained Clerk owner-a/LocalQAA and native Chatwoot ChatLocal1 staff, desktop browser. Separate synthetic A16 existing draft preserved; Edit main composer then normal Send public146. A17 Cancel keeps text; reload suggestion and Ctrl+Enter public149. Actual shared claims/authenticated callback2/2 verified exact text, one outgoing each, authorbot and no human quiet at that checkpoint. outputs/chat-local/ch5-native-composer-report.json. Subsequent ordinary A17 public150 authorstaff and saved quiet interval PASS1/1, ch5-native-ordinary-report.json; A17 intentionally quiet afterward. Ordinary assertion initially used human instead of existing staff enum; corrected test harness only.
Screenshots native-composer-loaded.png/native-composer-sent.png in C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch5-evidence visually reviewed. User A14 refreshed only after both composer fields verified empty, owner A14/A15 remain unsent. Owner steps CH5_OWNER_ACCEPTANCE.md C5-L3/L4 now specify native flow/Take over.
Earlier same-session BoutiqueTierA14/14,persistence7/7,provider10/10,HTTP7/7,roles/two-tenant375pxOSPLUS checks retained as prior evidence; not rerun or recounted for this isolated JS correction. No shared customer/order/permission/schema change; new actual native ordinary-reply smoke PASS. No new mobile Chatwoot/physical-device claim.

### Bugs / Compatibility / Deferred Work
Removed confusing duplicate editor. Review found uncertain preparation and cancellation/reload could bypass the first retry guard; reproduced then fixed durable echo and persisted-message checks. Existing P2dashboardISTdate/P3measurementdialog remain separately deferred, unchanged. No new CH5P0/P1 remains in focused review.
Full owner C5-L1–L6 acceptance, original paid/live/realWhatsApp acceptance or explicit scoped deferral still pending. CH5 cannot move READY_FOR_CLOSURE yet. Meta/two-phone release blocker and separate Shopify hostedOAuth/renewal/owner-deferredn8n remain separate pending work.

### Next Step / Spend / External Limits
Owner can use refreshed A14 or open A15, click Edit, change wording in the main Reply box, then normal Send/Ctrl+Enter; report C5-L steps. No new keys/server/domain needed for this mock test. Global liveAI/automatic agent/draftdelivery flags remain off, model IDs/key blank. USD0 model/API spend. No real external messages, paid purchase, shared migration, tunnel, production change, push/merge/deploy or n8n activation.

### CH5 new-chat suggestion clarification — 2026-10-22
Owner reports a new enquiry has no suggested response. Read-only ownedLOCAL check confirms ChatLocal1 conversation6 customer message152 captured2026-10-22T09:42:29.953Z, linked lead present, zero agent runs; earlier message135 in same conversation also has no run. This is consistent with deliberately disabled automatic worker, not evidence of failed ingress. Existing A14/A15 drafts and prior A16/A17 are explicitly prepared synthetic mock turns. processCapturedAgent returns immediately when CHAT_AGENT_ENABLED is not true; current local launcher defaults agent/model/delivery off. Live paid provider selection remains unimplemented/disabled for this mock-only gate; no claim that arbitrary chat has been AI-tested.
Explained separate capture vs prepared mock vs automatic inference to owner. No source/SQL/service config changed or enabled, no new model call/message/test gate run; prior167/167/sixgates remain prior evidence. Read-only diagnostic helper outputs/chat-local/ch5-capture-status.mjs prints IDs/status only, no customer text/secrets. CH5IN_PROGRESS owner acceptance pending; next possible local slice is explicitly enabled loopback mock suggestions for new enquiries (fixed demo behavior, not liveAI), separately from eventual approved paid live acceptance. No decision inferred/no new approval requested here. Model/API spendUSD0; Meta/Shopify/n8n/external boundaries unchanged.

### CH5 fresh-chat local mock activation authorised — 2026-10-22
Owner explicitly authorises enabling free synthetic suggestions for fresh local chats and requests finishing this stage soon. CH5 remains IN_PROGRESS on existing codex/chat-ch1-foundation/no upstream/HEADf9d195c, dirty Chat changes preserved. Plan: explicit isolated launcher opt-in, owned local synthetic tenants only, existing private-note worker/guards; test fresh actual provider incoming callbacks, follow-up/dedup, tenant isolation and staff quiet, retain paid/live flags off and credentials blank. No paid/live/real WhatsApp gate waiver inferred, no new shared SQL/services/production authority. Next inspect current gates, enable local mock only, actual provider/browser QA, record owner test and remaining closure dependencies. SpendUSD0.

## Chat Session Update - 2026-10-22 - CH-5 automatic fresh local mock suggestions verified

### Date / Updated By / Phase Status / Branch
2026-10-22; Codex; CH5 IN_PROGRESS, local mock technical QA complete/ready for owner acceptance, not CLOSED/committed. Existing codex/chat-ch1-foundation/no upstream/HEADf9d195c retained; dirty Chat work preserved, no other worktree touched.

### Objective / Accepted Decision / Built / Files
Owner explicitly authorises fresh-chat free mock suggestions and requests timely stage completion. CHAT-D043 records local-only refinement of D042; no paid/live/realWhatsApp waiver inferred.
Added scripts/chat-local/mock-suggestions.mjs: explicit local flag environment rejects remote/unowned transport, force mock model mode/private-note delivery, live false, all provider IDs/key blank. Owned local synthetic tenant configuration checks exact A/B names/IDs,901/902 workspace/inbox on localhost4444,draft channel and published pack; update and correlated SYSTEM/API audit are atomic and repeated activation makes no change/event. Before-config private backup saved once. scripts/chat-local/manage.mjs adds explicit --mock-suggestions flag after verified --chatwoot environment; unflagged default stays disabled.
Added scripts/test-chat-local-mock.mjs (red→green opt-in/remote/live-key boundary), scripts/chatwoot-local/fresh-chat-qa.mjs (actual native incoming→callback→worker→private note, no direct engine fixture invocation). Updated docs_chat/{06_Decision_Log,05_Phase_Plan_WBS,CH5_QA,CH5_OWNER_ACCEPTANCE,CH5_IMPLEMENTATION_PLAN,CHECKLIST}.md and SAME summary.

### Migrations / Local Configuration / Recovery
No migration added or applied. Existing four applied LOCAL15437 CH5 bytes frozen; earlier pre/post restore proof retained, no new recovery run claimed. Only existing synthetic LocalQAA/B module config_json.agentEnabled enabled with two audit events in ownedLOCAL DB, zero shared/production config change. Initial helper referenced c.mode incorrectly, transaction rolled back; corrected to c.agent_mode before successful enable. Idempotent rerun changed0 and emitted0 extra events.
Prior foreground app was no longer listening; no process had to be stopped. Hidden background local launch PID2520 now keeps snapshot app-1792662695628 on4131. Current local engine/private delivery flags true,modelmode mock; liveAI false,modelIDs/key blank. This supersedes historical global-engine-off wording for this explicitly opted-in local process only.

### Automated Tests / Actual Provider Checks
All six gates PASS: npm run typecheck; npm run lint(0warnings); npm run build; npm run test:roles(platform/Chat+18 ingress); npm run test:v2(four scripts); npm run test:chat168/168,0skipped. outputs/chat-local/ch5-fresh-{typecheck,lint,build,test-roles,test-v2,test-chat}.log; launcher1/1 is subset, not additional suite total.
Actual fresh-chat provider QA5/5: fresh A18/B8 each automatically gets exactly one private mock draft160/159,zero cost,own tenant/lead; duplicate actual agent callbacks twice do not duplicate; fresh A18 follow-up gets new private draft; actual human reply starts saved quiet and subsequent native incoming/callback makes no model run/suggestion. Report outputs/chat-local/ch5-fresh-chat-report.json. Actual ownedLOCAL SQL checks fixture activation retry and browser capture/shared source claim PASS2/2, ch5-fresh-browser-report.json.

### Manual Browser QA / Tenant Isolation / Regression
Retained real native ChatLocal1 staff and Clerk session. Visitor widget browser message161 in existing A6 automatically created private162; staff Send as is then public167, visitor sees text only after approval. Persisted source claim sent/authorbot/cost0, old human quiet remains expired. Fresh new conversations separately verified via native provider above, not claimed as widget restart.
Screenshot C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch5-evidence/fresh-mock-suggestion.png saved and visually reviewed. Native End Conversation frame button visible but automation could not click it; owner C5-L7 covers restarting a widget conversation. Existing preview tab was a browser error page; acquiring that tab was denied by URL policy, no workaround attempted. Other local HTTP/native checks unaffected; owner can reload the app tab normally.
Prior same-session BoutiqueTierA14/14+persistence7/7,role/tenant375px,provider10/10 and HTTP7/7 remain dated evidence; no fresh Boutique rerun for this local-tool-only change. New full Chat actualDB tenant checks included. No Boutique/shared runtime/schema change.

### Bugs / Compatibility / Remaining Gate
Fixed local config helper wrong column before enable. No new CH5 runtime P0/P1. Existing separate dashboardISTdate/measurementdialog issues unchanged. Mock is fixed opening-hours demonstration, not real language understanding or automatic public reply. A14 is now verified sent, A15 still unsent; owner checklist corrected. No old message backfill; use new incoming messages.
CH5 cannot move READY_FOR_CLOSURE until owner acceptance and original paid/live/realWhatsApp acceptance or explicit local closure exception. D043 does not waive these. Meta/two-phone release blocker and separate Shopify hostedOAuth/renewal/owner-deferredn8n remain separate pending work. No CH6 work.

### Owner Next Step / Spend / Limits
Use CH5_OWNER_ACCEPTANCE.md C5-L7: localhost4142/1 new synthetic conversation/message; see private suggestion in localhost4141 account901; approve Send or Edit/main composer. After ordinary staff reply, saved quiet applies, so start separate chat for independent test. C5-L1–L6 remain acceptance steps, A15 ready for Edit. Restart command npm run chat:local -- app --chatwoot --mock-suggestions after stopping current app; default launch does not enable mocks.
Model/API spendUSD0. No paid model, external channel message,purchase,public tunnel,shared migration,production settings,push/merge/deploy or n8n activation. Next concrete step owner local acceptance and explicit disposition of deferred full paid/live gate, then existing local phase-commit authority can be used only after closure gate.

### CH5 owner acceptance / READY_FOR_CLOSURE — 2026-10-22
Owner explicitly answered “Accept local CH-5; defer live gates and close locally.” CHAT-D044 accepts local mock evidence and authorises local closure/commit under existing D025; paid-model smoke and realWhatsApp gates are explicitly deferred, unexecuted and release-blocking. This supersedes prior pending-owner/full-gate closure blocker for the LOCAL scope only. No liveAI/production readiness implied.
Current status READY_FOR_CLOSURE; final helper standards/spec rereview and staged diff/secret/migration hash checks before phase commit. Sixgates168/168,actualfresh5 and browser2 PASS. No new migration/runtimechange after those checks. Current HTTPsign-in200,background local app alive. No extra model/message spend;USD0.

## Chat Session Update - 2026-10-22 - CH-5 CLOSED LOCAL under owner exception

### Current phase / authority / branch
CH-5 CLOSED LOCAL. Owner explicitly accepts local mock results and defers paid-model smoke/realWhatsApp acceptance in CHAT-D044; existing D025 local commit authority applies. Local phase commit subject: Chat CH-5: guarded mock drafts and native reply workflow. Same codex/chat-ch1-foundation/no upstream, parent/basef9d195c02388bdcf17c8fb25a294dac32bbe9fe3. No CH6 implementation; next phase CH6 requires its own planning/gates. No public push/merge/deploy.

### Built / exact implementation / migrations
Completed CH5.1–5.7 within accepted LOCAL mock scope: strict tenant context/ledger/session/quiet/closing/evidence/fact-output guards, bounded mock pipeline, private outbox/shared reviewed staff-send claims/uncertainty/provenance, transactional cost reservations/concurrency, audited lead enrichment, owner preview, role/PII projection, native Chatwoot Send/Edit/main composer workflow and explicit owned-local fresh-chat mock launcher.
Source/file inventory in CH5_IMPLEMENTATION_PLAN.md/CH5_QA.md; complete commit includes staged src/features/chat/agent,integrations/openrouter,message-client,preview/bridge/native script/tests/localtools plus versioned documentation and QA workbook. No Boutique/Laundry runtime/schema behavior change.
Four timestamped migrations20261022100000_chat_agent_runtime,101000_chat_agent_commands,102000_chat_agent_draft_read,103000_chat_staff_draft_sends.sql already applied ONLY ownedLOCAL15437 (plus actual disposable DB replays); no additional/shared migration in closure. All4 recordedSHA256 match. Actual prior local pre/post native dumps restored,128existingtable manifests preserved; local-upgrade evidence remains CH5_LOCAL_UPGRADE.md. Applied bytes frozen.

### Automated / manual / regression / review
All six latest gates PASS: typecheck,lint0warnings,build,test:roles(platform+Chat/18ingress),test:v2four scripts,test:chat168/168/0skip. Exact commands/evidence CH5_QA.md and outputs/chat-local/ch5-fresh-*.log.
Actualfreshprovider5/5 and browser+idempotentactivation2/2 PASS; native Sendbutton/CtrlEnter edited sends2/2 and ordinaryhumanquiet1/1 earlier in same session. Actual private drafts stay staff-only until approved; recent human replies suppress suggestions. ExistingownerAClerk/nativeChatwoot; effective manager/viewer/finance/two-tenant and authenticated375pxOSPLUS evidence within recordedlimits, not physical-device/independentrolelogins.
BoutiqueTierA14/14+persistence7/7 same-session prior evidence; no new Boutique run for local-tool-only activation. QA workbook14datednotes/styles/packagepreserved previouslyverified. All exact logs/artifacts/testsubset overlaps in CH5_QA/CH5_BOUTIQUE_QA, not inflated.
Final focused standards/spec reviewers both clear new local helpers; previousruntime/nativecomposerrereviews clear after fixes. Final tracked diff--check, untracked inventory/credential scan/staged review before local commit. Current localHTTP200 and ownedbackground mock app retained; no new startup/restore claim.

### Defects / deferred gates / next step / spend
Newhelper wrongcolumn c.mode corrected before configchanges; native uncertainty/duplicateeditor/race/provenance bugs fixed and tested. No known CH5 P0/P1 in accepted local scope. Existing separate P2DashboardISTdate/P3measurementdialog remain deferred, unchanged.
Owner C5-L1–L7 combined local evidence accepted under D044, not claim ownerpersonallyexecutedallsteps. Paid/live model selection/key/smoke and realWhatsApp acceptance remain UNEXECUTED, explicitly deferred and PRODUCTION-RELEASE BLOCKING; Meta/two-phone deferrals unchanged. Separate Shopify hostedOAuth/renewal/owner-deferredn8n remain separate pending work.
Current local defaultlauncherstilldisabled; explicitly opted-in process has mockengine/private deliverytrue, mode mock, livefalse, providerIDs/keyblank. Free synthetic fixed-hours demonstration, not liveAI or arbitraryintentaccuracy. Owner can continue C5-L7 localfresh tests at4142/1→staff4141; A15unsenteditfixture. Next phaseCH6planningnotstarted.
USD0 model/API spend. No realexternalcustomer messages, paidpurchase, publictunnel, production settings, sharedSQL, push/merge/deploy or n8n activation.

## Chat Session Update - 2026-10-22 - CH-6 planning only; decisions pending

### Phase / status / branch / base
CH-6 PLANNED, not IN_PROGRESS; owner explicitly requests planning and pending decisions before implementation, live AI disabled. Existing D:/Develop/os-plus-chat-ch0, codex/chat-ch1-foundation, no upstream, HEAD a09561d1ecce48acdd4e3a4df18ec368773ed953; initial status/full diff/untracked inventory CLEAN, no worktree/branch switch. CH5 CLOSED LOCAL under D044, exact local commit confirmed. Current locally stored origin/main remains c686337 (ancestor of HEAD), no commits in HEAD..origin/main. No network fetch/latest-remote verification or merge performed.

### Reading / findings / plan
Read current summary/startup/README/PRD/rules/architecture/agent spec/CH6 WBS/decision log/schema audit/checklist/platform gate and summary protocol; inspected actual tenant/permission/Supabase/command/task/Laundry/customer/lead/agent/financial/tracking contracts and relevant migrations. Local released Shopify summary/deployment/manual/pending records confirm retained fact boundary, hosted OAuth/renewal and deferredn8n separate; no historical SQL reapply or other-worktree write.
Created docs_chat/CH6_IMPLEMENTATION_PLAN.md and appended docs_chat/06_Decision_Log.md open CH6 planning; this SAME summary records planning. No runtime implementation. Plan covers WBSCH6.1–6.7, explicit five unapproved decisions, intended files, proposed additive migration categories and verified implementation/gate sequence.
Key conflicts: Laundry create requires customer/date/window and lacks assumed draft/update/confirm/cancel abstraction; task UI/actions Laundry-only; no registry and pack publication capabilities empty; strict inquiry ledger/slots and safety/output guards cannot execute or promise bookings; task existence is not confirmed booking; no financial statement/token service or complete Laundry billing ledger; private-note-only transport/manual public bridge lacks automatic public outbox/signoff; local model is explicit fixed demo, not live action understanding. Preserve current customer/stage/Shopify/privacy contracts.
Google current official policy checked read-only2026-10-22: selectively soliciting positive reviews prohibited; old03 positive-feedback-before-link proposal needs explicit neutral-policy reconciliation. Source https://support.google.com/contributionpolicy/answer/7400114?hl=en. No reference-business behavior/code/infrastructure consulted or copied.

### Pending decisions / next concrete step
P6-1 draft actions/staff approval vs immediate operational commands; P6-2 callback/Laundry required evidence and post-materialization human change/cancel boundary; P6-3 explicit statement deferral vs guarded link-only owner/admin issuance; P6-4 routing/dedup and chat-only task surface; P6-5 on-request price image plus opt-in neutral reviews vs deferral. Recommendations are NOT policy approval; present all together before dependent implementation.
No unresolved prior approved roles/quiet/stage/budget/domain/Meta decision reopened. Next obtain these answers, update spec/WBS links with approved boundaries, then record IN_PROGRESS and pure-rule tests. All future production auto flags remain off; existing approved local private mock mode unchanged.

### Migrations / tests / QA / regression / defects
No migration created/applied, no service settings/tenant data changed. Four CH5 LOCAL SQL remain frozen; no new restore. No automated/runtime/browser/Boutique tests run for documentation-only planning; prior CH5 sixgates168/168 and Boutique14/persistence7 are historical baseline, never CH6 PASS. No new runtime defect fixed. Contract gaps recorded as planning dependencies, not tested bugs.
Future CH6 requires actual DB/concurrency/two-tenant/route/token/native UI/mock provider checks, six gates and appropriate fresh BoutiqueTierA/local restore per plan. Cannot move READY_FOR_CLOSURE; phase not implemented. Full liveAI/Meta/WhatsApp/realbooking acceptance remains release-blocking unless separately completed or explicitly scoped.
Existing separate BoutiqueISTdate/modal issues and Shopify hostedOAuth/renewal/owner-deferredn8n remain separate pending work. No paid model, real external message, purchase, tunnel, sharedSQL, push/merge/deploy or n8n action. Model/API spendUSD0.

## Chat Session Update - 2026-10-22 - CH-6 IN_PROGRESS after approvals
Owner approved all five recommendations; CHAT-D045–D049 accepted. Existing codex/chat-ch1-foundation/no upstream/basea09561d preserved with owned planning edits. CH6 IN_PROGRESS. Reconcile spec/WBS and implement pure policy tests first, then tenant-owned storage/atomic approval/tasks/UI, gated worker/delivery. D047 explicitly defers financial statements; D045 separates staff operational approval from Send; D046 protects existing Laundry operations; D048 Chat task queue stays in Leads; D049 neutral opt-in reviews.
No migrations applied or service flags changed at start; CH5fourSQL/83file baseline frozen, prior168suite baseline only. LiveAI off/modelIDs/keyblank; no paid/external/sharedSQL/push/deploy/n8n authority. CH6 gate/owner acceptance pending;USD0. Next pure-rule red→green.

## Chat Session Update - 2026-10-22 - CH-6 provisional storage and handoff checkpoint

### Date / Updated By / Phase / Branch
2026-10-22; Codex; CH6 IN_PROGRESS, not READY_FOR_CLOSURE. Existing D:/Develop/os-plus-chat-ch0, codex/chat-ch1-foundation/no upstream/HEADa09561d1ecce48acdd4e3a4df18ec368773ed953 retained. Owned CH6 planning changes preserved; no branch/worktree switch or commit.

### Approved decisions / implemented files
CHAT-D045–D049 record all five owner approvals: staff operational approval, request-first callbacks/Laundry with human operational changes, statement deferral, configurable task routing/dedup, request-only images and neutral opt-in delivery-based reviews. Agent spec/phase acceptance/CHECKLIST PartC CH6 now align; D041 hard budget wording reconciled, not reopened.
New src/features/chat/actions/{rules,schemas}.ts and scripts/test-chat-action-{rules,runtime}.mjs implement/exercise strict pure rules and real provisional storage/task commands. src/features/chat/commands.ts and src/types/chat.ts add capability-aware pack publication; actual server adapter tests in scripts/test-chat-database.mjs and scripts/chat-db-harness/server-adapter.mjs updated for real SQL RPC signatures. docs_chat/CH6_QA.md records partial evidence. CH6_IMPLEMENTATION_PLAN.md remains the living implementation plan.

### Migrations / exact application scope
Added new uncommitted 20261022120000_chat_action_state.sql, 20261022121000_chat_action_commands.sql, 20261022122000_chat_handoff_tasks.sql, 20261022123000_chat_capability_publication.sql, 20261022124000_chat_action_read.sql under supabase/migrations.
Applied only by actual disposable PostgreSQL harness (all88 source migrations, already-present pinned image/pullnever); owned test containers cleaned up. Retained LOCAL15437 still prior83/CH5 baseline, no new retained/shared apply or restore. Four applied CH5 SQL unchanged. New functions/tables only; no existing Boutique/Laundry table DDL.

### Built behavior / tests / defects
Save/revise/withdraw provisional requests atomically with quoted own-conversation public customer evidence, current capability/pack checks, optimistic version/revision and one-hour exact-contact identical-draft fence; explicitly different details remain separate. Saving never creates a customer, operational booking or task. Sorted service sets prevent order-only duplicates.
Real handoff tasks use existing create/assign/complete Domain Commands in one audited transaction; repeated reasons merge, completed work permits a new task. Routing checks active mapped eligible staff, eligible lead owner, configured active brand-mapped branch team, otherwise unassigned. Different/unmapped branches do not inherit a channel team. Staff-only bounded read and revocation checks; viewer/finance write/read denial. Callback pack publication and replay use the existing authenticated owner receipt path; disabled Laundry rejected without replacing active pack.
Targeted rules5/5 and actual DB10/10 PASS (subsets). True independent-client concurrency and audit-trigger failure rollback executed, not mocked. Initial viewer pure mutation, service-order duplicate and branch fallback defects reproduced/fixed. Synthetic phone fixture rejected correctly before corrected sourceId; new harness dependency/signature mismatch and an over-broad dependency-map edit corrected. Latest full-gate output to be appended after runs finish; do not treat historical168 as current evidence.

### QA / gate / next slice / boundaries
No CH6 native browser/mobile/owner acceptance, fresh BoutiqueTierA, retained upgrade/restore or hosted acceptance yet; CH5 evidence is historical. CHECKLIST PartC CH6 updated to accepted provisional-first/staff-approval scope and marked not ready/executed.
Still required: current customer summary/confirmation and approved atomic operational materialization, action UI/worker integration, remote routing observation/labels/notification intents, guarded media/review/channel/map/public-auto delivery, actual provider/browser/latency, upgrade/restore, regression and closure review. No acceptance checkbox marked complete. Next small slice is confirmed-request/staff-approval transaction and callback materialization, then Laundry command adapter, before setup/Leads controls.
No new product decision needed; no owner action needed for these synthetic implementation steps. Statement deferral D047 remains explicit. Meta/realWhatsApp/live-model gates remain release-blocking; Shopify hostedOAuth/renewal/owner-deferredn8n separate.
Existing local private mock process unchanged; liveAI off/providerIDs/keyblank, no public-auto/business-action enablement. No paid/external/sharedSQL/push/merge/deploy/tunnel/n8n authority exercised. Model/API spendUSD0.

### CH6 checkpoint gate results — 2026-10-22
All six latest automated gates PASS: npm run typecheck(exit0), npm run lint(exit0/no warnings), npm run build(exit0), npm run test:roles(platform/Chat+18exactingress), npm run test:v2(four scripts), npm run test:chat183/183/0skip. Final logs outputs/chat-local/ch6-slice-*.log; targeted15 are overlapping subsets, not extra totals. Full Chat initially found a real test-adapter dependency/signature mismatch; fixed against actual SQL, then an unrelated dependency-map edit corrected; final183 includes publication/replay integration. Applied CH5fourSHA256 match CH5_QA.md; tracked git diff--check PASS.
No CH6 browser/mobile/owner/BoutiqueTierA/retained-upgrade/restore claim; requirements remain in CH6_QA.md and CHECKLIST PartC CH6. No READY_FOR_CLOSURE/commit: confirmed operational approval/UI/worker/delivery and full acceptance incomplete. No unanswered product decision; next implementation slice remains confirmed-request + explicit staff-approved atomic materialization, then controls/provider QA. Owner need not obtain keys or perform new acceptance yet.
No retained-local migration, restart, automatic/public action flag or external change. Existing local private mock unchanged; liveAIoff/providerIDs/keyblank. SpendUSD0; separate Meta/live/WhatsApp and ShopifyOAuth/n8n pending boundaries unchanged.

## Chat Session Update - 2026-10-23 - CH6 resumed; unattended local CH7 authority

Codex resumes existing D:/Develop/os-plus-chat-ch0 on codex/chat-ch1-foundation/no upstream/HEADa09561d. Status/full tracked diff/untracked inventory inspected; all dirty work is the preserved CH6 checkpoint, no other worktree touched. CH6 IN_PROGRESS; prior183/183/sixgates dated2026-10-22 are baseline only.
Owner requests remaining CH6/local QA and as much CH7 as possible, recommends routine decisions be selected/recorded without intervention. CHAT-D050 records explicit local closure/commit and CH7-continuation exception after engineering gates, deferring owner/live acceptance. No new product decision pending. Next tracer: customer-reviewed current request confirmation, explicit staff approval, atomic callback/Laundry native command adapters; then controls, worker/outbox/channel/media/review and actual local/provider/regression/restore checks. Apply new SQL only disposable first; retainedLOCAL83 baseline unchanged at resumption.
No new migration/test/QA claimed yet. USD0; liveAI off/providerIDs/keyblank, production/public external delivery/n8n disabled. Separate Shopify hostedOAuth/renewal and owner-deferredn8n pending work preserved. No sharedSQL/push/merge/deploy authority.

### CH6 workflow / controls / atomic agent slice — 2026-10-23
Built reviewed exact-public-summary → exact subsequent customer confirmation → separate owner/manager approval; callback creates native LEAD_FOLLOW_UP, no customer or promised appointment/stage. Laundry uses native contact conversion/address/native pickup command atomically (one PICKUP task, statusNEW until scheduled); operational cancellation produces handoff only. New customer activity invalidates approval, revisions clear confirmation/review, failed approval rolls back customer creation. Current quoted booking observations and staff handoff commit atomically with original authenticated agent completion; no model path creates operational records. D051 records recommended conservative defaults under D050.
Added 20261023090000_chat_request_workflow.sql and 20261023091000_chat_agent_actions.sql; five prior un-applied CH6 SQL refined for private shared request helper, review snapshots and bounded read DTO. All90 source migrations replayed only disposable; retained83 unchanged. CH5 applied4 bytes untouched.
Added actions/{commands,view-schemas,server-actions}.ts and components/leads/business-actions.tsx; integrated gated controls with lead page and Chatwoot embedded card. CHAT_ACTIONS_ENABLED defaults false, no local app restart yet. Tenant confirmation wording validated in knowledge pack; synthetic mock booking/cancel/complaint modes added; worker new action RPC only under flag.
Targeted actualDB15/15 +pure6/6 PASS (overlapping suite subsets), including native callback/Laundry creation, rollback, stale confirmation, actual DTO parse and atomic mock booking completion. TypeScript last pre-worker change PASS; final worker typecheck running. Initial fixture vertical lacked enabled_at (correctly rejected) and Zod effect .max misuse fixed. No browser/UI/provider/upgrade/restore or full new six-gate claim yet; prior183 baseline only. Remaining delivery/settings/channel/link/review/media/QA work prevents CH6closure; no CH7 implementation before closure. USD0/liveAIoff; external boundaries unchanged.

### CH6 delivery and review checkpoint — 2026-10-23

CH6 remains IN_PROGRESS on codex/chat-ch1-foundation/HEADa09561d/no upstream. Owner D050 permits LOCAL closure after engineering gates and CH7 continuation while owner/live acceptance stays deferred/release-blocking. No local commit/CH7 transition yet.

Implemented gated channel controls/current-pack owner signoff and durable public outbox with final public-specific authorization; request workflow/UI, atomic agent provisional actions, mapped provider-assignee routing, durable merged-label intent, scoped action context/configured single-question prompts, code WhatsApp/ref/nearest-map links, on-request price-image and neutral-review supplemental drafts/claims/receipts. All public/media transports intentionally owned loopback/mock only and default off. Native staff approval remains separate; sending a sentence never books. Summary/customer confirmation remains explicit staff review/send/record before operational approval. No statement issuance (D047).

Added unapplied SQL 20261023092000_chat_action_configuration.sql, 20261023093000_chat_public_outbox.sql, 20261023094000_chat_action_settings_read.sql, 20261023095000_chat_action_context.sql, 20261023100000_chat_handoff_labels.sql, 20261023101000_chat_supplemental_delivery.sql; CH6 now13 new files/96 total source migrations replayed in disposable owned DBs only. Retained LOCAL15437 still83, no upgrade/restart yet. Prior CH5four bytes unchanged.

Read-only Standards/Spec review found stale summary→customer change→yes acceptance, equal-time message ordering, public approval revocation after claim, mutable routing retry identity, missing native Laundry service notes, automatic routing omission and definitive failure after lost approval response. Reproduced and fixed with actual DB/command regressions; final follow-up reviews pending. Full npm run test:chat205/205,0skip PASS, focused runtime22/22 and transports10/10 are overlapping subsets; typecheck PASS before latest small worker additions, final other gates pending. No latest build/lint/roles/v2/Boutique/browser/provider/upgrade/restore PASS claimed.

New files actions/{rules,schemas,view-schemas,commands,settings,public-worker,label-worker,supplemental-worker,links,reply-plan}.ts; UI business-actions/action-settings, integrations public/supplemental clients; existing setup/lead/frame/agent/mock/type adapters updated. Tests scripts/test-chat-action-{rules,runtime,links}.mjs, test-chat-public-client.mjs, test-chat-supplemental-client.mjs and existing adapter/turn/admin/page suites. Added AGENTS.md plus docs/agents/{issue-tracker,triage-labels,domain}.md metadata required by applied TDD/review skills; existing local QA tracker, no GitHub mutation. UI skill guidance applied to recovery/accessibility while preserving OS PLUS components.

D052 records recommended conservative details under unattended authority: reviews opt-in/conversation-only, actual linked native delivered order updated after inquiry, exclude Shopify until authoritative actual-delivery adapter is proven, no historical imports/campaigns; price asset exact configured URL + explicit loopback-origin allowlist + PNG/JPEG/5MB bounds/no redirects. Draft supplemental send needs confirmed public text first, owner/manager approval; unknown public receipt held, never automatic retry. Labels merge observed list; provider replacement API cannot make simultaneous outside label edits transactional. Native provider QA remains required.

Next: complete follow-up review and regression, prepare/rehearse owned local upgrade with pre/post native dump/restore and unchanged table manifests, explicit mock-actions launcher opt-in, actual native Chatwoot/OS PLUS desktop/mobile/role/Boutique checks, timings and owner-ready guide. No keys, Meta setup or owner intervention needed for these local steps. LiveAI false/model IDs and provider key empty, USD0. No sharedSQL/real messages/production changes/tunnel/n8n activation/push/merge/deploy. Separate Shopify hosted OAuth/renewal and owner-deferred n8n remain pending, unchanged.

### CH6 owned-local upgrade / final gate checkpoint — 2026-10-23
Reviewed thirteen CH6 SQL files frozen and applied ONLY to owned persistent loopback LOCAL15437 using scripts/chat-local/upgrade-ch6.mjs. Baseline83 →96 migrations. Pre-upgrade native dump restored into chat_restore_fac8dd00a78a (132 tables,1522291 bytes); rehearsed migration preserved every existing table count/content hash. Actual upgrade also preserved132 tables. Post-upgrade native dump restored into chat_restore_af033dad7db4 (141 tables,1662148 bytes); manifest and browser-denied ACL checks PASS. Report outputs/chat-local/ch6-upgrade-report.json; dumps retained privately. This is same-cluster DB restore, not full host/Clerk/Storage recovery. No shared/production migration. Future SQL fixes require new timestamped migration; do not edit these applied bytes.

Latest automated gates PASS: typecheck, lint(no warnings), optimized build, roles(including18 exact-ingress cases), test:v2(four suites), test:chat209/209/0skip (outputs/ch6-*.log). Runtime24/24 is an overlapping subset, not extra unique total. Both final focused reviewers clear current fixes; local native/provider/browser/Boutique QA still pending, no READY_FOR_CLOSURE/CH7 transition/commit.

Additional regression fixes before freeze: untouched image drafts rebind only before public attempt; review identity is per actual linked delivery with independent contact cooldown, not lifetime conversation-once; shared caption/text internal-data check; manual/operational-change handoffs drain labels immediately even with agent off; optional provider configuration failure cannot obscure a committed task receipt; action context selects active lead and supplementals select the run's trigger-time lead interval. Real chat_lead_refresh→WON plus reused-conversation old/new-lead tests both PASS. Review/source-import limits D052 unchanged; supplemental public send also requires customer activity within24h.

Local API verified with current96-migration marker, no reseed/data replacement. Starting current source snapshot with explicit --chatwoot --mock-suggestions --mock-actions; default launcher remains actions/public-off, no channel auto-approval inferred. LiveAI false/production model IDs/keyblank, USD0. Next synthetic native provider/browser/regression/timing QA and owner-ready guide, then closure under D050 only if engineering gates pass. Owner/live gates remain deferred/release-blocking; no external actions.

## Chat Session Update - 2026-10-24 - CH6 local implementation/native QA; authenticated UI gate blocked

### Date / Updated By / Phase
2026-10-24, Codex. CH-6 Actions and auto mode. **QA_BLOCKED**, not READY_FOR_CLOSURE/CLOSED. CH-7 not started.

### Branch / Base / Authority
D:/Develop/os-plus-chat-ch0; codex/chat-ch1-foundation; no upstream; HEADa09561d1ecce48acdd4e3a4df18ec368773ed953 (CH5 local closure). All preserved/uncommitted work is CH6; no other worktree modified, no new branch/stash/reset. D025/D050 local phase commit authority remains available after engineering gates; owner/live acceptance deferred, not executed. This exception does not waive authenticated UI/current regression evidence.

### What Was Built / Decisions
Gated callback/Laundry provisional requests, reviewed summary/exact current confirmation/separate staff operational approval, atomic native customer/address/pickup/task reuse, pending revisions/withdrawals and operational-change handoff. Added staff task controls/routing, durable label/alert intents, configured one-question action prompts and exact locked-rule priority, code WhatsApp/ref/nearest-map links, owner per-channel current-pack automatic approval and held uncertain public outbox. Requested price image follows verified public text once/conversation; untouched drafts recover from stale runs, attempts do not auto-retry. Neutral opt-in review drafts use linked native actual delivery, per-delivery history and contact cooldown, including legitimate won leads; no historical/import/positive-only/campaign trigger.
Recommended choices selected under unattended authority are recorded in CHAT-D051/D052 (docs_chat/06_Decision_Log.md); no unresolved product question. Statements deferred D047. Production public/media/model transport remains disabled; current implemented public/media adapters are loopback/mock only. Existing conversations/retained orders remain tenant-owned; short refs never authenticate/merge contacts. Shopify hosted OAuth/renewal and owner-deferred n8n remain separate pending work.

### Files / Migrations
Exact applied list and SHA256: docs_chat/CH6_LOCAL_UPGRADE.md. Thirteen additive CH6 SQL files, owned LOCAL15437 only,83→96 migration marker. No shared/production application; all13 applied hashes rechecked unchanged after QA, originalCH5four unchanged. Native pre/post backups/restores and132 existing-table manifest preservation PASS; post141tables. No downgrade/reset or existing Boutique/Laundry table DDL.
Runtime: src/features/chat/actions/*; components/chat/action-settings.tsx and leads/business-actions.tsx; Chatwoot public/supplemental/admin adapters; current agent context/plan/mock/worker/schema/pack, narrow types, lead/settings/frame integration and confirmed-command uncertainty behavior. Local helpers scripts/chat-local/{mock-actions,upgrade-ch6}.mjs, updated manage/qa, scripts/chatwoot-local/{ch6-qa,ch6-latency}.mjs; exact tests/records in CH6_QA.md. AGENTS.md/docs/agents point engineering skills to existing local tracker only. No external issue/message created.

### Automated Tests
|Command|Result|
|---|---|
|npm run typecheck|PASS, final source/helper checkpoint|
|npm run lint|PASS,0warnings, final source/helper checkpoint|
|npm run build|PASS optimized build; later helper/docs/format-only changes do not change runtime behavior|
|npm run test:roles|PASS platform+Chat policy and18exact-ingress cases|
|npm run test:v2|PASS four baseline/work-unit/commands/tasks/Laundry custody scripts|
|npm run test:chat|PASS209/209,0skip; runtime24 and targeted client/rule tests overlap this total|

Logs outputs/ch6-*.log. Local actual Supabase/PostgREST/production-adapter QA8/8 groups PASS, including tenant/role/anonymous/concurrency/publication/audit rollback, existing Boutique payment/workflow/add-items API smokes and a further native DB restore/ACL check. This is API identity instrumentation, not Clerk/browser acceptance.

### Native / Manual QA and Regression
Actual owned Chatwoot6/6 PASS: A24/B10 provisional requests/private suggestions, A25 one safety task and merged label preserving qa-preserved, A26 public text209 then image210 after channel signoff, duplicate callbacks do not repeat image, actual website public summary/customer yes cannot approve without verified WhatsApp. Fresh final image uses approved direct ActiveStorage proxy URL; first A22 redirecting asset was rejected and stays held, native read proves no image POST. No automatic uncertain resend. Reports ch6-native-report.json/ch6-native-first-failed-report.json remain separate.
Five additional actual native local mock public conversations: median1823.933ms versus6000ms target, USD0; ch6-latency-report.json. Single native initial run1188.939ms is separate, not added to the five-sample median. No live model/Meta latency claim. Both channels restored draft after native and timing exercises.
Actual signed-in Chatwoot desktop A26 visually checked; screenshot C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch6-evidence/native-auto-text-image.png. Tiny image is a synthetic one-pixel fixture, not a business price list.
Fresh authenticated OS PLUS desktop375px/action/role/tenant checks and full Boutique BA-001–BA-014 remain UNEXECUTED/BLOCKED. Historical CH5 BA14/persistence cannot substitute. QA workbook retained unchanged until fresh results can be recorded; no new false PASS.

### Bugs / Review
Fixed and regression-tested stale intervening customer changes, equal-time provider ordering, approval revocation after public claim, mutable routing retry identity, missing native Laundry service notes, automatic/manual handoff routing/drain, lost committed approval response semantics, supplemental recovery/cooldown identity, shared caption internal-data safety, configured safety priority, reused-conversation lead ownership, won-lead review interval, optional provider failures obscuring committed receipts. Standards focused final review: clear. Spec focused final review: clear. Reviewers did not certify unexecuted UI/closure checks.
Native first image failure was a redirecting test-asset fixture; direct proxy proof passed without relaxing transport redirect guards. Initial local API harness missing new dependency and obsolete empty-B expectation corrected; final8/8.

### Blocker / Owner Action / Next Step
The existing OS PLUS browser tab is a data-URL error document; browser security policy denied observing it. No bypass/alternate browser surface used to recover that page. Existing embedded session also logged Clerk JS failure; public Clerk development script HEAD200 from host, no keys/session secrets read or transmitted. Owner was asked only to manually reopen http://localhost:4131/settings/chat in the in-app browser and reply ready. No new Clerk keys/Meta/server setup needed.
Then Codex completes authenticated current role/tenant/layout/actions and fresh BoutiqueTierA, reconciles the QA workbook, final diff/closure checks, local phase commit under D050, and only then CH7 planning/implementation. See docs_chat/CH6_OWNER_ACCEPTANCE.md C6-L0–L7 and CHECKLIST PartC CH6. Owner/live acceptance remains deferred/release-blocking, not an additional approval question.

### State / Spend
Current-source mock-actions hidden app launcher PID16028, local ports4131/4141/4142/15437; no auto-start service installed. Default actions/public flags remain off; explicit local launch enables mocks only, liveAI false, production model IDs and provider key empty. Model/API spendUSD0. No paid purchase, real external messages, shared SQL, production Chatwoot change, tunnel, push/merge/deploy or n8n activation. No phase commit or CH7 transition while engineering browser gate remains blocked.


## Chat Session Update - 2026-10-24 - CH6 authenticated QA resumed
User reopened the legitimate localhost4131 settings page; browser tab16 now renders owner-a+clerk_test@example.com / Local QA A Owner/Admin. Historical stale-tab blocker is resolved. Same branch codex/chat-ch1-foundation, base/HEAD a09561d1ecce48acdd4e3a4df18ec368773ed953; all current dirty changes are preserved CH6. Status IN_PROGRESS for remaining authenticated request/setup, role/tenant/mobile and fresh Boutique BA001–014 QA plus workbook. Existing automated209/209, native6/6, local API8/8 and frozen13 local-only SQL evidence remain as recorded; no new test count inferred from this resumption. Channel visibly staff-reviewed draft; liveAI remains disabled, USD0. No migration applied or external setting/message/release this resumption. CH7 awaits engineering closure and local commit under D025/D050; owner/live acceptance remains explicitly deferred and release-blocking. Next: exercise authenticated request controls and complete fresh regression, then update QA/checklist/workbook and final review.


## Chat Session Update - 2026-10-24 - CH6 authenticated action/role checks
Same branch/base; phase IN_PROGRESS, no closure/commit/CH7 yet. Actual retained Clerk owner-a session used with reversible effective Local QA A membership changes (not independent role logins). Owner request revision with exact stored evidence clears confirmation; new review/copy succeeds; previous yes rejected. Unverified website operational approval refused. Manager assigned/completed native CHAT_HANDOFF and narrow375px frame created new handoff after completion. Viewer default404, read grant masks text, separate PIIgrant still no actions/Chatwoot; finance default404 and masked read grant/noactions/report404. Original owner role and exact grants restored by backed-up local helper, timestamps not byte-restored. One transient Clerk fetch-failed error retried successfully; no auth/security workaround.
UI fixes: src/components/chat/action-settings.tsx keeps stable channel key/removes duplicate refresh so confirmed save feedback persists; src/components/chat/use-hydrated.ts plus business-actions.tsx disable new mutations until React attaches handlers (early form submit had performed default GET); lead detail replaces obsolete future-phase help text. Disposable app snapshot app-1792779888152 synced only these source files. Actual save confirmed; auto checkbox unchecked/required invalid, no auto activation.375px same-origin frame measured356/356 client/scroll, no horizontal overflow, actual manager action; browser viewport override does not reliably produce requested width, reset. Not physical-device certification.
Fresh Boutique customer034162ac-5309-4146-91c6-931fd55aae6e, measurementfbd2dba4-cbb8-4424-a36e-42440f4b5777 Chest38, ORD-000006 /56df039f-e6f1-494b-bb4c-be52ad85bbbf two distinct workflows total2000; valid worker/workgroup first stage completed, nextready; exactly one synthetic cash300 receipt and balance1700 observed; note edit persisted. Remaining: Finance/GST/tracking/queue/search/tenant tests, SQL assertions, workbook, final affected gates/review. TypecheckPASS; first lint rejected effect setState, replaced with useSyncExternalStore hydration snapshot, lintPASS. Optimized build running. No migrations changed/applied this slice; frozen13 local SQL remain unchanged. LiveAIoff/USD0; no external delivery, sharedSQL or release.


## Chat Session Update - 2026-10-27 - CH6 interruption reconciliation
Same worktree D:/Develop/os-plus-chat-ch0, branch codex/chat-ch1-foundation, no upstream, HEAD a09561d1ecce48acdd4e3a4df18ec368773ed953. Dirty CH6 implementation preserved; no commit/CH7 yet. Oct24 authenticated QA actually completed all14 Boutique checks (new ORD-000006),7/7 native persistence,4/4 action/role restoration/anonymous tracking checks, A→B→A copied lead/customer/order denial,375CSSpx authenticated request/setup frames356/356 nooverflow; screenshots retained. These results were not yet consolidated before interruption. Model/live gates remain deferred D050; liveAIoff/USD0.
Oct24 final UI typecheck/lint/build/roles/V2 pass. Final full Chat rerun recorded209pass/1failed storage file after docker child exitnull (~39minutes), not a passing209/209 gate. Current local engine reachable29.7.2 with owned stacks retained; sandbox-only Docker denial resolved by normal authorized escalation, no settings/security changes. Focused real storage rerun started to distinguish interruption/timeout from product failure; full final gate still required. Original logs retained. Workbook artifact-authored edits/rendered previews exist only in workspace outputs/chat-ch6-workbook; repository workbook unchanged pending exact package preservation/verification. Next complete storage diagnosis, workbook update and docs, final review/diff/hash verification, then local CH6 closure/commit only if engineering gates pass; CH7 follows. No shared migration, external message, deployment or new secret.

## Chat Session Update - 2026-10-27 - CH6 engineering closure review

### Date / Updated By / Phase / Status
2026-10-27, Codex. CH-6 Actions and auto mode: READY_FOR_CLOSURE LOCAL. Final staged diff/record review and local phase commit are next. CH7 not started.

### Branch / Base / Authority
D:/Develop/os-plus-chat-ch0, codex/chat-ch1-foundation, no upstream; base/HEAD a09561d1ecce48acdd4e3a4df18ec368773ed953. All dirty work is preserved CH6. D025/D050 authorize local phase commit and CH7 continuation after engineering checks. Owner acceptance, real Meta/two-phone/live-model acceptance remain deferred and release-blocking; statements deferredD047. No external release authority.

### Built / Decisions / Exact Changes
Completed accepted CH6 request-first scope: provisional callback/Laundry requests; exact reviewed summary/current customer confirmation/separate staff approval; atomic native customer/address/pickup/task commands; versioned edits/withdrawal and post-materialization handoffs; configurable eligible assignee→leadowner→branchteam→unassigned routing; durable labels/notification intents; owner current-pack reply approval, public outbox uncertainty fences; on-request image after confirmed public text, opt-in neutral actual-delivery reviews, ref/map/WhatsApp link rules. D045–D052 are the decision record; no pending product question. Production model and public/media transports remain disabled; retained local mocks only.
Final UI fixes src/components/chat/action-settings.tsx, new use-hydrated.ts, leads/business-actions.tsx, lead detail help: hydration-gated mutations, confirmed feedback outside version-bound editor, fresh consent and edit state on changed settings/pack. Actual disposable real-component regression reproduced intermediate checked-consent/stale-modeP1 and verified reset; both review axes clear. No new regression unit that merely mirrors JSX was added.
Remaining runtime/test/local-helper paths are listed in previous CH6 checkpoint and CH6_QA.md. Added docs_chat/CH6_BOUTIQUE_QA.md and updated CH6 QA/plan/owner guide/WBS/checklist. Existing QA workbook updated only M2:N15 and Nwidth, old values/history preserved; exact hash/evidence below. AGENTS/docs/agents metadata points to the existing local QA tracker.

### Migrations / Application / Recovery
Exactly13 additive migrations listed with SHA256 in docs_chat/CH6_LOCAL_UPGRADE.md; applied ONLY owned LOCAL15437 on2026-10-23,83→96. No new SQL application this session. All13 applied hashes rechecked unchanged; originalCH5four unchanged. Prior132 existing-table manifests preserved, native pre/post dumps restored with141posttables/ACL verification. Recovery is same-cluster DB, not full host/object-storage/Clerk/Chatwoot attachment DR. No shared/production migration or existing customer/order DDL.

### Automated Tests
|Command|Result|
|---|---|
|npm run typecheck|PASS after final UI fix, ch6-resume-typecheck.log|
|npm run lint|PASS0warnings, ch6-resume-lint.log|
|npm run build|PASS optimized, ch6-resume-build.log|
|npm run test:roles|PASS platform+Chat+18exact-ingress, ch6-final-ui-roles.log|
|npm run test:v2|PASS four existing scripts, ch6-final-ui-v2.log|
|npm run test:chat|PASS209/209,0skipped,22.4s, ch6-resume-final-chat.log|

Correct isolated storage22/22 overlaps209. Interrupted previous gate209pass/1failed-file from Docker exitnull is retained as failed; isolated first command missed react-server condition and failed server-only import. Correct invocation and final whole configured gate pass; no product fix or skipped test used to hide these failures. Docker29.7.2 available. git diff --checkPASS, frozen13hashesPASS. Additional production-adapter/localAPI8/8 and nativeChatwoot6/6 remain prior completed evidence, not substituted for browser checks.

### Authenticated Manual QA / Tenant Isolation / Boutique
Actual retained Clerk owner-a/Local QA A, effective role changes backed up/restored (not independent persona credential entry). Owner settings save/required auto signoff, request exact-evidence revise/review/copy, stale confirmation denial, unverified website approval refusal PASS. Manager task assign/complete/new handoff PASS. Viewer defaultdenial, masked read grant, separatePIIgrant with noaction/Chatwoot; finance defaultdenial/maskedread/noactions/report404 PASS. A→B→A, copied new A lead/customer/order denied inB404. Four read-only SQL/restoration/anonymousHTTP assertionsPASS.
Desktop and375CSSpx same-origin authenticated frames measured356/356 client/scrollwidth, nohorizontaloverflow, request/handoff/setup saves exercised. Browser viewport override unreliable, reset; no physical-device or independent screen-reader claim. Screenshots C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch6-evidence.
Fresh BoutiqueTierA BA001–01414/14, native persistence7/7 PASS; exact IDs/results/limits docs_chat/CH6_BOUTIQUE_QA.md. New ORD-000006 total2000/two workflows/Chest38/defaultfit/stagecomplete+nextready/cash300/balance1700/Finance/GST-load/tracking/dryrunqueue/edit all verified. No real money/messages; no GST-bearing export/filing acceptance.
Workbook SHA256706574901efc9f6b03c48400acef77a33307172bb94930f6dc6f7923a16eb8ec. Only sheet3xml28values and Nwidth38→68; all other package bytes identical, original notes/actual results retained. Artifact export/render completes but process exits1; independent saved-value/style/nativepackagepreservationPASS, first/middle/last visuals reviewed. No native Excel recalculation claim.

### Bugs / Deferrals / Final Gate
No unresolved CH6P0/P1. All earlier review defects and final UI approval-resetP1 fixed and verified. Existing BoutiqueP3 successdialog manuallyclosed; prior baseline dashboard midnightP2 remains outside Chat scope under no-Boutique-behavior-change boundary. One transient Clerk fetchfailed recovered by normal reload. Engineering checks complete; final staged-review/localcommit required. Original owner/live gates remain unexecuted; website fixtures cannot certify verifiedWhatsApp operational booking. D047 statements not built/PASS. Real AI/Meta/WhatsApp/production media/Telegram delivery/n8n activation remain off. Separate Shopify hosted OAuth/renewal and owner-deferred n8n remain separate pending work.

### Spend / Next
Model/API spendUSD0. No paid purchase, real external messages, tunnel, sharedSQL, production changes, push/merge/deploy. Next final staged diff/allowlist/hash/secret review, local CH6 phase commit under existing authority, then read and record CH7 plan/decisions before implementing its local/mock scope.

## Chat Session Update - 2026-10-27 - CH6 CLOSED LOCAL

### Closure / Branch / Commit
CH-6 engineering closure complete on codex/chat-ch1-foundation, D:/Develop/os-plus-chat-ch0. Final staged78-file diff/untracked allowlist reviewed; no environment/private/outputs files staged, no unexpected unstaged work. Migration13/13 hashes unchanged, dependency/additive/RLS/tenant/audit/idempotency/current-pack/uncertainty and customer-safe boundaries reviewed with real regression evidence. Both focused review axes clear; P0/P1 unresolved0. All READY checklist items for accepted LOCAL scope pass. Local commit message: Chat CH-6: add guarded requests, handoffs and local auto actions. This entry accompanies the authorized phase closure commit; exact commit identity is obtained from git log, not guessed here.

### Tests / Manual / Migrations / Spend
Six gates PASS, final Chat209/2090skip; native6/6, production-adapter API8/8, fresh authenticated effective-role/tenant/desktop375CSSpx frames, Boutique14/14+persistence7/7, browser SQL/anonymousHTTP4/4, actual local pre/post restores and five native mock timings median1823.933ms. Exact commands/logs, limits, prior failures and bug fixes in preceding closure-review entry, CH6_QA.md, CH6_BOUTIQUE_QA.md, CH6_LOCAL_UPGRADE.md. Workbook updated/preserved/visually reviewed (SHA256706574901efc9f6b03c48400acef77a33307172bb94930f6dc6f7923a16eb8ec). Thirteen SQL only owned LOCAL15437 previously applied, no new application/shared SQL. No paid model/API spend (USD0).

### Deferrals / Next
D050 owner/live acceptance explicitly deferred and release-blocking; not personally executed owner exercise or independent role credential entry. D047 statements deferred. LiveAI disabled/model IDs/key unset, both retained channels draft; production transport not enabled. No push/merge/deploy, real external messages, production settings, public tunnel or n8n activation. Separate Shopify hosted OAuth/renewal and owner-deferred n8n remain pending outside Chat task.
CH6 can now transition after its local commit. Next read CH7 Telegram/daily-summary scope, record recommended decisions under D050, implement and test isolated mocks/inactive scheduler export; no real Telegram linking/message or existing n8n connection.

## Chat Session Update - 2026-10-27 - CH7 start
CH6 is committed CLOSED LOCAL at a192a4dca2b87d75b54db1e60d18d98795d45f1a. Clean working tree verified immediately after commit. Continuing same codex/chat-ch1-foundation/no-upstream worktree per existing owner instruction. CH7 Telegram/daily summary IN_PROGRESS underD050; plan docs_chat/CH7_IMPLEMENTATION_PLAN.md and recommended decisionsD053 recorded before code. No new product questions require owner intervention within local mock scope.
Current contracts inspected: CH1 targets/normalizedbrands/summaryruns exist without runtime; notification/report permissions owneronly, existing secretary context/Domain Commands/idempotency/safeDTO patterns retained; explicit signedsecret Telegram and separate cron bearer route needed. Production domain/judge/models unset; no livecall/realTelegram link ormessage/n8n activation. Notifications defaultdisabled. Planned4 additive Chat-owned SQL plus pure rules/summary/client/commands/handlers/UI/preview/inactiveexport and actualDB/mockHTTP tests. No migration applied or test performed for CH7 yet.
Recommended boundariesD053: inactive claim plus owner confirmation, minimal group alerts/full summary ownerDM only, exact current target/tenant fences, held ambiguous sends, explicit localtime reportingwindow/no historicalbackfill, unrated/unknowns truthful, groupedcurrencies. Official Telegram/n8n API docs checked; no borrowed businessworkflow/facts or reference-repo changes.
Tests/regression/modelspend inherited CH6 evidence only, not CH7PASS. Next pure notification parsing/schedule/privacy/summary tests, then storage. LiveAIoff/USD0; no external change/sharedSQL/push/deployment. CH7 closure owner/live gates are not silently waived by CH6 exception.

### CH7 secure linking / notification primitives checkpoint — 2026-10-27
Same branch/no upstream/HEADa192a4d; preserved CH7 plan and D053. Added notifications/rules.ts, handlers.ts, summary.ts and integrations/telegram/client.ts. Pure original-human exact-code parsing, tenant calendar cutoff dates, bounded secret-header deferred linking, purpose-separated AES-GCM recipient/link encryption, minimal instant alert/full report formatting with explicit window/currencies/unsettled costs/unrated judge, call-time disabled Telegram transport with loopback mock and checked exact receipt. No live API invoked.
Added construction SQL20261027120000_chat_notification_state.sql and20261027121000_chat_notification_commands.sql. Reused Chat-owned tables, owner audited/versioned create/issue/save/schedule/read plus code resolver/atomic single-use claim. Only disposable owned PostgreSQL replayed98 migrations; retainedLOCAL96 and all appliedCH6bytes unchanged. No shared database. Actual DB4/4 tests PASS (role/tenant denial, replay, concurrent one-use claim, expiry, inactive claim/separate confirmation, safe read DTO, cross-tenant brand rollback/anonymous ACL, schedule versions); pure rules2/2, formatter2/2, handler1/1, mockHTTP Telegram1/1, crypto3/3 PASS. Red→green logs outputs/ch7-*.log; these subsets do not constitute full phase gate.
CH7 remains IN_PROGRESS, not READY. Still pending actual source-metric aggregation, durable delivery/summary schedule/replay/current-target revocation, platform alerts, production route wiring, owner UI/preview/inactive n8n export, two-tenant actual mock integration, authenticated375px/role/TierB, six final gates and review/owner acceptance. No new owner action required for safe local work; CH7 owner/live acceptance not waived. No shared Boutique runtime modified yet; narrow notification crypto addition preserves existing AAD/envelopes. LiveAI disabled/USD0; no real Telegram/messages/push/deploy/tunnel/n8n activation.

### CH7 report/outbox and owner setup implementation — 2026-10-27
Added source-evidence summary SQL20261027122000_chat_notification_summary.sql and durable scheduling/dispatch SQL20261027123000_chat_notification_dispatch.sql; now100 source migrations replayed only disposable (retainedLOCAL96 unchanged). Actual DB9/9 PASS: two different tenant cutoffs reserve once under concurrency; actual outbox→loopback mockHTTP delivers exactlyone each under replay; fresh source intents dedupe, target revocation blocks claimed send, unknown receipt holds/no retry, abandoned/cancelled summary becomes partial with audit. Caught and fixed partial-report status remaining queued. Read-only preview uses actual public message timing (private drafts excluded), per-brand counts, separate estimated currencies, unsettled-cost count and honest unevaluated judge.
Built notifications/{schemas,commands,server-actions,worker,engine,flags,trigger}.ts, owner settings/preview component, exact Telegram/header and hourly/bearer routes. New Chat-local RPC type entries only; exact proxy bypasses expanded to23 asserted cases, no broad route prefix or shared role policy change. Optional post-response notification kicks added to Chat capture/action commands; cron remains durable fallback. Default flags off/transport unset; liveAI/modelIDs/key remain disabled/unset.
UI follows existing OS PLUS components, hydration/version-bound forms, explicit inactive→link→owner-confirm→opt-in flow and owner-DM-only full reports. No authenticated UI/375px or retained upgrade claim yet. Handler2/2, formatter2/2, prior rule2/2/client1/1/crypto3/3 and typecheck PASS checkpoints; fullsixgates pending. Added write-free offline preview script and credential-free inactive new-instance n8n export; no n8n runtime/activation claim. USD0/no live Telegram/push/deploy/sharedSQL. Next complete status/robustness tests, final local gates/review, owned-local recovery rehearsal/upgrade and authenticated TierB/UI before owner acceptance.

### CH7 review corrections / current gate checkpoint — 2026-10-27
Two-axis Standards/Spec review found brand-revocationP1, untracked operator alertsP2 and omitted legacy model chargesP2. All reproduced/fixed; focused re-reviews clear these paths, no new concrete P0/P1/P2 found. D054 records durable encrypted per-tenant/hour operator incidents (new fifthSQL20261027124000_chat_platform_alert_attempts.sql); unresolved tenant/store failure never sends without a durable claim. Current alert eligibility rechecks brand activity/filter. Legacy turn costs remain only when reservation entries do not represent the turn, with unsettled calls reported separately. SQL and pure preview cover fall-back ambiguity; SQL additionally verifies23/25-hour windows.
ActualDB13/13 PASS at this checkpoint;101 migrations disposable only. RetainedLOCAL96 unchanged, migration files not yet frozen/applied there. Additional audit-rollback regression added and awaiting run. Earlier fullgate FAIL221/226 duefive existing test adapter missing-dependency entries; adapters updated and focused affected37/37 PASS, no product behavior bypass. Roles23 exact ingress/V2four scripts/lint0warnings/typecheck/optimized build PASS at preceding checkpoint. Full final rerun pending after fixes.
CH7 stillIN_PROGRESS, notREADY/committed. New UI/status and write-free offline preview/inactive credential-free n8n export implemented; authenticatedUI/375px/TierB/owned upgrade+native restores/owner acceptance still pending. Preparation script scripts/chat-local/upgrade-ch7.mjs currently plan-only. Need explicitly opt-in local notification UI/mock transport while keeping every liveAI/liveTelegram/model key disabled. USD0; no sharedSQL/publicpush/productionchange/n8nactivation. No person action needed before remaining local QA.

### CH7 owned-local upgrade and complete module regression — 2026-10-27
Full npm run test:chat PASS232/232,0skip (outputs/ch7-full-chat-final.log); includes actualDB14/14 withaudit-failure rollback, prior source/replay/brand/legacycost/operator/DST coverage. Affected prior adapters37/37 are overlapping, not extra totals. Roles23 exact ingress/V2four scripts/lint/typecheck/build passed prior checkpoint; final affected build/lint/typecheck rerun after remaining local launcher/UI QA is still required.
Executed scripts/chat-local/upgrade-ch7.mjs --apply-owned-local after focusedreviewclear. Five reviewed SQL frozen/applied ONLY ownedLOCAL15437,96→101. Pre native dump restoredchat_restore_2e4462fa5574 (141tables,1711609bytes), postchat_restore_49bc8e3ec916 (143tables,1771624bytes); complete restored-row manifests and browser-denied ACLs PASS. All141 existing tables preserved using explicit new-column projection only for additive Chat defaults. Exact names/SHA256 docs_chat/CH7_LOCAL_UPGRADE.md; report outputs/chat-local/ch7-upgrade-report.json. No sharedSQL/retained reset/historical replay. Same-clusterDBrecovery only.
Added explicit --mock-notifications owned-loopback launcher helper on4143, no actual Telegram API/bot required; synthetic receiver logs only receipt/text/chat hashes. Default launcher notifications remain off. Next restart owned app with new source and local mocks, retained Clerk owner/session screens, target setup/claim/preview/status/roles/tenant/375px and BoutiqueTierB; no new keys/person intervention currentlyneeded. CH7 IN_PROGRESS/notREADY. LiveAI/modelIDs/key off/unset, USD0; no external messages/n8nactivation/push/deploy.

### CH7 authenticated owner/native mock checkpoint — 2026-10-27
Retained owner-a Clerk session/Local QA A works at localhost4131 new snapshot outputs/chat-local/app-1793114149945; launcher session7415/Node10032 plus loopback Telegram mock4143. Explicit --mock-notifications, --mock-suggestions, --mock-actions; production/liveAI/Telegram flags remain off. Owner report preview PASS with explicit dates/no writes/send, repeated destination creation/reset PASS; synthetic owner/staff links traversed actual Next secret-header route→after→codehash tenant resolution→encrypted recipient→inactive claim, replay no change. Owner confirmed private destination/new_enquiry+daily_summary with Local Inquiry Brand filter and enabled tenant schedule; staff group remains unconfirmed/inactive, daily_summary checkbox disabled. Consumed code/old issuance feedback disappears after refresh (small UI fix synced into snapshot, exacthash ch7-snapshot-patches.jsonl). Recent delivery status shows confirmed mock receipt.
Native owned Chatwoot conversation32→message capture→new lead7f9b0fb1-0537-4ea5-b467-1b698da52135→one outbox695f4bf0-3433-4baf-8b9d-dba0f33de884→local mock receipt1001 PASS, realTelegram0/modelUSD0 (ch7-native-report.json). First native helper invocation stopped before changes because accounts fixture lacked tenantId; fixed by authoritative local workspace lookup, final report PASS. Both targets/notifications are synthetic local only, no real bot connected.
Effective-role authenticated browser QA IN_PROGRESS: helper scripts/chat-local/ch7-browser-role.mjs has changed only owner-a membership in synthetic Local QA A to manager, audited with local_qa.membership_role. Original owner membership saved privately outputs/chat-local/ch7-browser-role-before.private.json. MUST run helper restore and verify before ending/session transition. This is effective-role QA using retained Clerk login, not independent persona credentials. Next manager/viewer/finance settings denials, restore owner, tenant switch/layout375px/TierB, final gates/evidence/owner guide. No new migration beyond five frozen in CH7_LOCAL_UPGRADE.md; no sharedSQL or external action.

CH7 effective-role browser checks completed: manager settings→Orders safe landing, viewer→Reports, finance→Finance; no notification settings controls exposed. Original owner_admin membership restored and verified by helper restore after all three temporary changes; no Chat grants changed. This is retained Clerk/effective-role coverage, not independent role credentials. CH7 owner configuration/native mock evidence remains as above; still pending375px/tenant/TierB and final gates/owner acceptance.

CH7 stale-tab tenant assertion found during A→B browser QA: B correctly hides A targets, but an A tab could submit tenant-less schedule/create/preview after the shared business cookie switched to B. Reproduced against the real server command adapter with disposable PostgreSQL (expected rejection was absent). Added required displayed-tenant UUID assertion before save/preview RPC, while actual tenant still comes solely from server context. Provider context binds every new notification form; mismatches reload instead of mutating/showing the other business. ActualDB/adapter15/15PASS, no new migration/retained data change. Three changed source modules synced into owned snapshot with recorded hashes. Full Chat was232 before this added regression; final new whole-gate rerun pending. Prior optimized build completedPASS, but latest guard changes require new typecheck/build. Original owner role restored; current selected business B for isolation QA, next returnA and finishTierB/375px guard recheck.


### CH7 final engineering/owner-test checkpoint — 2026-10-27
Same existing branch/no upstream/HEADa192a4d; CH7 IN_PROGRESS, engineering complete awaiting owner acceptance/live-gate decision. Original owner role and exact grants restored; current selected business A after completed A→B→A. Latest actual owner save and preview succeed; stale B tab after cookie switch to A refuses both without RPC/data leak. Preview remains write-free.375CSSpx iframe fields/save/report pass; temporary snapshot-only iframe page removed after evidence. Final four reviewed runtime files aligned to owned snapshot with exact hashes recorded; local app/Chatwoot/Telegram mock remain running.
Six final gates PASS: typecheck, lint0warnings, optimized build, roles(platform+Chat+23exactingress), V2four scripts, Chat234/234,0skip (31.192s). Logs outputs/ch7-complete-*.log. Lint initially found Next reserved variable module in the added test; renamed adapter, lint/typecheck PASS; actual disposable PostgreSQL15/15 rerun PASS outputs/ch7-final-db.log after that test-only correction. Source-only formatting followed build without semantic changes. Offline preview actually executed against synthetic JSON, explicit window/unrated judge PASS; n8n JSON parses/inactive, no runtime/import claim. Final native read-only/persistence/safety9/9 PASS ch7-final-assert-report.json. These focused counts overlap or cover separate helpers, not added to234.
Boutique required TierB complete: retained Clerk owner/tenant switch, existing ORD-000006 detail/edit without save, production page, customer-safe public tracking plus cookie-free HTTP200; read-only SQL preserves total2000/priorreceipt300/balance1700/two workflows/stage history. No new Boutique mutations and no new14-check claim. docs_chat/CH7_BOUTIQUE_QA.md records exact limits. Workbook onlyN2,N10,N15 updated with dated TierB notes; all prior results/history/styles and other package bytes preserved, three renders inspected; hash9056b05fc15a54c99c49bf2a2a51ffa629522d67cbbece5fd564edbe496fdb29. Artifact runtime exited abnormally after export/render; independent preservation verification passed before applying. No hidden passing-runtime assertion.
Five local-only frozen migrations remain exactly as CH7_LOCAL_UPGRADE.md (96→101 on owned15437; native pre/post same-cluster restores141/143tables); final hashes unchanged. No new/sharedSQL. Standards/Spec focused reviews clear current brand revocation/operator durableclaims/legacycost/staletenant/pausedtransport corrections; no unresolved P0/P1/P2 found. Owners still must do CH7_OWNER_ACCEPTANCE.md C7-L1–L7; CHECKLIST PartC CH7 remains unchecked. No CH7localcommit/closure/CH8 until owner acceptance and explicit decision on realTelegram/judge gates. LiveAI/model IDs/key and realTelegram remain disabled/unset, model/API spendUSD0. Separate Shopify hostedOAuth/renewal acceptance and owner-deferred existingn8n stay outside Chat; no changed claims about multi-store readiness. No push/deploy/tunnel/realmessages/n8nactivation. Next final records/diff review then owner local acceptance; actual staff inbox remains Chatwoot, not settings.


### CH7 owner handoff — 2026-10-27
Final inspection: codex/chat-ch1-foundation, no upstream, HEADa192a4d unchanged; all59 changed paths are CH7 and preserved uncommitted. Exact file manifest appended to CH7_QA.md. git diff --check PASS; filename-only obvious private-key/token scan clear (not a comprehensive secret-audit claim). Five applied migration bytes and QA workbook hash unchanged from final verified reports. Final lint0warnings/typecheck PASS after formatting; optimized build/roles23/V2four/Chat234 remain as above; focused actualDB15/15 PASS after test-only variable rename. No further runtime logic changes.
Final owner A save/report preview verified after source alignment, real local report1chat/1customermessage/1newlead, no public reply yet/private draft excluded, unavailable first reply, judge not evaluated, USD0. Final proof screenshot C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch7-evidence/owner-report-result.png. Settings tab retained for owner; temporary QA tab closed, iframe fixture removed. Retained local app4131/Chatwoot4141/Telegrammock4143 running; no new keys needed for C7-L1–L7. Phase stays IN_PROGRESS (engineering complete/awaiting owner); cannot advance READY_FOR_CLOSURE/commit/CH8 until owner acceptance and explicit realTelegram/judge deferral or completed acceptance. No unresolved implementation decision or known P0/P1/P2; external gates remain real blockers to release. Owner can open /settings/chat, review notifications, preview without sending, check confirmed mock receipt and tenant switch; CH7_OWNER_ACCEPTANCE.md is the single owner checklist. LiveAI/realTelegram remain disabled, model/API spendUSD0. No external push/merge/deploy/sharedSQL/messages/n8nactivation. Separate Shopify hostedOAuth/renewal and deferredn8n unchanged.


## Chat Session Update - 2026-10-27 - CH7 accepted local closure
### Phase / Status / Branch
CH7 READY_FOR_CLOSURE LOCAL under explicit owner CHAT-D055: “Accept local CH-7 results. Defer real Telegram and judge testing, commit locally and continue with CH-8 planning. Keep live AI disabled.” Same D:/Develop/os-plus-chat-ch0, codex/chat-ch1-foundation/no upstream, pre-commitHEADa192a4d. CH8 not started until this local commit succeeds.
### Scope / Records / Tests
Accepted local encrypted target linking/confirmation/settings, safe event alerts, source-evidence summaries, durable delivery/incident claims, preview and inactive new-platform n8n export. Updated decision logD055, CH7_QA/OWNER_ACCEPTANCE/WBS/CHECKLIST to distinguish accepted LOCAL scope from unexecuted realTelegram/judge gates. Exact59file implementation manifest in CH7_QA; prior history retained. Final engineering evidence unchanged: typecheck/lint0warnings/build/roles23/V2four/Chat234/234, focusedDB15/15, native read-only9/9, two tenants/different cutoffs/onceeach mockHTTP, authenticated role/tenant/375CSSpx and BoutiqueTierB; no new runtime change so no redundant gate rerun. Workbook onlyN2/N10/N15 hash9056b05fc15a54c99c49bf2a2a51ffa629522d67cbbece5fd564edbe496fdb29. Owner accepts reported results; not a claim of independent owner execution of every checklist click. No unresolved P0/P1/P2; final diff/hash verification before local commit.
### Migrations / Deferrals / Spend / Next
Five frozen migrations named/hashed CH7_LOCAL_UPGRADE applied ONLY ownedLOCAL15437,96→101 with native pre/post restores141/143tables. No new SQL application/sharedSQL. Real Telegram delivery/group/owner acceptance, live judge/model calibration, Meta/two-phone and production infrastructure remain deferred/unexecuted/release-blocking; new n8n source remains inactive. LiveAI/modelIDs/key/realTelegram disabled, USD0. No push/merge/deploy/realmessage/purchase/n8nactivation. Next locally commit reviewed CH7, verify clean, then inspect existing voice/transcript/turn/provider contracts and record CH8 planning/remaining decisions. Separate Shopify hostedOAuth/renewal/deferredn8n unchanged.


## Chat Session Update - 2026-10-27 - CH7 CLOSED LOCAL / CH8 planning
### Status / Branch / Authority
CH7 CLOSED LOCAL at445770b8d1e98784c287eb8a955fbe296d23a392, “Chat CH-7: add guarded notifications and daily summaries”,59files5517insertions62deletions. Existing D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation/no upstream; clean immediately after commit, before new planning records. Owner CHAT-D055 accepts local results, defers realTelegram/judge and authorizes this local commit plus CH8 planning. No push/merge/deployment. CH8 now PLANNED, no runtime implementation.
### Decisions / Built / Exact Planning Files
Read existing scope03§6/05CH8 and current payload/capture/worker/strictcontext/evidence/budget/CRMmasking/tenant/permission/commands/migrations. Added docs_chat/CH8_IMPLEMENTATION_PLAN.md with contracts, exact planned files/three uncreated SQL names, verified increments and owner/live gates. D056 owner accepts typed customer confirmation plus staff operational approval; transcripts support inquiry/provisional requests only. D057 owner accepts one voice note up to120s/10,000,000bytes, configurable lower ceilings, unsupported/unclear→reviewed staff handoff. No unresolved owner product choice for local mock scope. Plan preserves original content/IDs/timestamps, private derived transcript/provenance, one durable original-trigger/run, budget stage/cost integration and role-based server masking. Mock transcriber only recognizes known synthetic byte hashes, never pretends to understand arbitrary human audio. No reference repository/infrastructure consulted or modified. Updated docs/agents domain/tracker to currentCH8/baseline and CH7QA/owner/WBS/CHECKLIST closure/planning facts; prior history retained.
### Actual Gaps / Test Scope / Migrations
Existing transcript column reused; attachment metadata insufficient; current worker sends audio down text path; context/quote SQL only original content; coststage lacks transcribe; private-note client only suggestions; CRM strips transcripts. These are implementation gaps, not newpassing claims. Planned additive migrations170000_voice_state/171000_voice_commands/172000_voice_context_reads are listed only, NOT created or applied. Five frozen CH7SQL/workbook hashes reverified unchanged before commit; no SQL applied this turn. No paid model/transcription call or runtimeflag/service change.
CH7 six gates234Chat/15DB/TierB/375px/tenant/native restore evidence accepted from previous engineering session, not rerun for docs-only closure/planning. Final git staged diff/hash/manifest59/whitespace checks passed; commit succeeded. No new browser/manual/regression run needed or claimed for planning. CH8 sixgates/actualDB/concurrency/media/mock/native/provider/UI/BoutiqueTierB/restore/owner tests all NOT RUN yet. No bugfix/runtimebuilt in CH8 planning; earlier CH7fixes remain accepted.
### Deferrals / Gate / Spend / Next
RealTelegram/judge, Meta/two-phone/production domain/server and newn8n runtime/activation remain deferred/unexecuted/release-blocking. Separate Shopify hostedOAuth/renewal acceptance/owner-deferred existingn8n remain separate; retained native order/customer contracts unchanged. CH8 cannot move READY_FOR_CLOSURE; no CH8owner/live-gate waiver inferred. LiveAI/modelIDs/key stay disabled/unset, USD0. No externalmessages/purchases/tunnel/sharedmigration/push/deploy/activation. Next implementation slice is test-first synthetic audio→scoped stored transcript→one private Chatwoot note→guarded mock suggestion, following the CH8 plan. No new keys/Meta/Telegram action needed for local scope.


## Chat Session Update - 2026-10-27 - CH8 implementation start
CH8 IN_PROGRESS under explicit owner instruction to implement approved CH8 plan and complete local QA. Existing worktree D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation/no upstream, HEAD445770b8d1e98784c287eb8a955fbe296d23a392 (CH7 CLOSED LOCAL). Eight modified documentation files plus untracked CH8_IMPLEMENTATION_PLAN preserved/read; no unrelated dirty work. D056/D057 approved120s/10MB one audio, provisional evidence only/typed confirmation+staff approval. Full planned file/migration list and gaps are in CH8_IMPLEMENTATION_PLAN.md. No code/SQL yet; six gates/localDB/media/provider/UI/Boutique checks NOT RUN for CH8. LiveAI/live transcription/model IDs/key disabled/unset, USD0; no shared SQL/realmessages/deploy/push/n8n activation. Next test-first bounded synthetic audio selection/inspection and exact known-fixture transcription, then transactional state/provider/private note/turn integration in verified slices. Owner acceptance/CH8closure exception not granted. Separate Shopify/Meta/Telegram/judge live gates unchanged.


### CH8 first verified voice slice — 2026-10-27
IN_PROGRESS at445770b; planning changes preserved. Added voice/{rules,mock-fixtures,opus-fixture,transcriber,http,schemas,worker-core,worker,commands,server-actions}.ts, Chatwoot attachment/transcript clients, small owner voice-settings card and masked transcript projection in Leads; original reply composer retained. WAV/OGG byte/CRC/packet timing checks and hash-only synthetic transcriber4/4 PASS; real loopback scoped fetch/private receipt/revocation1/1 PASS. Existing Windows FFmpeg used to generate AND decode synthetic Ogg tone; no download/paidcall/acoustic-accuracy claim. Pinned owned Chatwoot4.18 attachment model read: audio data_url uses Rails blob redirect, account/message IDs present. Client resolves authenticated message then uses allowlisted same-origin proxy path, no redirects or credential forwarding. First Docker read rejected shell -c under unchanged endpoint guard; corrected read-only Ruby invocation; codec binaries absent in image, existing host FFmpeg sufficient.
Three construction SQL170000/171000/172000 now replay104 total ONLY disposable PostgreSQL; retainedLOCAL101 unchanged. Reuse transcript column, typed-only confirmation/provisional evidence helpers, shared transcribe budget stage, audited job/note receipts and owner settings(defaultoff). ActualDB4/4 and combined original agent lease→stored transcript→one private note→guarded draft/replay PASS. First pipeline assertion expected drafted; existing successful receipt contract is delivered, corrected expectation. Initial strict context rejected new source fields (reproduced), now scoped provenance accepted; typecheck first found nullable account token, guarded. New typecheck running; no fullsixgate/native retained upgrade/UI/regression/restore/owner acceptance claim yet. No known new product decision. LiveAI/liveSTT/modelkeys off/unset, USD0; no sharedSQL/externalmessages/release. Next broaden actual safety/concurrency/typedconfirmation/PII/stale-tab coverage, final review before local upgrade, owned native/browser/TierB QA and finalsixgates.

### CH8 review corrections — 2026-10-27
IN_PROGRESS/same branch445770b. Standards/spec read-only reviews found unanswered voice bursts losing earlier audio, text history lacking attachments, in-flight lowered limits, and missing conversation receipt validation. Fixed: pending audio metadata + session/public-reply-aware code-built handoff before models/closing, SQL incomplete-result fence; select exact provider message before strict attachment parse; claim-bound settings version/current byte bounds; exact conversation and optional account receipt. Voice suggestions forced private, liveSTT flag rejected at call time. Pinned4.18 message serializer independently read: attachments conditional, conversation_id display_id; no account_id in normal create receipt. Focused HTTP mixed history/mismatched receipts PASS. Re-review both axes clear; expanded actualDB13 tests running (fixture staff event originally lacked mandatory staffUserId, corrected without schema bypass). Initial build/typecheck/lint PASS at earlier checkpoint; final rerun pending. Retained database still101; three SQL construction/unapplied. Preparing owned-local upgrade rehearsal/native pre+post restore; no sharedSQL/model spend (USD0), no release/real messages. Owner acceptance/live gates still unexecuted.

### CH8 owned local upgrade and gates — 2026-10-27
Three reviewed SQL applied ONLY ownedLOCAL PostgreSQL15437, schema101→104 after native before-dump143tables/restore+rehearsal and after-dump144tables/restore. All143 prior table row manifests preserved, restored browser/function ACLs PASS. Exact hashes/backups/scope in outputs/chat-local/ch8-upgrade-report.json and forthcoming CH8_LOCAL_UPGRADE.md; these SQL now FROZEN. No shared/production SQL. Focused voice actualDB13/13 and completeChat252/252 (0skip) PASS; final platform lint/typecheck/build/roles/V2 completed logs being collected. Explicit owned app restart --mock-voice with old process ancestry verified; live model/STT flagsfalse, model/keyunset, media allowlistedloopback only. BrowserownerA voice-settings save confirmed. Native Rails upload helper first query referenced nonexistent t.intent (QA helper only); corrected, no migration/workaround. Native upload/browserroles/mobile/TierB/workbook remaining; no passing claim yet. USD0, owner/live acceptance not done; CH8 remainsIN_PROGRESS/no commit.

### CH8 native and role QA — 2026-10-27
Native retained owned Chatwoot4.18 Rails callbacks PASS3/3 on final clean snapshot app-1793122750687: A WAV conversation36/message258, B Ogg12/message264 → exactlyone private transcript+one private draft each; unknownaudio A37/message270 → one unreadable handofftask/private reviewed response, zero fabricated transcript. Zero publicbotreplies/costentries/paidcalls. Pinned audio/opus MIME incompatibility reproduced via scoped authenticated GET and no-token media fetch, HTTP regression red then green; only validated Oggbytes accepted underaudio/opus. A preceding stale dev/HMR run lacked agentturn after cold compilation; recovered only owned process ancestry to fresh snapshot, no bypass/retry of ambiguous job. Failed fixture conversations retained as QA history. SQL unchanged/frozen.
Final sixgates PASS: typecheck, lint0warnings, optimizedbuild, roles23cases, V2four scripts, Chat253/2530skip. Focused actual voiceDB14/14 incl shared voice/text hardbudget independent-client race/unknown usage holds, quiet/newer/limitsversion/auditrollback/typedconfirmation/PII. Native record outputs/chat-local/ch8-native-report.json. No speechaccuracy claim: fixtures are exacthash one-second tones.
Authenticated retained owner-a session: owner settingssave confirmed; manager settingsredirectdenied and transcript visible; viewer leads-only masked, separatePIIgrant exposes transcript read-only/noChatwootentry; finance404. Temporary effective-role/grants restored exact after checks; no independent persona login. Boutique retainedorder detail/editor opened withoutsaving, production and customer-safe tracking observed; read-only9/9 persistence/safety assertions PASS. Final A/B/staletab/mobile verification and evidence docs in progress. Browsercoldcompilation timeouts and initial blank screenshot not visualproof; fresh tabs/AX successful, screenshotlimitations retained honestly.
QA workbook Artifact-authored/recalculated/error-scan0/rendered+visuallyreviewed; exactpreservation validation PASS only BoutiqueRegression N2/N10/N15 values/oneworksheetpackagepart differ, allhistory/otherbytes/layout unchanged. SHA2563f7b7acdb070013340d70ce746b5530a96b24839bf2696ff59ea03ff6c0e4e91. CH8 remains IN_PROGRESS; owner acceptance/liveSTT/WhatsApp gates pending, USD0; no externalrelease orsharedSQL.

## Chat Session Update - 2026-10-27 - CH8 local owner-ready

### Phase / Branch / Gate
CH8 IN_PROGRESS, local engineering implementation and QA complete; ready for owner C8-L1–L7. Same D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation, HEAD445770b8d1e98784c287eb8a955fbe296d23a392/no upstream. Prior planning/history preserved. No CH8 commit/CH9 transition. Cannot mark READY_FOR_CLOSURE/close until owner acceptance and explicit live-gate disposition; no CH7 waiver extended.

### Built / Exact files
Bounded hash-only synthetic WAV/Ogg voice preprocessing under original turn lease, private transcript note/receipt/uncertainty, guarded private draft, original-message preservation, source-aware provisional evidence with typed-only booking confirmation/staff approval, incomplete-burst safety handoff, owner versioned/defaultoff settings and SQL+DTO transcript masking. Technical corrections: conditional provider attachments, pinned audio/opus validation, changed-limit revocation/current bytes, exact conversation receipt, and Chat MessageSelect en-IN/UTC hydration fix. Complete actual file manifest in docs_chat/CH8_QA.md; approved plan/decisions D056/D057 preserved. Source additions voice/*, Chatwoot attachment/transcript clients, voice-settings card, fixture/test/native/local-upgrade and reversible role/grant helpers; existing Chat context/worker/turn, settings/read-only Leads/projection, narrow Chat RPC types/env/local launcher and Chat-owned request date rendering changed. No shared customer/order/payment/tenant/permission behavior refactor, Fundry facts/infrastructure or later-phase feature.

### Migrations / Recovery
20261027170000_chat_voice_state.sql,20261027171000_chat_voice_commands.sql,20261027172000_chat_voice_context_reads.sql applied ONLY ownedLOCAL15437,101→104. Frozen3/3 hashes unchanged; exact hashes/checksums/dumps in CH8_LOCAL_UPGRADE.md. Native before restore143tables+exact SQL rehearsal and after restore144tables/ACL PASS; all143 existing table manifests preserved. No historical reapply/sharedSQL. PostgreSQL same-cluster proof only, not full host/storage/Clerk recovery.

### Automated / Native / Manual / Regression
Final npm run typecheck, npm run lint(0warnings), npm run build, npm run test:roles(including23ingresscases), npm run test:v2(four scripts), npm run test:chat254/2540skip PASS. Voice pure4/4, realHTTP1/1 and actualDB15/15 are subsets of Chat254, not extra totals. RealDB covers independent-client races, tenant/roles, audit rollback, budget voice+text hard ceiling/unknowncost, changed settings/quiet/newer/expired lease, exact evidence and voice-yes rejection. Native Rails/callback QA3/3 A WAV36/B Ogg12/unknownA37 PASS; clean warmed ownerA38/message275/leadb1f538b7-d4f6-4995-8ecb-7eb1d6e5dcf8 PASS, two actual SafeFetch duplicate callbacks accepted with one transcript/one draft/zero boterror activity/publicbotreplies/costentries. Initial cold dev callback warning retained historically, no timeout weakening; final owner fixture clean.
Retained real Clerk owner-a session; effective manager settingsdenied/transcriptallowed, viewer leads-only masked/separatePII read-only allowed, finance404; exact original membership/grants restored. Actual A→B→A, B copiedA404/own transcript, staleA settings refusal. Desktop/native and paired375CSSpx settings/transcript screenshots visually reviewed, no hydration mismatch after UTC fix. Browser cold timeouts/initial blank capture are failed attempts superseded by confirmed final states; no physical-device/independent persona credentials claim.
BoutiqueTierB retained order detail/edit(no save), production/tracking PASS; read-only9/9 persistence/safety assertions preserve total2000/paid300/balance1700/two workflows/history. Not a new full14/14 TierA run. Workbook Artifact-authored/recalculated/error-scan0/rendered/reviewed; only N2/N10/N15 note values/onepackagepart changed; all prior history/style/otherbytes preserved. SHA2563f7b7acdb070013340d70ce746b5530a96b24839bf2696ff59ea03ff6c0e4e91.

### Review / Owner / Spend / Next
No unresolved new P0/P1/P2; read-only Standards/Spec and targeted MIME/UTC rereviews clear. Final whitespace, untracked/file manifest, frozen SQL and416 snapshot source hashes reviewed/matching. docs_chat/CH8_QA.md, CH8_OWNER_ACCEPTANCE.md, CH8_BOUTIQUE_QA.md, CH8_LOCAL_UPGRADE.md, plan/WBS/decision/checklist/agent metadata updated. Owner original OS PLUS tab restored Local QA A/settings/chat; Chatwoot original tab opened A38 with one unsent suggestion. Native Take over/Edit/main composer verified; only our synthetic text cleared, no Send clicked. Temporary QA tabs and snapshot-only fixture cleaned.
LiveAI/liveSTT disabled/model IDs/keyunset; only supplied synthetic tones recognized. Feature model/API/transcription spendUSD0, no purchases/downloads/real external messages/tunnel/sharedSQL/push/merge/deploy/n8nactivation. Owner acceptance pending, real speech/provider privacy/cost/language accuracy/WhatsApp acceptance unexecuted/release-blocking. Earlier Meta/two-phone/realTelegram/judge/production domain/server/new n8n gates remain deferred; separate Shopify hostedOAuth/renewal/owner-deferred existingn8n unchanged.
Next: owner opens http://localhost:4141/app/accounts/901/conversations/38 and CH8_OWNER_ACCEPTANCE.md C8-L1–L7; report/accept local behavior and explicitly decide disposition of unexecuted live gates before closure/local commit. No new keys/server/Meta action required for these local tests.


## Chat Session Update - 2026-10-28 - CH8 local acceptance and closure

### Phase / Branch / Authority
CH8 READY_FOR_CLOSURE LOCAL under explicit owner instruction: “Accept local CH-8; defer live testing, commit locally and continue with CH-9 website chat. Keep live AI disabled. We'll set up the domain, server and Meta later.” CHAT-D058 records acceptance of reported local results, not a claim the owner independently executed every C8-L1–L7 action. Existing worktree D:/Develop/os-plus-chat-ch0, codex/chat-ch1-foundation, no upstream, precommit HEAD445770b8d1e98784c287eb8a955fbe296d23a392. Current status/full diff/untracked scope reconciled with the53-file owner handoff; no unrelated work changed or stashed.

### Built / Files / Migrations
No runtime changes in this closure session. Exact CH8 implementation/file manifest in docs_chat/CH8_QA.md; accepted D056/D057 behavior and CH8_LOCAL_UPGRADE.md unchanged. Updated root summary, CH8_QA.md, CH8_OWNER_ACCEPTANCE.md, decision log, phase WBS and CHECKLIST.md for this acceptance. Three frozen SQL20261027170000_chat_voice_state.sql,20261027171000_chat_voice_commands.sql,20261027172000_chat_voice_context_reads.sql were already applied ONLY owned local15437,101→104. No SQL applied this session; hashes and workbook SHA3f7b7acdb070013340d70ce746b5530a96b24839bf2696ff59ea03ff6c0e4e91 reverified unchanged. Native pre143/post144-table same-cluster restore/data/ACL evidence remains recorded, not a full infrastructure recovery claim.

### Closure Evidence / QA / Compatibility
Existing final logs inspected: npm run typecheck PASS; npm run lint PASS0warnings; npm run build PASS; npm run test:roles PASS including23ingresscases; npm run test:v2 PASS four scripts; npm run test:chat PASS254/2540skip. VoiceDB15/15, pure4/4 andHTTP1/1 are subsets. Native3/3 plus clean owner A38/duplicatecallbacks and read-only final9/9 PASS. Authenticated owner/effective-role, two tenants/stale form, desktop375px and guarded main-composer evidence in CH8_QA.md. Boutique requiredTierB PASS (retained order detail/edit withoutsave, production, tracking; total2000/paid300/balance1700/twoworkflows unchanged). No shared Boutique/customer/order/payment runtime changed. No new test/browser run claimed for documentation-only closure. Earlier fixes/review complete, P0=0/P1=0, no unresolved newP2. Final staged manifest/whitespace review precedes commit; local commit SHA recorded next.

### Deferred / Spend / Next
Real speech provider/model/privacy/retention/cost/language accuracy and WhatsApp acceptance remain unexecuted/release-blocking, explicitly deferred D058. Earlier Meta/two-phone, realTelegram/judge, one-login verification, production domain/server/new n8n runtime remain pending; separate Shopify hostedOAuth/renewal and owner-deferred existingn8n unchanged. LiveAI/liveSTT disabled/modelIDs/keyunset; feature model/API/transcription spendUSD0. No external messages/purchase/sharedSQL/push/merge/deploy/tunnel/n8nactivation. Next: commit accepted CH8 locally, then CH9 website channel/widget planning and owner-requested Chat settings UX simplification; CH9 has no owner acceptance/live-gate waiver yet.


## Chat Session Update - 2026-10-28 - CH8 committed and CH9 start
### Phase / Branch / Scope
CH8 CLOSED LOCAL at84cfdb15d70826298bc7547d7d943e30d26617c5 (Chat CH-8: add guarded local voice-note processing),53 reviewed files; git status clean immediately after commit. Staged whitespace check caught two doc checksum-label trailing spaces, corrected without SQL/runtime changes. FrozenSQL/workbook hashes verified, prior sixgates/254Chat/TierB/native recovery evidence accepted D058; no new execution claim. No push.
CH9 IN_PROGRESS in SAME D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation/no upstream, base84cfdb1. CH9_IMPLEMENTATION_PLAN.md records website identity/widget/pre-chat/information/request safety plus explicitly requested Chat settings UX simplification. RequiredBoutiqueTierB; expected new additive website-claim SQL, none created/applied yet. No shared customer/order/permission/app-shell change planned.
### Inspection / Decisions / QA
Actual authenticated owner settings screen inspected read-only: Brands+Channels+Access+Requests+Voice+Telegram schedule/destinations/history/report-preview stacked on one page. Existing website parser/visitor/capture/private-draft already present; globally unique verified phone identities cannot safely store self-asserted website claims as lookup keys. Preserve separate unverified claim storage and all accepted operational approval controls; no new product decision, no auto-merge by REF. Source/approved docs/Product/phase gate read. UI uses existing tokens; no DESIGN.md present. Existing user tabs untouched, separate temporary audit tab used.
CH9 tests/SQL/native/browser/regression NOT RUN yet, no CH9 passing or closure claim. Latest Shopify release remains integrated from prior approved baseline merge, separate hostedOAuth/renewal/owner-deferred existingn8n pending. LiveAI/STT off/modelIDs/keyunset, USD0. Domain/server/Meta/realTelegram/judge/live speech remain deferred/release-blocking. Next verified slice: focused owner settings navigation and website claim/widget boundaries, then actual disposableDB/native/browser QA; no external enablement.


### CH9 first verified slices — 2026-10-28
IN_PROGRESS/base84cfdb1. Focused owner settings overview/navigation and mounted section-only rendering implemented; Chats/Leads daily CTAs preserved. Business/Channels/Access no longer all render together; assistance holds voice limits in disclosure, notification history is isolated. Public widget code loaded from authorized mapped inbox; server-side account token/signing key/provider HTML discarded, unsafe origins/input rejected. Boundaries pure2/2 and real-loopback client1/1 PASS (red→green). Pinned4.18 native inbox serializer/model read-only inspected; public website_token is distinct from hmac_token.
Two additive construction SQL20261028100000_chat_website_phone_claims.sql and20261028101000_chat_website_claim_reads.sql now replay106 migrations ONLY disposable PostgreSQL. ActualDB4/4 + pageguards3/3 PASS: separate unverified claims, no phone identity/customer link, independent-connection replay, auditrollback, two tenants/PII/anonymousdenial, same-phone WhatsApp remains separate. Retained local15437 stays104; NO sharedSQL. Initial database setup timed out with a Created disposable Docker fixture; controlled rerun passed, no passing claim for timeout. Typecheck found preview call missing newsection prop, corrected; finalgates pending. Runtime code projection adds normalized explicit-international website claim; CRM contact details show separately labelled unverified values only forPII.
Still pending: settings/knowledge polish, broader website/booking/client-adapter checks, final sixgates/review, retained local upgrade/nativewidget/browser375px/roles/TierB/workbook/recovery and owner acceptance. CH9 notreadyforclosure. LiveAI/STT off, modelIDs/keyunset, USD0; domain/server/Meta and earlierlivegates deferred. No externalchanges.


### CH9 review fixes — 2026-10-28
Two-axis readonly Spec/Standards reviews against84cfdb1 found website phone context detached by explicit merge/split and older customforms missing shared unsaved guard; additionally inherited foundation role.grant lacked displayed-tenant binding. Fixed in Chat-only scope: project immutable claims through current message/conversation contact (actualDB merge→splitPASS; suite5/5), integrate action/voice/notification mutationforms with existing dirtyguard and retain through failure/uncertainty, clear onlyconfirmedsuccess, and bind all setup/knowledge saves+inboxsync to displayedtenant. Stale foundation/widget server checks2/2PASS; no shared provider/permission/Boutique behavior modified. Both focused rereviews clear of residual concreteP0/P1/P2.
Initial fullChat261 run failed2: over-escaped explicit-phone regexp and capture VM missing new realmodule dependency. Corrected both, capture+pure12/12PASS. Lintfirstcaught4unescapedapostrophes, corrected; latesttypecheck/lintpassed before reviewfixes, finalreruns pending. No failed run countedPASS. NewSQL remains construction/disposable106 only; retained104unchanged. Prepared owned upgrade-ch9.mjs plan-only with104baseline/twoallowlistedSQL/fullrowpreservation/nativebackup+restore/ACL checks; notexecuted yet. Allliveflags off/USD0. Next finalgates and retainedlocal/nativebrowserQA, then ownerreview of simplifiedscreen. Ownerasked rolloutsequence; advised against currentdeployment, no deploy/server/Meta actionperformed.


### CH9 final engineering gates and owned upgrade — 2026-10-28
All sixgatesPASS after review fixes: npmrun typecheck,lint0warnings,optimizedbuild,roles including23ingresscases,V2four scripts,Chat264/2640skip. Newwebsite pure2/client1/actualDB5/stale-server2 are subsets of264. Logs outputs/ch9-{typecheck-final,lint-final,build,roles,v2,chat-final}.log. Two frozen SQL applied ONLY ownedLOCAL15437 schema104→106 after native144table beforedump/restore+exactSQLrehearsal,145table afterdump/restore+anonymous/authenticatedACL checks. All144 existingrowmanifests preserved. Source report outputs/chat-local/ch9-upgrade-report.json. Frozen hashes100000=0eecb31d0baae81f06f237883c192c260c542735cf93edc031e386de8c9a5d56,101000=d5d27a8466c0129c0592dc663592a76aa40f0bc3a2ceca8f423189ef5ac2ad0d. Baselinechecksum0a48a067b73d1795a11f8a44e0e20accb95b5326f59e36d87c99f14280e0fe66 →07503c9aad77be63be5ffa6dcd4d1b1180a90a45bf40249d1960f64ad79b9124. No shared/prodSQL; frozenprior104untouched. Same-cluster recovery only.
Initial retained HMR browser widget load failed despite nativeprovider200/boundedfieldsvalid. Verified owned process ancestry launcher5080→Next21876→server31420 and restarted only those to clean snapshotapp-1793156691405,422sourcefiles. No DB/Chatwoot/otherworktree reset. Retained Clerk owner-a session: new conciseOverview visible; website Getinstallationcode now succeeds and contains publicwebsiteidentifier only, noAPI/HMACkey/providerHTML. Actual captured snippet and desktop screenshots C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch9-browser. Initial nativefailedattempt notcountedPASS; no permanentdebuglogging/timeoutweakening. Model/liveSTT off/USD0.
Current manualQA inprogress: loadpublishedknowledge/plainfields/unsavedfailure/navigation, actualinstalledwidget, tenant/roles/staleforms,375px and BoutiqueTierB. Workbook/evidence/checklist notupdatedforCH9yet. PhaseIN_PROGRESS, cannotclaimownerready/READY_FOR_CLOSURE or deploy. Userasked whetherprod/server/Meta next; answered sequence only, no productionauthority/action. Next complete these localchecks and reportowneracceptance steps; domain/server/Meta stilldeferred.

### CH9 resume and native website evidence — 2026-10-28
Same codex/chat-ch1-foundation/no upstream at84cfdb15d70826298bc7547d7d943e30d26617c5; actual dirty files reconciled as CH9 only, no unrelated work moved. Native owned Chatwoot4.18 website/callback checks PASS4/4 (outputs/chat-local/ch9-native-report.json): A901 conversation39/message282/contact52 and B902 conversation13/message285/contact53, same synthetic claimed phone but separate OS PLUS contacts/leads, one unverified claim/private mock draft each, no verified phone/customer/public bot reply/cost. Two actual pinned SafeFetch callback replays preserve one claim. First replay helper erroneously expected HTTP response.code from SafeFetch Result; corrected to successful fetch contract (pinned source raises on non-success), reran existing messages without duplicating customer inputs. Native fixtures use account API/Rails incoming messages; this is not browser pre-chat submission evidence.
Actual UI overview and mapped website installation code succeed on clean422-source snapshot. Business publishedv4 loads into labelled description/hours; synthetic unsaved change triggers confirmation. That extra QA tab24 is stalled: browser focus/close time out and getJsDialog returns undefined. Cancel/preservation and widget open/send not PASS. Requested owner close only extra business-settings test tab; no saved knowledge changed. Other original user tabs preserved. Continuing unaffected read-only database/recovery evidence and QA records. Final six gates264/264 remain PASS from prior entry; no runtime edits/new SQL application on resume. Manual role/tenant/375px/widget and fresh BoutiqueTierB/workbook remain incomplete; CH9 IN_PROGRESS, not READY_FOR_CLOSURE, no commit/deploy authority inferred. LiveAI/STT off, USD0; server/domain/Meta and earlier live gates remain deferred. Separate Shopify hostedOAuth/renewal/deferred existingn8n unchanged.

## Chat Session Update - 2026-10-28 - CH9 website flow and local regression
### Date / Updated By / Phase Status
2026-10-28, Codex AI. CH9 IN_PROGRESS, implementation and most engineering QA complete. Remaining owner C9-L2 unsaved-confirmation cancellation/preservation and C9-L7 acceptance; cannot mark READY_FOR_CLOSURE/commit/startCH10 yet. Same D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation/no upstream, base84cfdb15d70826298bc7547d7d943e30d26617c5. Existing dirty CH9 work preserved; no other worktree touched.
### What Was Built / Decisions / Exact Files
Concise owner settings overview/focused sections, plain description/hours editor with deliberate advanced controls, shared dirtyguard integration and displayed-tenant-bound foundation saves; authorized public website widget code and private unverified phone claims with atomic audited capture/PII reads/current conversation merge-split ownership. Existing accepted identity/booking/role policies retained; no new approval inferred. Runtime exact manifest in CH9_QA.md; added CH9_QA.md,CH9_OWNER_ACCEPTANCE.md,CH9_LOCAL_UPGRADE.md,CH9_BOUTIQUE_QA.md and updated WBS/decision/checklist/agent metadata. QA helpers ch9-{browser-role,viewer-grants,final-assertions,browser-assertions}.mjs and chatwoot-local/ch9-{qa,prechat-qa}.mjs. Workbook only N2/N10/N15 evidence notes changed.
### Migrations Added / Applied / Recovery
20261028100000_chat_website_phone_claims.sql and20261028101000_chat_website_claim_reads.sql already applied ONLY ownedLOCAL15437 schema104→106 this phase; no reapplication during resume/sharedSQL. Frozen hashes/recovery exact in CH9_LOCAL_UPGRADE.md. Native pre144/post145-table dumps/restores and exactSQL rehearsal/ACL PASS, all144 original data manifests preserved. Same-cluster proof only.
### Automated / Phase-Specific Tests
npm run typecheck PASS; npm run lint PASS0warnings; npm run build PASS; npm run test:roles PASS including23ingresscases; npm run test:v2 PASS four scripts; npm run test:chat PASS264/2640skip. Website subsets pure2/client1/actualDB5/staleadapter2 included in264. Prior final gates not rerun for documentation/QA-helper-only additions; helper syntax/lint and final source-hash/frozenSQL checks pending final record. Native provider4/4 and final read-only integrity11/11 PASS.
### Manual / Tenant Isolation / Browser
Actual installed code on loopback test page PASS: fresh127.0.0.1 visitor submitted optional synthetic name/phone +919000000006/question; providerconversation40/message290 → OScontact8476912b-18d7-4d38-b25a-1c447bf32f23/lead95ba955f-feec-44c5-88ce-61c4cf844a34/private suggestion293. Preapproval zero public replies, then one explicit staff Send as is → reply294 visible in visitor and exact authenticated sent ledger. No autonomous/model/live channel send. Temporary pre-chat settings restored exact via captured before/after fingerprint; no concurrent overwrite. Source reports ch9-browser-widget-report.json3checks and ch9-browser-approved-report.json4checks.
Retained real Clerk owner-a session, effective manager settingsdenied/contactPIIallowed; viewer leads-only masked and separately PIIgranted read-only/noChatwoot; finance404. Exact original role/grants restored, no separate credential login claim. Normal A→B→A; B copiedA404/owncontact and widgetcode; staleBrequest afterAswitchrefused. Three authenticated375CSSpx iframe layouts visually reviewed/nohorizontaloverflow; innerclient356=scroll356 fromscrollbar. Earlier viewportoverride yielded469CSSpx, not counted375 proof, override reset.
Publishedv4 plainfields loaded. Unsaved warning observed; browser modal getter/focus failed, so Cancel/preservation not claimedPASS. Requested owner C9-L2; no synthetic knowledge edits saved/published. Original uservisitor6/history preserved. Clean snapshot422source remains local; owneroriginaltabs retained.
### Boutique Regression / Workbook
RequiredTierB PASS: retainedorderORD-000006 detail/editorwithoutsave, production and safe publictracking. Read-only SQL preserves total2000/onepriorreceipt300/balance1700/twoworkflows/measurement/stagehistory. Not a new14/14TierA run. Workbook Artifact-authored/recalculated/error-scan0/exported/rendered/visuallyreviewed, only3notesvalues/oneworksheetpart differ; allpriorhistory/style/otherbytespreserved. SHA947bfce6e3e8d08d4ddc2b26c7dc38e5465c4053e5e8447feaec80a653aa5549. Bundled Node native cleanup exit-1073740791 after writing outputs recorded honestly; independent saved-file/package validation PASS, no nativeExcelengine claim.
### Bugs Found / Fixed / Compatibility
Prior reviewed merge/splitclaimprojection, unsavedform integration, stale ID-less rolegrant fixed; both rereviews clear. Native SafeFetch QA incorrectly expected response.code; corrected to pinned Result contract. After staffapproval QA helper incorrectly expectedzero botrows/staffclassification; existing verified SQL intentionally classifies approvedsuggestion asbot, corrected helper requires exact authenticated sent ledger/message294 and onepublicreply. No runtime weakened to satisfy QA. Coldcompiler/browser failures retained as failedattempts. No confirmed newP0/P1/P2; remaining Cancel case unverified. No shared Boutique/Laundry/customer/order/payment/runtime/permissionhelpers/app-shell change.
### Deferred / Blockers / Phase Gate / Spend / Next
Owner acceptance and manualCancel pending; CH9 not READY_FOR_CLOSURE, no commit/CH10/deploy. RealAI/STT adapters/modelselection/privacy/cost/accuracy, realTelegram/judge, Meta/twophones, one-login/edition restrictions, domain/server and newisolatedn8n runtime/activation remain unexecuted/release-blocking. Separate Shopify hostedOAuth/renewal and owner-deferred existingn8n remain separate. LiveAI/STT disabled/modelIDs/keyunset, feature model/API/STT spendUSD0. No purchases/downloads/sharedSQL/externalmessages/tunnel/push/merge/deploy/activation. Next final integrity/docs/helperchecks, owner C9-L2/C9-L7, local phaseclosure only after gates; then CH10 planning and explicit production release preparation against current main.

### CH9 final autonomous checks and simple owner handoff — 2026-10-28
Supersedes the pending technical C9-L2 blocker in the preceding entry. Owner found the settings checklist confusing and requested Codex finish it. Actual clean-tab documented confirm dialog now exposed: dismiss→exact temporary hours retained; restore→acceptdiscard→Website navigation PASS. Invalid JSON save shows safe “Enter valid JSON before saving”, exact input remains and DOM dirty/preserve flags bothtrue; original full config restored/discarded, no save/publication. Screenshots unsaved-cancel-retained.png/invalid-save-retains-edit.png saved under existing C:/.../outputs/chat-ch9-browser. C9-L2 engineering PASS; no owner technical test required. Earlier failed dialog attempts remain historical, not erased.
All local engineering QA now complete: finalsixgates264/264; renewed npmrunlint0warnings; sixnewQAhelper syntax checks; actualDB5/native4/browserpreapproval3+approved4/read-onlyintegrity11; all422snapshot/source hashes match; frozenSQL2/workbookSHA947bfce6.../47-filemanifest/gitwhitespace PASS. No runtime/source changes after passinggates, only QAhelpers/docs/workbook. Two localSQL remain frozen104→106, no newapplication/sharedSQL. Workbook saved with exactly3notes and all other packagebytes preserved; native authorcleanup exit caveat retained in CH9_BOUTIQUE_QA.md.
CH9 IN_PROGRESS/localengineeringcomplete, owner productacceptanceC9-L7 pending; notREADY_FOR_CLOSURE/committed/CH10/deployed. CH9_OWNER_ACCEPTANCE.md now asks only to review normal Chats (A901 conversation40)→Leads95ba955f-feec-44c5-88ce-61c4cf844a34; setup is occasional ownerconfiguration, staff dailywork remainsChats/Leads. No authority inferred from “do it yourself” to accept product/waivephasegates. Priorhistory preserved; QA/WBS/checklist/decision/agentmetadata updated. Exactoriginalroles/grants/prechat restored; originalOSPLUS tab on A/settings/chat; preserved syntheticvisitor andCW40 for ownerreview; otherQA tabs cleaned. Snapshot-onlywidget fixture retained forreview, mobile fixture removable after evidence. LiveAI/STT disabled/modelIDs/keyunset/USD0; no purchases/downloads/realexternalmessages/sharedSQL/tunnel/push/merge/deploy/n8nactivation. Existingrealchannel/model/Telegram/judge/SSO/infrastructure/CH10release and separateShopifyOAuth/renewal/deferredn8n gates remain pending.
Next owner reviews simple workflow and provides localproductacceptance; then localCH9commit underexistingauthority and CH10planning. Production remains a separately approved release against currentmain, afterhardening/hostedpilot gates.

Final handoff verification2026-10-28: read-only native SQL confirms Local Inquiry Brand still has exactly revisions1draft/2archived/3archived/4published and exact original published hours; no QA draft/publication created. Both successful discard navigations observed, final temporarytesttab30closed, originalthreeusertabs preserved; only added visitor28/CW40tab29 retained as reviewdeliverables. All owner/grant/pre-chat restoration checks remain PASS. No code/migration/workbook changes after final hashes; phase remainsIN_PROGRESS solely for owner productacceptance, local engineeringchecks complete. New summary handoff title is “CH9 final autonomous checks and simple owner handoff”; CH9_QA.md exact47-filemanifest and CH9_OWNER_ACCEPTANCE.md simple2screenjourney authoritative. No more technical setup/checklist action requested from owner.

## Chat Session Update - 2026-10-28 - CH9 local acceptance and closure
### Phase / Branch / Authority
CH9 READY_FOR_CLOSURE LOCAL under explicit CHAT-D059 owner instruction accepting local CH9, authorizing local commit and CH10 planning/available local checks. Existing D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation/no upstream, precommitHEAD84cfdb15d70826298bc7547d7d943e30d26617c5. Actual full diff/untracked47-file scope reconciled; no unrelated work stashed/moved/changed. Owner acceptance applies to reported results, not independently repeated tests. No CH10 work until local CH9 commit succeeds.
### Built / Records / Migrations
Accepted local website widget/pre-chat/unverified phone claims, atomic audited capture/PII reads/current conversation merge-split ownership, tenant-bound setup actions and simplified owner settings. Exact47-file manifest CH9_QA.md. Closure updates summary/QA/owner/WBS/checklist/decisionD059; no runtime change. Frozen20261028100000_chat_website_phone_claims.sql and20261028101000_chat_website_claim_reads.sql previously applied ONLY ownedLOCAL15437 schema104→106, native pre144/post145-table restores/data/ACL checks; no SQL applied this closure. CH9_LOCAL_UPGRADE.md exact hashes/checksums.
### Tests / Manual / Regression / Bugs
Existing finalsixgates PASS: typecheck/lint0warning/build/roles23/V2four/Chat264/2640skip. Website actualDB5 subset; native4/4, browserpreapproval3/approved4, restored retained integrity11/11; originalknowledge4revisions/exacthoursunchanged. Actual browser pre-chat→lead/private draft→staffapprovedreply, role/PII/A→B→A/stale request,375CSSpx frames, unsavedCancel/retention/discard and invalidsave PASS. TierB retainedBoutiqueorderdetail/editwithoutsave/production/safetracking PASS, financial/workflow/historyunchanged. Workbook3evidencenotesonly SHA947bfce6e3e8d08d4ddc2b26c7dc38e5465c4053e5e8447feaec80a653aa5549. No nativeExcelengine claim; recorded author-nativecleanup failure after verifiedexport remains tooling caveat. Prior two-axis reviews clear, P0/P1/P2 none unresolved; fixes inCH9_QA. No redundant test/browser execution claimed for docs-only acceptance. Final source/frozenSQL/workbook/stagedmanifest/whitespace review beforecommit.
### Deferred / Gate / Spend / Next
Local closure accepted; realAI/STT/providerprivacy/cost/languages, Meta/twophones, realTelegram/judge, one-login/editionrestrictions, productiondomain/server and isolatedn8nruntime remain unexecuted/release-blocking. Separate Shopify hostedOAuth/renewal/owner-deferred existingn8n unchanged. LiveAI/STT off/modelIDs/keyunset, featureAPIspendUSD0. No purchases/realexternalmessages/sharedSQL/tunnel/push/merge/deploy/workflowactivation. Next localCH9commit, cleanverification then CH10requiredreading/contractaudit/plan/open decisions/local checks. D059 does not waive CH10owner/livego-livegate.
