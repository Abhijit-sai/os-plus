# CH-2 connector/capture QA
Status: CLOSED — LOCAL under CHAT-D034, commit00718d6e395ea652eb2a7ceb79b39ae1471e863c, 2026-10-21. Meta/channel production acceptance remains deferred and untested.
Base: CH-1 CLOSED at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50 on codex/chat-ch1-foundation.

## Implemented locally
- Strict projected message parser: four channel types/legacy Instagram, string/numeric encodings, timestamps, staff/bot/system/private classification. Explicit human sender on a template remains staff.
- Exact POST ingress paths; URL workspace key+constant-time secret-hash authentication; active tenant/module/workspace/channel checks. Payload account/inbox IDs only assert the already-resolved scope.
- Bounded body read, immediate200 after validation, real Next after capture, safe failure health codes.
- Four memory tables with tenant composite FKs, deny-by-default RLS/ACLs and service-only atomic command. Duplicate and opposite-order agent/events callbacks share message capture; skeleton records one silent turn, no models or replies.
- Public staff quiet timestamps are monotonic; retries/private notes/system greetings do not extend them.
- Chatwoot API helpers for account/user/bot/webhook/inbox attachment and label read/merge/write. Onboarding is a platform-only server helper, not a new tenant/browser form.
- Persistent setup reservations prevent blind retry of uncertain creates; exact remote account+callback reconciliation; recorded bot identity blocks replacement on secret/origin change. Fresh authority checks immediately precede remote writes. No distributed transaction can eliminate the final check-to-remote-write interval; ingress independently enforces current state.
- The disposable Docker harness now uses the same validated local engine selector as the persistent QA environment.

## Migrations
- 20261021110000_chat_capture.sql: conversations/messages/state/turns and capture/health RPCs.
- 20261021111000_chat_transport_setup.sql: service-only reservation/check/completion RPC, using the existing idempotency ledger.
- Actual75-migration replay PASS on disposable PostgreSQL; both applied incrementally to the owned osplus-chat-local-8e8d10a9c1 DB after verifying the73-migration checksum and saving outputs/chat-local/before-ch2-upgrade.dump.
- No historical migration reapplication, production/shared DB changes, business-table alterations or source-data backfill. The pre-upgrade backup was created. A new actual pg_dump/pg_restore drill passed across 121 public tables, comparing row counts and row-content hashes and checking restored anon/service ACLs. Evidence: outputs/chat-local/ch2-restore-report.json; 1,284,196-byte dump, restored DB chat_restore_bce44417f3fa. This is database-only recovery in the isolated cluster, not host/Clerk/storage recovery.
- Local Next runtime snapshot refreshed; real Clerk Development config and original two business fixtures retained. Added one synthetic transport-only tenant with module disabled after tests.

## Automated and actual runtime evidence
Earlier pre-Chatwoot checkpoint (superseded by the actual local provider evidence below): six gates PASS: npm run typecheck; npm run lint; npm run build (51/51 pages); npm run test:roles (platform/Chat guards plus 11 proxy cases); npm run test:v2 (four suites); npm run test:chat (60/60, zero skipped). Logs are in ignored outputs/chat-local/ch2-*.log files; git diff --check passes.
- Database tests use real migrations/transactions/independent connections: duplicates, callback order, quiet clock, two-tenant collision, composite FK denial, revoked module/workspace, audit rollback, browser SQL denial, shared configuration-lock races and persistent transport reservations.
- HTTP harness runs production ingress/capture with actual localhost HTTP and PostgreSQL, controlled callback scheduling.
- Separate actual Next localhost evidence: outputs/chat-local/ch2-next-report.json. Six groups PASS: unauthenticated provider agent route200; actual after stores one message/silent turn; duplicate event/agent idempotency; wrong secret/account404; GET/unrelated route remains protected; disabled module404.
- Reserved synthetic endpoints only; no actual Chatwoot/Meta/model/Telegram calls.
- Mock Chatwoot tests cover success/replay, lost create response reconciliation, uncertain prior outcome, existing inbox bot conflict, changed callback refusal, pre-write revocation and discovery outage recovery.
- Proxy execution tests cover11 exact-path/method cases including unchanged Shopify exceptions.
- Existing local Boutique DB smokes rerun PASS: payment concurrency/audit/isolation, workflow activation/deactivation races, order-add-items. They used a separate empty working directory so application .env.local was never loaded.
- Current owner-b browser /settings/chat loads after local upgrade; B remains empty/pending with viewer/finance denied. No Chat user-interface layout changed in CH-2.
- The full14-path authenticated Boutique Tier A evidence belongs to CH-1 before this proxy delta. A complete post-delta Tier A browser rerun remains pending; do not relabel the DB smokes as that evidence.

