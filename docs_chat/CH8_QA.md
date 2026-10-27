# CH-8 local engineering QA — 27 October 2026

Status: IN_PROGRESS, local implementation ready for owner exercise after final records. Branch codex/chat-ch1-foundation, no upstream; baseline445770b8d1e98784c287eb8a955fbe296d23a392. No CH8 commit or phase transition. Owner acceptance and live speech/WhatsApp acceptance are unexecuted. Approved plan: CH8_IMPLEMENTATION_PLAN.md; decisions D056/D057. Payment screenshots/vision excluded under D023.

## Implemented
- Default-disabled per-business voice settings, lowerable120s/10,000,000bytes ceilings, owner-only versioned audited Domain Command and stale-tenant form guard.
- One original turn lease owns one tenant-scoped voice job, durable private-note claim/receipt/uncertainty. Original content/provider IDs/timestamps preserved; transcript is derived input. Critical multi-row writes and audit are one PostgreSQL transaction.
- Exact synthetic WAV/Ogg fixture hashes only; no live STT adapter, paid model key or acoustic recognition. Unknown recordings hand off. PCM RIFF and restricted Ogg/Opus CRC/packet/granule/duration checks precede synthetic interpretation.
- Authenticated account/conversation/message attachment lookup; ignore webhook URL. Select exact message before validating audio ownership. Allowlisted loopback Rails proxy, redirect:error, no API token on media fetch, streamed byte/MIME/duration/time bounds. Pinned4.18 serves Ogg as audio/opus; allowed only for byte-validated Ogg.
- One private transcript/provenance note, then private guarded suggestion. Transcript is never a customer reply or suggestion button. Unknown, superseded, quiet, disabled, changed-settings or uncertain work cannot silently retry/send.
- An unanswered burst containing unresolved earlier voice fails closed to reviewed handoff before closing detection/model calls, including audio→typed yes and audio→audio. Public staff/bot reply and configured fresh-session boundary reset this fence. SQL also rejects model completion on incomplete voice.
- Source-aware request evidence accepts published transcript for provisional requests. A transcribed or audio-caption yes cannot confirm a booking. Separate typed confirmation and staff approval remain mandatory; later voice invalidates stale approval.
- Transcribe cost stage shares existing tenant budget serialization; uncertain usage holds the ceiling. Local mock calls cost zero and do not reserve fictional costs.
- Read-only Leads derived transcript projection, masked in SQL and DTO unless separately authorized for contact details. Chatwoot remains the staff reply surface.

## Automated checks
|Command/evidence|Result|
|---|---|
|npm run typecheck|PASS|
|npm run lint|PASS, no warnings|
|npm run build|PASS optimized compilation; no deployment|
|npm run test:roles|PASS including23 exact Chat/Shopify ingress cases|
|npm run test:v2|PASS four existing scripts|
|npm run test:chat|PASS254/254,0skipped (final run includes all15 actualDB voice tests)|
|node --experimental-strip-types --conditions=react-server --test scripts/test-chat-voice-rules.mjs|PASS4/4|
|same runner scripts/test-chat-voice-clients.mjs|PASS1/1 real loopback HTTP; mixed history, wrong account/conversation receipts, revoked/disabled, redirect/foreignURL and pinned audio/opus|
|same runner scripts/test-chat-voice-runtime.mjs|PASS15/15 actual disposable PostgreSQL104-migration replay, not static SQL assertions|
|scripts/chatwoot-local/ch8-qa.mjs --run|PASS3/3 actual pinned local Rails uploads/callbacks and account API receipts|
|scripts/chat-local/ch8-final-assertions.mjs|PASS9/9 read-only retained Boutique/persistence/anonymousHTTP/packaging checks|

Logs outputs/ch8-{final-typecheck,final-lint,final-build,final-roles,final-v2,full-chat,review-runtime,opus-mime-green,native,final-assertions}.log. These are local ignored evidence, not credentials to copy elsewhere.

ActualDB: owner defaults/role denial, two-tenant guessed reads/commands, original lease claim/replay, independent-connection voice/note races, audit-trigger failure rollback, staff quiet/newer trigger, settings-version revocation during processing/ready/sending, byte bounds, uncertain private receipt held, stale server adapter before RPC, SQL+DTO PII grants, voice request evidence/typed confirmation/later audio invalidation, incomplete burst/fresh session, multiple recordings, expired lease, concurrent voice+text budget maxima/uncertain reservations. Simulated monetary entries live only in disposable fixtures; no paid calls.

