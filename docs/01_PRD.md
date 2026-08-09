# OS PLUS PRD

## 1. Product Name

**OS PLUS**

Working description: A multi-tenant, white-label WorkOS for boutiques and small manufacturing businesses.

## 2. Product Vision

OS PLUS is a web-based operating system that helps boutiques manage their entire business workflow from order intake to production tracking, worker effort, salary visibility, expenses, and customer-facing order status.

The first vertical is fashion boutiques, but the platform must be architected as a configurable manufacturing SaaS that can later be repurposed for other order-to-production businesses.

The product is not just an order tracker. It is a full operating layer for businesses where orders move through multiple human-driven production stages.

## 3. Core Promise

OS PLUS gives boutique owners one place to track:

- Orders
- Customers
- Item-level production
- Workflow stages
- Worker effort
- Attendance
- Salary suggestions
- Expenses
- Delivery risks
- Customer order tracking
- Business dashboards

## 4. Target Users

### Primary Users

- Boutique owner
- Store manager
- Production manager
- Finance/admin staff

### Secondary Users

- Customers viewing public tracking links
- Business owners of other manufacturing-style businesses in later versions

### Non-Login Operational Users

Workers such as tailors, masters, designers, finishers, packers, and QC staff are not app users in the MVP. Managers/admins log work on their behalf.

## 5. MVP Scope

### Included in MVP

- Multi-tenant SaaS foundation
- White-label tenant configuration
- Clerk-based authentication
- Role-based access
- Super admin tenant creation
- Manual order creation
- Customer profiles
- Customer lookup suggestions by phone number
- Item Type Master
- Workflow configuration
- Stage Master
- Workgroup configuration
- Worker master
- Item-level workflow assignment
- Item-level workflow execution
- Stage start, pause, resume, complete
- Multiple workers per stage
- Work logs
- Item history
- Attachments at customer, measurement, item, and stage level
- Customer-visible attachment flag
- Initial attachment implementation supports private file upload and external file URL/reference records.
- Manual attendance
- Worker productivity dashboard
- Salary suggestion module
- Worker ledger for salary advances and loans
- Expense tracking
- GST configuration and GST-ready reporting planned as a finance hardening feature
- Partial payment support
- Partial pickup/dispatch support
- Customer-facing tracking link
- Tenant-scoped transactional WhatsApp and email alert foundation
- Manual/send-later transactional messages for order status updates and payment reminders
- Production and at-risk dashboard

### Excluded from MVP

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

## 6. Key Product Principles

### 6.1 Order is commercial. Item is operational.

An order contains commercial information such as customer, payment, discount, delivery type, and order value.

An order item is the production unit. Each item can have its own workflow, expected completion date, current stage, worker logs, attachments, and delivery status.

### 6.2 Workflow is selected at item level.

Different items in the same order may need different workflows.

Example:

- Plain shirt: Cutting → Stitching → Finishing → Packing
- Designer shirt: Marking → Design work → Cutting → Stitching → QC → Packing
- Ready stock item: Pick → QC → Pack

### 6.3 Internal status and customer-facing status are separate.

Internal stage names can be detailed. Customer-facing status names should be simplified.

Example internal statuses:

- Marking
- Cutting
- Design work
- Stitching
- Finishing
- QC
- Packing

Example customer statuses:

- Order confirmed
- In production
- Finishing
- Ready
- Delivered

### 6.4 Attendance and work logs are separate.

Attendance records whether a worker was present.

Work logs record what production work was completed and for how long.

This allows the business to compare attendance hours with productive work hours.

### 6.5 Multi-tenant and white-label from day one.

Every boutique/business is a tenant. Each tenant has its own branding, users, configurations, orders, customers, workers, workflows, expenses, and tracking pages.

### 6.6 OS PLUS owns tenant membership and roles.

Clerk handles authentication and verified user identity. OS PLUS owns tenant membership, tenant role, tenant selection, and active/disabled access state.

A single signed-in user can belong to multiple businesses with different roles. For example, the same email can be owner/admin in one boutique and finance in another. The product must provide a clear business selector and account switcher so users can choose the business they are working in.

For MVP, tenant user status in the owner/admin UI should be simplified to:

- Active
- Disabled

Tenant owners/admins add internal users by email only. Clerk user IDs are internal technical identifiers and must not be entered by tenant owners.

### 6.7 Mutations must provide immediate feedback.

Every server mutation and internal route transition must make progress visible immediately. Submit controls show a specific pending label and spinner, conflicting interaction is blocked while the request is pending, and duplicate submissions are prevented. Focused dialogs that own unsaved work must not close while saving. Recoverable workflows keep entered data and show an explicit success or error result.

## 7. User Roles

### 7.1 OS PLUS Super Admin

Can:

- Create tenants
- Manage tenant status
- Edit mutable tenant details after creation
- Track tenant subscription/payment records
- View tenant list
- Access tenant for support if required
- Disable tenants

