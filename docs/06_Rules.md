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
6. Customer duplicates are allowed in MVP.
7. There is no strict no-duplicates restriction at customer level for now.
8. When entering a phone number, if existing customers match, suggestions must be shown.
9. User can select an existing suggested customer.
10. User can still create a new customer even if suggestions are shown.
11. Customer profile should maintain order history.
12. Customer profile should maintain measurements.
13. Measurements can be stored as notes, photos, and key-value fields.

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
2. Attendance is manually marked by admin/manager in MVP.
3. Attendance status values should include present, absent, half day, leave, and holiday.
4. Attendance should support check-in and check-out times.
5. Attendance should not automatically equal productive work time.

## 9. Work Log Rules

1. Work logs record actual production effort.
2. Work log must be linked to worker, order item, and stage instance.
3. Work logs should have start time and completion time.
4. Pause/resume should be supported.
5. Duration should be calculated where possible.
6. Manual correction should be possible by authorized users.
7. Work logs power productivity reports and salary suggestions.

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

## 15. UX Rules

1. Internal production update screens should be mobile-first.
2. Forms should support fast data entry.
3. Long forms should be broken into sections.
4. Customer selection should show suggestions while typing phone/name.
5. Workflows should be shown visually as a timeline/stepper.
6. At-risk items should be visually prominent.
7. Avoid cluttering dashboards with too many charts in MVP.
8. Customer tracking page should be clean and simple.
