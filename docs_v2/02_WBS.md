# OS PLUS V2 Work Breakdown Structure

## 1. Delivery Philosophy

V2 is delivered in controlled phases.

Every phase must:

1. open with a documented scope;
2. use a dedicated phase branch unless explicitly approved otherwise;
3. update root `project_summary.md` after every major coding session;
4. remain open until automated and manual QA are complete;
5. include Boutique regression where shared code/data is touched;
6. close only through the Phase Gate policy;
7. commit phase completion only after closure evidence is recorded.

Phase statuses:

```text
PLANNED
IN_PROGRESS
QA_BLOCKED
READY_FOR_CLOSURE
CLOSED
```

## V2-0 Baseline, Documentation and Compatibility Gate

### Goal

Create a safe foundation before changing the live product architecture.

### Tasks

#### Documentation

- Add `/docs_v2`
- Add all V2 planning documents
- Update future Codex startup process to read `docs_v2`
- Preserve root `project_summary.md` as the only living summary
- Do not reactivate archived `docs/05_Project_Summary.md`

#### Current Baseline

- Confirm current default branch and local branch strategy
- Apply/confirm all current required migrations in local development
- Run current scripts:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:roles`
- Record current Boutique core smoke behaviour
- Record current public tracking behaviour
- Record current payment behaviour
- Record current communication sandbox behaviour

#### Test Foundation

- Add an approved TypeScript test runner
- Add `test:v2` script
- Add test database strategy or isolated deterministic domain-test strategy
- Add initial compatibility tests
- Create/maintain `OS_PLUS_V2_QA_Test_Matrix.xlsx`

#### Boutique Regression Tier A

Prove:

- tenant sign-in/selection;
- Boutique customer create/search;
- Boutique order creation;
- item-level workflow initialization;
- stage start/complete;
- customer status tracking;
- payment recording;
- public tracking;
- finance/GST read;
- communication dry-run queue.

### Deliverable

A documented, tested current baseline with V2 phase-gate discipline.

### Exit Criteria

No V2 domain schema is introduced before baseline evidence exists.

---

## V2-1 Vertical Context, Locations, Addresses and Teams

### Goal

Add additive platform primitives required by Laundry.

### Schema Tasks

- Add `vertical_definitions`
- Add `tenant_verticals`
- Seed:
  - `boutique`
  - `laundry`
- Backfill existing active tenants to `boutique`
- Add `tenant_locations`
- Add `customer_addresses`
- Add `teams`
- Add `team_members`

### Application Tasks

- Add tenant vertical capability helper
- Add location configuration UI
- Add customer address UI
- Add Teams configuration UI
- Keep current role enum unchanged
- Hide Laundry-only navigation from Boutique-only tenants
- Add Fundry Laundry vertical configuration

### Compatibility Tasks

- Do not remove `customers.address`
- Do not alter existing Boutique order forms
- Do not alter existing Boutique route defaults
- Validate current tenant selector and permissions

### Tests

- existing tenant backfill;
- vertical isolation;
- Laundry-only route/capability guard;
- location tenant isolation;
- address tenant/customer ownership;
- team membership tenant isolation;
- Boutique Tier A regression.

### Deliverable

OS Plus explicitly understands Boutique and Laundry tenants and has first-class Locations, Customer Addresses, and Teams.

---

## V2-2 V2 Commercial Lines and Parallel Work Unit Runtime

### Goal

Introduce the additive generic runtime for Laundry/future verticals.

### Schema Tasks

- Add `order_lines`
- Add `work_units`
- Add `work_unit_workflow_instances`
- Add `work_unit_stage_instances`
- Add `work_unit_stage_work_logs`
- Add `orders.vertical_key`
- Add `orders.runtime_model`
- Backfill existing orders:
  - `vertical_key = boutique`
  - `runtime_model = legacy_item_v1`

### Workflow Tasks

- Reuse existing:
  - `workflows`
  - `workflow_stages`
  - `stage_master`
  - `customer_statuses`
  - `workgroups`
  - `stage_workgroups`
- Create Work Unit workflow initialization
- Create Work Unit stage transition logic
- Preserve sequential workflow behaviour
- Preserve future parallel fields
- Do not use label-name heuristics for fulfilment

### Read Compatibility

- Add shared operational projection/adapter only where needed
- Existing Boutique pages continue reading legacy item runtime
- Laundry pages read Work Unit runtime

### Tests

- Work Unit workflow initialization
- stage sequence
- workgroup validation
- invalid transitions
- tenant isolation
- Boutique legacy runtime unchanged

### Deliverable

Laundry can use the current configurable workflow definitions through a new Work Unit runtime.

---

## V2-3 Commands, Domain Events, Idempotency and Tasks

### Goal

Create safe business-state mutation primitives.

### Command Foundation

- Add Command Context:
  - tenant ID;
  - actor type;
  - actor ID;
  - source;
  - correlation ID;
  - optional idempotency key.
- Add Domain Command registry/pattern
- Add consistent result/error model
- Add business validation at command boundary

### Atomicity

- Implement critical multi-row operations in database transactions
- Use Postgres functions/RPC or another reviewed atomic pattern
- Do not treat `Promise.all` as a transaction

### Events

- Add `domain_events`
- Add optional `event_outbox`
- Emit append-only domain events from commands
- Preserve current-state tables as source of current truth
- Preserve Boutique `item_history`

### Tasks

- Add `tasks`
- Add `task_history`
- Add user/team assignment
- Add due dates and priority
- Add task queue UI
- Add initial task commands

### Initial Commands

- `CreateTask`
- `AssignTask`
- `StartTask`
- `CompleteTask`
- `CancelTask`
- V2 workflow stage commands
- foundational custody commands as stubs/tests where appropriate

### Tests

- idempotent repeated command;
- command tenant context;
- cross-tenant mutation rejected;
- atomic rollback;
- event written with successful command;
- no event on rolled-back command;
- task assignment;
- task history.

### Deliverable

Important V2 mutations use a controlled domain layer rather than long interface-specific orchestration.

---

## V2-4 Laundry Pickup, Container Assets, Handling Units and Custody

### Goal

Establish digital demand and chain of custody.

### Schema

- Add `laundry_pickup_requests`
- Add `laundry_container_assets`
- Add `laundry_handling_units`
- Add `laundry_custody_events`
- Add `laundry_service_lots`
- Add Laundry service/unit configuration required for launch

### B2C Pickup

- Create Pickup Request UI
- customer lookup/create
- saved address selection
- pickup source
- requested date/window
- pickup queue
- assignment
- completion

### Handling Units

- generate tenant-scoped human code
- generate opaque QR token
- support types:
  - BAG
  - COVER
  - SHOE_PACKET
  - CARPET
  - CURTAIN_BUNDLE
  - OTHER
- establish initial custody event

### Container Assets

- permanent reusable code
- permanent QR
- optional assigned B2B customer
- active/inactive/lost/maintenance state

### Service Lots

- create one or more Service Lots inside a Handling Unit
- link to Work Unit
- link to Order Line
- service type
- quantity
- unit
- piece count
- weight
- instructions

### Tests

- pickup creation;
- duplicate pickup rules;
- complete pickup atomicity;
- Handling Unit code uniqueness;
- QR token uniqueness;
- custody history;
- Container Asset reuse;
- multi-Service-Lot handling unit;
- Boutique Tier A regression.

### Deliverable

Fundry can digitally record pickup, physical identity, intake and custody.

---

## V2-5 QR Scan Runtime and Transfer Manifests

### Goal

Move routine operational updates from full-form entry to guided scanning.

### QR Runtime

- Add `/scan/q/[token]`
- Resolve opaque QR token
- require authenticated operational context for mutation
- resolve tenant ownership
- resolve entity type
- compute allowed actions server-side
- show one primary action
- confirm command
- show current state/success
- support human-code fallback search

### Scan Types

- Handling Unit QR
- Container Asset QR

### Manifest Schema

- Add `laundry_transfer_manifests`
- Add `laundry_manifest_units`

### Manifest Flow

- create manifest
- select from/to locations
- scan/add expected Handling Units
- dispatch
- receive by scan
- calculate variance
- list missing units
- create investigation task

### Tests

- token does not expose raw identifiers;
- anonymous scan cannot mutate;
- cross-tenant scan blocked;
- stale action rejected;
- double submit idempotent;
- manifest exact receive;
- manifest missing unit;
- unexpected unit;
- repeated receipt;
- Boutique Tier A regression.

### Deliverable

Fundry can scan physical units through location handoffs and detect missing bags on the same day.

---

## V2-6 Laundry Production, Readiness, Fulfilment and Tracking

### Goal

Run Laundry Service Lots through configurable Work Unit workflows.

### Production

- Laundry production queue
- Service Lot/Work Unit detail
- QR-driven primary stage action
- stage start
- stage completion
- block/problem
- batch action design for repetitive flows
- preserve workgroup restrictions where worker logging is used

### Production State

Use V2 production states:

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
PRODUCTION_COMPLETE
CANCELLED
```

