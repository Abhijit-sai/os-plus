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

2026-10-21: implementation/QA and owner acceptance complete (CHAT-D030; CH1_AUTHENTICATED_QA.md). CLOSED at local commit8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50; CH-2 is QA_BLOCKED pending the remaining acceptance evidence; see CH2_QA.md.
- [x] CH-1.1 Migration: `tenant_modules`, `chat_settings`, `chat_workspaces`, `chat_brands`, `chat_brand_locations`, `chat_knowledge_packs`, `chat_channels`, `chat_role_permissions`, `chat_staff_links`, `chat_notification_targets`, `chat_summary_runs` (02 §4.1–4.4, 4.8), RLS + indexes.
- [x] CH-1.2 Permissions `leads:view`, `leads:manage`, `leads:pii`, `chat_settings:manage`; module guard helper; tenant-owned viewer access/PII settings with audited owner/admin controls; extend `test:roles` without changing existing module permissions.
- [x] CH-1.3 Secrets helper (AES-256-GCM, key versioning) + tests.
- [x] CH-1.4 Super admin → Chat workspaces: enable module, link an existing Chatwoot account (base URL, account id, tokens) or create one via the Platform API; generate `workspace_key` + webhook secret; show the two webhook URLs once.
- [x] CH-1.5 Settings → Chat: brands CRUD, brand ↔ branch mapping, channels (sync inbox list from Chatwoot, map to brand/branch, mode default `draft`).
- [x] CH-1.6 Knowledge pack schema (Zod) + editor (JSON with validation is acceptable for v1, form later) + publish/version.

**Tests:** schema validation, secrets round-trip, role matrix, module guard, tenant isolation of settings.
**Acceptance:** a test tenant has a workspace, one brand, two branches, a published pack, and channels mapped — all invisible to a second tenant.

## CH-2 — Chatwoot connector + capture
- [ ] CH-2.1 `src/integrations/chatwoot`: client (hyphenated header, timeouts, label read-merge-write), payload parser (new parser fixtures covering both message-type encodings), Platform API helpers (account, user, agent bot, account webhook).
- [ ] CH-2.2 Events webhook: resolution + assertions (02 §3), idempotent insert into `chat_conversations` / `chat_messages`, system greeting classification, quiet clock on staff reply, workspace `last_event_at`.
- [ ] CH-2.3 Migration: `chat_conversations`, `chat_messages`, `chat_state`, `chat_turns`.
- [ ] CH-2.4 Agent webhook skeleton: resolution, mode check, records a `chat_turns` row with outcome `silent` (engine arrives in CH-5).
- [ ] CH-2.5 Onboarding helper: create agent bot + account webhook for a workspace; attach bot to inboxes whose mode ≠ off.
- [ ] CH-2.6 Build a new mock Chatwoot for E2E from transport contracts; no production-business fixtures.

**Tests:** parser fixtures (real captured payloads: WhatsApp, Instagram, Facebook, website, staff, bot, template, greeting), wrong secret / wrong account / unknown inbox / other tenant's key → rejected, duplicate delivery → one row.
**Acceptance:** real messages to a test inbox appear in `chat_messages` under the right tenant within seconds.

## CH-3 — Contacts, leads, customer link/convert
- [ ] CH-3.1 Migration: `chat_contacts`, `chat_contact_identities`, `leads`, `lead_events`; `tasks` check extensions (02 §4.9).
- [ ] CH-3.2 Pure rules (`src/features/leads/rules.ts`): channel from payload, ref codes, intent ranking (never downgrade), kind, stage machine, hot, SLA clocks, value estimate (repeat customer's median order value, else the pack's typical basket; service leads carry none). Write synthetic tests for the new business's approved rules; reference test structure only.
- [ ] CH-3.3 Capture: identity resolution (E.164 on WhatsApp; platform ids otherwise), one open lead per conversation, clocks, first staff reply → owner via `chat_staff_links`.
- [ ] CH-3.4 Commands: link contact ↔ customer (exact E.164), convert contact → customer (platform customer rules), merge/split contacts, change stage/owner/notes — each with domain events and `lead_events`.
- [ ] CH-3.5 Stage advance from linked records (booking, order, payment/delivery) and lost-after-silence; runs from cron and on lead page view.
- [ ] CH-3.6 Ref-code merge: a WhatsApp message quoting an Instagram/Facebook lead's ref links the identities to one contact.

**Tests:** rules suite; two-tenant same-phone fixture; convert respects duplicate-phone rule; merge/split reversible and audited.
**Acceptance:** every captured conversation has a contact and a lead; a WhatsApp number matching an existing customer links automatically.

