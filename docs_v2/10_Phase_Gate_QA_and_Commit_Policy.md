# OS PLUS V2 Phase Gate, QA and Commit Policy

## 1. Purpose

V2 changes a live multi-tenant product.

This policy prevents "code complete" from being confused with "safe to close".

## 2. Phase States

```text
PLANNED
IN_PROGRESS
QA_BLOCKED
READY_FOR_CLOSURE
CLOSED
```

### PLANNED

Scope exists in V2 docs.

No implementation has begun.

### IN_PROGRESS

Implementation or active defect resolution is underway.

### QA_BLOCKED

Phase cannot proceed to closure because:

- required environment unavailable;
- migration cannot be tested;
- critical external dependency unavailable;
- known P0/P1 defect;
- required regression cannot be completed.

Blocker must be written to `project_summary.md`.

### READY_FOR_CLOSURE

Development is complete and all normal test evidence exists.

Final diff/migration/closure review remains.

### CLOSED

Final closure checklist passed and evidence is recorded.

## 3. Branch Rule

Recommended:

```text
v2/phase-<number>-<short-name>
```

Example:

```text
v2/phase-4-laundry-custody
```

At phase start:

1. confirm intended base branch/commit;
2. confirm clean working tree;
3. create/switch to phase branch;
4. record base reference in `project_summary.md`.

## 4. Default Commit Rule

The user wants local completion and testing before phase commit.

Therefore:

> Do not create routine intermediate Git commits for incomplete phase work by default.

Use the working tree as the active phase workspace.

After each major session:

- update `project_summary.md`;
- record tests;
- record pending work;
- do not falsely mark phase closed.

A phase commit is created after closure evidence.

### Exceptions

An explicit user instruction may allow:

- checkpoint commits;
- emergency hotfix;
- WIP branch backup;
- separate documentation commit.

The exception and reason must be recorded.

