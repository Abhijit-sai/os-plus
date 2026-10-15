# Shopify permission cleanup and deployment approval package

Prepared 15 October 2026 (IST). **PREPARATION ONLY — NOT APPROVED TO EXECUTE.**

The twelve shared migrations are already installed per the owner's report and
the read-only checks in docs37. Do not rerun them. This package proposes one
small follow-up permission change and a separate, disabled application release.
It does not authorize either action, Test imports or production-tenant activation.

## What the owner is being asked to approve next

1. **Database permission cleanup only:** run the single proposed SQL file below
   on OS PLUS, then its read-only verification. No business records change.
2. **Application release separately:** approve an intentional Shopify-only
   commit/push, PR merge and production deployment after the source inventory,
   target-main comparison and build gates below pass. Imports stay off.
3. **Not part of either approval:** connecting/activating a Test policy, reading
   a real Shopify order, copying data, releasing an order, enabling webhooks or
   a scheduler, sending messages, or production-tenant cutover.

No action was executed remotely while preparing this package. Chat/CRM branches
were not inspected or changed. Existing work in this checkout is preserved.

## A. Exact permission-only SQL

- Proposed file: [20261015170000_shopify_trigger_permission_cleanup.proposed.sql](sql/20261015170000_shopify_trigger_permission_cleanup.proposed.sql).
- Read-only postcheck: [20261015170000_shopify_trigger_permission_cleanup.verify.sql](sql/20261015170000_shopify_trigger_permission_cleanup.verify.sql).
- Exact SHA256/byte counts: `preparationFiles` in
  [shopify-release-preparation.json](shopify-release-preparation.json).
- Destination: Supabase project `dxiyihrdfismbuqdmhit`, database `postgres`,
  SQL Editor role `postgres`. Confirm the project separately: the database name
  alone cannot identify a Supabase project.

The proposal revokes EXECUTE from PUBLIC, anon, authenticated and service_role
on precisely these ten zero-argument, invoker-only trigger helpers:

| Trigger helper | Why included |
| --- | --- |
| guard_shopify_production_hold | Ordinary API roles have unnecessary execution grants |
| guard_shopify_draft_order | Extra service-role grant from default privileges |
| guard_shopify_order_child | Same |
| guard_shopify_privacy_activation | Same |
| guard_shopify_privacy_contact_purge | Same |
| guard_shopify_source_redaction | Same |
| protect_shopify_connection_binding | Same |
| protect_shopify_draft_audit | Same |
| protect_shopify_intake_audit | Same |
| touch_shopify_job_request | Same |

It does not alter function bodies, trigger attachments, table/schema access,
ownership, role membership, global default privileges or business data. It does
not revoke service access to the eighteen runtime commands. Tests exercise the
real attached production trigger after revocation, not just grant metadata.

The proposal lives under `docs/sql`, not the automatic migration directory, so
existing twelve-file manifests/rehearsal evidence remain immutable and no CLI can
silently include it in that package. If approved and executed manually, retain
its exact checksum and execution receipt; later migration-history reconciliation
must be a separate deliberate action, not an automatic historical replay.

### Authorized operator procedure — only after approval

1. Check the pinned package with `node scripts/check-shopify-release-preparation.mjs`.
   Confirm this exact project's current target definitions/permissions have not
   drifted from docs37. Stop for changes to owner, trigger type, security-definer
   status, missing functions, or any unexplained difference. Do not modify SQL
   ad hoc in the editor. No concurrent schema deployment; imports remain off.
2. Keep the existing encrypted recovery set. This ACL-only transaction does not
   require a destructive restore or replay of the twelve migrations. Any broader
   schema/data repair needs a new plan, current recovery point and approval.
3. Run the **whole proposed file once** in SQL Editor, using postgres. It includes
   BEGIN/COMMIT, a 3-second lock timeout, 60-second statement/idle bounds, preflight
   type/owner checks, explicit revocations and effective-permission assertions.
