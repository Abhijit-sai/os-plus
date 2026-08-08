# OS PLUS V2 Project Summary Update Protocol

## 1. Purpose

The root:

```text
/project_summary.md
```

remains the only living project summary and coding-session memory.

V2 does not create a second project summary.

Every major coding session must append/update the V2 session history in the root summary.

## 2. When to Update

Update after:

- major implementation session;
- migration session;
- QA session;
- architecture decision;
- phase status change;
- bug-fix session affecting the current phase;
- phase closure.

Update even when the phase remains `IN_PROGRESS`.

Do not wait for a phase commit.

## 3. Required V2 Session Template

Use:

```markdown
## V2 Session Update - YYYY-MM-DD - <Short Session Name>

### Date

YYYY-MM-DD

### Updated By

Codex AI agent / Developer / Name

### V2 Phase

V2-<number> - <Phase Name>

### Phase Status

PLANNED / IN_PROGRESS / QA_BLOCKED / READY_FOR_CLOSURE / CLOSED

### Branch / Base

- Branch:
- Base reference/commit, if known:

### Session Objective

- What this session intended to complete.

### What Was Built

- Item 1
- Item 2

### Key Decisions Made

- Decision 1
- Decision 2

### Migrations Added

- `supabase/migrations/...`
- None

### Migrations Applied Locally

- Migration + result
- None

### Files / Modules Changed

- `path`
- `path`

### Automated Tests Run

| Command | Result |
|---|---|
| `npm run typecheck` | PASS/FAIL/NOT RUN |
| `npm run lint` | PASS/FAIL/NOT RUN |
| `npm run build` | PASS/FAIL/NOT RUN |
| `npm run test:roles` | PASS/FAIL/NOT RUN |
| `npm run test:v2` | PASS/FAIL/NOT RUN |

### Phase-Specific Tests

- Test ID - Result
- Test ID - Result

### Boutique Regression

- Required Tier: A / B / C
- Tests run:
- Result:
- Notes:

### Tenant Isolation Checks

- Checks run:
- Result:

### Manual QA

- Browser/device:
- Persona:
- Tenant/Vertical:
- Test IDs:
- Result:
- Notes:

### Bugs Found

- Severity + bug
- None

### Bugs Fixed

- Bug + fix
- None

### Deferred Issues

- P2/P3 issue + reason
- None

### Compatibility Notes

- Explicit statement about impact on current Boutique runtime.
- Any shared-table/query changes.

### Pending Tasks

- Task 1
- Task 2

### Blockers

- Blocker
- None

### Phase Gate Assessment

- Can move to READY_FOR_CLOSURE: YES/NO
- Missing closure requirements:

### Notes for Next Session

- Exact next action
```

## 4. Phase Start Entry

At phase start, record:

```text
Phase Status: IN_PROGRESS
Branch
Base
Scope
Compatibility Risk
Required Boutique Regression Tier
Expected Migrations
```

This prevents the next Codex session from guessing the phase.

## 5. QA Block Entry

When blocked:

```text
Phase Status: QA_BLOCKED
```

Record:

- exact blocker;
- what was tested;
- why closure is unsafe;
- what evidence/action unblocks the phase.

Do not mark a test PASS because the environment was unavailable.

Use:

```text
BLOCKED
```

## 6. READY_FOR_CLOSURE Entry

Record the Phase Gate checklist summary.

Required:

```text
Automated checks: PASS
Phase tests: PASS
Manual QA: PASS
Boutique Regression Tier X: PASS
Tenant Isolation: PASS
P0: 0
P1: 0
Migration review: COMPLETE
Diff review pending/final
```

Then:

```text
Phase Status: READY_FOR_CLOSURE
```

## 7. CLOSED Entry

A phase closure entry must include:

```text
Phase Status: CLOSED
```

and:

- exact final commit SHA, if created;
- final migration list;
- automated check results;
- manual QA summary;
- Boutique regression tier/result;
- tenant isolation result;
- deferred P2/P3 list;
- production migration/config requirements;
- next phase recommendation.

Suggested closure section:

```markdown
### Closure Evidence

- Scope complete: YES
- Typecheck: PASS
- Lint: PASS
- Build: PASS
- Role tests: PASS
- V2 tests: PASS
- Phase tests: PASS
- Manual QA: PASS
- Boutique regression: Tier A - PASS
- Tenant isolation: PASS
- P0 defects: 0
- P1 defects: 0
- Final diff review: COMPLETE
- Migration review: COMPLETE

### Phase Commit

`<sha> - <message>`

### Production / Deployment Notes

- Migration requirements
- Environment variables
- Feature/config activation
- Rollout warnings

### Next Phase

V2-X - ...
```

## 8. Compatibility Statement

Every V2 session touching shared code must state:

```text
Boutique compatibility impact:
```

Examples:

```text
No shared Boutique runtime code changed.
```

```text
Shared `orders` type changed only to add nullable/backfilled runtime fields.
Boutique Tier A regression passed.
```

Avoid vague:

```text
Should not affect Boutique.
```

Use evidence.

## 9. Migration Recording

For each migration, record:

- filename;
- purpose;
- applied locally yes/no;
- row counts/backfill result where relevant;
- rollback/recovery note.

Example:

```text
20260705120000_v2_tenant_verticals.sql

Purpose:
Add vertical definitions and tenant mappings.

Applied locally:
PASS

Backfill:
4 existing tenants mapped to boutique.
0 duplicate active mappings.

Recovery:
Additive tables; backfill rows can be removed before dependent V2 data exists.
```

## 10. Test ID Recording

Use IDs from:

```text
OS_PLUS_V2_QA_Test_Matrix.xlsx
```

Example:

```text
BA-004 PASS
WU-003 PASS
TI-021 PASS
```

This lets later sessions understand what "tested" actually means.

## 11. Summary Integrity Rules

1. Do not create `project_summary_v2.md`.
2. Do not update archived `docs/05_Project_Summary.md`.
3. Do not delete old session history.
4. Correct a factual mistake with a later correction entry.
5. Do not claim tests were run when they were not.
6. Record `NOT RUN` or `BLOCKED` honestly.
7. Record the exact current Phase Status.
8. Record the exact next action.
9. The summary must be sufficient for a new Codex session to continue without relying on chat history.
10. Architecture decisions that change V2 docs must also update `15_V2_Decision_Log.md` in the same phase/session.
