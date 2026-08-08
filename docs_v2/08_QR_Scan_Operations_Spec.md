# OS PLUS V2 QR and Scan Operations Specification

## 1. Objective

Use QR scanning to make physical Laundry operations easy enough that routine ground workers do not need to navigate the full OS Plus application.

The scan runtime is an operational interface to Domain Commands.

It is not a second business system.

## 2. Core Principle

> QR identifies the object. The server decides what can legally happen next.

Do not encode an instruction such as:

```text
MOVE_TO_IRON
```

inside a QR.

The same physical unit may be at a different state tomorrow.

QR identifies:

```text
BAG-017
```

or:

```text
FND-0042
```

The server loads current state and configured workflow.

## 3. QR Entity Types

Initial:

```text
LAUNDRY_CONTAINER_ASSET
LAUNDRY_HANDLING_UNIT
```

Potential later:

```text
WORK_UNIT
PRODUCTION_BATCH
FULFILMENT
```

Do not add entity types until an operational scan use case exists.

## 4. QR Payload

Recommended URL:

```text
https://<app-domain>/scan/q/<opaque-token>
```

Token:

- random;
- high entropy;
- non-sequential;
- no PII;
- no tenant name required;
- no customer phone;
- no invoice amount;
- no raw UUID.

The QR image may be printed with:

```text
BAG-017
[QR]
```

or:

```text
FND-0042
[QR]
```

Human code is mandatory.

## 5. Scan Authentication

### Default V2 mode

Authenticated operational session.

Flow:

```text
scan QR
  -> open OS Plus scan route
  -> if not authenticated, sign in
  -> resolve current tenant context
  -> resolve token inside permitted tenant
  -> load action context
```

A scan link must not mutate before authentication/authorization.

### Why

A permanent hostel bag QR may be photographed or seen outside Fundry.

Possession of QR is not permission to change business state.

## 6. Future Scan Station Mode

A future `Scan Station` mode may support shared devices in the workshop.

Possible design:

```text
registered device
  -> station token
  -> tenant
  -> location
  -> allowed command set
  -> expiration/rotation
```

Example:

```text
Station:
Workshop Steam Iron

Allowed:
Start stage
Complete stage

Location:
Central Workshop
```

Do not implement this in the first QR launch without:

- device enrollment;
- token rotation;
- station scope;
- revoke flow;
- audit actor/source semantics.

## 7. Scan Resolution

Create a server-side resolver.

Conceptual:

```text
resolveScanContext(token, tenantContext)
```

Steps:

1. validate token format;
2. lookup active QR identity;
3. validate tenant;
4. load entity;
5. load current operational state;
6. load current location;
7. load related order/customer label;
8. load Service Lots/Work Unit state;
9. calculate legal actions;
10. return a minimal Scan View.

## 8. Scan View DTO

Example Handling Unit:

```text
FND-0042

Customer:
Abhijit

Location:
Central Workshop

Services:
Wash & Iron - Steam Iron
Dry Cleaning - Finishing

Primary Action:
Open Services
```

Example single Service Lot:

```text
FND-0042-WI

Wash & Iron
5.2 kg

Current Stage:
Dry

Primary Action:
Complete Dry
```

Example Container Asset in open hostel batch:

```text
BAG-017

Assigned:
XYZ Boys Hostel

Current Batch:
HC-2026-00781

Primary Action:
Add Bag to Collection
```

## 9. Primary Action Rule

Prefer one primary action.

Examples:

```text
Receive at Workshop
Complete Dry
Start Steam Iron
Add Bag to Collection
Confirm Intake
```

Secondary actions:

```text
Report Problem
View Details
Cancel
```

Do not display a full stage dropdown by default.

## 10. Legal Action Resolver

The client never decides the next status.

Example:

```text
Work Unit current stage:
Dry
Status:
in_progress

Configured next stage:
Steam Iron
```

Allowed action:

```text
Complete Dry
```

Command:

```text
CompleteWorkStage
```

The command:

- verifies current stage still Dry;
- verifies it is in progress;
- verifies actor/station permission;
- completes Dry;
- updates Work Unit workflow;
- prepares next configured stage;
- emits event.

If another supervisor completed Dry first:

```text
STALE_ACTION

Current stage is now Steam Iron.
Refresh/open current action.
```

