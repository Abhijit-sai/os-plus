# CH-6 Actions and auto mode — implementation plan

Status: IN_PROGRESS, 2026-10-22 after approvals CHAT-D045–D049. Pure policy tests first. Planning alternatives below retained as history.
Worktree D:/Develop/os-plus-chat-ch0; existing codex/chat-ch1-foundation/no upstream.
Base a09561d1ecce48acdd4e3a4df18ec368773ed953 (CH5 CLOSED LOCAL under CHAT-D044).

## Accepted boundaries
Keep CHAT_MODEL_LIVE_ENABLED=false and production model IDs/provider key unset. Existing explicitly enabled local mock/private suggestions may continue under D043; this session does not enable automatic public delivery or business actions.
D044 defers paid/live and realWhatsApp acceptance for LOCAL CH5 closure only; missing real-channel/model evidence remains release-blocking, not automatically waived for CH6.
Existing tenant, role/PII, exact identity/no-auto-merge, stage D035, hard budget D041, owner local commit D025, Chatwoot-only staff inbox, separate Telegram CH7 and media CH8 rules persist. No Fundry facts/workflows/code/services adopted.
No changes to protected Boutique/Laundry behavior, shared production data, public tunnel, provider settings, paid calls, shared migrations, push/merge/deploy or n8n activation.

## Scope from WBS CH6.1–CH6.7
1. Tenant capability registry: laundry_pickup only when vertical/capability enabled; follow_up_task for other businesses. Booking request draft/upsert, confirmation/cancellation and one-hour duplicate fencing.
2. Audited CHAT_HANDOFF/LEAD_FOLLOW_UP tasks, safe routing and Chatwoot merged labels; notification intent only, actual Telegram delivery CH7.
3. Statement/tracking capability with exact verified identity and customer-safe token page, conditional on P6-3 below.
4. Locked replies, vendor quiet, approved price-list image once after the text and review policy, conditional on P6-5.
5. Channel gates, code-written WhatsApp/ref/map links, nearest approved branch; unresolved location asks a question, never guesses. Do not fetch arbitrary shortened URLs or bypass unverified identity.
6. Per-channel owner approval for auto mode and independently guarded public delivery. Test with owned local synthetic mocks only; production flags remain disabled. No automatic promotion from a report metric.
7. Actual customer-message-to-delivery timestamps, including transport; benchmark local mocks separately from untested live latency. Target median6s is a measurement goal, not inherited evidence.

## Verified code contradictions / gaps
- Architecture assumes a ready capability registry; none exists. src/features/chat/commands.ts publishes packs with capabilities:[], so any configured booking capability currently fails publication.
- Laundry create_laundry_pickup_request_command requires an active customer, requested_date and nonblank requested_window. An incomplete first ask cannot be inserted honestly. The current contract atomically creates a pickup plus task; never also create a duplicate generic task.
- Existing Laundry custody actions expose create/complete, not the proposed upsert/confirm/cancel lifecycle. Preserve existing commands; use chat-owned drafts and materialize through the existing create command only when valid. Post-materialization changes require the approved P6-2 boundary.
- src/features/tasks/{actions,queries}.ts and /tasks require Laundry. Boutique/chat-only users cannot work new handoffs there. Add a chat-scoped task surface/adapters within Leads rather than weakening the existing Laundry guard.
- Task type/subject constraint extensions already exist in 20261021124000; do not repeat historical migrations or alter task schema unnecessarily.
- CH5 choosePlan hands booking/financial/confirm/cancel to a person. Its ledger/schema permits inquiry state only, and observation slots only area/preference/time. New strict versioned action/evidence state is needed; preserve old ledger compatibility.
- CH5 output checks intentionally reject booking/payment promises and accept a bounded fact-ref set. Extend only with code-issued action receipts and allowlisted placeholders; model text is never a booking or payment receipt.
- Existing local worker uses a fixed information mock, not action understanding. CH6 tests need explicit synthetic booking/confirmation/cancellation/handoff scenarios; arbitrary visitor text must not be claimed as live AI acceptance.
- CH3 refresh treats a follow-up task as active work, not confirmation. Do not mark booked from task existence or a model flag; retain D035 actual linked-record rules.
- There is order public tracking, but no customer statement/token service. Existing tracking is not a financial statement. Current retained schema has order_payments; do not invent a complete Laundry invoice/allocation ledger.
- Shopify order/customer retained facts are the boundary. Existing local_operational_orders/read helpers and retained payment availability matter; raw payloads expire, imports give no consent, drafts/production completion/delivery differ. No receipt or review trigger from a historical import.
- Actor/source values are uppercase platform enums; critical action/link/customer/task changes need one server transaction, correlation and retry identity. Remote sends/labels follow committed outbox state, not Promise.all transactions.
- Specification review rule asks for positive feedback before a link. For Google this conflicts with its current prohibition of selectively soliciting positive reviews. P6-5 proposes neutral eligibility. Primary source checked2026-10-22: https://support.google.com/contributionpolicy/answer/7400114?hl=en (Rating Manipulation).
- CH5 closure did not enable live AI, public auto replies, verified real Meta channel evidence or SSO. Those are not inferred from the auto-mode schema enum.

