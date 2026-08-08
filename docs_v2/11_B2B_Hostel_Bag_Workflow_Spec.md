# OS PLUS V2 B2B Hostel Reusable Bag Workflow Specification

## 1. Purpose

This document defines Fundry's B2B hostel Laundry workflow.

The key requirement is:

> Many independently tracked bags belong to one commercial Order and one Invoice.

The physical bag identity is reusable across collection cycles.

## 2. Locked Launch Model

For one hostel collection session:

```text
1 Collection Batch
1 Customer
1 Order
N reusable Container Assets
N Handling Unit cycles
N Service Lots
N Work Units
N Order Lines
1 Invoice
N Invoice Lines
```

For the first Fundry hostel flow:

```text
1 collected bag
= 1 Handling Unit cycle
= 1 Service Lot
= 1 Work Unit
= 1 Order Line
= 1 Invoice Line
```

Example:

```text
20 bags collected
  -> 1 Order
  -> 20 Work Units
  -> 1 Invoice
  -> 20 Invoice Lines
```

This is the operational/commercial launch rule.

The data model should remain extensible for future cases where one bag has multiple Service Lots.

## 3. Permanent Bag Identity

Fundry may assign:

```text
BAG-001
BAG-002
...
BAG-040
```

to a hostel.

Each bag is a `laundry_container_asset`.

The bag has:

- permanent human code;
- permanent QR;
- optional assigned hostel customer;
- status.

The same BAG-017 may be collected:

- July 5;
- July 12;
- July 19.

These are three different custody/production cycles.

Therefore:

```text
Container Asset BAG-017
  -> Handling Unit Cycle HU-A
  -> Handling Unit Cycle HU-B
  -> Handling Unit Cycle HU-C
```

Never reopen the previous week's Handling Unit as the current cycle.

## 4. Pre-Collection Setup

### Customer

Create B2B customer:

```text
XYZ Boys Hostel
customer_type = BUSINESS
```

Use Customer Contacts later/when available for:

- Hostel Manager
- Accountant
- Operations Contact

For V2 launch, a primary contact can remain on Customer/notes if the broader contact model is not yet implemented.

### Container Assignment

Register 40 Container Assets.

Example:

```text
BAG-001 -> XYZ Boys Hostel
...
BAG-040 -> XYZ Boys Hostel
```

Assignment is an operational default.

It does not mean the bag can never move to another customer after an authorized correction.

## 5. Start Collection Batch

Manager creates:

```text
HC-2026-00781

Customer:
XYZ Boys Hostel

Collection Date:
05 July 2026

Status:
OPEN
```

Command:

```text
CreateCollectionBatch
```

The batch should create or prepare one parent Laundry Order.

Recommended:

```text
Order Source:
B2B_COLLECTION

runtime_model:
work_unit_v2

vertical_key:
laundry
```

The Order remains the parent commercial commitment for the entire batch.

## 6. Bag Collection Flow

At hostel:

### Step 1

Guest leaves clothes in permanent numbered bag.

Current manual card can remain.

Card may include:

- guest name;
- room;
- declared pieces;
- notes.

### Step 2

Fundry staff scans permanent bag QR.

Example:

```text
BAG-017
```

System resolves:

```text
Container Asset:
BAG-017

Assigned Customer:
XYZ Boys Hostel

Open Collection Batch:
HC-2026-00781
```

Primary action:

```text
ADD BAG TO COLLECTION
```

### Step 3

Command:

```text
CreateHandlingCycleFromContainer
```

Atomic operation should:

1. validate open Collection Batch;
2. validate Container Asset belongs to tenant;
3. validate customer assignment or approved override;
4. ensure BAG-017 is not already in this batch;
5. create Handling Unit cycle;
6. link Handling Unit to Order;
7. add Collection Batch Unit;
8. establish custody;
9. emit events.

### Step 4

Capture bag data.

Required/optional launch fields:

```text
Resident/Guest Name
Room Number
Declared Piece Count
Pickup Verified Piece Count
Weight
Card Photo
Notes
```

The form must be mobile-first.

Recommended order:

```text
Room
Name
Declared Count
Verified Count
Weight
Photo
```

Use numeric keyboard for count/weight fields.

## 7. Piece Count Semantics

### Declared Count

What the guest/card says.

### Pickup Verified Count

What Fundry + hostel representative verify at collection.

These are separate facts.

Example:

```text
Declared: 20
Verified: 15
```

The system must not overwrite `20` to `15`.

Create verification records:

```text
CUSTOMER_DECLARED = 20
HOSTEL_PICKUP_VERIFIED = 15
```

The discrepancy is valuable data.

## 8. Create Service Lot and Work Unit

For Fundry launch, once bag intake has minimum required details:

Create:

```text
Order Line
Service Lot
Work Unit
```

Example:

```text
Container:
BAG-017

Handling Unit:
HU-20260705-017

Service:
Hostel Wash & Iron

Weight:
4.2 kg

Verified Pieces:
15
```

### Order Line

```text
Name:
Hostel Wash & Iron

Description:
Bag 17 (15 pieces)

Quantity:
4.2

Unit:
kg
```

The exact price can be calculated from Price Book/service configuration.

### Service Lot

Links:

```text
Handling Unit
Order Line
Service Catalog
Work Unit
```

### Work Unit

Gets configured workflow.

Example only:

```text
Wash
-> Dry
-> Steam Iron
-> QC
-> Pack
```

Do not hardcode these stages.

