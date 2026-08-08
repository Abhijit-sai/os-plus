# OS PLUS V2 Technical Development Plan

## 1. Purpose

This document defines how the current OS PLUS repository will be extended for Laundry without breaking the existing Boutique vertical.

The current repository is the implementation baseline.

V2 is an additive architecture program.

## 2. Confirmed Existing Stack

Preserve:

- Next.js 16
- TypeScript
- Clerk authentication
- Supabase Postgres
- Supabase Storage
- Vercel
- Tailwind CSS
- shadcn/ui-style components
- Recharts where already used
- Zod input validation
- feature-oriented source organization

Do not perform a broad framework rewrite as part of Laundry V2.

## 3. Protected Current Architecture

Preserve current Boutique paths:

```text
src/features/orders
src/features/production
src/features/customers
src/features/workers
src/features/attendance
src/features/salary
src/features/finance
src/features/communications
```

Preserve current database runtime for live Boutique records:

```text
orders
order_items
order_payments

item_workflow_instances
item_stage_instances
item_stage_work_logs
item_history
```

Preserve:

- Clerk identity;
- OS Plus tenant membership;
- current role model;
- customer-safe public tracking;
- GST report behaviour;
- existing communication templates/trigger/queue/log foundation.

## 4. Repository Change Strategy

Do not begin by reorganizing the entire repository.

Add new architecture only where a new boundary is needed.

Recommended incremental source additions:

```text
src/
  core/
    commands/
    command-context/
    events/
    idempotency/

  features/
    tasks/
    locations/
    teams/
    billing-v2/

  verticals/
    laundry/
      pickups/
      container-assets/
      handling-units/
      custody/
      service-lots/
      manifests/
      verifications/
      production-batches/
      collection-batches/
      fulfilment/

  integrations/
    whatsapp/
    razorpay/
    zoho/
    telegram/
```

Existing feature folders remain.

Do not rename/move healthy existing modules only to match an architecture diagram.

## 5. Vertical Resolution

### Database

Add:

```text
vertical_definitions
tenant_verticals
```

Seed:

```text
boutique
laundry
```

Backfill existing tenant rows to Boutique.

### Application Helper

Add a server-side capability helper.

Conceptual API:

```ts
const verticals = await getTenantVerticals(context.tenant.id);

assertTenantVertical(verticals, "laundry");
```

For UI:

```ts
hasTenantVertical(verticals, "laundry")
```

### Rule

Vertical/capability checks are server-enforced.

Hiding navigation is UX, not authorization.

## 6. Order Runtime Versioning

Add to `orders`:

```text
vertical_key
runtime_model
```

Initial runtime models:

```text
legacy_item_v1
work_unit_v2
```

Backfill current orders:

```text
vertical_key = boutique
runtime_model = legacy_item_v1
```

Laundry orders:

```text
vertical_key = laundry
runtime_model = work_unit_v2
```

Shared order queries must inspect runtime model before loading operational children.

Do not attempt to load Work Units for a legacy Boutique order unless a reviewed projection supports it.

## 7. Work Unit Runtime

### Definitions

Reuse current configuration tables:

```text
workflows
workflow_stages
stage_master
customer_statuses
workgroups
stage_workgroups
```

Add runtime tables:

```text
work_units
work_unit_workflow_instances
work_unit_stage_instances
work_unit_stage_work_logs
```

### Work Unit

Suggested fields:

