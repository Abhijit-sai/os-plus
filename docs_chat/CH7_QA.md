# CH7 local QA record
2026-10-27. Existing codex/chat-ch1-foundation, phase baseline a192a4dca2b87d75b54db1e60d18d98795d45f1a. CH6 CLOSED LOCAL. CH7 CLOSED LOCAL at445770b8d1e98784c287eb8a955fbe296d23a392 under owner CHAT-D055. Production readiness not claimed.

## Implemented scope
Owner-only disabled-by-default notification settings; high-entropy30min single-use code linking with separate owner confirmation; encrypted recipients/retry material; minimal event/brand/authenticated-link alerts; owner-DM full summaries with source metrics, explicit windows/currencies/unknown cost/unrated judge. Durable tenant-owned target/date/incident claims, revocation/expiry/held ambiguous receipts, audited atomic commands, protected secret-header/Bearer routes, post-response source-drain plus bounded cron fallback, offline write-free preview and credential-free inactive new-instance n8n template. D053/D054 recommended defaults. Chatwoot remains the staff reply box. LiveAI/realTelegram/model keys disabled.

## Automated evidence
- npm run test:chat — PASS234/234,0skip,31.192s, outputs/ch7-complete-chat.log. This includes15 actual disposable PostgreSQL tests, not15 extra to add to234. Post-lint test-only variable rename rerun15/15 PASS, outputs/ch7-final-db.log.
- Actual schema replay101 migrations; ownership/RLS/ACL, role and guessed-tenant denial, replay/expired/concurrent one-use links, separate activation, safeDTO, cross-tenant brand rollback, audit-failure rollback, source metrics/private-message exclusion, currency and legacy cost accounting, unknown cost, two different tenant cutoffs/concurrent preparation, actual outbox→mockHTTPone report each/no replay, target/brand revocation, held ambiguity/abandoned attempts/partial reports, encrypted operator hourly claims/no retry,23/25h/DST ambiguity.
- Handler tests authenticate before bounded parse and defer tenant resolution; provider/header/cron tests are synthetic. Telegram client uses actual loopback HTTP and validates exact chat/text receipt, bounds, kill switches, no retry.
- npm run test:roles — PASS platform/Chat policy and23 exact ingress cases, outputs/ch7-complete-roles.log.
- npm run test:v2 — PASS four scripts, outputs/ch7-complete-v2.log.
- npm run lint — PASS0warnings, outputs/ch7-complete-lint.log.
- npm run typecheck — PASS final source, outputs/ch7-complete-typecheck.log. npm run build — PASS optimized final semantics, outputs/ch7-complete-build.log; subsequent formatting only. No deployment.
- Offline preview executed on synthetic JSON PASS, outputs/ch7-offline-preview.log. Final owned-local read-only persistence/safety9/9 PASS, outputs/chat-local/ch7-final-assert-report.json; includes inactive n8n JSON parse, not an imported/runtime workflow.

## Retained owned-local upgrade/recovery
Five SQL applied only127.0.0.1:15437,96→101. Frozen exact hashes and native pre/post restoration evidence in CH7_LOCAL_UPGRADE.md.141 existing table row manifests preserved with explicit new-column projection for additive defaults; native complete restores141before/143after pass. No sharedSQL/replay/reset or full host/Clerk/storage DR claim.

