# OS PLUS Product and Engineering Rules

## 1. Non-Negotiable Product Rules

1. OS PLUS is multi-tenant from day one.
2. Each boutique/business is a tenant.
3. Each tenant has its own users, orders, customers, workers, workflows, expenses, settings, and tracking pages.
4. Order is the commercial unit.
5. Order item is the production unit.
6. Workflow is selected at item level.
7. Internal workflow stages and customer-facing statuses are separate.
8. Workers are not app users in MVP.
9. Managers/admins log work on behalf of workers.
10. Attendance and production work logs are separate.
11. Salary is system-suggested and admin-finalized.
12. Finance in MVP is operational tracking, not full accounting.
13. Customer tracking page must expose only customer-safe data.
14. Shopify is not part of MVP.
15. Campaign-style WhatsApp automation is not part of MVP; tenant-scoped transactional WhatsApp/email alerts are allowed as a controlled communication foundation.
16. Inventory is not part of MVP.
17. GST configuration/reporting is a planned finance hardening feature; direct GST filing/e-invoicing is later.
18. QR/barcode is not part of MVP.
19. Mobile-first internal production screens are required.
20. Every major item/workflow status change must create history.

## 2. Tenant and Security Rules

1. Every tenant-owned table must include `tenant_id`.
2. Every tenant-owned query must filter by `tenant_id`.
3. Do not rely only on client-side tenant filtering.
4. Tenant context must be resolved on the server.
5. A user from Tenant A must never be able to access Tenant B data.
6. Super admin access must be clearly separated from tenant access.
7. Public tracking pages must use secure random tokens.
8. Public tracking pages must not expose internal IDs unnecessarily.
9. Public tracking pages must not expose internal notes, worker names, salary, work logs, or internal-only attachments.
10. Attachments should be shown publicly only if `is_customer_visible = true`.

## 3. Customer Rules

1. Customer name is mandatory.
2. Phone number is optional.
3. Email is optional.
4. Gender is optional.
5. Address is optional.
6. When a phone number is present, normalize valid numbers to E.164. Indian 10-digit, leading `0`, `+91`, and `0091` inputs remain accepted; explicit `+`/`00` international formats are accepted; national-format foreign numbers require a reliable country code.
7. Before saving, the server must check active customers in the current tenant for the same normalized mobile number.
8. If a matching customer exists, the application must not create a duplicate; it must resolve and select the existing customer.
9. Phone suggestions should still be shown while entering a customer so the user can select a match immediately.
10. The legacy collision audit found no active collisions. Canonical normalized phone storage and a tenant-level active uniqueness constraint must backstop the application guard.
11. Customer profile should maintain order history.
12. Customer profile should maintain measurements.
13. Measurements can be stored as notes, photos, and key-value fields.
14. Measurement-field key/item type, standard-size item type, and customer-measurement item type are immutable after creation. Create a new record instead of repointing historical fit references.
15. Customer file import is owner/admin-only, write-free during preview, limited to CSV/XLSX files of 5 MB and 5,000 data rows, and atomic during confirmation.
16. Import reuse priority is tenant-scoped Shopify customer ID, then normalized E.164 phone. Email-only matches require explicit review.
17. Reused customers may receive values only in blank profile fields; populated-field conflicts must be shown and never overwritten automatically.
18. Shopify historical and marketing fields are source metadata only. They do not create historical orders, affect reports, or grant messaging consent.

## 4. Order Rules

1. An order can contain multiple items.
2. Order has one promised delivery date.
3. Each item can have its own expected completion date.
4. Order-level delivery type applies to all items unless overridden at item level.
5. Partial payment must be supported.
6. Partial pickup/dispatch must be supported.
7. Order status and item status are separate.
8. At-risk order status should be derived from item-level risk.
9. Order number should be unique within a tenant if possible, but manual override may be needed later.
10. Order source should be tracked.

## 5. Order Item Rules

1. Each order item is a production unit.
2. Each item should have an item type.
3. Each item should have a workflow.
4. Each item can have its own expected completion date.
5. Each item can have its own customer-facing status.
6. Each item can have its own attachments.
7. Each item can have a final photo.
8. If quantity is greater than 1 and each piece must be tracked separately, create separate item rows.

## 6. Workflow Rules

1. Workflow is assigned at item level.
2. Workflow is built from stages in Stage Master.
3. MVP workflow is sequential.
4. Database should allow parallel stages later.
5. Stage cannot start without at least one worker assignment.
6. Worker must belong to one of the allowed workgroups for that stage.
7. A stage can have multiple workers.
8. Stage completion should suggest the next stage.
9. Manager must confirm movement to next stage.
10. Every stage start, pause, resume, complete, skip, or block event should create history.
11. Stage notes should be supported.
12. Stage attachments should be supported.
13. Customer-facing status should update based on stage mapping.
14. Workflow creation, default mapping, and stage-sequence replacement must be atomic.
15. A default workflow must have an item type and remain active; every active workflow must retain at least one active stage. Workflow activation and last-stage deactivation must serialize in workflow-then-stage lock order.