## Review findings and fixes
- P1 capture/configuration lock inversion fixed by the shared chat-config advisory lock, with deterministic independent-connection tests for module disablement, suspension and brand archival.
- Changed callback could create an orphan bot: now refuse before create when a recorded bot ID does not match.
- Authorization after remote discovery: recheck immediately before provider POSTs.
- Transient GET outage poisoned a reservation: discovery now completes before reservation.
- Final narrow standards/spec re-reviews report no unresolved actionable finding. No full/live phase-closure review claimed.

## Honest limits / remaining gate
- Actual local website captures now exist (see checkpoint below). WhatsApp/Instagram/Facebook remain synthetic-contract fixtures only.
- Only message_created is subscribed/processed in this slice; contact identity updates arrive with CH-3. Unsupported lifecycle events acknowledge without mutation.
- after is not a durable queue. Process termination after200 can lose work; health recording cannot run after process death. No guaranteed-delivery claim.
- Label read/merge/write cannot prevent a simultaneous external update without provider compare-and-swap.
- SSO, staff navigation, Leads UI, AI replies and live Meta channels remain later work.
- Hosted real test-inbox acceptance (05 CH-2 and CHECKLIST C/CH-2), post-delta full Boutique Tier A, and owner CH-2 acceptance remain before closure. No CH-2 commit yet.

## Owner actions, in order
1. Supply chosen root domain. Chats will open chat.<domain>; Leads stays in OS PLUS.
2. Hosting ceiling is INR2,000/month, no server exists (D031). A concrete proposal must fit taxes/backups/renewals before purchase approval. No server/domain is needed for the local inbox test.
3. After explicit server/deployment authorization, follow CHECKLIST B1–B4 and deploy/chatwoot/README.md with fresh private credentials. Do not paste secrets into chat.
4. Approve a named test tenant/inbox and test WhatsApp number (CHECKLIST C/CH-2); separately authorize hosted migrations/deployment and the test message when ready.
5. Observe one message in Chatwoot and its tenant-correct capture; accept CH-2 after remaining gates. No additional Clerk keys or login needed for CH-1.

## Callback rotation recovery
If a configured workspace secret or callback origin changes, automated setup intentionally refuses replacement. A platform operator, with explicit authority for that instance, must verify the recorded bot/account IDs, update that existing bot's outgoing callback and the existing account webhook URL to the new private URLs, and remove neither existing business data nor unrelated bots. Verify only the intended inboxes are attached, then rerun setup to reconcile the same IDs. Never log/share callback query tokens. Unknown pending creation outcomes require read-only provider reconciliation; do not clear receipts or repeat creates merely to force success. Automatic rotation orchestration is not implemented.

## Pinned upstream contract references
Read-only primary sources consulted; no reference-business code/data copied:
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/models/message.rb
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/presenters/conversations/event_data_presenter.rb
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/listeners/agent_bot_listener.rb
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/views/api/v1/accounts/webhooks/index.json.jbuilder
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/views/api/v1/accounts/webhooks/create.json.jbuilder
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/controllers/api/v1/accounts/inboxes_controller.rb
- https://raw.githubusercontent.com/chatwoot/chatwoot/v4.18.0/app/views/platform/api/v1/models/_agent_bot.json.jbuilder