## Authenticated current browser/native evidence
Retained real Clerk owner-a/Local QA A. Actual UI read-only report preview PASS; no writes/sends. Repeated create resets form/new identity; one-time issuance then actual Next route→after→encrypted inactive claim for private/group syntheticupdates, replay no change. Private destination explicitly confirmed/activated with new_enquiry+daily_summary and Local Inquiry Brand filter; tenant notifications enabled. Staff group remains inactive/unconfirmed; daily report disabled. Used code/stale issuance feedback disappears. UI recent delivery confirmed.
Native local Chatwoot conversation32/message→lead7f9b0fb1-0537-4ea5-b467-1b698da52135→one outbox695f4bf0-3433-4baf-8b9d-dba0f33de884→mockHTTP receipt1001 PASS (outputs/chat-local/ch7-native-report.json). No realTelegram/customer message or paid model call.
Manager/viewer/finance effective membership each redirected away from settings to permitted Orders/Reports/Finance and exposed no configuration controls. Original owner role restored and SQL verified, grants unchanged. This is effective-role coverage with retained Clerk login, not independent persona credentials.
375CSSpx same-origin authenticated iframe: measured outer375/content373 (border), visible responsive fields/buttons fit; settings save and report preview PASS. Mobile report shows1chat/1customer message/1new lead, private draft excluded, judge not evaluated. No physical phone/screenreader claim. Screenshot folder C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch7-evidence. The snapshot-only iframe fixture is not production source.
Actual A→B→A selector PASS; B exposes no A targets and preview0chats, A1chat. Cross-tab cookie switch mismatch now refuses both save/preview before RPC. Current cookie/business A, owner restored. Latest owner save/preview after guard PASS. Temporary snapshot iframe page removed after evidence; app remains running. Focused BoutiqueTierB PASS as detailed CH7_BOUTIQUE_QA.md; workbook onlyN2/N10/N15 changed, prior results/history/layout preserved.

## Defects and correction history
- Initial full Chat gate FAIL221/226: five existing VM adapters lacked new notification dependencies. Updated adapter dependencies; affected37/37PASS; final232PASS, no tests skipped.
- ReviewP1 current brand revocation; P2 untracked operator alert; P2 omitted legacy costs: reproduced/fixed with actualDB regressions; focused Standards/Spec rereviews clear all three.
- Partial report leftqueued after cancel/abandon: actualDBred→green with audited terminal states.
- Pure preview fall-back ambiguity: red→green; SQL is scheduling authority.
- UI repeated-create identity and expired issuance feedback corrected; React sibling-key collision found in actual browser and fixed with unique prefix. Actual save after reload has no new browser errors. Two source fixes synced to owned snapshot; exact hashes in ch7-snapshot-patches.jsonl.
- First native helper failed before mutation because account fixture lacked tenantId; fixed authoritative owned workspace lookup; final native PASS.
- Owned app restart first guard found unexpected process count and stopped before any kill. Exact node ancestry then verified and only owned Next parent/child restarted.

## Still unexecuted / release gates
Owner CH7 acceptance not yet granted; see CH7_OWNER_ACCEPTANCE.md and CHECKLIST PartC CH7. Real Telegram bot linking/scheduled delivery/group membership acceptance and selected live judge/model calibration are untested, disabled and release-blocking. n8n template parsed/source-reviewed only, not imported/runtime-tested/activated. Global DB/tenant resolution failure never bypasses a durable claim to send an operator message; protected diagnostics remain necessary.
Local engineering checks are complete; no unresolved P0/P1/P2 identified by final focused Standards/Spec reviews. CH7 remains IN_PROGRESS awaiting owner acceptance and explicit live-gate deferral or execution; not READY_FOR_CLOSURE, committed or deployed. No push/deploy/sharedSQL/external messaging authority. Separate Shopify hosted OAuth/renewal and owner-deferred n8n remain outside Chat work.
Model/API spendUSD0.


## Final corrections / handoff — 2026-10-27
Actual stale-tab regression reproduced selected-tenant mismatch; displayed UUID is now asserted against authenticated current tenant before every notification save/preview RPC. Real DB adapter15/15 and actual B-tab/A-cookie save+preview denial PASS; current owner A save+preview PASS. Setup-only mode with both transports disabled now exits before storage/source claims, tested red→green. No migration change needed. Test-only reserved module variable renamed adapter after lint failure; final lint0warnings/typecheck and focusedDB15/15 PASS. Full234/234 includes the added paused-transport and stale-tab cases.
Both focused final review axes clear; no reviewer execution claimed. Source snapshots aligned after final formatting with hashes ch7-snapshot-patches.jsonl. Actual module count234 and focused15 are overlapping, not additive. Final9/9 retained helper is read-only plus local snapshot sync, not a new migration/financial operation. Workbook preservation and known baseline limits are in CH7_BOUTIQUE_QA.md. No owner CH7 acceptance inferred. All five applied SQL hashes unchanged; CH7_LOCAL_UPGRADE.md remains authority for application/recovery. Final git diff --check and path/credential review recorded in summary; no release.


