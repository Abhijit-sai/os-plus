# OS PLUS V2 Documentation Layer

## Purpose

`docs_v2` is the authoritative planning and build layer for the OS PLUS V2 extension.

V2 extends the current, live OS PLUS product from its first vertical, Boutique, to a second vertical, Laundry, with Fundry as the first Laundry tenant.

The V2 work is **not a greenfield rewrite**.

The current Boutique product has live users and is a protected compatibility contract. V2 must preserve existing Boutique behaviour while introducing additive platform primitives that Laundry and future verticals can use.

## Source of Truth Hierarchy

For every new Codex or coding-agent session, read in this order:

1. `/project_summary.md`
2. `/docs_v2/00_README_V2.md`
3. `/docs_v2/01_PRD.md`
4. `/docs_v2/03_Tech_Development_Plan.md`
5. `/docs_v2/06_Rules.md`
6. `/docs_v2/07_Database_Delta_Model.md`
7. The V2 phase-specific document relevant to the current task
8. Existing `/docs` files only when current implementation or historical product behaviour must be understood

Do not use `/docs/05_Project_Summary.md` as current session memory. It is archived historical context.

The root `/project_summary.md` remains the **only living project summary and session log**.

## V2 Core Principle

> Extend the platform without breaking the current Boutique runtime.

The current Boutique path remains operational during the Laundry build.

The V2 architecture introduces a parallel generic runtime for new vertical work rather than forcing every existing Boutique record through a risky immediate migration.

## Current and New Runtime Models

### Existing Boutique Runtime

```text
Order
  -> Order Item
      -> Item Workflow Instance
          -> Item Stage Instances
              -> Item Stage Work Logs
```

This remains supported.

### V2 Work Runtime

```text
Order
  -> Order Lines
  -> Work Units
      -> Work Unit Workflow Instance
          -> Work Unit Stage Instances
              -> Work Unit Stage Work Logs
```

Vertical extensions attach to Work Units.

Examples:

```text
Boutique
Work Unit -> Boutique Item
```

```text
Laundry
Work Unit -> Laundry Service Lot
              -> Handling Unit
              -> optional reusable Container Asset
```

The first V2 launch does **not** require Boutique orders to be rewritten to the new runtime.

## Documents in This Folder

| File | Purpose |
|---|---|
| `01_PRD.md` | V2 product requirements |
| `02_WBS.md` | Phase-wise work breakdown |
| `03_Tech_Development_Plan.md` | Technical implementation sequence |
| `04_Architecture_Repository_Delta_Plan.md` | Current repo to V2 delta map |
| `05_Laundry_Vertical_Spec.md` | Laundry vertical product/domain specification |
| `06_Rules.md` | Non-negotiable V2 product and engineering rules |
| `07_Database_Delta_Model.md` | Additive database model and migration rules |
| `08_QR_Scan_Operations_Spec.md` | QR identity and scan operations |
| `09_Codex_Build_Prompt.md` | Startup prompt for a V2 coding session |
| `10_Phase_Gate_QA_and_Commit_Policy.md` | Local QA, closure, and commit discipline |
| `11_B2B_Hostel_Bag_Workflow_Spec.md` | Hostel reusable-bag workflow |
| `12_UPI_Payment_Intent_Spec.md` | Pre-Razorpay UPI payment intent design |
| `13_Project_Summary_Update_Protocol.md` | Required session summary format |
| `14_Migration_and_Compatibility_Map.md` | Boutique compatibility and migration map |
| `15_V2_Decision_Log.md` | Locked architecture decisions |

The package also includes `OS_PLUS_V2_QA_Test_Matrix.xlsx`.

## Phase Statuses

Every V2 phase must use one of these statuses:

```text
PLANNED
IN_PROGRESS
QA_BLOCKED
READY_FOR_CLOSURE
CLOSED
```

A phase is not `CLOSED` because coding is complete.

A phase closes only after:

- planned scope is complete;
- migrations are reviewed;
- automated checks pass;
- phase-specific automated tests pass;
- required local manual QA passes;
- Boutique regression tests pass;
- tenant-isolation checks pass;
- the final diff is reviewed;
- `project_summary.md` is updated with closure evidence.

## Commit Rule

Default V2 workflow:

```text
Create phase branch
  -> build locally
  -> update project_summary.md after each major session
  -> keep phase open
  -> run automated checks
  -> run manual QA
  -> run Boutique regression
  -> review migration and diff
  -> mark READY_FOR_CLOSURE
  -> final closure review
  -> update project_summary.md
  -> commit phase
```

Do not use a Git commit as a substitute for a checkpoint while a phase is incomplete.

Small emergency fixes and explicitly approved exceptions may follow the existing repository release process, but the reason must be recorded in `project_summary.md`.

## Naming

- Platform: `OS PLUS`
- Vertical keys:
  - `boutique`
  - `laundry`
- First Laundry tenant: `Fundry`
- Work runtime names:
  - `legacy_item_v1`
  - `work_unit_v2`

Do not hardcode `Fundry` into reusable Laundry-domain logic.

## First Build Action

Do **not** start by building QR, WhatsApp, agents, or Razorpay.

Start with V2 Phase 0 from `02_WBS.md` and `03_Tech_Development_Plan.md`:

1. establish the V2 baseline;
2. run and record current Boutique smoke/regression behaviour;
3. add the V2 test runner and compatibility gates;
4. confirm the current migrations and local database baseline;
5. only then begin additive V2 schema work.
