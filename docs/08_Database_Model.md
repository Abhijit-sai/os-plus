# OS PLUS Database Model

## 1. Common Rules

Every tenant-owned table must include:

```text
tenant_id
created_at
updated_at
created_by
updated_by
deleted_at
```

Use soft delete for operational records.

## 2. SaaS Tables

## tenants

```text
id
name
slug
store_name
logo_url
brand_color
legal_name
registered_address
gst_registered
gstin
default_sales_gst_rate
default_purchase_gst_rate
default_order_gst_treatment
default_expense_gst_treatment
status
custom_domain
tracking_subdomain
created_at
updated_at
```

## tenant_users

```text
id
tenant_id
clerk_user_id
role
status
invited_by
created_at
updated_at
```

## tenant_billing_records

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

Roles:

```text
owner_admin
manager
finance
viewer
```

## 3. Configuration Tables

## item_types

```text
id
tenant_id
name
description
default_workflow_id
default_sla_days
is_active
created_at
updated_at
deleted_at
```

Default values:

- Shirt
- Pant
- Kurtha
- Blazer

## stage_master

```text
id
tenant_id
name
description
default_customer_status_id
is_active
created_at
updated_at
deleted_at
```

## customer_statuses

```text
id
tenant_id
name
description
sort_order
is_final_status
is_active
created_at
updated_at
deleted_at
```

## workflows

```text
id
tenant_id
name
description
item_type_id nullable
is_default
is_active
created_at
updated_at
deleted_at
```

## workflow_stages

```text
id
tenant_id
workflow_id
stage_master_id
sequence_number
is_mandatory
expected_duration_hours
customer_status_id
requires_attachment
allows_multiple_workers
parent_stage_id nullable
parallel_group_id nullable
dependency_type nullable
is_active
created_at
updated_at
deleted_at
```

Note:

MVP uses only sequential flow through `sequence_number`. `parent_stage_id`, `parallel_group_id`, and `dependency_type` are reserved for future parallel workflow support.

`create_workflow_configuration` inserts the workflow, ordered active stage rows, default flags, and item-type default pointer in one tenant-locked transaction. `replace_workflow_stage_sequence` locks the workflow, validates all active tenant-owned stage/status references, soft-deletes the prior active sequence, and inserts the replacement atomically. `update_workflow_configuration` locks the workflow and qualifying active stage-master rows through commit, then rejects activation without an active stage. `update_stage_configuration` uses the same workflow-then-stage order, locks affected active workflows, and rejects deactivation when the stage is their last active stage. This prevents simultaneous activation/deactivation from committing an active workflow with no usable stage.

## workgroups

```text
id
tenant_id
name
description
is_active
created_at
updated_at
deleted_at
```

## stage_workgroups

```text
id
tenant_id
stage_master_id
workgroup_id
created_at
```

## payment_modes

```text
id
tenant_id
name
description
is_active
created_at
updated_at
deleted_at
```

## tenant_gst_rates

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

GST treatments used by orders and expenses:

```text
taxable_exclusive
taxable_inclusive
exempt_or_nil
non_gst
not_applicable
```

Default values:

- Cash
- UPI
- Shopify
- Bank Transfer
- Card
- Other

## expense_categories

```text
id
tenant_id
name
is_default
is_active
created_at
updated_at
deleted_at
```

Default values:

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

## 4. Customer Tables

## customers

```text
id
tenant_id
name mandatory
phone optional
normalized_phone_e164 optional
email optional
gender optional
address optional
notes optional
created_at
updated_at
created_by
updated_by
deleted_at
```

Customer rules:

- Name is mandatory.
- Phone number is optional.
- Email is optional.
- Gender is optional.
- When present, valid Indian and explicitly identified international numbers are normalized to canonical E.164.
- Active customers in the same tenant must not be created with the same normalized mobile number; saving resolves and selects the existing customer instead.
- The server performs the duplicate check for every create path and writes `normalized_phone_e164`.
- A completed read-only audit found no active legacy collisions. A partial unique index on `(tenant_id, normalized_phone_e164)` for active rows enforces the invariant under concurrent imports and webhooks.
- Keep an index on `tenant_id, phone` for suggestion lookup.

## customer_external_identities

```text
id
tenant_id
customer_id
provider
external_customer_id
source_metadata_json
created_at
updated_at
created_by
updated_by
deleted_at
```

Rules:

- Active `(tenant_id, provider, external_customer_id)` is unique.
- Customer and identity must share the same tenant through a composite foreign key.
- Shopify totals, order counts, tags, tax flags, and marketing flags may be retained in `source_metadata_json`, but reports and messaging must not consume them yet.
- External identity matching never crosses tenant boundaries.

## customer_imports

```text
id
tenant_id
file_name
file_hash
preview_fingerprint
idempotency_key
source_row_count
created_count
reused_count
updated_count
address_count
invalid_count
skipped_count
result_json
created_by
created_at
```

Rules:

- Preview creates no receipt and performs no writes.
- Confirmation validates the tenant and normalized payload and writes customers, blank-field enrichment, addresses, identities, metadata, and one receipt in one transaction.
- Reusing an idempotency key with the same fingerprints returns the stored result; fingerprint mismatch is rejected.
- Receipts are immutable except approved parent-tenant cascade cleanup.

## customer_measurements

```text
id
tenant_id
customer_id
item_type_id
reference_name
measurement_data_json
notes
photo_url
is_default
created_at
updated_at
created_by
updated_by
deleted_at
```

Example `measurement_data_json`:

```json
{
  "chest": "40",
  "shoulder": "18",
  "sleeve": "24",
  "length": "29"
}
```

`item_type_id` is immutable after creation. Changing the item-type identity requires a new measurement record so existing order-item references remain compatible.

## item_type_measurement_fields

Tenant-level configuration table for standard measurement fields per garment/item type.

```text
id
tenant_id
item_type_id
field_key
field_label
unit
sort_order
is_required
help_text
is_active
created_at
updated_at
created_by
updated_by
deleted_at
```

Rules:

- `tenant_id` is mandatory.
- Fields are scoped to one tenant and one item type.
- `item_type_id` and `field_key` are immutable after creation.
- Deactivating a field must not remove historical customer measurement values.

## item_type_standard_sizes

Tenant-level standard size templates per garment/item type. These are named combinations of measurement values, such as XS, S, M, L, XL, 38, or 40.

```text
id
tenant_id
item_type_id
size_label
measurement_data_json
sort_order
is_active
created_at
updated_at
created_by
updated_by
deleted_at
```

Rules:

- `tenant_id` is mandatory.
- Standard sizes are scoped to one tenant and one item type.
- `item_type_id` is immutable after creation.
- `measurement_data_json` stores values against `item_type_measurement_fields.field_key`.
- Standard sizes do not depend on a selected customer.
- Public customer tracking must not expose standard size measurements.

## 5. Order Tables

## orders

```text
id
tenant_id
order_number
source
customer_id
order_date
promised_delivery_date
delivery_type
delivery_address
subtotal
discount_amount
gst_treatment
gst_rate
taxable_amount
gst_amount
total_amount
amount_paid
payment_status
order_status
notes
tracking_token
created_at
updated_at
created_by
updated_by
deleted_at
```

GST notes:

- `gst_treatment` snapshots the order-level GST decision at creation time.
- `gst_rate` is the percentage used for this order.
- `taxable_amount` and `gst_amount` are server-calculated from item totals, discounts, treatment, and rate.
- `total_amount` remains the amount receivable from the customer. For GST-exclusive orders it includes GST added on top. For GST-inclusive orders it is the entered commercial amount with GST backed out into `taxable_amount` and `gst_amount`.
- Dedicated GST invoice numbering is later; existing `order_number` is the first accountant-handoff report reference.

Order sources:

```text
walk_in
shopify_manual
whatsapp
other
```

Payment statuses:

```text
unpaid
partially_paid
paid
refunded
```

Delivery types:

```text
store_pickup
self_delivery
courier
```

## order_items

```text
id
tenant_id
order_id
item_type_id
customer_measurement_id
standard_size_id
name
description
color
quantity
unit_price
discount_amount
final_price
workflow_id
expected_completion_date
delivery_type_override
item_status
customer_status_id
is_customer_visible
final_photo_url
notes
created_at
updated_at
created_by
updated_by
deleted_at
```

Fit reference rules:

- An order item may reference a customer measurement, a standard size, or neither.
- Customer measurement references must belong to the order customer and current tenant.
- Standard size references must belong to the order item's item type and current tenant.
- Public customer tracking must not expose either measurement reference.

Item statuses:

```text
not_started
in_production
blocked
completed
ready_for_pickup
ready_for_dispatch
dispatched
delivered
cancelled
```

## order_payments

```text
id
tenant_id
order_id
amount
payment_mode
payment_account
payment_date
reference_number
notes
created_by
created_at
updated_at
deleted_at
```

