# CH-6 QA — implementation checkpoint, 2026-10-22

Current status2026-10-27: CLOSED LOCAL underD025/D050; authorized phase commit records the reviewed engineering closure. Historical checkpoints below remain for traceability; latest engineering evidence is at the end. Owner/live acceptance deferredD050; statements deferredD047.
Base a09561d1ecce48acdd4e3a4df18ec368773ed953 on codex/chat-ch1-foundation.
Approved scope: CHAT-D045–D049; CH6_IMPLEMENTATION_PLAN.md is authoritative.
Live AI remains disabled; existing explicitly opted-in local private mock mode is unchanged.

## Built and actually exercised

- Strict pure readiness, version/revision, staff access, routing, review and price-image eligibility rules.
- Tenant-owned provisional request save/revise/withdraw, quoted public-customer evidence, one-hour exact-contact duplicate fence, sorted service identity, current-pack/capability checks and version conflicts. No customer/task/operational booking is created by saving a request.
- Audited real CHAT_HANDOFF task creation through the existing platform Domain Command; one active task per lead/work kind, merged reasons, eligible assignment and completion, new work after completion.
- Routing: mapped eligible Chatwoot user, eligible lead owner, configured active mapped branch team, unassigned. Different/unmapped branches never inherit a channel's team.
- Staff-only bounded request/task read endpoint; viewer/finance and foreign IDs denied, including completed-command replay after module revocation.
- Capability-aware pack publication: callback packs permitted; Laundry requires its enabled vertical. Existing authenticated configuration receipt replay is preserved. Current application configureChat publication adapter uses the new endpoint.

## New migrations and application destination

All five are new/uncommitted and have been replayed only in owned disposable PostgreSQL. The retained LOCAL15437 database remains at the prior 83-migration CH5 baseline. No shared database was read/written for this QA.

1. supabase/migrations/20261022120000_chat_action_state.sql
2. supabase/migrations/20261022121000_chat_action_commands.sql
3. supabase/migrations/20261022122000_chat_handoff_tasks.sql
4. supabase/migrations/20261022123000_chat_capability_publication.sql
5. supabase/migrations/20261022124000_chat_action_read.sql

Actual harness applies all 88 repository migrations to fresh synthetic PostgreSQL, using the already-present pinned image with --pull=never; test-owned containers are removed with ownership verification. Existing applied CH5 migration files were not edited. No retained-local upgrade or restore is claimed.

## Automated evidence

New targeted checks: rules5/5 and actual PostgreSQL10/10, red→green increments. The 10 database checks cover two synthetic tenants, genuine independent-client concurrency, role/module revocation, exact quoted evidence, native task creation/assignment/completion, branch routing, callback publication/replay and a forced audit failure rolling back task/lead/reason/idempotency writes.

Latest six-gate outcomes are recorded below after their runs finish. Logs: outputs/chat-local/ch6-slice-{typecheck,lint,build,test-roles,test-v2,test-chat}.log. Counts from targeted runs overlap the full Chat suite; do not add them to its total.

## Defects found and fixed in this slice

- Viewer/finance could propose non-approval mutations in the initial pure operation rules; now all mutations denied.
- Different service ordering could create duplicate drafts; canonical set ordering is stored before duplicate detection.
- Channel-level team fallback could route a different branch incorrectly; configuration now keys channel plus mapped active location, with locked branch facts.
- Test fixture sourceId initially did not match the verified synthetic WhatsApp phone; fixed the fixture after capture correctly rejected it.
- The server-command harness needed the actual new dependency and SQL RPC signatures. One over-broad dependency-map edit affected an unrelated test; corrected. These harness failures are not recorded as passing results.

## Explicit remaining work / owner QA

Not built/verified yet: complete customer-summary/confirmation and atomic staff-approved callback/Laundry materialization; post-materialization handoff UI; capability/action/routing setup and Leads/embedded controls; worker action intents and atomic completion; remote assignee observation, labels/notification intents, media/review delivery, channel/map/link rules, owner auto signoff/outbox, actual local provider/browser/latency checks.