## Exact CH7 file manifest at owner handoff
- `.env.example`
- `deploy/n8n/chat-hourly.json`
- `deploy/n8n/README.md`
- `docs_chat/05_Phase_Plan_WBS.md`
- `docs_chat/06_Decision_Log.md`
- `docs_chat/CH7_BOUTIQUE_QA.md`
- `docs_chat/CH7_IMPLEMENTATION_PLAN.md`
- `docs_chat/CH7_LOCAL_UPGRADE.md`
- `docs_chat/CH7_OWNER_ACCEPTANCE.md`
- `docs_chat/CH7_QA.md`
- `docs_chat/CHECKLIST.md`
- `docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx`
- `docs/agents/domain.md`
- `docs/agents/issue-tracker.md`
- `project_summary.md`
- `scripts/chat-local/ch7-browser-role.mjs`
- `scripts/chat-local/ch7-final-assertions.mjs`
- `scripts/chat-local/ch7-qa.mjs`
- `scripts/chat-local/manage.mjs`
- `scripts/chat-local/mock-notifications.mjs`
- `scripts/chat-local/upgrade-ch7.mjs`
- `scripts/chatwoot-local/ch7-qa.mjs`
- `scripts/preview-chat-summary.mjs`
- `scripts/test-chat-action-runtime.mjs`
- `scripts/test-chat-capture.mjs`
- `scripts/test-chat-notification-handlers.mjs`
- `scripts/test-chat-notification-rules.mjs`
- `scripts/test-chat-notification-runtime.mjs`
- `scripts/test-chat-notification-summary.mjs`
- `scripts/test-chat-page.mjs`
- `scripts/test-chat-secrets.mjs`
- `scripts/test-chat-telegram-client.mjs`
- `scripts/test-role-route-policy.mjs`
- `src/app/(tenant)/settings/chat/page.tsx`
- `src/app/api/chat/cron/hourly/route.ts`
- `src/app/api/chat/webhooks/telegram/route.ts`
- `src/components/chat/notification-settings.tsx`
- `src/features/chat/actions/commands.ts`
- `src/features/chat/capture.ts`
- `src/features/chat/notifications/commands.ts`
- `src/features/chat/notifications/engine.ts`
- `src/features/chat/notifications/flags.ts`
- `src/features/chat/notifications/handlers.ts`
- `src/features/chat/notifications/platform-worker.ts`
- `src/features/chat/notifications/rules.ts`
- `src/features/chat/notifications/schemas.ts`
- `src/features/chat/notifications/server-actions.ts`
- `src/features/chat/notifications/summary.ts`
- `src/features/chat/notifications/trigger.ts`
- `src/features/chat/notifications/worker.ts`
- `src/features/chat/secrets.ts`
- `src/integrations/telegram/client.ts`
- `src/proxy.ts`
- `src/types/chat.ts`
- `supabase/migrations/20261027120000_chat_notification_state.sql`
- `supabase/migrations/20261027121000_chat_notification_commands.sql`
- `supabase/migrations/20261027122000_chat_notification_summary.sql`
- `supabase/migrations/20261027123000_chat_notification_dispatch.sql`
- `supabase/migrations/20261027124000_chat_platform_alert_attempts.sql`



## Owner acceptance and local closure — 2026-10-27
CHAT-D055 explicitly accepts the reported local results and recommended D053/D054 scope, defers unexecuted real Telegram/judge gates and authorizes local commit followed by CH8 planning. Supersedes earlier pending-owner/notREADY statements for local closure only. READY_FOR_CLOSURE LOCAL after final records/diff/hash review; commit result recorded in the root summary. Six gates/234Chat/15DB/TierB/manual/restore evidence above unchanged; no reclassification of mocks as live proof. No new runtime change or migration since those gates. LiveAI remains disabled, USD0. Production release remains blocked by deferred acceptance and infrastructure/Meta work. No CH8 implementation yet.


CH7 post-commit record: CLOSED LOCAL at445770b8d1e98784c287eb8a955fbe296d23a392 on codex/chat-ch1-foundation; clean verified immediately after commit. Supersedes READY/pending-commit history above. Current work is CH8 planning only; no realTelegram/judge test or external release occurred. Five migrations unchanged/local-only. Owner D055 acceptance/deferral is the authority.
