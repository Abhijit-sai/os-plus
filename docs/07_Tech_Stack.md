# OS PLUS Tech Stack

## 1. Confirmed Stack

## Frontend

### Next.js

Use Next.js with TypeScript as the core web application framework.

Reasons:

- Suitable for SaaS dashboards
- Supports app router
- Supports server components and server actions
- Works well with Vercel
- Good ecosystem for auth, forms, charts, and UI

### TypeScript

Use TypeScript across the project.

Reasons:

- Reduces data-shape errors
- Useful for complex workflow and finance logic
- Better long-term maintainability

## UI

### Tailwind CSS

Use Tailwind CSS for styling.

Reasons:

- Fast UI development
- Responsive/mobile-first design
- Works well with shadcn/ui

### shadcn/ui

Use shadcn/ui for base components.

Suggested components:

- Button
- Input
- Select
- Dialog
- Sheet
- Tabs
- Table
- Card
- Badge
- Dropdown
- Calendar
- Command/search
- Form
- Toast

## Authentication

### Clerk

Use Clerk for authentication.

Reasons:

- Fast SaaS auth setup
- Good user management
- Supports invite flows
- Works well with Next.js

Usage:

- Login
- User identity
- Tenant user mapping through `tenant_users`
- Role-based access built in app layer

Important:

Clerk handles identity. OS PLUS handles tenant membership and roles.

## Database

### Supabase Postgres

Use Supabase Postgres as the primary database.

Reasons:

- Relational model is ideal for orders, items, workflows, workers, salary, and finance
- Works well with multi-tenant data
- Strong querying support for dashboards
- Can support RLS later if needed

Important:

Every tenant-owned table must include `tenant_id`.

## File Storage

### Supabase Storage

Use Supabase Storage for:

- Tenant logos
- Measurement card photos
- Design reference photos
- Item photos
- Stage attachments
- Expense receipts

All files should have records in the `attachments` table.

## Deployment

### Vercel

Use Vercel for deployment.

Reasons:

- Native Next.js hosting
- Easy preview deployments
- Simple environment variable management
- Good for fast MVP iteration

## 2. To Be Finalized

## Charts

Decision for Dashboard Phase 1:

Use **Recharts** as the chart engine.

Reasons:

- Compatible with the current React 19 app foundation.
- Flexible enough for custom dashboard widgets, side panes, and full analytics pages.
- Works well with server-prepared chart data and client-rendered chart components.
- Avoids locking dashboard design to a third-party component system.

Use **Tremor-inspired dashboard patterns** for visual direction where useful, but do not add `@tremor/react` as a dependency until React 19 compatibility is clean.

Tremor remains a visual/reference option for:

- Dense analytics cards
- Chart composition patterns
- KPI dashboard layout ideas
- Finance/operations dashboard inspiration

Dashboard chart requirements:

- Sales bar chart with count/amount toggle
- Worker productivity line chart
- Date range and daily/monthly grouping controls
- Side-pane drilldowns
- Full-page analytics customization

## Background Jobs

Options:

### Inngest

Good for:

- Event-driven jobs
- Future WhatsApp message triggers
- Delayed reminders
- Status-based automation

### Trigger.dev

Good for:

- Workflow-style background jobs
- External API integrations
- Job monitoring

### Supabase Edge Functions

Good for:

- Simple backend functions close to Supabase
- Lightweight jobs

Recommendation:

For MVP, avoid complex background infrastructure. Use server actions and scheduled checks only where needed. Choose Inngest/Trigger.dev when WhatsApp and reminders become more serious.

## OCR

Later options:

### Google Vision

Good for:

- High-quality OCR
- Measurement card photo extraction

### AWS Textract

Good for:

- Structured document extraction
- More enterprise-like OCR flows

### Tesseract

Good for:

- Low-cost experiments
- Basic OCR only

Recommendation:

Do not build OCR in MVP. Start with photo upload and manual entry.

## WhatsApp

