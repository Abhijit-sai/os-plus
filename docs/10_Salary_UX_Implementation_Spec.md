# Salary UX Implementation Spec

## 1. Product Intent

The Salary module must help a solo founder feel in control, not anxious.

The current salary page exposes too much at once: gross suggestion, deductions, founder payable, worker rows, finalization forms, payment forms, period creation, ledger entry, and period ledger. It is technically useful but emotionally heavy.

The redesigned Salary module should answer three calm questions first:

- How much salary have I paid recently?
- Who has been paid, who is due, and how has each worker's payment history looked?
- How do I add salary for a period without creating wrong or duplicate entries?

## 2. Information Architecture

Salary should have three top-level views.

### 2.1 Overview

Default view.

Purpose: show salary history and current payment position.

Content:

- Date range controls: 7 days, 30 days, month to date, custom.
- KPI cards:
  - Salary paid in range
  - Salary due
  - Workers paid
  - Pending salary periods
- Salary paid trend chart.
- Worker-wise payment history table.
- Recent salary payments list.
- Calm empty state when there are no salary payments yet.

This view should not show finalization forms or payment forms inline.

### 2.2 Periods

Purpose: manage salary periods.

Content:

- List of salary periods with status, range, payable, paid, due, and worker count.
- Clear badges: Draft, Ready to pay, Partially paid, Paid.
- Primary action: Add salary period.
- Each period opens a focused period workspace.

### 2.3 Period Workspace

Purpose: review and pay one salary period without page-wide clutter.

Content:

- Period header: date range, status, total suggested, final payable, paid, due.
- Guided steps:
  - Step 1: Review attendance and suggestions.
  - Step 2: Confirm/finalize payable amounts.
  - Step 3: Record payment.
- Worker rows should be compact by default:
  - Worker name
  - Wage type
  - Suggested amount
  - Final amount
  - Paid
  - Due
  - Status
- Worker detail opens in a side pane or inline expansion:
  - Attendance days/hours
  - Productive hours
  - Ledger deductions/credits
  - Finalization note
  - Payment history for this period
- Payment action should focus on one worker or a selected batch, not every worker row at once.

## 3. Core UX Decisions

- Do not show all forms by default.
- Use progressive disclosure for calculation details.
- Use clear success and blocked states.
- Prefer one primary action per view.
- Make mistakes feel recoverable.
- Keep Salary separate from statutory payroll.
- Keep Finance as a clean rollup, not a duplicate entry surface.

## 4. Data Requirements

Existing tables are enough for the first redesign:

- `salary_periods`
- `salary_calculations`
- `worker_ledger`
- `workers`
- `payment_modes`
- `attendance`
- `item_stage_work_logs`

No required schema migration for the first UI restructure.

Potential later migration:

- Add idempotency key or source reference to salary-paid ledger entries if duplicate-submit protection cannot be handled cleanly in the server action.
- Add explicit cancellation fields if salary period cancellation needs more than soft delete.

## 5. Query Layer Changes

Create salary query helpers around user tasks instead of one broad page payload.

### 5.1 `getSalaryOverviewData`

Inputs:

- date range
- tenant context

Returns:

- salary payments in range from `worker_ledger.transaction_type = salary_paid`
- worker list
- payment modes
- period summaries
- totals: paid, due, finalized payable, worker count paid
- chart points grouped by day or month depending on range
- worker-wise paid totals and last payment date

### 5.2 `getSalaryPeriodsData`

Returns:

- salary periods
- calculated totals per period:
  - suggested
  - founder payable
  - paid
  - due
  - worker count
  - finalized count
  - paid count

### 5.3 `getSalaryPeriodWorkspaceData`

Input:

- period id

Returns:

- period
- calculations for the period
- workers for those calculations
- ledger entries linked to the period
- payment modes
- review signals

## 6. Server Action Changes

### 6.1 Create Salary Period

Current behavior:

- Creates a period and generates suggestions.

Required behavior:

- Validate start/end.
- Reject overlapping active salary periods for the tenant.
- Return a calm message if overlap exists:
  - "This date range already overlaps an existing salary period. Open that period or choose a different range."
- Generate suggestions after creation.
- Redirect or link the founder into the new period workspace.

Overlap rule:

```text
existing.period_start <= new.period_end
AND existing.period_end >= new.period_start
AND existing.deleted_at IS NULL
```

### 6.2 Regenerate Suggestions

Current behavior:

- Soft-deletes existing active calculations for the period and inserts new rows.

Required behavior:

- Do not silently replace finalized rows.
- If any row has `finalized_payable_amount IS NOT NULL` or `amount_paid > 0`, block regeneration with a clear message.
- Later option: regenerate draft-only rows while preserving finalized/payment rows.

### 6.3 Finalize Worker Salary

Current behavior:

- Updates `finalized_payable_amount`, note, timestamp, and status.

Required behavior:

- Keep this action, but move it into focused period workspace.
- Support editing finalized payable and note.
- If amount differs from suggestion, keep note visible and recommended.

### 6.4 Record Salary Payment

Current behavior:

- Inserts worker ledger `salary_paid`, updates calculation amount paid/status.

Required behavior:

- Default amount to outstanding due.
- Block amount greater than outstanding due for MVP.
- Validate linked salary period belongs to tenant.
- Validate payment mode belongs to tenant.
- Add duplicate-submit protection.
- After payment, update period status and revalidate Salary and Finance.

MVP duplicate-submit guard:

- Before insert, check whether a matching active `salary_paid` ledger entry exists for:
  - tenant
  - worker
  - linked salary period
  - amount
  - transaction date
  - payment mode
  - created recently
- If matched, do not insert again; return a friendly already-recorded result.

### 6.5 Edit Salary Payment

New action.

Purpose:

- Let founder correct wrong payment amount, date, mode, or note.

Rules:

- Validate ledger entry belongs to tenant.
- Only `salary_paid` entries can be edited through Salary payment UI.
- Recompute salary calculation `amount_paid` from active linked salary-paid entries after edit.
- Refresh period status.

### 6.6 Cancel Salary Payment

New action.

Purpose:

- Soft-delete a mistaken salary payment.

Rules:

- Validate tenant.
- Set `deleted_at`, `updated_at`, `updated_by`.
- Recompute amount paid/status.
- Refresh period status.

## 7. Finance Integration

Finance already reads salary payments from `worker_ledger` with `transaction_type = salary_paid`.

Required Finance behavior:

- Continue treating salary payments as cash out.
- Continue grouping salary payments under Salary expense.
- Do not create manual `expenses` rows for Salary module payments.
- Manual expense entry can still allow Salary category for legacy/manual cases, but the UI should make Salary module the preferred path.

## 8. UI Shape

### 8.1 Salary Page Header

Title: Salary

Description:

```text
Track salary paid, dues, and worker payment history. Add salary through guided periods.
```

Primary CTA:

```text
Add salary period
```

Secondary CTA:

```text
View periods
```

### 8.2 Overview Layout

Top row:

- Date range control
- Add salary period button

KPI row:

- Paid
- Due
- Workers paid
- Pending periods

Main content:

- Salary paid trend chart
- Worker payment history

Secondary content:

- Recent payments
- Pending periods needing action

### 8.3 Add Salary Period Flow

Use a focused dialog or dedicated page.

Steps:

1. Choose period start/end.
2. System validates overlap.
3. Show summary:
   - Active workers
   - Attendance coverage
   - Expected suggestions
4. Create period and generate suggestions.
5. Open period workspace.

### 8.4 Period Workspace Layout

Top:

- Period range
- Status
- Suggested/final/paid/due summary

Middle:

- Worker salary table with compact rows.

Row actions:

- Review
- Finalize
- Record payment

Details:

- Side pane or expansion, not inline by default.

## 9. Implementation Order

1. Add query helpers for overview, periods, and period workspace.
2. Add server guardrails:
   - overlap validation
   - regeneration protection
   - payment overpay block
   - duplicate payment guard
3. Redesign `/salary` overview.
4. Add `/salary/periods` or `?view=periods`.
5. Add focused period workspace, preferably `/salary/periods/[periodId]` or `?periodId=...`.
6. Move finalization/payment controls into the period workspace.
7. Add edit/cancel salary payment actions.
8. Verify Finance salary rollup still works.
9. Run authenticated smoke tests with Phantom Threads data.

## 10. Acceptance Criteria

- Salary default page no longer shows every worker finalization/payment form at once.
- Founder can see salary paid over custom date ranges.
- Founder can see worker-wise salary payment history.
- Founder can create a salary period only if it does not overlap another active period.
- Regeneration cannot erase finalized or paid salary decisions.
- Salary payment cannot exceed outstanding payable in MVP.
- Accidental double submit does not create duplicate salary-paid ledger entries.
- Salary payment can be edited or cancelled.
- Finance shows Salary as a salary expense rollup from Salary module payments.
- Typecheck, lint, and build pass.
