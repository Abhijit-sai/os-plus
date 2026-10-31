# Chat release candidate - 30 October 2026

Engineering candidate prepared; NOT approved for production SQL, app deployment, real binding or CH10 closure. Current phase QA_BLOCKED.

## Exact inputs and output

- Current remote/main: c686337c0f059cbe6ae40bbcadc2f6c0da2ffc0a; retained local HEAD fcf0ebc14aa9337f6a186ff9e278f412060ac02c, ahead12/behind0. CH10 preparation remains dirty. No integration mutation is currently necessary; refresh again before release. Final release commit is not yet authorized/created.
- Frozen canonical source:106 files,71 baseline plus35 Chat additions. source-manifest.json binds names/byte lengths/SHA256 and expected transformation counts. No canonical migration is edited or replayed on production by this tooling.
- Generated candidate: outputs/ch10-release-20261030/candidate-v1/{chat.sql,manifest.json} (ignored local artifacts). SHA256 `3acfc26f7af98989d4957a6ab2d64ea2ceb871fca2235e5dc88dd336f61faab9`.
- Candidate qualifies ONLY the enumerated unqualified digest/gen_random_bytes calls to extensions, removes enumerated standalone migration transaction lines and wraps35 additions in ONE timed transaction. It neither moves extensions nor adds public wrappers/broader function search paths. Generator fails on any frozen source/inventory/recipe drift and refuses to overwrite an existing output directory.
- Preserve prior-main Vercel deployment9WpBNhMhAuTvPFumCSCwtKjVmfYp and unrelated configuration. Current GitHub Vercel status is success; a fresh authenticated current-domain/alias observation remains required before deployment.

## Reproduce preparation and isolated checks

```powershell
node scripts/chat-release/build.mjs outputs/chat-release-NEW-RUN
python scripts/chat-release/pack-native-source.py outputs/chat-native-NEW-RUN
npm run typecheck
npm run lint
npm run build
npm run test:roles
npm run test:v2
npm run test:chat
```

Default Chat tests still use the validated LOCAL disposable Docker backend. Do not invoke that backend on the unhealthy local Docker/WSL. Native owned mode is selected only inside the explicit isolated Linux runner: CHAT_TEST_OWNED_DATABASE_MODE=isolated-internal-network plus random test nonce/password, fixed private-network alias, server nonce/database/user and role checks BEFORE writes. There is no shared database URL or production credential mode. Test resources are512MiB each, oneCPU each, no extra swap/public ports/Docker socket, read-only source, internal network and tmpfs data. Cleanup reattests labels/database marker. No test reads application .env files.

run-owned-native.py accepts a source-only tar.gz through stdin after its code has been read by the scoped SSH bootstrap; the tested local bootstrap uses only the owner's exact -F none/identity/known_hosts/2.29.113.198 command. The source packager excludes environment files, outputs, Git and preview build/dependency trees, then includes only existing installed test dependencies. No npm install or paid provider occurs. Review the bundle manifest and runner hash before every run. Runtime/source transport evidence is in native-suite-pg17-inputs.json; actual source bundle SHA256d329a27b827aceefdc249f105d51d05ef28f12484718db5ec24ac59f6e49e18a. Python runner revisions are separately recorded; the PostgreSQL17 replay used the same application/test payload as the PostgreSQL16 pass.

test-image.json pins the official PostgreSQL17.6 amd64 image solely for disposable QA. It was resolved from the official registry and pulled ONLY on the authorized VPS. All seven production image pins/configurations remain unchanged. Existing pinned n8n image is used as a fresh Node26 runtime with its entrypoint overridden; it never joins the live scheduler network or activates a workflow. This is not a production database image upgrade.

rehearse-atomic.py receives71 frozen baseline files and the EXACT candidate bytes/hashes. It verifies failure after all35 additions rolls back, successful upgrade preserves a synthetic tenant, repeat application refuses, and pre/post custom dumps restore into fresh namespaces. CHECK expressions are reparsed by PostgreSQL using temporary LIKE tables before comparison because logical restore flattens redundant AND grouping; expressions are not discarded. Other catalogue comparisons include relation/RLS state, function security/configuration, grants and policies. This is a fixture restore, not a full managed-Supabase or whole-host restore/RTO claim.

## Fresh evidence and limits