```text
id uuid
tenant_id uuid
order_id uuid
order_line_id uuid nullable

vertical_key text
vertical_object_type text
vertical_object_id uuid nullable

display_code text

status work_unit_status
customer_status_id uuid nullable

workflow_id uuid
current_workflow_instance_id uuid nullable
current_location_id uuid nullable

expected_completion_at timestamptz nullable
production_completed_at timestamptz nullable
blocked_reason text nullable

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

### Workflow Initialization

Create a V2 equivalent of `createWorkflowInstanceForOrderItem`.

It must:

1. validate tenant ownership;
2. validate Work Unit;
3. validate workflow;
4. prevent a duplicate active workflow instance;
5. load active configured stages;
6. create workflow instance;
7. create all stage instances;
8. set first stage ready;
9. set current stage;
10. emit a Domain Event.

The operation must be atomic.

Recommended implementation:

- Postgres function/RPC for multi-row transaction; or
- reviewed transaction-capable server data layer.

Do not implement as several independent service-role writes that can partially succeed.

## 8. Command Layer

### Command Context

Every V2 Command receives:

```ts
type CommandContext = {
  tenantId: string;
  actor: {
    type: "USER" | "SYSTEM" | "AGENT" | "WEBHOOK";
    id: string | null;
  };
  source:
    | "OS_PLUS_UI"
    | "QR_SCAN"
    | "WHATSAPP"
    | "TELEGRAM"
    | "API"
    | "WEBHOOK"
    | "AUTOMATION";
  correlationId: string;
  idempotencyKey?: string;
};
```

### Command Interface

Conceptual shape:

```ts
type CommandResult<T> = {
  ok: true;
  data: T;
  eventIds: string[];
};

type CommandError = {
  ok: false;
  code: string;
  message: string;
  currentState?: unknown;
};
```

Actual code style may differ, but the semantics must remain.

### Server Actions

Existing/new UI server actions become interface adapters.

Example:

```text
completeStageAction
  -> resolve tenant/auth
  -> parse input
  -> execute CompleteWorkStageCommand
  -> map result to UI
  -> revalidate UI routes
```

The Server Action must not duplicate domain rules already owned by the command.

### Agent/Webhook

Future interfaces call the same Domain Command.

## 9. Atomic Business Operations

Critical operations must be atomic.

Examples:

### Complete Pickup

Transaction:

```text
validate pickup
update pickup completed
create Handling Unit if required
create custody event
create intake task
create domain event
commit
```

### Receive Manifest

Transaction:

```text
validate manifest
validate expected units
record receipt state
record custody events
calculate variance
create variance task if needed
create domain event(s)
commit
```

### Allocate Payment

Transaction:

```text
validate payment
validate invoice
calculate unallocated payment
calculate invoice balance
insert allocation
update derived summary if stored
emit event
commit
```

If any critical step fails, no partial business state should remain.

## 10. Idempotency

Add an idempotency mechanism before QR/webhooks.

Options:

```text
command_idempotency
```

or a reviewed unique key on Command/Event records.

Suggested fields:

```text
tenant_id
command_type
idempotency_key
request_hash
status
result_json
created_at
completed_at
```

Unique:

```text
tenant_id + command_type + idempotency_key
```

Use for:

- scan double tap;
- poor-network retries;
- webhook duplicates;
- Create Handling Unit cycle from permanent bag QR;
- stage completion;
- manifest receipt;
- payment creation.

An idempotency key is not a substitute for business-state validation.

Both are required.

## 11. Domain Events and Outbox

### Domain Events

Add append-only:

```text
domain_events
```

Suggested fields:

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

Do not update/delete Domain Events during normal business operation.

### Outbox

Add:

```text
event_outbox
```

if event consumers are introduced.

Suggested fields:

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
```

Command transaction writes:

```text
current state
+
domain event
+
outbox row
```

in one transaction.

### V1 Consumer Runtime

Prefer a low-complexity Supabase-native background strategy initially.

Do not introduce Kafka/RabbitMQ/microservices.

A later durable function orchestrator may be adopted if multi-day automation complexity proves it is needed.

## 12. Task Engine

Tables:

```text
tasks
task_history
```

Tasks may target:

```text
pickup_request
handling_unit
manifest
work_unit
order
invoice
payment
delivery
collection_batch
```

Use a subject type/id pattern with strict application validation.

Prefer explicit task type enum/table over free-form strings for high-value operational task types.

Initial task types:

```text
PICKUP
VERIFY_INTAKE
RECEIVE_MANIFEST
INVESTIGATE_VARIANCE
PROCESS_WORK_UNIT
DELIVERY
COLLECT_PAYMENT
RECONCILE_PAYMENT
```

Assignment:

```text
assigned_user_id nullable
assigned_team_id nullable
```

At least one assignment target may be required for assigned status.

Team membership never replaces authorization.

