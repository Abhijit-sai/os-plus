# OS PLUS V2 Laundry Vertical Specification

## 1. Purpose

The Laundry vertical is the second OS PLUS vertical.

Fundry is the first production tenant.

The vertical must be configurable enough for future laundries without hardcoding Fundry business names, branch names, or exact stage names.

## 2. Domain Overview

```text
Customer
  -> Pickup Request / Walk-in / B2B Collection Batch
      -> Order
          -> Handling Units
              -> Service Lots
                  -> Work Units
                      -> Configured Workflows

Order
  -> Order Lines
      -> Invoice
          -> Invoice Lines

Physical movement
  -> Custody Events / Manifests

Production complete
  -> Fulfilment

Money
  -> Payment
      -> Payment Allocations
```

## 3. Core Laundry Terms

### Pickup Request

A customer request for Fundry to collect physical items.

### Container Asset

A reusable physical container owned/managed by the tenant.

Example:

```text
BAG-017
```

Used primarily for B2B hostel bags.

### Handling Unit

A physical package under custody for one operational cycle.

Examples:

- laundry bag;
- cover;
- shoe packet;
- carpet.

### Service Lot

A service-specific portion of a Handling Unit.

Examples:

- Wash & Iron, 5.2 kg;
- Dry Cleaning, 2 shirts;
- Shoe Cleaning, 1 pair.

### Work Unit

The generic OS Plus V2 operational unit that owns the workflow execution for one Service Lot.

### Custody Event

Evidence of physical responsibility/location change.

### Manifest

A controlled transfer of Handling Units between locations.

### Collection Batch

A B2B pickup/collection session containing many bag cycles and normally one parent Order.

### Verification

An immutable count/weight observation at an operational checkpoint.

### Production Batch

A temporary group of Service Lots/Work Units processed together.

### Fulfilment

The process of returning completed work to the customer.

## 4. Laundry Service Configuration

Laundry service definition should be tenant-owned.

Suggested service fields:

```text
id
tenant_id
name
code
description

default_workflow_id
default_sla_hours or default_sla_days

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

Quantity units should initially support:

```text
kg
piece
pair
unit
sq_ft
other
```

Do not hardcode one pricing model into workflow execution.

## 5. B2C Flow

### Step 1: Demand

Source:

```text
CALL
WHATSAPP
WALK_IN
MANUAL
FUTURE_WEB
```

For Call/WhatsApp pickup:

```text
Create Pickup Request
```

For walk-in:

```text
Create Order / Handling Unit intake directly
```

### Step 2: Pickup

Pickup request becomes an operational Task.

At collection:

- identify customer;
- confirm address;
- attach/generate tag;
- establish Fundry custody;
- create Handling Unit.

Detailed service classification is optional at roadside.

### Step 3: Intake

At store/workshop intake:

- scan Handling Unit;
- confirm customer/order;
- add one or more Service Lots;
- capture quantity;
- capture piece count where relevant;
- capture weight where relevant;
- add instructions;
- map configured workflow;
- create Work Unit.

### Step 4: Internal movement

Use Manifest for branch/workshop transfers.

### Step 5: Production

Each Service Lot's Work Unit follows the tenant-configured workflow.

### Step 6: Production complete

When all required Work Units are `production_complete`:

- evaluate order readiness;
- create/activate fulfilment action;
- update public status;
- queue customer communication if configured.

### Step 7: Billing

Create/finalise Invoice based on billable Order Lines.

Billing timing can be configured by flow:

- intake finalisation;
- production completion;
- manual finance approval.

Initial Fundry B2C preference can be final invoice when actual quantities are known.

### Step 8: Fulfilment

- store pickup;
- Fundry delivery;
- courier/other.

### Step 9: Payment

Tracking page may show UPI Pay Now.

Payment remains pending until verified and recorded.

## 6. Handling Unit Rules

1. Handling Unit belongs to one tenant.
2. Handling Unit has one human-readable code.
3. Handling Unit may have an opaque QR identity.
4. Handling Unit belongs to one customer.
5. Handling Unit may be linked to an Order.
6. Handling Unit may reference one reusable Container Asset.
7. A Handling Unit can have multiple Service Lots.
8. A Handling Unit has a current location convenience field.
9. Custody Events are the evidence/history.
10. Closing a Handling Unit must not delete its history.

## 7. Service Lot Rules

1. One Service Lot belongs to one Handling Unit.
2. One Service Lot backs one Work Unit in launch scope.
3. One Service Lot has one service definition.
4. Quantity and unit are explicit.
5. Piece count and weight can coexist.
6. Service Lot does not own stage state.
7. Work Unit owns workflow execution.
8. Operational corrections must preserve audit information.

## 8. Custody Model

Example:

```text
FND-0042

CUSTOMER
  -> Ravi / Pickup
      -> Nallagandla Store
          -> Manifest NM-0182
              -> Central Workshop
