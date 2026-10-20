# Shopify unified Orders — replacement goal

Current implementation, verification and hosted approval status are in
[42_Shopify_Unified_Orders_Approval.md](42_Shopify_Unified_Orders_Approval.md).
The implementation/status notes below record the earlier foundation milestone;
they are historical, not the current remaining-work list.

This supersedes the one-order mapping/review/release pilot as the product goal.
The old goal is paused, not completed. Work is isolated on
`codex/shopify-unified-orders-20261019`, based on released main `ce05822`.

## Approved scope

- Phantom Threads Test only; no production-tenant data, source Shopify order
  writes, customer messaging, local payment posting or Chat/CRM branch changes.
- User approved retaining imported Test order/customer business records until
  explicitly removed; temporary raw Shopify payload retention remains one day.
- Local implementation/rehearsal first. Exact shared-database migration and
  deployment package must be presented before applying shared-schema changes.

## Required user journey

1. Owner sees a linear Connect → Import orders → Automatic sync setup. Technical
   queue, lease, webhook and privacy controls are advanced diagnostics only.
2. Owner chooses a labelled date range, previews all results (or explicit pages),
   and imports only new orders. Preview distinguishes New, Already imported,
   Reference match and Conflict. No silent truncation or guessed matching.
3. Webhooks use the same atomic import/duplicate boundary as date-range import.
4. Every imported order appears in the ordinary Orders table with source Shopify,
   Reference order ID, source payment facts and Draft — needs setup where needed.
   Shared search/filter/sort/page and selected-view counts include those drafts.
5. Owner/admin or manager opens that ordinary order and assigns garment type,
   workflow, delivery and optional dates. Partial choices can be saved as draft.
   Completing setup creates validated production items/stages exactly once.
6. Production staff can then run the normal workflow through completion/delivery.
   Shopify updates never overwrite team choices or create local payment receipts.

## Matching rules

- Immutable identity is tenant + Shopify store + Shopify order ID.
- Reference order ID is the Shopify display reference, preserved as displayed.
  Matching is tenant-scoped, case-insensitive and trims surrounding whitespace
  and an optional leading `#`; do not strip arbitrary punctuation or digits.
- A matching manual order is not imported again or overwritten. Ambiguous,
  multiple, deleted or differently bound references are explicit conflicts.
- Preview is advisory; recheck under transaction locks at commit. Webhook and
  backfill racing each other must produce one order/customer identity.
- Never match by customer name, amount, partial reference or cross-tenant data.

## Acceptance gates

- Unified list and detail: draft/normal ordering, all relevant filters, reference
  search, null customer, inaccessible records, source-payment precision, mobile.
- Import: date boundaries, leap dates, inclusive end-day, no future dates,
  pagination, missing scopes, cancellation/refund, missing variants, partial data,
  retries, changed references, manual reference conflicts and concurrent intake.
- Draft setup: manager allowed, other roles denied, cross-tenant configuration
  rejected, inactive/empty workflows rejected, stale source/choice retries,
  optional partial saves, all production stages created atomically once.
- Retention: raw source expiry does not erase durable business order details;
  raw payload cleanup is tested without deleting business records.
- Local fictional DB/HTTP tests are distinct from hosted Test-tenant acceptance.
  Record exact hosted order IDs/results; never label local mocks as live success.

## Implementation status

Discovery confirms the current separate display, one-order policy and owner-only
release restrictions are intentional legacy code paths, not a missing webhook.
They must be replaced coherently; moving a card alone cannot satisfy this goal.
No shared migration has been applied, no import has been activated and no
deployment has been performed for this goal. Do not deploy this branch or run
the draft migrations yet; the end-to-end replacement is not complete.

### Implemented locally so far

- Conservative Reference matching in TypeScript and SQL, including manual,
  deleted, ambiguous and immutable-store-identity matches.
- Read-only date-range source preview, India-time boundaries, 31-day bounded
  windows, explicit older-order scope requirement, paginated reads, explicit
  incomplete result and incoming-reference clashes. Owner/store permission is
  rechecked in SQL before source reads and before matching each batch.
- Explicit opt-in business-retention policy and an atomic retained importer.
  Business details are separate from raw ciphertext. The retained path rechecks
  references under transaction locks and populates `reference_order_id` through
  a private, single-purpose capability. Late manual matches stop before customer
  or order creation. Manual duplicate creation is also guarded for opted-in
  tenants; ordinary non-opted-in tenants retain existing behavior.
- The retained import constructor defaults OFF. The legacy worker has not been
  switched to it; this is intentionally not an accidental multi-order activation.
- Unified commercial list query and Orders rendering, draft filter, manager-setup
  labels, source-payment display, nullable customer/delivery support, and bounded
  pagination. Operational/finance/public views have not been widened to drafts.