## Resolved decisions — recommendations accepted under D045–D049; alternatives are history

### P6-1 — What draft mode may do
Recommend: save a provisional CHAT request as soon as a booking/callback is asked for, keep it updated with quoted evidence, and show an owner/manager approval action. In draft mode no operational booking/customer creation/financial-link issuance before staff approval. Automatic internal handoff tasks are the explicit exception: a safety flag must create one useful work item, not merely a sentence. Sending a suggested sentence alone does not secretly approve a business action.
Alternative: let eligible booking/customer commands execute immediately even while the reply remains a draft. This needs explicit owner approval and clearer action receipts.
Auto mode infrastructure remains off by default; future per-channel owner approval is mandatory, and only synthetic local public-auto tests are planned while live AI remains disabled.

### P6-2 — Booking/callback meaning and required details
Recommend both planned capabilities, explicitly gated and tested with synthetic data.
- Non-Laundry: request/service + preferred contact time (optional if unknown) becomes LEAD_FOLLOW_UP. It acknowledges a callback/request, never promises a reserved appointment. Contact can remain a lead; no fabricated customer or dates.
- Laundry: chat draft at first ask; require name, verified phone, configured service(s), customer-confirmed pickup address, explicit date and one configured time window before staff approval materializes the existing pickup command. Reconfirm saved address rather than overwriting it. Service areas/windows come from the business pack.
- Customer yes is evidence of acceptance of the reviewed request; actual booked stage requires the authoritative confirmed record under D035. Task creation alone is not booked.
- Edit/cancel chat-owned pending drafts idempotently. Once a real pickup/booking is operational, request changes/cancellation through a human handoff rather than changing protected Laundry operations or claiming cancellation succeeded.
- Deduplicate by tenant/brand/exact contact/area/services for1h, preserve exact request replay and do not suppress explicitly different requests. Staff can resolve a documented collision.
Alternative: require full automatic appointment scheduling/rescheduling/cancellation. No capacity/availability calendar currently exists; that would need an explicit additional product contract, not a hidden implementation assumption.

### P6-3 — Financial statements this phase
Recommend DEFER statement issuance for the inquiry-first release; dues requests use the locked handoff. This is an explicit proposed CH6.3 scope exception, not an automatic reduction.
If included now: link-only chat text, no amounts; new customer-safe page; owner/admin issuance initially (managers hand off); verified WhatsApp identity + exact active tenant-customer phone match + can_share_statement; signed opaque revocable24h token; no PII/model-generated token; minimum customer-safe retained facts only. Missing/ambiguous/unsupported source balances return unavailable, never zero or a misleading partial total. No payment posting. This alternative is a new surface with its own permission/token/financial-truth QA.