## order_payment_corrections

```text
id
tenant_id
order_id
payment_id
reason
old_value_json
new_value_json
created_by
created_at
```

Rules:

- `record_order_payment` locks the tenant-owned order and validates the payment total before inserting and updating the commercial payment summary.
- `correct_order_payment` locks the same order, updates the payment, records old/new values plus actor and reason, and updates the summary atomically.
- Direct update or deletion of correction records is blocked by an immutability trigger; parent-tenant/order cascade cleanup remains possible.

## 6. Workflow Execution Tables

## item_workflow_instances

```text
id
tenant_id
order_item_id
workflow_id
status
started_at
completed_at
current_stage_instance_id
created_at
updated_at
created_by
updated_by
deleted_at
```

Statuses:

```text
not_started
in_progress
completed
cancelled
```

## item_stage_instances

```text
id
tenant_id
workflow_instance_id
order_item_id
workflow_stage_id
stage_master_id
sequence_number
status
planned_start_at
planned_end_at
started_at
completed_at
customer_status_id
notes
effort_tracking_mode_snapshot
contribution_rule_id_snapshot
contribution_method_snapshot
contribution_rate_snapshot
contribution_allocation_basis_snapshot
contribution_item_value_snapshot
contribution_pool_snapshot
contribution_revision
created_at
updated_at
created_by
updated_by
deleted_at
```

Stage statuses:

```text
not_started
ready_to_start
in_progress
paused
completed
skipped
blocked
```

## item_stage_work_logs

```text
id
tenant_id
stage_instance_id
order_item_id
worker_id
workgroup_id
started_at
paused_at
resumed_at
completed_at
duration_minutes
credited_units
credited_minutes
calculated_contribution_amount
status
notes
created_by
created_at
updated_at
deleted_at
```

`duration_minutes` is elapsed work-log time. `credited_minutes` is manually attributed worker effort and may sum above stage elapsed time when several workers contribute concurrently.

`credited_units` uses 0.10 increments. Percentage pools are allocated in integer paise using largest remainder ordered by fractional remainder, then stable worker/workgroup IDs. A tenant/completion/worker partial index supports completed-work reports; active logs remain excluded.

A status-only completion transition is excluded from contribution-correction audit creation. Final item delivery uses the mapped customer status's explicit `is_final_status` flag, never a configurable label match.

## item_type_stage_contribution_rules

```text
id
tenant_id
item_type_id
stage_master_id
calculation_method
rate_value
percentage_allocation_basis
is_active
created_at
updated_at
created_by
updated_by
deleted_at
```

Calculation methods:

```text
per_unit
per_hour
percentage
```

Rules:

- One active rule exists per tenant/item-type/stage.
- Percentage values are between 0 and 100 and use the item post-discount, pre-GST value.
- Percentage rules distribute one pool by credited units or credited hours.
- Rules are configuration only; stage-instance snapshots are the historical source of truth.

## item_stage_contribution_corrections

```text
id
tenant_id
stage_instance_id
order_item_id
reason
old_value_json
new_value_json
created_by
created_at
```

Correction rows are immutable. They preserve removed effort and all before/after assignment values without changing salary or finance history.

## item_history

```text
id
tenant_id
order_item_id
event_type
old_value_json
new_value_json
notes
created_by
created_at
```

Event examples:

- workflow_assigned
- stage_started
- stage_paused
- stage_resumed
- stage_completed
- worker_assigned
- due_date_changed
- customer_status_changed
- photo_added
- note_added
- item_blocked
- item_unblocked

## attachments

```text
id
tenant_id
entity_type
entity_id
file_url
file_type
storage_bucket
storage_path
file_size_bytes
label
notes
is_customer_visible
uploaded_by
created_at
updated_at
created_by
updated_by
deleted_at
```

Entity types:

```text
customer
measurement
order
order_item
stage_instance
worker
expense
```

## 6A. Transactional Communications Tables

## communication_channel_settings

Tenant-owned channel setup for WhatsApp and email.

```text
id
tenant_id
channel
provider
mode
is_enabled
sender_name
sender_address
reply_to
provider_config_json
created_at
updated_at
created_by
updated_by
deleted_at
```

Channels:

```text
whatsapp
email
```

Modes:

```text
disabled
sandbox
live
```

Rules:

- Each tenant can have its own WhatsApp and email configuration.
- Provider secrets must not be exposed to the browser.
- Live sending is allowed only when the tenant channel is enabled and mode is `live`.
- Sandbox/dry-run sending must log messages without contacting customers.

