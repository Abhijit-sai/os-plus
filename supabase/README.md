# Supabase

Run migrations against the target Supabase project with the Supabase CLI or dashboard SQL editor.

Initial migration:

- `20260517120000_foundation_tenants.sql`
- `20260518170000_configuration_foundation.sql`
- `20260518190000_workflow_configuration.sql`
- `20260519110000_worker_master.sql`
- `20260519123000_seed_configuration_defaults.sql`
- `20260519150000_customer_master_measurements.sql`
- `20260519170000_order_foundation.sql`
- `20260519183000_order_reference_and_numbering.sql`
- `20260519193000_workflow_execution_foundation.sql`
- `20260519203000_attendance_foundation.sql`

Foundation decisions:

- `tenants` is the SaaS root table.
- `tenant_users` maps Clerk identities to a tenant role and includes `tenant_id`.
- RLS is enabled immediately. The app currently uses server-side service-role queries after Clerk and tenant validation.
- Future tenant-owned tables must include `tenant_id`, tenant indexes, and server-side tenant filtering.