### P6-4 — Handoff routing and duplicates
Recommend mapped active Chatwoot assignee first, then eligible lead owner, then configured branch team, else a clearly visible unassigned queue in Leads. Chatwoot routing remains configurable and team membership never grants permission. One active task per lead/work-kind, add new reasons/evidence instead of spamming duplicates; a new request after completion may create a new task. Expose safe assign/complete actions to owner/admin/manager, not viewer/finance by default. No shared role changes.
Alternative: start all handoffs unassigned for manual triage.

### P6-5 — Price image and review behavior
Recommend price-list image only when the customer asks for prices/list, once per conversation after the text, from the approved brand asset; private preview in draft mode, no unsolicited image.
Review requests remain tenant-opt-in and conversation-only: an actually delivered linked order, no historical-import trigger, configurable90day cooldown, neutral wording with no positive-feedback-only selection and no incentive. A complaint routes to a person; sentiment must not decide who may leave a review. Never ask merely because production completed, a draft was imported, or payment was recorded. No campaigns or outbound scheduler. Provider-specific review rules must be checked before enabling its configured link.
Alternative: defer price-image/review automation and keep both off in this phase.

## Proposed files (after answers)
- src/features/chat/capabilities/{registry,follow-up,laundry-pickup}.ts; src/features/chat/actions/{schemas,plan,rules,commands,outbox,routing}.ts.
- Extend agent/{schemas,context,ledger,plan,checks,turn,worker-core,worker,mock-model}.ts for approved action receipts/versioned state, never arbitrary SQL/model authority.
- Extend knowledge-pack.ts, commands.ts, setup schemas/queries/components for capabilities/routing/approval and backward-compatible pack fields.
- src/features/leads/{actions,commands,queries,schemas}.ts and lead detail/Chatwoot panel for pending request review, Create booking, safe action/task status; public/chatwoot/osplus-reply.js only where an explicit approved action UI requires it. Preserve native main composer.
- src/features/chat/{task-actions,task-queries}.ts and components/leads/task-actions.tsx for chat task work without changing existing /tasks Laundry behavior.
- src/integrations/chatwoot/{message-client,admin-client}.ts for guarded local auto/public/media/merged-label delivery; outbound uncertainty and per-message idempotency.
- If P6-3 included: src/features/chat/statements/{tokens,queries,commands}.ts; src/app/(public)/chat/statement/[token]/page.tsx and narrow src/proxy.ts allowlist; never alter existing /track behavior or bypass Clerk elsewhere.
- src/types/chat.ts; use existing narrow Database intersection rather than rewriting broad shared types/permissions.
- scripts/test-chat-actions-{rules,runtime,delivery}.mjs, test-chat-capabilities.mjs, conditional statement tests, actual local Chatwoot helper and synthetic fixtures; CH6_QA.md/CH6_OWNER_ACCEPTANCE.md during implementation.

## Proposed additive migrations — names reserved only at implementation
- YYYYMMDDHHMMSS_chat_action_state.sql: tenant-owned request/action/outbox/routing/approval records; conditional statement grants/review cooldown data. Composite tenant FKs/RLS/default-deny browser/service access.
- YYYYMMDDHHMMSS_chat_action_commands.sql: service-only authenticated/tenant-checked atomic proposal/approve/execute/cancel/task/link/receipt commands and narrowly scoped additive chat read/refresh replacements.
- YYYYMMDDHHMMSS_chat_action_delivery.sql: per-channel approval/current-pack fencing, uncertain sends/media/label outbox claims and receipt reconciliation.
No SQL file created/applied now. Prior83 source migrations and four applied CH5 bytes stay frozen. No existing Boutique/Laundry table DDL planned.