### 7.2 Owner/Admin

Can access all modules inside their tenant:

- Orders
- Customers
- Production
- Workers
- Attendance
- Salary
- Finance
- Dashboards
- Configuration
- Users

### 7.3 Manager

Can access:

- Orders
- Customers
- Production items
- Workflow updates
- Worker assignment
- Attendance
- Production dashboard

Salary and finance access should be restricted unless explicitly granted later.

### 7.4 Finance

Can access:

- Payments
- Expenses
- Salary calculations
- Worker ledger
- Finance dashboard

### 7.5 Viewer

Can view selected modules only.

## 8. Core Modules

## 8.1 Tenant Management

### Purpose

Allow OS PLUS super admin to create and manage boutique/business tenants.

### Features

- Create tenant
- Store tenant name
- Store tenant slug
- Store business/store name
- Upload logo
- Configure brand color
- Set tenant status
- Edit mutable tenant profile fields after creation while keeping tenant slug immutable
- Track tenant subscription/payment history for OS PLUS billing
- Mark a tenant inactive/suspended and show tenant users a safe contact-support inactive state
- Pre-authorize first tenant admin by email
- Allow signed-in users linked to multiple tenants to choose which business to enter
- Allow signed-in users to switch between active business memberships

### MVP Tenant Onboarding

Tenant creation is manual. OS PLUS super admin creates the boutique tenant and pre-authorizes the owner/admin by email. The owner gains access after signing in with that verified Clerk email while the OS PLUS tenant membership is active.

## 8.2 Configuration Module

### Purpose

Allow each tenant to configure how their boutique operates.

### Configuration Areas

- Business profile
- Branding
- GST registration settings
- Default GST rates and GST treatment defaults
- Users
- Item types
- Stage master
- Workflows
- Workflow stages
- Workgroups
- Workers
- Payment modes
- Expense categories
- Customer-facing statuses

### Default Item Types

- Shirt
- Pant
- Kurtha
- Blazer

### Default Expense Categories

- Raw material
- Salary
- Marketing
- Rent
- Travel
- Utilities
- Packaging
- Courier
- Maintenance
- Miscellaneous

These ten categories are provisioned automatically for every new tenant. Existing tenants receive any missing defaults through an idempotent backfill matched by normalized category name. The backfill must not rename, reactivate, delete, or overwrite existing tenant categories.

### Configuration Editing Rules

- Tenant owner/admin can edit operational configuration after creation, including item types, stages, customer statuses, workgroups, payment modes, expense categories, locations, teams, workflows, worker details, measurement fields, standard sizes, and customer measurements.
- Workflow creation, default reassignment, and stage-sequence replacement must be atomic; a failed save must not leave a workflow without stages or multiple defaults for one item type.
- Active workflows may reference only active stage-master rows and must always retain at least one active stage. Workflow activation and last-stage deactivation must lock in workflow-then-stage order, so simultaneous requests serialize and one conflicting change is rejected transactionally.
- Measurement-field key/item type, standard-size item type, and customer-measurement item type are creation identities. Edit labels, values, notes, order, and active state in place; create a new record to change identity so order and production history cannot be invalidated.
- Editing validates the record and every referenced ID against the current tenant on the server.
- Configuration records already referenced by production, finance, attendance, salary, or customer history are updated or disabled without deleting historical records.
- Existing order payments remain editable through an atomic finance correction flow. The order row is locked, overpayment is rejected, and immutable before/after values, actor, and reason are stored; configuration payment modes are edited separately.
- Workflow metadata and stage/workgroup mappings can be corrected without rewriting copied production-stage history on existing items.

## 8.3 Customer Module

### Purpose

Maintain reusable customer profiles with contact details, order history, and measurement information.

### Customer Rules

- Customer name is mandatory.
- Phone number is optional.
- Email is optional.
- Gender is optional.
- Address is optional.
- Notes are optional.
- When a phone number is present, normalize valid numbers to E.164 for matching and uniqueness. Existing Indian 10-digit, leading `0`, `+91`, and `0091` inputs remain accepted and resolve to `+91` plus the final 10 digits.
- Explicit `+` or `00` international numbers are accepted. A national-format foreign number is accepted only when a reliable ISO country code is supplied; ambiguous foreign numbers are invalid rather than guessed.
- Before saving, the server must check active customers in the current tenant for the same normalized mobile number.
- If a match exists, do not create a duplicate customer. Resolve and select the existing customer instead.
- Customer suggestions should remain available while entering the phone number, and selecting a suggestion should immediately choose that customer.
- Inline customer creation from an order must not navigate away or discard the order draft.
- A read-only legacy audit completed with no active normalized-phone collisions. Persist the canonical E.164 value and enforce one active normalized phone per tenant at the database boundary as well as in application flows.

### Customer File Import

