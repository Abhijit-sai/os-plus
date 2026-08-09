# OS PLUS Tech Development Plan

## 1. Purpose

This document defines the technical build plan for OS PLUS, a multi-tenant white-label WorkOS for boutiques and small manufacturing businesses.

The first implementation is for fashion boutiques, but all technical decisions should keep future manufacturing verticals in mind.

## 2. Confirmed Stack

- Frontend: Next.js with TypeScript
- Authentication: Clerk
- Database: Supabase Postgres
- File Storage: Supabase Storage
- Deployment: Vercel
- UI: Tailwind CSS + shadcn/ui
- Charts: Recharts or Tremor, to be finalized
- Background jobs: Inngest / Trigger.dev / Supabase Edge Functions, to be finalized
- WhatsApp later: Meta WhatsApp Cloud API
- OCR later: Google Vision / AWS Textract / Tesseract

## 3. Technical Principles

1. Multi-tenant from day one.
2. Every tenant-owned table must include `tenant_id`.
3. Tenant isolation must be enforced in every query.
4. Never trust client-side tenant filters alone.
5. Use server actions/API routes with tenant context validation.
6. Use soft delete for operational records.
7. Keep workflow execution custom-built for MVP.
8. Keep data model extensible for future parallel workflows.
9. Keep customer tracking page public but token-secure.
10. Avoid building non-MVP integrations early.

## 4. App Architecture

Suggested route structure:

```text
/app
  /(auth)
    /sign-in
    /sign-up
  /(super-admin)
    /super-admin
      /tenants
      /tenants/new
      /tenants/[tenantId]
  /(tenant)
    /dashboard
    /orders
    /customers
    /production
    /workers
    /attendance
    /salary
    /finance
    /reports
    /settings
  /(public)
    /track/[trackingToken]
```

Suggested source structure:

```text
/src
  /app
  /components
    /layout
    /ui
    /forms
    /tables
    /dashboard
  /features
    /tenants
    /customers
    /orders
    /workflows
    /production
    /workers
    /attendance
    /salary
    /finance
    /tracking
    /settings
  /lib
    /auth
    /supabase
    /tenant
    /permissions
    /validators
    /utils
  /server
    /actions
    /queries
    /mutations
  /types
  /db
    /migrations
```

## 5. Phase-wise Development Plan

## Phase 0: Project Foundation

### Goals

Set up the project and technical base.

### Tasks

- Create Next.js TypeScript project
- Configure Tailwind CSS
- Install shadcn/ui
- Configure ESLint and Prettier
- Create GitHub repository
- Create README
- Create `.env.example`
- Create `project_summary.md`
- Set up Vercel deployment
- Set up Supabase project
- Set up Clerk application

### Deliverable

A running authenticated app shell with basic layout.

## Phase 1: Auth, Tenant and RBAC Foundation

### Goals

Build secure multi-tenant access.

### Tasks

- Integrate Clerk
- Create Supabase client
- Create `tenants` table
- Create `tenant_users` table
- Create role enum
- Create tenant context loader
- Create permission helpers
- Protect tenant routes
- Create super admin tenant creation
- Create tenant user email-based assignment basics
- Support one Clerk-authenticated user belonging to multiple OS PLUS tenants
- Support different roles for the same user across different tenants
- Use OS PLUS tenant memberships and roles rather than Clerk Organizations for MVP tenant authorization
- Keep tenant user status UI to active/disabled for MVP
- Hide Clerk user IDs from tenant owner/admin workflows

### Deliverable

Super admin can create a tenant and pre-authorize an owner/admin by email. Tenant users can log in with Clerk, access only active OS PLUS tenant memberships, and choose the correct business when linked to multiple tenants.

## Phase 2: Configuration Engine

### Goals

Allow each boutique to configure their own business operating model.

### Tasks

- Business profile settings
- Branding settings
- Item Type Master
- Stage Master
- Customer Status Master
- Workgroups
- Stage-to-workgroup mapping
- Workflow builder, sequential MVP
- Workflow/stage configuration commands serialize workflow activation against last-active-stage deactivation using a consistent workflow-then-stage lock order
- Payment modes
- Expense categories
- Default seed data for each tenant

### Deliverable

