# OS PLUS Chat & Leads — Decision Log

## Accepted

### CHAT-D001 — Build as an OS PLUS module, not a separate product
**Status:** ACCEPTED (owner, 2026-10-05)
Chat & Leads lives in the OS PLUS repository and database so a lead can become an OS PLUS customer and flow into orders, production, delivery and payment. A tenant can buy the module alone. A sibling repository ("Os-Chat") was the alternative and was not chosen.

### CHAT-D002 — Chatwoot CE, self-hosted, is the transport and staff inbox
**Status:** ACCEPTED (owner, 2026-09-16 for Fundry; reconfirmed 2026-10-05)
Chosen over Whatomate, WACRM and Frappe CRM for Fundry (maturity, multi-channel, template broadcasts). Covers WhatsApp Cloud, Instagram, Facebook Messenger and the website widget in one inbox, with agent bots, private notes, labels, teams, dashboard apps and staff mobile apps. Self-hosting avoids per-seat/per-contact SaaS fees (Respond.io, Wati, Interakt). Chatwoot's paid AI ("Captain") is not used — OS PLUS brings its own agent. A native inbox was started at Fundry and abandoned.

### CHAT-D003 — One Chatwoot install; one account per tenant; brands and branches are inboxes
**Status:** ACCEPTED (2026-10-05)
Multi-brand and multi-branch businesses do not need separate deployments. Chatwoot accounts isolate tenants; inboxes (and teams) separate brands, channels and branches inside a tenant. Multi-tenancy in OS PLUS is already built (tenants, tenant_users, locations, teams).

### CHAT-D004 — Same stack
**Status:** ACCEPTED (owner, 2026-10-05)
Next.js, TypeScript, Clerk, Supabase, Vercel (OS PLUS); Chatwoot on Hetzner; n8n available on Hetzner; Telegram; OpenRouter for models.

### CHAT-D005 — v1 scope
**Status:** ACCEPTED (owner, 2026-10-05)
WhatsApp AI agent, Instagram and Facebook chats, lead inbox + CRM, Telegram alerts + daily summary, and the website chat (Chatwoot website widget answered by the same agent).

### CHAT-D006 — Contact is not customer
**Status:** ACCEPTED (2026-10-05)
A contact is anyone who messaged. It links to an existing customer only on an exact tenant E.164 match, and becomes a new customer only through the platform customer-creation rules (button or confirmed booking). Instagram/Facebook handles never create customers on their own.

### CHAT-D007 — Port Fundry's agent v4; facts move to a per-brand knowledge pack
**Status:** SUPERSEDED by CHAT-D018 (owner, 2026-10-06); historical record only
"Read freely, write through gates." `business.ts` becomes `chat_knowledge_packs` (versioned, validated). Gates and checks stay as tested code.

### CHAT-D008 — New channels start in draft mode
**Status:** ACCEPTED (2026-10-05)
Auto mode is switched on per channel by the tenant owner after drafts are sent unchanged ≥ 70 % for a week. Instagram/Facebook default to draft and move bookings/dues to WhatsApp.

### CHAT-D009 — Bookings through vertical capabilities
**Status:** ACCEPTED (2026-10-05)
Laundry tenants create pickup requests via the existing command; other tenants get a follow-up task. Selected by enabled vertical, never by tenant identity.

### CHAT-D010 — One platform Telegram bot
**Status:** ACCEPTED (2026-10-05)
Tenants link their own chats with one-time codes; no per-tenant bot tokens.

### CHAT-D011 — Docs on their own branch; Shopify sync stays first
**Status:** ACCEPTED (2026-10-05)
`docs_chat/` was written on `docs/chat-leads-module` from deployed `c881102` in a separate worktree, so the uncommitted Shopify work on `codex/shopify-sync-plan` was not touched. Chat build starts only when the owner directs.

---

### CHAT-D012 — Owner clarification: managers can work leads; reports remain owner-only
**Status:** ACCEPTED (owner, 2026-10-06)
Managers can reply and work with linked leads. Conversation assignment and access are configurable through Chatwoot. Owner/admin has all tenant chats and reports; managers do not receive chat-report access under the earlier owner instruction. Exact CE versus paid-edition support must be verified before promising granular Chatwoot roles. A business may have multiple WhatsApp numbers, branches and admins. The same authenticated person may have different memberships/roles across businesses; email equality alone does not grant tenant access.