- Owner/admin users can preview and confirm customer imports from CSV or XLSX files up to 5 MB and 5,000 data rows.
- Preview never writes data. It reports valid creates, authoritative reuses, exact-email review candidates, conflicts, invalid rows, and skipped rows before confirmation.
- Rows without a customer name are skipped. Email addresses must never be substituted as customer names.
- Reuse precedence is Shopify customer ID, then normalized E.164 phone. An exact email match is advisory only and requires an explicit choice to reuse the existing customer or create a separate profile.
- When a matched customer is reused, import may fill blank profile fields but must never overwrite populated fields automatically. Conflicting source values remain visible in preview.
- Complete addresses create structured default customer-address rows. Incomplete addresses remain available as legacy address text and source metadata.
- Shopify historical totals, order counts, tags, tax flags, and marketing flags are retained as read-only source metadata. They do not create OS PLUS orders or finance entries, do not affect reports, and do not activate email, SMS, or WhatsApp messaging.
- Invalid and skipped rows are excluded from confirmation. All explicitly approved create/reuse operations commit atomically and idempotently; a failure leaves no partial customers, addresses, identities, or import receipt.
- Import matching and every write are tenant-scoped on the server. A source identity from one tenant must never resolve a customer in another tenant.

### Customer Fields

- Name
- Phone
- Email
- Gender
- Address
- Notes
- Created date

### Measurement Support

MVP supports:

- Measurement notes
- Measurement photos
- Simple key-value measurement fields
- Item-type-specific measurement records
- Multiple measurement records per customer
- Human-friendly reference name for each measurement record
- Visible created and last-updated dates for measurement records
- One default measurement per item type, plus one general default when item type is empty
- Order creation can link a saved customer measurement to each order item for production reference.
- Order creation can also link an item-type standard size such as XS, S, M, L, XL, 38, or 40 to each order item without depending on the selected customer.
- Measurement links are internal founder/staff references and must not appear on the public customer tracking page.
- Tenants can configure standard measurement fields per item type so customer measurements and size templates stay consistent within that tenant.
- Tenant-level standard measurement fields and standard sizes must never be shared across tenants.

Example:

```json
{
  "chest": "40",
  "shoulder": "18",
  "sleeve": "24",
  "length": "29"
}
```

## 8.4 Order Module

### Purpose

Allow boutique staff to manually create and manage customer orders.

### Order Sources

- Walk-in
- Shopify manual
- WhatsApp
- Other

### Order Fields

- Order number
- Source
- Customer
- Order date
- Promised delivery date
- Delivery type
- Delivery address
- Subtotal
- Discount amount
- Total amount
- Amount paid
- Payment status
- Order status
- Notes
- Tracking token

### Delivery Types

- Store pickup
- Self delivery
- Courier

### Payment Statuses

- Unpaid
- Partially paid
- Paid
- Refunded

### Order Rules

- One order can have multiple items.
- Order has a promised delivery date.
- Each item can have an expected completion date.
- Each item can optionally reference either one saved customer measurement or one item-type standard size.
- Item-level delivery type can override order-level delivery type.
- Partial payments must be supported.
- Partial pickup/dispatch must be supported.
- Order-level delivery type applies to all items unless overridden at item level.

### Adding Items to an Existing Order

- Order detail provides a separate focused **Add items** flow for adding one or more brand-new production items in one save.
- The flow is add-only. It does not change or delete existing items, change the order customer, reverse payments, or edit existing item quantity or price.
- Newly added rows support the complete item-creation field set: item type, name, description, color, quantity, unit price, discount, workflow, expected completion date, delivery override, standard size or customer measurement, and notes.
- Quantity greater than one remains one production item row with a quantity value. Independently tracked physical pieces must be entered as separate rows.
- Adding items is allowed after production has started on existing items, but the UI must warn the user and every new item must receive an audit/history event.
- Cancelled and fully delivered orders cannot accept new items. Production-completed orders that have not been delivered can accept new items and return to in-progress.
- Each new item must immediately receive its own workflow instance, stage instances, and first ready stage.
- The complete batch is atomic: any validation or workflow-initialization failure must leave the order unchanged.
- The server must validate tenant ownership and active/compatible state for the order, item types, workflows, workflow stages, customer measurements, and standard sizes.
- Customer measurements must belong to the order customer and match the item type when item-type-specific. Standard sizes must belong to the selected item type.
- Order subtotal, discount, taxable amount, GST, and total are recalculated from all active old and new items using the order's existing GST treatment and rate.
- Existing payment records are preserved. The order payment summary is recalculated from active payment history, so a previously paid order may become partially paid when its total increases.
- Saving uses an idempotency key and blocks duplicate submissions. While pending, the entire dialog is disabled and cannot be closed; failures keep entered rows and show recoverable error feedback, and success remains visibly confirmed after the dialog closes.
- Successful saves refresh order detail/list, production, finance/receivables, dashboard, and public tracking surfaces without exposing internal workflow or fit-reference data publicly.