## 9. Collection Summary

As bags are scanned:

```text
XYZ BOYS HOSTEL
HC-2026-00781

Bags Scanned: 20

Declared Pieces: 348
Pickup Verified Pieces: 341

Weight: 92.4 kg

Count Variances: 4
```

Show bag list:

```text
BAG-001  Room 302  11 pcs  4.2 kg
BAG-002  Room 407   9 pcs  3.8 kg
...
```

Variance badge where:

```text
declared != verified
```

## 10. Batch Confirmation

Before leaving hostel:

```text
CONFIRM COLLECTION
```

Command:

```text
ConfirmCollectionBatch
```

Validation:

- batch open;
- at least one bag;
- no duplicate Container Asset;
- required bag fields complete;
- required verified counts/weights according to service policy;
- unresolved critical collection error acknowledged/resolved.

Confirmation freezes the pickup collection snapshot.

Later Workshop verification does not rewrite it.

Potential later feature:

- hostel representative confirmation/signature.

Not required for first launch unless operationally demanded.

## 11. Transport to Workshop

Collection Batch bags may be transferred through a Manifest.

Example:

```text
MAN-HC-00781

From:
XYZ Boys Hostel / Pickup Custody

To:
Central Workshop

Expected:
20 Handling Units
```

If the Batch is directly received at Workshop, the UI may provide:

```text
CREATE MANIFEST FROM COLLECTION
```

This adds all collected Handling Units.

Do not manually re-enter codes.

## 12. Workshop Intake

At workshop:

Scan each bag.

Create:

```text
WORKSHOP_INTAKE verification
```

Example:

```text
BAG-017

Pickup Verified: 15
Workshop Intake: 14
```

System shows:

```text
⚠ COUNT VARIANCE -1
```

Do not overwrite Pickup Verified count.

Create Investigation Task according to rules.

Possible outcome:

- recount corrected;
- bag card wrong;
- item missing;
- count unit ambiguity.

Resolution may add a new verification/correction note.

Do not delete the previous observation.

## 13. Production

Each bag's Work Unit moves independently.

This preserves:

```text
BAG-017 -> Steam Iron
BAG-018 -> Dry
BAG-019 -> Blocked
```

even though all bags belong to one Order and one Invoice.

This is the main reason bag-level Work Units are required.

## 14. Final Verification and Pack

Before marking bag production complete:

Create:

```text
FINAL_PACK verification
```

Capture piece count where required.

Example timeline:

```text
BAG-017

CUSTOMER_DECLARED          20
HOSTEL_PICKUP_VERIFIED     15
WORKSHOP_INTAKE            15
FINAL_PACK                 15
```

Or:

```text
20
15
14
14
```

The second example remains an exception until reviewed.

## 15. Invoice Build

The parent Order owns all Order Lines.

Invoice builder creates one Invoice.

Example:

```text
INV-FY26-000281

Customer:
XYZ Boys Hostel
```

Invoice Lines:

```text
1. Hostel Wash & Iron
   Bag 01 (11 pieces)
   4.2 kg x ₹X

2. Hostel Wash & Iron
   Bag 02 (9 pieces)
   3.8 kg x ₹X

...

20. Hostel Wash & Iron
    Bag 20 (14 pieces)
    5.1 kg x ₹X
```

Optional description pattern:

```text
BAG-017 | Room 411 | Pranay | 15 pieces
```

Keep line description configurable/template-driven later.

The first implementation may use a server-side formatter.

## 16. Invoice Timing

Recommended Fundry B2B flow:

```text
Collection Batch confirmed
  -> Order/Order Lines exist

Workshop/final billable quantity verified
  -> Invoice draft refreshed

Finance/authorized manager
  -> Finalise Invoice
```

Do not finalise invoice from guest-declared weight/count if actual billing quantity is not verified.

## 17. Return to Hostel

When all required Work Units are production complete:

```text
Batch/Order ready for fulfilment
```

Create return Manifest/fulfilment.

Expected bag cycles:

```text
20
```

At return, scan/confirm each Handling Unit.

The permanent Container Asset remains assigned to the hostel.

The current Handling Unit cycle closes after return.

## 18. Batch Closure

Command:

```text
CloseCollectionBatch
```

Initial guard conditions:

- batch confirmed;
- all required Work Units production complete or explicitly cancelled;
- required fulfilment complete;
- all expected Handling Unit cycles returned/closed;
- no unresolved critical custody variance;
- invoice state allowed by tenant policy.

Whether payment is required before closure should be tenant policy, not hardcoded.

## 19. Reuse Next Collection

Next week:

```text
HC-2026-00792
```

Scan:

```text
BAG-017
```

System finds:

```text
Container Asset BAG-017
No active Handling Unit cycle
Open Batch HC-2026-00792
```

Primary action:

```text
ADD BAG TO COLLECTION
```

A new Handling Unit is created.

Historical July 5 cycle remains visible in audit/history.

## 20. Operational Acceptance Criteria

The Hostel flow is accepted only when:

1. 20 bags create one Order.
2. 20 bags remain independently trackable.
3. 20 bags create one Invoice with 20 Invoice Lines.
4. BAG-017 can be reused in a later Collection Batch.
5. BAG-017 cannot be added twice to the same Batch.
6. declared and verified counts remain separately visible.
7. workshop count does not overwrite pickup count.
8. a missing Manifest bag is explicitly named.
9. each bag can be at a different production stage.
10. Batch closure cannot hide unresolved critical custody variance.
