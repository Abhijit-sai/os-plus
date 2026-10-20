# Automatic Shopify order creation — 19 October 2026

## Current owner requirement (supersedes mandatory production release for import)

Shopify order creation should automatically create a visible OS PLUS order.
Customers, line items, quantities, prices and source payment facts are copied;
item-type/workflow/worker assignment is subsequent team work, not an import
prerequisite. No Chat/CRM, customer messaging or local financial posting.
Test in Phantom Threads Test; never mutate the production tenant or source store.

## Implemented local slice

- The existing authenticated order webhook commits its durable receipt/job first.
  With `SHOPIFY_AUTOMATIC_ORDER_CREATION_ENABLED=true`, an accepted or duplicate
  event schedules the existing lease-protected worker via Next `after`. No browser
  queue/process button, mapping, review or release is needed. Invalid signatures,
  foreign tenant/store and ignored other-order events cannot schedule a worker.
- Worker hydration/customer matching/order import reuse the existing atomic SQL.
  Prices/payments remain Shopify source facts. There is no fabricated payment,
  GST entry, production item/stage/worker assignment or communication.
- Orders has a separate imported-order section, with commercial detail at the
  normal `/orders/:id` URL. This eliminates draft 404 in enabled Test mode.
  Imported drafts stay outside operational production/finance/public views.
- New read-only RPC rechecks active owner/admin or manager, tenant, store/app,
  source binding and exact approved order. Anonymous/authenticated SQL roles
  cannot execute it. Only the server decrypts source and returns enumerated DTOs.
- Details show source customer/contact/address, line quantities/variants/SKU,
  prices/properties, shipping/tax/discount and source payment status. Unknown or
  expired details are never presented as zero or guessed. Expiry suppresses the
  encrypted packet in SQL and is independently enforced in the projection.
- Existing Shopify production setup remains a separate legacy workflow; no new
  manager-facing assignment editor was added in this order-import slice.

## Explicit scope limitations — do not call these completed

The hosted integration is still an exact-one-order pilot. The existing database
policy intentionally rejects all other real Shopify orders. This change does
not turn on unrestricted all-orders ingestion, renew retention or bypass the
pilot. A durable per-connection all-orders authorization/cutoff/retention policy
and multi-tenant onboarding remain necessary before a general rollout.

The new imported section is independently bounded at 50 and searches local order
number, linked customer name and source GID before pagination. Source order name
search, global counts and combined pagination are not implemented. It appears
in all/active views with all status/payment filters and source all/Shopify; it is
not incorrectly included in unpaid, overdue or operational summary totals.

## Exact approved package

Owner approved the scoped migration/deployment and webhook test on 19 October.
The single read-function migration is now applied. Its transaction verified 113
pre-existing functions unchanged, service-only execute permission and denied
unauthorized reads. No business rows were changed. Deployment and hosted event
acceptance remain separate checks; the steps below record the approved scope.

1. Apply ONLY `supabase/migrations/20261019160000_shopify_imported_order_reads.sql`
   to the shared database after review/approval. It creates a service-only stable
   read function and grants; no table, business row, operational view or existing
   function is modified. Revoke its execute grant to disable if necessary; do not
   drop data or restore over production to roll back an application change.
2. Approve the exact feature-branch file scope/commit and Git-triggered deployment.
   Preserve pre-existing documentation, next.config and tsconfig edits; do not
   bundle the earlier customer fix or other dirty work without review.
3. Enable the new flag ONLY with the existing Test tenant/store/app binding. Keep
   release off: it is not used by automatic creation. Existing intake, sync,
   hydration, executor, draft-import, credentials and Test-copy gates must remain
   coherent. Flag alone does not install SQL or a webhook subscription.
4. Verify/configure the app's `orders/create` HTTPS subscription to
   `/api/integrations/shopify/orders-webhook` on the application origin. Existing
   updated/cancelled handlers are preserved. Do not edit a real order to provoke
   a test; resend a previously delivered approved order event if available.
5. Configure an authenticated periodic invocation of the existing POST worker
   endpoint (e.g. n8n) for retry/reconciliation, with an empty JSON body and secret
   header stored in its credential vault. Background `after` is not a durable
   scheduler; a terminated run needs the persisted job retry. Scheduler also
   enforces the existing approved source/privacy retention policies. Obtain
   explicit activation approval, never turn it on incidentally.
6. In the hosted Test account verify the existing authorized order in Orders and
   detail without mapping/release. Replayed same event must not add a second
   order/customer/payment. Check manager read, foreign tenant denial, and zero
   local money/production work. Keep production tenant untouched.

No hosted acceptance is claimed until code deployment and actual authenticated
delivery are verified. Existing one-day source expiry remains
20 October 2026 01:09 IST; no silent extension is authorized.

## References

- [Next after lifecycle and duration](https://nextjs.org/docs/app/api-reference/functions/after)
- [Shopify webhook subscriptions](https://shopify.dev/docs/apps/build/webhooks/subscribe)
- [Shopify HTTPS delivery requirements](https://shopify.dev/docs/apps/build/webhooks/subscribe/https)

## Verification

`npm run test:shopify-automatic-orders`: 14 server/SQL checks and 10 rendered UI
checks pass. Existing memory database regression: 75 pass. Broader application,
role, owner-only workspace, client/server and operational boundary checks pass.
Lint, typecheck and optimized Webpack build pass (47 generated pages).

Review found and fixed a source price-basis label (current line subtotal, not unit
price), missing address phone display, and single-packet decryption resilience.
Standards and Spec rechecks report no remaining scoped implementation findings.

Local tests use synthetic Shopify transport and isolated PGlite SQL, not the real
Test tenant or independent-session PostgreSQL concurrency. Docker engine and
supported browser-control tools were unavailable. No source-store mutation or
production business write was performed. The deployment, subscription/scheduler, hosted
acceptance and broader all-orders policy limitations above remain unresolved.