## 8.5 Order Item Module

### Purpose

Track each item in an order as an individual production unit.

### Item Fields

- Order
- Item type
- Customer measurement reference
- Name
- Description
- Color
- Quantity
- Unit price
- Discount amount
- Final price
- Workflow
- Expected completion date
- Delivery type override
- Item status
- Customer-facing status
- Final photo
- Notes

### Important Quantity Rule

If quantity is more than 1 and each piece requires individual tracking, the system should create separate item records. This avoids production confusion.

Example:

Customer orders 3 shirts. If each shirt needs tracking, create:

- Shirt 1
- Shirt 2
- Shirt 3

## 8.6 Workflow Module

### Purpose

Configure and execute item-level workflows.

### Workflow Configuration

Each workflow contains ordered stages selected from Stage Master.

Each stage can define:

- Sequence number
- Mandatory/optional flag
- Expected duration
- Allowed workgroups
- Customer-facing status mapping
- Attachment requirement
- Multiple-worker support

### MVP Workflow Execution Rules

- Workflow is selected at item level.
- MVP supports sequential workflows.
- Data model must allow future parallel stages.
- Stage cannot start without assigning at least one worker.
- Stage can have multiple workers.
- Stage completion suggests the next stage.
- Manager confirms movement to next stage.
- Every major stage update creates item history.
- Notes can be added to each stage.
- Attachments can be added to each stage.

### Stage Statuses

- Not started
- Ready to start
- In progress
- Paused
- Completed
- Skipped
- Blocked

## 8.7 Worker Module

### Purpose

Maintain workers and their group mappings.

### Worker Types / Workgroups

Examples:

- Master
- Tailor
- Designer
- Finisher
- Packer
- QC

### Worker Rules

- Workers do not log in during MVP.
- Managers/admins log work on behalf of workers.
- A worker can belong to multiple workgroups.
- A workflow stage can only be assigned to a worker from the allowed workgroups.

### Worker Fields

- Name
- Phone
- Joining date
- Status
- Primary workgroup
- Wage type
- Wage amount
- Notes

### Wage Types

- Hourly
- Daily
- Weekly
- Monthly
- Per piece later
- Hybrid later

## 8.8 Attendance Module

### Purpose

Track worker presence separately from productive work logs.

### Attendance MVP

- Admin/manager manually marks attendance.
- Admin/manager can import supported biometric attendance reports in legacy `.xls` or `.xlsx` format.
- Attendance manager integration can be added later.
- Attendance is recorded as a daily sheet before salary calculation.
- Attendance status is the primary payroll day-unit signal.
- Time-in and time-out are optional operational details.
- If time-in and time-out are entered, the system should calculate hours.
- If manual hours are entered, time-in and time-out can remain empty.
- Manual hours should override calculated hours.
- Attendance should open with an overview before daily entry.
- The overview should default to a 14-day window and support custom date range analysis.
- The overview should support active-worker multi-select filtering.

### Attendance Excel Import

- Import accepts one report month per workbook and files up to 5 MB. `.xlsx` uploads are detected by signature, require a matching extension, cross-check central and local ZIP headers, inflate each entry under a hard output cap, and bound archive entries/expanded size/compression ratio plus worksheet count/declared rows/columns/cells before worksheet materialization.
- The import first shows a preview. Preview never writes attendance.
- A source worker is eligible only when the normalized source name exactly matches one active worker profile in the current tenant. Matching ignores case, Unicode presentation differences, non-breaking spaces, repeated spaces, and leading/trailing spaces; it does not use fuzzy matching.
- If no active profile matches, or more than one source/profile candidate has the same normalized name, that worker is skipped. Import never creates a worker profile.
- The preview clearly reports exact matches, unmatched names, ambiguous names, new rows, existing rows that will be updated, future dates, blank status cells, and unknown status codes.
- Supported source statuses map to Present, Absent, Half day, Leave, and Holiday. Weekly off and holiday source codes map to Holiday because attendance and production work logs remain separate.
- Future dates and unknown or blank status cells are not imported.
- Confirmation re-reads the workbook, rechecks its SHA-256 fingerprint, revalidates active tenant workers, and recalculates matches before writing.
- For a matched worker/date, the confirmed report updates the existing active attendance row; otherwise it creates one. Existing free-text notes are preserved when an existing row is updated.
- The entire confirmed import is one atomic, idempotent database operation. Any invalid row or ownership failure rolls back all rows, and retrying the same confirmation does not create duplicates.
- Every confirmed import stores a database-enforced immutable, tenant-scoped audit receipt with file metadata, report month, row counts, actor, idempotency key, and aggregate result. Workbook contents are not exposed publicly.

### Attendance Overview

The attendance overview should help the owner quickly understand regularity and attendance discipline before entering a daily sheet.

Required MVP visuals:

