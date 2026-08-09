# OS PLUS Stage Worker Contributions Implementation Spec

Status: approved for implementation

## 1. Outcome

Allow an item stage to record several workers, the eligible workgroup/role each person performed, tenth-unit credits and/or manually attributed effort time, and an analytics-only monetary contribution. Preserve stage elapsed time, production history, salary, finance, and tenant boundaries.

## 2. Confirmed Product Decisions

1. A stage may use workers from any workgroup mapped to that stage. Each contribution explicitly selects the performed workgroup, including when a worker belongs to several eligible groups.
2. Stage effort mode is `none`, `units`, `hours`, or `hybrid`.
3. Units use 0.10 increments. Unit totals must equal `order_items.quantity` before completion.
4. Credited time uses ten-minute increments. The UI provides ten-minute and one-hour increment/decrement controls and shows summed man-hours.
5. Stage elapsed time is separate from summed worker effort.
6. Hybrid stages require both units and time for analytics.
7. Item-type/stage monetary configuration is optional and uses `per_unit`, `per_hour`, or `percentage`.
8. Percentage uses `order_items.final_price`, the item value after item discount and before GST, to create one pool. The rule selects distribution by units or hours.
9. A missing rule produces INR 0 and Rate not configured but never blocks production.
10. Configuration is snapshotted when the stage starts. Later changes apply only to not-started stages.
11. Workers may be added, edited, or removed before completion. Removing entered effort requires a correction reason and preserved audit record.
12. After completion, only owner/admin may edit contributions and every edit requires a correction reason.
13. Existing completed stages remain unchanged and are not backfilled.
14. Contribution amounts are not wages, salary inputs, order revenue, GST, payments, expenses, or ledger entries.

## 3. Configuration UX

Stage settings own effort mode because the production method determines whether units, hours, or both matter.

Item type settings link to a focused contribution-rule page because garment/item type determines the monetary value of a stage. The page lists active stages and supports:

- no monetary rule;
- amount per credited unit;
- amount per credited hour;
- percentage pool split by units;
- percentage pool split by hours.

Compatibility is enforced: unit calculations require units/hybrid stages; hour calculations require hours/hybrid stages. Gaps remain warnings, not production blockers.

## 4. Runtime UX

Ready and in-progress stage cards expose a focused contribution editor. Each assignment row contains worker, eligible workgroup/role, units when required, time when required, and calculated contribution. The same worker may appear more than once only with a different eligible role.

The first assignment on a unit or hybrid stage defaults to the complete item quantity. Additional assignments default to zero, and users redistribute credit with -1, -0.1, +0.1, and +1 controls or exact numeric entry. Time starts at zero and uses ten-minute/one-hour controls. Completing a valid stage closes this focused editor and returns to the workflow view; start and save actions keep it open.

Completion summary shows:

- credited units versus item quantity;
- total man-hours;
- actual stage elapsed time;
- snapshotted rule;
- calculated contribution pool/total;
- configuration warning where applicable.

The editor is disabled while saving, cannot close while pending, blocks duplicate submission, preserves entered rows after errors, and shows visible recoverable feedback.

## 5. Data and Transaction Model

- `stage_master.effort_tracking_mode` stores current configuration.
- `item_type_stage_contribution_rules` stores optional tenant/item-type/stage rates.
- `item_stage_instances` stores immutable-once-started configuration and item-value snapshots plus a monotonic contribution revision used for optimistic concurrency control.
- `item_stage_work_logs` stores performed role, credited units, credited minutes, and calculated contribution alongside elapsed timestamps.
- `item_stage_contribution_corrections` stores immutable before/after JSON and reason.
- Service-role-only RPCs atomically start a stage with assignments, replace active/completed contributions, and complete a stage.

Every RPC locks the tenant-owned stage and related workflow/item rows; revalidates worker, workgroup, stage mapping, item type, active rule, assignment increments, and status; rejects stale transitions and stale editor revisions; writes history; and returns a safe summary.

## 6. Calculation Rules

- Per unit: `credited_units * rate`.
- Per hour: `(credited_minutes / 60) * rate`.
- Percentage pool: `round(item_final_price * percentage / 100, 2)` distributed proportionally by the configured weight.
- Percentage allocation must reconcile exactly to the snapshotted pool after currency rounding; the final deterministic row receives any rounding remainder.
- Allocation uses non-negative largest remainder in integer paise. Fractional remainder descending, then worker/workgroup ID, determines residual paise; no row may become negative or make the total exceed the pool.
- No rate: every calculated contribution is `0`.

## 7. Authorization

- Owner/admin and manager may manage ready/in-progress stage assignments under `production:manage`.
- Owner/admin and manager may view the report through `worker_contributions:view`; managers use the dedicated Production-linked route so unrelated owner dashboard access is not broadened.
- Only owner/admin may replace contributions after stage completion.
- Settings contribution rules require `settings:manage`.
- All referenced IDs are current-tenant validated server-side and inside the RPC.

## 8. Audit and Historical Safety

- Removing entered effort before completion requires a reason.
- Every completed-stage correction requires a reason.
- Removed rows are cancelled/soft-deleted, never hard-deleted.
- Correction records are immutable and retain old/new worker, role, units, minutes, and amount.
- A status-only in-progress-to-completed change is not a correction and does not create a correction record.
- Item delivery at final workflow completion uses the mapped customer status's explicit `is_final_status` flag and never editable name matching.
- Configuration changes never update started/completed snapshots.
- Existing completed stages without a feature-era effort snapshot are immutable and cannot receive contribution backfills.
- Public tracking never exposes workers, roles, effort, rates, or contribution amounts.

## 9. Test Matrix

- Start one stage with two or more workers and explicit eligible roles.
- Reject foreign-tenant/inactive workers and ineligible or foreign workgroups.
- Permit one worker in two distinct eligible roles; reject duplicate worker-role pairs.
- Validate 0.10 unit and ten-minute increments.
- Verify first-assignment full-quantity default and zero defaults for additional assignments/time.
- Require unit totals at completion; require time for hours/hybrid stages.
- Verify elapsed hour versus five summed man-hours scenario.
- Verify per-unit, per-hour, percentage-by-unit, percentage-by-hour, rounding remainder, and no-rate results.
- Verify item-value basis excludes GST and reflects item discount.
- Verify configuration changes affect not-started stages only.
- Verify manager edits before completion and denial after completion.
- Verify owner/admin completed correction and mandatory reason.
- Verify effort removal reason and immutable audit history.
- Verify atomic rollback and duplicate/concurrent transition handling in a disposable database only.
- Verify salary, finance, order totals, and public tracking remain unchanged/private.
- Verify mobile layout, pending protection, error recovery, and duplicate-submit blocking.

## 10. Explicitly Deferred

- A composite or salary-linked worker efficiency score. The implemented worker contribution report keeps value, units, man-hours, and completed stages separate.
- Using contribution values in salary or payroll.
- Retrospective estimation/backfill for old completed stages.
- Work-unit/V2 contribution parity until the legacy item workflow is formally migrated.