Tenant can configure item types, workflows, stages, workgroups, statuses, and basic business branding.

## Phase 3: Customers and Measurements

### Goals

Create reusable customer profiles.

### Tasks

- Customer list
- Customer creation
- Customer edit
- Customer detail
- Customer phone suggestion search
- Normalize valid Indian and explicitly identified international numbers to E.164 when a phone is present
- Resolve and select the existing active tenant customer when the normalized mobile already exists
- Enforce the duplicate-mobile rule again on the server when saving
- Measurement notes
- Measurement key-value fields
- Measurement photo upload
- Customer attachments
- Owner/admin CSV/XLSX customer-import preview with Shopify-column auto-mapping
- Source-identity and normalized-phone matching with explicit email-only review
- Atomic customer/address/source-metadata confirmation with immutable import receipts

### Deliverable

Managers can create/select customers and store measurements for future orders.

Customer file import is deliberately a separate owner/admin capability. File parsing and matching run during a write-free preview. Confirmation sends the approved normalized payload and preview fingerprint to one service-role-only Postgres function so customers, blank-field enrichment, addresses, source identities, metadata, and the receipt either all commit or all roll back. Direct Shopify webhooks remain a later phase, but reuse the same external-identity and canonical-phone foundations.

## Phase 4: Orders and Payments

### Goals

Enable manual order entry with multiple production items.

### Tasks

- Order list
- Manual order creation
- Customer selection/creation inside order flow
- Add multiple items
- Select item type
- Select workflow per item
- Add expected completion date per item
- Add prices and discounts
- Add order-level delivery type
- Add item-level delivery override
- Add payment entries
- Support partial payments
- Generate tracking token
- Order detail page

### Deliverable

Boutique can create real orders and break them into item-level production tasks.

## Phase 5: Workflow Execution

### Goals

Track item production through configured stages.

### Tasks

- Create workflow instance when workflow is assigned to item
- Create item stage instances
- Mark first stage ready to start
- Start stage with worker selection
- Validate worker belongs to allowed workgroup
- Support multiple workers per stage
- Pause/resume work log
- Complete stage
- Suggest next stage
- Manager confirms next stage
- Update item current status
- Update customer-facing status
- Add stage notes
- Add stage attachments
- Create item history records

### Deliverable

Managers can move each item through its production workflow with worker logs.

## Phase 5A: Multi-worker Effort and Contribution Tracking

### Goals

Capture who contributed to each item stage, in which eligible role, how many units or man-hours they contributed, and the analytics-only monetary value of that work.

### Architecture Tasks

- Store stage-level effort mode separately from item-type/stage monetary rules.
- Snapshot the active rule and order-item post-discount/pre-GST value on stage start so active/completed history does not change when configuration changes.
- Extend worker stage logs with credited units, credited minutes, and calculated contribution amount while preserving automatic elapsed duration separately.
- Add immutable contribution-correction audit records.
- Use service-role-only, tenant-scoped RPCs for stage start with assignments, contribution replacement, and stage completion.
- Lock stage/workflow/item rows, validate worker and workgroup ownership, and reject stale or duplicate transitions.
- Keep productivity contribution data outside salary and finance calculations.

### UI Tasks

- Add effort mode to Stage settings.
- Add a focused contribution-rule page for each item type instead of placing a dense rate matrix inside the basic edit dialog.
- Add a mobile-first worker contribution editor to ready and in-progress stage cards.
- Show workgroup role, units, credited time, man-hour total, rule snapshot, calculated total, and Rate not configured state.
- Use 0.10-unit controls, first-assignment item-quantity defaults, and explicit pending, success, error, disabled, and close-protection states.
- Close successful configuration actions and completed-stage editors while retaining editable input on server errors.
- Aggregate only completed tenant-owned work logs by completion week for the worker leaderboard and trend report; keep contribution value, units, hours, and completed stages as separate metrics. Use worker IDs as chart keys so duplicate names remain independent.
- Expose the report to owner/admin through the dashboard and to managers through a dedicated permission-gated Production link without granting managers unrelated dashboard access.

### Deliverable

Managers can record multi-worker stage effort before completion, while owner/admin can auditably correct completed contributions without rewriting production, salary, or finance history.

