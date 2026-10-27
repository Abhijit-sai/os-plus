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


## Open — CH-5 planning,2026-10-22
P5-1 configurable inquiry/session/quiet defaults; P5-2 genuine budget ceiling vs continued draft inference; P5-3 mock-only build with live model/key selection deferred. Proposed recommendations and exact tradeoffs: CH5_IMPLEMENTATION_PLAN.md §Open decisions. No dependent code or paid call before answers. CH4 is CLOSED LOCAL atf9d195c under D039; original CH4 closure-alignment proposal is resolved. No external release or new production business policy inferred.


### CHAT-D040 — Configurable inquiry/session defaults
**Status:** ACCEPTED (owner,2026-10-22; P5-1)
Continuing within30min, resumed30min–24h, fresh after24h; use each tenant's saved quiet interval after public human replies (currently60min). Bare acknowledgements are silent only with no open request. Languages/wording from the reviewed brand pack; first tests synthetic inquiries only. Defaults remain configurable, no existing ledger/pack overwrite or CH6 business-action approval.

### CHAT-D041 — Genuine model budget ceiling
**Status:** ACCEPTED (owner,2026-10-22; P5-2)
Stop new paid calls at the tenant's configured model budget limit; retain a safe draft/status for staff. Changing public auto replies to paid draft generation is insufficient. Atomically reserve conservative call maxima, do not treat missing cost as free or retry with new paid calls automatically. No paid model run authorised.

### CHAT-D042 — Mock-only CH-5 first
**Status:** ACCEPTED (owner,2026-10-22; P5-3)
Build/test with synthetic fixtures and mock models first; production model IDs unset and engine disabled. Live model selection, private fresh platform key and explicitly priced smoke approval later. No live fallback/model API call or real-message authority; eventual paid/live phase acceptance not waived.

## Open — CH-5 after P5 approvals
P5-1/P5-2/P5-3 resolved byD040–D042. No unresolved policy blocks the approved mock-only inquiry build. Live model choice/cost/key, real Meta/WhatsApp acceptance and later business-action policy remain explicit future dependencies, not inferred approvals.

### CHAT-D043 — Automatic local mock suggestions for fresh chats
**Status:** ACCEPTED (owner,2026-10-22)
Owner explicitly requested enabling free synthetic suggestions for fresh chats and completing the stage soon. This refines D042's engine-disabled default ONLY for the owned isolated local test setup: launch with --chatwoot --mock-suggestions, exact loopback transport, existing synthetic Local QA A/B. Mock worker/private draft delivery and their local tenant gates may be enabled; paid/live model execution stays disabled, model IDs/key blank. The mock currently uses a fixed opening-hours demonstration scenario, not arbitrary language understanding. Staff chooses any public Send; human quiet and other existing gates still apply. No real WhatsApp/Meta/external message, shared migration, production/public enablement or paid run. Full CH5 owner acceptance and original paid/live/WhatsApp gate deferral are NOT inferred from “complete this stage soon.”

### CHAT-D044 — CH-5 local acceptance and explicit live-gate deferral
**Status:** ACCEPTED exception (owner,2026-10-22)
Owner answered “Accept local CH-5; defer live gates and close locally” to the evidence-linked local closure question (six gates/Chat168,fresh-provider5,browser widget→private suggestion→approved reply). Accepts the documented combined local mock results and authorises local closure/commit under D025. This is acceptance of local evidence, not a claim the owner personally executed every C5-L step.
Explicitly defer the cheap paid-model smoke and realWhatsApp acceptance: they remain unexecuted, untested and production-release blocking. D044 closes the accepted LOCAL mock scope only; it does not claim real model accuracy, paid/live worker enablement or real-channel readiness. Existing Meta/two-phone deferral remains release-blocking. No paid run/purchase/key selection, real external messages, shared migration, tunnel, production change, push/merge/deployment or n8n activation authorised. No CH6 implementation in this closure session.

