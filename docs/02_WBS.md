# OS PLUS Work Breakdown Structure

## 1. Project Setup

### 1.1 Repository Setup

- Create GitHub repository
- Initialize Next.js TypeScript project
- Configure package manager
- Configure ESLint and Prettier
- Add README
- Add `.env.example`
- Add `project_summary.md`

### 1.2 UI Foundation

- Install Tailwind CSS
- Install shadcn/ui
- Create base layout
- Create app shell
- Create responsive sidebar
- Create top navigation
- Add global submit-button pending labels and spinners for server mutations
- Block conflicting interaction and duplicate submission while mutations or internal route transitions are pending
- Keep focused dialogs open and preserve recoverable form data until save succeeds
- Create empty states
- Create error states

### 1.3 Environment Setup

- Create Vercel project
- Create Supabase project
- Create Clerk application
- Configure local environment variables
- Configure preview and production environment variables

## 2. Authentication and Multi-Tenant Foundation

### 2.1 Clerk Integration

- Add Clerk provider
- Configure sign in
- Configure sign up/invite flow
- Configure protected routes
- Configure user profile access

### 2.2 Supabase Integration

- Add Supabase client
- Add server-side Supabase helpers
- Add migration structure
- Add database types generation, if used

### 2.3 Tenant Data Model

- Create `tenants` table
- Create `tenant_users` table
- Create role enum
- Add tenant status
- Add indexes
- Add base audit columns where required

### 2.4 Tenant Resolution

- Resolve logged-in user from Clerk
- Link verified Clerk email to active OS PLUS tenant membership
- Load active tenant context
- Support one user belonging to multiple tenants with different roles
- Show business selector when a user has multiple active tenant memberships
- Allow users to switch active business from the account/profile menu
- Block access when no tenant is mapped
- Block access when tenant membership is disabled
- Prevent cross-tenant data access

### 2.5 Super Admin Foundation

- Create super admin route group
- Create tenant list page
- Create tenant creation page
- Create tenant detail page
- Invite/assign tenant admin
- Edit mutable tenant details after creation while keeping slug fixed
- Track tenant subscription/payment records
- Mark tenants inactive/suspended and show tenant users a contact-support inactive state

## 3. RBAC and Permissions

### 3.1 MVP Roles

- Owner/Admin
- Manager
- Finance
- Viewer

### 3.2 Permission Checks

- Create route-level permission helper
- Create module-level permission helper
- Hide sidebar modules based on role
- Block unauthorized API calls/server actions

### 3.3 Tenant User Management

- List tenant users
- Add user by email
- Assign role
- Disable user
- Keep tenant owner/admin UI status choices to active and disabled for MVP
- Hide Clerk user IDs from tenant owner/admin workflows

## 3A. Production Hardening and Market Readiness

### 3A.1 Business Selector and Account Menu

- Improve `/select-tenant` into a clear business selector
- Show business name, role, and active access state
- Add top-right account/profile menu
- Show signed-in user name/email
- Show current business and current role
- Add Switch business action
- Add Sign out action

### 3A.2 Tenant Isolation Audit

- Audit tenant-owned tables for `tenant_id`
- Audit server actions for `requireTenantContext`
- Audit route-level permission checks
- Audit query helpers for tenant filters
- Audit ID-based routes for parent tenant ownership validation
- Audit public tracking for customer-safe fields only
- Audit attachment download flow for tenant validation
- Audit communication templates, rules, queue, and logs for tenant validation
- Fix high-risk tenant isolation and permission gaps immediately

### 3A.3 QA Workbook

- Create `docs/OS_PLUS_QA_Test_Matrix.xlsx`
- Add sheets for Tenant Access, Roles and Permissions, Tenant Isolation, Customers, Measurements, Orders, Production, Attendance, Salary, Finance, Attachments, Communications, Public Tracking, and Deployment Smoke
- Include test ID, persona, tenant, preconditions, steps, expected result, actual result, status, and notes
- Mark which tests can be automated and which require real Clerk OTP/manual verification