## Actual isolated Chatwoot checkpoint — 2026-10-21
Supersedes earlier statements above that no actual Chatwoot or website capture existed. Phase remains QA_BLOCKED for closure.

- Official v4.18.0-ce, pinned digest faaa58a911cda8f2ab9d717ddf8ca4332163b07da4c5da10711d896e5d667442, runs in owned osplus-chatwoot-local-8e8d10a9c1. Own Postgres17/Redis/storage, loopback UI4141/API4444, visitor4142, callback relay4132. Private Rails/worker network has no internet egress. No n8n/Meta/SMTP/model/Telegram configured.
- Two synthetic accounts/inboxes901/902 and separate users map to existing Chat Local1/2. Actual account tokens cannot access the other inbox. Local-only fixture origin rebinding audited; credentials encrypted by existing commands. No new OS PLUS migration this turn. Chatwoot native migrations applied only to its new owned DB volume.
- Local app --chatwoot uses CHAT_DRY_RUN=false/CHAT_ADMIN_LIVE_ENABLED=true only for actual loopback provider writes; no production env edited. Scoped private CA, no TLS verification disabled. Local safe-fetch private-network exception and request-URL logging suppression are restricted to the local stack/snapshot.
- Six gates PASS after provider contract correction: typecheck; lint (rerun on final harness); build51/51; roles including11 proxy cases; V2four suites; final test:chat64/64, zero skipped. Final Chat log outputs/chat-local/ch2-final-chat.log; other logs outputs/chatwoot-local/.
- Actual provider QA10/10 PASS, rerun after stronger timing assertions: incoming capture and duplicate event/agent single silent turn for each tenant, exact non-null staff quiet deadline preserved over private note, label preservation, cross-account inbox denial. Incoming fixtures in this script are created through Rails models; staff/private notes use API. Report outputs/chatwoot-local/qa-report.json.
- Independent browser exchange PASS: actual visitor inquiry19, staff Take over and reply24, reply visibly received, both captured under tenantA. Automatic email-prompt messages20/21 classified system. Report outputs/chatwoot-local/browser-report.json; screenshot evidence C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch2-evidence/staff-reply.png and visitor-reply.png. Embedded widget renders; automation could not interact inside the iframe and completed the exchange by opening its observed iframe URL in a separate tab. Do not claim embedded-frame interaction automation passed.
- Authenticated Clerk owner-b Sync inboxes PASS; actual Chat Local2 inbox only, connection active, viewer/finance grants still off.
- Captured website customer/system/staff payloads sanitized into scripts/fixtures/chatwoot/local-4.18-website.json. Parser suite6 passes. No captured Meta fixture claim.
- Runtime lifecycle4/4 PASS: nonce/nonwebhook denial, aborted upload survives, next wrong-secret request reaches OS PLUS and fails closed, relay/visitor stop/restart retains data. Report outputs/chatwoot-local/runtime-report.json.
- Actual native Chatwoot pg_dump/pg_restore PASS:100 public tables with row counts and content hashes,385496-byte dump, fresh restored DB cw_restore_f8dda742cf8e. Rails/Sidekiq paused during dump/compare then restarted; staff page reopens afterward. Report outputs/chatwoot-local/restore-report.json. Database-only in same cluster, not Redis/attachments/host recovery.
- Bugs fixed: actual unassigned inbox returns {}; accept precisely empty object or valid bot shape (reject unknown malformed shape). Local exact-name Docker collision checks; interrupted request-body handling; QA callback timing and null quiet assertion. Two narrow independent re-reviews report no unresolved actionable findings.
- No new full Boutique browser tier this turn; prior CH-2 DB regressions and CH-1 14-path browser evidence remain separately recorded. Full post-proxy Tier A, Meta test-inbox acceptance and owner CH-2 acceptance remain before READY_FOR_CLOSURE.
- Owner can test now: [local instructions](../scripts/chatwoot-local/README.md), staff http://localhost:4141, visitor http://localhost:4142/1 or /2, credentials only in ignored outputs/chatwoot-local/LOGIN.txt. Separate local Chatwoot login; no new Clerk keys needed. Owner-a OS PLUS sign-in is the remaining prerequisite for the existing tenantA Boutique workflow fixtures.
- No purchase/public push/merge/deployment/shared migration/real customer message or paid model call. Model/API spend USD0. CH-2 uncommitted.