## 5. Automated Check Gate

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:roles
npm run test:v2
```

After V2-0, these are mandatory unless a command is unavailable for a documented reason.

A failing required check blocks closure.

Do not dismiss a failure because it appears unrelated without investigation and written evidence.

## 6. V2 Automated Test Gate

Phase-specific automated tests must cover new domain rules.

Examples:

### Platform primitives

- tenant vertical isolation;
- location ownership;
- customer address ownership;
- team membership ownership.

### Work runtime

- initialization;
- stage sequence;
- invalid state transition;
- workgroup rule.

### Commands

- tenant context;
- rollback;
- idempotency;
- Domain Event emission.

### Custody

- Handling Unit code uniqueness;
- custody sequence;
- permanent bag reuse.

### Manifest

- complete receipt;
- missing unit;
- duplicate receipt;
- unexpected unit.

### Billing

- invoice finalisation;
- allocation;
- partial allocation;
- over-allocation rejection.

## 7. Boutique Regression Tiers

## Tier A - Full Critical Regression

Required when changing:

- `orders`;
- tenant context;
- permission helpers;
- workflow definition tables;
- Stage Master;
- customer statuses;
- production shared utilities;
- public tracking;
- shared customer queries;
- communication rendering;
- Finance/GST shared queries;
- database generated types with broad impact;
- app shell/navigation capability logic.

Tier A tests:

```text
BA-001 Tenant sign-in and tenant selection
BA-002 Boutique customer create/search
BA-003 Measurement reference available
BA-004 Boutique order create
BA-005 Multiple order items
BA-006 Workflow instance created per item
BA-007 Start stage with valid worker/workgroup
BA-008 Complete stage and next stage ready
BA-009 Customer status safe/public tracking
BA-010 Add partial order payment
BA-011 Finance reflects order payment
BA-012 GST report loads
BA-013 Communication dry-run queue
BA-014 Existing order detail/edit smoke
```

## Tier B - Focused Shared Regression

Required for adjacent shared utility/UI changes.

Run affected Tier A tests plus:

- sign-in/tenant;
- create/open one Boutique order;
- production page;
- public tracking.

## Tier C - Vertical-Local

Laundry-only change with no shared migration/code impact.

Run:

- tenant isolation;
- Laundry phase tests;
- app build;
- one Boutique smoke open/navigation test.

The phase owner must justify Tier C in `project_summary.md`.

## 8. Manual Local QA Gate

Manual QA is required for user-facing phases.

Record:

```text
Browser
Viewport/device
Persona
Tenant
Test IDs
Result
Evidence/notes
```

Priority manual flows:

- mobile scan;
- camera QR;
- order form;
- public tracking;
- multi-tenant selection;
- workflow configuration;
- manifest receive;
- B2B collection;
- Pay Now external intent.

## 9. Migration Gate

For every phase with migrations:

1. list migration files;
2. inspect SQL;
3. confirm dependency order;
4. run against local development database;
5. confirm existing data/backfill counts;
6. verify indexes/constraints;
7. verify tenant ownership;
8. verify RLS state/policies as applicable;
9. run phase tests;
10. run Boutique regression;
11. record rollback/recovery strategy.

### Destructive Change

Any migration that:

- drops table;
- drops column;
- changes data type destructively;
- renames a live table/column;
- bulk rewrites current Boutique records;

requires explicit architecture review before implementation.

## 10. Tenant Isolation Gate

For every new tenant-owned module, QA must include:

```text
Tenant A creates record
Tenant B cannot read by list
Tenant B cannot read by guessed ID
Tenant B cannot mutate guessed ID
Tenant B cannot link child to Tenant A parent
```

Where public token access exists:

```text
valid token shows only safe record
random token fails safely
revoked token fails safely
token does not expose internal ID
```

## 11. QR Gate

Required before closing QR phase:

- token opaque;
- no PII;
- authenticated mutation;
- current tenant validated;
- server-resolved allowed action;
- duplicate action safe;
- stale action rejected;
- human code fallback;
- problem action;
- mobile browser QA.

## 12. Billing Gate

Required before closing Billing phase:

- invoice number uniqueness;
- finalised invoice snapshot;
- GST calculation test;
- partial payment;
- partial allocation;
- one payment to multiple invoices;
- unallocated payment;
- over-allocation rejected;
- reversed/void flows not falsely counted;
- Boutique `order_payments` regression;
- Finance/GST regression.

## 13. UPI Gate

Required:

- VPA validation at settings level;
- URI parameter encoding;
- unique transaction reference;
- invoice/order context;
- pending amount prefilled;
- QR equals Pay Now intent;
- no paid status on link open/return;
- manual record payment flow;
- mobile test with at least one supported UPI application in test conditions;
- clear user copy that confirmation may be pending until verified.

## 14. Defect Severity

### P0

Data leak, cross-tenant mutation, destructive corruption, incorrect financial settlement, unusable live Boutique core flow.

Blocks phase.

### P1

Core phase flow fails, custody chain unreliable, duplicate financial/operational event, major regression.

Blocks phase.

### P2

Important but workaround exists.

May close only with explicit deferral and documented reason.

### P3

Minor UX/polish.

Can defer.

## 15. QA Workbook Rule

`OS_PLUS_V2_QA_Test_Matrix.xlsx` is the execution tracker.

For each test:

- set Status;
- record Actual Result;
- add Evidence/Notes;
- record defect reference if failed.

Do not mark PASS without executing the test.

## 16. READY_FOR_CLOSURE Checklist

All must be true:

```text
[ ] Phase scope complete
[ ] No accidental later-phase features
[ ] Migrations reviewed/applied locally
[ ] Typecheck passed
[ ] Lint passed
[ ] Build passed
[ ] test:roles passed
[ ] test:v2 passed
[ ] Phase automated tests passed
[ ] Required manual QA passed
[ ] Boutique regression tier passed
[ ] Tenant isolation passed
[ ] P0 defects = 0
[ ] P1 defects = 0
[ ] Deferred P2/P3 documented
[ ] project_summary.md current
```

Then mark:

```text
READY_FOR_CLOSURE
```

## 17. Final Closure Review

Review:

1. `git diff`;
2. untracked files;
3. migration files;
4. environment variable changes;
5. public/customer data exposure;
6. tenant filters/constraints;
7. idempotency;
8. logs/error messages;
9. docs accuracy;
10. QA workbook.

Then rerun affected final checks where review changes were made.

## 18. CLOSED Checklist

```text
[ ] READY_FOR_CLOSURE checklist complete
[ ] Final diff reviewed
[ ] Final migration review complete
[ ] Final checks passed
[ ] project_summary.md has phase closure entry
[ ] Closure entry includes exact tests/evidence
[ ] Commit message prepared
[ ] Phase commit created
```

Only then:

```text
Phase Status: CLOSED
```

## 19. Commit Message Convention

Suggested:

```text
V2 Phase 4: add laundry custody foundation
```

or:

```text
V2 Phase 7: add invoice and UPI payment intent
```

Avoid vague closure commits:

```text
updates
fix stuff
final
```

## 20. Merge and Deployment

Phase closure does not automatically mean production deployment.

After commit:

- report phase completion;
- report production migration requirements;
- report environment/config changes;
- report rollout risk.

Merge/deploy only according to explicit user direction and current repository release workflow.
