# OS PLUS Site Map

## 1. Public / Auth Routes

```text
/
/sign-in
/sign-up
/track/:trackingToken
```

## 2. Super Admin Routes

Used by OS PLUS internal admin team.

```text
/super-admin
/super-admin/tenants
/super-admin/tenants/new
/super-admin/tenants/:tenantId
/super-admin/tenants/:tenantId/edit
/super-admin/support-access
```

## 3. Tenant App Routes

Tenant app routes are available only after login and tenant context resolution.

## 3.1 Dashboard

```text
/dashboard
```

Dashboard sections:

- Production and at-risk overview
- Owner summary cards
- Worker summary cards
- Finance summary cards

## 3.2 Orders

```text
/orders
/orders/new
/orders/:orderId
/orders/:orderId/edit
/orders/:orderId/items/:itemId
/orders/:orderId/payments
/orders/:orderId/tracking
```

### Orders List

Purpose:

- View and filter all orders

Filters:

- Order source
- Customer
- Payment status
- Delivery date
- At-risk status
- Order status

### New Order

Purpose:

- Create manual order
- Select/create customer
- Add multiple order items
- Add payment details
- Assign workflow at item level

### Order Detail

Sections:

- Order summary
- Customer details
- Payment summary
- Item list
- Delivery information
- Tracking link
- Notes
- Timeline/history

## 3.3 Production

```text
/production
/production/board
/production/at-risk
/production/due-today
/production/due-soon
/production/blocked
/production/items/:itemId
/production/items/:itemId/workflow
/production/items/:itemId/history
```

### Production Dashboard

Purpose:

- Give manager a real-time view of production workload

### Production Board

Possible views:

- By stage
- By workflow
- By due date
- By worker

### Item Workflow Page

Purpose:

- Start stage
- Assign worker
- Pause/resume
- Complete stage
- Add notes
- Add attachments
- Move to next stage

## 3.4 Customers

```text
/customers
/customers/new
/customers/:customerId
/customers/:customerId/edit
/customers/:customerId/orders
/customers/:customerId/measurements
/customers/:customerId/attachments
```

### Customers List

Features:

- Search by name
- Search by phone
- View customer order count

### Customer Detail

Sections:

- Profile
- Contact details
- Order history
- Measurements
- Notes
- Attachments

### Customer Rules

- Name mandatory
- Phone optional
- Email optional
- Gender optional
- If the same canonical E.164 phone already exists in the current tenant, select that customer and do not create a duplicate
- Owner/admin can open an Import file side panel for write-free CSV/XLSX preview, conflict review, and atomic confirmation
- Phone number entry should show existing customer suggestions

## 3.5 Workers

```text
/workers
/workers/new
/workers/:workerId
/workers/:workerId/edit
/workers/:workerId/attendance
/workers/:workerId/worklogs
/workers/:workerId/ledger
/workers/:workerId/salary
```

### Workers List

Features:

- Search worker
- Filter by workgroup
- Filter by status

### Worker Detail

Sections:

- Profile
- Workgroups
- Attendance
- Work logs
- Productivity
- Ledger
- Salary history

## 3.6 Attendance

```text
/attendance
/attendance/daily
/attendance/monthly
/attendance/workers/:workerId
```

### Daily Attendance

Features:

- Mark present/absent/half-day/leave/holiday
- Add check-in/check-out
- Add notes

### Monthly Attendance

Features:

- Calendar-style overview
- Worker-wise attendance summary

## 3.7 Salary

```text
/salary
/salary/periods
/salary/periods/new
/salary/periods/:periodId
/salary/workers/:workerId
```

### Salary Periods

Features:

- Create salary period
- Generate salary suggestions
- Review salary calculations
- Apply deductions/adjustments
- Finalize salary
- Mark paid

## 3.8 Finance

```text
/finance
/finance/payments
/finance/expenses
/finance/expenses/new
/finance/expenses/:expenseId
/finance/receivables
/finance/payables
/finance/reminders
```

### Finance Overview

Sections:

- Revenue collected
- Pending receivables
- Expenses
- Salary payable
- Net cash movement
- Upcoming payables
- Upcoming receivables

## 3.9 Reports

```text
/reports
/reports/orders
/reports/production
/reports/workers
/reports/finance
```

### Order Reports

- Order volume
- Order value
- Payment pending
- Source-wise orders

### Production Reports

- Items completed
- Items delayed
- Workflow performance
- Stage bottlenecks

### Worker Reports

- Attendance
- Productive hours
- Units completed
- Leaderboard

### Finance Reports

- Expense category summary
- Salary payouts
- Receivables
- Payables

## 3.10 Settings

```text
/settings
/settings/business-profile
/settings/branding
/settings/users
/settings/item-types
/settings/stages
/settings/customer-statuses
/settings/workflows
/settings/workflows/new
/settings/workflows/:workflowId
/settings/workgroups
/settings/workers
/settings/measurement-standards
/settings/payment-modes
/settings/expense-categories
```

### Business Profile

- Store name
- Logo
- Brand color
- Address
- Contact details

### Users

- Invite user
- Assign role
- Disable user

### Item Types

- Shirt
- Pant
- Kurtha
- Blazer
- Custom item types

### Stages

- Master list of internal stages

### Customer Statuses

- Customer-facing status labels

### Workflows

- Configure sequential workflow
- Add stages
- Map workgroups
- Map customer statuses

### Workgroups

- Master
- Tailor
- Designer
- Finisher
- Packer
- QC

## 4. Mobile-First Screens

The following screens must be especially usable on mobile:

- `/orders/new`
- `/production`
- `/production/items/:itemId/workflow`
- `/attendance/daily`
- `/track/:trackingToken`

## 5. Navigation Grouping

Suggested sidebar:

```text
Dashboard
Orders
Production
Customers
Workers
Attendance
Salary
Finance
Reports
Settings
```

Role-based visibility:

- Owner/Admin: all modules
- Manager: Dashboard, Orders, Production, Customers, Workers, Attendance, limited Reports
- Finance: Dashboard, Orders read-only, Finance, Salary, Workers ledger, Reports
- Viewer: Dashboard and permitted reports only