## CH-4 — Pages, lead card, permissions/PII
- [ ] CH-4.1 Leads nav (module-gated): inbox with counters, filters (brand, branch, channel, stage, owner), SLA clocks, hot / needs-a-person flags.
- [ ] CH-4.2 Lead detail: conversation mirror, unsent suggestion, "what it drew on" chips from `chat_turns`, stage/owner/notes, history, Open in Chatwoot, Convert to customer, Create booking.
- [ ] CH-4.3 Contacts list + record (identities, prefs, leads, customer, orders, value; merge/split).
- [ ] CH-4.4 Performance page + dashboard widget "N enquiries waiting for a reply".
- [ ] CH-4.5 PII masking in server DTOs for roles without `leads:pii`.
- [ ] CH-4.6 `/chat/panel` Dashboard App: origin-checked `fetch-info` handshake, session check in the iframe (02 §7), lead card with actions. Record the iframe session result.
- [ ] CH-4.7 Mobile (375 px) and accessibility pass per `PRODUCT.md`.

**Acceptance:** owner/manager can work every lead end to end; viewer denied when disabled, sees permitted/masked data only when configured; panel works inside Chatwoot or falls back safely.

## CH-5 — Agent engine (draft mode)
- [ ] CH-5.1 `src/integrations/openrouter`: JSON-mode calls, cost + timing capture, timeouts, model ids from env.
- [ ] CH-5.2 Context loader (03 §2), tenant id mandatory on every query.
- [ ] CH-5.3 Implement the new guarded pipeline: order, session, ledger, quiet, closing (before models), understand, classify, gates, write, check/repair, repeat and code-filled links — with fresh unit tests and the new brand's approved language/script/workflow configuration.
- [ ] CH-5.4 Delivery as private-note drafts; `osplus-reply.js` buttons + markup harness tests.
- [ ] CH-5.5 Budget guard; `CHAT_DRY_RUN`.
- [ ] CH-5.6 Settings → Try the bot (sandbox, `mode = 'sandbox'`, no Chatwoot, no writes beyond the turn log).
- [ ] CH-5.7 Lead enrichment from the understanding.

**Tests:** gates/checks/context suites; E2E with stubbed model; cheap-model smoke on the synthetic new-business pack (state cost first).
**Acceptance:** a real WhatsApp message gets a correct draft with buttons in Chatwoot; the turn is logged with cost and timings.

## CH-6 — Actions and auto mode
- [ ] CH-6.1 Capability registry; `laundry_pickup` (via the existing pickup request command) and `follow_up_task`; booking saved at first ask, updated, confirmed, cancelled; no duplicate within 1 h.
- [ ] CH-6.2 Handoff → `CHAT_HANDOFF` task (assigned to the branch team) + Chatwoot label + alert hook.
- [ ] CH-6.3 Statement link: OS PLUS customer-safe statement/tracking page via a signed token, exact phone match only, `can_share_statement` channels only; amounts in the reply only from this lookup.
- [ ] CH-6.4 Locked sentences, vendor rule, review ask, price-list image once per chat after the text.
- [ ] CH-6.5 Channel rules: IG/FB → WhatsApp link with ref; nearest branch with one map link.
- [ ] CH-6.6 Auto mode per channel (public message delivery); confirm the owner's sign-off per channel is recorded in settings.
- [ ] CH-6.7 Latency: measure customer-message → reply from `chat_messages`; target ≤ 6 s median; skip models on closing; trim prompt size.

**Acceptance:** a full booking in chat produces the booking record at the first ask, a task when needed, the right lead stage, and no rule violations across the safety set.

## CH-7 — Telegram + daily summary
- [ ] CH-7.1 Platform bot client, webhook with secret header, `/start <code>` linking, target management UI.
- [ ] CH-7.2 Instant alerts per target and event; platform failure alerts.
- [ ] CH-7.3 New inquiry-focused daily summary builder (structural reference only: chats, messages, replies, real reply time, handoffs by reason, bookings, payment claims, tasks, new leads, won value, errors, cost, judge rating with the worst chat linked) — per tenant, per brand section when > 1 brand.
- [ ] CH-7.4 `/api/chat/cron/hourly` (Bearer secret) + inactive n8n workflow export for the new platform instance; idempotent per tenant per local date.
- [ ] CH-7.5 Preview script that prints a summary without sending.

**Acceptance:** two test tenants with different summary times each receive exactly one correct summary.

## CH-8 — Voice notes and images
- [ ] CH-8.1 Voice: transcribe → private note → `chat_messages.transcript` → turn.
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
