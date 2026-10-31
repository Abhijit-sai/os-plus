# CH-3 Contacts, Leads and Customer Link/Convert
Status: READY_FOR_CLOSURE — LOCAL acceptance CHAT-D038 —2026-10-21. P3-1/P3-2 accepted as CHAT-D035/D036. Base00718d6e395ea652eb2a7ceb79b39ae1471e863c, same codex/chat-ch1-foundation worktree. CH-2 locally closed under CHAT-D034; Meta production-readiness remains deferred. CH-3 runtime/storage is implemented locally and under final QA; three additive migrations are applied only to the owned persistent LOCAL environment with verified pre/post database restores (CH3_QA.md). D037 approves configured high-interest plus recency for hot leads.

## Scope from05 CH-3.1–3.6
Tenant-owned contacts/identities/leads/events/staff mapping; exact resolution and one open lead per conversation; response clocks/ownership; audited atomic link/convert/merge/split/stage/owner/note commands; record-driven stage refresh, scheduler adapter and future page-view hook; reference-code identity linkage subject to the no-auto-merge rule. No Leads screens/native reply inbox, AI, SSO, Telegram delivery, Meta connection or n8n activation in this phase. Leads UI is CH-4.

## Current-code reconciliation / design constraints
1. Existing customer creation is src/features/customers/actions.ts, not a reusable core command. Add an atomic chat conversion command using the same name>=2, optional email/phone and country-validated E.164 rules/active uniqueness; do not refactor the live action. Reuse src/features/customers/phone.ts at the server boundary; never guess a foreign country. The retained customers normalized_phone_e164 and tenant composite keys are the linking boundary.
2. customer_external_identities belongs to platform/Shopify import; chat identities go into new tables. No customer_phones or existing-customer metadata rewrites.
3. Identity platform IDs are scoped to provider/app/account/Page/inbox, not globally to a person. Include the resolved workspace/channel scope in the identity key where appropriate. Never let identical unscoped website/FB IDs silently join across inboxes; same verified exact phone can identify a contact inside one tenant. Website self-reported phone/email is not verified possession and must not auto-link financial/customer records.
4. CH-2 parser deliberately projects message transport facts and discards profile identity fields. Add Zod-validated identity metadata and verify against pinned Chatwoot adapters. WhatsApp/IG/FB raw-wire acceptance remains deferred; synthetic/local tests are not live-channel proof.
5. CH-2 chat_conversations has no contact FK. Add composite FK now that contacts exist; no dangling UUID. Extend capture atomically so retries and event/agent callback ordering produce one contact/open lead without double events. Keep existing shared configuration lock order.
6. PH-3 WBS reference-code “merge” conflicts with the explicit no-auto-merge rule when two existing contacts already exist. The stronger rule governs: record exact candidate linkage; require audited manual merge/split. A reference code is not proof of phone possession or authority to combine unrelated people.
7. Knowledge pack schema currently has no typical-basket/intent-priority configuration. Add only optional, versioned CRM metadata or a narrow new chat-owned policy record; existing packs remain valid and unchanged. Unknown value remains null, never zero. No copied business taxonomy, keywords or model classification: new leads have neutral/null intent; explicit trusted updates use configured priorities to prevent downgrade.
8. Stages must read explicitly linked, tenant-owned real records. Do not select a repeat customer's unrelated historical paid order and mark a new inquiry won. Shopify raw payloads/drafts/setup completion, production completion and actual delivery are separate. No local payment receipt from Shopify payment facts; no historical-import messages.
9. Existing tasks actions are Laundry-only. New chat-owned task hooks must not weaken those guards. Only authorised task_type/subject_type check extensions may alter existing schema. No booking/notification capability execution before its phase.
10. Staff actor IDs in callbacks are Chatwoot IDs; ownership is tenant_users UUID via explicit chat_staff_links. Match no email/Clerk identity heuristics. First mapped public staff reply may assign an unowned lead; no overwrite of a manually chosen owner. Private notes/system/bot greetings must not fake human reply clocks.
11. Scheduler is later n8n infrastructure. CH-3 may supply the narrowly guarded stage-refresh endpoint and future page-view hook; no scheduler activation. Environment flags/secrets read at call time.
12. Legacy stage names in Boutique are configurable and production is distinct from fulfilment; use explicit record fields/status contracts. Read every referenced schema migration before implementation.

## Accepted business policies — CHAT-D035/D036
P3-1: follow documented record-driven progression: confirmed booking => booked; explicitly linked real order => in_progress; that order fully paid OR explicitly delivered => won. Manual changes audited. Never infer from source draft/setup/production-only/old unrelated orders.
P3-2: configured lost_after_days (current setting7) closes only eligible new/engaged sales leads after customer silence; exclude active linked booking/order. Alternative: manual lost only.
Owner explicitly approved both choices on2026-10-21. No pending policy question for this slice.

## Intended files / migrations
- src/features/leads/{rules,schemas,commands,capture,queries,stage-refresh}.ts and safe DTOs only as needed by CH-3.
- src/features/chat/{capture,ingress} and src/integrations/chatwoot/payload.ts for validated identity input/capture transaction; reuse existing module/permission guards.
- src/types/chat.ts and additive generated DB type declarations required for new RPCs/tables; no broad shared refactor.
- New timestamped chat contacts/leads and command migrations, tentatively20261021123000_chat_contacts_leads.sql and20261021124000_chat_contact_lead_commands.sql. New tables include contacts, scoped identities, leads, append-only events, staff links and merge/split audit state as required. Composite tenant FKs/RLS/service-only execution throughout.
- Existing schema changes: only listed tasks check extensions; no Boutique/Laundry column/behaviour changes. Existing customer writes only through the new atomic command following current platform rules.
- scripts/test-chat-lead-rules.mjs, test-chat-lead-capture.mjs, test-chat-contact-commands.mjs, test-chat-lead-refresh.mjs, updated payload/capture fixtures and disposable/local harnesses.
- Exact guarded cron stage-refresh route/proxy exception if needed, with no Telegram/summary scheduling. No new public inbox.
- CH3_QA.md / CHECKLIST / decision log / this SAME project_summary.md; QA tracker updated with executed evidence only.

## Verified sequence / gates
1. Finish schema/current-code audit, answerP3-1/P3-2, record IN_PROGRESS.
2. Pure rules with meaningful tests: phones/scoped identities/ref codes, monotonic intent, stages/hot/clocks/value/config and privacy boundaries.
3. Disposable PostgreSQL migrations: constraints/RLS/ACLs, two tenants sharing a phone, concurrent first identity/lead creation, collision/ref ambiguity, rollback/audit/idempotency; reject other tenant reads/mutations/links.
4. Commands and atomic callback integration: exact customer reuse vs create; conversion races against existing customer paths; manual merge/split and stale-undo guards; ownership/clocks/private/system/bot exclusions and terminal/reopened conversations.
5. Stage-refresh adapter and actual HTTP tests against local synthetic records; no n8n/live external calls.
6. Six platform gates plus full Boutique Tier A due shared capture/types/customer boundaries; real local schema/transaction/browser evidence, no static assertions substituted.
7. Update summary after major steps; final diff/migration/review, owner acceptance/approved policy and local phase commit. Meta readiness is still a release blocker, not falsely passed.

Code audit correction: chat_staff_links already exists in CH-1, so reuse its tenant/member constraints. Generic follow-up tasks do not encode confirmed booking; task existence is not confirmation. Native confirmed pickup states/later capability evidence may advance automatically, while manual changes stay audited.
