# OS PLUS V2 Database Delta Model

## 1. Purpose

This document defines additive V2 database changes.

It does not replace `docs/08_Database_Model.md` for the current live system.

Current Boutique tables remain part of the supported model.

## 2. Common V2 Tenant-Owned Columns

Unless explicitly documented otherwise, V2 tenant-owned operational tables should include:

```text
id
tenant_id

created_at
updated_at

created_by
updated_by

deleted_at
```

Operational records use soft delete where deletion is valid.

Append-only audit/event tables may omit `updated_at`, `updated_by`, and `deleted_at`.

## 3. Tenant Ownership Constraints

For critical V2 parent-child relationships, prefer:

Parent:

```sql
UNIQUE (tenant_id, id)
```

Child:

```sql
FOREIGN KEY (tenant_id, parent_id)
REFERENCES parent_table (tenant_id, id)
```

This is database defence in depth for service-role operations.

Every migration must review whether composite tenant foreign keys are practical.

## 4. Vertical Tables

## `vertical_definitions`

Platform-owned.

```text
id
key unique
name
description
is_active
created_at
updated_at
```

Seed:

```text
boutique
laundry
```

## `tenant_verticals`

```text
id
tenant_id
vertical_definition_id
is_enabled
enabled_at
created_at
updated_at
created_by
updated_by
```

Unique active relationship:

```text
tenant_id + vertical_definition_id
```

## 5. Location Tables

## `tenant_locations`

```text
id
tenant_id

code
name
location_type

address_line_1
address_line_2
area
city
state
postal_code
country_code

is_active

created_at
updated_at
created_by
updated_by
deleted_at
```

Suggested `location_type`:

```text
store
workshop
warehouse
office
other
```

Do not model drivers as permanent tenant locations in first launch.

Custody actor/type may represent a person/transfer separately.

Unique active code per tenant.

## 6. Customer Address Table

## `customer_addresses`

```text
id
tenant_id
customer_id

label

address_line_1
address_line_2
area
city
state
postal_code
country_code

landmark
notes

is_default
source

created_at
updated_at
created_by
updated_by
deleted_at
```

Source examples:

```text
manual
legacy_customer_address
whatsapp
pickup
```

Rules:

- Address belongs to same tenant as Customer.
- One active default per Customer.
- Existing `customers.address` remains during compatibility phase.

## 7. Team Tables

## `teams`

```text
id
tenant_id

name
code
description

location_id nullable

is_active

created_at
updated_at
created_by
updated_by
deleted_at
```

## `team_members`

```text
id
tenant_id
team_id
tenant_user_id

is_active

created_at
created_by
deleted_at
```

Rules:

- Team, member and tenant user must share tenant.
- Team membership is operational assignment only.
- Role permission remains separately enforced.

## 8. Order V2 Extensions

Add to `orders`:

```text
vertical_key
runtime_model
```

Suggested check/runtime values:

```text
legacy_item_v1
work_unit_v2
```

Backfill current rows:

```text
vertical_key = boutique
runtime_model = legacy_item_v1
```

Do not make columns NOT NULL until backfill is complete and verified.

## 9. Order Lines

## `order_lines`

```text
id
tenant_id
order_id

line_type

name
description

quantity
quantity_unit
unit_price
discount_amount

gst_treatment
gst_rate

estimated_amount
final_amount

source_vertical_key
source_object_type
source_object_id

sort_order

created_at
updated_at
created_by
updated_by
deleted_at
```

Suggested `line_type`:

```text
service
product
fee
discount
other
```

Rules:

- Order Line is commercial.
- Production state does not belong here.
- `source_*` provides traceability to vertical object such as Laundry Service Lot.
- Do not use `source_object_id` without validating tenant ownership in commands.

## 10. Work Unit Runtime

## `work_units`

```text
id
tenant_id

order_id
order_line_id nullable

vertical_key
vertical_object_type
vertical_object_id nullable

display_code

workflow_id
current_workflow_instance_id nullable

status
customer_status_id nullable

current_location_id nullable

expected_completion_at nullable
production_completed_at nullable
blocked_reason nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Status:

```text
not_started
in_progress
blocked
production_complete
cancelled
```

Indexes:

```text
tenant_id, order_id
tenant_id, status
tenant_id, expected_completion_at
tenant_id, current_location_id
tenant_id, workflow_id
```

## `work_unit_workflow_instances`

```text
id
tenant_id