| Check | Result |
|---|---|
| typecheck / lint / build | PASS on nativeD with temporary files onD; final focused lint also passes |
| roles / V2 | PASS; existing guard checks including23 ingress and fourV2 scripts |
| full Chat | PASS313/313,0fail/cancel/skip/todo on pinned nativePG16 and production-matchingPG17.6; finalPG17 run60.0s |
| atomic upgrade / restore | PASS7 specific checks against exact candidate onPG17.6; final security-catalogue extension recorded in QA |
| Shopify | OAuth29backend+1UI; unified foundation50; application43backend+9UI PASS; groups overlap |
| Production catalogue | TLS-verified READ ONLY,17:16UTC30Oct: PostgreSQL17.6, crypto extensions schema, service-role usage allowed, no Chat relations/functions,109 dependency columns observed |
| Review | Standards0 / Spec0 confirmed new findings in inspected critical paths and new tooling; targeted review, not exhaustive proof |
| Hosted/browser/Boutique | Fresh full BoutiqueTierA and authenticated OSPLUS role/mobile/Clerk/SSO acceptance NOT completed; historical evidence is not relabelled |

No combined unique total across overlapping test groups. First native307/291pass16fail and startup failure are preserved; resolved bundle omission, rollback-scoped schema fixture and CLI reporting issues are test infrastructure, not production behavior fixes. The startup failure's exact prior Docker command was not captured; subsequent final-TCP readiness and stage diagnostics pass. No undocumented root-cause claim.

## Preflight and proposed rollout - NOT executed

1. Refresh main, actual production deployment/domain and complete fixed-base/WIP review; freeze app input hashes and choose final release commit under applicable closure authority or an explicit scoped staged exception. Current main is already an ancestor; do not silently merge/rebase the dirty tree.
2. Run preflight.sql through inspect-catalogue.mjs and the existing protected DPAPI/owner-ACL/CA wrapper. It reads schema only inside READ ONLY, emits no credentials/PII and cannot deploy. A missing migration ledger is NEVER permission to replay71 historical or already-installed Shopify OAuth SQL. Compare current tasks constraints, dependency columns, extension functions/ACL and absence of all target objects against the reviewed manifest. A partial/uncertain prior apply requires reconciliation, not a retry.
3. Prepare a fresh encrypted shared-Supabase backup and verified recovery access/location/hash immediately before shared SQL. Current Hetzner backups cover the separate VPS, not the OSPLUS Supabase database. Do not place customer backup data in source/output folders or upload it into the test containers. C: remains full; use an independently reviewed healthy protected destination, retaining DPAPI/ACL/project binding. No new backup was taken by this engineering package.
4. Present exact sharedSQL/app/initial-Test scope, backup, code/SQL hashes, env diff, rollback and remaining QA dispositions for approval. Do not commit or deploy merely because automated tests pass. FullCH10/AI/SSO/draft-week gates need explicit staged disposition; they are not waived by this runbook.
5. Approved schema-first release uses ONLY reviewed candidate35 in its atomic transaction, with failure-stop semantics. Verify actual resulting catalogue and baseline business counts; record applied bytes once. Existing app remains prior-main during this step. If receipt is uncertain, inspect before any replay.
6. Approved app deployment starts with CHAT_FOUNDATION_ENABLED=false, CHAT_DRY_RUN=true, all tenant Chat modules disabled and all execution/delivery gates off. Verify existing Boutique/Shopify behavior before separate Test enablement. No new real workspace/account/inbox is seeded by SQL.
7. Exact Test enablement is a separate reviewed flag/account/workspace/role scope: dedicated NEW Test account/inbox, no901/902 reuse, exact URL-key+secret tenant resolution. Determine required foundation/admin/dry-run/capture flags from current code; never equate all-off installation with functional hosted capture. PT-01 through PT-15 in CH10_PHANTOM_LAUNCH_PLAN.md remain planned until observed. The shared app/schema still affects every tenant.

## Environment names, no values

Prepare only through secure server-side entry: CHAT_SECRETS_KEYS, CHAT_SECRETS_ACTIVE_VERSION, CHATWOOT_BASE_URL, CHATWOOT_PLATFORM_TOKEN, CHAT_WEBHOOK_ORIGIN, CHATWOOT_BROWSER_ORIGIN. Preserve existing unrelated Clerk/Supabase/Shopify configuration. New env on Vercel requires a reviewed new deployment. No secret is entered by this package.

