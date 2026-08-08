# OS PLUS V2 Product Requirements Document

## 1. Product Name

**OS PLUS**

Working description:

> A configurable multi-tenant WorkOS for human-driven physical businesses where customer commitments move through operational stages, people, locations, and fulfilment.

## 2. V2 Product Context

OS PLUS currently supports the Boutique vertical and has live clients.

The current product already manages:

- tenants and tenant users;
- customers;
- orders;
- order items;
- configurable stages and workflows;
- production execution;
- workers and workgroups;
- attendance;
- salary suggestions;
- expenses and operational finance;
- partial order payments;
- GST configuration and reporting;
- public customer tracking;
- provider-neutral transactional communication configuration and queueing.

V2 must preserve current Boutique functionality and add Laundry as a second vertical.

Fundry is the first Laundry tenant and the operational proving ground for the new runtime.

## 3. V2 Product Goal

V2 must answer five business questions continuously:

1. **What did the customer request?**
2. **Which physical units are in our custody and where are they?**
3. **What work has been completed and what must happen next?**
4. **What is ready, pending fulfilment, delivered, or at risk?**
5. **What was billed, what money was received, and what remains unpaid?**

The system must reduce dependence on human memory and informal WhatsApp coordination.

## 4. Compatibility Goal

The Boutique vertical is a protected compatibility contract.

V2 must not require an immediate migration of live Boutique orders from:

```text
orders
order_items
item_workflow_instances
item_stage_instances
item_stage_work_logs
item_history
```

to the new Work Unit runtime.

Existing Boutique routes, forms, workflows, public tracking, finance, GST, attendance, salary, and communication foundations must continue to work.

V2 is additive unless a migration has:

- a documented compatibility plan;
- automated regression coverage;
- local Boutique QA evidence;
- a reversible migration strategy.

## 5. V2 Product Principles

### 5.1 Configuration remains tenant-owned

Tenants continue to configure:

- Item/Service masters
- Stage Master
- Customer-facing statuses
- Workflows
- Workflow stage sequence
- Expected stage duration
- Workgroups
- Stage-to-workgroup mapping
- Payment modes
- Expense categories

Laundry must use the existing workflow-definition philosophy.

The platform must not hardcode:

```text
Wash -> Dry -> Iron -> Pack
```

as the only Laundry process.

A tenant may configure:

```text
Wash -> Hydro Extract -> Tumble Dry -> Steam Iron -> QC -> Pack
```

Another may configure:

```text
Pre Check -> Dry Clean -> Spot Treatment -> Finish -> QC
```

The runtime executes configured stages.

### 5.2 Workflow definitions are reusable; runtime objects differ

The current Boutique runtime remains supported.

New verticals use a V2 Work Unit runtime.

A Work Unit is:

> The smallest independently processable operational unit that owns one configured workflow execution.

Examples:

- Boutique: garment/item
- Laundry: service lot
- Future vehicle service: job
- Future print production: print lot

### 5.3 Commercial line and operational work are not universally the same object

V2 introduces:

```text
Order Line = commercial line
Work Unit = operational production unit
```

A commercial line may map to one or more Work Units.

For the first Fundry Laundry flows, one Laundry service lot normally maps to one order line and one Work Unit.

The schema must allow future 1:N operational splitting.

### 5.4 Physical custody is separate from production

Laundry introduces physical Handling Units.

Examples:

- bag;
- garment cover;
- shoe packet;
- carpet;
- curtain bundle.

A Handling Unit answers:

> Which physical package are we responsible for right now?

A Service Lot answers:

> Which service is being processed through a workflow?

One Handling Unit may contain multiple Service Lots.

### 5.5 Permanent reusable container identity is separate from a service cycle

For B2B hostel bags, the permanent physical bag may be reused weekly.

Therefore:

```text
Container Asset = BAG-001, permanent reusable bag
Handling Unit = BAG-001's custody cycle for one order/collection
```