### CHAT-D013 — OS PLUS entry point; both Chats and Leads on one chat subdomain
**Status:** ACCEPTED REQUIREMENT (owner, 2026-10-06; exact domain and routing mechanism OPEN)
OS PLUS remains on Vercel. Its module CTA opens a single chat.<domain> workspace containing both Chats and Leads; the owner explicitly chose one shared chat hostname instead of separate chat and crm subdomains. Chatwoot runs on a separate server and remains the only staff reply interface. Lead data, customer linking and Domain Commands remain OS PLUS-owned. Proposed routing: Chatwoot at its normal paths, with a reserved /crm/ namespace for custom lead pages served from Vercel through the server reverse proxy. This revises the earlier assumption that full Leads pages are presented on the main OS PLUS hostname. Root domain and current production hostname remain required. A path-aware lead build/routing design must be verified against Next.js assets, navigation, Clerk, selected-tenant context, server-action origin checks, and proxy headers before it is accepted; no existing application base path or live DNS/proxy settings are changed in this discovery session.

### CHAT-D014 — One-login entry into Chatwoot
**Status:** ACCEPTED REQUIREMENT (owner, 2026-10-06; mechanism to verify)
An existing OS PLUS login should allow entry into Chatwoot without a second password prompt where feasible. The Chatwoot Platform API documents GET /platform/api/v1/users/{id}/login for generating a user login link, and the v4.17.1 source includes that endpoint. This is a proposed authenticated server-side handoff, not a completed or locally verified integration. Platform credentials remain server-only. Resolve authenticated identity, active tenant membership, module permission, mapped staff identity and account membership before a handoff. Validate tenant switching, access removal and logout; shared registrable-domain placement alone does not authenticate a Clerk user to Chatwoot. Enterprise SAML and this Platform API handoff are distinct mechanisms.

### CHAT-D015 — Provider-operated platform; Meta setup starts from scratch
**Status:** ACCEPTED (owner, 2026-10-06)
The provider manages hosting, backups, upgrades and incident response. Initial expected volume is about 10 chats/day per brand, generally one WhatsApp number per business while supporting multiple numbers. Meta business/app authentication and number onboarding start from scratch. One Chatwoot account per OS PLUS tenant is reconfirmed. Server selection, Meta app ownership/onboarding approach and scheduler remain open under O2/O3/O4/O7; no live setup, purchasing or real messages authorized.

### CHAT-D016 — Isolated CH-0 worktree and documentation transfer
**Status:** ACCEPTED (owner, 2026-10-06)
Owner confirmed origin/main as the deployed base and authorized a separate chat worktree while preserving the unrelated uncommitted work in D:/Develop/os-plus. Branch codex/chat-ch0-discovery was created in D:/Develop/os-plus-chat-ch0 from refreshed c701ec346aeb1fb38a364f4da231bff2a9a0232e. D:/Develop/os-plus-chat is already an OS PLUS worktree, not a Chatwoot fork; its docs_chat files were untracked. Owner authorized copying only those documents into the new chat branch; no merge into main or documentation commit was authorized. CHAT-D011 is historical; this session may perform CH-0 in isolation after the remaining phase decisions without waiting for the Shopify checkout to become clean.

---
### CHAT-D017 — Domain selection deferred; single chat subdomain retained
**Status:** ACCEPTED (owner, 2026-10-06)
No custom production domain is linked yet. The owner will select/link it later, then use one chat subdomain under it for both Chats and Leads. CH-0 local preparation may use explicit placeholders. Real DNS, TLS, Meta callback URLs, Clerk production origins and cross-service authentication must be completed/verified before live onboarding. Domain purchase or production configuration is not authorized.

### CHAT-D018 — New business implementation; reference structure only
**Status:** ACCEPTED (owner, 2026-10-06; supersedes CHAT-D007 and any Fundry-port/cutover requirement)
Fundry's repository, services, accounts, data and implementation are untouched. Reference structure only; do not adopt its customer-facing language, workflows, operational policy, branding, API tokens, model choices, knowledge pack, test conversations or rubric calibration. Build a new guarded agent and new business setup, using OS PLUS-native contracts and fresh reviewed configuration/credentials. Universal platform safety requirements still apply. Replace the CH-0 Fundry example with a synthetic unpublished new-business schema example. No Fundry migration or future cutover is included.