4. On any error, stop and issue ROLLBACK if the editor session still has an open
   transaction. Do not omit the guard or increase timeouts to force it through.
   If acknowledgement is lost, inspect current grants before deciding what ran.
5. Run the separate read-only verification. Expected: database/actor postgres,
   read_only on, targets_found 10, invalid_definitions 0,
   public_execute_grants 0 and api_execute_grants 0. Record the output and actual
   execution time/SQL SHA privately; no success receipt is prefilled here.
6. Recheck the eighteen runtime command permissions, existing trigger definitions/
   enablement and all-tenant safety counters using the read-only diagnostic.
   Compare against the twelve-file snapshot plus this explicit ACL-only delta.
   The old raw twelve-file comparator is not expected to treat changed ACLs as
   byte-identical; do not rewrite its historical evidence to force a pass.

No broad GRANT rollback is provided. A failure before COMMIT is atomic; an
unexpected post-commit problem requires diagnosis and a separately reviewed
targeted remedy. Never disable protection triggers or restore old data to undo
this permissions-only change.

## B. Exact application source and release boundaries

Source: isolated `codex/shopify-intake-foundation-20261008`, base commit
`5882974bc102eb417d14adbc055f7d2f8de315ca`. Review baseline selected by owner:
`c701ec3`. Base contains the earlier read-only connection probe; application
wiring remains uncommitted. **Base HEAD alone is not the release artifact.**

The release manifest records base plus each changed/new application, config,
test/harness and SQL source path, byte count and SHA256 (`overlay`). Its digest
pins that set; it also pins the proposal, postcheck, this plan, the original
twelve-file manifest and all nonsecret verification reports required by the
included evidence validators (`evidenceFiles`). The manifest itself belongs in
the release. Progress summaries and other narrative docs
are not deployment inputs and are not implicitly approved for staging.

The full allowlist is the union of `overlay`, `preparationFiles`, `evidenceFiles`,
`appliedTwelveFileManifest`, and `docs/shopify-release-preparation.json` itself.
Use it explicitly, never `git add .`. Unchanged
source files come from the pinned base. No private environment files, credentials,
backup archive/key, node_modules, local build output or sample customer exports
belong in the release. Some shared operational readers/actions are intentionally
changed to keep Shopify-managed orders out of local finance, public tracking and
communications; that is not permission to edit the separate Chat/CRM branch.

`applicationCommit` and `deploymentId` deliberately remain null. A source
inventory is not a signed build/deployment or permission to commit. Before a
release, repeat checks, inspect the exact staged diff and compare with the then
current target main. If it contains unrelated work or conflicts, stop for a
specific integration decision; do not reset/rebase other work or switch to a
Chat/CRM branch. Regenerate hashes and renew review if any pinned file changes.

### Release sequence after separate approval

1. Revalidate this manifest and original twelve-file manifest. Review the exact
   staged file allowlist and `git diff --cached --check`, including new files.
   Add the proposed SQL/postcheck as documentation only, never auto-apply it.
2. Record the intentional feature-branch commit SHA after commit approval. Push
   only that branch after push approval. Open/attach a PR into main. Review any
   new main changes before requesting merge approval. No direct main push.
3. Build/test the actual candidate in an isolated CI/preview environment with
   Shopify operations disabled; a production build passing locally is not a
   live acceptance result. Do not run database smoke scripts against shared data.
4. Verify the production project's settings privately. Preserve Seoul function
   placement; do not change it or introduce a competing region configuration.
   Preserve Clerk, Supabase, and unrelated application settings. Do not copy
   production secrets into previews or logs.
5. With merge/deployment approval, deploy that pinned commit through the main
   production-branch workflow. Confirm Vercel Ready, exact source SHA, expected
   domain `https://os-plus.vercel.app` and Seoul placement. A feature preview or
   successful Git push alone is not production deployment.
