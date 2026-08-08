# OS PLUS V2 Migration and Compatibility Map

## 1. Goal

Extend the live Boutique system to Laundry without a big-bang rewrite.

## 2. Current Live Model

```text
Tenant
  -> Customer
  -> Order
      -> Order Item
          -> Item Workflow Instance
              -> Item Stage Instances
                  -> Work Logs

Order
  -> Order Payments
```

This model remains supported.

## 3. V2 Additive Model

```text
Tenant
  -> Tenant Verticals
  -> Locations
  -> Teams

Customer
  -> Customer Addresses

Order
  -> Order Lines
  -> Work Units
      -> Work Unit Workflow Runtime

Laundry
  -> Pickup Request
  -> Container Asset
  -> Handling Unit
  -> Custody Event
  -> Service Lot
  -> Manifest
  -> Verification
  -> Collection Batch
  -> Fulfilment

Billing
  -> Invoice
  -> Invoice Lines
  -> Payment
  -> Payment Allocations
  -> Payment Intents
```

## 4. Compatibility Strategy

### Boutique

```text
READ:
legacy tables

WRITE:
legacy server actions/runtime

TRACKING:
legacy adapter

PAYMENTS:
order_payments
```

### Laundry

```text
READ:
V2 Work Unit/Laundry tables

WRITE:
Domain Commands

TRACKING:
V2 adapter

PAYMENTS:
payments + allocations
```

### Shared UI

Uses runtime-neutral projection/DTO where both need one screen.

## 5. Order Runtime Map

| Vertical | Current/New | Runtime |
|---|---|---|
| Boutique existing | Current | `legacy_item_v1` |
| Boutique new during Laundry build | Current | `legacy_item_v1` |
| Laundry | New | `work_unit_v2` |
| Future vertical | Decision per vertical | preferably `work_unit_v2` |

Do not automatically switch new Boutique orders to Work Unit V2 in Laundry Phase 2.

## 6. Existing Table Treatment

## `tenants`

Action:

```text
PRESERVE
```

Add vertical mapping through new tables.

Do not add a single fixed `tenant_type` enum if multiple vertical capabilities may exist later.

## `tenant_users`

Action:

```text
PRESERVE
```

Do not migrate to Clerk Organizations.

## `customers`

Action:

```text
PRESERVE
```

Add `customer_addresses`.

Potential later:

```text
customer_type
```

If added, backfill existing customers to `INDIVIDUAL` or a reviewed default.

Do not break current customer pages.

## `item_types`

Action:

```text
PRESERVE FOR BOUTIQUE
```

Laundry gets a Service Catalog rather than pretending Wash & Iron is a garment Item Type.

## `workflows`

Action:

```text
PRESERVE / REUSE
```

Same definition table can be used by both runtimes.

## `workflow_stages`

Action:

```text
PRESERVE / REUSE
```

Do not duplicate into Laundry workflows.

## `stage_master`

Action:

```text
PRESERVE / REUSE
```

Tenant controls stage names.

## `workgroups` / `stage_workgroups`

Action:

```text
PRESERVE / REUSE
```

V2 Work Unit execution applies the same allowed-workgroup semantics when worker logs are captured.

## `orders`

Action:

```text
PRESERVE / EXTEND
```

Add:

```text
vertical_key
runtime_model
```

Migration:

1. add nullable;
2. backfill existing rows;
3. verify counts;
4. add defaults/NOT NULL only after review.

Do not remove current financial summary fields.

## `order_items`

Action:

```text
PRESERVE
```

No Laundry rows should be created in `order_items`.

Do not rename to Work Units.

Do not bulk migrate during Laundry launch.

## `item_workflow_instances`

Action:

```text
PRESERVE
```

Boutique only in current V2 launch.

## `item_stage_instances`

Action:

```text
PRESERVE
```

Boutique only in current V2 launch.

## `item_stage_work_logs`

Action:

```text
PRESERVE
```

Boutique runtime.

## `item_history`

Action:

```text
PRESERVE
```

Do not rewrite to Domain Events.

New V2 commands emit Domain Events.

## `order_payments`

Action:

```text
PRESERVE FOR BOUTIQUE
```

Laundry V2 uses `payments` and `payment_allocations`.

Do not make a half-migration where existing Boutique payment screens insert V2 Payments but current Finance still totals `order_payments`.

## Current Finance

Action:

```text
PRESERVE
```

Laundry Billing views may be additive.

Shared owner dashboard integration comes after V2 commercial model is stable.

## Current Communications