## Phase 6: Production Dashboard

### Goals

Give managers operational visibility.

### Tasks

- Production dashboard cards
- At-risk items
- Delayed orders
- Items by stage
- Items by workflow
- Due today
- Due soon
- Blocked items
- Worker assignment pending
- Mobile-first production update screens

### Deliverable

Production manager can see what is pending, delayed, blocked, and at risk.

## Phase 6A: Owner Dashboard and Analytics Command Center

### Goals

Turn `/dashboard` into the single source-of-truth view for the business across sales, production, worker productivity, finance, attendance, and alerts.

The dashboard should be compact, operational, and analytics-led. It should use dashboard widgets for the first view, side panes for drilldown, and full pages for deeper customization.

### Architecture Tasks

- Create `src/features/dashboard/queries.ts` for tenant-scoped dashboard data.
- Keep dashboard reads server-side and filtered by `tenant_id`.
- Build reusable dashboard widget components under `src/components/dashboard`.
- Build reusable chart components around the selected chart engine.
- Build side-pane drilldowns using the existing shared dialog/sheet pattern.
- Add full analytics routes where needed, such as `/dashboard/sales`, `/dashboard/workers`, `/dashboard/production`, and `/dashboard/finance`.
- Use search params for chart mode, grouping, date range, and selected workers.
- Keep analytics calculations deterministic and close to query helpers.
- Avoid schema changes unless performance requires stored aggregates later.

### Dashboard Data Areas

- Sales: orders, order totals, order payments, pending balances.
- Production: order items, workflow instances, stage instances, item history, due dates.
- Worker productivity: stage work logs, workers, stage completion timestamps.
- Finance: expenses, order payments, receivables/payables.
- Attendance: daily attendance status and alerts.

### Chart and Drilldown Requirements

- Sales bar chart defaults to recent daily view.
- Sales chart toggles between count and amount.
- Worker productivity chart defaults to past 7 days.
- Worker productivity full page supports worker checkbox selection, date range, and daily/monthly grouping.
- Every main chart/widget opens a side pane.
- Every side pane can open a full page for custom analysis.

### MVP Stale / At-Risk Rules

- At risk: item expected completion date is within the next 2 days and item is not completed/delivered.
- Delayed: item expected completion date is before today and item is not completed/delivered.
- Stale ready: current stage is ready to start but has not started after a threshold.
- Stale in progress: current stage is in progress but has no recent update after a threshold.

Thresholds can be hardcoded for MVP and moved to tenant configuration later.

### Deliverable

Owner/admin can open `/dashboard` and understand today’s sales, production risk, worker output, cash/dues pressure, attendance alerts, and top action items from one screen.

## Phase 7: Workers and Attendance

### Goals

Track worker presence and productive work separately.

Attendance should be implemented as a daily sheet. The sheet can contain draft row state on the client, but persisted records remain tenant-owned `attendance` rows keyed by worker and attendance date.

### Tasks

- Worker master
- Worker detail
- Workgroup assignment
- Manual attendance screen
- Daily attendance sheet with one bulk save action
- Tenant-validated sheet save that validates every worker belongs to the tenant
- Optional check-in/check-out fields
- Hours calculation from check-in/check-out when both times exist
- Manual hours override for cases where only payable hours are known
- Attendance status to payroll day-unit mapping: present `1`, half day `0.5`, absent/leave/holiday `0`
- Attendance overview as the default `/attendance` view, with daily sheet entry behind `view=mark`
- Overview query window driven by search params for 7-day, 14-day, 30-day, or custom range
- Active-worker multi-select filter driven by repeated `workers` search params
- Recharts-based attendance split and worker regularity charts
- Attention-board heuristics kept informational and separate from salary finalization
- Legacy `.xls` and `.xlsx` attendance parser with a 5 MB server-action limit plus signature/extension checks, local/central ZIP-header agreement, hard-capped entry inflation, and worksheet-range preflight
- No-write import preview with exact normalized active-worker name matching and explicit unmatched/ambiguous/future/blank/unknown skips
- SHA-256 file fingerprint plus stable idempotency key between preview and confirmation
- Atomic service-role RPC that revalidates tenant-owned active workers and inserts or updates one attendance row per worker/date
- Tenant-scoped, database-enforced immutable `attendance_imports` audit receipts for confirmed imports
- Focused parser, tenant/security contract, atomicity, and duplicate-submit regression tests using the supplied sample report
- Attendance calendar
- Worker work log list
- Productive time summary
- Worker productivity metrics

