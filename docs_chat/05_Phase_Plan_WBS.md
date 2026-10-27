# OS PLUS Chat & Leads — Phase Plan and WBS

Status legend: `[ ]` to do · `[~]` in progress · `[x]` done. Live status is recorded in `/project_summary.md` (V2-D025); tick boxes here only when a phase closes.

Each phase follows `/docs_v2/10_Phase_Gate_QA_and_Commit_Policy.md`: build → tests green → manual QA → summary updated → `READY_FOR_CLOSURE` → owner review → commit. A phase does not start until the previous one is closed, unless the dependency column says otherwise.

Owner actions that unblock phases are in `CHECKLIST.md`; the "Needs from owner" line names them.

| Phase | Name | Depends on | Needs from owner |
|---|---|---|---|
| CH-0 | Baseline, decisions, deploy kit | — | Answers to open decisions (06) |
| CH-1 | Foundation: module, settings, brands, channels, workspace | CH-0 | — |
| CH-2 | Chatwoot connector + message capture | CH-1 | Platform Chatwoot running (Checklist B) |
| CH-3 | Contacts, leads, customer link/convert | CH-2 | — |
| CH-4 | Lead pages, Chatwoot lead card, permissions/PII | CH-3 | — |
| CH-5 | Agent engine (draft mode) + knowledge pack + Try the bot | CH-2 (CH-3 for lead enrichment) | New platform OpenRouter key; new-business pack/model review |
| CH-6 | Agent actions: booking, handoff, statements, channel rules, auto mode | CH-5, CH-3 | — |
| CH-7 | Telegram alerts + daily summary | CH-6 | Telegram bot token |
| CH-8 | Voice notes (payment screenshots excluded) | CH-6 | — |
| CH-9 | Website chat channel | CH-6 | A test website |
| CH-10 | Bench, hardening, onboarding run, go-live | all | First client chosen |

---

