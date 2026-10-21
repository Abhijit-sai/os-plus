# CH-2 implementation plan
Status: CLOSED — LOCAL under CHAT-D034, commit00718d6e395ea652eb2a7ceb79b39ae1471e863c, 2026-10-21. Deferred Meta checks remain a production-release blocker.
Branch: codex/chat-ch1-foundation (existing approved worktree; continuing locally).

## Scope
Follow 05 CH-2.1–2.6: transport parser/client, authenticated events capture, four tenant-owned memory tables, silent agent skeleton, bot/webhook onboarding and synthetic HTTP mock integration. No leads UI, contact conversion, model calls, replies, SSO or Meta onboarding in this phase.

## Verified contracts and corrections
- Latest navigation is D029: Chats opens Chatwoot in a new tab; Leads lives in OS PLUS.
- Contacts do not exist until CH-3. Defer conversation contact_id and its composite FK to CH-3; retain Chatwoot contact id now. Do not introduce a dangling UUID reference.
- Existing domain actor/source types already include WEBHOOK. Use those and correlation ids with service-only atomic SQL commands.
- CH-1 stores only a webhook-secret hash. Automated onboarding must accept/reconcile the owner-held secret or explicitly rotate it; cannot recover plaintext from a hash.
- Pinned v4.18.0 AgentBotListener and WebhookListener pass a signing secret to jobs. The old unsigned-webhook assertion is stale. URL-key + constant-time secret-hash authentication remains mandatory; never use payload ids as tenant authority. Verify signing wire contract before adding signature enforcement.
- Pinned message webhook_data includes top-level account, inbox, conversation and sender. Both string and numeric message-type encodings are supported. System/greeting classification uses sender and template/activity metadata, never timing alone. An explicit human sender remains staff even on a template; a quick human reply must remain staff.
- Agent/event delivery can arrive in either order. Both must share idempotent capture before one silent turn, so the agent callback cannot depend on prior event delivery.
- Return after authentication/validation and schedule work with Next after(). This is not a durable queue: post-response process loss is an explicit acceptance risk; record safe failure health without payloads/secrets. Do not claim guaranteed delivery.
- Actual local Chatwoot 4.18 website customer/system/staff captures are now available in scripts/fixtures/chatwoot/local-4.18-website.json. WhatsApp/Instagram/Facebook captured acceptance remains pending; synthetic contract fixtures do not satisfy it.

## Planned files
- src/integrations/chatwoot/payload.ts, expanded admin-client.ts and onboarding helpers.
- src/features/chat/capture.ts, webhook handler, corresponding two route.ts files.
- src/types/chat.ts; exact POST ingress exception in src/proxy.ts.
- 20261021110000_chat_capture.sql (four tables, RLS/ACLs, atomic capture/turn RPC). Implemented additional 20261021111000_chat_transport_setup.sql for persistent reservation/check/completion using the existing idempotency ledger.
- scripts/test-chat-payload.mjs, capture database/HTTP tests, mock provider and onboarding tests.
- 02/04/06 documentation corrections, CHECKLIST, CH2_QA.md and same project_summary.md.

## Verification
TDD slices: parser/classification -> actual disposable PostgreSQL migration and transaction/concurrency/isolation -> actual HTTP with mocked Chatwoot -> onboarding recovery. Wrong secret/account/inbox/key, module/workspace off, duplicates, callback ordering, private/staff/bot/system exclusion, quiet clock monotonicity, rollback and denied SQL roles. Run six platform gates and applicable Boutique Tier A for shared ingress/type changes. No fabricated browser/migration evidence.

## External closure dependency
CHECKLIST B plus C/CH-2 require a fresh Chatwoot instance and an explicitly approved test channel/message. Owner must choose domain, authorize/provision dedicated server and arrange private credentials, then approve hosted test tenant/inbox and message. Local work continues first. No spend/deploy/migration/live-send authority inferred.

2026-10-21 clarification: local technical checks and QA tracker repair are complete within CH2_QA.md's scopes. Meta test preparation can use test assets plus a separately approved temporary HTTPS endpoint; purchasing a server/domain is not a prerequisite for all sandbox testing. Current isolated local stack stays private. See CH2_META_TESTING.md. Actual captured Meta fixtures and formal owner phase acceptance remain before closure.

CHAT-D034 overrides the external capture/test-inbox gate only for local CH-2 closure/commit and CH-3 progression after final local review. The deferred checks remain mandatory before channel production readiness; see CH2_META_TESTING.md. Do not ask the already-approved phase progression question again.