The permanent QR belongs to the Container Asset.

Scanning that QR during a new Collection Batch may create a new Handling Unit cycle.

Historical handling cycles remain immutable.

### 5.6 State and tasks are different

State answers:

> What is true?

Task answers:

> What must somebody do?

Example:

```text
State:
Handling Unit received at Workshop

Task:
Verify workshop intake for FND-0042
```

Tasks are first-class V2 objects.

### 5.7 Workers should not need a full application workflow for routine movement

Ground operations must prioritize:

```text
scan
  -> see the identified unit
  -> see the next legal action
  -> tap/confirm
```

Do not require a worker to:

- search orders;
- remember order numbers;
- navigate complex dashboards;
- fill long forms;
- understand technical workflow terminology.

### 5.8 Production and fulfilment are separate

Production completion must not automatically mean delivered.

V2 separates:

```text
Work Unit production state
```

from:

```text
Order fulfilment/delivery state
```

Do not infer delivery by checking whether a stage label contains words such as `deliver` or `handoff`.

### 5.9 OS PLUS owns operational and commercial truth

For V2 Laundry:

OS PLUS should own:

- Order
- Order Lines
- Work Units
- operational custody
- workflow execution
- invoice
- invoice lines
- payment record
- payment allocation
- payment status
- fulfilment state

A future accounting adapter may send final commercial events to Zoho Books or another accounting system.

OS PLUS does not become a full general ledger in V2.

## 6. Supported Verticals

### 6.1 Boutique

Current live vertical.

Existing behaviour must be preserved.

### 6.2 Laundry

New V2 vertical.

Initial Fundry use cases:

- B2C pickup request
- walk-in order
- B2C handling-unit custody
- store-to-workshop transfer
- configured production workflow
- scan-driven stage movement
- ready queue
- delivery/fulfilment
- customer tracking
- invoice
- UPI payment intent
- payment confirmation
- B2B hostel reusable bag collection
- B2B collection batch
- bag-level tracking under one Order and one Invoice

## 7. Personas

### OS PLUS Super Admin

Manages:

- tenant creation;
- tenant status;
- tenant profile;
- tenant billing;
- tenant vertical enablement.

### Owner/Admin

Full tenant visibility.

Primary needs:

- Control Room;
- operational risks;
- pending pickups;
- missing handling units;
- production SLA;
- ready undelivered;
- billing and unpaid amounts.

### Manager

Operates:

- orders;
- customers;
- pickup;
- intake;
- manifests;
- production;
- fulfilment;
- attendance.

### Finance

Operates:

- invoices;
- payments;
- payment allocation;
- receivables;
- salary;
- expenses;
- GST reporting.

### Operational Worker

Not necessarily a system login user.

Routine experience should be managed by scan stations or manager-operated scan flows.

### Delivery Partner

V1 can use a limited mobile operational surface or manager-assisted assignment.

Do not require general tenant administration access.

### Customer

Uses public tracking link.

No login required.

## 8. Core V2 Platform Requirements

### 8.1 Tenant vertical enablement

The system must explicitly know which verticals are enabled for a tenant.

Initial keys:

```text
boutique
laundry
```

Existing tenants must be backfilled to `boutique`.

Fundry must be configured as `laundry`.

Do not infer tenant vertical from tenant name, slug, item type names, or workflows.

### 8.2 Tenant locations

Add first-class locations.

Examples:

- KPHB Store
- Nallagandla Store
- Central Workshop

Location records must support:

- name;
- code;
- location type;
- address;
- active/inactive state.

Operational custody and V2 work views may reference a current location.

### 8.3 Customer addresses

Customers may have multiple addresses.

Required use case:

> "same address"

A customer address should have a human label such as:

- Home
- Office
- Hostel
- Flat 1103

One address may be default.

Existing `customers.address` remains compatible during migration.

### 8.4 Teams

Authorization roles remain:

```text
owner_admin
manager
finance
viewer
```

