# OS PLUS Codex Build Prompt

Use this prompt to start building OS PLUS with Codex or any coding agent.

---

You are an expert full-stack SaaS engineer.

We are building **OS PLUS**, a multi-tenant, white-label WorkOS for boutiques and small manufacturing businesses.

The first vertical is fashion boutiques, but the architecture must support other order-to-production businesses later.

## Tech Stack

- Next.js
- TypeScript
- Clerk for authentication
- Supabase Postgres for database
- Supabase Storage for files
- Tailwind CSS
- shadcn/ui
- Vercel deployment

## Product Context

OS PLUS helps a boutique manage:

- Customers
- Orders
- Order items
- Item-level workflows
- Production stages
- Worker assignments
- Work logs
- Attendance
- Salary suggestions
- Worker advances/loans
- Expenses
- Customer-facing tracking links
- Dashboards

## MVP Scope

Build only the MVP.

MVP includes:

- Multi-tenant SaaS foundation
- White-label tenant configuration
- Manual tenant creation by OS PLUS super admin
- Role-based access
- Manual order entry
- Customer profiles
- Customer phone suggestions
- Item Type Master
- Workflow configuration
- Stage Master
- Workgroups
- Worker master
- Item-level workflow execution
- Stage start/pause/resume/complete
- Multiple workers per stage
- Attendance
- Work logs
- Salary suggestions
- Worker ledger for advances/loans
- Expense tracking
- GST configuration/reporting planned as finance hardening
- Partial payments
- Partial pickup/dispatch
- Customer tracking page
- Production and at-risk dashboard

Do not build these in MVP:

- Shopify integration
- WhatsApp automation
- Direct GST filing/e-invoicing
- Inventory
- QR/barcode scanning
- Vendor management
- Worker login
- Customer login
- Mobile app
- OCR
- Custom domains

## Non-Negotiable Product Rules

1. OS PLUS is multi-tenant from day one.
2. Every tenant-owned table must include `tenant_id`.
3. No tenant can access another tenant’s data.
4. Clerk handles identity. OS PLUS handles tenant membership and roles.
5. Order is the commercial unit.
6. Order item is the production unit.
7. Workflow is assigned at item level.
8. Internal workflow stages and customer-facing statuses are separate.
9. Workers are not login users in MVP.
10. Managers/admins log work on behalf of workers.
11. Attendance and work logs are separate.
12. Salary is system-suggested and admin-finalized.
13. Customer tracking page must expose only customer-safe data.
14. Public tracking uses secure token, no login.
15. Every major item/stage status change creates item history.

## Customer Rules

- Customer name is mandatory.
- Phone number is optional.
- Email is optional.
- Gender is optional.
- Address is optional.
- Customer duplicates are allowed in MVP.
- Do not enforce unique phone number.
- When entering a phone number, show existing customer suggestions.
- User may select an existing customer or continue creating a new one.

## Workflow Rules

- Workflow is selected per item.
- MVP supports sequential workflow.
- Data model should allow parallel workflow later.
- Stage cannot start without worker assignment.
- Worker must belong to allowed workgroup for that stage.
- Stage can have multiple workers.
- Stage completion suggests next stage.
- Manager confirms movement to next stage.

## First Build Phase

Start with Phase 0 and Phase 1 only.

Build:

1. Next.js project setup
2. TypeScript
3. Tailwind CSS
4. shadcn/ui
5. Clerk auth
6. Supabase client
7. Database migration setup
8. `tenants` table
9. `tenant_users` table
10. Role enum
11. Tenant context helper
12. Permission helper
13. Super admin tenant creation
14. Tenant app shell
15. Sidebar navigation
16. Basic dashboard placeholder
17. `project_summary.md`

## Important Development Habit

Always update `project_summary.md` after each major development session.

Update it with:

- What was built
- Key decisions
- Files/modules changed
- Bugs found
- Bugs fixed
- Pending tasks
- Blockers
- Notes for next session

## Code Quality Expectations

- Use clean production-grade TypeScript.
- Use server-side tenant validation.
- Use Zod for input validation.
- Keep components modular.
- Keep feature folders organized.
- Do not hardcode tenant data.
- Do not build out-of-scope integrations.
- Keep MVP simple but extensible.