### 3A.4 Pilot Onboarding Rehearsal

- Use Phantom Threads as the main test bed
- Create one clean new boutique tenant
- Add owner/admin, manager, finance, and disabled user memberships
- Configure item types, workflows, measurement fields, standard sizes, workers, payment modes, and expense categories
- Run one order end to end through order creation, production, attendance, salary, finance, attachments, communications dry-run, and public tracking

## 4. Configuration Module

### 4.1 Business Profile

- Store name
- Legal/business name, optional
- Logo upload
- Brand color
- Contact details
- Address
- GST registered toggle
- GSTIN, optional unless GST registered is enabled
- Legal business name and registered address
- Default sales GST rate
- Default purchase GST rate
- Default GST treatment for orders and expenses

### 4.2 Item Type Master

- List item types
- Add item type
- Edit item type
- Disable item type
- Seed defaults: Shirt, Pant, Kurtha, Blazer
- Add default SLA days
- Add default workflow mapping
- Create workflows/default mapping/stage rows in one atomic RPC and replace stage sequences transactionally
- Enforce active-stage invariants when creating, replacing, activating, or deactivating workflow configuration, including workflow-then-stage locking for simultaneous activation/last-stage deactivation

### 4.3 Stage Master

- List stages
- Add stage
- Edit stage
- Disable stage
- Map default customer-facing status

### 4.4 Customer Status Master

- List customer-facing statuses
- Add customer status
- Edit customer status
- Sort customer statuses
- Mark final status

### 4.5 Workgroups

- List workgroups
- Add workgroup
- Edit workgroup
- Disable workgroup
- Seed common groups if required

### 4.6 Stage to Workgroup Mapping

- Select stage
- Assign allowed workgroups
- Validate worker assignment based on mapping

### 4.7 Workflow Configuration

- List workflows
- Create workflow
- Add stages to workflow
- Sequence workflow stages
- Set expected duration
- Set mandatory/optional
- Set customer-facing status mapping
- Set multiple-worker support
- Activate/deactivate workflow

### 4.8 Payment Modes

- List payment modes
- Add payment mode
- Edit payment mode
- Disable payment mode
- Seed defaults: Cash, UPI, Shopify, Bank Transfer, Card, Other

### 4.9 Expense Categories

- List expense categories
- Add expense category
- Edit expense category
- Disable expense category
- Seed defaults: Raw material, Salary, Marketing, Rent, Travel, Utilities, Packaging, Courier, Maintenance, Miscellaneous
- Automatically provision all ten defaults after every tenant insert
- Idempotently backfill only missing normalized names for existing tenants without overwriting custom or disabled records

### 4.10 Configuration Correction Coverage

- Edit or activate/deactivate item types, stages, customer statuses, workgroups, payment modes, and expense categories
- Edit locations and teams while validating referenced locations and tenant ownership
- Edit worker profile, status, wage configuration, and workgroup membership atomically
- Edit workflow metadata and remove incorrect stage/workgroup mappings without rewriting existing production history
- Retain edit flows for measurement fields, standard sizes, customer measurements, and audited order payments
- Keep measurement-field identity immutable after creation; block standard-size or customer-measurement item-type reassignment when order history references it
- Record order-payment corrections through one order-locking transaction with an immutable reason and before/after audit record
- Reject foreign, deleted, or incompatible referenced IDs server-side

## 5. Customer Module

### 5.1 Customer List

- List customers
- Search by name
- Search by phone
- Filter by recent activity

### 5.2 Customer Creation

- Name mandatory
- Phone optional
- Email optional
- Gender optional
- Address optional
- Notes optional

### 5.3 Phone Suggestion Logic

- When phone is entered, search existing customers
- Show suggestions for matching phone number
- Allow selecting existing customer
- Normalize valid Indian and explicitly identified international numbers to E.164 when phone is present
- Recheck normalized mobile number server-side within the current tenant before save
- Resolve and select the existing customer when the normalized mobile matches
- Block creation of a second active customer with the same normalized mobile number
- Keep mobile optional
- Persist canonical E.164 phone storage and enforce active tenant-level uniqueness after the clean legacy collision audit

