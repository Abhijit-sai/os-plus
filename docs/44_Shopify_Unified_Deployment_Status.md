# Unified Shopify release — 20 October 2026 (India)

Historical deployment record. For current manual acceptance and outstanding
work, see [document 46](46_Shopify_Manual_Import_Acceptance.md) and
[document 47](47_Shopify_Pending_Work.md). The pending-acceptance paragraph below
describes the state at this original release, not the later completed live tests.

Manual-import follow-up: [document 45](45_Shopify_Manual_Import_Test.md) records the
application-only scheduler decoupling and pending hosted acceptance. The worker
dependency below describes the original release, before that correction.

## Shared database

The owner approved the seven migrations and Git deployment. All seven files in
document 43 were applied in order, with their approved checksums, separate
transactions and bounded lock/statement timeouts. No historical migrations were
rerun. Post-install comparison verified 286 expected schema objects and no
unexpected changes to existing objects. The seven new tables remained empty.

Only the Phantom Threads Test Shopify connection was paused for maintenance and
restored to its previous flags afterwards. The maintenance actions were audited.
Non-Test tenant row counts/digests across tenant-scoped application tables were
identical before and after the migration window. No imports, unified policies,
webhook subscription changes, payments or messages were activated by this run.
No Chat/CRM checkout was accessed or modified.

A fresh encrypted application backup was recovered into an isolated local
database. All 99 tables/data digests and 2,805 catalogue objects were verified,
along with roles, memberships and effective permissions. Three pg_dump textual
representation differences initially failed the strict comparison: two nested
AND constraints and an explicit owner-only ACL restored as the equivalent
default. A narrowly pinned equivalence check with positive/negative regression
tests resolves those cases without ignoring other constraint/permission changes.
No live permissions were changed to fix the verifier.

Detailed execution evidence is local under `outputs/shopify-unified/`; encrypted
backups and keys remain outside the repository in the protected backup directory.
Neither business records nor backup contents are part of the Git release.

## Application and remaining hosted acceptance

Application deployment is through the normal Git integration. Set the Production
environment variable `SHOPIFY_UNIFIED_ORDERS_ENABLED=true` after the schema
installation, preserving the existing Test tenant/store binding. Record the
actual deployed commit and Ready status separately; a local build is not deployment.

The owner explicitly deferred the n8n worker package to separate work during this
turn. No scheduler was created or enabled. Do not assert that setting a worker
environment flag proves a scheduler exists. The setup enable action requires
the worker endpoint configuration; the approved rollout additionally requires a
working cleanup schedule before importing new retained orders.

Until that dependency and authenticated hosted acceptance are completed, this
release is **schema-installed, not end-to-end accepted**. Outstanding: date-range
import/retry in the hosted Test tenant; draft save and manager completion; normal
workflow through delivery; genuine Shopify webhook delivery; worker recovery and
one-day raw cleanup. Local fictional tests cover these paths but do not replace
hosted evidence. Never enable the production tenant as part of this package.
