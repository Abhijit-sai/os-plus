# OS PLUS V2 Architecture and Repository Delta Plan

## 1. Purpose

This document maps the current OS PLUS repository to the V2 architecture required for Laundry.

It is a **delta plan**, not a greenfield architecture.

## 2. Architecture Position

Current OS PLUS already has strong platform decisions:

- multi-tenancy;
- Clerk identity separated from OS Plus tenant membership;
- role-based access;
- tenant-configurable Stage Master and Workflows;
- internal and customer-facing status separation;
- worker/workgroup mapping;
- mobile-first production concepts;
- public token tracking;
- operational finance;
- GST reporting;
- outbound communication foundation.

These are preserved.

The key current abstraction is:

```text
Order = commercial unit
Order Item = production unit
```

For Boutique, one garment can reasonably be:

- a commercial line;
- a product/item;
- a production unit.

Laundry exposes that these are not universal equivalents.

V2 adds an additive normalized runtime.

## 3. Delta Matrix

| Current Area | V2 Action | Reason |
|---|---|---|
| Tenants | PRESERVE | Current model works |
| Clerk identity | PRESERVE | Identity remains external |
| Tenant membership | PRESERVE | Multi-business roles already supported |
| Current roles | PRESERVE | Authorization model is module-based |
| Tenant vertical context | ADD | Need explicit Boutique/Laundry capability |
| Locations | ADD | Stores/workshop/custody need first-class locations |
| Customers | PRESERVE / EXTEND | Current customer workspace works |
| Customer addresses | ADD | Pickup and "same address" need reusable addresses |
| Workgroups | PRESERVE | Existing workflow assignment configuration |
| Teams | ADD | Operational work assignment differs from authorization |
| Workflow definitions | PRESERVE | Tenant configurable and reusable |
| Stage Master | PRESERVE | Tenant-controlled stages remain core |
| `orders` | PRESERVE / EXTEND | Parent commercial commitment remains valuable |
| `order_items` | PRESERVE FOR BOUTIQUE | Live compatibility |
| `order_lines` | ADD | Separate commercial lines from work |
| Work Unit runtime | ADD | Generic V2 operational unit |
| Legacy item workflow runtime | PRESERVE | Boutique live path |
| Work Unit workflow runtime | ADD | Laundry/future verticals |
| Item history | PRESERVE | Historical Boutique audit |
| Domain events | ADD | Cross-interface V2 event record |
| Tasks | ADD | Missing execution primitive |
| Commands | ADD | Shared safe mutation layer |
| Current order payments | PRESERVE FOR BOUTIQUE | Compatibility |
| Invoices | ADD | Laundry billing may finalise after operations begin |
| Payments | ADD | Money can exist before invoice match |
| Payment allocations | ADD | One payment may settle multiple invoices |
| Finance/GST | PRESERVE / EXTEND | Do not build accounting |
| Communications | PRESERVE / EXTEND | Existing outbound foundation is useful |
| Conversations | ADD LATER | Inbound WhatsApp/agent requirement |
| QR | ADD | Physical identity and simple ground operations |
| Razorpay | ADD LATER | Trusted payment rail |
| Zoho | ADD LATER | Downstream accounting adapter |
| Telegram | OPTIONAL LATER | Ops alert/action interface |

## 4. Protected Boutique Compatibility Contract

The following paths are protected until an explicitly approved convergence project:

```text
orders
  -> order_items
      -> item_workflow_instances
          -> item_stage_instances
              -> item_stage_work_logs

order_payments

item_history
```

Protected user behaviour includes:

- create Boutique order;
- add multiple items;
- choose item type;
- choose workflow per item;
- select customer measurement or standard size;
- item expected completion;
- current production queue;
- stage worker validation;
- stage start/complete;
- item history;
- customer-safe public tracking;
- existing order payment entry;
- existing GST reporting;
- communication dry-run/message history.

A V2 migration must not silently reinterpret historical Boutique records.

## 5. Parallel Runtime Strategy

### Current

```text
Order
  -> Order Item
```

### V2

```text
Order
  -> Order Lines
  -> Work Units
```

### Runtime discriminator

Add:

```text
orders.vertical_key
orders.runtime_model
```

Examples:

```text
Boutique historical/current:
vertical_key = boutique
runtime_model = legacy_item_v1
```

```text
Laundry:
vertical_key = laundry
runtime_model = work_unit_v2
```

Shared views use runtime-aware adapters.

## 6. Why Not Migrate Boutique Immediately

Immediate Boutique migration would require simultaneous change to:

- order create form;
- production queries;
- workflow actions;
- work logs;
- measurements;
- standard sizes;
- attachments;
- public tracking;
- customer workspace;
- dashboard;
- finance summaries;
- communication rendering;
- item edit/correction.

The product currently has live clients.

There is no Laundry launch requirement that justifies this blast radius.

Therefore:

> Add the V2 runtime beside the legacy runtime.

After Laundry production use proves V2, revisit Boutique convergence.

## 7. Workflow Definition Reuse

Do not fork into:

```text
boutique_workflows
laundry_workflows
```

Continue using:

```text
workflows
workflow_stages
stage_master
customer_statuses
workgroups
stage_workgroups
```

The current workflow definition model is a platform asset.

V2 adds a second execution engine keyed to `work_units`.

## 8. Production and Fulfilment Boundary

Current production logic includes a label-based delivery heuristic.

V2 does not extend this pattern.

### V2 production

Owned by:

```text
work_units
work_unit_workflow_instances
work_unit_stage_instances
```