## Historical open — CH-6 planning,2026-10-22
Resolved by accepted CHAT-D045–D049 below; the following records the unapproved planning state only.
CH5 is committed CLOSED LOCAL at a09561d1ecce48acdd4e3a4df18ec368773ed953 under D044. Owner requests CH6 planning only before implementation, live AI disabled. See CH6_IMPLEMENTATION_PLAN.md for the existing WBS scope, actual contract conflicts, proposed files/migrations and test sequence.
All five proposals are UNAPPROVED:
- P6-1 draft mode: chat-owned provisional request first; staff approval before operational booking/customer/financial action; automatic internal safety-handoff tasks.
- P6-2 request-first capabilities: generic callback/task is not an appointment reservation; Laundry materializes only with validated complete evidence; operational booking changes/cancellation hand off to people.
- P6-3 proposed explicit deferral of statement issuance for inquiry-first scope, or guarded link-only owner/admin verified-WhatsApp issuance with revocable24h tokens and complete truthful source support.
- P6-4 configurable routing mappedChatwootassignee→leadowner→branchteam→visibleunassigned; deduplicate active work, or all-unassigned initial triage.
- P6-5 on-request once-per-conversation price image and opt-in neutral post-delivery review request/cooldown, or defer these optional automations. Proposed old positive-only gating conflicts with Google's current policy (primary source in plan); no unapproved workflow adopted.
Do not implement dependent policies or treat this recommendation list as accepted. Already accepted role defaults, tenancy, no-auto-merge, budget ceiling, stage rules, manual Meta onboarding and liveAI restrictions remain unchanged. No new business facts, model selection, paid run, shared migration, external message or public enablement authorised.

### CHAT-D045 — Draft business actions require staff approval
**Status:** ACCEPTED (owner,2026-10-22; P6-1)
Save a provisional chat request immediately; owner/manager approval required before operational booking/customer creation. Internal safety handoff tasks may be automatic. Sending suggested text is not business-action approval. Live AI/public production activation remain disabled.

### CHAT-D046 — Request-first capabilities and lifecycle
**Status:** ACCEPTED (owner,2026-10-22; P6-2)
Non-Laundry creates callback/follow-up requests, never promised reserved appointments. Laundry requires name,verifiedphone,configuredservice,confirmedaddress,date,configuredwindow before materialization. Pending chat requests may be edited/cancelled; changes after operational materialization hand off to staff. D035 confirmed-record lead stages unchanged; task existence is not booking confirmation.

### CHAT-D047 — Financial statements deferred from CH6
**Status:** ACCEPTED scope exception (owner,2026-10-22; P6-3)
Defer statement issuance/token pages/financial links from CH6. Dues/financial requests hand off with locked wording, no financial amount/payment posting. CH6.3 is deferred, not implemented/PASS. Future financial capability needs separate design/permission/source-truth acceptance.

### CHAT-D048 — Configurable safe handoff routing
**Status:** ACCEPTED (owner,2026-10-22; P6-4)
Mapped active Chatwoot assignee → eligible lead owner → configured branch team → visible unassigned Leads queue. Repeated reasons update one active task; completed work may receive a new task for a new request. Owner/admin/managers work Chat tasks; existing Laundry Tasks/roles unchanged, no viewer/finance management expansion.

### CHAT-D049 — Requested price images and neutral review requests
**Status:** ACCEPTED (owner,2026-10-22; P6-5)
Price-list images only when requested,once per conversation after text. Reviews tenant-opt-in,neutral,after actual delivery with configurable90daycooldown; no historical-import triggers,campaigns or positive-feedback-only selection. Supersedes03 §3.17 positive-only proposal; primary policy source in CH6 plan. No Telegram/real outbound activation/paid model authority.

### CHAT-D050 — Unattended local CH6 closure and CH7 continuation
**Status:** ACCEPTED exception (owner,2026-10-23)
Owner authorizes completing as much CH6/CH7 as possible unattended, using recommended implementation choices and recording them for later review. Explicit answer: “Allow local closure and CH-7; defer owner/live acceptance”. CH6 may close/commit locally under D025 only after required local engineering gates, review and no P0/P1 defects; then continue CH7. Owner/manual acceptance and real-channel/model checks remain deferred, unexecuted and production-release blocking. This is not permission to replace real QA with mocks or call incomplete engineering complete. LiveAI remains disabled; no paid run, real external messages, shared SQL, production setting, public tunnel, push/merge/deploy or n8n activation.

### CHAT-D051 — Unattended CH6 implementation recommendations
**Status:** selected under owner authority D050 (2026-10-23); presented for later review
Keep operational approval mandatory even when a channel later uses automatic reply delivery; auto mode is transport signoff, not permission for the model to create customers/pickups. Exact configured confirmation phrases require a current code-composed summary already sent publicly, with no later customer change before approval. Native Laundry status NEW stays pending scheduling and cannot alone claim a booked lead. Staff explicitly supplies the confirmed address country; never infer it or overwrite saved addresses. New controls default off under CHAT_ACTIONS_ENABLED. Local action mock demos use explicit “CH6 synthetic …:” scenarios, never claim real-language/live-model accuracy. These are conservative implementation choices within D045–D049, not new external enablement.