### Deliverable

Owner/manager can see attendance and production output for each worker.

## Phase 8: Salary and Worker Ledger

### Goals

Suggest worker payouts and track advances/loans through a low-stress founder workflow. Salary must prioritize historical visibility and guided entry over exposing every calculation and action on the first screen.

### Tasks

- Worker ledger
- Add advance/loan/deduction/repayment/adjustment
- Salary history dashboard with weekly, monthly, and custom date range filters
- Worker-wise salary paid history charts and tables
- Salary paid, salary due, and salary expense trend summaries
- Salary period creation
- Salary period overlap validation before insert
- Tenant-scoped active-period uniqueness/overlap checks in server actions
- Salary suggestion calculation
- Attendance and work log summary
- Manual adjustment
- Founder/admin finalized payable amount stored separately from the system suggestion
- Finalization note for founder adjustments
- Salary payment recording through Salary module
- Salary-paid entries stored in worker ledger with linked salary period and payment mode
- Worker salary payment status updated from actual salary-paid entries
- Finance aggregates salary expense from Salary/Worker Ledger instead of duplicate manual expenses
- Salary history
- Guided Add Salary flow with period setup, suggestion review, finalization, and payment steps
- Editable salary period metadata while unpaid
- Editable worker finalized payable amounts, notes, and payment entries with audit fields
- Duplicate submission protection for salary-paid ledger entries
- Guardrails against overpaying beyond outstanding payable unless explicitly allowed later
- Regeneration logic that preserves founder-finalized amounts or requires explicit reset/versioning

### Deliverable

Owner can understand salary history at a glance, safely create a salary period, review suggested payouts without anxiety, edit mistakes, and record salary payments that roll into Finance as one clean Salary expense category.

Detailed implementation spec: `docs/10_Salary_UX_Implementation_Spec.md`.

## Phase 9: Finance Basics

### Goals

Track operational inflow and outflow.

### Tasks

- Expense entry
- Expense list
- Receipt upload
- Receivables/payables
- Due date reminders in dashboard
- Finance dashboard basics
- Inflow/outflow summary
- Salary expense rollup sourced from worker ledger `salary_paid` entries
- Salary grouped as a single Finance expense category without requiring duplicate manual expense entry
- Order-locking `record_order_payment` RPC for race-safe payment capture and summary update
- Order-locking `correct_order_payment` RPC with immutable before/after values, actor, and required correction reason

### Deliverable

Owner can track expenses, collections, pending receivables, and payables.

## Phase 10: Customer Tracking Page

### Goals

Allow customers to view order status through a secure public link.

### Tasks

- Public tracking route
- Token lookup
- Tenant branding
- Customer-safe order summary
- Item-wise status display
- Customer-visible photos
- Expected delivery date
- Contact CTA
- Mobile-first layout

### Deliverable

Boutique can share a tracking link with customers manually.

## Phase 10A: Transactional Communications Foundation

### Goals

Add a tenant-safe communication layer for WhatsApp and email transaction alerts without sending live messages accidentally.

This phase prepares OS PLUS for order status alerts, tracking link messages, pickup/delivery notifications, payment received confirmations, and payment reminders. It should begin with provider-neutral queue/log/template foundations and a dry-run sender before live provider integration.

### Architecture Tasks

- Create `src/features/communications` for tenant-scoped queries, rendering helpers, queue helpers, and provider adapters.
- Create communication settings, templates, trigger rules, queue, and message log tables.
- Resolve tenant context before every communication read/write.
- Validate customer/order/order item/payment/receivable ownership before rendering or queueing a message.
- Keep provider credentials server-side only.
- Use a provider adapter interface so WhatsApp, email, and dry-run senders share one queue contract.
- Choose background job runner before live sends. Candidate options remain Inngest, Trigger.dev, or Supabase Edge Functions.
- Make every send idempotent by storing a deterministic trigger event key where possible.