Final production effect:

```text
production_complete
```

### V2 fulfilment

Owned by explicit fulfilment/delivery records/state and Domain Commands.

Example:

```text
CompleteProduction
  -> order readiness evaluation
  -> create fulfilment task
```

Then:

```text
CompleteDelivery
  -> fulfilment completed
```

No stage-name keyword determines delivery.

## 9. Commercial Boundary

### Current

`orders` stores both operational commitment and commercial totals.

### V2

```text
Order
  = customer commitment and fulfilment parent

Order Line
  = commercial service/product line

Invoice
  = finalised billing document

Payment
  = money recorded

Payment Allocation
  = application of money to an invoice
```

Current Boutique order totals remain.

Laundry V2 uses explicit Invoice objects.

## 10. Existing Communications Boundary

Current communications are outbound transaction messages:

```text
trigger
  -> template
  -> rendered queue
  -> message log
```

Preserve them.

V2 later adds:

```text
channel connection
  -> conversation
      -> inbound/outbound conversation messages
```

Do not turn the outbound queue into the inbound conversation store.

An outbound queue record may link to a conversation message after send.

## 11. New Source Boundaries

Add:

```text
src/core/commands
src/core/command-context
src/core/events
src/core/idempotency
```

Add:

```text
src/features/tasks
src/features/locations
src/features/teams
src/features/billing-v2
```

Add:

```text
src/verticals/laundry
```

Add provider adapters later:

```text
src/integrations
```

Do not relocate the existing app wholesale.

## 12. Query Adapter Pattern

Use runtime-neutral DTOs for shared screens.

Examples:

```text
TrackingView
OperationalOrderSummary
ControlRoomException
CustomerOrderSummary
```

Conceptual:

```ts
async function getTrackingView(token: string) {
  const order = await loadOrderByTrackingToken(token);

  if (order.runtime_model === "legacy_item_v1") {
    return getLegacyBoutiqueTrackingView(order);
  }

  if (order.runtime_model === "work_unit_v2") {
    return getWorkUnitTrackingView(order);
  }

  throw new Error("Unsupported runtime model");
}
```

This allows one public tracking UI without pretending both runtime schemas are identical.

## 13. Database Migration Sequence

Recommended schema dependency order:

```text
1. vertical definitions / tenant verticals
2. tenant locations
3. customer addresses
4. teams / team members
5. order runtime discriminator
6. order lines
7. work units
8. Work Unit workflow runtime
9. command idempotency / domain events
10. tasks
11. Laundry pickup/container/handling/custody
12. Laundry service lots
13. QR registry
14. manifests
15. fulfilment
16. invoices/invoice lines
17. payments/allocations/intents
18. collection batches/verifications
19. conversation/provider webhook tables
20. agent runtime
```

Do not create one mega migration.

Use phase-scoped versioned migrations.

## 14. Data Backfill Rules

### Vertical backfill

Existing tenants:

```text
tenant_verticals -> boutique
```

Review any known non-Boutique test tenants before applying production migration.

### Order backfill

Existing orders:

```text
vertical_key = boutique
runtime_model = legacy_item_v1
```

Do not generate Work Units for existing orders during the initial V2 migration.

### Address backfill

Do not delete `customers.address`.

Optionally create one `customer_addresses` row for non-empty existing addresses through an idempotent backfill.

Mark source:

```text
legacy_customer_address
```

Keep old field available until shared customer screens are migrated.

### Payment

Do not bulk-migrate `order_payments` into V2 `payments` during Laundry launch unless a later finance convergence phase is approved.

## 15. Feature and Navigation Gating

Examples:

```text
Boutique-only tenant:
Orders
Customers
Production
Workers
Attendance
Salary
Finance
Settings
```

```text
Laundry tenant:
Control Room
Pickups
Orders
Operations
Manifests
Deliveries
Customers
Billing
Workers
Attendance
Salary
Finance
Settings
```

Shared modules may change labels by vertical only when the behaviour remains clear.

Do not show empty Laundry pages to Boutique tenants.

Do not hardcode tenant slug checks such as:

```ts
if (tenant.slug === "fundry")
```

Use vertical/capability configuration.

## 16. Operational Simplicity Standard

Every Laundry operational surface must be judged against this rule:

> The lowest technical ability of the person performing the operation defines the UI complexity.

Prefer:

```text
Scan
Tap
Confirm
```

over:

```text
Search
Open Order
Open Item
Find Workflow
Select Stage
Choose Status
Submit
```

Owner and finance screens may be information-dense.

Ground operational screens must be task-focused.

## 17. V2 Compatibility Review Triggers

A phase must run Boutique Tier A regression when it changes:

- `orders`;
- `customers`;
- `workflows`;
- `workflow_stages`;
- `stage_master`;
- `customer_statuses`;
- tenant context;
- permissions;
- public tracking;
- shared Finance queries;
- communication rendering;
- generated database types;
- shared layout/navigation.

Tier B regression applies to adjacent shared utilities.

See `10_Phase_Gate_QA_and_Commit_Policy.md`.

## 18. Architecture Completion Definition

Architecture V2 is not complete when all tables exist.

It is complete when:

- Fundry operates B2C and B2B Laundry workflows;
- QR-driven operations reliably move physical units;
- current Boutique clients continue to function;
- shared screens use explicit runtime adapters;
- commands are idempotent and tenant-safe;
- invoice/payment semantics no longer depend on Laundry pretending an Order is an invoice;
- documentation and project summary accurately reflect the implemented system.
