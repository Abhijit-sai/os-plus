# CH-8 voice notes — implementation plan
2026-10-27. Status PLANNED; no CH8 runtime/SQL implementation or application yet.
Destination D:/Develop/os-plus-chat-ch0, existing codex/chat-ch1-foundation/no upstream.
Base 445770b8d1e98784c287eb8a955fbe296d23a392, CH7 CLOSED LOCAL under CHAT-D055. Clean immediately after phase commit. Do not create another branch/worktree or touch Shopify/reference worktrees.

## Scope and accepted decisions
WBS05 CH8.1: voice → transcription → private Chatwoot transcript note → chat_messages.transcript → existing guarded turn. CH8.2 payment screenshot/vision/verification tasks excluded D023. No website voice bot, telephony, native inbox, campaigns, new messaging consent, operational automation or later CH9 onboarding.
- D056: transcript may support inquiry suggestions/provisional requests, never counts as typed customer confirmation or staff operational approval. Phone identity, payment truth, bookings and financial disclosure do not become verified from speech/transcription.
- D057: one voice attachment per message, at most120seconds and10MB (10,000,000 bytes); tenant configuration can lower these technical ceilings. Longer/unclear/unsupported/multiple recordings go to staff with the business's existing reviewed unreadable/handoff wording.
- User requires liveAI disabled. Mock-only local build; production transcribe model/provider/key unset and live gates false. No paid transcription, real-channel message, public tunnel or activation. Model selection/privacy/cost approval and real acoustic/language acceptance are later gates; not questions needed for local implementation.
- No unresolved owner policy decision after D056/D057. Conservative engineering details below follow accepted scope; do not label future code/tests as complete.

## Mandatory inspection and actual gaps versus02/03
Inspected root summary, startup/README/PRD/rules, architecture, full agent spec, CH8 WBS, accepted decision log/checklist, platform rules/phase gate/summary protocol, actual tenant/permission/Supabase/command boundaries. No business reference repository consultation needed.
1. chat_messages.transcript already exists in20261021110000_chat_capture.sql. Reuse it; do not add another transcript column or overwrite original content/created_at/provider identity.
2. payload.ts preserves only attachment id/file_type/data_url and strips other metadata. file_type=audio is not proof of MIME/duration/ownership. Re-read attachment facts from authorized account/conversation/message; inspect real retained4.18CE audio serialization before expanding the boundary. Unverified webhook URL is never a download instruction.
3. capture.ts schedules processCapturedAgent on agent events immediately after persisted capture. Current worker is loopback/mock-only; audio with null content currently reaches the ordinary text path. Voice preprocessing must happen under durable original trigger/run ownership before a text turn, not a second competing run or model call inside message capture.
4. chat_agent_load in20261022101000 returns only content, no transcript/provenance. rules.ts and context.ts strict message DTOs also omit transcript. Need explicit derived-input projection retaining original IDs/timestamps and transcript origin; no transcript/private-note re-ingest as a new customer message.
5. agent schemas and CH6 SQL validate signal/slot quotes against original content only (20261023091000_chat_agent_actions.sql plus chat_request_store/workflow and supplemental rules). Merely changing the prompt or coalescing content in one loader would disagree with database validation. Add a central scoped effective-evidence contract for permitted inquiry/provisional detail extraction; keep typed-only confirmation checks and fresh-summary/staff approval intact. Test transcribed “yes” refusal and that a later voice message invalidates a prior approval.
6. chat_agent_cost_entries and chat_agent_run callKey allow understand/classify/write/rewrite only. Transcription is not a free “capture” action or a write-model charge. Reuse the same tenant budget lock/accounting with an explicit transcribe stage and original run lease; preserve legacy costs and unsettled reservations, including summaries. Mock costs remain zero. Unknown real call ceiling/cost fails closed; do not wire a live call as part of this phase's local build.
7. ChatwootMessageClient only posts suggestions with a fixed suggestion marker. Add a distinct private transcript-note method/client with private=true, bounded safe text/provenance and exact receipt validation. Never reuse the suggestion marker/buttons for transcript text.
8. Leads read RPC masks content and excludes private notes; projectMessage and read-only mirror have no derived transcript field. Add server-masked transcript/provenance on the original message for permitted PII viewers, without signed media URLs, bot credentials, native audio download or reply box.
9. CH6 approved media helper is only requested outbound PNG/JPEG on owned loopback. Do not reuse that as an inbound audio downloader or loosen its approved origins. Need independent byte/type/duration/SSRF/credential-boundary checks.
10. No new global Chat permission is needed. Existing owner-only setup, manager/PII viewing and configurable viewer/finance grants remain; no shared permission-helper, tenant-context, customer/order/Laundry behavior changes.