work_unit_id
workflow_id

status

started_at
completed_at
current_stage_instance_id nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Status:

```text
not_started
in_progress
completed
cancelled
```

Only one active instance per Work Unit in initial scope.

## `work_unit_stage_instances`

```text
id
tenant_id

workflow_instance_id
work_unit_id

workflow_stage_id
stage_master_id

sequence_number

status

planned_start_at
planned_end_at

started_at
completed_at

customer_status_id nullable
notes nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Status reuses current semantics:

```text
not_started
ready_to_start
in_progress
paused
completed
skipped
blocked
```

## `work_unit_stage_work_logs`

```text
id
tenant_id

stage_instance_id
work_unit_id

worker_id
workgroup_id

started_at
paused_at
resumed_at
completed_at

duration_minutes
status
notes

created_at
updated_at
created_by
deleted_at
```

Use current item work-log behaviour as the compatibility reference.

## 11. Command Idempotency

## `command_idempotency`

```text
id
tenant_id

command_type
idempotency_key
request_hash

status
result_json
error_json

created_at
completed_at
```

Status:

```text
processing
completed
failed
```

Unique:

```text
tenant_id
command_type
idempotency_key
```

Rules:

- Repeated completed key returns/reuses result where safe.
- Same key with different request hash is rejected.
- Recovery policy for stuck `processing` must be explicit.

## 12. Domain Events

## `domain_events`

Append-only.

```text
id
tenant_id

event_type

aggregate_type
aggregate_id

actor_type
actor_id
source

correlation_id
causation_event_id nullable

payload_json

occurred_at
```

Indexes:

```text
tenant_id, occurred_at
tenant_id, event_type, occurred_at
tenant_id, aggregate_type, aggregate_id, occurred_at
correlation_id
```

## `event_outbox`

```text
id
tenant_id
domain_event_id

topic
payload_json

status
attempt_count

available_at
processed_at
last_error

created_at
updated_at
```

Status:

```text
pending
processing
processed
failed
cancelled
```

Unique:

```text
domain_event_id + topic
```

where one consumer/topic delivery is expected.

## 13. Task Tables

## `tasks`

```text
id
tenant_id

task_type

title
description

subject_type
subject_id

assigned_user_id nullable
assigned_team_id nullable

priority
status

due_at nullable
started_at nullable
completed_at nullable

source
source_event_id nullable
automation_rule_id nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Priority:

```text
LOW
NORMAL
HIGH
CRITICAL
```

Status:

```text
OPEN
ASSIGNED
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
```

Indexes:

```text
tenant_id, status, due_at
tenant_id, assigned_user_id, status
tenant_id, assigned_team_id, status
tenant_id, task_type, status
tenant_id, subject_type, subject_id
```

## `task_history`

Append-only.

```text
id
tenant_id
task_id

event_type
old_value_json
new_value_json

actor_type
actor_id
source

notes

created_at
```

## 14. Laundry Pickup

## `laundry_pickup_requests`

```text
id
tenant_id

customer_id
pickup_address_id nullable

requested_date
requested_window

source
status

assigned_user_id nullable
assigned_team_id nullable

scheduled_at nullable
assigned_at nullable
arrived_at nullable
completed_at nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Source:

```text
whatsapp
call
manual
web
recurring
other
```

Status:

```text
NEW
SCHEDULED
ASSIGNED
OUT_FOR_PICKUP
PICKED_UP
FAILED
CANCELLED
```

## 15. Laundry Container Assets

## `laundry_container_assets`

```text
id
tenant_id

container_code
qr_identity_id

container_type

assigned_customer_id nullable

status
notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Container type:

```text
bag
cover
box
other
```

Status:

```text
active
lost
maintenance
retired
```

Unique active `container_code` per tenant.

Important:

This is the reusable physical bag.

Do not attach a workflow to Container Asset.

## 16. QR Registry

## `qr_identities`

```text
id
tenant_id

token
entity_type
entity_id

status

created_at
rotated_at nullable
revoked_at nullable
created_by
```

Status:

```text
active
revoked
rotated
```

Initial entity types:

```text
laundry_container_asset
laundry_handling_unit
```

Rules:

- token is opaque/random;
- unique globally or at minimum safely resolvable;
- no PII;
- QR URL contains token, not raw entity ID.

## 17. Laundry Handling Units

## `laundry_handling_units`