### Communication Data Flow

1. An operational event occurs, such as customer-facing status change or payment reminder due.
2. Server code evaluates active trigger rules for the current tenant.
3. The selected template renders only approved safe variables.
4. A message is queued with tenant, customer, order, channel, recipient, template, rendered payload, and trigger event key.
5. Background worker sends through dry-run/sandbox/live provider depending on tenant channel settings.
6. Message log stores queued, sent, failed, skipped, or cancelled status plus provider response/error.

### UX Tasks

- Add Settings > Communications overview.
- Show channel status for WhatsApp and email.
- Show templates, trigger rules, recent sends, failures, and queued reminders.
- Add message preview before manual send.
- Add order detail actions for resend tracking link and payment reminder.
- Use calm empty/contact-missing states when phone/email is unavailable.

### Deliverable

Owner/admin can configure safe transactional message templates and triggers, preview messages, and queue dry-run WhatsApp/email alerts with complete tenant-scoped audit history. Live sending remains disabled until provider credentials, sender identity, and background job processing are finalized.

## Phase 10B: Production Hardening and Pilot Readiness

### Goals

Freeze large module expansion and harden the current MVP for real boutique pilot usage.

The current operating surface covers orders, item workflows, customers, measurements, workers, attendance, salary, finance, attachments, public tracking, dashboards, settings, and dry-run communications. The next technical priority is correctness, tenant safety, role safety, QA coverage, and deployment confidence.

### Access and Tenant Switching Tasks

- Improve `/select-tenant` into a business selector for users with multiple active tenant memberships.
- Add a top-right account/profile menu with current user, current business, role, switch business, and sign out.
- Ensure disabled tenant memberships never grant access.
- Ensure a user can be owner/admin in one tenant and finance/manager/viewer in another.
- Keep OS PLUS tenant membership and roles as the authorization source of truth.

### Tenant Isolation Audit Tasks

- Audit every tenant-owned table for `tenant_id`.
- Audit every server action for tenant context and permission checks.
- Audit every query helper for tenant-scoped filters.
- Audit ID-based pages and API routes for parent tenant ownership validation.
- Audit public tracking so it exposes only customer-safe fields.
- Audit private attachment download routes for tenant validation before signed URL creation.
- Audit communications settings, templates, queue, and logs for tenant validation.
- Add/fix focused regression tests or helper checks where practical.

### QA and Pilot Tasks

- Create `docs/OS_PLUS_QA_Test_Matrix.xlsx` with multiple sheets for full product QA.
- Split tests into automated/code-checkable tests and manual Clerk OTP/browser tests.
- Use Phantom Threads as the primary test bed.
- Create one clean new boutique tenant for production-style onboarding.
- Run one complete operational loop from tenant setup through order, production, attendance, salary, finance, attachment, communication dry-run, and public tracking.

### Deliverable

OS PLUS has a documented tenant-safety audit, business switching/account menu, role and membership behavior ready for multi-business users, and a complete QA workbook for market-readiness testing.

## Phase 10C: Tenant Commercial Control and GST Readiness

### Goals

Add OS PLUS-owned tenant billing/payment tracking and tenant-safe GST capture/reporting without turning the MVP into a full accounting engine.

### Super-Admin Commercial Tasks

- Add tenant billing/payment records.
- Keep tenant billing/payment tracking manual in the first implementation.
- Let super-admins edit mutable tenant fields while keeping slug immutable.
- Let super-admins mark tenants active, inactive, or suspended at any time.
- Add an inactive tenant locked-state page that tells tenant users to contact OS PLUS support without exposing internal billing notes.
- Ensure tenant status is checked server-side before loading tenant dashboards or tenant-owned data.

### GST Configuration Tasks

- Add tenant GST fields: GST registered status, GSTIN, legal name, registered address, default sales GST rate, default purchase GST rate, default order GST treatment, and default expense GST treatment.
- Add tenant-owned GST rate presets.
- Validate GSTIN format when present.
- Snapshot GST treatment/rate/amount on orders and expenses so historical reports do not change when defaults change.

### Order GST Tasks