## Proposed processing contract
1. Account webhook still captures bounded facts only;200/after() and workspace URL key/secret authority unchanged. Agent path routes only stored public customer audio; incoming private/staff/bot/system/edited/replayed data cannot manufacture a new job.
2. Before media fetch/transcription, assert current enabled tenant/module/workspace/brand/channel, mode and opt-in; current original trigger/latest-customer ordering and quiet fences. A new message or staff reply cancels pending work. Recheck before expensive work, private-note delivery and guarded turn. Closing detection runs once text is available; audio alone is not an empty acknowledgement.
3. Claim one tenant+source-message+attachment job and the original agent run capability transactionally. Separate transcription state and private-note delivery state. Concurrent account/agent webhooks/retries must not create repeat jobs, calls, transcript notes, turns, tasks or notifications. Audit all mutations; stable lock order and request hashes; altered retry rejected.
4. Resolve selected attachment from this workspace's account/message. Explicit origin/path capability allowlist, no arbitrary hosts, redirects or forwarding auth to storage/CDN. Production hostname/IP/redirect policy requires dedicated live adapter evidence later. Local HTTP only exact owned loopback allowlist and opt-in mock. Header/MIME alone insufficient: stream-count bytes, inspect container/codec, independently verify duration, bound decode memory/CPU/time; unknown/undecodable type/duration fails to handoff. Initial actual tested containers must include WhatsApp Ogg/Opus plus synthetic WAV; other formats accepted only after explicit parser/fixture coverage. Do not trust filename/duration fields or copy downloaded audio into permanent OS PLUS storage/logs.
5. Mock transcriber maps cryptographic hashes of known synthetic fixtures to explicit synthetic text. Unknown bytes never receive invented canned transcription. No real acoustic accuracy claim. Select languages from brand configuration; never inherit business language/workflows or translate into invented instructions. Empty/no-speech/low-confidence/overlong transcript is unreadable.
6. Atomically persist derived transcript+provenance/hash/result/audit and transcript-note intent. Original message unchanged. Transcript treated as untrusted customer-derived input, not a system instruction or verified fact. Job holds bounded metadata; do not store raw audio/base64/signed download credentials in events/DTOs.
7. Post one clearly labelled automatic transcript as a private Chatwoot note. Exact account/conversation/private/content receipt; no unsolicited public transcription. Ambiguous note receipt held, no blind retry; staff status exposes uncertainty. Require confirmed private note before continuing this local happy path; failures remain visible for staff/recovery.
8. Run existing guarded turn on derived input with original message ID/time and evidence provenance. D056 typed confirmation/staff approval enforced in SQL as well as code. No phone verification, payment confirmation or operational booking from speech. Draft mode/local mocks retained; no permission to enable auto/public/liveAI. Transcript note never counts as public reply/human response/quiet trigger and cannot expose new draft buttons.
9. Unsupported audio creates one deduplicated unreadable handoff/status using existing reviewed pack text and task routing. No model call just to decide that corrupt/unsupported audio is unreadable. Preserve mixed text conservatively: do not silently ignore an unsupported attachment or transcribe a caption as audio.
10. Owner settings default voice off; current local synthetic tenants explicitly opted in only after migration+test readiness. Dry-run follows existing no delivery/no durable operational mutation behavior; preview must not POST a note. Per-tenant lower byte/duration bounds cannot exceed D057 ceilings.

## Files planned (not added/runtime changed yet)
New modules:
- src/features/chat/voice/schemas.ts
- src/features/chat/voice/rules.ts
- src/features/chat/voice/transcriber.ts
- src/features/chat/voice/worker-core.ts
- src/features/chat/voice/worker.ts
- src/features/chat/voice/commands.ts
- src/features/chat/voice/server-actions.ts
- src/integrations/chatwoot/attachment-client.ts
- src/integrations/chatwoot/transcript-client.ts
- src/components/chat/voice-settings.tsx
Existing integration points:
- src/integrations/chatwoot/payload.ts
- src/features/chat/agent/worker.ts
- src/features/chat/agent/worker-core.ts
- src/features/chat/agent/context.ts
- src/features/chat/agent/rules.ts
- src/features/chat/agent/schemas.ts
- src/features/chat/agent/turn.ts
- src/features/leads/pii.ts
- src/app/(tenant)/leads/[leadId]/page.tsx
- src/app/(tenant)/settings/chat/page.tsx
- src/types/chat.ts (narrow RPC types only)
- .env.example (voice enable/live/mock/model flags; all live defaults off/unset)
Planned verification/helpers:
- scripts/test-chat-voice-rules.mjs
- scripts/test-chat-voice-clients.mjs
- scripts/test-chat-voice-runtime.mjs
- scripts/test-chat-agent-runtime.mjs and current capture/context/action test adapters only where the new boundary changes
- scripts/chat-local/mock-voice.mjs
- scripts/chat-local/upgrade-ch8.mjs
- scripts/chat-local/ch8-qa.mjs
- scripts/chatwoot-local/ch8-qa.mjs
- scripts/chat-local/manage.mjs (explicit mock-voice flag; existing flags unchanged)
- docs_chat/CH8_QA.md, CH8_OWNER_ACCEPTANCE.md, CH8_LOCAL_UPGRADE.md and CH8_BOUTIQUE_QA.md when evidence actually exists; update same root summary/checklist/decision log, current docs/agents metadata and workbook only for executed checks.