## Native evidence
Final snapshot outputs/chat-local/app-1793122750687; owned launcher explicitly --chatwoot --mock-suggestions --mock-actions --mock-notifications --mock-voice. Live model and STT flagsfalse, model IDs/keyunset; both retained channels draft. No public tunnel/new external services.

|Case|Account/conversation/message|Observed|
|---|---|---|
|Synthetic WAV|901/36/258|One private transcript, one private suggestion, original contentnull, one job, zero publicbotreplies/costentries|
|Synthetic Ogg/Opus|902/12/264|Same, independently scoped to tenantB|
|Unknown hash audio|901/37/270|No fabricated transcript, one unreadable handoff task/private reviewed response, zero publicbotreplies/costentries|

Source report outputs/chat-local/ch8-native-report.json. Local filenames outputs/chat-local/ch8-synthetic-hours.wav and .ogg are one-second generated tones, not real speech. Existing Windows FFmpeg encoded and decoded the Ogg fixture successfully; no codec download/install. Native media read used authenticated GET to the exact account and an uncredentialed same-origin proxy fetch. Pinned serializer independently read: ordinary message attachments conditional, receipt conversation_id is display_id, account_id absent in normal create response.

## Browser and regression
Retained real Clerk owner-a+clerk_test@example.com session, not fresh credential entry. Owner settings save confirmed; effective manager sees transcript but settings redirects; viewer Leads-only masks body/transcript; separately granted PII exposes transcript read-only with no Chatwoot/manage controls; finance copied URL404. Effective membership/grants restored exactly with audited synthetic-local helpers. No independent manager/viewer credential login claim.

Actual A→B→A selector, B copied-A enquiry404 and own Ogg transcript visible; stale A voice form refuses after B selected. ActualDB separately asserts no RPC when displayed tenant differs. Desktop AX/DOM checked.375px authenticated iframe settings rendered with mobile navigation and actual framewidth375; final paired settings/transcript check recorded below when complete. Not a physical-device test. Initial screenshot capture was blank and is not visual-proof; native AX controls were used when Playwright display:contents wrappers had no clickable rectangle. Owner should verify final visual layout.

Boutique focused TierB: order ORD-000006 detail/editor opened without saving, production and customer-safe tracking loaded; read-only SQL preserved total2000/paid300/balance1700/two workflows/stage history. No new Boutique order/payment/stage mutations this phase. See CH8_BOUTIQUE_QA.md. Workbook only dated notes N2/N10/N15 changed, prior status/actual/history retained, formula scan0; Artifact rendering reviewed and exact package/value/style preservation passed.

## Migrations/recovery
Three frozen migrations only owned local15437, schema101→104. Native before restore143tables, rehearse exact SQL/data compare, retained apply, native after restore144tables/ACLs. All143 existing table row manifests unchanged. CH8_LOCAL_UPGRADE.md records hashes. No shared/prod SQL; no historical reapply. Same-cluster PostgreSQL restore is not a host/storage/Clerk recovery certification.

## Defects found and fixed
1. Earlier unresolved voice could disappear when latest customer message superseded it: pure/SQL burst fence and realDB regression.
2. Ordinary text history lacked attachments: select target first, mixed-history HTTP regression.
3. Lowered limits did not revoke in-flight work: claim-bound settings version, stored/current bytes and rechecks.
4. Transcript receipt lacked conversation match: exact required conversation/optional account check and wrong-scope HTTP tests.
5. Pinned Ogg MIME audio/opus was rejected: native reproduction, red→green realHTTP regression, final native3/3.
6. Strict context/source metadata, nullable token guard and new page VM adapters corrected during initial integration; full gates pass afterward.
QA-helper mistakes (nonexistent intent column, staff event without staffUserId, future event time outside capture bounds) corrected in fixtures/helpers, without weakening schema/guards. One dev snapshot/HMR/cold compilation attempt lacked an agent run; recovered only the verified owned app to a clean final source snapshot. Failed fixture history retained; not counted as passing tests or retried ambiguous voice work.
Read-only Standards/Spec reviews found no remaining concrete P0/P1/P2 after corrections; targeted MIME rereview clear. No production source or Fundry infrastructure touched.

