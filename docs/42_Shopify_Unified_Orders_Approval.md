# Unified Shopify Orders — local verification and hosted approval package

Historical approval package. See [44_Shopify_Unified_Deployment_Status.md](44_Shopify_Unified_Deployment_Status.md)
for the subsequent approved migration execution and current hosted limitations.

Status: implemented and rehearsed locally; NOT deployed or verified in the hosted
Phantom Threads Test tenant. No production tenant, source Shopify order or
Chat/CRM branch was changed. No shared SQL, Git push, webhook mutation, hosted
import or production credential access was performed in this implementation turn.

Branch: `codex/shopify-unified-orders-20261019`, based on `ce05822504387c79b997e41677aaf6f47267a26f`.
Changes remain local/uncommitted. Do not run the SQL merely because this file
exists. Approval is for a reviewed manifest/commit, not arbitrary later changes.

## What the user will see

1. **Connect:** verify the existing Test store connection and confirm retention.
2. **Import:** choose From/Through dates in India time, preview all results, then
   click Import new orders. Results distinguish New, Already in Orders, Reference
   match and Conflict. Matching manual orders are skipped, not overwritten or
   silently linked. Preview is capped at 2,000 orders and 31 days; larger ranges
   explicitly require narrowing. Preview expires after ten minutes.
3. **Automatic sync:** one action registers/reconciles this app's three order
   subscriptions and enables the Test policy. No mapping or release step.
4. Imported records appear in the **ordinary Orders table** as drafts, with
   Shopify Reference order ID, customer, lines and source payment facts.
5. Managers open the ordinary order, choose garment type/workflow/delivery, save
   partial work or complete setup. Completion creates the normal production
   items/stages once. Staff then use existing production commands.

The existing pilot order is refreshed into normalized retained details using its
same immutable ID when the owner enables the new setup. It is not copied again.
Source details remain visible alongside production after setup. Source changes
do not rewrite team work. Cancellation/refund holds continue to protect work.
No customer messages, local receipts or local GST postings are created.

## Local verification evidence

All data is fictional; Shopify HTTP responses are simulated. These are NOT
claims that live Shopify delivered a webhook or that hosted Test has passed.

- 45 unified-foundation checks: date boundaries/pagination, reference matching,
  immutable identity, existing-pilot upgrade, expired/stale previews, current
  roles, source freshness, retained data, manager setup and normal production.
- Actual manager service and SQL: draft → save → fresh Shopify version check →
  workflow → stitching → pickup/delivered. Exact retries produce one workflow;
  later cancellation preserves completed work and holds future operations.
- Local PostgreSQL 17.9/PostgREST: 71 migrations rehearsed on empty and populated
  fictional databases; 72 database regression checks and 28 independent-session
  checks passed. New races include retained imports, manual Reference insertion,
  manager saves/completion and date-range double submission.
- Local headless Edge: 18 assertions for actual setup/manager components at
  desktop and 375px mobile. Connect → preview → import → duplicate skip → sync
  on/off; partial draft save → interrupted save → corrected choices → complete.
  No page errors/horizontal page overflow. Visual inspection caught and fixed
  React form reset hiding saved dropdown values; explicit assertions cover it.
- Application, webhook, existing Orders UI and client/server boundary regression
  suites run separately. Tests overlap; do not add suite totals as unique tests.
- TypeScript, ESLint and local optimized Next.js build passed during rehearsal.
  Final package must be rebuilt after any subsequent source change.
- Owned Docker containers/network were removed. No global prune/reset or host
  business-data mount was used. Browser tests use temporary headless profiles,
  installed Edge and loopback only; no browser download is required.

Screenshots (fictional local preview): `outputs/shopify-unified/setup-desktop.png`,
`setup-mobile.png`, `manager-desktop.png`, `manager-mobile.png` (ignored artifacts).

## Exact new schema files, in order

These seven files modify the **shared database schema**, not a separate hosted
Test database. They seed no policies, enable no imports and update no existing
business rows on installation. New behaviour is opt-in/Test-bound. Some guarded
functions/triggers on shared tables change, so shared-schema approval is needed.

1. `supabase/migrations/20261019190000_shopify_import_preview.sql`
2. `supabase/migrations/20261019191000_shopify_retained_business_details.sql`
3. `supabase/migrations/20261019192000_shopify_unified_order_reads.sql`
4. `supabase/migrations/20261019193000_shopify_raw_retention.sql`
5. `supabase/migrations/20261019194000_shopify_manager_draft_setup.sql`
6. `supabase/migrations/20261019195000_shopify_complete_manager_setup.sql`
7. `supabase/migrations/20261019200000_shopify_unified_import_batches.sql`

File hashes are recorded in `43_Shopify_Unified_Migration_Manifest.md`.
Do not rerun historical migrations or change another branch. The last migration
checks the expected original cutoff definitions before replacing those two
checks with individually authorized date-range cutoffs; unexpected drift fails.
The connection's immutable cutoff is not rewritten.

## Required approval and safe deployment sequence

