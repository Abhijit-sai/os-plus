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