### 5.4 Customer Detail

- Show profile
- Show order history
- Show customer commercial summary
- Show active order count
- Show pending customer balance
- Link directly into new order creation for this customer
- Show measurements
- Show notes
- Show attachments
- Add customer-level attachment links with label, type, notes, and visibility flag

### 5.5 Customer Measurements

- Add measurement notes
- Add key-value measurement data
- Upload measurement card photo
- Link measurement to item type
- Support multiple measurements per customer
- Add reference name/note for identifying each measurement
- Show created and last-updated dates for each measurement
- Edit measurement fields, notes, item type, reference, and photo URL
- Archive incorrect or outdated measurement records
- Mark one default measurement per item type
- Mark one general default measurement when no item type is selected
- Surface saved measurements during order creation for the selected customer
- Configure tenant-level standard measurement fields per item type
- Pre-fill customer measurement forms from tenant-level item type standards
- Configure tenant-level standard size templates per item type
- Store each standard size as a named combination of measurement values

### 5.6 Customer File Import

- Add owner/admin-only CSV and XLSX upload entry point on Customers
- Enforce 5 MB and 5,000 data-row limits before preview
- Recognize Shopify customer-export headers and the OS PLUS import template
- Normalize Indian and international phone numbers conservatively to E.164
- Preview create, Shopify-ID reuse, phone reuse, exact-email review, conflict, invalid, and skipped outcomes without writes
- Require an explicit decision for exact-email-only candidates
- Fill only blank fields on reused customers and show every populated-field conflict
- Create structured default addresses only when address line 1 is present; preserve incomplete address text otherwise
- Retain Shopify totals, order counts, tags, tax flags, and marketing flags as source metadata only
- Confirm all approved rows through one tenant-scoped, idempotent database transaction
- Store an immutable import receipt and reject cross-tenant or tampered confirmation payloads
- Add automated parser, matching, security-contract, atomicity, idempotency, and permission coverage

## 6. Order Module

### 6.1 Order List

- List orders
- Search by order number
- Search by customer
- Filter by source
- Filter by payment status
- Filter by delivery date
- Filter by at-risk status

### 6.2 Manual Order Creation

- Select or create customer
- Enter order number
- Select source
- Add order date
- Add promised delivery date
- Select delivery type
- Add delivery address
- Add notes

### 6.3 Order Items

- Add multiple items
- Select item type
- Add item name/description
- Add color
- Add quantity
- Add price
- Add discount
- Select an item-type standard size independent of selected customer
- Select saved customer measurement when available
- Filter measurement choices by selected customer and compatible item type
- Quick-add a new customer measurement from an item row and auto-select it
- Select workflow
- Add expected completion date
- Add item-level delivery override if needed
- Add item notes

### 6.4 Quantity Handling

- If quantity needs individual tracking, create separate item rows
- Provide helper action to split quantity into individual item records

### 6.5 Payments

- Add partial payment
- Select payment mode
- Add payment date
- Add payment reference
- Update order payment status
- Record new payments through one order-locking transaction so concurrent requests cannot exceed the order total
- Correct payments through one order-locking transaction and retain immutable before/after values, actor, and correction reason

### 6.6 Order Detail

- Show customer details
- Show order commercial summary
- Show item cards
- Show linked fit reference on item cards when a standard size or customer measurement was selected during order creation
- Show and add item-level attachment links for design references, measurement photos, and production notes
- Show payment history
- Show delivery status
- Show tracking link
- Show internal notes
- Show order timeline

### 6.7 Order Editing

