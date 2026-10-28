# CH-9 implementation plan — 28 October 2026

Status: IN_PROGRESS, baseline84cfdb15d70826298bc7547d7d943e30d26617c5 on existing codex/chat-ch1-foundation/no upstream. CH8 CLOSED LOCAL under CHAT-D058. No new product decision is needed for the slices below; existing accepted identity/booking/permission rules apply. No CH9 owner acceptance is recorded.

## Scope and user experience

CH9.1 website parser/capture/agent coverage, scoped visitor identity and unverified pre-chat phone; CH9.2 per-brand mapped website inbox snippet/pre-chat guidance; CH9.3 information allowed, requests provisional, verified booking controls preserved. Owner explicitly also requests simplifying the excessive Chat settings UX. Chats remains Chatwoot in a new tab; Leads remains OS PLUS. No replacement inbox.

Owner setup becomes a concise overview plus focused Business knowledge, Channels, Website widget, Reply assistance, Notifications and Access pages using the existing design system. Routine staff flows remain Chats/Leads. Only the selected settings section mounts; advanced JSON stays inside deliberate brand editing, not on the overview. Existing configuration commands, explicit saves, publication and role gates remain. No destructive cleanup of local QA brands/history.

The owner is checking enquiries at a shop desk in normal daylight, often on a phone between customers; retain the existing OS PLUS light/dark theme, compact hierarchy and familiar controls rather than imposing a new palette. PRODUCT.md is loaded; DESIGN.md is absent, existing component tokens are authoritative.

## Contract audit against docs02/03
- Website provider kind, visitor source identity, capture, private drafts and local visitor pages already work from earlier phases. CH9 extends and verifies these paths rather than rebuilding transport.
- Existing globally unique (tenant,kind,value) phone identities are possession-backed lookup keys. A self-asserted website number cannot safely occupy that key, resolve another contact or become a customer link. Store normalized unverified claims separately with tenant/contact/channel/message composite ownership; expose only to PII-authorized staff. This implements the documented unverified-phone requirement without weakening verified identity resolution.
- WBS “booking only with a phone” is necessary, not sufficient. Accepted CH6 and agent §3.15 require verified channel/phone, typed confirmation and staff approval. Website phone alone never books. Dues/statement issuance remains deferred D047.
- A short lead ref is not identity proof. Existing source/WhatsApp reference collisions are reviewed, not automatic contact merges; retain no-auto-merge rule over older §3.15 prose.
- Provider websiteToken is intentionally public embed material; API/platform tokens remain server-only. Generate code from a server-authorized mapped inbox, never accept submitted account authority/provider script snippets.
- LiveAI/STT/model IDs stay disabled/unset. Local hash-only voice, mock replies and loopback Chatwoot are engineering evidence only. No SSO/domain/Meta/production enablement claim.

## Planned files
- Owner settings route and focused Chat settings shell/overview; split existing setup-panel rendering by section; existing action/voice/notification panels reused.
- src/features/chat/website/{rules,queries,actions}.ts, src/components/chat/website-widget.tsx, integration admin-client website inbox read.
- src/features/leads/rules.ts, src/features/chat/capture.ts for normalized website claim projection, and PII-safe contact detail projection if required.
- Additive timestamped SQL20261028100000_chat_website_phone_claims.sql (new tenant-owned claim storage plus audited atomic capture wrapper; frozen prior104 migrations untouched),20261028101000_chat_website_claim_reads.sql (role-filtered read integration if required).
- scripts/test-chat-website-{rules,client,runtime}.mjs plus relevant page guard/owner settings tests; owned local website/native/upgrade/evidence helpers.
- Same root project_summary.md, decision log/WBS/checklist, CH9_QA/OWNER_ACCEPTANCE/local upgrade/Boutique evidence and existing QA workbook as facts change.

## Verification
Build in vertical increments: unverified claims vs verified identity; real loopback scoped website inbox read and script escaping; disposable actual SQL capture/replay/races/rollback/two tenants/PII and inherited booking denial; mounted settings sections/permissions; actual native widget→Chatwoot→private draft→CRM plus two-tenant browser checks, desktop375px, unsaved form handling.
Run typecheck/lint/build/test:roles/test:v2/test:chat. Required BoutiqueTierB for adjacent Chat UI/query work (sign-in/tenant, retained order open/edit withoutsave, production/tracking), broaden toTierA if shared contract/navigation changes become necessary. Native backup/rehearsal/restore/data/ACL evidence before any retained owned-local SQL. No shared SQL.
Closure requires actual local results/final diff/migration review plus CH9 owner acceptance; no earlier phase waiver reused. Live gates stay separately blocked. SpendUSD0. No push/deploy/paid calls/messages/purchase/public tunnel/n8n activation.