V2 adds operational Teams.

Examples:

- KPHB Store Ops
- Nallagandla Store Ops
- Workshop Intake
- Workshop Production
- Delivery
- Finance Ops

Roles answer:

> What is this user allowed to do?

Teams answer:

> Which operational work should reach this user?

### 8.5 Tasks

Tasks must support:

- task type;
- title;
- description;
- subject type/id;
- assigned user;
- assigned team;
- priority;
- status;
- due time;
- source;
- source event;
- automation rule reference;
- audit history.

Task statuses:

```text
OPEN
ASSIGNED
IN_PROGRESS
BLOCKED
COMPLETED
CANCELLED
```

### 8.6 Domain Commands

Important V2 business state changes must be executed through Domain Commands.

Initial commands include:

```text
CreatePickupRequest
AssignPickup
CompletePickup
CreateHandlingUnit
ReceiveHandlingUnit
VerifyIntake
CreateTransferManifest
DispatchManifest
ReceiveManifest
StartWorkStage
CompleteWorkStage
BlockWorkUnit
CompleteProduction
CreateDeliveryTask
CompleteDelivery
FinaliseInvoice
CreatePayment
AllocatePayment
ApprovePaymentMatch
```

The same command may be invoked from:

- OS Plus UI;
- QR scan;
- future WhatsApp agent;
- Telegram;
- webhook;
- API.

Business rules remain in the command/domain layer.

### 8.7 Domain Events

Commands emit append-only Domain Events.

Examples:

```text
pickup.requested
pickup.assigned
pickup.completed

handling_unit.created
handling_unit.received
handling_unit.location_changed

manifest.dispatched
manifest.received
manifest.variance_detected

work_unit.stage_started
work_unit.stage_completed
work_unit.blocked
work_unit.production_completed

order.ready_for_fulfilment

invoice.finalised

payment.recorded
payment.allocated
payment.unmatched

delivery.assigned
delivery.completed
```

Current-state tables remain the source of current truth.

V2 is not full event sourcing.

## 9. Laundry B2C Requirements

### 9.1 Pickup request

Pickup requests can originate from:

- call;
- WhatsApp;
- manual staff entry;
- future web form;
- future agent.

Required fields:

- customer;
- pickup address;
- requested date;
- requested time window;
- source;
- status;
- assignment;
- notes.

### 9.2 Pickup task

Creating a pickup request should create or trigger a Pickup Task according to tenant automation rules.

### 9.3 Physical identity

At pickup or intake, each physical package receives a Handling Unit identity.

Required:

- system ID;
- tenant-scoped human code;
- opaque QR token;
- handling unit type;
- customer;
- order;
- current location/custody status.

### 9.4 Intake

At intake, staff may create one or more Service Lots from the Handling Unit.

Example:

```text
FND-0042

Service Lot 1:
Wash & Iron
5.2 KG

Service Lot 2:
Dry Cleaning
2 PCS
```

Each Service Lot creates/backs one Work Unit.

### 9.5 Transfer manifest

Branch-to-workshop movement must use a Manifest.

Example:

```text
NM-0182

From: Nallagandla
To: Central Workshop

Expected Handling Units: 17
```

Receiving 16 of 17 creates a variance.

The missing unit must be explicitly identified.

### 9.6 Production

Service Lots move through tenant-configured workflows.

Routine stage updates should support QR scan.

### 9.7 Ready state

When all required production work for the order is complete, OS PLUS evaluates readiness.

Ready must create visible fulfilment action.

A completed order must not silently remain on a shelf without a queue/task.

### 9.8 Fulfilment

Support:

- store pickup;
- tenant delivery;
- courier/other.

Fulfilment status is separate from production.

## 10. Laundry B2B Hostel Requirements

### 10.1 Reusable bag assets

A hostel may be assigned pre-numbered Fundry bags.

Example:

```text
BAG-001
...
BAG-040
```

Each permanent bag has:

- Container Asset ID;
- human code;
- QR token;
- assigned business customer, optional;
- status.

### 10.2 Collection batch

One hostel collection session creates one Collection Batch.

Example:

```text
HC-2026-00781

Customer:
XYZ Boys Hostel

Collection Date:
2026-07-05
```

### 10.3 One batch, one order

The initial Fundry B2B rule is:

> One Collection Batch creates one commercial Order.

If 20 bags are collected:

```text
1 Collection Batch
1 Order
20 Handling Unit cycles
20 Service Lots / Work Units
20 Order Lines
1 Invoice
20 Invoice Lines
```

This rule must be configurable/evolvable later, but is the launch flow.

### 10.4 Bag scan and intake

Scan permanent bag QR.

If a Handling Unit cycle already exists in the open Collection Batch, open it.

If no active cycle exists, create a new Handling Unit cycle linked to the reusable Container Asset.

Capture:

- resident/guest name;
- room number;
- declared piece count;
- pickup verified piece count;
- weight;
- optional card photo;
- notes.

### 10.5 Verification snapshots

Never overwrite historical counts.

Persist verification records such as:

```text
CUSTOMER_DECLARED
HOSTEL_PICKUP_VERIFIED
STORE_INTAKE
WORKSHOP_INTAKE
PRE_PACK
FINAL_PACK
```

The system should show variance across checkpoints.

### 10.6 B2B invoice

The first Fundry B2B billing flow creates one invoice with one line per bag.

Example:

```text
Bag 01 (11 pieces) - 4.2 kg
Bag 02 (9 pieces) - 3.8 kg
...
```

Invoice line description may include:

- bag code;
- guest/resident;
- room;
- verified piece count.

Pricing follows the configured Service/Price Book.

## 11. QR and Scan Requirements

### 11.1 QR identity

QR payload must use an opaque token URL.

Example:

```text
https://app.osplus.in/scan/q/<opaque-token>
```

Do not encode:

- customer name;
- phone;
- raw tenant ID;
- raw order ID;
- raw database UUID;
- invoice value.

### 11.2 Numeric fallback

Every operational QR identity must have a readable code.

Examples:

```text
FND-0042
BAG-017
```

### 11.3 Guided scan

Default V2 scan flow:

```text
Scan
 -> Resolve
 -> Display minimal operational context
 -> Ask server for legal primary action
 -> Show one primary action
 -> Confirm
 -> Execute Domain Command
 -> Show success/current state
```

### 11.4 No anonymous mutation

A QR URL must not directly perform a state change.

Default V2 mutation requires an authenticated OS Plus operational session.

A future enrolled Scan Station mode may be added after explicit device-security design.

### 11.5 Idempotency

Repeated scan submission must not duplicate:

- stage completion;
- custody events;
- handling cycles;
- manifest receipt;
- payment records.

## 12. Customer Tracking Requirements

The current secure token-based public tracking philosophy remains.

For Laundry, the tracking page should show customer-safe information:

- tenant branding;
- order number;
- order date;
- expected date;
- simplified order status;
- customer-safe Service Lot summary;
- customer-facing status;
- invoice amount/pending amount when enabled;
- payment CTA when enabled;
- customer-safe photos only.

Do not expose:

- internal workflow names when marked internal;
- worker identity;
- internal notes;
- manifest information;
- custody investigation;
- variance investigation;
- raw IDs;
- internal task assignments.

## 13. WhatsApp Requirements

The existing provider-neutral outbound communications foundation is preserved.

V2 must prioritize the tracking link as the live order confirmation surface.

Initial desired message:

```text
Hi {{customer_name}}, your {{store_name}} order {{order_number}} is confirmed.

Track live status, order details and payment here:
{{tracking_link}}
```

Initial V2 objective:

```text
Order confirmed
 -> queue/send tracking-link WhatsApp message
```

Live provider integration is a separate phase.

Inbound conversations and AI are later phases.