### Readiness

- evaluate required Work Units
- emit `order.ready_for_fulfilment`
- create delivery/store-pickup task
- show Ready queue

### Fulfilment

- separate fulfilment state
- delivery assignment
- store pickup
- tenant delivery
- delivery completion
- no workflow-stage-name delivery heuristic

### Tracking

- adapt public tracking to Laundry V2 runtime
- show safe Service Lot summary
- show simplified customer statuses
- hide internal custody/worker data

### Communications

- adapt existing rendering context for V2 order summary
- queue tracking-link order confirmation
- preserve provider-neutral communication tables
- remain sandbox until live provider phase

### Tests

- configured custom Laundry workflow;
- stage execution;
- blocked work;
- production completion;
- readiness calculation;
- fulfilment separation;
- tracking data safety;
- outbound message queue;
- Boutique tracking regression.

### Deliverable

A B2C Laundry order can move from intake through configured production to ready and fulfilment, with live public tracking.

---

## V2-7 Invoice, Payments, Allocation and UPI Payment Intent

### Goal

Move V2 Laundry commercial truth into explicit billing objects.

### Schema

- Add `invoices`
- Add `invoice_lines`
- Add `invoice_counters`
- Add `payments`
- Add `payment_allocations`
- Add `payment_intents`

### Invoice