A user must still have the permission needed to execute the underlying Domain Command.

## 13. Laundry Domain Runtime

### Container Asset

Persistent, reusable object.

Example:

```text
BAG-017
```

The same asset can participate in multiple Collection Batches.

### Handling Unit

One custody cycle.

Suggested fields:

```text
id
tenant_id
handling_unit_code
qr_token nullable

container_asset_id nullable

customer_id
order_id nullable

handling_unit_type

current_location_id nullable
custody_status

opened_at
closed_at

created_from_pickup_id nullable
created_from_collection_batch_id nullable

created_at
updated_at
created_by
updated_by
deleted_at
```

### Service Lot

Vertical extension linked to one Work Unit.

Suggested fields:

```text
id
tenant_id
work_unit_id
handling_unit_id
order_line_id

service_catalog_id

quantity
quantity_unit
piece_count
weight_kg

special_instructions

intake_verified_at

created_at
updated_at
created_by
updated_by
deleted_at
```

Do not duplicate workflow-stage state inside Service Lot.

Work Unit runtime owns production state.

## 14. Permanent QR and Handling Cycle Resolution

Container Asset QR resolves the permanent bag.

Scan resolution:

```text
Container Asset
  -> Is there an open Handling Unit cycle for the active context?
       YES -> open current cycle
       NO  -> can the current workflow create a new cycle?
               YES -> command creates cycle
               NO  -> show no legal action
```

For a B2B Collection Batch:

```text
Open Collection Batch
  -> scan BAG-017
  -> lookup Container Asset
  -> check BAG-017 not already added to batch
  -> CreateHandlingCycleFromContainer command
  -> create Handling Unit
  -> add batch unit
```

The next week's batch can scan the same BAG-017 and create a new Handling Unit.

Do not reuse the previous Handling Unit row.

## 15. QR Token Design

### Payload

Recommended:

```text
/scan/q/<opaque-random-token>
```

Token requirements:

- high entropy;
- non-sequential;
- unique;
- no PII;
- no raw UUID.

Store only what is needed for lookup.

Consider a generic registry:

```text
qr_identities

id
tenant_id
token_hash or token
entity_type
entity_id
status
created_at
rotated_at
revoked_at
```

This allows:

- Handling Unit QR;
- Container Asset QR;
- future Work Unit QR.

If token hashes are used, lookup architecture must support indexed secure resolution.

### Human Code

Always display a human-readable code beside QR.

QR is an accelerator.

Human code is the operational fallback.

## 16. Scan Action Resolver

Create server query:

```text
resolveScanContext(token, tenantContext)
```

Return customer-safe-to-operator minimal data:

```ts
{
  entityType,
  displayCode,
  customerLabel,
  orderNumber,
  location,
  currentState,
  serviceLots,
  primaryAction,
  secondaryActions
}
```

The server computes legal actions.

Do not let the browser construct arbitrary next statuses.

Example:

```text
Current stage = Drying
Next configured stage = Steam Iron

Allowed primary action:
Complete Drying
```

After completion, the command may prepare the next stage according to configured workflow rules.

## 17. Billing V2

### Order Lines

Suggested fields:

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

tax_treatment
tax_rate

estimated_amount nullable
final_amount nullable

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

### Invoices

Commercial snapshot separate from orders.

Initial schema may support one primary invoice per Laundry order in the UI while keeping data model extensible.

### Payments

Suggested:

```text
payments

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

### Allocations

```text
payment_allocations