### CHAT-D019 — Manual WhatsApp onboarding
**Status:** ACCEPTED (owner, 2026-10-06)
Use manual onboarding initially with each new business's separately authorized WABA, number and fresh connection credentials. Embedded signup is not an initial prerequisite; consider it only if later explicitly requested. Meta app ownership remains O3.

### CHAT-D020 — Tenant-configurable viewer access
**Status:** ACCEPTED REQUIREMENT (owner, 2026-10-06; storage/UI design proposed)
Viewer access to this module must be configurable in OS PLUS role settings, rather than universally enabled or disabled. Current code has a fixed rolePermissions map and no configurable role-permission storage. The proposed CH-1 addition is tenant-owned Chat & Leads access/PII configuration with owner/admin controls and server-side enforcement. Do not broaden other modules' permissions or refactor legacy authorization. Viewer grants default to denied until configured (implementation proposal). Owner/admin-only chat reporting remains the earlier policy. Chatwoot access must also enforce the chosen permission model; validate its edition before promising read-only custom access.

### CHAT-D021 — No Instagram comment automation
**Status:** ACCEPTED (owner, 2026-10-06)
Instagram comment automation is not required and is excluded. Do not schedule it as an assumed V2 requirement. Instagram DMs remain within the already requested channel scope.

---

### CHAT-D022 — Central provider-managed Meta onboarding
**Status:** ACCEPTED DIRECTION (owner, 2026-10-07)
The owner centrally manages/owns the business pages/apps. Implement a provider-managed platform Meta app as the onboarding assumption, with separately authorised pages/WABAs/inboxes for each business. A common operator is not tenant authority and does not waive Meta ownership, review or asset permissions. Actual app/business portfolio setup is an owner action before live onboarding.

### CHAT-D023 — Inquiry-first v1; payment screenshots excluded
**Status:** ACCEPTED (owner, 2026-10-07)
Inquiries are the primary use case. Payment screenshot extraction/verification tasks are excluded, including VERIFY_PAYMENT_CLAIM schema/task requirements. No automatic payment posting. Booking and financial capabilities are opt-in later-phase policy for a new business, never inherited from the reference.

### CHAT-D024 — New n8n beside Chatwoot
**Status:** ACCEPTED (owner, 2026-10-07)
Use a new n8n instance on the same new platform server as Chatwoot, with separate database/credential/storage/network boundaries. Keep the admin editor private over SSH initially. Do not touch existing business/Shopify schedulers. CH-0 prepares hosting; CH-7 implements the endpoint/workflow and explicit authority is still needed to activate it.

### CHAT-D025 — Local phase commits and continued phased work authorised
**Status:** ACCEPTED (owner, 2026-10-07)
The owner explicitly authorised local commits after each phase passes its closure gates and continued work through remaining phases. This supersedes the per-phase need to ask separately for commit authority, but does not bypass phase acceptance/required owner QA or authorise push, merge, deployment, shared-database migrations, paid model runs or real messages. Record each closed phase and its evidence before the next begins.


## Resolved CH-0 decisions

| ID | Resolution / dependency |
|---|---|
| O1 | Domain selection/linking deferred by owner; local placeholders allowed. One chat subdomain for Chats and Leads; actual domain required before live setup. |
| O2 | Existing Fundry server is excluded. Use isolated new-platform infrastructure; the documented Hetzner deployment remains a proposal, and purchases require explicit authority. |
| O3 | Central provider-managed Meta app/onboarding direction, with separately authorised business assets. |
| O4 | Manual WhatsApp onboarding initially, with fresh business credentials. |
| O5 | No Fundry onboarding, migration, cutover or implementation/service changes. |
| O6 | Payment screenshot verification and VERIFY_PAYMENT_CLAIM tasks excluded. |
| O7 | New private-admin n8n beside Chatwoot on the new server, separate database/storage/credentials. |
| O8 | Viewer access configurable per tenant in OS PLUS role settings; no fixed universal grant. |
| O9 | External billing adapters remain outside v1 under the original scope control; use OS PLUS-native customer/billing contracts. |
| O10 | Instagram comment automation excluded; no assumed later-phase commitment. |