## Planned additive SQL (historical planning list; now frozen/applied owned local only)

Implementation update27October2026: all three below created and applied ONLY to owned local15437 after actual native restore/rehearsal; see CH8_LOCAL_UPGRADE.md. No shared/production SQL. The original plan is retained below; current status is IN_PROGRESS awaiting owner/live gates, superseding the planning-only outcome at the end.
- supabase/migrations/20261027170000_chat_voice_state.sql — tenant-owned job/receipt state, composite tenant FKs/RLS/ACL, lowerable per-tenant voice limits/default disabled; reuse transcript column. Stage extension only on Chat-owned cost ledger, preserving existing stage values.
- supabase/migrations/20261027171000_chat_voice_commands.sql — authorized audited atomic claim/result/note receipts and safe settings, original run-lease/cost integration, conservative typed-only confirmation/evidence gates. Preserve existing text-mode behavior and all public/uncertain delivery fences.
- supabase/migrations/20261027172000_chat_voice_context_reads.sql — scoped derived context/CRM read projection and exact action evidence adjustments, PII masking and accounting integration without changing notification source semantics.
Names reserve this plan only; actual implementation may require additional timestamped files with recorded rationale. Never rewrite frozen/applied CH1–7 migrations. Existing platform customer/order/payment/task tables untouched. Rehearse whole schema/disposable two tenants first; retained owned-local upgrade requires native pre/post dumps/restores and row/ACL comparisons. No shared DB authority.

## Verified increments and acceptance plan
1. One test/one implementation: known synthetic voice → scoped persisted transcript → one private note → one guarded synthetic draft. Start with deterministic WAV; then actual Ogg/Opus container tests and owned4.18CE payload evidence. No bulk imagined tests or live model.
2. Bounded hostile media: foreign tenant/workspace/account/message/attachment, arbitrary URL/internal metadata/private-IP/redirect, credential leakage, streamed oversize, forged duration/MIME/signatures, unsupported/multiple attachments, silence/corruption, malicious transcript, decode timeout. No download of arbitrary webhook URL.
3. Actual PostgreSQL races/replays/altered retries/lease expiry/audit rollback/revocation/new-message/staff-quiet, no-spend at hard cap/concurrent voice+text cost reservations/uncertain accounting. No Promise.all transaction substitute.
4. Exact private-note HTTP receipt/ambiguity/no-repeat; original message remains, private note excluded from customer context/metrics and draft controls. Typed vs transcribed confirmation; later voice invalidates stale approval; provisional request evidence provenance; staff approval still required.
5. Authenticated owner/manager/viewer/finance; PII denied/granted masked transcript, A→B→A and stale-tab save denial, desktop/375px read-only transcript and settings. Actual native local Chatwoot audio upload → account/agent route → mock transcript/private note → suggestion, both tenants; unknown real recording says unsupported, not “transcribed”.
6. Six gates: npm run typecheck, lint, build, test:roles, test:v2, test:chat. Focused Boutique TierB for adjacent setup/types/read projection; escalate TierA if shared customer/order/context/permission/generated types/navigation behavior touched. Record exact executed workbook notes; no inferred14PASS.
7. Final Standards/Spec review, migrations/diff, truthful local restore evidence, owner C8 local exercise. Real speech/language accuracy, selected paid provider cost/privacy/data handling and real WhatsApp acceptance stay disabled/unexecuted until separate explicit authorization. No CH8 closure exception has been granted; do not infer one from D055's CH7 exception.

## Planning outcome
D056/D057 resolved the only product choices raised. Local mock-only implementation is ready to begin in the next implementation session. CH8 remains PLANNED; this planning step creates no runtime behavior, migration, audio upload, model call or new service. LiveAI disabled/USD0; no push/deploy/sharedSQL/real messages/n8n activation. CH7 commit is local only; previously deferred release gates remain visible.