Pure policy eligibility is not delivery evidence. No full booking, public auto reply, review solicitation or image send is claimed.
No CH6 browser/mobile/owner acceptance, fresh Boutique TierA, retained database upgrade or restore has been performed. CH5 evidence remains historical only. Required later owner exercise is CHECKLIST.md Part C, CH-6 row (updated to accepted request-first scope); a detailed CH6 owner acceptance file will accompany the completed interface, not an unfinished form.

CH6 cannot move READY_FOR_CLOSURE or be committed now. Statement issuance is explicitly deferred D047; Meta/real-WhatsApp/live-model acceptance remains unexecuted/release-blocking. Separate Shopify hosted OAuth/renewal and owner-deferred n8n remain separate work.

Spend USD0. No paid provider/model, new image download, real external message, public tunnel, production setting, shared migration, n8n activation, push/merge/deploy.

## Latest checkpoint gates — PASS, 2026-10-22

- npm run typecheck — PASS, exit0, after build route generation.
- npm run lint — PASS, exit0, no warnings/errors.
- npm run build — PASS, exit0; no deployment.
- npm run test:roles — PASS: platform/Chat policies and18 exact ingress cases.
- npm run test:v2 — PASS: four existing baseline/work-unit/command-task/Laundry scripts.
- npm run test:chat — PASS183/183,0skipped; includes all15 new rules/actualDB tests. Final run after branch/duplicate/read/harness fixes; actual88 migration replays. Prior intermediate failures remain documented above, not represented as passes.

Source logs are outputs/chat-local/ch6-slice-*.log; targeted runs overlap these totals. Applied CH5 migration SHA256s match CH5_QA.md (all4); git diff --check passes. Latest lint covers corrected database test harness. No runtime change after these gates, only documentation records.

This passing checkpoint does not complete CH6 acceptance. Fresh Boutique TierA/native UI, retained upgrade/restore, complete booking/task/action UI and remaining delivery/provider/owner gates still required. No owner test requested yet, no phase commit or service restart.