Later option:

### Meta WhatsApp Cloud API

Use for:

- Tenant-level WhatsApp sender
- Template messages
- Tracking link CTA
- Status-triggered order updates

Important:

Each boutique should eventually use its own WhatsApp Business sender.

## 3. Suggested Libraries

## Forms and Validation

- react-hook-form
- zod
- @hookform/resolvers

Usage:

- Order forms
- Customer forms
- Workflow forms
- Salary adjustment forms
- Expense forms

## Tables

- TanStack Table

Usage:

- Orders list
- Customers list
- Workers list
- Expenses list
- Salary periods
- Reports

## Dates

- date-fns

Usage:

- Delivery dates
- Attendance dates
- Salary periods
- Due date calculations
- At-risk logic

## Icons

- lucide-react

Usage:

- Sidebar icons
- Dashboard cards
- Status indicators

## File Upload

Use Supabase Storage directly through controlled upload flows.

Possible later library:

- uploadthing, only if needed

## 4. Database Architecture

Core table groups:

### SaaS

- tenants
- tenant_users

### Configuration

- item_types
- stage_master
- customer_statuses
- workflows
- workflow_stages
- workgroups
- stage_workgroups
- payment_modes
- expense_categories

### Customer and Orders

- customers
- customer_measurements
- orders
- order_items
- order_payments

### Workflow Execution

- item_workflow_instances
- item_stage_instances
- item_stage_work_logs
- item_history
- attachments

### Workers and Salary

- workers
- worker_workgroups
- attendance
- worker_ledger
- salary_periods
- salary_calculations

### Finance

- expenses
- receivables_payables

## 5. Auth and Tenant Strategy

Clerk user ID should be stored in `tenant_users`.

Example:

```text
tenant_users
- id
- tenant_id
- clerk_user_id
- role
- status
```

On every protected request:

1. Get Clerk user.
2. Find active `tenant_users` record.
3. Load tenant.
4. Check role/permission.
5. Query only tenant-scoped records.

## 6. Role Strategy

MVP roles:

- owner_admin
- manager
- finance
- viewer

Role permissions can initially be code-based.

Later, we can add custom permission tables.

## 7. Storage Strategy

Suggested Supabase buckets:

- tenant-assets
- customer-attachments
- order-attachments
- item-attachments
- stage-attachments
- expense-receipts

All uploads should create an `attachments` table record where applicable.

## 8. Public Tracking Strategy

Use route:

```text
/track/:trackingToken
```

Rules:

- No Clerk login required
- Token must be random and non-guessable
- Fetch only safe order and item fields
- Show tenant branding
- Show customer-facing statuses only
- Show only customer-visible attachments

## 9. Open Source / Reference Tools

Use references only for inspiration. Do not blindly copy architecture.

Potential references:

- Supabase admin/internal tool patterns
- Open-source ERP/CRM dashboards for finance UI inspiration
- Workflow UI libraries later for visual workflow builder

Recommendation:

Build the workflow engine ourselves for MVP because this is a human production workflow, not an automation pipeline.

## 10. Future Integration Stack

### Shopify

- Shopify OAuth per tenant
- Order import
- SKU to item type mapping
- Product to workflow mapping

### WhatsApp

- Meta WhatsApp Cloud API
- Template approval
- Tenant sender configuration
- Message logs

### Accounting

- Zoho Books API
- Tally integration
- GST invoice generation later

### Inventory

- Postgres-based inventory tables
- Raw material and finished goods modules

## 11. Recommended Initial Install Packages

```bash
npx create-next-app@latest os-plus --typescript --tailwind --eslint
npm install @clerk/nextjs @supabase/supabase-js zod react-hook-form @hookform/resolvers date-fns lucide-react @tanstack/react-table recharts
npx shadcn@latest init
```

Add shadcn components as needed:

```bash
npx shadcn@latest add button input textarea select dialog sheet tabs table card badge dropdown-menu calendar form toast command
```