- Edit order-level commercial fields
- Edit promised delivery date
- Edit delivery address and notes
- Add or correct payment records through existing payment flow
- Edit item notes, expected completion date, delivery override, and linked fit reference
- Edit item name, description, and color
- Add several brand-new item rows in one focused Add items dialog
- Support full new-item fields including workflow, price, discount, due date, delivery override, standard size or customer measurement, and notes
- Allow additions after production starts with an explicit warning and per-item audit history
- Block additions for cancelled or fully delivered orders; allow production-completed but not delivered orders and return them to in-progress after addition
- Validate all referenced IDs, tenant ownership, workflow/item-type compatibility, measurement/customer/item-type compatibility, and standard-size/item-type compatibility server-side
- Create one workflow instance and ordered stage instances per new item, with the first stage ready immediately
- Add all rows, workflow records, history, and financial-summary changes in one atomic database operation
- Recalculate subtotal, discount, taxable amount, GST, total, amount paid, and payment status without altering payment records
- Use an idempotency key and block closing, editing, and duplicate submission while save is pending
- Preserve entered rows and show a visible recoverable error when save fails; show unmistakable success confirmation after the dialog closes
- Revalidate order, production, finance, dashboard, and public tracking surfaces after success
- Restrict destructive item edits once production work has started
- Defer customer changes, price changes, quantity changes, item deletion, and payment reversal to later finance-safe correction flows

## 7. Workflow Execution Module

### 7.1 Workflow Instance Creation

- When workflow is assigned to an item, create item workflow instance
- Generate stage instances from workflow stages
- Mark first stage as ready to start

### 7.2 Item Production View

- Show item details
- Show workflow timeline
- Show current stage
- Show stage history
- Show attachments
- Show notes

### 7.3 Stage Start

- Select worker from allowed workgroups only
- Allow multiple workers where configured
- Start timestamp
- Create work log
- Update stage status to in progress
- Create item history event

### 7.4 Stage Pause/Resume

- Pause active work log
- Resume active work log
- Track duration
- Create history events

### 7.5 Stage Completion

- Complete work log
- Complete stage
- Calculate duration
- Suggest next stage
- Manager confirms movement
- Mark next stage as ready to start
- Update item current status
- Update customer-facing status if mapped
- Create item history event

### 7.6 Stage Notes and Attachments

- Add note to stage
- Upload attachment
- Mark attachment customer-visible or internal-only

### 7.7 Blocked/Skipped Stage

- Mark stage blocked with reason
- Mark stage skipped with reason if allowed
- Create history event

### 7.8 Workflow Corrections

- Correct stage status, worker, started time, completed time, and stage notes
- Require a correction reason separate from operational stage notes
- Preserve correction history with before/after status, worker, and timing context
- Recompute workflow and item status after correction
- Move the next stage to ready when a corrected stage is completed or skipped

## 8. Dashboard and Analytics

### 8.1 Owner Dashboard Foundation

- Rebuild `/dashboard` as the business source-of-truth view
- Add compact ClickUp/Zoho-style dashboard layout
- Add Overview, Sales, Production, Workers, Finance, and Alerts tabs
- Add tenant-scoped dashboard query layer
- Add shared dashboard card/widget components
- Add shared chart shell with loading, empty, and error states
- Add shared side-pane pattern for chart/widget drilldowns
- Add full-page analytics route pattern for deeper analysis

### 8.2 Sales Analytics

- Add daily sales bar chart
- Add toggle between order count and booked order amount
- Add range defaults for recent activity
- Add side-pane sales drilldown
- Add full sales analytics view with daily/monthly/custom range filters
- Calculate booked revenue from order totals
- Show collections from order payments separately from booked revenue
- Show pending order receivables derived from order totals minus payments

### 8.3 Worker Productivity Analytics

- Add worker productivity line chart
- Default to past 7 days
- Show worker-wise item-stage productivity
- Count 1 when a worker completes an assigned item stage on that day
- Count 0.5 when a worker starts or touches work on an item stage that day without completing it that day
- Add side-pane worker productivity drilldown
- Add full worker analytics view with worker checkbox filters, date range, and daily/monthly grouping
- Keep productivity analytics separate from salary finalization

### 8.4 Production Control Analytics

- Add stale / at-risk item list
- Combine due-soon, delayed, blocked, stale ready-to-start, and stale in-progress items
- Add quick links to item workflow side pane/full workflow page
- Show workflow/stage context for every risk item
- Add items by workflow and items by stage summaries
- Add configurable thresholds later for stale ready and stale in-progress rules