## Boutique resumption identity check — 2026-10-21
Owner reported Chat Local1 login and authorized the remaining regression. Refreshed localhost4131 browser still identifies owner-b+clerk_test@example.com / Local QA B; localhost4141 is separately Chatwoot account901. Actual known tenantA Boutique order navigation returned404 under B, confirming current cross-tenant denial. Screenshot: C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch2-evidence/boutique-a-denied-for-b.png. Returned OS PLUS tab to Chat setup. Requested owner-a OS PLUS login or the browser containing it; no memberships/session credentials altered.
No full BA-001–BA-014 rerun claimed. Automated gates were not rerun for this documentation/identity inspection; prior64-test evidence stands. No migration, production change, new defect or spend. Exact owner steps are now [CH2_OWNER_ACCEPTANCE.md](CH2_OWNER_ACCEPTANCE.md); local acceptance and remaining Meta/full-phase gates are explicitly separate.


## Post-provider Boutique browser checkpoint — 2026-10-21
Supersedes the earlier pending owner-a and unexecuted Boutique critical-path notes above. Actual owner-a desktop execution passed all14 policy critical paths within the owner scenario, plus7/7 read-only DB persistence assertion groups. See [CH2_BOUTIQUE_QA.md](CH2_BOUTIQUE_QA.md) for IDs, exact evidence, persona/GST/public-session limits and unchanged QA workbook preservation blocker. No runtime/migration changes in this slice. Owner inquiry43 is visible in account901 conversation6; stale Chatwoot session recovered via existing login and All-status filter retested successfully. Local owner acceptance and actual Meta evidence remain pending; phase stays QA_BLOCKED. Six suite gates/64 Chat tests remain earlier evidence, not rerun here. Model/API spend USD0.


## Final local checks / workbook repair — 2026-10-21
Owner explicitly confirmed the reply works. Actual conversation6: incoming43/46 each have one silent turn; staff48 is captured, with quiet_until exactly60 minutes after its timestamp; system44/45 have no turn. Actual browser private note49 is visible to staff and absent from the visitor widget; switching back to Reply verified. Owner-a Settings/Chat Sync inboxes returns only Chat Local1 Website, active connection, Local Inquiry Brand, draft. Screenshots: chat-ch2-evidence/final-private-note.png, final-visitor.png, final-inbox-sync.png.

Rerun: scripts/chatwoot-local/qa.mjs PASS10/10 (both accounts, real callback capture/deduplication, non-null quiet clocks/private notes, preserving labels, denied cross-account inboxes). New ignored outputs/chatwoot-local/pending-check.mjs PASS5/5, report pending-check-report.json: actual provider pending conversation8/message64 captured once, stayed pending beyond5-second provider timeout, no bot-error activity; private note49 classification; unchanged owner reply quiet clock; no A messages under B. A direct idempotent Rails SafeFetch callback replay succeeded in290ms. New probe initially attempted an unsupported response.code method and reported NoMethodError; corrected probe executes the exact upstream block and passes, with no application fix.

