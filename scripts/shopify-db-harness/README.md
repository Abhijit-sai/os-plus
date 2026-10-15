# Disposable Shopify database verification

`npm run verify:shopify-docker` from the isolated repository runs actual
PostgreSQL 17.9 and PostgREST v14.16. Docker Desktop must be Running. Install
this harness's pinned dependencies with `npm ci --prefix scripts/shopify-db-harness
--ignore-scripts`; never install into the junction-backed application dependencies.
The ordinary `test:shopify-intake-db` remains memory-only by default.

The runner uses these already installed immutable local images, never an automatic
pull of `latest`:

- PostgreSQL: `sha256:c7526c0f6c3f30260a563d7bcf8ad778effac59a44f8ffa86678c35418338609`
- PostgREST: `sha256:bea1c76a856fa39d1e542d25911cf95d02fe2bf971992d033044ff209f1504b8`

Missing images require deliberate provisioning/review of the pinned image;
changing the identifiers is not part of a routine test run. Runner uses an
isolated Docker CLI config path instead of the user's private Docker config.
Windows child processes are hidden.

Every run creates a randomly labelled dedicated bridge, a tmpfs-backed database,
five random databases and a local HTTP API. Database and API ports publish to
127.0.0.1 only. Credentials/JWT signing key are generated in memory and redacted
from child output. There are no host mounts, persistent volumes, production env
file reads or shared database URLs. The dedicated bridge is **not an outbound
air gap**. Only fictional fixtures are used. Direct test entry points refuse a
database unless its random comment marker matches the orchestrator's nonce.

Verification covers:

- All 58 migration files, unchanged, individually committed on empty reset and
  a populated legacy upgrade; existing local totals and default-off flags remain.
- 67 selected-history SQL cases on real PostgreSQL (also run separately on PGlite).
- Independent-session races observed via PostgreSQL blocking PIDs: duplicate and
  coalesced receipts, worker leases, duplicate drafts, pause during import,
  review/release retries, altered intent, different release keys and manager denial.
- NOWAIT configuration contention, rollback/retry and no partial production.
- Real HTTP role/RPC privileges, current owner/tenant enforcement, review/release,
  legacy view relationship with explicit FK hint, external-vs-local money boundary.

This is **not a full Supabase deployment**: stock PostgreSQL plus PostgREST uses
a minimal `storage.buckets` metadata bootstrap and Supabase-style role/default
table grants. Auth, Storage API, Clerk/browser, live Shopify 2026-10/protected-field
access, schedules, key restore/privacy disposition and the unfinished application
screens are not accepted by these tests.

The runner validates exact ownership labels before stopping/removing only its
own containers/network in `finally`. Abrupt host/engine termination can prevent
cleanup: inspect exact `osplus.shopify.disposable` labels before any manual
cleanup. Never prune unrelated containers, volumes or networks.