### 8.5 Finance Dashboard Analytics

- Add cash collected today/range
- Add expenses paid today/range
- Add net cash movement
- Add open order receivables derived from orders/payments
- Add manual receivables and payables summary
- Add upcoming and overdue dues lists
- Surface simple P&L and balance snapshots from the Finance workspace
- Do not reintroduce manual order-linked receivables

### 8.6 Attention Queue

- Add unified owner attention queue
- Include delayed production
- Include stale workflow stages
- Include blocked items
- Include ready items awaiting pickup/dispatch/delivery
- Include overdue receivables/payables
- Include attendance not marked
- Include worker absence/half-day alerts

## 8A. Production Dashboard

### 8A.1 Dashboard Cards

- Orders due today
- Orders due in next 3 days
- At-risk orders
- Delayed orders
- Items in production
- Items blocked
- Items awaiting assignment
- Items ready for pickup/dispatch

### 8A.2 Production Views

- Toggle between production list and board view
- Stage-level Kanban board using workflow stage sequence
- Board columns with total, ready-to-start, in-progress, and delayed counts
- Kanban cards with item, order, customer, assigned worker, due urgency, and status
- Workflow filter for all workflows or one selected workflow
- Status filter for all, ready-to-start, and in-progress cards
- Card click opens the workflow side pane for quick edits
- No drag-and-drop movement in MVP
- Items by stage
- Items by workflow
- Stage-wise bottleneck view
- Due-date risk list
- Daily completion trend

### 8A.3 At-Risk Logic

- Implement MVP rule: item expected completion date <= today + 2 days and item not completed
- Roll up item risk to order risk

## 9. Worker and Attendance Module

### 9.1 Worker Master

- List workers
- Add worker
- Edit worker
- Disable worker
- Assign workgroups
- Set wage type
- Set wage amount

### 9.2 Attendance

- Daily attendance screen
- Daily attendance sheet with draft rows and one sheet-level save
- Mark present/absent/half day/leave/holiday
- Add optional check-in/check-out times
- Auto-calculate hours from check-in/check-out when both are present
- Allow manual hours without requiring check-in/check-out
- Treat manual hours as overriding calculated hours
- Support quick actions such as mark all present and mark unmarked present
- Add notes
- Add attendance overview tab before daily sheet entry
- Add date-wise attendance split chart
- Add worker regularity chart
- Add attention board for gaps, low regularity, repeated absences, and frequent partial days
- Add 7-day, 14-day, 30-day, and custom range filters
- Add active-worker multi-select filtering
- View monthly attendance
- Keep attendance day units aligned to salary suggestion rules
- Accept legacy `.xls` and `.xlsx` biometric attendance reports up to 5 MB
- Detect `.xlsx` by signature, require matching extension, cross-check local/central ZIP headers, bounded-inflate entries, and reject ZIP64, unsafe expansion/ratios, oversized entries, or excessive sheets/rows/columns/cells before materialization
- Parse one report month and show a no-write preview before confirmation
- Match source names only to one exact normalized active worker profile in the current tenant
- Skip and report unmatched names, duplicate/ambiguous names, future dates, blank cells, and unknown status codes
- Show new-versus-update attendance row counts by worker before confirmation
- Re-read and fingerprint-check the workbook on confirmation
- Atomically insert or update all matched worker/date rows through an idempotent service-role RPC
- Store a tenant-scoped attendance import audit receipt and revalidate attendance, salary, workers, and dashboard views
- Add regression coverage using `docs_v2/sample_Attendance_Report.xls`

### 9.3 Worker Detail

- Worker profile
- Attendance history
- Work logs
- Productivity metrics
- Ledger

## 10. Salary and Worker Ledger Module

### 10.0 Salary UX Direction