Historical bot-error activity47 was observed on conversation6. Its exact past cause was not retained at the local error-only log level. Fresh direct replay and new pending case do not reproduce it. No root-cause/fixed claim; keep this observation for subsequent real-channel QA. Browser automation could fill the embedded widget but cannot click/send in that iframe (focus-root errors); unsent draft was cleared. User's successful send/reply and actual rendered widget remain human/browser evidence. The fresh pending inquiry used a Rails fixture, not a browser action.

Boutique persistence helper rerun PASS7/7. Additional anonymous HTTP checks with default Accept and no cookies/auth headers PASS2/2: valid tracking200 with safe order data and no worker/workflow/internal notes; invalid token404 without order data. Explicit Accept:text/html gets307 to Clerk Development handshake; no fresh anonymous-browser claim or product bypass introduced. Prior14-path owner-scenario scope/persona/GST limitations still apply.

Workbook repaired:14 dated N2:N15 notes in Boutique Regression; only rows2–15 height190pt for legibility. Historical statuses/results and original role/GST conditions preserved. Prior1916-style-change report was a verifier error comparing StyleProxy wrappers; copied style contents compare equal. Artifact render saves valid PNGs/RENDER_OK then exits1 at shutdown, contrary to the earlier no-image conclusion. Three changed-range previews were viewed. Final file preserves every other ZIP package part byte-for-byte; the edited worksheet compares exactly after normalising only14 note cells and14 heights. Verification report/original copy in C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch2-workbook. Installed tracker SHA256 d63cbae54a04df4b140abff3e035ee7bb3f7fb2b190a3939477a889d59d54171. Workbook blocker RESOLVED; prior statements above are historical.

No new runtime source code/migrations or hosted changes in this slice. Earlier six gates/64 Chat tests remain prior evidence; not rerun for docs/workbook/local synthetic checks. Current technical local checks pass within these limits. Formal phase acceptance and actual Meta captured-channel/test-inbox evidence remain; CH-2 QA_BLOCKED. See [Meta testing runbook](CH2_META_TESTING.md) for owner steps and public HTTPS approval boundaries. No real messages, public exposure, model spend or phase commit.


## Local closure assessment — 2026-10-21 (CHAT-D034)
Owner explicitly authorised local closure/commit and CH-3 progression with live Meta acceptance deferred as a production-release blocker. This supersedes the earlier blocked phase status for LOCAL progression only; no real-channel readiness is asserted.
- Final npm run typecheck/lint/build/test:roles/test:v2: PASS; roles includes11 exact ingress cases, V2 four suites. Logs outputs/chat-local/ch2-close-*.log.
- Final npm run test:chat: PASS65/65,0 skipped (outputs/chat-local/ch2-close-chat-with-bot.log). Added scripts/fixtures/chatwoot/local-4.18-bot.json and captured AgentBot parser test; actual local message67 stored bot with0 turns. Initial15s poll expired before eventual capture; readback confirms capture, no guaranteed latency claim.
- Captured website native template/greeting is already present in local-4.18-website.json. These are website provider fixtures, not WhatsApp approved-template evidence.
- Independent final standards review:0 actionable findings. Spec review found P2 restart instructions missing react-server condition. Reproduced plain-node startup failure; corrected up/app examples to existing npm run chat:local alias; npm run chat:local -- status verifies owned gateway/db/app; narrow re-review0 unresolved findings.
- Migrations20261021110000_chat_capture.sql /20261021111000_chat_transport_setup.sql reviewed additive/service-only; already applied only locally as above. Actual75-migration replay and two restore drills remain earlier evidence.
- Boutique14 critical paths in owner scope;7/7 persistence rerun; workbook repaired. No other shared runtime changes in this closure slice. Existing P3 measurement dialog and historical bot-error47 observation retained in evidence.
- Phase can move to READY_FOR_CLOSURE for LOCAL commit under D034: YES. Final diff/migration review complete, git diff --check PASS. External Meta captures/test-inbox acceptance, production deployment/activation and later-phase workflows remain excluded/deferred, not passed.