- Date-wise attendance split chart for present, half day, absent, leave, holiday, and unmarked workers.
- Worker regularity chart with clear visual state for healthy, watch, and attention levels.
- Attention board for repeated absences, attendance gaps, low regularity, frequent partial days, and unmarked current-day attendance.
- Separate Mark Attendance view for daily sheet entry.

### Attendance Statuses

- Present
- Absent
- Half day
- Leave
- Holiday

### Attendance and Salary Semantics

- Present counts as `1` attendance day by default.
- Half day counts as `0.5` attendance day by default.
- Absent, Leave, and Holiday count as `0` attendance days by default in MVP.
- For daily, weekly, and monthly wage types, salary suggestion primarily uses attendance day units.
- For hourly wage type, salary suggestion primarily uses attendance hours.
- Production work logs remain separate and may inform productivity or future per-piece/hybrid rules, but they do not replace attendance.
- Salary remains system-suggested and admin-finalized.

## 8.9 Work Log Module

### Purpose

Track actual production work performed by each worker on each item-stage.

### Work Log Fields

- Stage instance
- Order item
- Worker
- Workgroup
- Started at
- Paused at
- Resumed at
- Completed at
- Duration minutes
- Credited units in tenth-unit (0.10) increments where the stage tracks pieces
- Credited effort minutes in ten-minute increments where the stage tracks time
- Calculated contribution amount for analytics
- Snapshotted calculation basis and rate context from the stage instance
- Status
- Notes

### Work Log Rules

- One stage can have multiple workers.
- Every worker contribution selects the eligible workgroup/role actually performed, including when one worker belongs to several allowed workgroups.
- Stage effort mode is configured as none, units, hours, or units plus hours.
- Units and hours are operational inputs. Stage elapsed time remains separate from summed worker effort; five workers contributing one hour each is five man-hours even when the stage elapsed time is one hour.
- Unit-tracked stages accept 0.10-unit credits and must total the order-item quantity before completion.
- Hour-tracked stages accept ten-minute increments and show total man-hours before completion.
- Item-type/stage contribution rules are optional and support per-unit, per-hour, or percentage-pool calculation. Percentage uses the item value after item discount and before GST, then distributes one pool by configured credited units or hours.
- Missing monetary configuration never blocks production; the contribution remains INR 0 with a visible Rate not configured warning.
- Rules are snapshotted when a stage starts. Later configuration changes apply only to stages that have not started.
- Workers may be added, edited, or removed before completion. Removing entered effort requires a correction reason and immutable before/after audit history.
- After completion, only owner/admin may correct worker contributions, and every correction requires a reason. Existing historical completed stages are not backfilled.
- Contribution values are analytics-only and must not change wages, salary suggestions, order totals, GST, payments, or finance ledgers.
- The first worker on a unit-tracked stage starts with the full item quantity for fast single-worker entry; additional workers start at zero so the user deliberately reallocates credit.
- Unit and time inputs provide mobile-friendly increment/decrement controls alongside exact numeric input. A successful completion returns to the workflow view; start and in-progress saves keep the editor open.
- Stage and contribution-rule configuration saves close the editor on success, refresh the visible saved summary, and retain the entered form with a recoverable error on failure.
- Worker contribution reporting compares contribution value, credited units, man-hours, and completed stages as separate selectable metrics. It uses completion week, excludes active work, shows rate-configuration coverage, and never presents contribution value as salary or revenue.
- One worker can work on many items in a day.
- Duration should be calculated where possible.
- Manual correction should be allowed by admin/manager.

## 8.10 Salary Module

### Purpose

Suggest salary payable based on worker wage configuration, attendance, work logs, and adjustments.

The Salary module must feel calm and confidence-building for a solo founder. It should not open with dense payroll mechanics, exposed calculation rows, and many inline actions. The first view should answer simple owner questions: how much has been paid, who has been paid, what is due, and how salary expense is trending over weekly/monthly/custom ranges.

### Salary Rules

- System suggests salary.
- Admin finalizes actual payout.
- Manual adjustments are allowed.
- Salary advances and loans should be linked through worker ledger.
- The system-suggested payable must remain visible even after founder finalization.
- Founder/admin can enter a different finalized payable amount for a worker and add a note.
- Salary payments must be recorded from the Salary module and stored as worker ledger `salary_paid` entries.
- Salary payments should appear in Finance as salary expense, aggregated from Salary/Worker Ledger, not duplicated as manual expenses.
- Partial salary payments must be supported.
- Regenerating suggestions should not silently overwrite founder-finalized payable decisions.
- Salary period creation must prevent overlapping active salary periods for the same tenant.
- Salary entry must prevent accidental duplicate salary expenses for the same worker and period.
- Salary entries, finalized amounts, notes, and payments must be editable with a clear audit trail.
- The primary Salary screen should prioritize historical payment visibility before salary creation controls.
- Detailed calculation inputs should be available as drilldown, not forced into the default page view.
- Salary actions should be guided, reversible where safe, and written in reassuring language that reduces fear of wrong entries.