## 11. Handling Unit Scan Rules

### One Service Lot

Open the Service Lot/Work Unit action directly.

### Multiple Service Lots

Show simple services list:

```text
Wash & Iron
Current: Dry
[OPEN]

Dry Cleaning
Current: Finishing
[OPEN]
```

Do not make the worker search order items.

## 12. Container Asset Scan Rules

Permanent Container QR represents the reusable bag.

Resolution depends on context.

### Open Collection Batch

```text
scan BAG-017
```

If BAG-017 already has a cycle in the batch:

```text
Open existing Handling Unit cycle
```

If not:

```text
Primary Action:
Add Bag to Collection
```

Command:

```text
CreateHandlingCycleFromContainer
```

### No open Collection Batch

If an active Handling Unit cycle exists:

```text
Open active cycle
```

If no cycle:

```text
No active handling cycle
```

Only show `Create New Cycle` if the actor is in an appropriate intake workflow.

## 13. QR Creation

### Handling Unit

At B2C pickup/intake:

1. create Handling Unit;
2. generate human code;
3. create QR identity;
4. render/print tag or attach pre-printed mapped tag.

### Container Asset

Admin/manager registers reusable bag:

1. create Container Asset;
2. assign human code;
3. create permanent QR identity;
4. print durable label;
5. optionally assign B2B customer.

## 14. Pre-Printed Tags

Fundry may use pre-printed QR tags.

Recommended model:

```text
Tag pool
```

This can be implemented later through a reusable QR identity/tag inventory.

For first launch, it is acceptable to generate QR after Handling Unit creation if printing/label operations are practical.

Do not create a complicated tag inventory module before operational testing proves it is required.

## 15. Human Code Search

Every scan screen should support:

```text
Enter code
```

Examples:

```text
FND-0042
BAG-017
```

This is required for:

- damaged QR;
- poor camera;
- low light;
- shared desktop;
- staff verbal coordination.

Search result must remain tenant-scoped.

## 16. Idempotency

Examples:

### Double Stage Complete

First:

```text
Complete Dry
-> SUCCESS
```

Second same idempotency key:

```text
Return prior success
```

Second new request after state moved:

```text
STALE_ACTION
Current stage: Steam Iron
```

### Double Add Bag to Batch

Unique batch/container constraint prevents duplicate.

Command returns:

```text
ALREADY_IN_BATCH
handlingUnitId = ...
```

### Double Manifest Receive

Do not create duplicate custody event.

Return current received state.

## 17. Offline and Poor Network

Full offline mode is not a V2 launch requirement.

However:

- show clear submitting state;
- disable duplicate action button while request is pending;
- use idempotency key;
- show retry-safe error;
- do not optimistically show final state before server confirmation.

Later, an offline scan queue may be considered.

## 18. Problem Action

Every operational scan view should have:

```text
REPORT PROBLEM
```

Possible categories:

```text
TAG_DAMAGED
UNIT_NOT_FOUND
WRONG_CUSTOMER
COUNT_MISMATCH
DAMAGED_ITEM
MISSING_ITEM
WRONG_STAGE
OTHER
```

Reporting a problem should:

- create Task/Issue;
- optionally block Work Unit/Handling Unit;
- preserve photo/note;
- notify relevant Team according to automation rules.

Do not ask the worker to solve data inconsistencies by manually choosing a different stage.

## 19. Scan Analytics

Track:

- scan source;
- action;
- actor/station;
- entity;
- result;
- duration, optional;
- failed/stale action;
- occurred time.

Useful later:

- busiest stations;
- repeated scan failures;
- stage bottlenecks;
- QR damage rate;
- exception rate.

Do not collect analytics at the cost of slowing the primary scan operation.

## 20. Acceptance Criteria

QR launch is acceptable when:

1. a Handling Unit can be identified by scan and human code;
2. a permanent hostel bag can be reused across Collection Batches;
3. a worker cannot mutate another tenant's object;
4. a QR leak does not grant anonymous mutation;
5. current legal action is server-resolved;
6. duplicate submit is safe;
7. stale action is clearly rejected;
8. configured workflow stage sequence is respected;
9. a problem can be escalated without corrupting state;
10. the operation can be completed comfortably on a basic mobile browser.