- Single-tenant actor fallback when a selection cookie is absent. Multiple or
  stale explicit memberships still fail closed; no invitation-linking writes.
- Manager partial-save SQL and strict team-choice schema: nullable choices,
  optimistic versions, exact-request receipts, current role/tenant/configuration
  checks; no global mappings and no production side effects on save.
- Manager completion SQL creates items, all configured stages, source links and
  the existing operational/source-change boundary atomically. Local test runs
  both existing stage commands through stitching and final store pickup/delivery.
  Replays create no duplicate workflow, mappings, receipts or customer messages.
  The browser form/server-action and authenticated freshness-read wiring are
  NOT connected yet. SQL tests supply fictional freshness proofs.
- Bounded raw-expiry SQL covers complete and partial revisions after 24 hours,
  only for opted-in connections. It preserves orders, customers, normalized
  details and activation flags. No scheduler has been installed or activated.
- Durable source-payment reads work after manager completion and raw redaction.
  Post-completion source cancellation/reference changes are stored as new source
  observations and hold future operations without rewriting team work/reference.

### Verification recorded this turn

- `test:shopify-unified-foundation`: 39 checks passed, with real SQL in fictional,
  memory-only PGlite and mocked Shopify HTTP. Includes all legacy application
  flow checks as regressions, not claims that the new flow is complete.
- `test:shopify-probe`: 67 passed.
- `test:shopify-intake-db`: 75 passed.
- `test:shopify-source-payments`: 8 passed; actual imported Orders UI: 3 passed.
- `test:shopify-executor`: 7 passed.
- `test:shopify-automatic-orders`: 17 server/SQL and 12 UI checks passed.
- Type checking, lint, client/server boundaries and order/finance boundaries
  passed. A normal `next build --webpack` completed successfully outside the
  filesystem/network sandbox. Initial sandboxed attempts failed on folder writes
  and Google Fonts DNS. The temporary alternate build directory was removed;
  normal Next/TypeScript configuration is restored. Rerun final build after the
  latest retained gift-card/shipping flags and remaining application work.
- Retained-order test imports through actual queue/hydrator/store/SQL, confirms
  exact receipt recovery, then performs authorized raw-source redaction in the
  fictional database and confirms business details remain unchanged/readable.
  A separate expiry test seeds historical fictional revisions and runs the new
  cleanup as service_role; batching, exact store scope, partials and repeat runs
  pass. This is NOT evidence of a running 24-hour cleanup scheduler.
- Docker recheck succeeded after the user started it (server 29.7.2). The initial
  sandboxed probe was denied pipe access; the elevated read-only probe succeeded.
- `verify:shopify-docker` exited 0 on disposable PostgreSQL 17.9: all 70 unchanged
  migration files applied on empty-reset and populated-upgrade fixtures, 72/72
  database regression checks and 22/22 existing independent-session/PostgREST
  concurrency checks passed. These existing concurrency checks do not establish
  coverage of every new retained-import/manager-completion race; those remain
  release gates. Only fictional local data was used, with no shared connection.
  Runner confirmed owned containers/network removed; database was memory-backed
  with no host business-data mounts. No Docker reset or global prune was run.

### Remaining work / release blockers

1. Replace the legacy one-order pilot authorization coherently in queue ingress,
   worker, source guard, cutoff handling and webhook registration. Do not weaken
   its guards just to allow the new UI to queue arbitrary orders.
2. Persist/fence date-range previews and implement the actual import commit/job
   path; connect the linear setup UI. Current preview service is read-only.
3. Connect manager read/save/complete SQL to authenticated server actions and the
   normal order form, including fresh Shopify updatedAt verification, retry
   recovery and customer/configuration search beyond bounded initial choices.
   Expand negative/concurrent completion tests. Production completion currently
   accepts physical INR items with unchanged quantities; cancelled/refunded,
   non-production/gift-card and other currencies remain visible drafts requiring
   explicit handling, not automatic production. Do not invent global mappings.
4. Wire and approve scheduled raw retention cleanup independently of sync flags
   and legacy pilot expiry. Bounded SQL exists and is tested; the scheduler and
   its operational visibility/retry behavior are still missing.
5. Existing Test-order migration/re-hydration into retained details, and complete
   normalized source-detail presentation alongside post-setup production views.
   Durable payment reads exist; the old source-detail page fallback still needs
   full end-to-end coverage once the new manager form is connected.
6. Source update/cancellation/refund, changed reference after production starts,
   interrupted imports, actual concurrent writers, full UI and hosted Test E2E.
7. Exact shared-schema/deployment approval package after all local gates pass.
   The six new migration files currently in the branch are DRAFTS, not an
   instruction for the user to run them.

### Source query reference

The preview uses Shopify's documented `orders` query with `created_at`, cursor
pagination and `CREATED_AT` sorting:
[Shopify orders query](https://shopify.dev/docs/api/admin-graphql/latest/queries/orders).