## 2026-10-23 delivery/action checkpoint
Latest full Chat205/205/0skip PASS (outputs/ch6-chat-full.log); runtime22 and client10 overlap this total. All96 SQL replay only disposable owned Docker DBs. RetainedLOCAL83 unchanged; all13 CH6 SQL still unapplied there. Typecheck most recent pre-final-worker PASS; latest full other gates/browser/provider/upgrade/restore not yet claimed.
Two-axis review identified and regression-fixed stale intervening customer changes/equal timestamps, mutable routing retry hash, missing Laundry services, revocation-after-public-claim, automatic assignee omission, and committed-but-response-lost approval. Follow-up reviews pending; no closure.
Current exact new paths and remaining QA are in the same root summary checkpoint. Official API references checked for pinned-adapter behavior (current docs may show newer auth, do not change pinned4.18 auth): [conversation details](https://developers.chatwoot.com/api-reference/conversations/conversation-details), [replace labels](https://developers.chatwoot.com/api-reference/conversations/add-labels), [multipart messages](https://developers.chatwoot.com/api-reference/messages/create-new-message), [WhatsApp prefilled links](https://faq.whatsapp.com/5913398998672934). No real channel/model acceptance from these sources or mocks.
D052 describes conservative review/asset/label limits. Price preview is approved source link; actual public image waits for text receipt. Native Chatwoot multipart/label/auto behavior and authenticated setup/action UI still need local QA. LiveAI off/USD0.

## Owned-local upgrade and automated gate checkpoint — 2026-10-23/24
13 reviewed CH6 migrations applied only to owned LOCAL15437 (83→96). Native pre-dump restored chat_restore_fac8dd00a78a:132tables/1522291bytes; rehearsed/actual migration preserved all132 existing manifests. Native post-dump restored chat_restore_af033dad7db4:141tables/1662148bytes; full manifests/ACL PASS. outputs/chat-local/ch6-upgrade-report.json. Applied source bytes frozen; new timestamp SQL required for any subsequent SQL fix.
All six current automated gates PASS, Chat209/209/0skip; typecheck/lint/build/roles/V2 logs outputs/ch6-*.log. Final targeted runtime24/24 overlaps209. Focused Standards and Spec reviewers clear all findings after real regressions.
Current-source local app hidden launcher PID16028, explicit --chatwoot --mock-suggestions --mock-actions, liveAI false/modelIDs/keyblank. Prior owned CH5 process2520/27448/33212 verified by commandline/parent relationship before replacement; no unrelated process stopped. First launcher26172 refused occupied port without replacing a listener.
Actual PostgREST/Supabase+production adapter QA8/8 groups PASS, including anonymous/tenant/role boundaries, concurrent idempotency, publication and audit rollback; Boutique payment/workflow/add-items real API smokes PASS; separate native restore/ACL PASS. outputs/chat-local/ch6-local-api-report.json. Initial old harness dependency and obsolete empty-tenant-B assertion corrected to current two-configured-tenant isolation. These are API checks, not fresh authenticated BA14/browser acceptance.
Native Chatwoot QA currently in progress. Initial actual A/B provisional/private suggestions and merged handoff labels PASS; owner-signed public text PASS but image held because approved ActiveStorage redirect URL was rejected. Native read confirms no image POST; diagnostic original302/directproxyPNG68bytes proves cause. Corrected local fixture URL to direct proxy, kept redirect rejection, uses fresh conversation on rerun; old uncertain attempt is not retried. Final native results pending.
Authenticated OS PLUS UI blocked: existing tab4 is a data-URL error page, browser policy denied observing it; no bypass/alternate browser route used. Requested owner manually reopen http://localhost:4131/settings/chat when available. Existing session also emitted Clerk development JS load failure. Desktop/mobile/current role/UI and full Boutique TierA14 are NOT PASS; CH5 historical evidence is not a substitute. Current phase cannot close/commit/enterCH7 while this engineering gate is blocked. See CH6_OWNER_ACCEPTANCE.md C6-L0–L7. D050 defers owner/live acceptance only; USD0/no external change.

## Final native checkpoint — 2026-10-24
Native Chatwoot6/6 PASS (outputs/chat-local/ch6-native-report.json; log ch6-native-qa-rerun.log). Actual account901 callback24/private193 and account902 callback10/private198 create isolated provisional requests; complaint25 creates one task and merged label preserving qa-preserved; automatic price conversation26 gets public text209 then public image210, actual multipart receipt/attachment, twice-replayed callbacks keep one image. Actual summary→customer yes captured on A24; operational approval correctly rejects unverified website identity. Both channels restored draft; approved local synthetic owner context is API fixture identity, not a claim of Clerk owner acceptance.
Original A22 asset redirect failure retained as uncertain with no native image POST; no resend. Exact direct proxy URL is approved in a new published synthetic pack and uses the same redirect-rejecting transport; original302/directPNG68byte positive/negative regression is in native helper. Actual signed-in Chatwoot A26 desktop visually verified; screenshot C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch6-evidence/native-auto-text-image.png. Fixture image is one-pixel PNG, no real prices/brand facts.
Five additional fresh native mock auto conversations measured actual customer-message→public receipt: median1823.933ms, target6000ms met for LOCAL MOCKS ONLY; ch6-latency-report.json and ch6-native-latency.log. No live-model/Meta/network latency claim.
Authenticated OS PLUS UI/full fresh BA14 remain blocked per C6-L0. Existing Clerk public development script HEAD200 from host, no secret read/transmitted; stale tab remains data-URL error and iframe session previously failed script loading. No authentication/security weakening attempted. QA workbook unchanged; existing CH5 BA statuses are historical, not reused for CH6.
Current phase QA_BLOCKED, not READY_FOR_CLOSURE/CLOSED; no commit or CH7 work. Owner/live gates deferred under D050, but engineering manual browser checks still required. Decisions D051/D052 selected under owner authority; no pending product question, only local browser access restoration. USD0, liveAIoff, no shared SQL/external messaging/production activation.

## Authenticated engineering QA —2026-10-24, reconciled2026-10-27
Historical browser blocker resolved when owner manually reopened settings. Same retained real Clerk owner-a session, Local QA A. Owner setup saves current draft controls; auto checkbox required and unchecked prevents submission without signoff. Request exact-evidence revision clears earlier customer confirmation; prepare/copy current reviewed summary works; old yes rejected. Website request remains provisional; unverified identity operational approval refused. Actual SQL confirms no customer materialization.
Manager assigned/completed a native handoff;375px same-origin iframe created new handoff after completion. Viewer default404, read grant masks conversation text/contact, explicit PII grant still no action controls or Chatwoot entry. Finance default404; read grant masked/read-only, no mutations/Chatwoot, Chat performance404. Effective membership changes in synthetic Local QA A, not independent role sign-ins; original owner role/grant values backed up and restored, asserted exactly (timestamps changed). A→B→A and copied A lead/customer/order URL404 checked.
Actual375CSSpx authenticated frames measure356/356 client/scrollwidth (scrollbar gutter), request/setup save controls readable and exercised. Desktop actual signed-in controls checked. Browser viewport API did not reliably yield requested exact width, reset; iframe evidence is not physical-device certification. Screenshots under C:/Users/abhij/OneDrive/Documents/New project 2/chat-ch6-evidence.
Fresh BoutiqueTierA14/14 plus native persistence7/7 and action/restoration/anonymousHTTP4/4 PASS; CH6_BOUTIQUE_QA.md is exact execution record. Workbook updated/preservation verified there. Former CH5 evidence remains historical.

### UI defects / final review
Early unhydrated new forms could fall through to default GET; disabled new action/settings fieldsets until React attaches handlers using useSyncExternalStore hydration snapshot (first effect-based attempt failedlint; corrected). Settings save feedback now lives outside editor; redundant explicit refresh removed. Obsolete lead help text updated.
Focused Standards and Spec reviewers foundP1 in intermediate stable-id editor: checked approval/stale edits survived a new pack/settings revision while fresh identifiers were submitted. Actual real-component disposable authenticated fixture reproduced both failures before fix. Corrected stable feedback wrapper with child editor keyed channelId+settingsVersion+packId. Same actual component green: new pack approvalunchecked; newer draftmode/different canBook replace old values. Real owner settingssave still shows Channel controls saved and draftmode. No fixture saved/provider call; ignored snapshot-only route, not shipped source. Final review follow-up pending; no P1 deferral.
Transient Clerk fetch-failed network error once; normal reload recovered, no auth change. Original UI success messages were checked after final render, not inferred from transient Working output.

### Interrupted final Chat gate
Oct24 final rerun209pass/1failed-file due docker child exitnull after~39minutes; retained logs ch6-final-ui-chat.log are notPASS. Oct27 Docker engine29.7.2 reachable with retained owned stacks. First isolated command omitted configured react-server condition and failed server-only import (test invocation error). Correct configured isolated rerun22/22PASS in9.6s, ch6-resume-lead-storage-server.log. Complete configured Chat gate rerunning; record final count from finished log, do not infer/skipfailed tests.
No new migration applied this QA; frozen13 remain local-only. Owner/live acceptance explicitlydeferredD050, Meta/realphones/liveAI remain release-blocking. USD0/no external delivery or release.

### Final engineering gates —2026-10-27 PASS
npm run typecheck, lint(0warnings), optimizedbuild PASS after version-bound UI fix; outputs/ch6-resume-{typecheck,lint,build}.log. npm run test:chat209/209,0skip PASS in22.4s, outputs/ch6-resume-final-chat.log. Roles platform+Chat+18exact-ingress and V2four scripts PASS in preceding final run, no relevant policy/shared-runtime changes afterward. Correct isolated storage22/22 overlaps209. Interrupted/incorrect invocation logs retained, not represented asPASS. Applied migration hashes13/13 unchanged; git diff --checkPASS. Both final focused review axes clear after actual red→green approval/editor fixture and final real owner save/feedback verification. P0/P1 unresolved0. Existing Boutique baselineP3 dialog and historical dateP2 remain outside Chat behavior scope, documented in CH6_BOUTIQUE_QA.md.
Engineering requirements now permit READY_FOR_CLOSURE LOCAL underD025/D050; final documentation/staged diff and local phase commit still required before CH7. No new migrations/spend/external actions. Owner/live checks remain unexecuted and release-blocking.