## Open — CH-0

None. O3 is centrally provider-managed Meta onboarding (CHAT-D022); O6 excludes screenshots (CHAT-D023); O7 selects new n8n beside Chatwoot (CHAT-D024).

Later-phase/deployment dependencies remain: selected domain/DNS/TLS, new infrastructure and Meta assets, fresh credentials/SMTP, validated login/proxy path behavior, Chatwoot viewer capability parity, new-business knowledge/language/workflows and production models. These are not inferred from the reference.

## Resolved - CH-1 access decisions

### CHAT-D026 — Foundation role defaults
**Status:** ACCEPTED (owner, 2026-10-21; resolves P1)
Owner/admin has full Chat & Leads access/settings; managers can view/manage leads and see contact details. Viewer and finance start without module access; owner/admin can separately grant read-only lead viewing and PII visibility. PII is not a standalone entry grant. Chat reports and configuration stay owner/admin-only; other modules' permissions are unchanged. Grants are tenant-owned, audited and enforced server-side.

### CHAT-D027 — Viewer Leads first
**Status:** ACCEPTED (owner, 2026-10-21; resolves P2)
Initial viewer access is configurable read-only Leads. Viewer Chatwoot entry stays disabled until equivalent restrictions are proved. No paid edition purchase, full-agent fallback or read-only Chatwoot capability claim is implied.


### CHAT-D028 — Preserve planning and integrate released baseline locally
**Status:** ACCEPTED (owner, 2026-10-21; resolves I1)
Owner explicitly approved the local documentation preservation checkpoint and merge of exact released c686337c0f059cbe6ae40bbcadc2f6c0da2ffc0a into the existing codex/chat-ch1-foundation branch/worktree. Preserve both summary histories, review and verify before coding. This is a specific mid-phase commit exception, not CH-1 closure or public release authority.

## Open - CH-1
No unresolved product/access or local baseline-integration decisions. Implementation/environment/QA dependencies remain in the current plan and summary.

## CH-1 implementation evidence — 21 October 2026

Technical execution record, not a new product-policy approval: CHAT-D028 completed through preservation checkpoint 1619c61 and reviewed local merge 24a0af7. D026/D027 are implemented; acceptance remains QA_BLOCKED as detailed in [CH1_QA.md](CH1_QA.md).
Versioned encryption uses the private JSON keyring CHAT_SECRETS_KEYS and active version CHAT_SECRETS_ACTIVE_VERSION. This replaces the singular draft env-name notation while retaining the approved AES-256-GCM/version-rotation design. No production keys were generated, configured or rotated.

### CHAT-D029 — Clarify the daily staff experience versus foundation settings
**Status:** OWNER CLARIFICATION (2026-10-21)
The owner reiterates that the staff-facing Chats module opens the actual Chatwoot conversation interface in a new tab at chat.<chosen-domain>, while Leads is an OS PLUS workspace module holding captured inquiries and their CRM state. The current /settings/chat page is owner administration, not the staff inbox or a completed chatbot experience. Chatwoot owns channel inboxes, staff replies and assignment; OS PLUS maps them to tenant/brand/branch and owns guarded-agent configuration and lead/customer links.

Use this latest statement for primary navigation: Chats -> Chatwoot new tab; Leads -> OS PLUS Leads module; Chat settings -> owner configuration. D013/D017's earlier requirement that both full surfaces must be on one chat hostname is superseded insofar as it would force Leads out of the OS PLUS workspace. Exact domain/proxy routing and optional embedded lead-card access still require implementation verification. Do not create another CRM database or native reply inbox. D014 one-login target and D026/D027 roles remain unchanged.

No phase acceptance, new purchase, live Chatwoot deployment, domain selection or external access is implied by this clarification. The owner is reviewing the product direction; the latest login identity has not been independently checked in this discussion.