### CHAT-D052 — Conservative supplemental delivery and local-only transport (2026-10-23)
Recommended engineering choices under the owner's unattended implementation authority (D050); no external activation. Price images require a quoted request, configured caption/asset and confirmed public text receipt first; one public attempt per conversation, draft mode requires staff approval. Asset fetch is exact configured URL on explicit owned loopback HTTPS origin allowlist, no redirect, PNG/JPEG bytes and5MB bound; production media transport stays disabled pending separate acceptance. Neutral reviews require explicit opt-in and linked same-customer native order actually delivered/updated after inquiry; completed/paid/draft/import facts never suffice. Shopify reviews remain unavailable until an authoritative actual-delivery adapter is tested; retained imports give no messaging consent. Review cooldown starts only on public receipt; sending/uncertain reserves the contact against concurrent asks. No sentiment filter. Current summary/customer confirmation operational flow is staff-reviewed and separately approved; no autonomous booking claim. Provider labels use read/union/write/verify because its API replaces lists; simultaneous external edits cannot be an OS PLUS transaction. Setup-metadata files for TDD/review point to existing local QA records, no new external issue tracker.

### CHAT-D053 — CH7 recommended local notification defaults
**Status:** selected under owner unattended authorityD050 (2026-10-27); presented for later review.
Use existing tenant-owned normalized target/brand/run tables. Owner-only notification settings and report preview. New targets inactive/events empty;30min one-use code claim plus separate owner confirmation before activation. No live API or unsolicited confirmation message. Group alerts contain minimal event/brand/authenticated lead link, no raw conversation/PII/money. Full daily reports initially ownerDM-only because external group membership cannot enforce OS PLUS report roles.
Unique summary localdate and stable reporting windows at configured localtime, displayed explicitly; latest due only/no historical notification backfill; default21:30 retained but disabled until opted in. Inactive new-platform n8n export polls5min, never reused/activated existinginstance. Unknown send receipts held; no false exactly-once delivery promise or automatic duplicate retry. Recheck current target/module/config before send.
LiveAI/judge/modelIDs/key remain disabled; reports say not evaluated for missing rating and distinguish unknown costs fromzero. Provisional request/native operational task/confirmed booking and paymentclaim/paymenttruth remain distinct. Group currency totals separately. Platform failures only to operator destination without tenant/customer transcripts. Detailed assumptions/files/tests/remainingowner/live gates in CH7_IMPLEMENTATION_PLAN.md; no production release authority.

### CHAT-D054 — Durable operator incidents and report source truth (2026-10-27)
Recommended review corrections under D050/D053, no external activation. Operator notices use a tenant-owned private incident ledger with one claim per tenant/UTC hour and encrypted destination; ambiguous receipts/abandoned sending never auto-retry. New hours are separate bounded health incidents, not a resend of the old delivery. Unknown global tenant resolution or unavailable durable storage never falls back to an untracked send; protected logs/health and later diagnostics are required. Platform alerts remain opt-in/server-configured and contain no tenant/customer details. Added fifth construction SQL20261027124000_chat_platform_alert_attempts.sql, disposable only until reviewed upgrade.
Alert authorization rechecks current brand activity and target brand filter immediately before POST. Daily reporting retains legitimate historical brand sections. Summary known costs include earlier recorded turn charges only when no reservation entries represent the turn, matching the existing budget contract; unsettled entries remain explicitly unknown. Database local-calendar slots are authoritative, including23/25-hour days and the later ambiguous fall-back cutoff.


### CHAT-D055 — CH7 local acceptance, commit and CH8 planning
**Status:** ACCEPTED explicit owner instruction (2026-10-27).
Owner: “Accept local CH-7 results. Defer real Telegram and judge testing, commit locally and continue with CH-8 planning. Keep live AI disabled.” Accepts the reported local engineering results and D053/D054 behavior; authorizes local CH7 closure/commit and CH8 planning on the existing branch. C7-L7 local acceptance is satisfied by this explicit instruction, not evidence that the owner independently performed every C7-L1–L6 action. Real Telegram linking/scheduled delivery/group membership and paid/live judge testing remain unexecuted and production-release blocking. n8n remains inactive/source-reviewed only. No paid AI/transcription, real message, shared migration, purchase, public tunnel, push/merge/deployment or production enablement is authorized. CH8 payment screenshot processing remains excluded under D023.