- Rework Salary as a calm founder workspace, not a dense payroll table
- Make salary history the first view: weekly, monthly, and custom range summaries
- Show total salary paid, salary due, worker-wise payment history, and salary expense trend
- Keep worker calculation details behind drilldown or a focused period workspace
- Use reassuring empty/error/success states so founders know whether an action was saved, editable, or blocked
- Avoid showing finalization forms and payment forms for every worker on the default page

### 10.1 Worker Ledger

- Add advance given
- Add loan given
- Add repayment
- Add deduction
- Add adjustment
- Add salary paid transaction
- Show balance

### 10.2 Salary Periods

- Create salary period
- Validate salary period date range before creation
- Prevent overlapping active salary periods for the same tenant
- Show clear overlap warnings and direct the user to edit the existing period instead of creating duplicates
- Generate worker salary suggestions
- Review salary calculation
- Preserve system suggestion after founder/admin finalization
- Enter founder-finalized payable amount per worker
- Require/recommend reason note when finalized amount differs from suggestion
- Add manual adjustment
- Deduct advances/loans
- Finalize payable
- Record partial or full salary payment
- Store salary payments as worker ledger `salary_paid` transactions
- Update worker-level payment status as unpaid, partially paid, or paid
- Update period status based on worker finalization and payment completion
- Prevent Finance from duplicating salary payments as manual expenses
- Make salary periods editable before payment is recorded
- Make worker finalized payable, notes, and payment entries editable with tenant validation
- Prevent duplicate worker salary calculations in the same period
- Prevent duplicate salary-paid ledger entries from repeated submissions
- Default salary payment amount to outstanding payable
- Warn or block if salary payment exceeds the outstanding payable
- Preserve founder-finalized amounts when regenerating suggestions, or require an explicit reset/version action
- Provide a guided Add Salary flow that moves from period selection to review to payment, instead of exposing all controls at once

### 10.3 Salary Reports

- Salary by period
- Salary by worker
- Weekly/monthly worker income history
- Salary paid by payment mode
- Salary payable outstanding
- Salary expense summary for Finance aggregation
- Outstanding advances/loans
- Worker-wise salary paid history over weekly, monthly, and custom date ranges
- Salary paid trend chart over weekly, monthly, and custom date ranges
- Salary due trend by period
- Worker payment status history for the past weeks/months

## 11. Finance Module

### 11.1 Expenses

- Add expense
- Select category
- Enter amount
- Enter payment mode
- Add paid-to party
- Add description
- Upload receipt
- Keep Salary expense out of manual duplicate entry when the payment came from Salary module

### 11.2 Receivables and Payables

- Add receivable/payable
- Add party name
- Add amount
- Add due date
- Add linked order if any
- Mark paid/partially paid

### 11.3 Finance Dashboard

- Revenue collected
- Pending receivables
- Expenses this month
- Salary payable
- Net cash movement
- Upcoming payables
- Salary expense rollup from Salary/Worker Ledger `salary_paid` entries
- Show Salary as one expense category in Finance summaries
- Avoid duplicating Salary module payments as manual expense records
- Upcoming receivables

### 11.4 GST Configuration and Capture

- Add tenant GST settings under Business Profile or Finance Settings
- Store GST registered status, GSTIN, legal name, registered address, default sales rate, and default purchase rate
- Add tenant GST rate presets
- Add staff-facing GST treatment to order creation: GST added on top, GST included in amount, or GST off
- Keep payment mode separate from GST treatment; cash payments must still be recorded normally
- Snapshot GST rate, taxable amount, GST amount, and GST treatment on each order
- Add GST treatment to expense/vendor payment entry
- Store vendor GSTIN, invoice number, invoice date, taxable amount, GST amount, and input GST review state
- Preserve historical GST snapshots even if tenant defaults change later

### 11.5 GST Report

- Add Finance > GST view
- Add date range filter
- Show output GST collected from orders
- Show input GST paid from expenses/vendor payments
- Show estimated net GST payable
- Show records missing GST classification or invoice/GSTIN details
- Ask tenant to confirm GSTIN, legal business name, registered address, and reporting period before generating report
- Export XLSX with summary, order-wise GST collected, expense-wise GST paid, and exceptions/review sheets
- Keep direct GST filing/e-invoicing integration for a later accounting phase