```text
id
tenant_id

handling_unit_code
qr_identity_id nullable

container_asset_id nullable

customer_id
order_id nullable

handling_unit_type

current_location_id nullable
custody_status

created_from_pickup_id nullable
created_from_collection_batch_id nullable

opened_at
closed_at nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Handling unit type:

```text
bag
cover
shoe_packet
carpet
curtain_bundle
other
```

Unique active human code per tenant.

## `laundry_custody_events`

Append-only.

```text
id
tenant_id

handling_unit_id

event_type

from_location_id nullable
to_location_id nullable

from_custody_type nullable
from_custody_id nullable

to_custody_type nullable
to_custody_id nullable

manifest_id nullable

actor_type
actor_id
source

notes
payload_json

occurred_at
```

Event examples:

```text
custody_established
picked_up
received_at_location
dispatched_in_manifest
received_from_manifest
out_for_fulfilment
returned_to_customer
exception_recorded
```

## 18. Laundry Service Lots

## `laundry_service_catalog`

A tenant-owned Laundry service definition.

```text
id
tenant_id

name
code
description

default_workflow_id
default_sla_hours nullable
default_quantity_unit

allows_weight
allows_piece_count

is_active

created_at
updated_at
created_by
updated_by
deleted_at
```

## `laundry_service_lots`

```text
id
tenant_id

work_unit_id
handling_unit_id
order_line_id

service_catalog_id

quantity
quantity_unit

piece_count nullable
weight_kg nullable

special_instructions nullable

intake_verified_at nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Rules:

- one Service Lot -> one Work Unit in initial scope;
- Service Lot and Work Unit share tenant;
- Service Lot and Handling Unit share tenant;
- do not store current stage here.

## 19. Transfer Manifests

## `laundry_transfer_manifests`

```text
id
tenant_id

manifest_code

from_location_id
to_location_id

status

expected_unit_count
received_unit_count
variance_count

dispatched_at nullable
received_at nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Status:

```text
DRAFT
DISPATCHED
PARTIALLY_RECEIVED
RECEIVED
VARIANCE
CANCELLED
```

## `laundry_manifest_units`

```text
id
tenant_id

manifest_id
handling_unit_id

expected_at_dispatch
received

received_at nullable
received_by nullable

receipt_notes nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Unique active:

```text
manifest_id + handling_unit_id
```

## 20. Production Batches

## `laundry_production_batches`

```text
id
tenant_id

batch_code
batch_type

location_id
status

started_at nullable
completed_at nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

## `laundry_production_batch_members`

```text
id
tenant_id

production_batch_id
work_unit_id

status
result_notes nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

## 21. Fulfilment

## `fulfilments`

```text
id
tenant_id

order_id

fulfilment_type
status

assigned_user_id nullable
assigned_team_id nullable

scheduled_at nullable
started_at nullable
completed_at nullable

delivery_address_id nullable
delivery_address_snapshot nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Type:

```text
store_pickup
tenant_delivery
courier
other
```

Status:

```text
PENDING
ASSIGNED
OUT_FOR_FULFILMENT
COMPLETED
FAILED
CANCELLED
```

## `fulfilment_units`

Optional if partial fulfilment is enabled.

```text
id
tenant_id
fulfilment_id
work_unit_id nullable
handling_unit_id nullable
created_at
created_by
deleted_at
```

## 22. V2 Invoice Tables

## `invoice_counters`

Tenant/FY-aware invoice numbering.

Exact GST/fiscal numbering strategy must be confirmed before production invoice issue.

Suggested:

```text
id
tenant_id
financial_year
prefix
last_number
updated_at
```

## `invoices`

```text
id
tenant_id

invoice_number

customer_id
order_id nullable

invoice_date
due_date nullable

status

subtotal
discount_amount

gst_treatment
gst_rate
taxable_amount
gst_amount

total_amount

amount_paid
balance_due

finalised_at nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

Status:

```text
DRAFT
FINALISED
PARTIALLY_PAID
PAID
VOID
REFUNDED
```

`amount_paid` and `balance_due` may be stored projections only if kept transactionally consistent with allocations.

## `invoice_lines`

```text
id
tenant_id
invoice_id

order_line_id nullable

name
description

quantity
quantity_unit
unit_price
discount_amount

gst_treatment
gst_rate
taxable_amount
gst_amount

line_total

sort_order

source_vertical_key
source_object_type
source_object_id

created_at
created_by
deleted_at
```