- create draft
- build from order lines
- finalise
- immutable commercial snapshot
- generate invoice number
- calculate GST
- track balance from allocations
- invoice detail
- invoice PDF only where required

### Payments

- record cash/UPI/bank payment
- allow unallocated payment
- allocate to one/more invoices
- derive invoice payment state
- prevent over-allocation

### UPI

- tenant UPI settings
- Pay Now CTA
- QR
- unique UPI payment-intent reference
- prefilled pending amount
- do not mark paid on redirect
- manual confirmation/recording

### Compatibility

- do not replace Boutique `order_payments`
- Boutique Finance and GST stay functional
- do not change current Boutique payment form

### Tests

- invoice numbering;
- GST;
- finalisation immutability;
- partial allocation;
- one payment/multiple invoices;
- unallocated payment;
- over-allocation blocked;
- duplicate payment-intent reference blocked;
- UPI URI encoding;
- tracking Pay Now visibility;
- Boutique finance regression.

### Deliverable

Laundry billing and receivables are first-class in OS Plus with a safe pre-Razorpay UPI intent.

---

## V2-8 B2B Hostel Collection Batch

### Goal

Digitize Fundry hostel intake and bulk invoicing.

### Schema

- Add `laundry_collection_batches`
- Add `laundry_collection_batch_units`
- Add `laundry_verifications`

### Collection

- create open batch for hostel customer
- scan permanent Container Asset bags
- create per-bag Handling Unit cycle
- capture resident name
- room
- declared pieces
- pickup verified pieces
- weight
- card photo
- discrepancy indicator

### Commercial Creation

- one Collection Batch creates one Order
- one bag creates:
  - Handling Unit cycle;
  - Service Lot;
  - Work Unit;
  - Order Line.