### Salary Period Statuses

- Draft
- Reviewed
- Finalized
- Paid

### Salary Calculation Inputs

- Attendance days
- Attendance hours
- Productive work minutes
- Wage type
- Wage amount
- Advances/loans
- Deductions
- Manual adjustments

### Salary Finalization and Payment

Salary has three distinct layers:

- Suggestion: system-generated from wage configuration, attendance, production work logs, and worker ledger entries.
- Finalization: founder/admin-confirmed payable amount for each worker in a salary period.
- Payment: actual money movement recorded as `salary_paid` in worker ledger and surfaced in Finance as salary expense.

The founder-finalized amount is the business truth for payout. The suggestion is an audit and review aid.

### Salary UX Principles

The Salary module should be organized around two calm work modes:

- Review history: weekly, monthly, and custom-date charts for total salary paid, salary due, payment status, and worker-wise payment history.
- Add salary: a guided period setup flow that validates date range, shows overlapping period warnings before creation, generates suggestions, and lets the founder review workers one at a time or in a clean table.

The default page should not show every worker's finalization form and payment form at once. It should show summaries and trends first, then let the founder open a focused period workspace when they are ready to act.

### Salary Guardrails

Salary guardrails should include:

- No overlapping active salary periods for the same tenant unless an admin explicitly resolves the conflict.
- No duplicate salary calculation for the same worker in the same salary period.
- No duplicate salary-paid ledger entry from repeated form submission.
- Payment amount should default to the outstanding amount and warn or block when it exceeds the payable amount.
- Regeneration should preserve founder-finalized values or require an explicit reset/version action.
- Editing should be available for salary period dates before payment, worker final payable, notes, and salary payment records.
- Deleting should generally be soft delete or cancellation, not silent removal.

### Salary Reports

Salary reports should support:

- Period salary report
- Worker salary statement
- Weekly/monthly worker income summary
- Salary paid by payment mode
- Salary payable outstanding
- Salary expense summary for Finance
- Worker-wise paid history over weekly, monthly, and custom ranges
- Salary expense trend over weekly, monthly, and custom ranges
- Period overlap and duplicate-entry review reports for admin correction

## 8.11 Worker Ledger

### Purpose

Track salary advances, loans, repayments, deductions, and salary payments.

### Ledger Transaction Types

- Advance given
- Loan given
- Deduction
- Repayment
- Adjustment
- Salary paid

## 8.12 Finance Module

### Purpose

Track business inflows, outflows, payables, and receivables.

### MVP Includes

- Order payments
- Partial payment tracking
- Expense tracking
- Receivables
- Payables
- Reminders
- Basic finance dashboard
- Salary expense rollup sourced from Salary/Worker Ledger `salary_paid` entries
- GST report view for output GST collected, input GST paid, net GST payable estimate, review exceptions, and XLSX export

### MVP Excludes

- Direct GST filing/e-invoicing integration
- Accounting ledger engine
- Tally integration
- Zoho Books integration
- Bank reconciliation

### Finance and Salary Boundary

Finance should show salary as a clean expense category rollup. Salary payments entered in the Salary module must flow into Finance as Salary expense, grouped by date range and payment mode where useful. Users should not need to enter the same salary expense again in manual expenses, and Finance should avoid creating duplicate salary expense records from salary payments.

### GST Readiness

GST support should help tenants classify sales and expenses without turning OS PLUS into a full statutory accounting system.

Tenant settings should include GST registered status, optional GSTIN, legal business name, registered address, default sales GST rate, default purchase GST rate, and default GST treatment for orders and expenses.

Order creation should keep the staff-facing GST choice simple: GST added on top, GST included in the entered amount, or GST not applied by turning the GST control off. Internal/reporting models may still retain exempt/nil/non-GST treatments for accountant cleanup and future imports. Payment mode and GST treatment are separate; cash collection must still be recorded, and cash does not automatically make a taxable supply non-reportable.

Expense/vendor payment entry should capture vendor invoice details, vendor GSTIN when available, GST treatment, GST rate, taxable amount, GST amount, and whether input GST needs review.

Finance should include a GST report view with date range filters, output GST from orders, input GST from expenses, estimated net GST payable, exceptions needing review, and XLSX export. Before report generation, OS PLUS must ask the tenant to confirm GSTIN, legal business name, registered address, and reporting period.

The first GST report implementation should be accountant-handoff XLSX only. It should use existing order numbers as the reference. Dedicated GST invoice numbering and GST portal upload formats are later enhancements.

Detailed planning is captured in `docs/12_GST_SaaS_Billing_and_Market_Positioning.md`.

## 8.13 Customer Tracking Page

### Purpose

Give customers a secure public page to view order progress.

### Access

- Public token-based link
- No customer login required

### Customer Can See