### CHAT-D030 — Foundation accepted; continue to Chatwoot integration
**Status:** ACCEPTED (owner, 2026-10-21)
Owner accepted the CH-1 foundation results and instructed: “Accept CH-1 foundation; continue to CH-2 after final records/checks.” The acceptance question explicitly covered setup/publication, role/tenant isolation, all14 local Boutique paths, desktop plus390px authenticated iframe layout evidence, and that current settings are owner configuration while staff inbox/Leads/chatbot remain later phases. This satisfies C8 after documented checks/final review; D025 local phase-commit authority applies. D029 navigation is reconfirmed. External purchase, domain/DNS, shared migration, deployment, real messages and paid models still require concrete separate authorization.

## CH-2 technical reconciliation — 2026-10-21
No new product policy approval inferred. CH-1 CLOSED at8eb7a8e2f4475fcd696c5ee41c52ea0e5435bf50 after D030. Current CH-2 plan/evidence: CH2_IMPLEMENTATION_PLAN.md and CH2_QA.md.
- D029 navigation is now reflected in architecture/checklist (Chats external Chatwoot tab; Leads OS PLUS).
- Pinned v4.18.0 passes signing secrets to webhook jobs; older unsigned assertion corrected. URL key+secret remains mandatory. Deployment signing enforcement remains a verified-wire task.
- Contacts FK deferred until CH-3 table exists. Current capture subscribes message_created only, with fresh synthetic fixtures.
- Existing bot identity is preserved on callback changes; manual authorized callback reconciliation is required, not replacement creation. Server-only setup remains dry-run/live gated. No external setup authority or CH-2 acceptance is implied.

### CHAT-D031 — Hosting ceiling and local-first connector QA
**Status:** ACCEPTED constraint / owner clarification (2026-10-21)
Owner stated a maximum monthly hosting budget of 2k (interpreted as INR 2,000), no server exists, and production Chatwoot will use the chat subdomain. Root domain is not selected. No purchase or hosting provider approved. Price proposals must identify taxes, backup/storage and renewal costs; model/channel charges remain separately disclosed rather than assumed included.
No server purchase or domain is required for local Chatwoot + OS PLUS synthetic integration. Prepare a separate loopback-only Chatwoot Docker project with its own database/Redis/storage and synthetic credentials; no Meta/SMTP/real inboxes, public tunnel, existing business infrastructure or n8n activation. The CH-0 production Compose needs an explicit local configuration (no public Caddy/TLS requirement), not unchanged execution. Local actual-Chatwoot evidence is still distinct from hosted Meta/channel and owner acceptance. Earlier notes implying server procurement must precede all further connector QA are superseded.


### CHAT-D032 — Temporary HTTPS route selected for Meta QA
**Status:** ACCEPTED direction (owner, 2026-10-21)
Owner chose a temporary HTTPS tunnel for testing and requested a step-by-step walkthrough of creating the Meta app and WhatsApp test number. This resolves the test-route choice in CH2_META_TESTING.md. Prepare the separate disposable test copy and exact route/egress plan; keep existing loopback fixtures private. No public endpoint was activated by this guidance session. App/number/recipient identifiers and the concrete endpoint scope are still to be established before connection or real test sends. No purchase, production deployment, shared migration, public app release or phase acceptance is inferred.


### CHAT-D033 — Meta onboarding and tunnel deferred by owner
**Status:** ACCEPTED deferral (owner, 2026-10-21)
Owner instructed: “we'll connect to the meta business manager later. Let's complete the other stuff putting this aside”. Stop Meta app/number onboarding and temporary tunnel activation for now. Preserve D032 as the preferred eventual test route, not an active task. Real-channel fixtures/acceptance remain untested, never marked PASS. The separate question of allowing local-only CH-2 closure/commit and advancement to CH-3 is presented explicitly because the current phase gate requires real-channel captures; no scope/closure exception is silently inferred. Existing local commit authority remains valid once the applicable approved gate is satisfied. No purchase/public exposure/real-message authority added.


### CHAT-D034 — Local-only CH-2 closure and CH-3 progression authorised
**Status:** ACCEPTED exception (owner, 2026-10-21)
Owner explicitly answered “Approve local closure and CH-3; defer Meta (Recommended)” to the combined question permitting deferral of the live Meta acceptance gate, final local CH-2 review/commit under D025, then CH-3 Contacts & Leads. This overrides the CH-2 real-Meta-capture/real-test-inbox gate for LOCAL phase progression only. Existing passed local evidence and owner reply confirmation support this scoped acceptance; final local review/tests still must pass before commit. Preserve all missing WhatsApp/Instagram/Facebook and approved-channel template/captured acceptance as a production-release blocker, not PASS. No live-channel activation, public tunnel, shared migration, push/merge/deploy, real message or paid model authority is granted. Proceed with CH-3 only after the local CH-2 commit; keep platform features disabled until separately approved/enabled.