## CH-0 — Baseline, decisions, deploy kit
- [x] CH-0.1 Read the full reading order; inspect git status, branch, open work (do not disturb other branches' uncommitted work).
- [x] CH-0.2 Run the existing suite (`typecheck`, `lint`, `build`, `test:roles`, `test:v2`) and record the baseline.
- [x] CH-0.3 Verify every reused table/column/constraint named in `02` §4.9 against the migrations; list differences.
- [x] CH-0.4 Present all open decisions in `06_Decision_Log.md` §Open together; record answers.
- [x] CH-0.5 Create `deploy/chatwoot/` for a dedicated platform box (compose with memory caps, `.env.example`, Caddyfile, backup script + cron, README with exact steps), implemented for a new isolated platform using only structural deployment/backup patterns. Include Chatwoot env for Meta (FB/Instagram app id/secret, WhatsApp embedded-signup ids if used) as placeholders.
- [x] CH-0.6 Write a clearly synthetic, unpublished `docs_chat/examples/new-business.pack.json` (03 §4) for owner review; no existing-business facts, wording or workflows.

**Acceptance:** baseline recorded; decisions answered; deploy kit reviewed by the owner.

## CH-1 — Foundation

2026-10-21: implementation/QA and owner acceptance complete (CHAT-D030; CH1_AUTHENTICATED_QA.md). CLOSED at local commit8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50; CH-2 CLOSED LOCAL under CHAT-D034; live Meta acceptance remains deferred/release-blocking. Current CH-4 evidence/owner gate: CH4_QA.md.
- [x] CH-1.1 Migration: `tenant_modules`, `chat_settings`, `chat_workspaces`, `chat_brands`, `chat_brand_locations`, `chat_knowledge_packs`, `chat_channels`, `chat_role_permissions`, `chat_staff_links`, `chat_notification_targets`, `chat_summary_runs` (02 §4.1–4.4, 4.8), RLS + indexes.
- [x] CH-1.2 Permissions `leads:view`, `leads:manage`, `leads:pii`, `chat_settings:manage`; module guard helper; tenant-owned viewer access/PII settings with audited owner/admin controls; extend `test:roles` without changing existing module permissions.
- [x] CH-1.3 Secrets helper (AES-256-GCM, key versioning) + tests.
- [x] CH-1.4 Super admin → Chat workspaces: enable module, link an existing Chatwoot account (base URL, account id, tokens) or create one via the Platform API; generate `workspace_key` + webhook secret; show the two webhook URLs once.
- [x] CH-1.5 Settings → Chat: brands CRUD, brand ↔ branch mapping, channels (sync inbox list from Chatwoot, map to brand/branch, mode default `draft`).
- [x] CH-1.6 Knowledge pack schema (Zod) + editor (JSON with validation is acceptable for v1, form later) + publish/version.

**Tests:** schema validation, secrets round-trip, role matrix, module guard, tenant isolation of settings.
**Acceptance:** a test tenant has a workspace, one brand, two branches, a published pack, and channels mapped — all invisible to a second tenant.

## CH-2 — Chatwoot connector + capture
Local phase CLOSED under CHAT-D034; runtime tasks below completed. Live Meta/channel fixtures and acceptance remain deferred production blockers, never PASS. See CH2_QA.md.
- [x] CH-2.1 `src/integrations/chatwoot`: client (hyphenated header, timeouts, label read-merge-write), payload parser (new parser fixtures covering both message-type encodings), Platform API helpers (account, user, agent bot, account webhook).
- [x] CH-2.2 Events webhook: resolution + assertions (02 §3), idempotent insert into `chat_conversations` / `chat_messages`, system greeting classification, quiet clock on staff reply, workspace `last_event_at`.
- [x] CH-2.3 Migration: `chat_conversations`, `chat_messages`, `chat_state`, `chat_turns`.
- [x] CH-2.4 Agent webhook skeleton: resolution, mode check, records a `chat_turns` row with outcome `silent` (engine arrives in CH-5).
- [x] CH-2.5 Onboarding helper: create agent bot + account webhook for a workspace; attach bot to inboxes whose mode ≠ off.
- [x] CH-2.6 Build a new mock Chatwoot for E2E from transport contracts; no production-business fixtures.

**Tests:** parser fixtures (real captured payloads: WhatsApp, Instagram, Facebook, website, staff, bot, template, greeting), wrong secret / wrong account / unknown inbox / other tenant's key → rejected, duplicate delivery → one row.
**Acceptance:** real messages to a test inbox appear in `chat_messages` under the right tenant within seconds.

## CH-3 — Contacts, leads, customer link/convert
CLOSED LOCAL under owner acceptance CHAT-D038, commit0d22491f14eb82f246d2d17f50b9c97c4269a0a0. CH3_OWNER_ACCEPTANCE.md and CH3_QA.md record passed local evidence; real-phone proof remains unexecuted/release-blocking. CH-4 is now IN_PROGRESS.
- [x] CH-3.1 Migration: `chat_contacts`, `chat_contact_identities`, `leads`, `lead_events`; `tasks` check extensions (02 §4.9).
- [x] CH-3.2 Pure rules (`src/features/leads/rules.ts`): channel from payload, ref codes, intent ranking (never downgrade), kind, stage machine, hot, SLA clocks, value estimate (repeat customer's median order value, else the pack's typical basket; service leads carry none). Write synthetic tests for the new business's approved rules; reference test structure only.
- [x] CH-3.3 Capture: identity resolution (E.164 on WhatsApp; platform ids otherwise), one open lead per conversation, clocks, first staff reply → owner via `chat_staff_links`.
- [x] CH-3.4 Commands: link contact ↔ customer (exact E.164), convert contact → customer (platform customer rules), merge/split contacts, change stage/owner/notes — each with domain events and `lead_events`.
- [x] CH-3.5 Stage advance from linked records (booking, order, payment/delivery) and lost-after-silence; guarded cron adapter and future CH4 page-view hook implemented; scheduler not activated.
- [x] CH-3.6 Ref-code review: a WhatsApp message quoting an Instagram/Facebook lead's ref records an exact candidate. Never automatically merge two existing contacts; guarded manual merge/split applies (non-negotiable and CH3_IMPLEMENTATION_PLAN reconciliation).

**Tests:** rules suite; two-tenant same-phone fixture; convert respects duplicate-phone rule; merge/split reversible and audited.
**Acceptance:** every captured conversation has a contact and a lead; a WhatsApp number matching an existing customer links automatically.

## CH-4 — Pages, lead card, permissions/PII
2026-10-22: local implementation/technical QA complete; full owner phase acceptance pending (CH4_OWNER_ACCEPTANCE.md C4-L1–L5). Checked tasks mean locally implemented/tested within CH4_QA.md limits, not production acceptance. CH4.2 remains partial pending explicit C4-L4 sequencing: stored draft text/knowledge version now, generation/richer provenance CH5 and booking CH6. Mobile evidence is authenticated375px frame/layout/control testing, not physical-device or independent screen-reader certification.
- [x] CH-4.1 Leads nav (module-gated): inbox with counters, filters (brand, branch, channel, stage, owner), SLA clocks, hot / needs-a-person flags.
- [x] CH-4.2 Lead detail: conversation mirror, unsent suggestion, "what it drew on" chips from `chat_turns`, stage/owner/notes, history, Open in Chatwoot, Convert to customer, Create booking.
- [x] CH-4.3 Contacts list + record (identities, prefs, leads, customer, orders, value; merge/split).
- [x] CH-4.4 Performance page + dashboard widget "N enquiries waiting for a reply".
- [x] CH-4.5 PII masking in server DTOs for roles without `leads:pii`.
- [x] CH-4.6 `/chat/panel` Dashboard App: origin-checked `fetch-info` handshake, session check in the iframe (02 §7), lead card with actions. Record the iframe session result.
- [x] CH-4.7 Mobile (375 px) and accessibility pass per `PRODUCT.md`.

**Acceptance:** owner/manager can work every lead end to end; viewer denied when disabled, sees permitted/masked data only when configured; panel works inside Chatwoot or falls back safely.

## CH-5 — Agent engine (draft mode)
2026-10-22: CLOSED LOCAL under owner acceptance/explicit exception CHAT-D044. Checked tasks mean implemented and tested in local mock scope. Live model IDs/key selection, paid-model smoke and realWhatsApp acceptance remain unexecuted and production-release blocking. See CH5_QA.md/CH5_OWNER_ACCEPTANCE.md. No CH6 implementation or external release.
- [x] CH-5.1 `src/integrations/openrouter`: JSON-mode calls, cost + timing capture, timeouts, model ids from env.
- [x] CH-5.2 Context loader (03 §2), tenant id mandatory on every query.
- [x] CH-5.3 Implement the new guarded pipeline: order, session, ledger, quiet, closing (before models), understand, classify, gates, write, check/repair, repeat and code-filled links — with fresh unit tests and the new brand's approved language/script/workflow configuration.
- [x] CH-5.4 Delivery as private-note drafts; `osplus-reply.js` buttons + markup harness tests.
- [x] CH-5.5 Budget guard; `CHAT_DRY_RUN`.
- [x] CH-5.6 Settings → Try the bot (sandbox, `mode = 'sandbox'`, no Chatwoot, no writes beyond the turn log).
- [x] CH-5.7 Lead enrichment from the understanding.

**Tests:** gates/checks/context suites; E2E with stubbed model; cheap-model smoke on the synthetic new-business pack (state cost first).
**Acceptance:** a real WhatsApp message gets a correct draft with buttons in Chatwoot; the turn is logged with cost and timings.

## CH-6 — Actions and auto mode
2026-10-27: CLOSED LOCAL underD025/D050. Required engineering checks complete: six gates209/209, authenticated effective roles/tenant/desktop375CSSpx frames, fresh Boutique14/14 plus persistence7/7, native Chatwoot6/6, owned-local upgrade/restores and five-sample mock latency. Final focused UI review clear after approval-reset regression fix. Owner/live acceptance deferred under D050, statements deferredD047; neither is claimed executed. Final records/diff reviewed; authorized local phase commit records this closure before CH7. See CH6_QA.md, CH6_BOUTIQUE_QA.md and CH6_LOCAL_UPGRADE.md. LiveAI off/local mocks only.
- [x] CH-6.1 Capability registry; `laundry_pickup` (via the existing pickup request command) and `follow_up_task`; booking saved at first ask, updated, confirmed, cancelled; no duplicate within 1 h.
- [x] CH-6.2 Handoff → `CHAT_HANDOFF` task (assigned to the branch team) + Chatwoot label + alert hook.
- [ ] CH-6.3 DEFERRED under CHAT-D047 (not implemented/PASS). Original — Statement link: OS PLUS customer-safe statement/tracking page via a signed token, exact phone match only, `can_share_statement` channels only; amounts in the reply only from this lookup.
- [x] CH-6.4 Locked sentences, vendor rule, review ask, price-list image once per chat after the text.
- [x] CH-6.5 Channel rules: IG/FB → WhatsApp link with ref; nearest branch with one map link.
- [x] CH-6.6 Auto mode per channel (public message delivery); confirm the owner's sign-off per channel is recorded in settings.
- [x] CH-6.7 Latency: measure customer-message → reply from `chat_messages`; target ≤ 6 s median; skip models on closing; trim prompt size.

**Accepted acceptance (CHAT-D045–D049):** first ask creates a provisional chat request. Current complete customer-confirmed details plus explicit staff approval materialize an operational pickup or callback task atomically; callback tasks do not reserve appointments or independently mark a lead booked. Pending edits/withdrawals are versioned; operational changes become handoffs. D047 defers statements. Verify other CH6.2/6.4–6.7 gates and the safety set before closure. This supersedes the original first-ask operational-booking wording.

## CH-7 — Telegram + daily summary
- [x] CH-7.1 Platform bot client, webhook with secret header, `/start <code>` linking, target management UI.
- [x] CH-7.2 Instant alerts per target and event; platform failure alerts.
- [x] CH-7.3 New inquiry-focused daily summary builder (structural reference only: chats, messages, replies, real reply time, handoffs by reason, bookings, payment claims, tasks, new leads, won value, errors, cost, judge rating with the worst chat linked) — per tenant, per brand section when > 1 brand.
- [x] CH-7.4 `/api/chat/cron/hourly` (Bearer secret) + inactive n8n workflow export for the new platform instance; idempotent per tenant per local date.
- [x] CH-7.5 Preview script that prints a summary without sending.

**Acceptance:** two test tenants with different summary times each receive exactly one correct summary.

## CH-8 — Voice notes (payment screenshots excluded)
- [x] CH-8.1 Voice: transcribe → private note → `chat_messages.transcript` → turn. Accepted LOCAL mock scope under CHAT-D058; live speech/WhatsApp gates deferred.
- CH-8.2 excluded by owner (2026-10-07): no payment screenshot extraction, verification task or vision flow.

## CH-9 — Website chat
- [ ] CH-9.1 Website channel support in parser, capture and agent (visitor identity `web_visitor`; phone from pre-chat form → E.164 identity, verified = false until WhatsApp confirms).
- [ ] CH-9.2 Settings → Widget: snippet for the brand's Chatwoot website inbox, pre-chat form guidance.
- [ ] CH-9.3 Website rules: information always; booking only with a phone; otherwise WhatsApp link.

## CH-10 — Bench, hardening, go-live
- [ ] CH-10.1 Build a new conversation bench and judge rubric with synthetic/new-business-approved fixtures; run cheap-model tests across two distinct test brands; report.
- [ ] CH-10.2 Cross-tenant leakage suite (webhooks, context, pages, panel, summaries).
- [ ] CH-10.3 Failure drills: Chatwoot down, OpenRouter down, Supabase slow, Telegram down — the customer gets nothing wrong; staff get an alert.
- [ ] CH-10.4 Run `CHECKLIST.md` Part D end to end for a second test tenant without code changes; fix the runbook where it is wrong.
- [ ] CH-10.5 Go-live for the first client in draft mode; auto mode per channel after drafts-sent-unchanged ≥ 70 % for a week.
- CH-10.6 removed from scope by owner (2026-10-06): no Fundry cutover, migration, account changes, data transfer or service changes.


### CH-4 accepted local scope —2026-10-22
CHAT-D039 supersedes the earlier pending-owner note. C4-L1–L5 accepted; CH4 READY_FOR_CLOSURE LOCAL. CH4.2 checked for accepted implemented scope: mirror/stored draft text/knowledge version/audited edits/native customer links. Richer generated provenance is CH5, Create booking CH6; original requirement wording retained for traceability, not a claim these dependencies are built. Meta/two-phone remains deferred/release-blocking. Final local commit before CH5 planning.


CH4 post-commit record,2026-10-22: CLOSED LOCAL atf9d195c02388bdcf17c8fb25a294dac32bbe9fe3 under CHAT-D039. Supersedes earlier pending/READY wording; no production release. CH5 planning is recorded separately in CH5_IMPLEMENTATION_PLAN.md; no agent implementation yet.


### CH-5 local mock implementation checkpoint —2026-10-22
CH5.1–5.7 localmockimplementation/tests complete and local phase checkboxes accepted under CHAT-D044; Currentevidence CH5_QA.md (168/168,sixgates,4frozenLOCALSQL/prepostrestore,actualprovider/browsercontrols/provenance/privacy and automatic local mock fresh-chat checks); CH5_BOUTIQUE_QA.md14/14; ownersteps CH5_OWNER_ACCEPTANCE.md. Live modelID/keyselection/paid smoke and original realWhatsApp acceptance remainunexecuted and notwaived by D040–D042. CH5 CLOSED LOCAL under explicit D044 acceptance/deferral; local phase commit authorised. No CH6 implementation/push/deployment.


### CH-7 engineering checkpoint — 2026-10-27
CH7.1–7.5 implemented/tested locally under D053/D054, but phase boxes remain unchecked pending CH7 owner acceptance and explicit live-gate decision. CH7_QA.md records six gates/Chat234/234,15 actualDB, two distinct tenant summary times each one confirmed loopback mock delivery, authenticated role/tenant/375CSSpx and focused BoutiqueTierB. Frozen five local-only SQL/native restores: CH7_LOCAL_UPGRADE.md. Owner steps CH7_OWNER_ACCEPTANCE.md C7-L1–L7. LiveAI/judge/realTelegram disabled/untested; inactive n8n source export is not runtime acceptance. D050 waived CH6 gates only. No CH7 closure/commit/CH8 or deployment implied.


### CH-7 accepted local scope — 2026-10-27
CHAT-D055 supersedes the pending-owner checkpoint above. Owner accepts local CH7 results/D053–D054 and authorizes local phase commit, then CH8 planning. CH7.1–7.5 boxes indicate accepted LOCAL implementation only. Original judge/worst-chat and real Telegram acceptance remain explicitly deferred/unexecuted/release-blocking; unrated is not a judge PASS. No n8n runtime/activation or production release authority. Six gates/234Chat/15DB/TierB/native restores documented in CH7_QA.md. Commit result recorded in project_summary.md.


CH7 post-commit record2026-10-27: CLOSED LOCAL445770b8d1e98784c287eb8a955fbe296d23a392 underD055, clean immediately afterward. CH8 PLANNED; CH8_IMPLEMENTATION_PLAN.md records acceptedD056 typed-confirmation/staff-approval andD057 single120s/10MB voice limits. CH8 boxes remain unchecked; no voice runtime/SQL/test implemented or applied yet. LiveAI disabled; realTelegram/judge/Meta gates remain unexecuted/release-blocking.

## CH8 local implementation checkpoint — 2026-10-27
Supersedes CH8 PLANNED/no-runtime statements above. CH8 IN_PROGRESS, engineering local scope implemented and sixgates PASS: Chat254/254, voiceDB15/15, HTTP/pure, actual native provider3/3, role/tenant/stale-form/375px AX checks and BoutiqueTierB/native restores. See CH8_QA.md, CH8_LOCAL_UPGRADE.md, CH8_BOUTIQUE_QA.md and owner C8-L1–L7. CH8.1 remains unchecked pending owner acceptance and explicit live speech/WhatsApp gate decision. Synthetic tones/hash-only local transcriber are not speech-accuracy certification. LiveAI/STT disabled, USD0; no CH8 commit, CH9, external release or sharedSQL.


### CH8 accepted local scope — 28 October 2026
CHAT-D058 supersedes the pending-owner checkpoint. CH8.1 checked for accepted hash-only synthetic LOCAL implementation and254/254/sixgates/TierB/native restore evidence; real speech/WhatsApp gates remain deferred/unexecuted/release-blocking. Local phase commit authorized, then CH9 website chat plus owner-requested Chat settings UX simplification. Domain/server/Meta later, liveAI/STT disabled. Commit result in root summary.