- Store logo
- Store name
- Order number
- Order date
- Expected delivery date
- Overall progress
- Item-wise status
- Delivery or pickup type
- Customer-visible photos
- Contact CTA

### Customer Cannot See

- Worker names
- Internal notes
- Salary data
- Work logs
- Internal attachments
- Internal delay reasons unless explicitly exposed

## 8.14 Transactional Communications Module

### Purpose

Allow each tenant to send controlled customer transaction messages for order progress, tracking links, pickup/delivery readiness, and payment reminders over WhatsApp and email.

This is not a marketing campaign system. It is a tenant-scoped operational communication layer tied to customers, orders, order items, customer-facing statuses, payments, and receivables.

### Channels

- WhatsApp
- Email

### MVP Communication Rules

- Customer phone and email remain optional.
- A message can only be sent to contact details stored on a customer that belongs to the current tenant.
- A tenant can configure whether WhatsApp and/or email is enabled.
- Each tenant eventually needs its own WhatsApp Business sender and email sender identity.
- The first implementation should store provider settings and message logs without sending live messages until provider credentials are explicitly configured and enabled.
- Staff should be able to preview generated messages before sending.
- Automated triggers must be tenant-scoped and opt-in per tenant.
- Public tracking links can be included in messages, but measurements, worker details, internal notes, salary data, and internal attachments must never be included.
- Every attempted message must be logged with status, trigger source, recipient, channel, and provider response/error where available.
- Failed messages should be visible to staff and retryable when safe.

### Message Trigger Types

Order/status triggers:

- Order created/confirmed
- Customer-facing status changed
- Item ready for pickup
- Item ready for dispatch
- Order partially delivered
- Order delivered

Payment triggers:

- Payment received
- Balance pending after order creation
- Payment reminder before promised delivery
- Overdue payment reminder

Manual triggers:

- Resend tracking link
- Send custom safe note based on an approved template

### Template Requirements

- Templates are tenant-owned.
- Templates must be channel-specific because WhatsApp and email have different rules.
- Templates should support safe variables such as:
  - store name
  - customer name
  - order number
  - promised delivery date
  - customer-facing order/item status
  - pending balance
  - tracking link
- Templates must not support variables that expose internal stage names, worker names, internal notes, measurements, salary, or internal attachment URLs.
- WhatsApp templates may require external provider approval before live sending.

### Tenant Safety

- Communication settings, templates, triggers, and message logs are tenant-owned tables with `tenant_id`.
- Server actions must validate that the customer, order, order item, payment, or receivable being referenced belongs to the current tenant before queueing a message.
- Message logs must never be queryable across tenants.
- Provider credentials must be stored per tenant and never exposed to the client.

### UX Principles

- The default state should be review mode: show what messages are enabled, recent sends, failures, and upcoming reminders.
- Message setup should be behind clear CTAs and focused dialogs.
- Status-triggered messages should be configured in settings, not scattered across production screens.
- Staff should see calm warnings when a customer has no phone/email instead of hard errors.
- Sending should feel auditable and reversible where possible: preview first, then send or queue.

## 8.15 Dashboard Module

### Dashboard Principle

The owner dashboard is the single source of truth for the entire business. It should answer whether the boutique is commercially healthy, whether production is under control, whether workers are productive, and whether finance pressure needs attention.

The dashboard is not a landing page. It is a compact operational command center inspired by ClickUp/Zoho-style business dashboards, with dense cards, charts, lists, and module-specific tabs.

### Dashboard Drilldown Pattern

Every chart or analytics widget should support three levels:

- Dashboard widget: compact summary on the main dashboard.
- Side pane: clicking the widget opens a deeper analysis pane without leaving the dashboard.
- Full analytics page: side pane can open a full page for custom filters, comparisons, and larger tables/charts.

### Main Dashboard Tabs

MVP dashboard should include:

- Overview
- Sales
- Production
- Workers
- Finance
- Alerts

### Sales Dashboard

Sales should answer how much business is being booked and how many orders are coming in.

Required MVP chart:

- Daily sales bar chart
- Toggle between order count and booked order amount
- Default range should be recent business activity
- Drilldown should support daily, monthly, and custom date ranges

Sales metrics:

- Total orders
- Revenue booked from order total
- Amount collected from order payments
- Amount pending from unpaid order balances
- Average order value
- Orders by source/channel later

### Worker Productivity Dashboard

Worker productivity should show whether productive output is balanced across workers.

Required MVP chart:

- Worker productivity line chart
- Default view shows the past 7 days
- Each worker can appear as a separate series
- Full view supports worker checkbox selection, custom date range, and daily/monthly grouping

Productivity counting rule:

- Count `1` when the worker completed the assigned item stage on that day.
- Count `0.5` when the worker started or touched work on an item stage that day but did not complete that stage that day.

This is an MVP productivity signal, not payroll truth. Salary remains separately system-suggested and admin-finalized.

### Production Control Dashboard