### CHAT-D035 — Record-driven lead stages approved
**Status:** ACCEPTED (owner, 2026-10-21; P3-1)
Confirmed booking -> booked; explicitly linked real order -> in_progress; that order fully paid OR actually delivered -> won. Imported drafts, production completion and unrelated old customer orders never advance the lead. Manual stage changes remain audited. No payment receipt, order/delivery mutation or messaging is implied.

### CHAT-D036 — Configurable inactivity closure approved
**Status:** ACCEPTED (owner, 2026-10-21; P3-2)
Eligible new/engaged SALES leads automatically become lost after the tenant's configured customer-silence period (currently7 days), excluding active linked bookings/orders. Service/spam and already terminal leads are excluded. This approves stage refresh only, not n8n activation or outbound reminders.


### CHAT-D037 — Hot lead definition approved
**Status:** ACCEPTED (owner, 2026-10-21; P3-3)
An open SALES lead is hot only while its latest customer activity is within the tenant's configured hot_hours AND its intent belongs to the brand knowledge pack's configured high-interest intent list. Routine inquiries are not hot by default. No business intent taxonomy is prefilled; an empty/missing list means no hot leads. Won/lost/service/spam and future-dated activity are excluded.


### CHAT-D038 — CH-3 local acceptance, real-phone deferral and CH-4 authorised
**Status:** ACCEPTED exception (owner,2026-10-21)
Owner answered “Accept local CH-3; defer real phones; continue CH-4” to the evidence-linked phase acceptance question. Accept local six gates/Chat100/provider10/CRM2/Boutique14/restore evidence and their documented scope. Defer CHECKLIST PartC CH-3 two-real-phone/WhatsApp owner exercise until Meta resumes; preserve it as an unexecuted production-release blocker, never PASS. Authorises final local CH3 closure/commit under D025 then CH4. No shared migration, live message, purchase/public tunnel, production enablement, push/merge/deployment or n8n authority.


## Resolved — CH-4 local closure alignment,2026-10-22 (CHAT-D039)
**C4-O1 — ACCEPTED under CHAT-D039; proposal history below retained.** CH4_IMPLEMENTATION_PLAN.md stages existing stored suggestion text/knowledge version in CH4, richer generated provenance in CH5 and Create booking/actions in CH6. Original WBS CH4.2 bundles these; its checkbox remains partial. Request explicit sequencing acceptance with the full local CH4 gate in CH4_OWNER_ACCEPTANCE.md C4-L4/L5 before READY_FOR_CLOSURE/commit/CH5. No new business policy, purchase or model run approved.

Factual owner-assisted QA: owner replied "saved" to the conversation10 Dashboard App exercise. Actual persisted stage/owner/note and audit verified, fresh matching-account card displays the values. This is one verified save, not evidence of two saves or full phase acceptance. CH4_QA.md records complete local gates and limits. Meta/two-phone deferral remains release-blocking under D038; no external readiness implied.


### CHAT-D039 — CH-4 local acceptance and dependency sequencing
**Status:** ACCEPTED (owner,2026-10-22)
Owner answered "Accept local CH-4 and sequencing; continue to CH-5 planning" to the evidence-linked full phase question. C4-L1–L5 local acceptance satisfied: six gates/Chat119, actual card save, role/tenant/privacy/narrow checks, Boutique14 and local migration/restore evidence within CH4_QA.md limits. Explicitly accepts C4-O1 sequencing: CH4 stored suggestion text/recorded knowledge version; richer generated provenance CH5; booking actions CH6. CH4.2 is complete only for that accepted local scope, not evidence those later features exist. Authorises final local closure/commit under D025 and CH5 planning. Meta/two-phone proof stays deferred and production-release blocking. No paid model run, purchase, shared SQL, public tunnel, real external message, n8n activation, push/merge/deployment or production enablement authority.