## Owner/live gates and spend
Owner C8-L1–L7 in CH8_OWNER_ACCEPTANCE.md remain pending; checklist CH8 links there. Live STT provider/model, real language/acoustic accuracy, cost/privacy/retention selection and real WhatsApp gate remain disabled/unexecuted, release-blocking. No approval exception inferred from CH7 D055. CH8 cannot close/commit or start CH9 until accepted gate/explicit deferral. No new product decisions for local mocks. Earlier Meta/two-phone, realTelegram/judge/production server/domain and inactive new n8n remain separate unexecuted gates; Shopify hosted OAuth/renewal/owner-deferred n8n unchanged. No push/merge/deploy/sharedSQL/real external messages/purchase/tunnel/n8n activation. Model/API/transcription spend USD0.

## Final browser checkpoint
Actual A→B→A complete; B header/own Ogg transcript observed, copied A lead404. Stale A form produced “We could not confirm this change. Check the selected business and reload before changing other values.” Final paired authenticated frames each measured375CSSpx wide/1200high: owner Voice notes limits/mock-only wording and enquiry transcript/suggestion rendered with mobile navigation. Native AX used; blank screenshot attempt is not a visual PASS. Saved AX evidence in C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch8-browser. Owner visual inspection remains C8-L4. Effective role is restored owner_admin and original viewer grants are restored. No physical device or independent persona credentials tested.

## Final owner fixture and visual evidence
Owner fixture A38/message275/leadb1f538b7-d4f6-4995-8ecb-7eb1d6e5dcf8 PASS: same original-attachment/private transcript/private suggestion/zero cost/public send assertions. Both callback routes warmed with nonexistent credentials and returned404, then two real pinned SafeFetch callback replays accepted within5s, still exactlyone transcript and one draft, bot failure activity0. Report outputs/chat-local/ch8-owner-native-report.json. Native3/3 report remains intact. Earlier A36 contains historical local first-callback activity because the dev route compilation exceeded Chatwoot’s5s budget; this same limitation was diagnosed in CH5. No warning was deleted, timeout weakened or ambiguity retried. Owner C8-L1 uses clean warmed A38.

Screenshot capture recovered after pages settled: actual Chatwoot voice note/suggestion and paired375px owner voice limits/transcript screenshots visually reviewed readable, with no new layout blocker. Files C:/Users/abhij/OneDrive/Documents/New project 2/outputs/chat-ch8-browser/{chatwoot-voice,mobile-375,mobile-voice-controls}.png. Initial blank capture remains a failed attempt, superseded by actual images; no physical-device claim.
Mobile browser found existing Chat request MessageSelect server/browser local-date hydration mismatch. Corrected only Chat-owned src/components/leads/business-actions.tsx to explicit en-IN/UTC consistent with existing Leads clocks; no Boutique/date business logic changed. Fresh browser/gates verified below after this correction.

## Working file manifest at owner handoff
- .env.example
- docs_chat/05_Phase_Plan_WBS.md
- docs_chat/06_Decision_Log.md
- docs_chat/CH7_OWNER_ACCEPTANCE.md
- docs_chat/CH7_QA.md
- docs_chat/CH8_BOUTIQUE_QA.md
- docs_chat/CH8_IMPLEMENTATION_PLAN.md
- docs_chat/CH8_LOCAL_UPGRADE.md
- docs_chat/CH8_OWNER_ACCEPTANCE.md
- docs_chat/CH8_QA.md
- docs_chat/CHECKLIST.md
- docs_v2/OS_PLUS_V2_QA_Test_Matrix.xlsx
- docs/agents/domain.md
- docs/agents/issue-tracker.md
- project_summary.md
- scripts/chat-db-harness/voice-fixture.mjs
- scripts/chat-local/ch8-browser-role.mjs
- scripts/chat-local/ch8-final-assertions.mjs
- scripts/chat-local/ch8-viewer-grants.mjs
- scripts/chat-local/manage.mjs
- scripts/chat-local/mock-voice.mjs
- scripts/chat-local/upgrade-ch8.mjs
- scripts/chatwoot-local/ch8-qa.mjs
- scripts/test-chat-page.mjs
- scripts/test-chat-voice-clients.mjs
- scripts/test-chat-voice-rules.mjs
- scripts/test-chat-voice-runtime.mjs
- src/app/(tenant)/leads/[leadId]/page.tsx
- src/app/(tenant)/settings/chat/page.tsx
- src/components/chat/voice-settings.tsx
- src/components/leads/business-actions.tsx
- src/features/chat/agent/context.ts
- src/features/chat/agent/rules.ts
- src/features/chat/agent/turn.ts
- src/features/chat/agent/worker-core.ts
- src/features/chat/agent/worker.ts
- src/features/chat/voice/commands.ts
- src/features/chat/voice/http.ts
- src/features/chat/voice/mock-fixtures.ts
- src/features/chat/voice/opus-fixture.ts
- src/features/chat/voice/rules.ts
- src/features/chat/voice/schemas.ts
- src/features/chat/voice/server-actions.ts
- src/features/chat/voice/transcriber.ts
- src/features/chat/voice/worker-core.ts
- src/features/chat/voice/worker.ts
- src/features/leads/pii.ts
- src/integrations/chatwoot/attachment-client.ts
- src/integrations/chatwoot/transcript-client.ts
- src/types/chat.ts
- supabase/migrations/20261027170000_chat_voice_state.sql
- supabase/migrations/20261027171000_chat_voice_commands.sql
- supabase/migrations/20261027172000_chat_voice_context_reads.sql

