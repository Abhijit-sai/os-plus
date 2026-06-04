# OS PLUS

OS PLUS is a multi-tenant, white-label WorkOS for boutiques and small manufacturing businesses.

The first vertical is a fashion boutique, but the foundation is designed for order-to-production businesses where each order item moves through configurable human workflow stages.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Clerk authentication
- Supabase Postgres and Storage
- Vercel

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.
3. Add Clerk and Supabase credentials.
4. Run the app:

```bash
npm run dev
```

## Tenant Rules

- Clerk handles identity.
- OS PLUS handles tenant membership and role authorization.
- Every tenant-owned table must include `tenant_id`.
- Every server query for tenant-owned data must resolve and filter by tenant context.
- Public tracking pages must expose only customer-safe fields.