Approval needed: fresh read-only shared-schema comparison/recovery check, these
seven migrations, a reviewed Git release to the existing Vercel application,
and Test-only background scheduling/activation. The hosted application serves
production tenants too; deploying shared code is different from importing into
the production tenant. No production-tenant import is requested or authorized.

1. Confirm the exact Test tenant binding stays unchanged. Inspect current Git
   main for unrelated changes without checking out or merging Chat/CRM work.
2. Compare installed schema/owners/grants to the release baseline. Use
   `docs/sql/20261019_unified_orders_preflight.readonly.sql` as a minimum catalogue
   gate, not a substitute for full drift review. Confirm a fresh recoverable
   backup before shared DDL. No reset or data restore is part of deployment.
3. Pause only Shopify Test processing/intake during DDL. Use a maintenance window
   for shared table locks. Keep each migration in a transaction with bounded
   lock timeout; stop on the first error. Do not skip files or broaden grants.
4. Verify new tables have RLS and browser roles cannot execute privileged RPCs.
   Confirm no new unified policy has been seeded and non-opted-in tenants retain
   existing behaviour. Record checksums of the installed files.
5. Publish the reviewed commit through Git and wait for that exact Vercel commit
   to be Ready. This does not require interactive computer-use deployment.
6. Preserve all existing credentials and Test tenant/store binding. Add the new
   rollout switch `SHOPIFY_UNIFIED_ORDERS_ENABLED=true` only after schema install.
   Existing worker/intake/automatic-creation switches must be enabled for the
   approved Test flow. Never put secrets into chat, public documents or browser JS.
7. Verify background scheduling before clicking Connect/enable. New setup checks
   that `SHOPIFY_SCHEDULED_WORKER_ENABLED=true` and an existing valid
   `SHOPIFY_WORKER_SECRET` are provisioned; these flags alone do NOT prove an
   external scheduler is running.

## Background worker / one-day raw cleanup

The existing authenticated endpoint is ready for a scheduler:

- POST `https://os-plus.vercel.app/api/integrations/shopify/worker`
- `Content-Type: application/json`, body `{}`.
- Authorization: Bearer value from the existing private `SHOPIFY_WORKER_SECRET`.
- Suggested n8n schedule: once per minute, no overlapping executions, 60-second
  HTTP timeout. Each call processes at most one order and purges at most 100
  expired raw payloads plus bounded privacy contacts. Monitor failures/backlog;
  increase draining frequency/capacity deliberately for larger import volumes.
- Import screen also progresses jobs while open, in batches of at most 100 ticks.
  Navigation does not delete queued work; Continue import can resume. Webhook
  receipts schedule an immediate bounded attempt after durable acceptance.
- Raw expiry is 24 hours; physical deletion happens on the first successful
  cleanup tick after expiry (and may take further ticks for a backlog). Business
  orders/customers/normalized details remain. This is not exact-to-the-second
  deletion and cannot be promised while the scheduler is unavailable.
- With unified mode enabled, cleanup still runs when `SHOPIFY_SYNC_ENABLED=false`.
  Keep the scheduled-worker and pilot-runtime gates enabled for cleanup. Turning
  every gate off stops cleanup too. No external schedule has been created here.

## Hosted Test acceptance after approval

1. Sign in as owner and select **Phantom Threads Test**. Open Settings → Shopify.
2. Check the displayed store/Test binding. Confirm retention, click Verify and
   enable Test imports. The existing pilot draft should remain the same order.
3. Preview a small recent date range; inspect New/Already/Reference/Conflict rows.
   Import only New, then open Orders. Confirm all matching rows share one table.
4. Repeat the same import: zero duplicate orders/customers/workflows. Check the
   existing Reference match still points to the original manual order.
5. As manager, open one draft. Save incomplete choices, reload, then select Pant,
   Pant default workflow and Store pickup. Save, Complete setup, reload and retry
   once to verify a single workflow. Run its existing stages to delivery in Test.
6. Check paid/partial/unpaid source statuses and amounts against Shopify. Verify
   zero local payment receipts/messages. Do not charge, refund or edit Shopify.
7. Turn on automatic sync. Verify exact subscriptions and Test policy. Observe a
   genuine naturally occurring Shopify event, or an explicitly approved redelivery
   of an existing event; no synthetic test order in the production Shopify store.
   Record delivery ID, Test order ID and processing result. A locally signed
   synthetic notification is not proof of genuine Shopify delivery.
8. Verify scheduler invocation/recovery and raw expiry without deleting retained
   business records. Recheck tenant isolation and record hosted evidence.

Until these hosted checks pass, do not describe the integration as live-ready or
enable the production tenant. Cancelled/refunded, non-physical/gift-card,
non-INR or changed-quantity orders remain visible but completion fails closed;
they require separate explicit operational handling, not invented workflows.

## Stop / recovery

Disable automatic sync in Test to stop new automatic intake. Pause Test processing
if a write problem occurs; preserve cleanup scheduling and existing records.
Do not drop the new tables or restore an old full backup over ongoing business
activity. Roll code forward to a corrected compatible release. After new retained
orders exist, rolling back to an old pilot UI may hide them; that is not a safe
data rollback. Any schema/data restoration requires a separate concrete plan.