## 7. Worker Rules

1. Workers are operational resources, not system users in MVP.
2. Workers can belong to multiple workgroups.
3. Worker assignment to a stage is restricted by allowed workgroups.
4. Worker status should support active/inactive.
5. Worker wage type should be configurable.
6. Hourly, daily, weekly, and monthly wages should be supported in MVP.
7. Per-piece and hybrid wage types can be schema-supported but UI-hidden initially.

## 8. Attendance Rules

1. Attendance is separate from work logs.
2. Attendance can be manually marked or imported by admin/manager in MVP.
3. Attendance status values should include present, absent, half day, leave, and holiday.
4. Attendance should support check-in and check-out times.
5. Attendance should not automatically equal productive work time.
6. Attendance import may update only active workers whose normalized source name has exactly one matching profile in the current tenant.
7. Attendance import must not create workers or use fuzzy name matching; unmatched and ambiguous names are skipped and reported.
8. Attendance import preview must not write data, and confirmation must revalidate the file fingerprint, tenant ownership, names, and dates.
9. Future dates, blank statuses, and unknown status codes must not be imported.
10. A confirmed workbook import must be atomic and idempotent and must store a tenant-scoped audit receipt.
11. Attendance import receipts are immutable audit records; direct update or deletion is forbidden.

## 9. Work Log Rules

1. Work logs record actual production effort.
2. Work log must be linked to worker, order item, and stage instance.
3. Work logs should have start time and completion time.
4. Pause/resume should be supported.
5. Duration should be calculated where possible.
6. Manual correction should be possible by authorized users.
7. Work logs power productivity reports and salary suggestions.
8. Every worker contribution must identify an allowed workgroup that the worker belongs to; no client-supplied worker, workgroup, stage, or item ID is trusted without current-tenant validation.
9. Stage effort mode is none, units, hours, or hybrid. Hybrid requires both units and credited minutes for analytics.
10. Credited units use 0.10 increments. Unit and hybrid stages must total the item quantity before completion.
11. Credited effort uses ten-minute increments. Stage elapsed time and summed man-hours are separate values.
12. Monetary contribution rules are optional per item-type/stage and support per-unit, per-hour, or one percentage pool distributed by units or hours.
13. Percentage basis is the item final value after item discount and before GST. It is never the order GST-inclusive total.
14. Stage start snapshots effort mode, calculation method, rate, allocation basis, item basis value, and pool value. Configuration changes do not rewrite active or completed snapshots.
15. No configured monetary rule means production proceeds with zero calculated contribution and a visible warning.
16. Managers and owner/admin may edit contributions before completion. Removing a contribution with entered effort requires a reason and immutable audit history.
17. Completed contribution correction is owner/admin-only and always requires a reason.
18. Existing completed stages are not backfilled or estimated.
19. Contribution amounts are operational analytics only. They must not alter salary suggestions, wage configuration, order totals, GST, payments, expenses, or ledgers.
20. Stage contribution start, replacement, and completion must be atomic, tenant-scoped, row-locked, and protected against duplicate transition submission.
21. The first unit-tracked assignment defaults to the full item quantity; added assignments default to zero and require deliberate redistribution.
22. Contribution reports include only completed work, group it by completion week, and expose value, units, man-hours, and completed stages as separate metrics. Contribution value is not salary, payroll, order revenue, or a universal efficiency score.
23. Contribution reporting must show rate-configuration coverage so INR 0 caused by a missing rule is distinguishable from configured work.
24. Percentage-pool allocation uses non-negative largest-remainder distribution in integer paise, with deterministic worker/workgroup ordering. Allocated rows must sum exactly to the snapshotted pool even when the pool is smaller than the number of workers.
25. Ordinary work-log status movement from in progress to completed is not a contribution correction. Audit rows are created only when worker, role, units, time, or calculated contribution actually changes.
26. Workflow completion must never infer delivery from editable stage or status names. Only the explicit final customer-status flag may mark the production item delivered in this flow.

## 10. Salary Rules

1. Salary is suggested by the system.
2. Admin/finance user finalizes actual payment.
3. Salary should consider wage type, attendance, work logs, advances/loans, deductions, and manual adjustments.
4. Worker ledger should track advances, loans, repayments, deductions, adjustments, and salary payments.
5. Do not treat MVP salary module as statutory payroll.
6. Salary periods should have statuses: draft, reviewed, finalized, paid.
7. Salary UX must reduce founder anxiety: history and clarity first, detailed calculation controls second.
8. Salary default view should show weekly/monthly/custom-range history, worker-wise payment history, paid/due totals, and salary expense trend.
9. Salary period creation must prevent overlapping active periods for the same tenant.
10. Salary must prevent duplicate worker salary calculations for the same worker and period.
11. Salary payment recording must protect against accidental double-submit and should warn or block overpayment beyond outstanding payable.
12. Salary suggestions must not silently overwrite founder-finalized payable values.
13. Salary amounts, notes, periods, and payments must be editable with tenant validation and audit fields.
14. Detailed calculation rows should live in focused drilldowns or period workspaces, not overwhelm the default salary dashboard.