## 12. Customer Tracking Page

### 12.1 Tracking Token

- Generate secure random token per order
- Store token on order
- Allow admin/manager to copy tracking link

### 12.2 Public Tracking Page

- Mobile-first layout
- Tenant branding
- Order summary
- Item-wise customer-facing status
- Expected delivery date
- Pickup/delivery type
- Customer-visible photos
- Contact CTA

### 12.3 Security

- No login required
- No internal notes
- No worker names
- No salary/work log data
- No internal-only attachments

## 12A. Transactional Communications

### 12A.1 Communication Foundation

- Create tenant-owned communication channel settings
- Store WhatsApp and email enablement per tenant
- Store provider mode as disabled, sandbox, or live
- Store sender display name and safe sender metadata
- Keep provider secrets server-only and out of client-rendered pages
- Add communication audit/message log table
- Add communication queue table for send-later and retryable messages
- Add tenant-scoped indexes for queue processing and message history

### 12A.2 Message Templates

- Create tenant-owned message templates
- Support WhatsApp and email templates separately
- Support safe variables only
- Store template purpose such as order update, tracking link, payment reminder, or delivery update
- Mark templates active/inactive
- Store external provider template name/id for WhatsApp approval later
- Add preview rendering with sample order/customer/payment data

### 12A.3 Trigger Rules

- Create tenant-owned trigger rules
- Support order confirmed, customer-facing status changed, ready for pickup/dispatch, delivered, payment received, balance pending, and overdue payment reminders
- Allow each trigger to choose channel and template
- Allow triggers to be enabled/disabled independently
- Validate trigger references against current tenant before queueing messages
- Prevent duplicate queue records for the same trigger event when an action is retried

### 12A.4 Staff UX

- Add Settings > Communications overview
- Show channel setup state, enabled triggers, recent sends, failures, and queued reminders
- Add focused setup dialogs for channel settings, templates, and triggers
- Add order detail action to preview/send tracking link or payment reminder manually
- Show calm contact-missing states when customer phone/email is not available
- Keep automated status-triggered setup centralized in settings

### 12A.5 Provider Integration

- Add provider adapter interface for WhatsApp and email
- Start with dry-run/sandbox provider that records messages without live sending
- Add Meta WhatsApp Cloud API adapter after tenant credentials and template approval flow are ready
- Add email provider adapter after sender identity requirements are finalized
- Process queued messages from a background job with retry limits and failure logging

### 12A.6 Communication Safety QA

- Verify Tenant A cannot read, queue, send, or retry Tenant B messages
- Verify message rendering never includes measurements, internal notes, workers, salary, or internal attachments
- Verify public tracking links included in messages remain token-based and customer-safe
- Verify no live message is sent unless tenant channel mode is live and provider config is valid

## 13. Reports

### 13.1 Order Reports

- Order volume
- Revenue booked
- Payment pending
- Channel-wise orders

### 13.2 Production Reports

- Items completed
- Items delayed
- Stage bottlenecks
- Workflow performance

### 13.3 Worker Reports

- Attendance
- Productive hours
- Units completed
- Worker leaderboard

### 13.4 Finance Reports

- Expenses by category
- Salary payout
- Receivables
- Payables

## 14. Testing and QA

### 14.1 Unit Testing

- Tenant helpers
- Permission helpers
- Salary calculations
- At-risk logic
- Workflow transition logic

### 14.2 Integration Testing

- Order creation with items
- Workflow assignment
- Stage update flow
- Payment update flow
- Salary period generation
- Public tracking page

### 14.3 Security Testing

- Tenant isolation
- Role-based access
- Public tracking field exposure
- File access control

### 14.4 UAT Scenarios

- Create tenant
- Configure boutique
- Create customer
- Create order with 3 items
- Assign different workflows
- Move item through stages
- Add payment
- Mark attendance
- Generate salary suggestion
- Add expense
- View tracking page