## communication_templates

Tenant-owned transactional message templates.

```text
id
tenant_id
channel
purpose
name
subject
body_text
body_html
provider_template_name
safe_variables
is_active
created_at
updated_at
created_by
updated_by
deleted_at
```

Purposes:

```text
order_update
tracking_link
payment_received
payment_reminder
pickup_ready
dispatch_ready
delivery_update
custom_safe_note
```

Rules:

- Templates are tenant-scoped and channel-specific.
- WhatsApp templates can map to externally approved provider template names.
- Templates may use only safe customer-facing variables.
- Templates must not expose measurements, internal notes, worker names, salary, or internal attachments.

## communication_trigger_rules

Tenant-owned opt-in trigger rules.

```text
id
tenant_id
trigger_type
channel
template_id
delay_minutes
is_enabled
created_at
updated_at
created_by
updated_by
deleted_at
```

Trigger types:

```text
order_confirmed
customer_status_changed
pickup_ready
dispatch_ready
order_partially_delivered
order_delivered
payment_received
balance_pending
payment_reminder_before_delivery
payment_overdue
manual_tracking_link
manual_payment_reminder
```

Rules:

- Trigger rules are disabled by default until a tenant intentionally enables them.
- Trigger rule execution must validate that referenced customers, orders, order items, payments, and receivables belong to the same tenant.
- Repeated action submissions should not create duplicate sends for the same trigger event.

## communication_message_queue

Tenant-owned rendered message queue.

```text
id
tenant_id
channel
customer_id
order_id
order_item_id
receivable_payable_id
template_id
trigger_rule_id
trigger_type
trigger_event_key
recipient_name
recipient_phone
recipient_email
subject
body_text
body_html
status
scheduled_for
sent_at
attempt_count
provider_message_id
provider_response_json
last_error
created_at
updated_at
created_by
updated_by
deleted_at
```

Statuses:

```text
queued
sending
sent
failed
skipped
cancelled
```

Rules:

- Queued messages store rendered customer-safe content for auditability.
- WhatsApp messages require `recipient_phone`; email messages require `recipient_email`.
- `trigger_event_key` should be used for idempotency on automatic triggers.
- Failed messages should remain visible and retryable when safe.

## communication_message_logs

Tenant-owned audit trail for message lifecycle events.

```text
id
tenant_id
message_queue_id
event_type
old_status
new_status
notes
provider_response_json
created_by
created_at
```

Event types:

```text
queued
previewed
sent
failed
retried
skipped
cancelled
provider_update
```

## 7. Worker, Attendance and Salary Tables

## workers

```text
id
tenant_id
name
phone
joining_date
status
primary_workgroup_id
wage_type
wage_amount
notes
created_at
updated_at
created_by
updated_by
deleted_at
```

Wage types:

```text
hourly
daily
weekly
monthly
per_piece
hybrid
```

## worker_workgroups

```text
id
tenant_id
worker_id
workgroup_id
created_at
```

## attendance

```text
id
tenant_id
worker_id
attendance_date
status
check_in_time
check_out_time
total_hours
marked_by
notes
created_at
updated_at
deleted_at
```

Attendance statuses:

```text
present
absent
half_day
leave
holiday
```

## attendance_imports

```text
id
tenant_id
file_name
file_hash
report_month
idempotency_key
source_row_count
inserted_count
updated_count
skipped_count
result_json
created_by
created_at
```

Rules:

- One idempotency key is unique per tenant.
- `file_hash` is the lowercase SHA-256 fingerprint confirmed after preview.
- Import receipts are immutable service-role audit records protected by RLS and a database trigger that blocks direct update or deletion.
- `import_attendance_rows` validates tenant-owned active workers, rejects future or duplicate worker/date rows, and inserts or updates attendance in one database transaction.
- Unmatched, ambiguous, future, blank, and unknown-status source rows are summarized but never written to `attendance`.

## worker_ledger

```text
id
tenant_id
worker_id
transaction_type
amount
transaction_date
description
linked_salary_period_id
created_by
created_at
updated_at
deleted_at
```

Transaction types:

```text
advance_given
loan_given
deduction
repayment
adjustment
salary_paid
```

## salary_periods

```text
id
tenant_id
period_start
period_end
status
created_by
created_at
updated_at
deleted_at
```

Rules:

- Active salary periods should not overlap for the same tenant.
- Period dates should be editable while no salary payment has been recorded for the period.
- Period cancellation should use soft delete or cancelled state rather than silent removal.

Statuses:

```text
draft
reviewed
finalized
paid
```

## salary_calculations

```text
id
tenant_id
salary_period_id
worker_id
attendance_days
attendance_hours
productive_minutes
gross_suggested_amount
advance_deduction
manual_adjustment
final_payable
amount_paid
payment_status
payment_date
payment_mode
notes
created_at
updated_at
created_by
updated_by
deleted_at
```

Rules:

- There should be only one active salary calculation for each tenant, salary period, and worker.
- Founder-finalized payable fields must be preserved when suggestions are regenerated unless the user explicitly resets or versions the calculation.
- Edits to finalized payable amounts and notes should update audit fields.
- Payment progress should be derived from linked salary-paid ledger entries or kept synchronized with them.

## salary payment ledger entries

Salary payments are stored in `worker_ledger` with transaction type `salary_paid`.

Rules:

- Each salary payment must include `tenant_id`, `worker_id`, `transaction_date`, `amount`, and `linked_salary_period_id`.
- Salary payment entries may include `payment_mode_id`.
- Repeated submissions should not create duplicate salary-paid entries.
- Finance consumes these entries as Salary expense rollups; it should not create duplicate manual expense rows for the same salary payment.

## 8. Finance Tables

## expenses

```text
id
tenant_id
expense_date
category_id
amount
payment_mode_id
paid_to
vendor_gstin
vendor_invoice_number
vendor_invoice_date
gst_treatment
gst_rate
taxable_amount
gst_amount
input_gst_status
description
receipt_url
is_recurring
created_by
created_at
updated_at
deleted_at
```

Expense GST notes:

- `amount` remains the actual cash/payment amount recorded for the expense.
- `gst_treatment`, `gst_rate`, `taxable_amount`, and `gst_amount` snapshot the expense GST classification at entry time.
- For GST-inclusive expenses, `gst_amount` is backed out of `amount`.
- For GST-exclusive expenses, `amount` is treated as the taxable base; GST is recorded separately for reporting, but the current cash-out amount remains whatever the user entered.
- `input_gst_status` supports accountant handoff: `not_applicable`, `claimable`, `needs_review`, or `not_claimed`.
- Payment mode remains separate from GST treatment.

## receivables_payables

```text
id
tenant_id
type
party_name
amount
due_date
status
description
linked_order_id
created_by
created_at
updated_at
deleted_at
```

Types:

```text
receivable
payable
```

Statuses:

```text
open
partially_paid
paid
cancelled
overdue
```

## 9. Suggested Indexes

```text
tenants.slug
tenant_users.clerk_user_id
tenant_users.tenant_id
tenant_billing_records.tenant_id, tenant_billing_records.payment_status
tenant_billing_records.tenant_id, tenant_billing_records.billing_period_end
tenant_gst_rates.tenant_id, tenant_gst_rates.is_active
customers.tenant_id, customers.phone
customers.tenant_id, customers.name
orders.tenant_id, orders.order_number
orders.tenant_id, orders.customer_id
orders.tenant_id, orders.promised_delivery_date
orders.tenant_id, orders.order_date
orders.tenant_id, orders.gst_treatment
order_items.tenant_id, order_items.order_id
order_items.tenant_id, order_items.expected_completion_date
order_items.tenant_id, order_items.item_status
item_stage_instances.tenant_id, item_stage_instances.order_item_id
item_stage_work_logs.tenant_id, item_stage_work_logs.worker_id
attendance.tenant_id, attendance.worker_id, attendance.attendance_date
worker_ledger.tenant_id, worker_ledger.worker_id
expenses.tenant_id, expenses.expense_date
expenses.tenant_id, expenses.gst_treatment
expenses.tenant_id, expenses.input_gst_status
receivables_payables.tenant_id, receivables_payables.due_date
communication_channel_settings.tenant_id, communication_channel_settings.channel
communication_templates.tenant_id, communication_templates.channel, communication_templates.purpose
communication_trigger_rules.tenant_id, communication_trigger_rules.trigger_type
communication_message_queue.tenant_id, communication_message_queue.status, communication_message_queue.scheduled_for
communication_message_queue.tenant_id, communication_message_queue.customer_id
communication_message_queue.tenant_id, communication_message_queue.order_id
communication_message_logs.tenant_id, communication_message_logs.message_queue_id
```

### `item_types.icon_emoji`

- Nullable `text`; optional internal presentation metadata.
- Database constraint trims and bounds values to 1-16 characters when present.
- The server action performs the stronger one-grapheme emoji validation.