Finalised invoice lines are snapshots.

## 23. V2 Payment Tables

## `payments`

```text
id
tenant_id

customer_id nullable

amount
currency

payment_mode_id nullable

provider
provider_payment_id nullable

payment_date
payer_reference nullable

status
reconciliation_status

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Status:

```text
RECORDED
CONFIRMED
REVERSED
REFUNDED
```

Reconciliation:

```text
UNALLOCATED
PARTIALLY_ALLOCATED
ALLOCATED
NEEDS_REVIEW
```

## `payment_allocations`

```text
id
tenant_id

payment_id
invoice_id

amount

allocated_at
allocated_by

notes

created_at
deleted_at
```

Unique rules depend on whether multiple allocation rows to same invoice are allowed.

The transaction must validate aggregate allocation amounts.

## 24. Payment Intents

## `payment_intents`

```text
id
tenant_id

invoice_id

provider
reference

amount
currency

status

upi_uri nullable

created_at
expires_at nullable
completed_at nullable

created_by
```

Provider initial:

```text
upi_intent
```

Status:

```text
ACTIVE
EXPIRED
CANCELLED
CONSUMED
```

`CONSUMED` should only be used after linked/verified payment handling is defined.

Do not infer it from browser return.

## 25. Tenant UPI Settings

Recommended dedicated table:

## `tenant_payment_settings`

```text
id
tenant_id

upi_enabled
upi_vpa
upi_payee_name
upi_merchant_code nullable

tracking_pay_now_enabled

created_at
updated_at
created_by
updated_by
deleted_at
```

Provider secrets for future integrations should use secure secret storage/reference patterns and not be exposed in browser-readable configuration.

## 26. B2B Collection Batch

## `laundry_collection_batches`

```text
id
tenant_id

batch_code

customer_id
order_id nullable

collection_date
collection_location_text nullable

status

expected_container_count nullable
collected_unit_count

confirmed_at nullable
closed_at nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Status:

```text
DRAFT
OPEN
CONFIRMED
IN_PROCESS
READY_FOR_RETURN
CLOSED
CANCELLED
```

## `laundry_collection_batch_units`

```text
id
tenant_id

collection_batch_id

container_asset_id
handling_unit_id

resident_name nullable
room_number nullable

declared_piece_count nullable
pickup_verified_piece_count nullable
pickup_weight_kg nullable

source_card_attachment_id nullable

order_line_id nullable
service_lot_id nullable
work_unit_id nullable

notes

created_at
updated_at
created_by
updated_by
deleted_at
```

Unique active:

```text
collection_batch_id + container_asset_id
```

This blocks scanning the same permanent bag twice into one open batch.

## `laundry_verifications`

Append-only observation records.

```text
id
tenant_id

handling_unit_id

verification_type
location_id nullable

piece_count nullable
weight_kg nullable

attachment_id nullable

verified_by
verified_at

notes

created_at
```

Verification type:

```text
CUSTOMER_DECLARED
HOSTEL_PICKUP_VERIFIED
STORE_INTAKE
WORKSHOP_INTAKE
PRE_PACK
FINAL_PACK
```

Do not update a prior verification to match a later count.

## 27. Future Communication/Agent Tables

Not required before the live WhatsApp phase.

## `channel_connections`

Tenant provider account connection.

## `provider_webhook_events`

Raw/idempotent provider webhook ingestion.

## `conversations`

Customer/channel conversation identity and assignment.

## `conversation_messages`

Inbound/outbound conversation messages.

## `agent_definitions`

Tenant/platform agent configuration.

## `agent_runs`

One interpreted execution.

## `agent_context_snapshots`

Structured context used for a run.

## `agent_proposed_commands`

Command proposal, confidence and policy result.

## 28. Migration Safety Rules

1. One phase-scoped migration set at a time.
2. Migrations are versioned and reviewed.
3. Backfills are idempotent where practical.
4. Add nullable columns before backfill/NOT NULL where needed.
5. Do not drop legacy Boutique columns during Laundry launch.
6. Do not rename legacy tables during Laundry launch.
7. Generated `src/types/database.ts` changes require typecheck and shared-feature review.
8. Seed migrations respect tenant-owned custom values.
9. Large backfills must log/count affected rows during local review.
10. Every phase records applied migration names in `project_summary.md`.