## 11. Finance Rules

1. Finance module in MVP is for operational tracking only.
2. GST configuration/reporting may be added as finance hardening; direct GST filing/e-invoicing is later.
3. Track order payments and partial payments.
4. Track payment mode.
5. Track expenses by category.
6. Track receivables and payables.
7. Track due dates and reminders.
8. Vendor master is later.
9. Tally/Zoho Books integration is later.
10. Salary payments from the Salary module must roll up to Finance as Salary expense.
11. Finance should not require or encourage duplicate manual salary expense entries for salary payments already recorded in Salary.
12. Cash payment mode and GST treatment are separate; cash collections must still be recorded and must not be treated as automatically non-reportable.
13. New order payments and payment corrections must lock the order, validate the tenant and payment mode, reject overpayment, write the payment change, and recalculate the summary in one transaction.
14. Payment corrections must retain an immutable before/after snapshot, actor, and required reason; payment history must never be silently overwritten.

## 12. Dashboard Rules

1. First polished dashboard should be Production and At-Risk.
2. At-risk logic should start simple.
3. MVP at-risk item rule: expected completion date is within 2 days and item is not completed.
4. Order is at risk if any item is at risk.
5. Dashboards should be filterable by date range where relevant.
6. Worker dashboard should compare attendance time and productive work time.
7. Finance dashboard should show inflow/outflow summary.

## 13. Customer Tracking Rules

1. Tracking link should be token-based.
2. Customer should not need login.
3. Tracking page must be mobile-first.
4. Tracking page should show tenant branding.
5. Tracking page should show simplified customer-facing statuses only.
6. Tracking page should show customer-visible photos only.
7. Tracking page should not expose internal details.

## 14. Engineering Rules

1. Use TypeScript strictly.
2. Validate inputs with Zod or equivalent.
3. Use consistent server-side tenant validation.
4. Do not hardcode tenant data.
5. Use reusable components for forms, tables, cards, and filters.
6. Use soft delete for operational records.
7. Maintain created/updated timestamps.
8. Maintain created_by/updated_by where useful.
9. Keep migrations clean and versioned.
10. Update `project_summary.md` after every major development session.
11. Do not update `docs/05_Project_Summary.md`; it is archived historical context. New sessions should read the root `project_summary.md` plus the relevant product/tech docs instead.
12. Tasks is Laundry-only in the current phase. Navigation, route queries, and mutations must all assert that the current tenant has the Laundry vertical enabled.

## 15. UX Rules

1. Internal production update screens should be mobile-first.
2. Forms should support fast data entry.
3. Long forms should be broken into sections.
4. Customer selection should show suggestions while typing phone/name.
5. Workflows should be shown visually as a timeline/stepper.
6. At-risk items should be visually prominent.
7. Avoid cluttering dashboards with too many charts in MVP.
8. Customer tracking page should be clean and simple.

### Item-type presentation rules

1. Item-type icon identity is optional, authenticated-only presentation metadata. It is either one valid Unicode emoji or one valid Lucide icon name with an allowed color token, never both.
2. Missing identity uses the neutral garment icon; the system must never invent or infer a category without an explicit saved choice.
3. Existing emoji records remain valid. Emoji skin tone is encoded in the saved grapheme; native emoji cannot receive arbitrary icon colors.
4. The default picker layer shows name-matched and recent suggestions. Full Emoji and Icons layers must be searchable; custom artwork upload is out of scope.
5. Picker/catalogue code must load only when opened. Emojibase English files are self-hosted static assets, and unfiltered Lucide results must be batched so the picker does not request the entire icon set at once.
6. Picker buttons must have descriptive accessible names, visible selected state, keyboard operation, and mobile-sized targets. Selection must notify the unsaved-change guard.
7. Item-type filters are ID-based and every option is loaded from the current tenant server-side.
8. Filter URLs may contain repeated IDs, but unknown/cross-tenant IDs must match no tenant data and must never broaden results.
9. Public tracking must never select, serialize, or render any item-type icon field.

### Modal action lifecycle

1. A successful modal save closes the modal and clears its local draft by unmounting it.
2. Failed or pending modal saves must not close, discard user input, or allow duplicate submission.
3. Production workflow and garment predicates must be applied before pagination.
4. Malformed or foreign filter IDs must never broaden a result set.
5. Filter disclosures must announce expanded state and close with Escape.