## Final verification after UTC correction
Final typecheck/lint0warnings/optimizedbuild PASS and Chat254/2540skip rerun PASS after the one-line Chat UTC correction. FocusedDB15/15, native3/3 plus clean owner1/1/two duplicate callback replays, restored grants/Boutique read-only9/9 remain PASS. Refreshed paired375px page shows explicitUTC in the actual message selector; browser error log since reload contains no hydration mismatch. Final Standards targeted rendering review clear. Running snapshot src hashes compared with reviewed source, no mismatch; three applied CH8 hashes unchanged. No unresolved new P0/P1/P2.

Actual Chatwoot A38: staff Take over, Edit loaded suggested text into existing main composer, no nested editor; Cancel correctly preserved ordinary composer text (existing product policy), then only our synthetic QA text was cleared for owner handoff. No Send clicked/public reply posted. Owner checklist still pending; engineering staff-control evidence is not owner acceptance. Existing user tabs preserved/restored, temporary QA tabs/fixture cleaned after evidence capture.

## Exact final project_summary.md update
The following exact entry was appended to the same root living summary; prior history was preserved:

```text

## Chat Session Update - 2026-10-27 - CH8 local owner-ready

### Phase / Branch / Gate
CH8 IN_PROGRESS, local engineering implementation and QA complete; ready for owner C8-L1–L7. Same D:/Develop/os-plus-chat-ch0/codex/chat-ch1-foundation, HEAD445770b8d1e98784c287eb8a955fbe296d23a392/no upstream. Prior planning/history preserved. No CH8 commit/CH9 transition. Cannot mark READY_FOR_CLOSURE/close until owner acceptance and explicit live-gate disposition; no CH7 waiver extended.

### Built / Exact files
Bounded hash-only synthetic WAV/Ogg voice preprocessing under original turn lease, private transcript note/receipt/uncertainty, guarded private draft, original-message preservation, source-aware provisional evidence with typed-only booking confirmation/staff approval, incomplete-burst safety handoff, owner versioned/defaultoff settings and SQL+DTO transcript masking. Technical corrections: conditional provider attachments, pinned audio/opus validation, changed-limit revocation/current bytes, exact conversation receipt, and Chat MessageSelect en-IN/UTC hydration fix. Complete actual file manifest in docs_chat/CH8_QA.md; approved plan/decisions D056/D057 preserved. Source additions voice/*, Chatwoot attachment/transcript clients, voice-settings card, fixture/test/native/local-upgrade and reversible role/grant helpers; existing Chat context/worker/turn, settings/read-only Leads/projection, narrow Chat RPC types/env/local launcher and Chat-owned request date rendering changed. No shared customer/order/payment/tenant/permission behavior refactor, Fundry facts/infrastructure or later-phase feature.

### Migrations / Recovery
20261027170000_chat_voice_state.sql,20261027171000_chat_voice_commands.sql,20261027172000_chat_voice_context_reads.sql applied ONLY ownedLOCAL15437,101→104. Frozen3/3 hashes unchanged; exact hashes/checksums/dumps in CH8_LOCAL_UPGRADE.md. Native before restore143tables+exact SQL rehearsal and after restore144tables/ACL PASS; all143 existing table manifests preserved. No historical reapply/sharedSQL. PostgreSQL same-cluster proof only, not full host/storage/Clerk recovery.

### Automated / Native / Manual / Regression
Final npm run typecheck, npm run lint(0warnings), npm run build, npm run test:roles(including23ingresscases), npm run test:v2(four scripts), npm run test:chat254/2540skip PASS. Voice pure4/4, realHTTP1/1 and actualDB15/15 are subsets of Chat254, not extra totals. RealDB covers independent-client races, tenant/roles, audit rollback, budget voice+text hard ceiling/unknowncost, changed settings/quiet/newer/expired lease, exact evidence and voice-yes rejection. Native Rails/callback QA3/3 A WAV36/B Ogg12/unknownA37 PASS; clean warmed ownerA38/message275/leadb1f538b7-d4f6-4995-8ecb-7eb1d6e5dcf8 PASS, two actual SafeFetch duplicate callbacks accepted with one transcript/one draft/zero boterror activity/publicbotreplies/costentries. Initial cold dev callback warning retained historically, no timeout weakening; final owner fixture clean.
Retained real Clerk owner-a session; effective manager settingsdenied/transcriptallowed, viewer leads-only masked/separatePII read-only allowed, finance404; exact original membership/grants restored. Actual A→B→A, B copiedA404/own transcript, staleA settings refusal. Desktop/native and paired375CSSpx settings/transcript screenshots visually reviewed, no hydration mismatch after UTC fix. Browser cold timeouts/initial blank capture are failed attempts superseded by confirmed final states; no physical-device/independent persona credentials claim.
BoutiqueTierB retained order detail/edit(no save), production/tracking PASS; read-only9/9 persistence/safety assertions preserve total2000/paid300/balance1700/two workflows/history. Not a new full14/14 TierA run. Workbook Artifact-authored/recalculated/error-scan0/rendered/reviewed; only N2/N10/N15 note values/onepackagepart changed; all prior history/style/otherbytes preserved. SHA2563f7b7acdb070013340d70ce746b5530a96b24839bf2696ff59ea03ff6c0e4e91.

### Review / Owner / Spend / Next
No unresolved new P0/P1/P2; read-only Standards/Spec and targeted MIME/UTC rereviews clear. Final whitespace, untracked/file manifest, frozen SQL and416 snapshot source hashes reviewed/matching. docs_chat/CH8_QA.md, CH8_OWNER_ACCEPTANCE.md, CH8_BOUTIQUE_QA.md, CH8_LOCAL_UPGRADE.md, plan/WBS/decision/checklist/agent metadata updated. Owner original OS PLUS tab restored Local QA A/settings/chat; Chatwoot original tab opened A38 with one unsent suggestion. Native Take over/Edit/main composer verified; only our synthetic text cleared, no Send clicked. Temporary QA tabs and snapshot-only fixture cleaned.
LiveAI/liveSTT disabled/model IDs/keyunset; only supplied synthetic tones recognized. Feature model/API/transcription spendUSD0, no purchases/downloads/real external messages/tunnel/sharedSQL/push/merge/deploy/n8nactivation. Owner acceptance pending, real speech/provider privacy/cost/language accuracy/WhatsApp acceptance unexecuted/release-blocking. Earlier Meta/two-phone/realTelegram/judge/production domain/server/new n8n gates remain deferred; separate Shopify hostedOAuth/renewal/owner-deferred existingn8n unchanged.
Next: owner opens http://localhost:4141/app/accounts/901/conversations/38 and CH8_OWNER_ACCEPTANCE.md C8-L1–L7; report/accept local behavior and explicitly decide disposition of unexecuted live gates before closure/local commit. No new keys/server/Meta action required for these local tests.

```


## Local closure — 28 October 2026
CHAT-D058 supersedes earlier pending-owner/no-CH9 statements: owner accepts reported local results and defers live tests; READY_FOR_CLOSURE LOCAL, local commit authorized before CH9. No new runtime changes/tests claimed for this docs-only closure. Final logs, three frozen SQL hashes and workbook hash reverified unchanged; original final254/254/sixgates/TierB evidence above remains authoritative. No independent owner execution or live speech/WhatsApp/production readiness claimed. Final staged manifest/diff review and commit result recorded in root project_summary.md. LiveAI/STT disabled, feature spendUSD0.
