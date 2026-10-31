# Disposable Chat database tests

Requirements: repository npm ci, npm ci --prefix scripts/shopify-db-harness (existing locked pg dependency), Docker with Linux engine, and the already-local PostgreSQL 17 Alpine image whose immutable ID is pinned in database.mjs.

```powershell
npm run test:chat
```

The harness does not install/pull images, read application .env files, accept a shared database URL or use Supabase production. It runs --pull=never, a unique container name and nonce ownership label, loopback ephemeral port, tmpfs, 1 GiB memory limit and random in-memory credentials. Cleanup verifies ownership before removing its own container. A missing Docker engine/image is a failed test, never a pass or silent skip.

All repository SQL migrations are replayed. Minimal Supabase roles/storage schema and the inherited optional handover dependency shape are explicitly synthetic. Real PostgreSQL clients exercise transactions, rollback, foreign keys, ACL/RLS and concurrency.

server-adapter.mjs loads production server command/query modules while replacing Clerk context and PostgREST wire transport with a local pg adapter. SQL and production control flow remain real. This does not replace authenticated browser, Supabase PostgREST or hosted acceptance.
See ../../docs_chat/CH1_QA.md.