id
tenant_id
payment_id
invoice_id
amount
allocated_at
created_by
created_at
deleted_at
```

Constraints:

- allocation amount > 0;
- sum active allocations <= payment amount;
- sum active allocations to invoice cannot make paid amount exceed invoice total unless a future explicit credit/overpayment flow exists.

Implement these checks transactionally.

## 18. UPI Payment Intent

Tenant config:

```text
upi_enabled
upi_vpa
upi_payee_name
upi_merchant_code nullable
tracking_pay_now_enabled
```

Prefer a dedicated settings table if payment-provider configuration is likely to expand.

Payment Intent:

```text
id
tenant_id
invoice_id
reference
amount
currency
status
upi_uri
created_at
expires_at nullable
```

Generate a unique reference.

Example:

```text
UPI-ORD-001281-X7K2
```

Conceptual URI parameters:

```text
pa = tenant VPA
pn = payee name
mc = optional merchant code
tr = unique payment-intent reference
tn = invoice/order context
am = pending amount
cu = INR
```

The Pay Now action opens the intent.

QR encodes the same intent.

Do not update Payment/Invoice state from browser return alone.

## 19. Public Tracking Runtime Adapter

Current public tracking reads legacy Boutique order items.

V2 must preserve that path.

Recommended query boundary:

```text
getPublicTrackingView(trackingToken)
```

Internally:

```text
load order
  -> inspect runtime_model
      -> legacy_item_v1
          -> legacy Boutique tracking adapter
      -> work_unit_v2
          -> V2 Work Unit/Laundry tracking adapter
  -> return one safe TrackingView DTO
```

The public page renders the DTO.

This isolates the UI from runtime-specific database tables.

The same pattern is recommended for shared Control Room/analytics projections.

## 20. Communications Extension

Preserve:

```text
communication_channel_settings
communication_templates
communication_trigger_rules
communication_message_queue
communication_message_logs
```

Extend rendering/query context to use the runtime-neutral tracking/order DTO where possible.

For live inbound messaging later add:

```text
channel_connections
provider_webhook_events
conversations
conversation_messages
```

Do not overload `communication_message_queue` into a conversation store.

It is an outbound rendered-message queue and audit record.

## 21. Tenant Security

The repository currently uses the Supabase service-role client in server code and relies heavily on explicit tenant filtering.

V2 must preserve application tenant validation and add database defence in depth for new critical tables.

For new V2 tenant-owned tables:

- include `tenant_id`;
- enable RLS;
- create reviewed RLS policies where a user-scoped client will access tables;
- enforce tenant ownership in Domain Commands;
- where practical, use composite tenant ownership foreign keys.

Example:

```text
UNIQUE (tenant_id, id)
```

Child:

```text
FOREIGN KEY (tenant_id, order_id)
REFERENCES orders (tenant_id, id)
```

This prevents a child row from being attached to another tenant's parent even when service-role code is used.

Do not assume RLS protects service-role operations.

## 22. Testing Strategy

V2 requires more than typecheck/lint/build.

Add a TypeScript test runner in V2-0.

Test layers:

### Unit/Domain

- pricing;
- state transition;
- payment allocation;
- UPI URI creation;
- action resolver;
- readiness calculation.

### Database/Integration

- tenant constraints;
- transaction rollback;
- idempotency;
- manifest receive;
- Handling Unit cycle creation;
- payment allocation.

### Compatibility

- Boutique Tier A regression.

### Manual Local QA

- QR camera/browser;
- public tracking;
- long forms;
- mobile view;
- multi-user tenant flow;
- real workflow configuration.

The QA workbook is part of the phase evidence.

## 23. Phase Branch and Commit Model

Recommended branch naming:

```text
v2/phase-0-baseline
v2/phase-1-platform-primitives
v2/phase-2-work-unit-runtime
v2/phase-3-commands-events-tasks
v2/phase-4-laundry-custody
...
```

For each phase:

1. branch from reviewed base;
2. verify clean working tree;
3. read V2 docs;
4. record phase start in `project_summary.md`;
5. build locally;
6. update summary after each major session;
7. run checks;
8. execute QA matrix;
9. fix defects;
10. rerun failed and affected regression;
11. review migration and diff;
12. mark `READY_FOR_CLOSURE`;
13. final closure check;
14. write closure evidence to `project_summary.md`;
15. commit phase.

Do not commit an incomplete phase by default.

## 24. Immediate Implementation Sequence

The next coding session starts with V2-0 only.

Do not create Laundry database tables until:

- baseline scripts pass;
- current Boutique Tier A behaviour is recorded;
- the V2 test runner is configured;
- compatibility tests exist;
- local migration status is known.

This is deliberate.

The cost of one extra baseline session is far lower than debugging whether a future Laundry change broke a live Boutique workflow.