- final invoice:
  - one Invoice;
  - one Invoice Line per bag.

### Verification

- preserve every checkpoint
- display declared vs pickup vs workshop vs final
- no overwrite of prior count

### Return

- manifest/fulfilment back to hostel
- verify all expected bag cycles
- close batch only when required conditions satisfied

### Tests

- reuse same permanent bag across two batches;
- one batch one order;
- 20 bags one invoice;
- duplicate bag in same open batch blocked;
- verification snapshots preserved;
- variance surfaced;
- invoice line mapping;
- collection close guards.

### Deliverable

Fundry can process a hostel collection with bag-level traceability and one bulk commercial invoice.

---

## V2-9 Live WhatsApp Provider and Conversations

### Goal

Take the existing communications foundation live and add inbound conversation records.

### Provider Adapter

- Meta WhatsApp provider adapter
- tenant channel credentials/secrets
- inbound webhook ingestion
- outbound queue worker
- provider message status updates
- idempotent webhook storage
- retry policy
- failed-message visibility

### Conversation Layer

- Add `channel_connections`
- Add `conversations`
- Add `conversation_messages`
- add customer identity resolution
- human assignment
- AI mode state:
  - AUTO
  - ASSIST
  - HUMAN
  - PAUSED

### Initial Automation

- order confirmation with tracking link
- order update
- ready
- payment reminder

### Tests

- tenant phone/account resolution;
- outbound idempotency;
- inbound duplicate webhook;
- customer resolution;
- customer-safe content;
- human handoff.

### Deliverable

Fundry's tenant WhatsApp connection is integrated with OS Plus conversations and operational context.

---

## V2-10 Agent Runtime

### Goal

Use AI only at unstructured/ambiguous edges.

### Foundation

- Add agent definitions
- Add agent runs
- Add context snapshots
- Add proposed commands
- Add tool/command call audit
- Add risk policy

### Initial Intents

- `CREATE_PICKUP_REQUEST`
- `ORDER_STATUS`
- `BUSINESS_FAQ`

### Cost Waterfall

1. deterministic/rules;
2. lightweight intent extraction;
3. contextual reasoning;
4. human.

### Policy

- low-risk commands may auto-execute through Domain Commands
- high-risk commands require human approval
- agent never directly writes arbitrary domain tables

### Tests

- same-address pickup;
- duplicate pickup protection;
- order status grounding;
- low-confidence handoff;
- complaint handoff;
- cross-tenant context isolation;
- agent command uses same validation as UI.

### Deliverable

A limited, grounded WhatsApp agent that creates pickups and answers real operational status.

---

## V2-11 Integrations and Finance Intelligence

### Goal

Add trusted payment and downstream integration adapters.

### Razorpay

- Orders/Payment Link adapter
- webhook verification
- raw webhook event storage
- idempotent processing
- Payment creation
- exact allocation

### Zoho

- customer sync
- invoice sync
- payment sync
- external references
- sync record
- retry dashboard

### Telegram

- optional tenant ops bot
- exception alerts
- buttons invoke Domain Commands

### Payment Reconciliation

- transaction ingestion
- deterministic matching
- candidate scoring
- AI fuzzy recommendation
- finance approval queue
- suspense payments

### Deliverable

Trusted payment rails and downstream accounting/ops adapters.

---

## V2-12 Rollout, Hardening and Optional Boutique Convergence Review

### Goal

Stabilize Laundry and decide whether any Boutique internals should converge onto V2.

### Tasks

- full regression
- performance review
- security/tenant isolation review
- QR token review
- migration review
- production rollout runbook
- Fundry pilot
- operational observation
- exception backlog
- document actual workflow changes

### Boutique Convergence Decision

After Laundry V2 proves stable, evaluate:

```text
Option A:
Keep Boutique legacy runtime indefinitely behind a common projection.

Option B:
Migrate new Boutique orders to Work Unit V2 while preserving historical orders.

Option C:
Backfill historical Boutique data through a controlled migration.
```

Do not make this decision before evidence exists.

### Deliverable

Stable Fundry Laundry production use and a documented architecture decision on future Boutique convergence.