## Verified implementation sequence after answers
1. Pure approved policy/evidence/booking-state/channel/link/routing tests, versioned-ledger compatibility; engine remains disabled for paid/live execution.
2. Disposable PostgreSQL actual migrations, two-tenant ownership, concurrency/idempotency/rollback, task/customer/booking atomicity, revocation/current-pack fences; no service side effects.
3. Commands/adapters and guarded approval UI, customer-safe receipts; ensure callback request never impersonates a calendar reservation.
4. Committed outbox delivery against mock Chatwoot; duplicate/timeout/unknown receipt/partial media/label merge recovery, public delivery enabled only for owned local mock QA.
5. Actual isolated local Chatwoot synthetic draft/approve/auto-mode scenarios, native controls and visitor privacy; roles, copied URLs/foreign IDs,375px/desktop, timings.
6. All six gates typecheck/lint/build/test:roles/test:v2/test:chat, fresh BoutiqueTierA when customer/public-token/shared-query/type/navigation boundaries change, local persistent upgrade pre/post manifests and real restore; two-axis review.
7. Record exact evidence and owner acceptance. CH6 closure/full real-booking/model/channel gates are not automatically waived by CH5's D044; obtain any new scoped exception explicitly. No push/deploy.

## Planning outcome
No implementation, new SQL, service flag or test-tenant data change this session. Prior CH5 gates168/168 and prior local integration/regression evidence are baseline only, not CH6 PASS.
Next: obtain P6-1–P6-5 answers together, reconcile03/05 wording to accepted decisions, record CH6 IN_PROGRESS in the same root summary, then start the first pure-rule slice. No paid model/key/Meta/server/domain action required for planning or synthetic local implementation.

## Implementation checkpoint — 2026-10-22 (supersedes planning-only outcome above)

D045–D049 accepted; CH6 IN_PROGRESS. First policy/provisional-storage/handoff/publication slice implemented, targeted rules5/5 and real PostgreSQL10/10 PASS; exact files, five new SQL files and remaining gaps: CH6_QA.md and root summary checkpoint. All88 source migrations replay only in owned disposable databases; retained LOCAL15437 remains prior83. No operational request approval/materialization, action UI/worker/public-auto/media delivery or owner acceptance yet.
No product question reopened. Next confirmed-summary/customer evidence and atomic staff approval/callback materialization; existing Laundry command adapter after complete verified details. Full latest gate outcomes appended to CH6_QA.md after runs complete. LiveAI off/USD0.

## 2026-10-24 current checkpoint — supersedes earlier planning/partial notes
Runtime scope locally implemented and reviewed; see CH6_QA.md and D050–D052. Thirteen SQL applied only owned LOCAL15437 with pre/post native restores (CH6_LOCAL_UPGRADE.md). Six gates pass, Chat209/209/0skip, native provider6/6 and five public mock timings median1823.933ms. Current source local app opt-in mock actions; both test channels restored draft, liveAIoff/USD0.
Phase QA_BLOCKED because authenticated OS PLUS desktop375px/role/tenant and fresh complete BoutiqueTierA browser evidence cannot be obtained from the stale policy-blocked error tab. No bypass/alternate browser route. Owner C6-L0 needs only manually reopening the local OS PLUS tab; existing Clerk script HTTPHEAD200, no new keys required. Owner/live acceptance remains explicitly deferred under D050. No local phase commit or CH7 transition until remaining engineering checks and QA workbook reconciliation. Historical CH5 workbook/Boutique PASS is not CH6 evidence. Current workbook intentionally unchanged until fresh execution can be recorded accurately.

## 2026-10-27 latest engineering status
Historical QA_BLOCKED checkpoint superseded: owner reopened app, required authenticated effective roles/tenant/375CSSpx frame and fresh Boutique14/14+persistence7/7 completed; final six gatesPASS Chat209/209, frozen13localSQL, native6/6 and actualrestore evidence. Final UI reviewerP1 reproduced/fixed: settings/pack version remount resets consent/edit snapshot while stable parent retains confirmed feedback. Review axesclear. READY_FOR_CLOSURE LOCAL underD025/D050 pending final docs/diff/localcommit; CH7 has not started. Exact evidence CH6_QA.md and CH6_BOUTIQUE_QA.md. Owner/live gates and statements remain explicit deferrals. LiveAIoff/USD0.