Production should answer whether the workshop and workflows are under control.

Required MVP views:

- Stale / at-risk item list
- Stage-level Kanban board view for production items
- Delayed items
- Due-soon items
- Blocked items
- Ready-to-start stages not yet started
- In-progress stages with no recent movement
- Items ready for pickup/dispatch
- Items by workflow/stage

Production Kanban rules:

- Production module should support toggling between list view and board view.
- Board columns represent workflow stages in sequence, with a final synthetic Completed column.
- Items appear in a stage when the current stage instance is ready to start or in progress.
- Items whose workflow is fully complete appear in Completed.
- Cards show item name/description, due urgency, order number, customer name, assigned worker, and status.
- Delayed active items must be visually flagged.
- Cards open the existing workflow side pane for edits; drag-and-drop movement is out of MVP.

Stale and at-risk rules should start simple and become configurable later.

Initial MVP rules:

- At risk: expected completion date is within the next 2 days and item is not completed/delivered.
- Delayed: expected completion date is before today and item is not completed/delivered.
- Stale ready item: current stage is ready to start but has not started after a threshold.
- Stale in-progress item: current stage is in progress but has no recent update after a threshold.

### Finance Dashboard

Finance should answer whether cash and dues need attention without becoming full accounting.

Required MVP views:

- Cash collected today/range
- Expenses paid today/range
- Net cash movement
- Open order receivables derived from order total minus order payments
- Manual receivables and payables
- Upcoming dues
- Overdue receivables/payables
- Simple P&L and balance snapshots

Manual order-linked receivables must not be reintroduced. Worker loans/advances remain sourced from Worker Ledger and can appear later as linked views only.

### Alert / Attention Queue

Dashboard should include a unified attention queue:

- Delayed production
- Stale workflow stages
- Blocked items
- Ready items awaiting handoff
- Overdue receivables
- Overdue payables
- Attendance not marked
- Worker absence/half-day alerts

## 9. At-Risk Logic

### MVP At-Risk Rule

An item is at risk if:

```text
expected_completion_date <= today + 2 days
AND item_status != completed
```

An order is at risk if any item under that order is at risk or delayed.

### Later Advanced Logic

Use:

- Stage SLA
- Current workflow progress
- Historical cycle time
- Worker load
- Order promised delivery date
- Blocked status

## 10. Public Tracking Security

- Tracking tokens must be random and non-guessable.
- Tracking page should never expose tenant admin routes.
- Tracking page should only fetch customer-safe fields.
- Tracking page should not require Clerk login.

## 10A. Production Hardening Before Pilot

Before adding more large product modules, OS PLUS must pass a production hardening phase. The current MVP module set is broad enough for a real boutique pilot; the next priority is trust, tenant safety, role correctness, deployment readiness, and testing.

Hardening requirements:

- Audit every tenant-owned table, route, server action, API route, and query helper for tenant isolation.
- Verify every tenant-owned table has `tenant_id` and appropriate tenant-scoped access patterns.
- Verify users cannot access another tenant's customers, orders, production items, workers, salary, finance, attachments, communications, or settings.
- Improve the business selector for users linked to multiple tenants.
- Add a top-right profile/account menu with current user, current business, role, switch business, and sign out.
- Simplify tenant user status UX to Active and Disabled for MVP.
- Create a multi-sheet QA workbook covering tenant access, roles, isolation, customers, measurements, orders, production, attendance, salary, finance, attachments, communications, public tracking, and deployment smoke tests.
- Use Phantom Threads as the main test bed.
- Create one clean new boutique tenant as a production-style onboarding rehearsal.

## 11. Future Roadmap

### Phase 2

- Shopify integration
- WhatsApp Cloud API
- Vendor master
- Basic import/export
- Super-admin tenant billing/payment tracking
- GST configuration, order/expense GST capture, and GST report exports

### Phase 3

- Inventory management
- QR/barcode labels
- OCR for measurement cards
- Advanced attendance device/API integrations

### Phase 4

- Direct GST filing/e-invoicing and accounting integrations
- Tally/Zoho Books integration
- Advanced analytics
- Custom domains
- Worker self-login

### Internal garment-type identity and production filtering

- An item type may have one optional emoji chosen by an owner/admin at creation or edit time.
- The emoji is presentation metadata only: it never changes workflow, pricing, contribution, finance, or reporting behavior.
- Authenticated internal order and production surfaces show the emoji; a neutral garment icon is used when it is blank.
- Public tracking never exposes the emoji field.
- The Production queue supports multi-select garment-type filtering alongside workflow, queue, search, and list/board view.
- Changing any production filter preserves every other active filter and view parameter.

### Successful modal actions

- Configuration edit and attachment-add dialogs close only after the server action succeeds.
- While saving, the dialog cannot close and duplicate submission remains blocked by the global pending-action layer.
- A failed save leaves the dialog and entered data visible with recoverable error feedback.
