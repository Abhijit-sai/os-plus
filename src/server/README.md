# Server

Server actions, queries, and mutations should resolve Clerk identity, tenant context, role permissions, and `tenant_id` filters before touching tenant-owned data.