6. Perform read-only smoke checks: sign-in/tenant selection, existing Orders and
   Production lists, settings navigation, manager-denied attendance/contributions,
   and tenant boundaries. Shopify gates remain false; no Connect/Copy/Process/
   Release button or worker/webhook call is used to exercise mutations.
7. If smoke fails, stop. Keep Shopify flags off and preserve logs without customer
   contents. Confirm the actual last known-good deployment before any separately
   authorized application rollback. Never roll back shared SQL/data automatically.

### Disabled deployment configuration

All fourteen flags in the manifest's `disabledFlags` must be explicitly false
for this release, including connection-screen/probe visibility. This is the
no-import deployment stage, not the subsequent pilot setup. Do not assume local
`.env` presence/absence reflects the deployed Vercel configuration.

For a later approved Test setup, privately validate these existing server-only
values. Do not paste secrets into this document, Git, screenshots or chat:

| Setting | Required pilot value / validation |
| --- | --- |
| SHOPIFY_CONNECTION_TEST_TENANT_ID | 7be40f50-94a0-46c5-af57-7eea5e36ea8a (Phantom Threads Test only) |
| SHOPIFY_SHOP_DOMAIN | n1djr1-99.myshopify.com (read-only production Shopify source) |
| SHOPIFY_APPLICATION_ORIGIN | https://os-plus.vercel.app |
| SHOPIFY_DEPLOYMENT_ENV | production; VERCEL_ENV is supplied by the host |
| SHOPIFY_API_VERSION | 2026-10 |
| SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET | Installed same-organization app; verify privately, never expose |
| SHOPIFY_SOURCE_KEY_ID | Active key identifier, 1–64 URL-safe characters |
| SHOPIFY_SOURCE_ENCRYPTION_KEYS_JSON | Private map of key IDs to 32-byte canonical base64 keys; contains active ID |
| SHOPIFY_SOURCE_ENCRYPTION_KEY | Legacy single-key fallback only when the JSON map is absent; do not introduce competing keys |
| SHOPIFY_WORKER_SECRET | Needed only for separately approved external worker; 32–256 URL-safe random characters |
| SHOPIFY_WEBHOOK_SIGNING_SECRET | Optional explicit rotation secret; otherwise installed client secret; subscriptions remain off |

These are bounded pilot settings, not a shared automatic binding for every tenant.
Generic merchant self-service OAuth and production-tenant cutover are separate.
No n8n schedule, Shopify subscription or messaging integration is installed here.

## C. Test activation is a later decision

After cleanup and disabled release verification, obtain approval for one named
existing recent order, a 1–7 day retention period and the Test tenant only. Then
prepare the exact gate changes for setup/copy/worker/release; approval of this
package must not be reused as import authorization. Do not create test orders in
the production Shopify store. Test payment values/status come from Shopify and
must not create local cash/Finance posting. Customer messaging remains off.

First acceptance must cover real authenticated owner/manager/foreign-tenant
boundaries, exact customer/item mapping, source payments, manual processing,
review/release, retry without duplicates and relevant error/hold paths. Then
request the larger last-week batch separately. No claim of hosted population or
end-to-end live success is made now.

## Validation and known limits

The cleanup's fictional SQL suite reproduces the live default grants, checks
all thirty API-role/function combinations, unchanged data/catalogue/defaults,
idempotence, missing/changed-target fail-stop, inherited-grant rollback, runtime
command permissions, attached trigger behavior and the operator postcheck.
Actual application-to-SQL connect/copy/worker/map/review/release/duplicate recovery
tests now also run after the proposed cleanup in memory. No private backup or
live system is involved. Current command results and independent Standards/Spec
reviews are recorded in the latest project summary; older dated proofs retain
their original scope.

The existing node_modules junction prevents the default local Turbopack build;
use the already-supported local Webpack build to check compilation without
installing dependencies or changing production build configuration. CI must
still verify its actual production build. Browser/mobile release confirmation,
live Clerk role tests, Vercel configuration and the deployed commit remain
release gates, not inferred passes from unit tests.