Keep agent/model/voice/STT/notifications/Telegram/platform-alert/mock/draft/action-delivery gates OFF. In particular CHAT_AGENT_ENABLED, CHAT_MODEL_LIVE_ENABLED, CHAT_VOICE_ENABLED, CHAT_TRANSCRIPTION_LIVE_ENABLED, CHAT_NOTIFICATIONS_ENABLED, CHAT_NOTIFICATIONS_CRON_ENABLED, CHAT_TELEGRAM_LIVE_ENABLED, CHAT_PLATFORM_ALERTS_ENABLED, CHAT_MOCK_PREVIEW_ENABLED, CHAT_STAFF_DRAFT_SEND_ENABLED and CHAT_DRAFT_DELIVERY_ENABLED remain false. Do not add paid model/STT/provider keys or activate any n8n workflow. A separately reviewed lead-refresh scope may be necessary; it must not fabricate Shopify payment/delivery facts.

## Rollback and recovery

- App-only rollback: first disable affected tenant entry/capture and execution, preserve delivery uncertainty/receipts, return to the exact previous main deployment and unrelated env. Normally retain additive Chat data/schema; do not drop it or overwrite newer Boutique/Shopify data. No blind resend.
- SQL failure before commit: candidate aborts and rolls back its schema transaction; verify catalogue and baseline state. Exact end-of-package failure is rehearsed. Postcommit data recovery is a separate reviewed maintenance action; a whole shared restore can erase unrelated new business records and is not automatic rollback.
- Host rollback: preserve /opt/os-plus-ops/https-switch-20261030T121226Z-94466ef0; restore only reviewed config on existing volumes with the approved targeted Rails/sidekiq/Caddy scope. No bootstrap, volume replacement or key rotation. Public HTTPS is already active for synthetic accounts, independent of this app release.
- Operational readiness: Hetzner backups are OWNER-CONFIRMED enabled, daily/seven slots. All seven Docker named volumes were freshly observed on /dev/sda1 ext4, so they are within root-disk backup scope, not separate attached Hetzner Volumes. Provider disk images do not establish scheduled application-consistent encrypted dumps, key custody, independent retention/alerts or tested complete public-host recovery. Hetzner documents backup deletion with server deletion and client responsibility for at-rest encryption. No new storage purchase/backup upload/schedule is authorized or performed here.
- Real-data prerequisites still include encryption/key custody, restricted forwarding/access policy, application backup schedule/off-host retention/failure alerts, maintenance response and Caddy certificate/config recovery/reissuance. Existing application backup predates HTTPS; prior recovery evidence remains dated. B1/B3/B7/B8/PartD and real role/mobile/SSO/Meta acceptance stay open.