Action:

```text
PRESERVE / EXTEND
```

Existing tables remain.

Adapt runtime-neutral rendering where needed.

## 7. Backfill Migrations

### Tenant vertical

Before:

```text
Tenant A
Tenant B
Tenant C
```

After:

```text
Tenant A -> boutique
Tenant B -> boutique
Tenant C -> boutique
```

Fundry:

```text
Fundry -> laundry
```

If Fundry already exists before migration and is a test tenant, configure by an explicit reviewed seed/mapping script.

Do not identify by fuzzy tenant name in a generic production migration.

### Order runtime

Before:

```text
orders.runtime_model = NULL
```

After:

```text
all current rows = legacy_item_v1
all current rows vertical_key = boutique
```

Review count:

```text
orders before
orders backfilled
orders null after
```

Counts must match.

### Customer address

Optional additive backfill:

```text
customers.address non-empty
  -> create one Customer Address
```

Use a deterministic/idempotent source marker.

Do not clear `customers.address`.

## 8. Generated Type Compatibility

Current repository maintains `src/types/database.ts`.

Every V2 migration must update/generate types consistently.

High-risk effects:

- enum union changes;
- nullable to non-null;
- added `orders` fields;
- duplicated type names.

After type changes:

```text
npm run typecheck
npm run lint
npm run build
```

and required Boutique regression.

## 9. Shared Query Migration

Do not change every query to return Work Units.

Add runtime-aware query boundaries for shared screens.

### Public Tracking

Before:

```text
page -> legacy order/item query
```

After:

```text
page -> getPublicTrackingView
            -> legacy adapter
            -> V2 adapter
```

### Customer Order History

Phase 1:

Existing Boutique customer workspace can remain.

When Laundry customer orders must appear in a shared customer workspace:

```text
getCustomerOrderSummaries
```

returns common summary DTO.

### Dashboard

Do not mix new and legacy tables in ad hoc UI joins.

Create explicit query/projection functions.

## 10. Rollback Philosophy

### Additive tables

Rollback before production data:

- remove V2 feature usage;
- revert code;
- drop additive tables only through a reviewed rollback.

After real Laundry data exists:

Do not casually drop tables.

Recovery becomes:

- disable Laundry vertical/capability;
- restore last known application;
- preserve V2 data for repair.

### Backfilled discriminator columns

Because old data is preserved:

- legacy runtime remains recoverable;
- V2 code can fall back to legacy adapter for backfilled Boutique orders.

## 11. Feature Flag/Capability Boundary

Primary capability is tenant vertical enablement.

A phase may also need temporary platform rollout flags.

Examples:

```text
laundry_scan_enabled
laundry_billing_v2_enabled
tracking_upi_pay_enabled
```

Do not create dozens of permanent booleans on `tenants`.

Use a reviewed tenant feature/config mechanism if rollout flags expand.

## 12. Deployment Sequence Per Shared Migration

Recommended:

1. code compatible with old and new nullable schema if needed;
2. apply additive migration;
3. backfill;
4. verify;
5. enable V2 feature for test tenant;
6. local/preview QA;
7. Boutique regression;
8. enable Fundry;
9. monitor;
10. later tighten constraints.

Do not deploy application code that requires a migration before the production migration sequence is understood.

## 13. Boutique Convergence Options Later

### Option A - Keep Dual Runtime

Boutique remains legacy.

Laundry/future verticals use Work Units.

Shared projections unify UI.

Benefits:

- low migration risk.

Cost:

- two runtimes.

### Option B - New Boutique Orders Use V2

Historical Boutique stays legacy.

New Boutique orders use Work Units/Boutique extension.

Benefits:

- gradual convergence.

Cost:

- Boutique create/production flows need a second implementation/migration.

### Option C - Full Boutique Migration

Backfill all existing items to Order Lines/Work Units.

Benefits:

- one runtime.

Cost:

- highest migration/regression risk.

## 14. Current Decision

For the Laundry extension:

> Choose Option A.

Revisit only after:

- Fundry B2C live use;
- Fundry B2B live use;
- Work Unit runtime stability;
- Command/idempotency maturity;
- shared Tracking adapter maturity;
- regression suite confidence.

## 15. Compatibility Acceptance Statement

V2 Laundry cannot be declared production-ready if the only evidence is:

```text
Laundry works.
```

Required statement:

```text
Laundry V2 phase acceptance passed
AND
required Boutique regression tier passed
AND
tenant isolation passed
AND
migration/backfill verification passed.
```