## 14. Billing Requirements

### 14.1 Invoice separation

V2 introduces Invoice and Invoice Lines separate from Orders.

Orders may exist before final billable quantity is known.

### 14.2 Invoice states

Initial states:

```text
DRAFT
FINALISED
PARTIALLY_PAID
PAID
VOID
REFUNDED
```

### 14.3 Invoice finalisation

A finalised invoice must snapshot:

- customer;
- invoice number;
- invoice date;
- due date;
- line descriptions;
- quantity/unit;
- unit price;
- discount;
- tax treatment;
- tax rate;
- taxable amount;
- tax amount;
- total.

Finalised invoice commercial fields must not be freely edited.

Corrections require controlled flows.

### 14.4 Payments

A Payment represents money received/recorded.

A Payment is not required to belong to one Order at creation.

### 14.5 Payment allocations

A Payment Allocation links money to an Invoice.

One payment may be allocated across multiple invoices.

Unallocated/suspense payments are allowed.

### 14.6 Boutique compatibility

Existing `order_payments` continue to work for existing Boutique runtime until a separately approved migration is completed.

Do not rewrite Boutique payment behaviour during the Laundry launch.

## 15. UPI Payment Intent Requirements

Before Razorpay, a tenant may configure a UPI VPA.

The public tracking page may show:

- `Pay Now`
- payment QR

The UPI payment intent should prefill:

- tenant VPA;
- payee name;
- unique transaction reference;
- order/invoice context note;
- pending amount;
- INR.

The intent must not mark the invoice paid.

Payment remains pending until manually verified and recorded in OS Plus.

The amount is a prefilled payment-intent value, not a platform-guaranteed immutable payment amount.

See `12_UPI_Payment_Intent_Spec.md`.

## 16. Control Room Requirements

The first V2 Control Room should prioritize exceptions.

Initial attention items:

```text
Pickup requests overdue
Pickup tasks unassigned
Handling Units with custody ambiguity
Manifest variances
Intake verification pending
Work Units past SLA
Production complete but fulfilment not actioned
Ready > 24 hours
Ready and unbilled
Fulfilled and unpaid
Unallocated payments
Failed communications
Failed integration syncs
```

Do not make the first view a chart-heavy generic SaaS dashboard.

## 17. AI and Agent Requirements

Agents are later-phase interfaces to OS Plus.

Agents may:

- interpret unstructured input;
- retrieve structured context;
- propose Domain Commands;
- answer customer-safe questions.

Agents must not perform arbitrary SQL/database mutation.

Initial future WhatsApp intents:

```text
CREATE_PICKUP_REQUEST
ORDER_STATUS
BUSINESS_FAQ
```

High-risk operations require human approval.

Examples:

- mark cash payment;
- discount;
- invoice void;
- refund;
- write-off;
- fuzzy payment match;
- compensation;
- loss/damage resolution.

## 18. Non-Goals for Initial Laundry Launch

Do not require:

- full general accounting;
- inventory management;
- customer app;
- native mobile app;
- worker login for every operational worker;
- AI agent to run physical operations;
- route optimisation;
- OCR as source of truth;
- automatic bank reconciliation;
- Razorpay;
- Zoho sync;
- Telegram bot;
- full Boutique migration to Work Units.

These are later phases or optional integrations.

## 19. Success Criteria

Laundry V2 launch is successful when Fundry can reliably answer:

- how many pickup requests came today;
- which are pending/unassigned/overdue;
- which physical bags are in Fundry custody;
- current location of each tracked Handling Unit;
- which manifest lost/missed a unit;
- current workflow stage of each Service Lot;
- which work is past SLA;
- which orders are production complete;
- which orders require fulfilment;
- which orders are billed;
- which invoices are unpaid;
- which B2B bags belong to the current hostel batch;
- whether each hostel bag was returned and verified.

The system is operationally successful when routine workers can update movement using scans and simple confirmations rather than navigating the full OS Plus application.