Official provider references: [backup overview](https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/), [backup FAQ](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/), [technical security measures](https://docs.hetzner.com/general/security-and-identify/technical-and-organizational-measures/).

Final evidence: outputs/ch10-release-20261030/atomic-rehearsal-complete.json is the final PASS7 report (17:35UTC), including both RLS flags, grants and policies. Earlier reports remain preserved. Final host/HTTPS checks17:38UTC: seven services/four configured healthchecks healthy, no OOM/restarts, reviewed image pins unchanged, active workflows0, no owned test containers left, HTTPS200/TLS verified. File inventory and preservation verification are in release-inputs-final.json; this is an uncommitted input manifest, not a release commit.


## 30October2026 - Owner defers backup work; Test-only scope prepared
CHAT-D069: owner says "no backups for now. We'll plan this later please." No backup/storage/upload/schedule action; existing Hetzner backups preserved. Authenticated separate Supabase project Free page has no scheduled project backups. Backup gate deferred/not PASS; no release authority inferred. Seven focused checks finalPASS (order UI9cases plus source/pure contracts), test-only feedback correction with unsafe-submit rejection; runtime/106SQL/candidate unchanged. Current-main Test browser read-only partials and interaction/mobile limits are in CH10_BOUTIQUE_RELEASE_QA.md; full Tier A/persona/mobile remains pending. Concrete staged flags and unchanged disabled-AI scope: ../deploy/chat-release/20261030/TEST_SCOPE.md and test-scope.json, proposal only. Same summary records exact commands/failures. CH10 QA_BLOCKED; no commit/sharedSQL/deploy/real message/workflow/AI/STT.


## 30October2026UTC - Interactive checks resumed; checkpoint review proposal
See CH10_BOUTIQUE_RELEASE_QA.md for fresh search/measurement/unsavedforms/GST/publicview and limits. Local2classfit-referenceoverflow fix; synthetic390/768/1440layout checks pass, wholeappnotcertified. Freshsixgates313/313ChatPG17.6 pass; exactSQLunchanged, no migrations. Standards0/Spec1testinventorygapfixed0remaining; latesttest-onlyguardfocusedcheck/lintpass. Main/Vercelc686337CurrentProductionReadyreverified. Candidate commit/push/DRAFTPR scope is deploy/chat-release/20261030/CHECKPOINT_PROPOSAL.md (relative torepo); approvalpending, not prodrelease/closure. Backupsremainowner-deferredD069; AI/STT/Telegram/workflowsOFF. CH10QA_BLOCKED. SAMEsummary updated with exact evidence/sourcehashes/failedattempts.


## Checkout portability and checkpoint authority - 31 October 2026 IST
CHAT-D070 authorizes checkpoint/branchpush/DRAFT PR only; the historical preparation status above does not authorize production release. Fresh READ ONLY production catalogue18:37UTC30Oct still has no Chat objects. Manual owner SQL remains a later exact-script scope.
Git checkouts may convert LF/CRLF. The generator reconstructs only equivalent newline representations that match the original frozen byte length AND SHA256; two mixed-ending source files have explicit historical CRLF line positions in the recipe. No sourceSQL or frozen manifest changes. Regression tests execute both LF and CRLF builder/source copies and reject substantive changes. Reviewed candidate SHA256 remains3acfc26f7af98989d4957a6ab2d64ea2ceb871fca2235e5dc88dd336f61faab9.


## Current state - 31 October 2026 IST - Owner SQL application observed
Owner manually ran4575-line candidate and reportsSuccess (CHAT-D071). The earlier preflight/pending statements are historical. Fresh READ ONLY catalogue verifies40Chat tables/allRLS,69functions; exact definitions/effective permissions and other compared schema groups match ownedPG17.6. One redundant explicit trigger-function ACL variance is documented in current CH10_QA.md. Zero modules/workspaces/channels enabled. No migration ledger relation exists: do not run historical106 or reapply35. Source106 and candidate SHA256 remain unchanged. Exact editor byte hash was not captured; do not overclaim it. Local outputs/ch10-release-20261030/owner-postapply-20261031/manual-application-observed.json records35source hashes and receipt limits. No assistant production writes, app deployment or tenant activation. Remaining release/backup-disposition/manual/security gates persist; CH10QA_BLOCKED. Use current catalogue reconciliation and a separate exact app/env/Test-only release scope next.


## Current acceptance - 31 October 2026 IST
Owner: "ch10 can be accepted, go ahead." CHAT-D072 accepts the implemented engineering scope. CH10 CLOSED LOCAL - ACCEPTED ENGINEERING SCOPE; production release remains QA_BLOCKED at independent hosted/manual/security/staged gates. See CH10_OWNER_ACCEPTANCE.md. No unrun live test is markedPASS; no merge/deploy/tenant/provider activation inferred. Installed35Chat schema is already observed underD071; do not replay it. BackupD069 stays deferred/notPASS, liveAI/STT/Telegram/workflowsOFF.


## App-only installation proposal now prepared - 31 October 2026
See APP_INSTALL_SCOPE.md and app-install-scope.json. Fresh Vercel production/base/rollback and absent Chat env overrides verified; no env edits/new secrets/SQL needed. Schema is already installed, all tenant modules remain disabled. Exact merge/freshProductionbuild and staged post-install Test-only manual regression still require the concrete release approval; phase acceptance alone is not that action. No execution by these proposal files.


## Production app deployed all-off - 31 October 2026
Exact ownerapprovalD073 executed: PR10/head1c2d609 merged643cf10; VercelProductionBd6qVpC3G9vTTFF8R9qvrdjVcqU4 succeeds andlivealiasmarker matches. No newSQL/env/secret/tenantactivation.9public/denial and16READONLYTest invariants pass; fullinteractiveTest checks incomplete duebrowserURLverification, ShopifyTestcredentialabsent. Currenttruth: PRODUCTION_RELEASE_RECEIPT.md. Originalproposal/pending text is historical, not a claim anothermerge/deploy is authorized. KeepChatdisabled; preservepreviousproductionrollback/additiveschema; neverreplay106/35.
