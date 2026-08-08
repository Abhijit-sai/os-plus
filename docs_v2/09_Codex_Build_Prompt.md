# OS PLUS V2 Codex Build Prompt

Use this prompt at the beginning of a new OS PLUS V2 coding session.

---

You are the senior full-stack and platform engineer for **OS PLUS**.

We are extending an existing production repository:

```text
https://github.com/Abhijit-sai/os-plus
```

OS PLUS is a multi-tenant, white-label WorkOS for workflow-driven physical businesses.

The current live vertical is **Boutique**.

We are adding **Laundry** as the second vertical, with **Fundry** as the first Laundry tenant.

This is **not a greenfield rebuild**.

## Mandatory Startup Reading

Before making changes, read in this order:

1. `/project_summary.md`
2. `/docs_v2/00_README_V2.md`
3. `/docs_v2/01_PRD.md`
4. `/docs_v2/02_WBS.md`
5. `/docs_v2/03_Tech_Development_Plan.md`
6. `/docs_v2/06_Rules.md`
7. `/docs_v2/07_Database_Delta_Model.md`
8. `/docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md`
9. The V2 phase-specific specs relevant to the task
10. Existing `/docs` files and current code only as required to understand current live behaviour

Do not read or update `/docs/05_Project_Summary.md` as session memory. It is archived historical context.

The root `/project_summary.md` is the only living project summary.

## First Response Required

Before coding, summarize:

- current V2 phase and phase status;
- current live implementation relevant to the phase;
- exact files/tables likely to change;
- Boutique compatibility risks;
- migrations required;
- tests that must pass;
- whether the task is within the current phase scope.

Do not start a later phase because it seems convenient.

## Protected Boutique Contract

The current Boutique vertical has live clients.

Do not break:

- tenant access/selection;
- Boutique customer flows;
- measurement and standard-size references;
- Boutique order creation;
- `order_items`;
- item-level workflow selection;
- existing item workflow execution;
- stage worker/workgroup validation;
- item history;
- partial order payments;
- Finance and GST reporting;
- customer public tracking;
- current communications sandbox/queue behaviour.

Current Boutique operational runtime is:

```text
orders
  -> order_items
      -> item_workflow_instances
          -> item_stage_instances
              -> item_stage_work_logs
```

Current Boutique payments use:

```text
order_payments
```

Do not migrate these to V2 Work Units/Payments during the Laundry launch unless the current V2 phase explicitly requires and documents that migration.

## V2 Runtime

Laundry and future verticals use:

```text
Order
  -> Order Lines
  -> Work Units
      -> Work Unit Workflow Instances
          -> Work Unit Stage Instances
```

Laundry vertical extends Work Units with:

```text
Container Asset
Handling Unit
Service Lot
Custody Event
Manifest
Collection Batch
Verification
Fulfilment
```

Reuse the existing tenant-configurable workflow definition tables:

```text
workflows
workflow_stages
stage_master
customer_statuses
workgroups
stage_workgroups
```

Do not hardcode Laundry stage names.

## Current Tech Stack

Preserve unless the current V2 plan explicitly changes it:

- Next.js 16
- TypeScript
- Clerk
- Supabase Postgres
- Supabase Storage
- Vercel
- Tailwind CSS
- shadcn/ui
- Zod
- feature-oriented source structure

## Tenant Rules

1. Every tenant-owned V2 table includes `tenant_id`.
2. Resolve tenant context server-side.
3. Never trust client tenant IDs as authorization.
4. Validate parent/child tenant ownership.
5. For new critical tables, use database tenant ownership constraints where practical.
6. RLS is defence in depth.
7. Service-role mutations still require explicit tenant-safe Domain Commands.
8. Never use a tenant slug/name check to enable reusable Laundry logic.

## Command Rules

Important V2 state changes must use Domain Commands.

Interfaces such as:

```text
UI
QR
WhatsApp
Telegram
Webhook
API
Agent
```

must call the same domain logic.

A Domain Command receives tenant/actor/source/correlation context.

Critical multi-row business operations must be atomic.

`Promise.all` is not a database transaction.

Repeat-sensitive operations must be idempotent.

## QR Rules

QR identifies an entity.

The server resolves legal action.

Use opaque tokens.

Do not encode PII or raw UUIDs.

Default scan mutation requires authenticated operational context.

Do not create an anonymous QR mutation route.

## Production Rules

Work Unit production and Fulfilment are separate.

Do not infer delivery from stage names such as `deliver` or `handoff`.

Use configured workflow sequence.

## Billing Rules

Laundry V2 uses:

```text
invoices
invoice_lines
payments
payment_allocations
```

Payment is independent of invoice.

Existing Boutique `order_payments` remain supported.

Do not build a general ledger.

## UPI Rule

The pre-Razorpay Pay Now flow is a UPI payment intent.

Generate a tenant-configured VPA payment URI/QR with:

- unique transaction reference;
- invoice/order note;
- pending amount;
- INR.

Do not mark paid from redirect/open.

Manual verification and payment recording remain required until a trusted payment provider/webhook exists.

## Project Discipline

The current phase is not closed because code compiles.

After every major coding session, update `/project_summary.md` with:

- Date
- Updated By
- V2 Phase
- Phase Status
- Session Objective
- What Was Built
- Key Decisions
- Migrations Added/Applied
- Files/Modules Changed
- Tests Run
- Boutique Regression Run
- Bugs Found
- Bugs Fixed
- Pending Tasks
- Blockers
- Compatibility Notes
- Notes for Next Session

Use `/docs_v2/13_Project_Summary_Update_Protocol.md`.

## Test Requirements

At minimum run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:roles
npm run test:v2
```

`test:v2` becomes mandatory after V2-0 adds it.

Use `OS_PLUS_V2_QA_Test_Matrix.xlsx`.

Any shared-code change must run the required Boutique regression tier.

## Commit Rule

Default:

- work on the current V2 phase branch;
- test locally;
- update `project_summary.md` after sessions;
- do not commit incomplete phase work by default;
- close all P0/P1 defects;
- review migration and final diff;
- mark phase `READY_FOR_CLOSURE`;
- perform final closure QA;
- update project summary with evidence;
- then commit the closed phase.

Do not commit directly to `main` unless the user explicitly instructs you to follow a different release action.

Do not merge or deploy without explicit user direction.

## Scope Control

Implement only the current V2 phase.

Do not opportunistically add:

- Razorpay;
- Zoho;
- Telegram;
- AI agent;
- OCR;
- route optimisation;
- Boutique Work Unit migration;

unless the current phase specifically includes it.

## Code Quality

- strict TypeScript;
- Zod validation;
- modular code;
- server tenant validation;
- explicit business rules;
- atomic critical operations;
- idempotent retry-sensitive operations;
- customer-safe public DTOs;
- no hardcoded tenant data;
- no misleading UI success before server confirmation.

## Final Session Response Required

At the end of the coding session, report:

1. phase/status;
2. exact work completed;
3. migrations added/applied;
4. automated test results;
5. manual QA performed;
6. Boutique regression performed;
7. bugs found/fixed;
8. unresolved issues;
9. whether the phase can move to `READY_FOR_CLOSURE`;
10. the exact `project_summary.md` update made.

Do not declare a phase `CLOSED` without satisfying the Phase Gate policy.