```

Persist an event at each responsibility/location transition.

Suggested custody states:

```text
EXPECTED
IN_CUSTOMER_POSSESSION
PICKED_UP
AT_STORE
IN_TRANSFER
AT_WORKSHOP
IN_PRODUCTION
READY
OUT_FOR_FULFILMENT
RETURNED_TO_CUSTOMER
CLOSED
EXCEPTION
```

These states are Laundry-domain convenience states.

Do not use them as substitutes for Work Unit production states.

## 9. Manifest Rules

1. Manifest has one source and destination location.
2. Manifest has a human code.
3. Units are added before dispatch.
4. Dispatch freezes the expected-unit snapshot.
5. Receipt records actual receipt.
6. Missing unit produces variance.
7. Unexpected unit is visible and requires a reviewed action.
8. Manifest variance creates an investigation Task.
9. Custody changes use Domain Commands.
10. Repeated receipt scan is idempotent.

## 10. Production Rules

Laundry uses existing tenant-configured Stage Master and Workflows.

Example configuration only:

```text
Wash & Iron
  -> Wash
  -> Dry
  -> Steam Iron
  -> QC
  -> Pack
```

OS Plus must not assume these exact names.

### Scan movement

A Work Unit/Service Lot scan should resolve the configured current stage.

Example:

```text
FND-0042-WI

Current:
Dry

Primary action:
Complete Dry
```

After command:

```text
Current:
Steam Iron - Ready to Start
```

The tenant workflow configuration remains the source of sequence.

### Worker logging

Not every routine scan requires typing a worker.

The launch should support an operational mode where a manager/station account records the scan action.

Where productivity/work log is required, worker selection must continue to respect existing workgroup mappings.

This should be configurable by operational flow/stage later.

## 11. Production Batch

Laundry may process multiple Service Lots together.

Examples:

- Wash Batch;
- Drying Batch;
- Iron Queue Batch.

Initial data model:

```text
laundry_production_batches
laundry_production_batch_members
```

Batch actions must use Domain Commands.

Do not update 20 Work Units in the browser independently and assume all succeeded.

Batch transition must report:

- succeeded;
- skipped;
- blocked;
- failed.

A partial result must be explicit and audit-visible.

## 12. Readiness

Order readiness calculation for Laundry should inspect required Work Units.

Initial rule:

```text
All non-cancelled required Work Units = production_complete
```

Then:

```text
order.ready_for_fulfilment
```

Possible exceptions:

- pending manual QC;
- billing hold;
- customer hold;
- loss/damage investigation.

Design readiness evaluation as a deterministic function/command policy, not as a UI guess.

## 13. Fulfilment

Suggested V2 tables may include:

```text
fulfilments
fulfilment_items or fulfilment_work_units
```

Initial simple Laundry flow may have one fulfilment record per Order.

Required:

- fulfilment type;
- status;
- assigned user/team;
- scheduled time;
- completed time;
- delivery notes;
- proof attachment, optional.

Statuses:

```text
PENDING
ASSIGNED
OUT_FOR_FULFILMENT
COMPLETED
FAILED
CANCELLED
```

Partial fulfilment may be supported by linking Work Units/Handling Units to fulfilment records.

Do not infer fulfilment completion from production workflow stage labels.

## 14. B2C Tracking

Customer-safe Service Lot view:

```text
Wash & Iron
5.2 kg
Status: Finishing
```

```text
Dry Cleaning
2 pieces
Status: Processing
```

Do not show:

```text
Steam Table 2
Worker: Ramesh
Manifest NM-0182
Workshop Intake variance
```

## 15. B2B Hostel Flow

The hostel flow is fully specified in `11_B2B_Hostel_Bag_Workflow_Spec.md`.

Locked launch semantics:

```text
1 Collection Batch
1 Order
N reusable Container Assets scanned
N Handling Unit cycles
N Service Lots
N Work Units
N Order Lines
1 Invoice
N Invoice Lines
```

For Fundry's launch B2B workflow:

```text
1 bag = 1 invoice line
```

The bag remains independently trackable through production.

## 16. Laundry Control Room

Initial exception lists:

### Pickup

- new pickup;
- unassigned;
- overdue;
- failed.

### Custody

- Handling Unit received but intake pending;
- Handling Unit location ambiguity;
- open Manifest variance;
- missing from Manifest receipt.

### Production

- Work Unit past expected completion;
- current stage stale;
- blocked;
- production complete but order not ready due to hold.

### Fulfilment

- ready > 24 hours;
- ready without fulfilment task;
- assigned but overdue;
- failed delivery.

### Commercial

- production complete and unbilled;
- invoice overdue;
- fulfilled and unpaid;
- unallocated payment.

## 17. Operational UX

### Store Manager

Primary actions:

```text
New Pickup
Receive / Scan Bag
Intake
Send to Workshop
Ready Orders
```

### Workshop

Primary actions:

```text
Scan
Current Queue
Problems
```

### Delivery

Primary actions:

```text
My Pickups
My Deliveries
Complete / Failed
```

### Finance

Primary actions:

```text
Invoices
Payments
Unallocated
Overdue
```

Do not make every role navigate the full owner dashboard.

## 18. Launch Constraints

Initial Laundry launch can remain manager-assisted for:

- pickup assignment;
- worker identity;
- cash confirmation;
- payment verification;
- manifest exception resolution.

The system's first job is to establish reliable digital demand, custody, production and fulfilment truth.

Automation can increase only after the process is stable.