- Add GST controls to the first section of order creation. Implemented first slice: tenant-defaulted order GST fields in the order details card.
- Support GST-exclusive, GST-inclusive, exempt/nil/non-GST, and not-applicable treatments. Implemented first slice: order creation snapshots treatment and rate.
- Keep payment mode separate from GST treatment. Cash payments remain recorded cash movements and do not automatically make a taxable sale non-reportable.
- Recalculate order taxable amount, GST amount, and total amount with deterministic decimal-safe helpers. Implemented for order creation.
- Show GST details on order detail. Implemented first read-only display.

### Expense GST Tasks

- Add expense/vendor GST fields: vendor GSTIN, invoice number, invoice date, GST treatment, GST rate, taxable amount, GST amount, and input GST review status. Implemented first slice for operational expenses.
- Keep GST paid on expenses separate from cash-out total. Implemented: payment mode and entered amount remain separate from GST classification.
- Preserve existing finance expense behavior while adding GST fields as optional/defaulted columns. Implemented with an opt-in GST disclosure in add/edit expense dialogs.

### GST Report Tasks

- Add Finance > GST view. Implemented first accountant-handoff view.
- Query output GST from orders and input GST from expenses by tenant and date range. Implemented with tenant-scoped report query.
- Show net GST payable estimate. Implemented as output GST minus claimable input GST.
- Show exception rows needing review. Implemented for tenant profile gaps and expense input GST review gaps.
- Before export, confirm GSTIN, legal business name, registered address, and reporting period. Implemented as visible confirmation block and exception list before XLSX download.
- Export XLSX with summary, order-wise output GST, expense-wise input GST, and review exceptions. Implemented with server-side `exceljs`.
- Keep the first export accountant-handoff only; GST portal upload formats are later.
- Use existing order numbers as the first report reference; dedicated GST invoice numbering is later.

### Deliverable

Super-admin can manage tenant commercial status, and tenant finance users can classify GST on orders/expenses and generate accountant-review GST reports.

Detailed plan: `docs/12_GST_SaaS_Billing_and_Market_Positioning.md`.

## Phase 10D: Public Website and Content Engine

### Goals

Build a premium, conversion-driven public website that positions OS PLUS as the operating system for workflow-driven businesses.

### Tasks

- Complete market research across accounting tools, generic project tools, boutique/tailoring tools, and small manufacturing ERPs.
- Define positioning around order-to-production workflow rather than accounting, CRM, or generic task management.
- Build an Awwwards-level landing page focused on business value: fewer missed orders, clearer production control, better cashflow, and calmer founder operations.
- Add blog architecture for continuous content publishing.
- Create content pillars around production workflow, boutique operations, cashflow, GST visibility, worker productivity, and customer tracking.
- Add conversion CTAs for pilot signup, workflow audit, and demo request.

### Deliverable

The public site clearly explains why OS PLUS exists, which businesses it serves, and why workflow-driven businesses need more than a standard accounting template.

## 6. Database Development Plan

### Migration Order

1. Enums
2. Tenants and tenant users
3. Configuration tables
4. Customers and measurements
5. Orders, items, payments
6. Workflow instance tables
7. Workers and attendance
8. Salary and ledger
9. Finance tables
10. Attachments and history
11. Transactional communications settings, templates, queue, and logs

### Base Columns for Tenant-Owned Tables

```sql
tenant_id uuid not null,
created_at timestamptz default now(),
updated_at timestamptz default now(),
created_by text,
updated_by text,
deleted_at timestamptz
```

### Important Indexes

- `tenant_id`
- `tenant_id, created_at`
- `tenant_id, status`
- `tenant_id, customer_id`
- `tenant_id, order_id`
- `tenant_id, phone` for customer suggestion
- `tenant_id, expected_completion_date` for at-risk view
- `tenant_id, worker_id, attendance_date`
- `tenant_id, worker_id, transaction_date`

## 7. API / Server Action Principles

All server actions must:

- Resolve current Clerk user
- Resolve tenant context
- Validate user has access to tenant
- Validate role/permission
- Apply tenant filter in query
- Validate input with Zod
- Write item history where required
- Return clear errors

Salary server actions must additionally:

- Reject overlapping active salary periods for the same tenant.
- Reject duplicate salary calculations for the same worker and period.
- Make payment submissions idempotent or otherwise protected against accidental double-submit.
- Preserve founder-finalized payable values during regeneration unless the user explicitly chooses to reset or version them.
- Validate salary payment amount against outstanding payable and return a calm, actionable message when the amount is too high.
- Store edits as updates with `updated_by`/`updated_at` and soft-delete/cancel records instead of silently removing operational history.

## 8. File Storage Plan

Use Supabase Storage buckets.

Suggested buckets:

- tenant-assets
- customer-attachments
- order-attachments
- item-attachments
- stage-attachments
- expense-receipts

Each file record should also be stored in `attachments` table.

The `attachments` table should control:

- Entity type
- Entity ID
- File URL/path
- File type
- Label
- Customer-visible flag
- Uploaded by

Customer tracking page should only show attachments where `is_customer_visible = true`.

Current MVP implementation uses a private Supabase Storage bucket named `os-plus-attachments` for direct uploads. Staff can also save external file URLs. Uploaded files should be opened through authenticated server routes that validate tenant context before issuing short-lived signed URLs.

## 9. Testing Plan

### Unit Tests

- Tenant context helper
- Permission helper
- Salary calculation
- At-risk calculation
- Workflow transition rules
- Customer phone suggestion search

### Integration Tests

- Create tenant
- Create customer
- Create order with multiple items
- Assign workflow
- Start stage
- Complete stage
- Move to next stage
- Add partial payment
- Generate salary suggestion
- Public tracking token lookup

### Security Tests

- User from Tenant A cannot access Tenant B orders
- User from Tenant A cannot access Tenant B customers, workers, measurements, salary, finance, attachments, communication settings, queues, logs, or settings
- Manager cannot access restricted finance data
- Finance user cannot access manager-only production/order management actions beyond allowed finance surfaces
- Disabled tenant membership cannot access tenant routes or actions
- Same Clerk user with multiple active tenant memberships sees only the selected tenant's data
- Public tracking page does not expose internal fields
- Attachments respect customer-visible flag
- Private attachment downloads validate tenant context before issuing signed URLs

### QA Workbook

Create `docs/OS_PLUS_QA_Test_Matrix.xlsx` with sheets for:

- Tenant Access
- Roles and Permissions
- Tenant Isolation
- Customers
- Measurements
- Orders
- Production
- Attendance
- Salary
- Finance
- Attachments
- Communications
- Public Tracking
- Deployment Smoke

## 10. Deployment Plan

### Environments

- Local
- Preview/staging
- Production

### Vercel

- Connect GitHub repo
- Add environment variables
- Configure preview deployments

### Supabase

- Separate local/staging/prod projects if possible
- Migration-based schema management
- Storage bucket setup

### Clerk

- Configure redirect URLs
- Configure production domain
- Configure invite flow later

## 11. Later Integrations and Live Providers

### Shopify

- OAuth connection per tenant
- Import orders
- Map Shopify products/SKUs to item types
- Auto-create order items
- Sync payment status

### WhatsApp Live Sending

- Tenant-level WhatsApp Business API credentials
- Template management
- Status-triggered messages
- Tracking link CTA
- Message logs
- Provider webhooks for delivery/read/failure status
- Tenant sender onboarding and template approval workflow

### Email Live Sending

- Tenant-level sender identity
- Email provider credentials
- SPF/DKIM/domain setup guidance later
- Transactional email templates
- Bounce/failure logs

### Inventory

- Finished goods inventory
- Raw material inventory
- Fabric consumption
- Low stock alerts

### QR/Barcode

- Generate QR per item
- Print item tags
- Scan to open item update screen

### Accounting

- GST invoice integration
- Zoho Books/Tally integration
- Bank reconciliation

### Item-type emoji and production filtering

- Persist only a nullable text emoji on the tenant-owned item type; validate one grapheme/emoji in the server action and bound storage in SQL.
- Query selectable item types by current tenant and filter production rows by validated tenant-derived IDs.
- Encode repeated filters as repeated URL parameters so list/board links, search, queue cards, workflow panes, and both multi-select controls compose predictably.
- Keep the icon out of public tracking queries and pages.
- Migration: `20260809140000_item_type_emoji.sql`.
